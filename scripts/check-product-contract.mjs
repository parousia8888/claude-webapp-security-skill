#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const args = process.argv.slice(2);
const sourceIndex = args.indexOf('--source');
const sourcePath = sourceIndex === -1 ? `${ROOT}/docs/capabilities.json` : resolve(args[sourceIndex + 1] || '');
if (sourceIndex !== -1) args.splice(sourceIndex, 2);
if (args.length) {
  console.error('usage: node scripts/check-product-contract.mjs [--source <capabilities.json>]');
  process.exit(2);
}

const source = JSON.parse(readFileSync(sourcePath, 'utf8'));
const allowedCategories = new Set(['detection', 'evidence_reporting', 'lifecycle_distribution', 'agent_guided_methodology']);
const allowedMaturities = new Set(['stable', 'experimental', 'agent_guided', 'planned']);
const requiredStates = ['confirmed', 'suspected', 'unknown', 'not_applicable'];
const nonDetection = new Set(['local-before-after-demo', 'project-discovery', 'structured-reports', 'patch-retest-loop', 'distribution-surfaces']);
const ids = new Set();

function fail(message) {
  console.error(`product contract: ${message}`);
  process.exitCode = 1;
}

if (source.schemaVersion !== 2) fail('schemaVersion must be 2');
for (const category of allowedCategories) if (!source.categories?.[category]) fail(`missing category ${category}`);
for (const maturity of allowedMaturities) if (!source.maturities?.[maturity]) fail(`missing maturity ${maturity}`);
for (const state of requiredStates) if (!source.resultStates?.[state]) fail(`missing result state ${state}`);

for (const capability of source.capabilities || []) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(capability.id || '')) fail(`invalid capability id ${capability.id}`);
  if (ids.has(capability.id)) fail(`duplicate capability id ${capability.id}`);
  ids.add(capability.id);
  if (!allowedCategories.has(capability.category)) fail(`${capability.id} has invalid category ${capability.category}`);
  if (!allowedMaturities.has(capability.maturity)) fail(`${capability.id} has invalid maturity ${capability.maturity}`);
  if (capability.category === 'agent_guided_methodology' && capability.maturity !== 'agent_guided') {
    fail(`${capability.id} agent-guided methodology must have agent_guided maturity`);
  }
  if (capability.maturity === 'agent_guided' && capability.category !== 'agent_guided_methodology') {
    fail(`${capability.id} agent_guided maturity must use the agent-guided category`);
  }
  if (nonDetection.has(capability.id) && capability.category === 'detection') {
    fail(`${capability.id} is infrastructure, demo, or distribution and cannot count as detection`);
  }
  if (!capability.name || !capability.scope || !Array.isArray(capability.evidence)) fail(`${capability.id} is incomplete`);
  if (/fixture|simulat/i.test(capability.scope) && capability.id === 'aws-exposure-inventory') {
    fail('AWS detection claim must describe the real read-only collector, not a fixture');
  }
  if (capability.maturity === 'planned') {
    if (!/^\d+\.\d+\.\d+$/.test(capability.plannedFor || '')) fail(`${capability.id} planned maturity requires plannedFor`);
    if (capability.evidence.length) fail(`${capability.id} planned maturity cannot claim implementation evidence`);
  } else if (!capability.evidence.length) {
    fail(`${capability.id} ${capability.maturity} maturity requires evidence`);
  }
  if (['stable', 'experimental'].includes(capability.maturity)
      && (!(capability.evidence || []).some((path) => path.startsWith('test/'))
        || !(capability.evidence || []).some((path) => path.startsWith('scripts/') || path === 'action.yml'))) {
    fail(`${capability.id} ${capability.maturity} maturity requires implementation and test evidence`);
  }
  for (const evidence of capability.evidence || []) {
    if (!existsSync(`${ROOT}/${evidence}`)) fail(`${capability.id} evidence does not exist: ${evidence}`);
  }
}

for (const category of allowedCategories) {
  if (!(source.capabilities || []).some((item) => item.category === category)) fail(`category ${category} is empty`);
}
for (const maturity of ['stable', 'agent_guided', 'planned']) {
  if (!(source.capabilities || []).some((item) => item.maturity === maturity)) fail(`maturity ${maturity} is empty`);
}
for (const [file, markers] of Object.entries({
  'README.md': ['## Capability boundary', 'docs/capabilities.md', '`confirmed`', '`suspected`', '`unknown`', '`not_applicable`'],
  'README.zh-CN.md': ['## 能力边界', 'docs/capabilities.md', '`confirmed`', '`suspected`', '`unknown`', '`not_applicable`'],
  'SKILL.md': ['## Capability boundary', 'docs/capabilities.md', '`confirmed`', '`suspected`', '`unknown`', '`not_applicable`'],
})) {
  const document = readFileSync(`${ROOT}/${file}`, 'utf8');
  for (const marker of markers) if (!document.includes(marker)) fail(`${file} is missing ${marker}`);
}
if (!process.exitCode) {
  const stableDetection = source.capabilities.filter((item) => item.category === 'detection' && item.maturity === 'stable').length;
  const plannedDetection = source.capabilities.filter((item) => item.category === 'detection' && item.maturity === 'planned').length;
  console.log(`product contract ok: ${ids.size} capabilities, ${stableDetection} stable detection, ${plannedDetection} planned detection, ${requiredStates.length} result states`);
}
