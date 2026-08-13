#!/usr/bin/env node
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const temp = mkdtempSync(join(tmpdir(), 'web-app-security-tutorial-test-'));

try {
  const output = join(temp, 'output');
  const result = spawnSync(process.execPath, [
    join(ROOT, 'scripts', 'run-clean-room-tutorial.mjs'), '--out', output,
  ], { cwd: ROOT, encoding: 'utf8', timeout: 600000 });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const evidence = JSON.parse(readFileSync(join(output, 'tutorial-result.json'), 'utf8'));
  assert.ok(evidence.elapsedMilliseconds < evidence.durationBudgetSeconds * 1000);
  assert.equal(evidence.durationBudgetSeconds, 600);
  assert.equal(evidence.networkAccessPerformed, false);
  assert.equal(evidence.baseline.total, 4);
  assert.equal(evidence.baseline.byState.confirmed, 1);
  assert.equal(evidence.baseline.byState.suspected, 3);
  assert.equal(evidence.retest.byBaseline.fixed, 4);
  assert.match(readFileSync(join(output, 'runs', 'first-project', 'proposed.patch'), 'utf8'), /does not prove a fix/);
  assert.equal(evidence.schemaVersion, 3);
  assert.match(readFileSync(join(output, 'finding-explanation.md'), 'utf8'), /Professional term:/);
  console.log('tutorial ok: isolated install, scope, report, explain, patch, retest, upgrade, uninstall');
} finally {
  rmSync(temp, { recursive: true, force: true });
}
