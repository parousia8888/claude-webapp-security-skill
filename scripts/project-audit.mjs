#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  assertComparableBaseline, compareFindingsV2, createReportV2, failsThresholdV2,
  initializeFindingsV2, policyForFailOn, readBaselineV2, sourceFindingV2, writeReportBundleV2,
} from './lib/evidence-v2.mjs';
import { auditSource, renderPatch } from './lib/source-audit.mjs';
import { buildScope, discoverProject } from './lib/project-discovery.mjs';
import {
  ephemeralSubject, readProjectIdentity, sourceAuditBoundary, validatePersistedScope,
} from './lib/project-identity.mjs';
import { sourceCoverage, sourceRuleset } from './lib/source-rules.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const args = process.argv.slice(2);
const mode = args.shift();

function usage(code, message) {
  if (message) console.error(`error: ${message}`);
  console.log(`webapp-security ${mode || 'audit'} <project-or-run> [options]

Options:
  --out <directory>       Output directory (default: run directory or a new project run)
  --name <basename>       Report basename (default: report)
  --baseline <report>     Required by retest; optional comparison for audit
  --fail-on <severity>    critical, high, medium, low, or never (default: high)
`);
  process.exit(code);
}

function take(name, fallback = null) {
  const index = args.indexOf(name);
  if (index === -1) return fallback;
  if (!args[index + 1] || args[index + 1].startsWith('--')) usage(2, `${name} requires a value`);
  const value = args[index + 1];
  args.splice(index, 2);
  return value;
}

if (!['audit', 'retest'].includes(mode)) usage(2, 'mode must be audit or retest');
if (args.includes('-h') || args.includes('--help')) usage(0);
const outArg = take('--out');
const name = take('--name', 'report');
const baselinePath = take('--baseline');
const failOn = take('--fail-on', 'high');
const targetArg = args.shift();
if (!targetArg) usage(2, 'project-or-run is required');
if (args.length) usage(2, `unknown argument ${args[0]}`);
if (!/^[a-zA-Z0-9._-]+$/.test(name)) usage(2, '--name contains unsupported characters');
if (!['critical', 'high', 'medium', 'low', 'never'].includes(failOn)) usage(2, '--fail-on is invalid');
if (mode === 'retest' && !baselinePath) usage(2, 'retest requires --baseline <report>');

function timestamp() {
  const now = process.env.SOURCE_DATE_EPOCH ? new Date(Number(process.env.SOURCE_DATE_EPOCH) * 1000) : new Date();
  if (Number.isNaN(now.getTime())) usage(2, 'SOURCE_DATE_EPOCH must be numeric');
  return now;
}

function evidenceConflicts(output, reportName) {
  return [
    `${reportName}.json`, `${reportName}.md`, `${reportName}.html`, `${reportName}.sarif`,
    `${reportName}.junit.xml`, `${reportName}.sha256`, 'proposed.patch',
  ].map((file) => join(output, file)).filter((file) => existsSync(file));
}

try {
  const target = resolve(targetArg);
  if (!existsSync(target) || !statSync(target).isDirectory()) throw new Error(`target must be an existing directory: ${targetArg}`);
  const scopePath = join(target, 'security-scope.yml');
  const now = timestamp();
  let localScope;
  let projectRoot;
  let output;
  let subject;
  let persistScope = false;

  if (existsSync(scopePath)) {
    localScope = validatePersistedScope(JSON.parse(readFileSync(scopePath, 'utf8')));
    projectRoot = resolve(localScope.target.projectRoot);
    const identity = readProjectIdentity(projectRoot);
    if (!identity || identity.subjectId !== localScope.subject.id) {
      throw new Error('scope subject does not match the current project identity');
    }
    subject = localScope.subject;
    output = resolve(outArg || target);
  } else {
    if (mode === 'retest' || baselinePath) {
      throw new Error('baseline comparison requires a persisted run created by webapp-security start');
    }
    const discovery = discoverProject(target);
    projectRoot = discovery.projectRoot;
    output = resolve(outArg || join(projectRoot, '.webapp-security', 'runs', `audit-${now.toISOString().replace(/[:.]/g, '-')}`));
    subject = ephemeralSubject(sourceAuditBoundary());
    localScope = buildScope(discovery, {
      version: readFileSync(join(ROOT, 'VERSION'), 'utf8').trim(),
      generatedAt: now.toISOString(),
      runId: basename(output),
      runDirectory: output,
      subject,
    });
    persistScope = true;
  }

  if (!existsSync(projectRoot) || !statSync(projectRoot).isDirectory()) throw new Error('scope projectRoot no longer exists');
  const conflicts = evidenceConflicts(output, name);
  if (conflicts.length) throw new Error(`refusing to overwrite existing evidence: ${conflicts.join(', ')}`);

  const ruleset = sourceRuleset();
  const rawFindings = auditSource(projectRoot);
  const coverage = sourceCoverage(rawFindings);
  const current = rawFindings.map((finding) => sourceFindingV2(finding, ruleset));
  let baseline = null;
  let findings;
  if (baselinePath) {
    const loaded = readBaselineV2(resolve(baselinePath));
    baseline = assertComparableBaseline(subject, loaded.report, loaded.rawBytes);
    if (baseline.sourceDigest !== loaded.sourceDigest) throw new Error('baseline digest metadata is inconsistent');
    findings = compareFindingsV2(current, coverage, loaded.report);
  } else {
    findings = initializeFindingsV2(current, coverage);
  }

  const report = createReportV2({
    version: readFileSync(join(ROOT, 'VERSION'), 'utf8').trim(),
    generatedAt: now.toISOString(),
    mode,
    subject,
    ruleset,
    scope: {
      auditBoundary: localScope.auditBoundary,
      authorizationStatus: localScope.authorization?.status || 'pending',
      checkModes: ['source', 'local'],
      networkAccessPerformed: false,
      runId: localScope.run?.id || null,
    },
    coverage,
    findings,
    baseline,
    policy: policyForFailOn(failOn),
    limitations: [
      'Only deterministic source rules ran; agent-guided API, identity, LLM, data-layer and deployment review did not run.',
      'No network request or dependency execution was performed.',
      'Suspected findings require deployment or runtime evidence before confirmation.',
    ],
  });

  mkdirSync(output, { recursive: true, mode: 0o700 });
  if (persistScope) writeFileSync(join(output, 'security-scope.yml'), `${JSON.stringify(localScope, null, 2)}\n`, { mode: 0o600, flag: 'wx' });
  const files = writeReportBundleV2(report, output, name);
  writeFileSync(join(output, 'proposed.patch'), renderPatch(rawFindings), { mode: 0o600, flag: 'wx' });
  console.log(`report:    ${files.json}`);
  console.log(`findings:  ${report.summary.total}`);
  console.log(`subject:   ${report.subject.id} (${report.subject.binding})`);
  console.log(`states:    confirmed=${report.summary.byState.confirmed}, suspected=${report.summary.byState.suspected}, unknown=${report.summary.byState.unknown}`);
  console.log(`baseline:  new=${report.summary.byBaseline.new}, fixed=${report.summary.byBaseline.fixed}, unchanged=${report.summary.byBaseline.unchanged}, regressed=${report.summary.byBaseline.regressed}, unretested=${report.summary.byBaseline.unretested}, not_comparable=${report.summary.byBaseline.not_comparable}`);
  console.log('network:   none');
  process.exit(failsThresholdV2(report) ? 1 : 0);
} catch (error) {
  usage(2, error.message);
}
