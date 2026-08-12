#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = (path) => readFileSync(`${ROOT}/${path}`, 'utf8');
const workflows = [
  '.github/workflows/ci.yml',
  '.github/workflows/codeql.yml',
  '.github/workflows/release.yml',
  '.github/workflows/action-v1-consumer.yml',
];
const RELEASE_ACTION_COMMIT = 'd7df9fa6efd466c3eb13768c3b9ad259d2636e04';
let failed = false;

function requireText(path, marker) {
  if (!read(path).includes(marker)) {
    console.error(`release contract: ${path} is missing ${JSON.stringify(marker)}`);
    failed = true;
  }
}

for (const path of workflows) {
  for (const match of read(path).matchAll(/^\s*-?\s*uses:\s*["']?([^\s"']+)/gm)) {
    const action = match[1];
    if (action === 'parousia8888/web-app-security-skill@v1'
        && path === '.github/workflows/action-v1-consumer.yml') continue;
    if (!/@[a-f0-9]{40}$/.test(action)) {
      console.error(`release contract: ${path} has a non-immutable third-party Action: ${action}`);
      failed = true;
    }
  }
}

for (const [path, markers] of [
  ['.github/workflows/release.yml', [
    'v[0-9]*.[0-9]*.[0-9]*',
    'scripts/build-release-artifacts.mjs',
    'scripts/verify-release-artifacts.mjs',
    'scripts/test-release-artifact.mjs',
    'diff -u dist/SHA256SUMS dist-rebuild/SHA256SUMS',
    'actions/attest-build-provenance@',
  ]],
  ['.github/workflows/action-v1-consumer.yml', [
    'workflow_dispatch:',
    'parousia8888/web-app-security-skill@v1',
    'acknowledge-authorization: "true"',
    'acknowledge-authorization: "false"',
  ]],
  ['README.md', [
    `parousia8888/web-app-security-skill@${RELEASE_ACTION_COMMIT}`,
    'webapp-security version', 'scripts/webapp-security.mjs upgrade', 'webapp-security uninstall',
  ]],
  ['README.zh-CN.md', [
    `parousia8888/web-app-security-skill@${RELEASE_ACTION_COMMIT}`,
    'webapp-security version', 'scripts/webapp-security.mjs upgrade', 'webapp-security uninstall',
  ]],
  ['.github/release-signers', ['syx627511687@gmail.com ssh-ed25519 ']],
  ['docs/releases/v0.3.0.md', ['gpg.ssh.allowedSignersFile=.github/release-signers verify-tag v0.3.0']],
]) for (const marker of markers) requireText(path, marker);

if (read('.github/workflows/release.yml').includes('- "v*"')) {
  console.error('release contract: moving major tags must not trigger a versioned release');
  failed = true;
}
if (failed) process.exit(1);
console.log(`release contract ok: ${workflows.length} workflows pinned/gated, lifecycle documented`);
