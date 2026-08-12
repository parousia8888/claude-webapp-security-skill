#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const catalog = JSON.parse(readFileSync(`${ROOT}/docs/case-studies/journeys/evidence.json`, 'utf8'));
const ids = new Set();
const requiredStacks = new Set(['Node/Next.js monorepo', 'Python/Django', 'SvelteKit/Vite + Python/FastAPI split stack']);

function fail(message) {
  console.error(`case journeys: ${message}`);
  process.exitCode = 1;
}

if (catalog.schemaVersion !== 1) fail('schemaVersion must be 1');
if (catalog.method?.sourceOnly !== true || catalog.method?.hostedInstancesProbed !== false
    || catalog.method?.networkDeniedDuringAudit !== true || catalog.method?.starsUsedAsEvidence !== false) {
  fail('method must preserve source-only, deny-network, and no-star-evidence boundaries');
}
if (catalog.journeys?.length !== 3) fail('exactly three ordinary project journeys are required');
for (const journey of catalog.journeys || []) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(journey.id || '') || ids.has(journey.id)) fail(`invalid or duplicate id ${journey.id}`);
  ids.add(journey.id);
  requiredStacks.delete(journey.stack);
  if (!/^[a-f0-9]{40}$/.test(journey.commit || '')) fail(`${journey.id} commit is not immutable`);
  if (!existsSync(`${ROOT}/${journey.document}`)) fail(`${journey.id} document is missing`);
  if (!journey.falsePositiveClosures?.length || !journey.unreached?.length) fail(`${journey.id} hides closure or unreached evidence`);
  if (!['confirmed', 'suspected', 'unknown', 'not_applicable'].includes(journey.manualTrace?.classification)) {
    fail(`${journey.id} manual classification is invalid`);
  }
  const document = existsSync(`${ROOT}/${journey.document}`) ? readFileSync(`${ROOT}/${journey.document}`, 'utf8') : '';
  for (const marker of [journey.repository, journey.commit, 'No hosted instance', 'False-positive closure', 'Unreached surfaces', 'Reproduce']) {
    if (!document.includes(marker)) fail(`${journey.id} document is missing ${marker}`);
  }
  for (const url of journey.manualTrace?.evidence || []) {
    if (!url.includes(`/blob/${journey.commit}/`)) fail(`${journey.id} has mutable source evidence: ${url}`);
    if (!document.includes(url)) fail(`${journey.id} document omits structured evidence URL`);
  }
  for (const rule of journey.deterministicAudit?.rules || []) {
    if (!['confirmed', 'suspected', 'unknown', 'not_applicable'].includes(rule.state)) fail(`${journey.id} rule state is invalid`);
  }
}
if (requiredStacks.size) fail(`missing stack coverage: ${[...requiredStacks].join(', ')}`);
if (!process.exitCode) console.log(`case journeys ok: ${ids.size} projects, fixed commits, visible closures and unknowns`);
