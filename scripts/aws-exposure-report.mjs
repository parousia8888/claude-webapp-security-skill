#!/usr/bin/env node
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createFindingV2, createReportV2, exitCodeV2, initializeFindingsV2, policyForFailOn,
  renderMarkdownV2, writeReportBundleV2,
} from './lib/evidence-v2.mjs';
import { AWS_ADAPTER, AWS_RULES, awsCoverage, awsRule, awsRuleset } from './lib/aws-rules.mjs';
import { digestValue } from './lib/project-identity.mjs';

const args = process.argv.slice(2);
function take(name, fallback = null) {
  const index = args.indexOf(name);
  if (index === -1) return fallback;
  const value = args[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`${name} requires a value`);
  args.splice(index, 2);
  return value;
}

function takeAll(name) {
  const values = [];
  while (args.includes(name)) values.push(take(name));
  return values;
}

function decode(value) {
  return Buffer.from(value, 'base64').toString('utf8');
}

try {
  if (args.length === 1 && args[0] === '--list-rules') {
    console.log(AWS_RULES.map((rule) => rule.id).join('\n'));
    process.exit(0);
  }
  const path = take('--observations');
  const region = take('--region');
  const account = take('--account', 'unavailable');
  const output = take('--out');
  const name = take('--report-name', 'aws-report');
  const failOn = take('--fail-on', 'high');
  const failOnDomains = takeAll('--fail-on-domain');
  if (!path || !region || args.length) throw new Error('observations, region and known options are required');
  if (!['critical', 'high', 'medium', 'low', 'never'].includes(failOn)) throw new Error('--fail-on is invalid');
  if (!/^[a-zA-Z0-9._-]+$/.test(name)) throw new Error('--report-name contains unsupported characters');
  const observations = readFileSync(path, 'utf8').trim().split('\n').filter(Boolean).map((line) => {
    const [ruleId, state, subject64, message64] = line.split('\t');
    if (!ruleId || !['passed', 'failed', 'unknown', 'not_applicable'].includes(state)
        || !subject64 || !message64) throw new Error('malformed AWS observation');
    awsRule(ruleId);
    return { ruleId, state, subject: decode(subject64), message: decode(message64) };
  });
  const ruleset = awsRuleset();
  const coverage = awsCoverage(observations);
  const findings = observations.filter((observation) => ['failed', 'unknown'].includes(observation.state))
    .map((observation) => {
      const rule = awsRule(observation.ruleId);
      return createFindingV2({
        ruleset,
        adapterId: AWS_ADAPTER.id,
        rule,
        title: observation.state === 'unknown' ? `${rule.title} evidence unavailable` : `${rule.title} failed`,
        severity: rule.severity,
        state: observation.state === 'unknown' ? 'unknown' : 'confirmed',
        summary: observation.message,
        evidence: { subject: observation.subject, region, observedState: observation.state },
        remediation: observation.state === 'unknown'
          ? 'Restore the missing AWS CLI, IAM permission or structured response and rerun this read-only check.'
          : `Correct the ${rule.title.toLowerCase()} control and rerun this read-only check.`,
        retest: `Repeat ${rule.id} with the same account and region and require completed coverage.`,
      });
    });
  const uniqueFindings = [...findings.reduce((byFingerprint, finding) => {
    const previous = byFingerprint.get(finding.fingerprint);
    if (!previous || (previous.state === 'unknown' && finding.state === 'confirmed')) {
      byFingerprint.set(finding.fingerprint, finding);
    }
    return byFingerprint;
  }, new Map()).values()];
  const generatedAt = process.env.SOURCE_DATE_EPOCH
    ? new Date(Number(process.env.SOURCE_DATE_EPOCH) * 1000).toISOString()
    : new Date().toISOString();
  if (Number.isNaN(Date.parse(generatedAt))) throw new Error('SOURCE_DATE_EPOCH must be numeric');
  const accountDigest = account === 'unavailable'
    ? 'unavailable'
    : createHash('sha256').update(account).digest('hex');
  const boundary = { version: 1, surface: 'aws', accountDigest, region };
  const report = createReportV2({
    version: readFileSync(join(fileURLToPath(new URL('..', import.meta.url)), 'VERSION'), 'utf8').trim(),
    generatedAt,
    mode: 'audit',
    subject: {
      id: account === 'unavailable'
        ? `project-${randomUUID().replaceAll('-', '').slice(0, 32)}`
        : `project-${digestValue({ surface: 'aws', account }).slice(0, 32)}`,
      binding: 'ephemeral',
      scopeDigest: digestValue(boundary),
      localPathIncluded: false,
    },
    ruleset,
    scope: {
      auditBoundary: boundary,
      authorizationStatus: 'read-only-user-directed',
      checkModes: ['aws-read-only'],
      networkAccessPerformed: true,
    },
    coverage,
    findings: initializeFindingsV2(uniqueFindings, coverage),
    policy: policyForFailOn(failOn, failOnDomains),
    limitations: [
      'The inventory covers one account and one configured region; global services are included only where queried.',
      'Read-only AWS configuration evidence does not prove application-layer authorization or runtime isolation.',
      'Unavailable operations remain unknown and can conceal additional findings.',
    ],
  });
  if (output) {
    writeReportBundleV2(report, output, name, { additionalFiles: [{
      name: `${name}.observations.json`,
      json: { schemaVersion: 1, adapter: AWS_ADAPTER.id, generatedAt, accountDigest, region, observations },
    }] });
  }
  console.log(renderMarkdownV2(report));
  process.exit(exitCodeV2(report));
} catch (error) {
  console.error(`error: ${error.message}`);
  process.exit(2);
}
