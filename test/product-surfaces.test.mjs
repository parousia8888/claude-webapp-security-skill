#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const CLI = join(ROOT, 'scripts', 'webapp-security.mjs');
const CRAWL = join(ROOT, 'scripts', 'crawl-surface-audit.mjs');
const ACTION = join(ROOT, 'scripts', 'run-action.sh');
const SBOM = join(ROOT, 'scripts', 'generate-sbom.mjs');
const temp = mkdtempSync(join(tmpdir(), 'webapp-security-products-'));

function run(program, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(program, args, { cwd: ROOT, ...options, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', (error) => resolve({ status: 127, stdout, stderr: `${stderr}${error.message}` }));
    child.on('close', (status) => resolve({ status, stdout, stderr }));
  });
}

const requests = [];
const server = createServer((req, res) => {
  requests.push(req.url);
  const origin = `http://${req.headers.host}`;
  if (req.url === '/robots.txt') {
    res.writeHead(200, { 'content-type': 'text/plain' });
    res.end(`User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`);
  } else if (req.url === '/sitemap.xml') {
    res.writeHead(200, { 'content-type': 'application/xml' });
    res.end('<?xml version="1.0"?><urlset></urlset>');
  } else if (req.url === '/') {
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(`<html><head><link rel="canonical" href="${origin}/"></head><body>${'ok '.repeat(800)}</body></html>`);
  } else {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('not found');
  }
});

try {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const origin = `http://127.0.0.1:${server.address().port}`;

  let result = await run(process.execPath, [CRAWL, '--site', origin, '--max-urls', '0', '--matrix', '0', '--delay', '0', '--fail-on', 'never', '--quiet']);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(requests.includes('/.env'), false, 'passive crawl must not probe sensitive paths');

  requests.length = 0;
  result = await run(process.execPath, [CRAWL, '--site', origin, '--active-probe', '--max-urls', '0', '--matrix', '0', '--delay', '0', '--fail-on', 'never', '--quiet']);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /requires --acknowledge-authorization/);
  assert.equal(requests.length, 0, 'authorization gate must run before network activity');

  result = await run(process.execPath, [CRAWL, '--site', origin, '--active-probe', '--acknowledge-authorization', '--max-urls', '0', '--matrix', '0', '--delay', '0', '--fail-on', 'never', '--quiet']);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(requests.includes('/.env'), true, 'active probe flag must enable sensitive-path checks');

  result = await run('/bin/bash', [ACTION], {
    env: { ...process.env, INPUT_SITE: origin, INPUT_ACKNOWLEDGE_AUTHORIZATION: 'false' },
  });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /must be true/);

  const actionOut = join(temp, 'action-report');
  result = await run('/bin/bash', [ACTION], {
    env: {
      ...process.env,
      INPUT_SITE: origin,
      INPUT_ACKNOWLEDGE_AUTHORIZATION: 'true',
      INPUT_OUTPUT_DIR: actionOut,
      INPUT_FAIL_ON: 'never',
      INPUT_ACTIVE_PROBE: 'false',
    },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.ok(existsSync(join(actionOut, 'report.json')));
  assert.ok(existsSync(join(actionOut, 'report.md')));

  const failingActionOut = join(temp, 'action-failing-report');
  const stepSummary = join(temp, 'step-summary.md');
  result = await run('/bin/bash', [ACTION], {
    env: {
      ...process.env,
      INPUT_SITE: origin,
      INPUT_ACKNOWLEDGE_AUTHORIZATION: 'true',
      INPUT_OUTPUT_DIR: failingActionOut,
      INPUT_FAIL_ON: 'high',
      INPUT_ACTIVE_PROBE: 'false',
      GITHUB_STEP_SUMMARY: stepSummary,
    },
  });
  assert.equal(result.status, 1, 'Action must preserve the audit failure status');
  assert.ok(existsSync(join(failingActionOut, 'report.json')), 'failing Action must retain evidence');
  assert.match(readFileSync(stepSummary, 'utf8'), /Crawl surface audit/);

  const demoOut = join(temp, 'demo');
  result = await run(process.execPath, [CLI, 'demo', '--out', demoOut]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /before: 13 high, 6 medium/);
  assert.match(result.stdout, /after:\s+0 high, 0 medium/);
  assert.ok(existsSync(join(demoOut, 'before.json')));
  assert.ok(existsSync(join(demoOut, 'after.json')));
  assert.match(readFileSync(join(demoOut, 'hardening.patch'), 'utf8'), /GET \/\.env\s+-> 404/);

  const fakeHome = join(temp, 'home');
  mkdirSync(join(fakeHome, '.codex', 'skills', 'webapp-security-hardening'), { recursive: true });
  writeFileSync(join(fakeHome, '.codex', 'skills', 'webapp-security-hardening', 'sentinel'), 'old');
  result = await run(process.execPath, [CLI, 'install', '--target', 'both'], { env: { ...process.env, HOME: fakeHome } });
  assert.equal(result.status, 2);
  assert.equal(existsSync(join(fakeHome, '.claude', 'skills', 'webapp-security-hardening')), false, 'preflight must prevent partial install');

  result = await run(process.execPath, [CLI, 'install', '--target', 'both', '--force'], { env: { ...process.env, HOME: fakeHome } });
  assert.equal(result.status, 0, result.stderr);
  for (const client of ['.claude', '.codex']) {
    const installed = join(fakeHome, client, 'skills', 'webapp-security-hardening');
    assert.ok(existsSync(join(installed, 'SKILL.md')));
    assert.equal(existsSync(join(installed, 'README.md')), false, 'installer must copy only the skill payload');
  }
  const codexSkills = join(fakeHome, '.codex', 'skills');
  assert.ok(readdirSync(codexSkills).some((name) => name.startsWith('webapp-security-hardening.backup-')));

  const allHome = join(temp, 'all-home');
  result = await run(process.execPath, [CLI, 'install'], { env: { ...process.env, HOME: allHome } });
  assert.equal(result.status, 0, result.stderr);
  assert.ok(existsSync(join(allHome, '.claude', 'skills', 'webapp-security-hardening', 'SKILL.md')));
  assert.ok(existsSync(join(allHome, '.codex', 'skills', 'webapp-security-hardening', 'SKILL.md')));
  assert.ok(existsSync(join(allHome, '.local', 'share', 'webapp-security-hardening', 'SKILL.md')));
  const launcher = join(allHome, '.local', 'bin', 'webapp-security');
  assert.ok(existsSync(launcher));
  result = await run(launcher, ['--help'], { env: { ...process.env, HOME: allHome } });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /webapp-security <command>/);

  const sbomPath = join(temp, 'sbom.spdx.json');
  result = await run(process.execPath, [SBOM, '--out', sbomPath], { env: { ...process.env, SOURCE_DATE_EPOCH: '0' } });
  assert.equal(result.status, 0, result.stderr);
  const sbom = JSON.parse(readFileSync(sbomPath, 'utf8'));
  assert.equal(sbom.spdxVersion, 'SPDX-2.3');
  assert.equal(sbom.creationInfo.created, '1970-01-01T00:00:00.000Z');
  assert.equal(sbom.packages[0].versionInfo, readFileSync(join(ROOT, 'VERSION'), 'utf8').trim());

  console.log('✓ product surfaces: passive boundary, Action gate, demo, installer, and SBOM');
} finally {
  server.close();
  rmSync(temp, { recursive: true, force: true });
}
