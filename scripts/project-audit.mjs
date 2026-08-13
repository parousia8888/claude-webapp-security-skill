#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  assertComparableBaseline, compareFindingsV2, createReportV2, exitCodeV2,
  initializeFindingsV2, policyForFailOn, readBaselineV2, sourceFindingV2, writeReportBundleV2,
} from './lib/evidence-v2.mjs';
import { auditSource, renderPatch } from './lib/source-audit.mjs';
import { buildScope, discoverProject } from './lib/project-discovery.mjs';
import {
  ephemeralSubject, readProjectIdentity, sourceAuditBoundary, validatePersistedScope,
  sourceTraversalLimits,
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
  --fail-on-domain <d=t> Override one domain threshold; may be repeated
  --max-depth <n>         Maximum directory depth, 1..64 (default: 12)
  --max-files <n>         Maximum discovered files, 1..200000 (default: 20000)
  --max-entries <n>       Maximum directory entries, 1..500000 (default: 50000)
  --max-file-bytes <n>    Maximum candidate bytes, 1024..16777216 (default: 1048576)
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

function takeAll(name) {
  const values = [];
  while (args.includes(name)) values.push(take(name));
  return values;
}

if (!['audit', 'retest'].includes(mode)) usage(2, 'mode must be audit or retest');
if (args.includes('-h') || args.includes('--help')) usage(0);
const outArg = take('--out');
const name = take('--name', 'report');
const baselinePath = take('--baseline');
const failOn = take('--fail-on', 'high');
const failOnDomains = takeAll('--fail-on-domain');
const limitArgs = {
  maxDepth: take('--max-depth'),
  maxFiles: take('--max-files'),
  maxEntries: take('--max-entries'),
  maxFileBytes: take('--max-file-bytes'),
};
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
  let limits;

  if (existsSync(scopePath)) {
    localScope = validatePersistedScope(JSON.parse(readFileSync(scopePath, 'utf8')));
    const suppliedLimits = Object.values(limitArgs).some((value) => value !== null);
    if (suppliedLimits) {
      const requested = sourceTraversalLimits(Object.fromEntries(Object.entries(limitArgs)
        .filter(([, value]) => value !== null).map(([key, value]) => [key, Number(value)])));
      if (JSON.stringify(requested) !== JSON.stringify(localScope.auditBoundary.traversalLimits)) {
        throw new Error('traversal limits are fixed by the persisted scope; create a new run to change them');
      }
    }
    limits = sourceTraversalLimits(localScope.auditBoundary.traversalLimits);
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
    limits = sourceTraversalLimits(Object.fromEntries(Object.entries(limitArgs)
      .filter(([, value]) => value !== null).map(([key, value]) => [key, Number(value)])));
    const auditBoundary = sourceAuditBoundary(limits);
    const discovery = discoverProject(target, { traversalLimits: limits });
    projectRoot = discovery.projectRoot;
    output = resolve(outArg || join(projectRoot, '.webapp-security', 'runs', `audit-${now.toISOString().replace(/[:.]/g, '-')}`));
    subject = ephemeralSubject(auditBoundary);
    localScope = buildScope(discovery, {
      version: readFileSync(join(ROOT, 'VERSION'), 'utf8').trim(),
      generatedAt: now.toISOString(),
      runId: basename(output),
      runDirectory: output,
      subject,
      auditBoundary,
    });
    persistScope = true;
  }

  if (!existsSync(projectRoot) || !statSync(projectRoot).isDirectory()) throw new Error('scope projectRoot no longer exists');
  const conflicts = evidenceConflicts(output, name);
  if (conflicts.length) throw new Error(`refusing to overwrite existing evidence: ${conflicts.join(', ')}`);

  const ruleset = sourceRuleset();
  const audit = auditSource(projectRoot, limits);
  const rawFindings = audit.findings;
  const coverage = sourceCoverage(audit);
  const current = rawFindings.map((finding) => sourceFindingV2(finding, ruleset));
  let baseline = null;
  let findings;
  if (baselinePath) {
    const loaded = readBaselineV2(resolve(baselinePath));
    baseline = assertComparableBaseline(subject, loaded.report, loaded.rawBytes);
    if (baseline.sourceDigest !== loaded.sourceDigest) throw new Error('baseline digest metadata is inconsistent');
    findings = compareFindingsV2(current, coverage, loaded.report, ruleset);
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
      traversal: audit.traversal,
    },
    coverage,
    findings,
    baseline,
    policy: policyForFailOn(failOn, failOnDomains),
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
  process.exit(exitCodeV2(report));
} catch (error) {
  usage(2, error.message);
}
