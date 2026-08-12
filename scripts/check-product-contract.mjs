#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const source = JSON.parse(readFileSync(`${ROOT}/docs/capabilities.json`, 'utf8'));
const allowedLabels = new Set(['automated_regression_tested', 'agent_guided', 'planned']);
const requiredStates = ['confirmed', 'suspected', 'unknown', 'not_applicable'];
const ids = new Set();

function fail(message) {
  console.error(`product contract: ${message}`);
  process.exitCode = 1;
}

if (source.schemaVersion !== 1) fail('schemaVersion must be 1');
for (const state of requiredStates) {
  if (!source.resultStates?.[state]) fail(`missing result state ${state}`);
}
for (const capability of source.capabilities || []) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(capability.id || '')) fail(`invalid capability id ${capability.id}`);
  if (ids.has(capability.id)) fail(`duplicate capability id ${capability.id}`);
  ids.add(capability.id);
  if (!allowedLabels.has(capability.label)) fail(`${capability.id} has invalid label ${capability.label}`);
  if (!capability.name || !capability.scope || !capability.evidence?.length) fail(`${capability.id} is incomplete`);
  for (const evidence of capability.evidence || []) {
    if (!existsSync(`${ROOT}/${evidence}`)) fail(`${capability.id} evidence does not exist: ${evidence}`);
  }
}
for (const [file, markers] of Object.entries({
  'README.md': ['## Capability boundary', 'docs/capabilities.md', '`confirmed`', '`suspected`', '`unknown`', '`not_applicable`'],
  'README.zh-CN.md': ['## 能力边界', 'docs/capabilities.md', '`confirmed`', '`suspected`', '`unknown`', '`not_applicable`'],
  'SKILL.md': ['## Capability boundary', 'docs/capabilities.md', '`confirmed`', '`suspected`', '`unknown`', '`not_applicable`'],
})) {
  const text = readFileSync(`${ROOT}/${file}`, 'utf8');
  for (const marker of markers) if (!text.includes(marker)) fail(`${file} is missing ${marker}`);
}
if (!process.exitCode) console.log(`product contract ok: ${ids.size} capabilities, ${requiredStates.length} result states`);
