import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { stableSourceRuleManifest } from './source-rule-registry.mjs';

const BUILTIN_TESTS = {
  js: 'test/js-ts-source-audit.test.mjs',
  python: 'test/python-source-audit.test.mjs',
  source: 'test/evidence-loop.test.mjs',
  integrity: 'test/source-coverage-ledger.test.mjs',
};

function testEntry(rule) {
  if (rule.adapter.type === 'external') return 'test/real-adapters.test.mjs';
  if (rule.id.startsWith('python-')) return BUILTIN_TESTS.python;
  if (rule.detection.type === 'bounded_js_ts_tokens') return BUILTIN_TESTS.js;
  if (rule.kind === 'evidence_integrity') return BUILTIN_TESTS.integrity;
  return BUILTIN_TESTS.source;
}

export function stableRuleCorpus(manifest = stableSourceRuleManifest()) {
  return {
    schemaVersion: 1,
    rulesetSemanticDigest: manifest.semanticDigest,
    counts: structuredClone(manifest.counts),
    rules: manifest.rules.map((rule) => ({
      adapterId: rule.adapter.id,
      adapterVersion: rule.adapter.version,
      adapterType: rule.adapter.type,
      ruleId: rule.id,
      kind: rule.kind,
      family: rule.family,
      expectedPositiveState: rule.defaultState,
      evidenceBoundary: rule.confidenceBoundary,
      positiveFixtures: structuredClone(rule.fixtures.positive),
      negativeFixtures: structuredClone(rule.fixtures.negative),
      testEntry: testEntry(rule),
    })),
  };
}

export function validateStableRuleCorpus(corpus, manifest = stableSourceRuleManifest(), { root = null } = {}) {
  const errors = [];
  if (corpus?.schemaVersion !== 1) errors.push('corpus.schemaVersion must be 1');
  if (corpus?.rulesetSemanticDigest !== manifest.semanticDigest) errors.push('corpus ruleset digest is stale');
  if (JSON.stringify(corpus?.counts) !== JSON.stringify(manifest.counts)) errors.push('corpus counts differ from the stable manifest');
  const expected = new Map(manifest.rules.map((rule) => [rule.id, rule]));
  const observed = new Set();
  for (const item of corpus?.rules || []) {
    const rule = expected.get(item.ruleId);
    if (!rule) {
      errors.push(`corpus contains unknown rule ${item.ruleId}`);
      continue;
    }
    if (observed.has(item.ruleId)) errors.push(`corpus contains duplicate rule ${item.ruleId}`);
    observed.add(item.ruleId);
    for (const [field, value] of [
      ['adapterId', rule.adapter.id], ['adapterVersion', rule.adapter.version],
      ['adapterType', rule.adapter.type], ['kind', rule.kind], ['family', rule.family],
      ['expectedPositiveState', rule.defaultState], ['evidenceBoundary', rule.confidenceBoundary],
    ]) if (item[field] !== value) errors.push(`${item.ruleId}.${field} differs from the stable manifest`);
    for (const [field, fixtureKind] of [['positiveFixtures', 'positive'], ['negativeFixtures', 'negative']]) {
      if (JSON.stringify(item[field]) !== JSON.stringify(rule.fixtures[fixtureKind])) {
        errors.push(`${item.ruleId}.${field} differs from the stable manifest`);
      }
      for (const fixture of item[field] || []) {
        if (root && !existsSync(resolve(root, fixture.path))) errors.push(`${item.ruleId} fixture is missing: ${fixture.path}`);
      }
    }
    if (typeof item.testEntry !== 'string' || (root && !existsSync(resolve(root, item.testEntry)))) {
      errors.push(`${item.ruleId}.testEntry is missing`);
    }
  }
  for (const ruleId of expected.keys()) if (!observed.has(ruleId)) errors.push(`corpus is missing rule ${ruleId}`);
  return [...new Set(errors)];
}

export function validateCorpusObservations(corpus, observations, { adapterType = null } = {}) {
  const errors = [];
  const expected = corpus.rules.filter((rule) => !adapterType || rule.adapterType === adapterType);
  const byRule = new Map();
  for (const observation of observations) {
    if (byRule.has(observation.ruleId)) errors.push(`duplicate observation ${observation.ruleId}`);
    byRule.set(observation.ruleId, observation);
  }
  for (const rule of expected) {
    const observation = byRule.get(rule.ruleId);
    if (!observation) {
      errors.push(`missing positive/negative observation ${rule.ruleId}`);
      continue;
    }
    if (observation.positiveState !== rule.expectedPositiveState) {
      errors.push(`${rule.ruleId} positive state ${observation.positiveState || 'missing'} != ${rule.expectedPositiveState}`);
    }
    if (observation.negativeFindingCount !== 0) {
      errors.push(`${rule.ruleId} safe neighbour produced ${observation.negativeFindingCount} finding(s)`);
    }
  }
  for (const ruleId of byRule.keys()) {
    if (!expected.some((rule) => rule.ruleId === ruleId)) errors.push(`unexpected observation ${ruleId}`);
  }
  return [...new Set(errors)];
}

export function readStableRuleCorpus(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}
