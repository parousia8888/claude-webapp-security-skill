#!/usr/bin/env node
import assert from 'node:assert/strict';
import {
  cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync,
  symlinkSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const CLI = join(ROOT, 'scripts', 'webapp-security.mjs');
const FIXTURES = join(ROOT, 'test', 'fixtures');
const DENY_NETWORK = join(ROOT, 'test', 'helpers', 'deny-network.cjs');
const temp = mkdtempSync(join(tmpdir(), 'web-app-security-discovery-'));

function start(project, runId, extra = []) {
  const out = join(temp, 'runs');
  const result = spawnSync(process.execPath, [CLI, 'start', project, '--out', out, '--run-id', runId, ...extra], {
    encoding: 'utf8',
    env: { ...process.env, NODE_OPTIONS: `--require=${DENY_NETWORK}`, SOURCE_DATE_EPOCH: '0' },
  });
  const scopePath = join(out, runId, 'security-scope.yml');
  return { ...result, out, scopePath, scope: existsSync(scopePath) ? JSON.parse(readFileSync(scopePath, 'utf8')) : null };
}

try {
  let result = start(join(FIXTURES, 'next-app'), 'next');
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.scope.schemaVersion, 1);
  assert.equal(result.scope.generatedAt, '1970-01-01T00:00:00.000Z');
  assert.equal(result.scope.target.discoveryStatus, 'supported');
  assert.equal(result.scope.target.layout, 'single-root');
  assert.ok(result.scope.target.frameworks.some((item) => item.name === 'Next.js'));
  assert.ok(result.scope.target.packageManagers.some((item) => item.name === 'pnpm'));
  assert.deepEqual(result.scope.target.lockfiles, ['pnpm-lock.yaml']);
  assert.deepEqual(result.scope.target.deploymentSurfaces, ['vercel.json']);
  assert.deepEqual(result.scope.target.configSurfaces, ['next.config.mjs']);
  assert.equal(result.scope.discoveryEvidence.networkAccessPerformed, false);
  assert.equal(result.scope.discoveryEvidence.secretFilesRead, false);
  assert.equal(statSync(result.scopePath).mode & 0o777, 0o600);
  assert.equal(statSync(join(result.out, 'next')).mode & 0o777, 0o700);

  result = start(join(FIXTURES, 'fastapi-app'), 'fastapi');
  assert.equal(result.status, 0, result.stderr);
  assert.ok(result.scope.target.frameworks.some((item) => item.name === 'FastAPI'));
  assert.ok(result.scope.target.packageManagers.some((item) => item.name === 'uv'));
  assert.deepEqual(result.scope.target.deploymentSurfaces, ['Dockerfile']);

  result = start(join(FIXTURES, 'split-stack'), 'split');
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.scope.target.layout, 'split-stack');
  assert.ok(result.scope.target.frameworks.some((item) => item.name === 'FastAPI' && item.root === 'backend'));
  assert.ok(result.scope.target.frameworks.some((item) => item.name === 'Vite' && item.root === 'frontend'));
  assert.ok(result.scope.target.packageManagers.some((item) => item.name === 'pip' && item.root === 'backend'));

  const secretProject = join(temp, 'secret-project');
  cpSync(join(FIXTURES, 'next-app'), secretProject, { recursive: true });
  writeFileSync(join(secretProject, '.env'), 'API_TOKEN=DO_NOT_PRINT_DISCOVERY_SENTINEL\n');
  const outside = join(temp, 'outside');
  mkdirSync(outside);
  writeFileSync(join(outside, 'package.json'), '{"dependencies":{"express":"5"},"secret":"DO_NOT_PRINT_DISCOVERY_SENTINEL"}');
  symlinkSync(outside, join(secretProject, 'linked-outside'));
  result = start(secretProject, 'secret', ['--origin', 'https://example.com/private?token=DO_NOT_PRINT_DISCOVERY_SENTINEL']);
  assert.equal(result.status, 0, result.stderr);
  const serialized = readFileSync(result.scopePath, 'utf8');
  assert.equal(serialized.includes('DO_NOT_PRINT_DISCOVERY_SENTINEL'), false);
  assert.equal(result.stdout.includes('DO_NOT_PRINT_DISCOVERY_SENTINEL'), false);
  assert.deepEqual(result.scope.target.publicOrigins, [{
    url: 'https://example.com/', source: 'user', status: 'user_supplied_unverified',
  }]);
  assert.equal(result.scope.authorization.status, 'pending');
  assert.equal(result.scope.checkModes.remotePassive.status, 'blocked_pending_authorization');
  assert.equal(result.scope.checkModes.remoteActive.status, 'blocked_pending_authorization');
  assert.equal(lstatSync(join(secretProject, 'linked-outside')).isSymbolicLink(), true);
  assert.equal(result.scope.target.frameworks.some((item) => item.name === 'Express'), false);

  const unsupported = join(temp, 'unsupported');
  mkdirSync(unsupported);
  writeFileSync(join(unsupported, 'README.md'), 'no manifest');
  result = start(unsupported, 'unsupported');
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.scope.target.discoveryStatus, 'unsupported');
  assert.ok(result.scope.discoveryEvidence.unknowns.some((item) => item.includes('no supported Node or Python manifest')));

  const missing = spawnSync(process.execPath, [CLI, 'start', join(temp, 'missing'), '--out', join(temp, 'missing-out')], { encoding: 'utf8' });
  assert.equal(missing.status, 2);
  assert.match(missing.stderr, /project must be an existing directory/);
  assert.equal(existsSync(join(temp, 'missing-out')), false);

  const collisionBefore = readFileSync(join(temp, 'runs', 'next', 'security-scope.yml'), 'utf8');
  result = start(join(FIXTURES, 'next-app'), 'next');
  assert.equal(result.status, 2);
  assert.match(result.stderr, /run already exists/);
  assert.equal(readFileSync(join(temp, 'runs', 'next', 'security-scope.yml'), 'utf8'), collisionBefore);

  console.log('✓ project discovery: Node, Python, split stack, no-network, secret and authorization gates');
} finally {
  rmSync(temp, { recursive: true, force: true });
}
