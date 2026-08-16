#!/usr/bin/env node
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = (path) => JSON.parse(readFileSync(join(ROOT, path), 'utf8'));
const listings = read('docs/adoption/listings.json');
const schedule = read('docs/adoption/publication-schedule.json');
const schema = read('docs/adoption/observation.schema.json');
const baseline = read('docs/adoption/observations/pre-publication.json');

assert.equal(listings.schemaVersion, 1);
assert.match(listings.projectFacts.firstDefaultBranchCommit, /^[a-f0-9]{40}$/);
assert.equal(listings.projectFacts.hasMcpServer, false);
assert.deepEqual(listings.candidates.map((item) => item.id), [
  'awesome-claude-code', 'awesome-agent-skills', 'awesome-devsecops',
  'static-analysis', 'mcp-registry',
]);
for (const item of listings.candidates.filter((candidate) => candidate.repository)) {
  assert.match(item.policyCommit, /^[a-f0-9]{40}$/);
  assert.ok(item.policyPaths.length > 0);
}
const byId = Object.fromEntries(listings.candidates.map((item) => [item.id, item]));
assert.equal(byId['awesome-claude-code'].status, 'ineligible');
assert.deepEqual(byId['awesome-claude-code'].unmetRules, ['at_least_14_days_old_or_100_stars']);
assert.equal(byId['awesome-agent-skills'].status, 'ineligible');
assert.equal(byId['awesome-devsecops'].status, 'eligible_on_documented_scope');
assert.deepEqual(byId['static-analysis'].unmetRules,
  ['more_than_one_contributor', 'more_than_20_stars', 'at_least_three_months_old']);
assert.equal(byId['mcp-registry'].status, 'out_of_scope');
assert.deepEqual(byId['mcp-registry'].unmetRules, ['no_mcp_server_implemented']);
assert.equal(listings.externalState, 'external_validation_pending');

assert.equal(schedule.ownerApprovalRequiredPerAction, true);
assert.equal(schedule.automatedPostingAllowed, false);
assert.equal(schedule.minimumGapHours, 48);
assert.equal(schedule.maximumPlannedGapHours, 72);
assert.deepEqual(schedule.plannedOrder.map((item) => item.channel), ['show_hn', 'v2ex', 'zenn']);
for (const [index, item] of schedule.plannedOrder.entries()) {
  assert.equal(item.sequence, index + 1);
  assert.equal(item.state, 'external_validation_pending');
  assert.equal(item.publishedAt, null);
  assert.equal(item.liveUrl, null);
  assert.equal(existsSync(join(ROOT, item.sourceDraft)), true, `${item.sourceDraft} is missing`);
}
assert.deepEqual(schedule.observationWindows.map((item) => item.offsetHours), [0, 24, 72, 168]);
assert.match(schedule.interpretation, /Do not claim.*caused/i);

assert.deepEqual(schema.properties.window.enum, ['pre_publication', 'h24', 'h72', 'd7']);
assert.equal(schema.properties.causalAttribution.const, false);
assert.equal(baseline.window, 'pre_publication');
assert.equal(baseline.channelContext.state, 'before_publication');
assert.equal(baseline.channelContext.liveUrl, null);
assert.equal(baseline.causalAttribution, false);
assert.equal(baseline.metrics.github.trafficWindowDays, 14);
assert.equal(baseline.metrics.github.stars, listings.projectFacts.stars);
for (const field of ['npmWeeklyDownloads', 'actionMarketplaceInstalls', 'independentReferences']) {
  assert.equal(baseline.metrics[field], null);
}
assert.equal(baseline.missingData.length, 3);
assert.match(baseline.limitations.join(' '), /author, CI, automation and crawler activity/);

console.log('adoption discovery ok: pinned eligibility, owner-gated schedule and non-causal baseline');
