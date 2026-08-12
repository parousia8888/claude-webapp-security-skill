#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  applyBaseline, createReport, failsThreshold, readReport, validateReport, writeReportBundle,
} from './lib/evidence.mjs';
import { auditSource, renderPatch } from './lib/source-audit.mjs';
import { buildScope, discoverProject } from './lib/project-discovery.mjs';

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

function evidenceConflicts(output, name) {
  return [
    `${name}.json`, `${name}.md`, `${name}.html`, `${name}.sarif`, `${name}.junit.xml`,
    'proposed.patch',
  ].map((file) => join(output, file)).filter((file) => existsSync(file));
}

try {
  const target = resolve(targetArg);
  if (!existsSync(target) || !statSync(target).isDirectory()) throw new Error(`target must be an existing directory: ${targetArg}`);
  const scopePath = join(target, 'security-scope.yml');
  const now = timestamp();
  let scope;
  let projectRoot;
  let output;
  if (existsSync(scopePath)) {
    scope = JSON.parse(readFileSync(scopePath, 'utf8'));
    projectRoot = resolve(scope.target.projectRoot);
    output = resolve(outArg || target);
    const conflicts = evidenceConflicts(output, name);
    if (conflicts.length) throw new Error(`refusing to overwrite existing evidence: ${conflicts.join(', ')}`);
  } else {
    const discovery = discoverProject(target);
    projectRoot = discovery.projectRoot;
    output = resolve(outArg || join(projectRoot, '.webapp-security', 'runs', `audit-${now.toISOString().replace(/[:.]/g, '-')}`));
    const conflicts = evidenceConflicts(output, name);
    if (conflicts.length) throw new Error(`refusing to overwrite existing evidence: ${conflicts.join(', ')}`);
    scope = buildScope(discovery, {
      version: readFileSync(join(ROOT, 'VERSION'), 'utf8').trim(),
      generatedAt: now.toISOString(),
      runId: basename(output),
      runDirectory: output,
    });
    mkdirSync(output, { recursive: true, mode: 0o700 });
    writeFileSync(join(output, 'security-scope.yml'), `${JSON.stringify(scope, null, 2)}\n`, { mode: 0o600 });
  }
  if (!existsSync(projectRoot) || !statSync(projectRoot).isDirectory()) throw new Error('scope projectRoot no longer exists');
  const baseline = baselinePath ? readReport(resolve(baselinePath)) : null;
  const rawFindings = auditSource(projectRoot);
  const findings = baseline ? applyBaseline(rawFindings, baseline) : rawFindings.map((finding) => ({ ...finding, baselineState: 'new' }));
  const report = createReport({
    version: readFileSync(join(ROOT, 'VERSION'), 'utf8').trim(),
    generatedAt: now.toISOString(),
    mode,
    scope: {
      projectRoot,
      runId: scope.run?.id || null,
      authorizationStatus: scope.authorization?.status || 'pending',
      checkModes: ['source', 'local'],
      networkAccessPerformed: false,
    },
    findings,
    baseline: baseline ? { path: resolve(baselinePath), generatedAt: baseline.generatedAt } : null,
    limitations: [
      'Only deterministic source rules ran; agent-guided API, identity, LLM, data-layer and deployment review did not run.',
      'No network request or dependency execution was performed.',
      'Suspected findings require deployment or runtime evidence before confirmation.',
    ],
  });
  const errors = validateReport(report);
  if (errors.length) throw new Error(errors.join('\n'));
  const files = writeReportBundle(report, output, name);
  writeFileSync(join(output, 'proposed.patch'), renderPatch(report.findings), { mode: 0o600 });
  console.log(`report:    ${files.json}`);
  console.log(`findings:  ${report.summary.total}`);
  console.log(`states:    confirmed=${report.summary.byState.confirmed}, suspected=${report.summary.byState.suspected}, unknown=${report.summary.byState.unknown}`);
  console.log(`baseline:  new=${report.summary.byBaseline.new}, fixed=${report.summary.byBaseline.fixed}, unchanged=${report.summary.byBaseline.unchanged}, regressed=${report.summary.byBaseline.regressed}`);
  console.log('network:   none');
  process.exit(failsThreshold(report, failOn) ? 1 : 0);
} catch (error) {
  usage(2, error.message);
}
