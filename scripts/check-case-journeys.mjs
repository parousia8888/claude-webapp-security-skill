#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const catalog = JSON.parse(readFileSync(`${ROOT}/docs/case-studies/journeys/evidence.json`, 'utf8'));
const ids = new Set();
const requiredStacks = new Set(['Node/Next.js monorepo', 'Python/Django', 'SvelteKit/Vite + Python/FastAPI split stack']);
const requiredRules = new Set([
  'dependency-lockfile-missing', 'sensitive-env-file-present', 'node-inspector-public-bind',
  'production-source-map-enabled', 'source-stack-unsupported', 'source-evidence-incomplete',
  'gitleaks-committed-secret', 'gitleaks-working-tree-secret', 'osv-known-vulnerability',
]);
const detectorInventory = [
  ['Crawl-boundary audit', 'test/crawl-evidence-v2.test.mjs', '`not_applicable`: no hosted project was contacted'],
  ['Crawler identity', 'test/verify-crawler-ip.test.mjs', '`not_applicable`: no project traffic or claimed crawler identity was in scope'],
  ['Edge verification', 'test/verify-hardening.test.mjs', '`not_applicable`: no hosted edge was authorized or contacted'],
  ['Narrow deterministic source audit', 'test/source-coverage-ledger.test.mjs', '`completed` for all five fixed commits'],
  ['AWS exposure inventory', 'test/aws-permission-evidence.test.mjs', '`not_applicable`: no third-party cloud account was in scope'],
  ['Gitleaks secret detection', 'test/real-adapters.test.mjs', '`completed` for all five'],
  ['OSV dependency detection', 'test/real-adapters.test.mjs', '`completed` for four projects'],
];

function fail(message) {
  console.error(`case journeys: ${message}`);
  process.exitCode = 1;
}

if (catalog.schemaVersion !== 2) fail('schemaVersion must be 2');
if (catalog.method?.sourceOnly !== true || catalog.method?.hostedInstancesProbed !== false
    || catalog.method?.projectDependenciesExecuted !== false
    || catalog.method?.osvPublicAdvisoryNetwork !== true || catalog.method?.starsUsedAsEvidence !== false) {
  fail('method must preserve source-only, no-dependency-execution, OSV-network, and no-star-evidence boundaries');
}
if (catalog.journeys?.length !== 5) fail('exactly five ordinary project journeys are required');
for (const journey of catalog.journeys || []) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(journey.id || '') || ids.has(journey.id)) fail(`invalid or duplicate id ${journey.id}`);
  ids.add(journey.id);
  requiredStacks.delete(journey.stack);
  if (!/^[a-f0-9]{40}$/.test(journey.commit || '')) fail(`${journey.id} commit is not immutable`);
  if (!existsSync(`${ROOT}/${journey.document}`)) fail(`${journey.id} document is missing`);
  if (!journey.falsePositiveClosures?.length || !journey.unreached?.length) fail(`${journey.id} hides closure or unreached evidence`);
  if (!journey.corpus || !/^\d{4}-\d{2}-\d{2}T00:00:00\.000Z$/.test(journey.corpus.runDate || '')
      || !/^[a-f0-9]{64}$/.test(journey.corpus.rulesetDigest || '')) fail(`${journey.id} corpus identity is invalid`);
  if (journey.corpus.adapters?.length !== 3) fail(`${journey.id} must record three adapter identities`);
  for (const adapter of journey.corpus.adapters || []) {
    if (!/^[a-z0-9-]+$/.test(adapter.id || '') || !adapter.version
        || !/^[a-f0-9]{64}$/.test(adapter.rulesetDigest || '')) fail(`${journey.id} adapter identity is invalid`);
    if (adapter.id !== 'osv' && !/^[a-f0-9]{64}$/.test(adapter.deterministicFindingIdsDigest || '')) {
      fail(`${journey.id} deterministic adapter digest is missing`);
    }
    if (adapter.id !== 'osv' && !/^[a-f0-9]{64}$/.test(adapter.deterministicFindingContentDigest || '')) {
      fail(`${journey.id} deterministic sanitized finding digest is missing`);
    }
  }
  if (Object.keys(journey.corpus.coverage || {}).some((ruleId) => !requiredRules.has(ruleId))) {
    fail(`${journey.id} records an unknown coverage rule`);
  }
  for (const ruleId of requiredRules) if (!(ruleId in (journey.corpus.coverage || {}))) fail(`${journey.id} omits coverage for ${ruleId}`);
  if ((journey.corpus.snapshot?.summary?.confirmed || 0) !== (journey.corpus.confirmedFindingIds || []).length) {
    fail(`${journey.id} confirmed snapshot is not reviewed by finding ID`);
  }
  if ((journey.corpus.snapshot?.externalStates || []).some((state) => state !== 'suspected')) {
    fail(`${journey.id} promotes external scanner leads beyond suspected`);
  }
  if (!['confirmed', 'suspected', 'unknown', 'not_applicable'].includes(journey.manualTrace?.classification)) {
    fail(`${journey.id} manual classification is invalid`);
  }
  const document = existsSync(`${ROOT}/${journey.document}`) ? readFileSync(`${ROOT}/${journey.document}`, 'utf8') : '';
  for (const marker of [journey.repository, journey.commit, journey.corpus.runDate.slice(0, 10),
    'Gitleaks `8.30.1`', 'OSV-Scanner `2.5.0`', 'No hosted instance',
    'False-positive closure', 'Unreached surfaces', 'Reproduce']) {
    if (!document.includes(marker)) fail(`${journey.id} document is missing ${marker}`);
  }
  for (const url of journey.manualTrace?.evidence || []) {
    if (!url.includes(`/blob/${journey.commit}/`)) fail(`${journey.id} has mutable source evidence: ${url}`);
    if (!document.includes(url)) fail(`${journey.id} document omits structured evidence URL`);
  }
}
if (requiredStacks.size) fail(`missing stack coverage: ${[...requiredStacks].join(', ')}`);
if (!catalog.regressionInventory || !existsSync(`${ROOT}/${catalog.regressionInventory}`)) {
  fail('regression inventory is missing');
} else {
  const inventory = readFileSync(`${ROOT}/${catalog.regressionInventory}`, 'utf8');
  for (const [detector, regression, applicability] of detectorInventory) {
    if (!inventory.includes(`| ${detector} |`) || !inventory.includes(regression)
        || !inventory.includes(applicability)) {
      fail(`regression inventory is incomplete for ${detector}`);
    }
  }
  for (const marker of ['positive', 'negative', 'unavailable', 'malformed', 'redaction',
    'No detector has a generic suppression engine in v0.4.0']) {
    if (!inventory.includes(marker)) fail(`regression inventory omits ${marker} boundary`);
  }
}
if (!process.exitCode) console.log(`case journeys ok: ${ids.size} projects, v2 adapter corpus, visible closures and unknowns`);
