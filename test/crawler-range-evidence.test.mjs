#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SCRIPT = join(ROOT, 'scripts', 'verify-crawler-ip.mjs');
const FIXTURES = join(ROOT, 'test', 'fixtures', 'crawler-ranges');
const LOCAL_ONLY = join(ROOT, 'test', 'helpers', 'local-network-only.cjs');
const requests = [];
const temp = mkdtempSync(join(tmpdir(), 'web-app-security-crawler-identity-'));

const server = createServer((req, res) => {
  requests.push(req.url);
  if (req.url === '/http-503') {
    res.writeHead(503, { 'content-type': 'application/json' });
    res.end('{"error":"fixture unavailable"}');
    return;
  }
  const name = String(req.url || '').replace(/^\//, '');
  try {
    const body = readFileSync(join(FIXTURES, name), 'utf8');
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end();
  }
});

function run(base, ownFixture, siblingFixture = 'valid-miss.json', options = {}) {
  const sources = [
    ['googlebot', 'valid-miss.json'],
    ['google-special', 'valid-miss.json'],
    ['google-user-triggered', 'valid-miss.json'],
    ['bingbot', 'valid-miss.json'],
    ['gptbot', ownFixture],
    ['oai-searchbot', siblingFixture],
    ['chatgpt-user', 'valid-miss.json'],
    ...(options.sources || []),
  ].flatMap(([name, fixture]) => ['--source', `${name}=${base}/${fixture}`]);
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [
      SCRIPT, '--ip', '203.0.113.1', '--ua', options.ua || 'GPTBot/1.2', '--ranges',
      '--max-range-age-days', '365', ...sources, ...(options.extraArgs || []),
    ], {
      cwd: ROOT,
      env: {
        ...process.env,
        SOURCE_DATE_EPOCH: String(Date.parse('2026-08-13T00:00:00Z') / 1000),
        NODE_OPTIONS: `--require=${LOCAL_ONLY}`,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('close', (status) => resolve({ status, stdout, stderr }));
  });
}

try {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;

  const hit = await run(base, 'valid-hit.json');
  assert.equal(hit.status, 0, hit.stderr);
  assert.match(hit.stdout, /verified/);

  const miss = await run(base, 'valid-miss.json');
  assert.equal(miss.status, 1, miss.stderr);
  assert.match(miss.stdout, /spoofed/);

  for (const [name, fixture, expectedEvidence] of [
    ['HTTP unavailable', 'http-503', /HTTP 503|could not be fetched/],
    ['missing prefixes', 'missing-prefixes.json', /prefixes.*missing/i],
    ['wrong prefixes type', 'wrong-prefix-type.json', /prefixes.*array/i],
    ['invalid CIDR', 'invalid-cidr.json', /invalid CIDR/i],
    ['empty prefixes', 'empty-prefixes.json', /prefixes.*empty/i],
    ['future metadata', 'future.json', /future|creationTime/i],
    ['stale metadata', 'stale.json', /stale|creationTime/i],
  ]) {
    const result = await run(base, fixture);
    assert.equal(result.status, 3, `${name}: ${result.stderr}\n${result.stdout}`);
    assert.match(result.stdout, /unverifiable/, name);
    assert.doesNotMatch(result.stdout, /\*\*spoofed\*\*/, name);
    assert.match(`${result.stdout}\n${result.stderr}`, expectedEvidence, name);
  }

  const wrongProduct = await run(base, 'missing-prefixes.json', 'valid-hit.json');
  assert.equal(wrongProduct.status, 3, wrongProduct.stderr);
  assert.match(wrongProduct.stdout, /unverifiable/);
  assert.match(wrongProduct.stdout, /evidence_integrity: total=1; unknown=1 \(high=1\)/);

  const customAnthropic = await run(base, 'valid-miss.json', 'valid-miss.json', {
    ua: 'ClaudeBot/1.0',
    sources: [['claudebot', 'valid-hit.json']],
  });
  assert.equal(customAnthropic.status, 0, customAnthropic.stderr);
  assert.match(customAnthropic.stdout, /Crawler identity verified/);
  assert.match(customAnthropic.stdout, /"vendor":"anthropic"/);

  const out = join(temp, 'report');
  const written = await run(base, 'valid-hit.json', 'valid-miss.json', {
    extraArgs: ['--out', out, '--report-name', 'crawler-fixture'],
  });
  assert.equal(written.status, 0, written.stderr);
  const report = JSON.parse(readFileSync(join(out, 'crawler-fixture.json'), 'utf8'));
  const observations = JSON.parse(readFileSync(join(out, 'crawler-fixture.observations.json'), 'utf8'));
  assert.equal(report.schemaVersion, 2);
  assert.equal(report.ruleset.adapters[0].id, 'builtin-crawler-identity');
  assert.equal(report.findings[0].domain, 'security_exposure');
  assert.equal(report.findings[0].state, 'confirmed');
  assert.equal(report.findings[0].baseline.state, 'new');
  assert.equal(observations.schemaVersion, 1);
  assert.equal(observations.results[0].verdict, 'verified');
  assert.equal(statSync(out).mode & 0o777, 0o700);
  for (const name of ['crawler-fixture.json', 'crawler-fixture.md', 'crawler-fixture.html', 'crawler-fixture.sarif', 'crawler-fixture.junit.xml', 'crawler-fixture.sha256', 'crawler-fixture.observations.json']) {
    assert.equal(statSync(join(out, name)).mode & 0o777, 0o600, `${name} must be private`);
  }

  assert.ok(requests.length > 0);
  assert.ok(requests.every((path) => /^\/(?:http-503|[a-z-]+\.json)$/.test(path)), requests.join(', '));
  console.log('✓ crawler range evidence: v2 bundle plus malformed, stale and sibling-source unknowns');
} finally {
  server.close();
  rmSync(temp, { recursive: true, force: true });
}
