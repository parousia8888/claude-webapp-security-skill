#!/usr/bin/env node
import assert from 'node:assert/strict';
import { chmodSync, cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
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

const emptyFindingDigest = createHash('sha256').update('[]').digest('hex');

try {
  let result = spawnSync(process.execPath, [CHECK], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /5 projects/);

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
  const fakeGitleaks = join(temp, 'fake-gitleaks.mjs');
  const fakeOsv = join(temp, 'fake-osv.mjs');
  writeFileSync(fakeGitleaks, `#!/usr/bin/env node
if (process.argv[2] === 'version') console.log('8.30.1'); else console.log('[]');
`);
  writeFileSync(fakeOsv, `#!/usr/bin/env node
if (process.argv[2] === '--version') console.log('osv-scanner version: 2.5.0');
else console.log('{"results":[]}');
`);
  chmodSync(fakeGitleaks, 0o755);
  chmodSync(fakeOsv, 0o755);
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
      corpus: {
        runDate: '1970-01-01T00:00:00.000Z',
        rulesetDigest: '17e89541f7080fd0f2a09296ca257be515dae43feead8a9f0c620690e6168def',
        adapters: [
          { id: 'builtin-source', version: '1.1.0', status: 'built_in', rulesetDigest: 'e27dc95907ab5cd1f2809078f8f05e5356b9808b5b42da2c7ba3bd480fc0f7b6', deterministicFindingIdsDigest: emptyFindingDigest, deterministicFindingContentDigest: emptyFindingDigest },
          { id: 'gitleaks', version: '8.30.1', status: 'available', rulesetDigest: '47225f84fc2d1eac9899a182d700e4713a13accd561c7da91250dca94b52c0d6', deterministicFindingIdsDigest: emptyFindingDigest, deterministicFindingContentDigest: emptyFindingDigest },
          { id: 'osv', version: '2.5.0', status: 'available', rulesetDigest: '0e0d7d61d9a883eef12ffceb296d1fe706c38f1139efb76dea67b82b259dbbe2' },
        ],
        coverage: {
          'dependency-lockfile-missing': 'completed',
          'sensitive-env-file-present': 'completed',
          'node-inspector-public-bind': 'completed',
          'production-source-map-enabled': 'completed',
          'source-stack-unsupported': 'completed',
          'source-evidence-incomplete': 'completed',
          'gitleaks-committed-secret': 'completed',
          'gitleaks-working-tree-secret': 'completed',
          'osv-known-vulnerability': 'completed',
        },
        snapshot: { summary: { confirmed: 0 }, byRule: {} },
        confirmedFindingIds: [],
      },
    }],
  };
  writeFileSync(catalogPath, `${JSON.stringify(catalog)}\n`);
  const journeyOut = join(temp, 'journey-output');
  const runnerEnv = {
    ...process.env,
    WEBAPP_SECURITY_GITLEAKS_BIN: fakeGitleaks,
    WEBAPP_SECURITY_OSV_SCANNER_BIN: fakeOsv,
  };
  result = spawnSync(process.execPath, [RUN_JOURNEY, 'local-case', checkout, '--out', journeyOut, '--catalog', catalogPath], { encoding: 'utf8', env: runnerEnv });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /checkout:\s+clean and unchanged/);
  assert.match(result.stdout, /catalog:\s+stable contract matched/);
  assert.equal(git(checkout, ['status', '--porcelain', '--untracked-files=normal']), '');

  const contentDriftCatalog = structuredClone(catalog);
  contentDriftCatalog.journeys[0].corpus.adapters[0].deterministicFindingContentDigest = '0'.repeat(64);
  const contentDriftCatalogPath = join(temp, 'content-drift-catalog.json');
  writeFileSync(contentDriftCatalogPath, `${JSON.stringify(contentDriftCatalog)}\n`);
  result = spawnSync(process.execPath, [RUN_JOURNEY, 'local-case', checkout, '--out',
    join(temp, 'content-drift-output'), '--catalog', contentDriftCatalogPath], {
    encoding: 'utf8', env: runnerEnv,
  });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /observed evidence differs from catalog/);

  result = spawnSync(process.execPath, [RUN_JOURNEY, 'local-case', checkout, '--out', join(temp, 'missing-binary-output'), '--catalog', catalogPath], { encoding: 'utf8' });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /set WEBAPP_SECURITY_GITLEAKS_BIN/);

  writeFileSync(join(checkout, 'dirty.txt'), 'uncommitted\n');
  result = spawnSync(process.execPath, [RUN_JOURNEY, 'local-case', checkout, '--out', join(temp, 'dirty-output'), '--catalog', catalogPath], { encoding: 'utf8', env: runnerEnv });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /checkout must be clean/);
  rmSync(join(checkout, 'dirty.txt'));

  const wrongCatalog = structuredClone(catalog);
  wrongCatalog.journeys[0].commit = '0'.repeat(40);
  const wrongCatalogPath = join(temp, 'wrong-catalog.json');
  writeFileSync(wrongCatalogPath, `${JSON.stringify(wrongCatalog)}\n`);
  result = spawnSync(process.execPath, [RUN_JOURNEY, 'local-case', checkout, '--out', join(temp, 'wrong-output'), '--catalog', wrongCatalogPath], { encoding: 'utf8', env: runnerEnv });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /does not match/);

  result = spawnSync(process.execPath, [RUN_JOURNEY, 'local-case', checkout, '--out', join(checkout, 'evidence'), '--catalog', catalogPath], { encoding: 'utf8', env: runnerEnv });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /outside the source checkout/);

  console.log('✓ case journeys: v3 source reports, pinned adapter runner, and representative patch/retest');
} finally {
  rmSync(temp, { recursive: true, force: true });
}
