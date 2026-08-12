#!/usr/bin/env node
import assert from 'node:assert/strict';
import {
  existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, posix, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
const archiveIndex = args.indexOf('--archive');
if (archiveIndex === -1 || !args[archiveIndex + 1] || args.length !== 2) {
  console.error('usage: node scripts/test-release-artifact.mjs --archive <tar.gz>');
  process.exit(2);
}
const archive = resolve(args[archiveIndex + 1]);
const temp = mkdtempSync(join(tmpdir(), 'web-app-security-release-'));
const extract = join(temp, 'extract');
const home = join(temp, 'home');

function run(program, commandArgs, options = {}) {
  const result = spawnSync(program, commandArgs, { encoding: 'utf8', ...options });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result;
}

try {
  assert.ok(existsSync(archive), archive);
  mkdirSync(extract);
  mkdirSync(home);
  const listing = run('tar', ['-tzf', archive]);
  const entries = listing.stdout.trim().split('\n');
  assert.ok(entries.length > 1, 'release archive is empty');
  const topLevels = new Set(entries.map((entry) => entry.split('/')[0]));
  assert.equal(topLevels.size, 1, 'release archive must have one top-level directory');
  for (const entry of entries) {
    assert.equal(posix.isAbsolute(entry), false, `archive contains absolute path: ${entry}`);
    assert.equal(entry.split('/').includes('..'), false, `archive contains parent traversal: ${entry}`);
  }
  run('tar', ['-xzf', archive, '-C', extract]);
  const roots = readdirSync(extract);
  assert.equal(roots.length, 1, 'release archive must have one top-level directory');
  const root = join(extract, roots[0]);
  const cli = join(root, 'scripts', 'webapp-security.mjs');
  const version = readFileSync(join(root, 'VERSION'), 'utf8').trim();
  const env = {
    ...process.env,
    HOME: home,
    NODE_OPTIONS: `--require=${join(root, 'test', 'helpers', 'deny-network.cjs')}`,
    SOURCE_DATE_EPOCH: '0',
  };

  let result = run(process.execPath, [cli, 'install'], { cwd: root, env });
  assert.match(result.stdout, /installed:/);
  const launcher = join(home, '.local', 'bin', 'webapp-security');
  result = run(launcher, ['version'], { cwd: root, env });
  assert.equal(result.stdout.trim(), `Web App Security Skill ${version}`);
  const startOut = join(temp, 'scope');
  result = run(launcher, [
    'start', join(root, 'test', 'fixtures', 'next-app'), '--out', startOut, '--run-id', 'release-artifact',
  ], { cwd: root, env });
  assert.match(result.stdout, /network:\s+none/);
  assert.ok(existsSync(join(startOut, 'release-artifact', 'security-scope.yml')));

  result = run(launcher, ['upgrade'], { cwd: root, env });
  assert.match(result.stdout, /upgraded:/);
  const backupRoots = [
    join(home, '.claude', 'skills'), join(home, '.codex', 'skills'), join(home, '.local', 'share'),
  ];
  const backups = backupRoots.flatMap((directory) =>
    readdirSync(directory).filter((name) => name.includes('.backup-')));
  assert.ok(backups.length >= 3, 'upgrade must retain prior payload backups');
  result = run(launcher, ['uninstall'], { cwd: root, env });
  assert.match(result.stdout, /uninstalled:/);
  assert.equal(existsSync(join(home, '.claude', 'skills', 'web-app-security')), false);
  assert.equal(existsSync(join(home, '.codex', 'skills', 'web-app-security')), false);
  assert.equal(existsSync(join(home, '.local', 'share', 'web-app-security')), false);
  assert.equal(existsSync(launcher), false);
  assert.ok(backups.length >= 3, 'uninstall must not remove upgrade backups');
  console.log(`release artifact lifecycle ok: ${basename(archive)} (${version})`);
} finally {
  rmSync(temp, { recursive: true, force: true });
}
