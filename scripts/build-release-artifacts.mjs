#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const args = process.argv.slice(2);

function usage(code, message) {
  if (message) console.error(`error: ${message}`);
  console.log('node scripts/build-release-artifacts.mjs --ref <git-ref> --out <empty-directory>');
  process.exit(code);
}

function take(name, fallback = null) {
  const index = args.indexOf(name);
  if (index === -1) return fallback;
  if (!args[index + 1] || args[index + 1].startsWith('--')) usage(2, `${name} requires a value`);
  return args.splice(index, 2)[1];
}

function run(program, commandArgs, options = {}) {
  const result = spawnSync(program, commandArgs, { cwd: ROOT, encoding: null, ...options });
  if (result.status !== 0) {
    throw new Error(result.stderr?.toString().trim() || `${program} ${commandArgs.join(' ')} failed`);
  }
  return result.stdout;
}

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

if (args.includes('-h') || args.includes('--help')) usage(0);
const ref = take('--ref');
const out = resolve(take('--out') || 'dist');
if (!ref || args.length) usage(2, '--ref and --out are required');

try {
  if (existsSync(out) && readdirSync(out).length) throw new Error(`output directory must be empty: ${out}`);
  mkdirSync(out, { recursive: true, mode: 0o700 });
  const commit = run('git', ['rev-parse', `${ref}^{commit}`]).toString().trim();
  const version = run('git', ['show', `${commit}:VERSION`]).toString().trim();
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
    throw new Error(`VERSION at ${commit} is not semantic: ${JSON.stringify(version)}`);
  }
  const expectedTag = `v${version}`;
  if (ref.startsWith('v') && ref !== expectedTag) throw new Error(`${ref} does not match VERSION ${version}`);
  const epoch = run('git', ['show', '-s', '--format=%ct', commit]).toString().trim();
  const prefix = `web-app-security-skill-${version}`;
  const archiveName = `${prefix}.tar.gz`;
  const sbomName = `${prefix}.spdx.json`;
  const manifestName = `${prefix}.release.json`;
  const archivePath = join(out, archiveName);
  const tar = run('git', ['archive', '--format=tar', `--prefix=${prefix}/`, commit]);
  const archive = run('gzip', ['-n', '-9'], { input: tar });
  writeFileSync(archivePath, archive, { mode: 0o600 });

  const sbomPath = join(out, sbomName);
  run(process.execPath, [
    join(ROOT, 'scripts', 'generate-sbom.mjs'), '--out', sbomPath, '--version', version,
  ], {
    env: { ...process.env, SOURCE_DATE_EPOCH: epoch },
  });
  const initialAssets = [archiveName, sbomName];
  const manifest = {
    schemaVersion: 1,
    product: 'Web App Security Skill',
    repository: 'parousia8888/web-app-security-skill',
    version,
    tag: expectedTag,
    sourceRef: ref,
    sourceCommit: commit,
    sourceDateEpoch: Number(epoch),
    assets: Object.fromEntries(initialAssets.map((name) => [name, { sha256: sha256(join(out, name)) }])),
  };
  writeFileSync(join(out, manifestName), `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
  const checksumAssets = [...initialAssets, manifestName].sort();
  const checksums = checksumAssets.map((name) => `${sha256(join(out, name))}  ${name}`).join('\n');
  writeFileSync(join(out, 'SHA256SUMS'), `${checksums}\n`, { mode: 0o600 });
  console.log(`release artifacts: ${out}`);
  console.log(`version:           ${version}`);
  console.log(`commit:            ${commit}`);
  for (const name of [...checksumAssets, 'SHA256SUMS']) console.log(`asset:             ${basename(name)}`);
} catch (error) {
  usage(2, error.message);
}
