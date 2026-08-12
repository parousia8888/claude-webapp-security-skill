#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { validateReport } from '../scripts/lib/evidence.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const CLI = join(ROOT, 'scripts', 'webapp-security.mjs');
const DENY_NETWORK = join(ROOT, 'test', 'helpers', 'deny-network.cjs');
const temp = mkdtempSync(join(tmpdir(), 'web-app-security-evidence-'));
const project = join(temp, 'project');
const originalFixture = join(ROOT, 'test', 'fixtures', 'audit-app');

function run(args) {
  return spawnSync(process.execPath, [CLI, ...args], {
    encoding: 'utf8',
    env: { ...process.env, NODE_OPTIONS: `--require=${DENY_NETWORK}`, SOURCE_DATE_EPOCH: '0' },
  });
}

function report(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

try {
  cpSync(originalFixture, project, { recursive: true });
  const originalPackage = readFileSync(join(project, 'package.json'), 'utf8');
  const originalConfig = readFileSync(join(project, 'next.config.mjs'), 'utf8');

  const baselineDir = join(temp, 'baseline');
  let result = run(['audit', project, '--out', baselineDir, '--name', 'baseline', '--fail-on', 'high']);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /network:\s+none/);
  for (const extension of ['json', 'md', 'html', 'sarif', 'junit.xml']) {
    const path = join(baselineDir, `baseline.${extension}`);
    assert.ok(existsSync(path), path);
    assert.equal(statSync(path).mode & 0o077, 0, `${path} must not be group/world readable`);
  }
  const baselinePath = join(baselineDir, 'baseline.json');
  const baseline = report(baselinePath);
  assert.deepEqual(validateReport(baseline), []);
  assert.equal(baseline.schemaVersion, 1);
  assert.equal(baseline.generatedAt, '1970-01-01T00:00:00.000Z');
  assert.equal(baseline.summary.byBaseline.new, 4);
  assert.equal(baseline.summary.byState.confirmed, 1);
  assert.equal(baseline.summary.byState.suspected, 3);
  assert.equal(new Set(baseline.findings.map((finding) => finding.fingerprint)).size, 4);
  assert.ok(baseline.findings.every((finding) => /^[a-f0-9]{64}$/.test(finding.fingerprint)));
  const sourceMapFinding = baseline.findings.find((finding) => finding.ruleId === 'production-source-map-enabled');
  const inspectorFinding = baseline.findings.find((finding) => finding.ruleId === 'node-inspector-public-bind');
  const lockFinding = baseline.findings.find((finding) => finding.ruleId === 'dependency-lockfile-missing');
  assert.equal(sourceMapFinding.state, 'suspected');
  assert.equal(inspectorFinding.state, 'suspected');
  assert.equal(lockFinding.state, 'confirmed');

  const patch = readFileSync(join(baselineDir, 'proposed.patch'), 'utf8');
  assert.match(patch, /Proposed changes only/);
  assert.match(patch, /productionBrowserSourceMaps: false/);
  assert.equal(readFileSync(join(project, 'package.json'), 'utf8'), originalPackage, 'audit must not edit package.json');
  assert.equal(readFileSync(join(project, 'next.config.mjs'), 'utf8'), originalConfig, 'audit must not edit config');
  result = run(['audit', project, '--out', baselineDir, '--name', 'baseline', '--fail-on', 'never']);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /refusing to overwrite existing evidence/);
  assert.equal(report(baselinePath).findings.length, 4, 'collision must preserve the baseline');

  result = run(['explain', sourceMapFinding.id, '--report', baselinePath]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Evidence state: suspected/);
  assert.match(result.stdout, /publicDelivery/);
  result = run(['explain', 'missing-finding', '--report', baselinePath]);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /finding not found/);

  const invalid = structuredClone(baseline);
  invalid.findings[0].state = 'safe';
  assert.ok(validateReport(invalid).some((error) => error.includes('state is invalid')));

  const sarif = JSON.parse(readFileSync(join(baselineDir, 'baseline.sarif'), 'utf8'));
  assert.equal(sarif.version, '2.1.0');
  assert.equal(sarif.runs[0].results.length, 4);
  assert.equal(sarif.runs[0].results.find((item) => item.ruleId === sourceMapFinding.ruleId).properties.evidenceState, 'suspected');
  assert.equal(sarif.runs[0].results.find((item) => item.ruleId === sourceMapFinding.ruleId).fingerprints.webAppSecurityFingerprint, sourceMapFinding.fingerprint);
  const junit = readFileSync(join(baselineDir, 'baseline.junit.xml'), 'utf8');
  assert.match(junit, /tests="4" failures="1" skipped="3"/);
  assert.match(junit, /message="suspected"/);

  const unchangedDir = join(temp, 'unchanged');
  result = run(['retest', project, '--out', unchangedDir, '--name', 'unchanged', '--baseline', baselinePath, '--fail-on', 'high']);
  assert.equal(result.status, 0, result.stderr);
  const unchanged = report(join(unchangedDir, 'unchanged.json'));
  assert.equal(unchanged.summary.byBaseline.unchanged, 4);
  assert.ok(unchanged.findings.every((finding) => finding.baselineState === 'unchanged'));

  writeFileSync(join(project, 'package-lock.json'), '{"lockfileVersion":3}\n');
  writeFileSync(join(project, 'next.config.mjs'), 'export default { productionBrowserSourceMaps: false };\n');
  const fixedPackage = JSON.parse(readFileSync(join(project, 'package.json'), 'utf8'));
  fixedPackage.scripts.debug = 'node --inspect=127.0.0.1:9229 server.js';
  writeFileSync(join(project, 'package.json'), `${JSON.stringify(fixedPackage, null, 2)}\n`);
  rmSync(join(project, '.env.production'));

  const fixedDir = join(temp, 'fixed');
  result = run(['retest', project, '--out', fixedDir, '--name', 'fixed', '--baseline', baselinePath, '--fail-on', 'low']);
  assert.equal(result.status, 0, result.stderr);
  const fixedPath = join(fixedDir, 'fixed.json');
  const fixed = report(fixedPath);
  assert.equal(fixed.mode, 'retest');
  assert.equal(fixed.summary.byBaseline.fixed, 4);
  assert.equal(fixed.summary.byState.confirmed, 1, 'confirmed lockfile finding stays confirmed when fixed');
  assert.equal(fixed.summary.byState.suspected, 3, 'suspected leads are not promoted when fixed');
  assert.ok(fixed.findings.every((finding) => finding.baselineState === 'fixed'));
  assert.equal(JSON.parse(readFileSync(join(fixedDir, 'fixed.sarif'), 'utf8')).runs[0].results.length, 0);
  assert.match(readFileSync(join(fixedDir, 'fixed.junit.xml'), 'utf8'), /failures="0" skipped="4"/);

  writeFileSync(join(project, 'next.config.mjs'), originalConfig);
  const regressedDir = join(temp, 'regressed');
  result = run(['retest', project, '--out', regressedDir, '--name', 'regressed', '--baseline', fixedPath, '--fail-on', 'medium']);
  assert.equal(result.status, 0, result.stderr, 'suspected medium regression must not fail a confirmed-only gate');
  const regressed = report(join(regressedDir, 'regressed.json'));
  const regression = regressed.findings.find((finding) => finding.ruleId === 'production-source-map-enabled');
  assert.equal(regression.baselineState, 'regressed');
  assert.equal(regression.state, 'suspected');
  assert.equal(regressed.summary.byBaseline.regressed, 1);

  rmSync(join(project, 'package-lock.json'));
  const confirmedRegressionDir = join(temp, 'confirmed-regression');
  result = run(['retest', project, '--out', confirmedRegressionDir, '--name', 'confirmed', '--baseline', fixedPath, '--fail-on', 'low']);
  assert.equal(result.status, 1, 'confirmed low regression must fail at low threshold');
  const confirmedRegression = report(join(confirmedRegressionDir, 'confirmed.json'));
  assert.equal(confirmedRegression.findings.find((finding) => finding.ruleId === 'dependency-lockfile-missing').baselineState, 'regressed');

  const hostile = join(temp, '<img src=x onerror=alert(1)>');
  mkdirSync(hostile);
  cpSync(originalFixture, join(hostile, 'app'), { recursive: true });
  const hostileDir = join(temp, 'hostile-report');
  result = run(['audit', hostile, '--out', hostileDir, '--name', 'hostile', '--fail-on', 'never']);
  assert.equal(result.status, 0, result.stderr);
  const html = readFileSync(join(hostileDir, 'hostile.html'), 'utf8');
  assert.equal(html.includes('<img src=x onerror=alert(1)>'), false);
  assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'));

  const signature = createHash('sha256').update([
    readFileSync(join(baselineDir, 'baseline.md'), 'utf8'),
    readFileSync(join(baselineDir, 'baseline.html'), 'utf8'),
    readFileSync(join(baselineDir, 'baseline.sarif'), 'utf8'),
    readFileSync(join(baselineDir, 'baseline.junit.xml'), 'utf8'),
  ].join('\n---renderer---\n').split(temp).join('<TEMP>')).digest('hex');
  assert.equal(signature, '51a8ebee1cf2b2b1bc9e12a7013e09cf6123c8ac9800398f42ce6b2318d2d17f');

  result = run(['retest', project, '--out', join(temp, 'no-baseline')]);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /retest requires --baseline/);

  console.log('✓ evidence loop: schemas, renderers, patch-only, explain, fixed and regressed states');
} finally {
  rmSync(temp, { recursive: true, force: true });
}
