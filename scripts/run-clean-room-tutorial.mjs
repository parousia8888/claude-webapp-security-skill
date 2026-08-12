#!/usr/bin/env node
import assert from 'node:assert/strict';
import {
  existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const args = process.argv.slice(2);
const outIndex = args.indexOf('--out');
if (outIndex === -1 || !args[outIndex + 1] || args.length !== 2) {
  console.error('usage: node scripts/run-clean-room-tutorial.mjs --out <empty-directory>');
  process.exit(2);
}
const output = resolve(args[outIndex + 1]);
const home = mkdtempSync(join(tmpdir(), 'web-app-security-tutorial-home-'));
const started = Date.now();

function run(program, commandArgs, options = {}) {
  const result = spawnSync(program, commandArgs, { encoding: 'utf8', ...options });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result;
}

try {
  if (existsSync(output)) assert.equal(readdirSync(output).length, 0, `output must be empty: ${output}`);
  mkdirSync(output, { recursive: true, mode: 0o700 });
  const env = {
    ...process.env,
    HOME: home,
    NODE_OPTIONS: `--require=${join(ROOT, 'test', 'helpers', 'deny-network.cjs')}`,
    SOURCE_DATE_EPOCH: '0',
  };
  const cliSource = join(ROOT, 'scripts', 'webapp-security.mjs');
  const before = join(ROOT, 'examples', 'quickstart', 'before');
  const after = join(ROOT, 'examples', 'quickstart', 'after');
  const runs = join(output, 'runs');
  const audit = join(output, 'audit');
  const retest = join(output, 'retest');

  run(process.execPath, [cliSource, 'install', '--target', 'cli'], { cwd: ROOT, env });
  const launcher = join(home, '.local', 'bin', 'webapp-security');
  const versionOutput = run(launcher, ['version'], { cwd: ROOT, env }).stdout.trim();
  assert.equal(versionOutput, `Web App Security Skill ${readFileSync(join(ROOT, 'VERSION'), 'utf8').trim()}`);
  run(launcher, ['start', before, '--out', runs, '--run-id', 'first-project'], { cwd: ROOT, env });
  run(launcher, ['audit', before, '--out', audit, '--name', 'report', '--fail-on', 'never'], {
    cwd: ROOT, env,
  });
  const baselinePath = join(audit, 'report.json');
  const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));
  assert.equal(baseline.summary.total, 4);
  assert.equal(baseline.summary.byState.confirmed, 1);
  assert.equal(baseline.summary.byState.suspected, 3);
  assert.equal(baseline.scope.networkAccessPerformed, false);
  assert.ok(existsSync(join(audit, 'report.md')));
  assert.ok(existsSync(join(audit, 'report.html')));
  assert.ok(existsSync(join(audit, 'report.sarif')));
  assert.ok(existsSync(join(audit, 'report.junit.xml')));
  assert.match(readFileSync(join(audit, 'proposed.patch'), 'utf8'), /Proposed changes only/);

  const finding = baseline.findings.find((item) => item.ruleId === 'production-source-map-enabled');
  assert.ok(finding);
  const explanation = run(launcher, ['explain', finding.id, '--report', baselinePath], {
    cwd: ROOT, env,
  }).stdout;
  writeFileSync(join(output, 'finding-explanation.md'), explanation, { mode: 0o600 });
  assert.match(explanation, /Evidence state: suspected/);

  run(launcher, [
    'retest', after, '--out', retest, '--name', 'report', '--baseline', baselinePath,
    '--fail-on', 'low',
  ], { cwd: ROOT, env });
  const retested = JSON.parse(readFileSync(join(retest, 'report.json'), 'utf8'));
  assert.equal(retested.summary.byBaseline.fixed, 4);
  assert.equal(retested.summary.byBaseline.unchanged, 0);
  assert.equal(retested.summary.byBaseline.regressed, 0);

  run(process.execPath, [cliSource, 'upgrade', '--target', 'cli'], { cwd: ROOT, env });
  assert.equal(run(launcher, ['version'], { cwd: ROOT, env }).stdout.trim(), versionOutput);
  run(launcher, ['uninstall', '--target', 'cli'], { cwd: ROOT, env });
  assert.equal(existsSync(launcher), false);

  const result = {
    schemaVersion: 1,
    durationBudgetSeconds: 600,
    elapsedMilliseconds: Date.now() - started,
    networkAccessPerformed: false,
    baseline: baseline.summary,
    retest: retested.summary,
    outputs: {
      scope: 'runs/first-project/security-scope.yml',
      report: 'audit/report.json',
      markdown: 'audit/report.md',
      patch: 'audit/proposed.patch',
      explanation: 'finding-explanation.md',
      retest: 'retest/report.json',
    },
  };
  assert.ok(result.elapsedMilliseconds < result.durationBudgetSeconds * 1000);
  writeFileSync(join(output, 'tutorial-result.json'), `${JSON.stringify(result, null, 2)}\n`, {
    mode: 0o600,
  });
  console.log(`clean-room tutorial ok: ${baseline.summary.total} findings -> ${retested.summary.byBaseline.fixed} fixed`);
  console.log(`network: none; elapsed: ${result.elapsedMilliseconds} ms; output: ${output}`);
} catch (error) {
  console.error(`clean-room tutorial: ${error.message}`);
  process.exitCode = 1;
} finally {
  rmSync(home, { recursive: true, force: true });
}
