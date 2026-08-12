#!/usr/bin/env node
import { cpSync, existsSync, mkdirSync, mkdtempSync, renameSync, rmSync, symlinkSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const argv = process.argv.slice(2);
const command = argv.shift();

function usage(code = 0) {
  console.log(`webapp-security <command> [options]

Commands:
  demo                         Run the deterministic local before/after demo
  crawl <crawl options>        Audit a public crawl boundary
  verify-crawler <options>     Verify a crawler IP and claimed user agent
  verify-edge <options>        Verify headers, redirects, TLS, and optional rate limiting
  aws <aws audit options>      Run the read-only AWS posture inventory
  install [options]            Install for Claude Code, Codex, and/or the CLI

Install options:
  --target claude|codex|cli|both|all
                               Default: all; both means Claude Code + Codex
  --force                      Replace an existing install after making a backup
`);
  process.exit(code);
}

function run(program, args) {
  const child = spawn(program, args, { stdio: 'inherit' });
  child.on('error', (error) => { console.error(error.message); process.exit(2); });
  child.on('exit', (code, signal) => process.exit(signal ? 1 : (code ?? 1)));
}

function arg(name, fallback = null) {
  const index = argv.indexOf(`--${name}`);
  return index === -1 ? fallback : argv[index + 1];
}

function install() {
  const target = arg('target', 'all');
  const force = argv.includes('--force');
  if (!['claude', 'codex', 'cli', 'both', 'all'].includes(target)) {
    console.error('error: --target must be claude, codex, cli, both, or all');
    process.exit(2);
  }
  const roots = [];
  if (['claude', 'both', 'all'].includes(target)) roots.push(join(homedir(), '.claude', 'skills', 'webapp-security-hardening'));
  if (['codex', 'both', 'all'].includes(target)) roots.push(join(homedir(), '.codex', 'skills', 'webapp-security-hardening'));
  const installCli = ['cli', 'all'].includes(target);
  const cliRoot = join(homedir(), '.local', 'share', 'webapp-security-hardening');
  const launcher = join(homedir(), '.local', 'bin', 'webapp-security');
  if (installCli) roots.push(cliRoot);

  const conflicts = [...roots, ...(installCli ? [launcher] : [])].filter((destination) => existsSync(destination));
  if (conflicts.length && !force) {
    console.error(`error: existing install${conflicts.length === 1 ? '' : 's'}:\n${conflicts.map((item) => `  ${item}`).join('\n')}\nre-run with --force to back up and replace`);
    process.exit(2);
  }

  const include = ['SKILL.md', 'VERSION', 'LICENSE', 'agents', 'assets', 'examples', 'references', 'scripts'];
  for (const destination of roots) {
    mkdirSync(dirname(destination), { recursive: true });
    const stageRoot = mkdtempSync(join(dirname(destination), '.webapp-security-install-'));
    const staged = join(stageRoot, basename(destination));
    mkdirSync(staged);
    for (const entry of include) {
      const source = join(ROOT, entry);
      if (existsSync(source)) cpSync(source, join(staged, entry), { recursive: true });
    }
    let backup = null;
    if (existsSync(destination)) {
      backup = `${destination}.backup-${new Date().toISOString().replace(/[:.]/g, '-')}`;
      renameSync(destination, backup);
    }
    try {
      renameSync(staged, destination);
      console.log(`installed: ${destination}${backup ? `\nbackup:    ${backup}` : ''}`);
    } catch (error) {
      if (backup && !existsSync(destination)) renameSync(backup, destination);
      throw error;
    } finally {
      rmSync(stageRoot, { recursive: true, force: true });
    }
  }

  if (installCli) {
    mkdirSync(dirname(launcher), { recursive: true });
    const stagedLauncher = `${launcher}.install-${process.pid}`;
    rmSync(stagedLauncher, { force: true });
    symlinkSync(join(cliRoot, 'scripts', 'webapp-security.mjs'), stagedLauncher);
    let backup = null;
    if (existsSync(launcher)) {
      backup = `${launcher}.backup-${new Date().toISOString().replace(/[:.]/g, '-')}`;
      renameSync(launcher, backup);
    }
    try {
      renameSync(stagedLauncher, launcher);
      console.log(`installed: ${launcher}${backup ? `\nbackup:    ${backup}` : ''}`);
    } catch (error) {
      if (backup && !existsSync(launcher)) renameSync(backup, launcher);
      throw error;
    } finally {
      rmSync(stagedLauncher, { force: true });
    }
  }
}

switch (command) {
  case 'demo': run(process.execPath, [join(ROOT, 'scripts', 'demo.mjs'), ...argv]); break;
  case 'crawl': run(process.execPath, [join(ROOT, 'scripts', 'crawl-surface-audit.mjs'), ...argv]); break;
  case 'verify-crawler': run(process.execPath, [join(ROOT, 'scripts', 'verify-crawler-ip.mjs'), ...argv]); break;
  case 'verify-edge': run('/bin/bash', [join(ROOT, 'scripts', 'verify-hardening.sh'), ...argv]); break;
  case 'aws': run('/bin/bash', [join(ROOT, 'scripts', 'aws-exposure-audit.sh'), ...argv]); break;
  case 'install': install(); break;
  case '-h': case '--help': case undefined: usage(command ? 0 : 2); break;
  default: console.error(`error: unknown command ${JSON.stringify(command)}`); usage(2);
}
