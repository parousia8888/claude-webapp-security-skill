#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

for (const [script, expected] of [
  ['generate-launch-evidence.mjs', /14 capabilities, 3 journeys, 5 studies/],
  ['check-p7-surfaces.mjs', /tutorials, agent lifecycle, 14 capabilities, 3 journeys, 5 studies/],
]) {
  const args = [join(ROOT, 'scripts', script)];
  if (script.startsWith('generate-')) args.push('--check');
  const result = spawnSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8', timeout: 30000 });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, expected);
}

const evidence = readFileSync(join(ROOT, 'docs', 'launch-evidence.md'), 'utf8');
assert.match(evidence, /13 high \/ 6 medium -> 0 high \/ 0 medium/);
assert.match(evidence, /releases\/tag\/v0\.3\.0/);
assert.doesNotMatch(evidence, /img\.shields\.io\/github\/(?:stars|forks)|star target/i);
console.log('P7 evidence ok: structured counts, local demo, tutorial and metadata contract');
