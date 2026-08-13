#!/usr/bin/env node
import assert from 'node:assert/strict';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const CLI = join(ROOT, 'scripts', 'webapp-security.mjs');
const CHECK = join(ROOT, 'scripts', 'check-case-journeys.mjs');
const RUN_JOURNEY = join(ROOT, 'scripts', 'run-case-journey.mjs');
const DENY_NETWORK = join(ROOT, 'test', 'helpers', 'deny-network.cjs');
const temp = mkdtempSync(join(tmpdir(), 'web-app-security-case-'));
const project = join(temp, 'project');

function run(args) {
  return spawnSync(process.execPath, [CLI, ...args], {
    encoding: 'utf8',
    env: { ...process.env, NODE_OPTIONS: `--require=${DENY_NETWORK}`, SOURCE_DATE_EPOCH: '0' },
  });
}

function git(directory, args) {
  const result = spawnSync('git', ['-C', directory, ...args], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

try {
  let result = spawnSync(process.execPath, [CHECK], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /3 projects/);

  cpSync(join(ROOT, 'test', 'fixtures', 'case-open-webui'), project, { recursive: true });
  const runRoot = join(temp, 'representative-runs');
  result = run(['start', project, '--out', runRoot, '--run-id', 'baseline']);
  assert.equal(result.status, 0, result.stderr);
  const baselineDir = join(runRoot, 'baseline');
  result = run(['audit', baselineDir, '--name', 'report', '--fail-on', 'never']);
  assert.equal(result.status, 0, result.stderr);
  const baselinePath = join(baselineDir, 'report.json');
  const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));
  assert.equal(baseline.summary.total, 1);
  const finding = baseline.findings[0];
  assert.equal(finding.rule.id, 'production-source-map-enabled');
  assert.equal(finding.severity, 'medium');
  assert.equal(finding.state, 'suspected');
  assert.equal(finding.location.path, 'vite.config.ts');
  assert.match(readFileSync(join(baselineDir, 'proposed.patch'), 'utf8'), /sourcemap: false/);

  const configPath = join(project, 'vite.config.ts');
  writeFileSync(configPath, readFileSync(configPath, 'utf8').replace('sourcemap: true', 'sourcemap: false'));
  result = run(['start', project, '--out', runRoot, '--run-id', 'retest']);
  assert.equal(result.status, 0, result.stderr);
  const retestDir = join(runRoot, 'retest');
  result = run(['retest', retestDir, '--name', 'report', '--baseline', baselinePath, '--fail-on', 'low']);
  assert.equal(result.status, 0, result.stderr);
  const retest = JSON.parse(readFileSync(join(retestDir, 'report.json'), 'utf8'));
  assert.equal(retest.summary.byBaseline.fixed, 1);
  assert.equal(retest.findings[0].state, 'suspected');
  assert.equal(retest.findings[0].baseline.state, 'fixed');
  assert.equal(JSON.parse(readFileSync(join(retestDir, 'report.sarif'), 'utf8')).runs[0].results.length, 0);

  const checkout = join(temp, 'checkout');
  mkdirSync(checkout);
  writeFileSync(join(checkout, 'package.json'), '{"private":true}\n');
  writeFileSync(join(checkout, 'package-lock.json'), '{"lockfileVersion":3}\n');
  git(checkout, ['init', '-q']);
  git(checkout, ['config', 'user.name', 'Case Test']);
  git(checkout, ['config', 'user.email', 'case-test@example.invalid']);
  git(checkout, ['add', '.']);
  git(checkout, ['commit', '-q', '-m', 'fixture']);
  const commit = git(checkout, ['rev-parse', 'HEAD']);
  const catalogPath = join(temp, 'catalog.json');
  const catalog = {
    journeys: [{
      id: 'local-case',
      commit,
      discovery: {
        status: 'ambiguous',
        layout: 'single-root',
        frameworks: [],
        packageManagers: ['npm@.'],
        lockfiles: ['package-lock.json'],
      },
      deterministicAudit: { total: 0, confirmed: 0, suspected: 0, rules: [] },
    }],
  };
  writeFileSync(catalogPath, `${JSON.stringify(catalog)}\n`);
  const journeyOut = join(temp, 'journey-output');
  result = spawnSync(process.execPath, [RUN_JOURNEY, 'local-case', checkout, '--out', journeyOut, '--catalog', catalogPath], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /checkout:\s+clean and unchanged/);
  assert.match(result.stdout, /network:\s+none/);
  assert.match(result.stdout, /catalog:\s+matched/);
  assert.equal(git(checkout, ['status', '--porcelain', '--untracked-files=normal']), '');

  writeFileSync(join(checkout, 'dirty.txt'), 'uncommitted\n');
  result = spawnSync(process.execPath, [RUN_JOURNEY, 'local-case', checkout, '--out', join(temp, 'dirty-output'), '--catalog', catalogPath], { encoding: 'utf8' });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /checkout must be clean/);
  rmSync(join(checkout, 'dirty.txt'));

  const wrongCatalog = structuredClone(catalog);
  wrongCatalog.journeys[0].commit = '0'.repeat(40);
  const wrongCatalogPath = join(temp, 'wrong-catalog.json');
  writeFileSync(wrongCatalogPath, `${JSON.stringify(wrongCatalog)}\n`);
  result = spawnSync(process.execPath, [RUN_JOURNEY, 'local-case', checkout, '--out', join(temp, 'wrong-output'), '--catalog', wrongCatalogPath], { encoding: 'utf8' });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /does not match/);

  result = spawnSync(process.execPath, [RUN_JOURNEY, 'local-case', checkout, '--out', join(checkout, 'evidence'), '--catalog', catalogPath], { encoding: 'utf8' });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /outside the source checkout/);

  console.log('✓ case journeys: catalog, immutable runner boundary, and representative patch/retest');
} finally {
  rmSync(temp, { recursive: true, force: true });
}
