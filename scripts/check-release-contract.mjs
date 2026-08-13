#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
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
const BOOTSTRAP_COMMIT = '55c3de22cb373581b9723467c0d2663917c6df84';
const BOOTSTRAP_SHA256 = 'bdb3951d6085d24c83b7590c0295702cdce8b6c15b0247747bf93b67649e78bd';
const VERIFIER_COMMIT = '11eee876cf94640f5604514c74053729b335b6c2';
const VERIFIER_SHA256 = '023ae51318b73fbfee6099e5d5249389df3f0ee2a89c840facf5aca812b4e547';
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
    'scripts/prepare-release-promotion.mjs',
    'diff -u dist/SHA256SUMS dist-rebuild/SHA256SUMS',
    'actions/attest-build-provenance@',
  ]],
  ['.github/workflows/ci.yml', [
    'fetch-depth: 0',
  ]],
  ['.github/workflows/action-v1-consumer.yml', [
    'workflow_dispatch:',
    'parousia8888/web-app-security-skill@v1',
    'acknowledge-authorization: "true"',
    'acknowledge-authorization: "false"',
  ]],
  ['README.md', [
    `parousia8888/web-app-security-skill@${RELEASE_ACTION_COMMIT}`,
    BOOTSTRAP_COMMIT, BOOTSTRAP_SHA256,
    'webapp-security version', 'bootstrap-install.sh --mode upgrade', 'webapp-security uninstall',
  ]],
  ['README.zh-CN.md', [
    `parousia8888/web-app-security-skill@${RELEASE_ACTION_COMMIT}`,
    BOOTSTRAP_COMMIT, BOOTSTRAP_SHA256,
    'webapp-security version', 'bootstrap-install.sh --mode upgrade', 'webapp-security uninstall',
  ]],
  ['scripts/bootstrap-install.sh', [
    VERIFIER_COMMIT, VERIFIER_SHA256,
  ]],
  ['docs/verified-installation.md', [BOOTSTRAP_COMMIT, BOOTSTRAP_SHA256, '--from-dir']],
  ['docs/verified-installation.zh-CN.md', [BOOTSTRAP_COMMIT, BOOTSTRAP_SHA256, '--from-dir']],
  ['.github/release-signers', ['syx627511687@gmail.com ssh-ed25519 ']],
  ['docs/releases/v0.3.0.md', ['gpg.ssh.allowedSignersFile=.github/release-signers verify-tag v0.3.0']],
]) for (const marker of markers) requireText(path, marker);

if (read('.github/workflows/release.yml').includes('- "v*"')) {
  console.error('release contract: moving major tags must not trigger a versioned release');
  failed = true;
}
for (const readme of ['README.md', 'README.zh-CN.md']) {
  const install = read(readme).split(/^## /m).find((section) => /^(?:Install|安装)\n/.test(section)) || '';
  if (/git clone[^\n]+(?:\.git)?(?:\s|\\\n)+/i.test(install)) {
    console.error(`release contract: ${readme} install section uses a moving clone`);
    failed = true;
  }
}
const verifier = spawnSync('git', ['show', `${VERIFIER_COMMIT}:scripts/install-verified.mjs`], {
  cwd: ROOT,
  encoding: null,
  maxBuffer: 4 * 1024 * 1024,
});
if (verifier.status !== 0) {
  console.error(`release contract: verifier commit cannot be resolved: ${VERIFIER_COMMIT}`);
  failed = true;
} else if (createHash('sha256').update(verifier.stdout).digest('hex') !== VERIFIER_SHA256) {
  console.error('release contract: verifier commit and SHA-256 trust anchor disagree');
  failed = true;
}
if (failed) process.exit(1);
console.log(`release contract ok: ${workflows.length} workflows pinned/gated, lifecycle documented`);
