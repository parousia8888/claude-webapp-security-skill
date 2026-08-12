#!/usr/bin/env node
import http from 'node:http';
import https from 'node:https';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SCRIPT = join(ROOT, 'scripts', 'verify-hardening.sh');
const temp = await mkdtemp(join(tmpdir(), 'hardening-fixture-'));

function command(program, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(program, args, { ...options, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

let failed = 0;
function check(name, condition, detail = '') {
  if (!condition) {
    failed++;
    console.error(`x ${name}${detail ? `\n  ${detail}` : ''}`);
  }
}

const key = join(temp, 'key.pem');
const cert = join(temp, 'cert.pem');
const openssl = await command('openssl', [
  'req', '-x509', '-newkey', 'rsa:2048', '-nodes',
  '-keyout', key, '-out', cert, '-days', '1',
  '-subj', '/CN=localhost', '-addext', 'subjectAltName=DNS:localhost,IP:127.0.0.1',
]);
check('openssl fixture certificate generated', openssl.code === 0, openssl.stderr);

const headers = {
  'strict-transport-security': 'max-age=31536000; includeSubDomains',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'content-security-policy': "default-src 'self'; frame-ancestors 'none'",
};

const secure = https.createServer({
  key: await readFile(key), cert: await readFile(cert), minVersion: 'TLSv1.2',
}, (req, res) => {
  res.writeHead(req.url === '/.env' ? 429 : 200, headers);
  res.end('ok');
});
secure.listen(0, '127.0.0.1');
await once(secure, 'listening');
const secureSite = `https://localhost:${secure.address().port}`;

const redirect = http.createServer((req, res) => {
  res.writeHead(308, { location: `${secureSite}${req.url}` });
  res.end();
});
redirect.listen(0, '127.0.0.1');
await once(redirect, 'listening');
const httpSite = `http://localhost:${redirect.address().port}`;

const passive = await command('/bin/bash', [SCRIPT, '--site', secureSite, '--http-site', httpSite, '--n', '1'], {
  env: { ...process.env, CURL_CA_BUNDLE: cert },
});
check('passive hardening verification succeeds', passive.code === 0, passive.stdout + passive.stderr);
check('passive mode skips burst', /skipped; pass --active-rate-limit/.test(passive.stdout));
check('TLS 1.2 is tested', /TLS 1\.2 handshake succeeds/.test(passive.stdout));
check('TLS 1.0 is rejected', /TLS 1\.0 handshake rejected/.test(passive.stdout));
check('certificate chain is validated', /certificate chain and hostname validate/.test(passive.stdout));

const active = await command('/bin/bash', [
  SCRIPT, '--site', secureSite, '--http-site', httpSite, '--active-rate-limit', '--n', '1',
], { env: { ...process.env, CURL_CA_BUNDLE: cert } });
check('active rate-limit verification succeeds', active.code === 0, active.stdout + active.stderr);
check('probe throttling is observed', /probe class is being throttled/.test(active.stdout));
check('content availability is observed', /content class remained available/.test(active.stdout));

for (const value of ['0', 'nope', '101']) {
  const invalid = await command('/bin/bash', [SCRIPT, '--site', 'http://127.0.0.1:1', '--n', value]);
  check(`--n ${value} exits 2`, invalid.code === 2, invalid.stdout + invalid.stderr);
}

const unreachable = await command('/bin/bash', [SCRIPT, '--site', 'http://127.0.0.1:1', '--active-rate-limit', '--n', '1']);
check('network failure cannot pass', unreachable.code !== 0, unreachable.stdout + unreachable.stderr);
check('network failure is not called crawler-safe', !/content class remained available/.test(unreachable.stdout));

secure.close();
redirect.close();
await rm(temp, { recursive: true, force: true });

if (failed) process.exit(1);
console.log('ok verify-hardening: passive/active, TLS, redirect, certificate, network failure, and CLI bounds');
