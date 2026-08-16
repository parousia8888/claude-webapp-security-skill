#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const plan = readFileSync(`${ROOT}/docs/ADOPTION_ENGINEERING_PLAN.md`, 'utf8');
const publicContract = JSON.parse(readFileSync(`${ROOT}/docs/public-contract.json`, 'utf8'));
const releaseState = JSON.parse(readFileSync(`${ROOT}/docs/release-state.json`, 'utf8'));
const sessionSchema = JSON.parse(readFileSync(`${ROOT}/docs/usability/session.schema.json`, 'utf8'));
const tutorial = readFileSync(`${ROOT}/docs/tutorial.md`, 'utf8');
const tutorialZh = readFileSync(`${ROOT}/docs/tutorial.zh-CN.md`, 'utf8');
const normalizedPlan = plan.replace(/\s+/g, ' ').trim();
let failed = false;

function requireText(label, value) {
  if (!normalizedPlan.includes(value.replace(/\s+/g, ' ').trim())) {
    console.error(`adoption contract: missing ${label}: ${JSON.stringify(value)}`);
    failed = true;
  }
}

for (const phase of ['G0', 'G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7', 'G8', 'G9', 'G10', 'G11']) {
  requireText(`${phase} heading`, `## ${phase} -`);
  const ledger = new RegExp(`\\| ${phase} \\|[^\\n]+\\| (?:in progress|pending|completed) \\|`);
  if (!ledger.test(plan)) {
    console.error(`adoption contract: ${phase} is missing from the phase ledger`);
    failed = true;
  }
}

for (const marker of [
  'Star count is an observed downstream metric, not an engineering acceptance criterion',
  'external_validation_pending',
  'Do not make unverified `curl | sh` the recommended installation path',
  'owned local fixture',
  'confirmed/suspected/unknown/not-applicable',
  'Do not tag or publish until',
  'must never be invented to close the program',
]) requireText('program rule', marker);

const completionRecords = plan.match(/### Completion record/g)?.length ?? 0;
if (completionRecords !== 12) {
  console.error(`adoption contract: expected 12 completion records, found ${completionRecords}`);
  failed = true;
}

const publishedVersion = releaseState.publishedRelease.version;
if (publicContract.currentSourceRelease.version !== publishedVersion
    || publicContract.currentSourceRelease.status !== 'published') {
  console.error('adoption contract: public source release must match the published release state');
  failed = true;
}
for (const [label, value] of [['English tutorial', tutorial], ['Chinese tutorial', tutorialZh]]) {
  if (!value.includes(`v${publishedVersion}`) || value.includes('v0.5.0 candidate')) {
    console.error(`adoption contract: ${label} does not describe the published v${publishedVersion} path`);
    failed = true;
  }
}
const supportedNodeMajors = sessionSchema.properties.environment.properties.nodeMajor.enum;
if (JSON.stringify(supportedNodeMajors) !== JSON.stringify([22, 24])) {
  console.error('adoption contract: usability schema must match the supported Node 22/24 matrix');
  failed = true;
}

if (/(?:stars?|forks?)\s*(?:>=|>|=)\s*\d+|(?:stars?|forks?)\s+target\s*:\s*\d+/i.test(plan)) {
  console.error('adoption contract: star/fork targets cannot be phase acceptance criteria');
  failed = true;
}

if (failed) process.exit(1);
console.log('adoption contract ok: G0-G11, published facts, external boundary, safety rules, no star gate');
