#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PRODUCT = 'Web App Security Skill';
const REPOSITORY = 'parousia8888/web-app-security-skill';
const SKILL_ID = 'web-app-security';
const PACKAGE = 'web-app-security-skill';

function read(path) {
  return readFileSync(`${ROOT}/${path}`, 'utf8');
}

function requireText(path, expected) {
  if (!read(path).includes(expected)) {
    console.error(`identity: ${path} is missing ${JSON.stringify(expected)}`);
    process.exitCode = 1;
  }
}

const pkg = JSON.parse(read('package.json'));
if (pkg.name !== PACKAGE) {
  console.error(`identity: package.json name must be ${PACKAGE}`);
  process.exitCode = 1;
}

for (const [path, expected] of [
  ['README.md', `<h1 align="center">${PRODUCT}</h1>`],
  ['README.md', `github.com/${REPOSITORY}`],
  ['README.zh-CN.md', `<h1 align="center">${PRODUCT}</h1>`],
  ['README.zh-CN.md', `github.com/${REPOSITORY}`],
  ['README_AI.md', `Use $${SKILL_ID}`],
  ['SKILL.md', `name: ${SKILL_ID}`],
  ['agents/openai.yaml', `display_name: "${PRODUCT}"`],
  ['agents/openai.yaml', `$${SKILL_ID}`],
  ['action.yml', `name: "${PRODUCT}"`],
  ['SECURITY.md', REPOSITORY],
  ['scripts/generate-sbom.mjs', REPOSITORY],
]) requireText(path, expected);

const legacy = 'webapp-security-hardening';
const allowedLegacyFiles = new Set([
  'CHANGELOG.md',
  'docs/PRODUCTIZATION_PLAN.md',
  'docs/releases/v0.3.0.md',
  'scripts/webapp-security.mjs',
  'test/product-surfaces.test.mjs',
]);
for (const path of [
  'README.md', 'README.zh-CN.md', 'README_AI.md', 'SKILL.md', 'agents/openai.yaml',
  'action.yml', 'SECURITY.md', 'CHANGELOG.md', 'ROADMAP.md', 'llms.txt', 'package.json',
  'docs/releases/v0.3.0.md',
  'scripts/generate-sbom.mjs', '.github/workflows/release.yml',
]) {
  if (!allowedLegacyFiles.has(path) && read(path).includes(legacy)) {
    console.error(`identity: legacy name remains in public/current surface ${path}`);
    process.exitCode = 1;
  }
}

if (!process.exitCode) console.log(`identity ok: ${PRODUCT} / ${REPOSITORY} / ${SKILL_ID}`);
