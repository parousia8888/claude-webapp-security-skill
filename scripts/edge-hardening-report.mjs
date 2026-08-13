#!/usr/bin/env node
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createFindingV2, createReportV2, exitCodeV2, initializeFindingsV2, policyForFailOn,
  renderMarkdownV2, writeReportBundleV2,
} from './lib/evidence-v2.mjs';
import { EDGE_ADAPTER, edgeCoverage, edgeRule, edgeRuleset } from './lib/edge-rules.mjs';
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

try {
  const path = take('--observations');
  const site = take('--site');
  const output = take('--out');
  const name = take('--report-name', 'edge-report');
  const failOn = take('--fail-on', 'high');
  const failOnDomains = takeAll('--fail-on-domain');
  const active = take('--active', 'false') === 'true';
  if (!path || !site || args.length) throw new Error('observations, site and known options are required');
  if (!['critical', 'high', 'medium', 'low', 'never'].includes(failOn)) throw new Error('--fail-on is invalid');
  if (!/^[a-zA-Z0-9._-]+$/.test(name)) throw new Error('--report-name contains unsupported characters');
  const observations = readFileSync(path, 'utf8').trim().split('\n').filter(Boolean).map((line) => {
    const [ruleId, state, encoded] = line.split('\t');
    if (!ruleId || !['passed', 'failed', 'unknown', 'not_applicable'].includes(state) || !encoded) {
      throw new Error('malformed edge observation');
    }
    edgeRule(ruleId);
    return { ruleId, state, message: Buffer.from(encoded, 'base64').toString('utf8') };
  });
  const duplicate = observations.find((item, index) =>
    observations.findIndex((candidate) => candidate.ruleId === item.ruleId) !== index);
  if (duplicate) throw new Error(`duplicate edge observation: ${duplicate.ruleId}`);
  const ruleset = edgeRuleset();
  const coverage = edgeCoverage(observations);
  const findings = observations.filter((observation) => ['failed', 'unknown'].includes(observation.state))
    .map((observation) => {
      const rule = edgeRule(observation.ruleId);
      return createFindingV2({
        ruleset,
        adapterId: EDGE_ADAPTER.id,
        rule,
        title: observation.state === 'unknown' ? `${rule.id} evidence unavailable` : `${rule.id} failed`,
        severity: rule.severity,
        state: observation.state === 'unknown' ? 'unknown' : 'confirmed',
        summary: observation.message,
        evidence: { subject: rule.id, site, observedState: observation.state },
        remediation: observation.state === 'unknown'
          ? 'Restore the required curl, TLS or network evidence and rerun the same edge check.'
          : 'Apply the named edge control without weakening public crawler access, then rerun this check.',
        retest: 'Repeat the same passive edge check; active rate-limit checks still require explicit authorization.',
      });
    });
  const generatedAt = process.env.SOURCE_DATE_EPOCH
    ? new Date(Number(process.env.SOURCE_DATE_EPOCH) * 1000).toISOString()
    : new Date().toISOString();
  if (Number.isNaN(Date.parse(generatedAt))) throw new Error('SOURCE_DATE_EPOCH must be numeric');
  const boundary = { version: 1, surface: 'edge', site, activeRateLimit: active };
  const report = createReportV2({
    version: readFileSync(join(fileURLToPath(new URL('..', import.meta.url)), 'VERSION'), 'utf8').trim(),
    generatedAt,
    mode: 'audit',
    subject: {
      id: `project-${randomUUID().replaceAll('-', '').slice(0, 32)}`,
      binding: 'ephemeral',
      scopeDigest: digestValue(boundary),
      localPathIncluded: false,
    },
    ruleset,
    scope: {
      auditBoundary: boundary,
      authorizationStatus: active ? 'explicitly-acknowledged' : 'passive-only',
      checkModes: active ? ['network-passive', 'network-active'] : ['network-passive'],
      networkAccessPerformed: true,
    },
    coverage,
    findings: initializeFindingsV2(findings, coverage),
    policy: policyForFailOn(failOn, failOnDomains),
    limitations: [
      'Edge observations do not establish application authorization or origin-side implementation correctness.',
      'Rate-limit behavior is sampled over the bounded configured request count, not proven for all traffic patterns.',
    ],
  });
  if (output) {
    writeReportBundleV2(report, output, name, { additionalFiles: [{
      name: `${name}.observations.json`,
      json: { schemaVersion: 1, adapter: EDGE_ADAPTER.id, generatedAt, site, observations },
    }] });
  }
  console.log(renderMarkdownV2(report));
  process.exit(exitCodeV2(report));
} catch (error) {
  console.error(`error: ${error.message}`);
  process.exit(2);
}
