#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const plan = readFileSync(`${ROOT}/docs/ADOPTION_ENGINEERING_PLAN.md`, 'utf8');
const normalizedPlan = plan.replace(/\s+/g, ' ').trim();
let failed = false;

function requireText(label, value) {
  if (!normalizedPlan.includes(value.replace(/\s+/g, ' ').trim())) {
    console.error(`adoption contract: missing ${label}: ${JSON.stringify(value)}`);
    failed = true;
  }
}

for (const phase of ['G0', 'G1', 'G2', 'G3', 'G4', 'G5']) {
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
if (completionRecords !== 6) {
  console.error(`adoption contract: expected 6 completion records, found ${completionRecords}`);
  failed = true;
}

if (/(?:stars?|forks?)\s*(?:>=|>|=)\s*\d+|(?:stars?|forks?)\s+target\s*:\s*\d+/i.test(plan)) {
  console.error('adoption contract: star/fork targets cannot be phase acceptance criteria');
  failed = true;
}

if (failed) process.exit(1);
console.log('adoption contract ok: G0-G5, external boundary, safety rules, no star gate');
