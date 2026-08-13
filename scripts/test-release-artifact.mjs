#!/usr/bin/env node
import assert from 'node:assert/strict';
import {
  cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, posix, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
const archiveIndex = args.indexOf('--archive');
const previousIndex = args.indexOf('--previous-archive');
const expectedArgs = previousIndex === -1 ? 2 : 4;
if (archiveIndex === -1 || !args[archiveIndex + 1]
    || (previousIndex !== -1 && !args[previousIndex + 1]) || args.length !== expectedArgs) {
  console.error('usage: node scripts/test-release-artifact.mjs --archive <tar.gz> [--previous-archive <tar.gz>]');
  process.exit(2);
}
const archive = resolve(args[archiveIndex + 1]);
const previousArchive = previousIndex === -1 ? null : resolve(args[previousIndex + 1]);
const temp = mkdtempSync(join(tmpdir(), 'web-app-security-release-'));
const extract = join(temp, 'extract');
const home = join(temp, 'home');

function run(program, commandArgs, options = {}) {
  const result = spawnSync(program, commandArgs, { encoding: 'utf8', ...options });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result;
}

function extractArchive(path, destination) {
  assert.ok(existsSync(path), path);
  mkdirSync(destination);
  const listing = run('tar', ['-tzf', path]);
  const entries = listing.stdout.trim().split('\n');
  assert.ok(entries.length > 1, 'release archive is empty');
  const topLevels = new Set(entries.map((entry) => entry.split('/')[0]));
  assert.equal(topLevels.size, 1, 'release archive must have one top-level directory');
  for (const entry of entries) {
    assert.equal(posix.isAbsolute(entry), false, `archive contains absolute path: ${entry}`);
    assert.equal(entry.split('/').includes('..'), false, `archive contains parent traversal: ${entry}`);
  }
  run('tar', ['-xzf', path, '-C', destination]);
  const roots = readdirSync(destination);
  assert.equal(roots.length, 1, 'release archive must have one top-level directory');
  return join(destination, roots[0]);
}

try {
  mkdirSync(home);
  const root = extractArchive(archive, extract);
  const cli = join(root, 'scripts', 'webapp-security.mjs');
  const version = readFileSync(join(root, 'VERSION'), 'utf8').trim();
  const env = {
    ...process.env,
    HOME: home,
    NODE_OPTIONS: `--require=${join(root, 'test', 'helpers', 'deny-network.cjs')}`,
    SOURCE_DATE_EPOCH: '0',
  };

  const launcher = join(home, '.local', 'bin', 'webapp-security');
  let result;
  if (previousArchive) {
    const previousRoot = extractArchive(previousArchive, join(temp, 'previous'));
    const previousCli = join(previousRoot, 'scripts', 'webapp-security.mjs');
    const previousVersion = readFileSync(join(previousRoot, 'VERSION'), 'utf8').trim();
    result = run(process.execPath, [previousCli, 'install'], { cwd: previousRoot, env });
    assert.match(result.stdout, /installed:/);
    result = run(launcher, ['version'], { cwd: previousRoot, env });
    assert.equal(result.stdout.trim(), `Web App Security Skill ${previousVersion}`);
    result = run(process.execPath, [cli, 'upgrade'], { cwd: root, env });
    assert.match(result.stdout, /upgraded:/);
  } else {
    result = run(process.execPath, [cli, 'install'], { cwd: root, env });
    assert.match(result.stdout, /installed:/);
  }
  result = run(launcher, ['version'], { cwd: root, env });
  assert.equal(result.stdout.trim(), `Web App Security Skill ${version}`);
  const startOut = join(temp, 'scope');
  const project = join(temp, 'project');
  cpSync(join(root, 'test', 'fixtures', 'next-app'), project, { recursive: true });
  result = run(launcher, [
    'start', project, '--out', startOut, '--run-id', 'release-artifact',
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
  console.log(`release artifact lifecycle ok: ${basename(archive)} (${version})${previousArchive ? ' with prior-version upgrade' : ''}`);
} finally {
  rmSync(temp, { recursive: true, force: true });
}
