#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const gifPath = join(ROOT, 'docs', 'assets', 'demo.gif');
const metadata = JSON.parse(readFileSync(join(ROOT, 'docs', 'assets', 'demo.json'), 'utf8'));
const gif = readFileSync(gifPath);
const result = spawnSync(process.execPath, [join(ROOT, 'scripts', 'generate-demo-gif.mjs'), '--check'], {
  cwd: ROOT, encoding: 'utf8', timeout: 30000,
});

assert.equal(result.status, 0, result.stderr || result.stdout);
assert.match(result.stdout, /demo GIF current: 5 frames/);
assert.equal(gif.subarray(0, 6).toString('ascii'), 'GIF89a');
assert.equal(gif.at(-1), 0x3b);
assert.equal(metadata.width, 840);
assert.equal(metadata.height, 472);
assert.equal(metadata.frames, 5);
assert.equal(metadata.schemaVersion, 2);
assert.equal(metadata.result.boundary, 'owned-local-fixture-no-third-party-target');
assert.equal(metadata.result.before.bySeverity.high, 13);
assert.equal(metadata.result.before.bySeverity.medium, 6);
assert.equal(metadata.result.before.byDomain.security_exposure.confirmed.high, 2);
assert.equal(metadata.result.before.byDomain.search_discoverability.confirmed.high, 11);
assert.equal(metadata.result.before.byDomain.search_discoverability.confirmed.medium, 5);
assert.equal(metadata.result.before.byDomain.reliability.confirmed.medium, 1);
assert.equal(metadata.result.after.bySeverity.high, 0);
assert.equal(metadata.result.after.bySeverity.medium, 0);
assert.equal(metadata.result.fixed, 21);
assert.equal(metadata.sha256, createHash('sha256').update(gif).digest('hex'));
assert.equal(metadata.bytes, gif.length);
assert.ok(gif.length < 5_000_000, `demo GIF is too large: ${gif.length}`);

for (const readme of ['README.md', 'README.zh-CN.md']) {
  const text = readFileSync(join(ROOT, readme), 'utf8');
  assert.match(text, /docs\/assets\/demo\.gif/);
  assert.match(text, /docs\/demo-evidence\.md/);
}
console.log(`demo GIF ok: real fixture, deterministic digest, ${gif.length} bytes`);
