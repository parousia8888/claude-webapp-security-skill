import { createRulesetV2 } from './ruleset-v2.mjs';

export const BUILTIN_SOURCE_ADAPTER = {
  id: 'builtin-source',
  version: '1.0.0',
  maturity: 'stable',
};

export const SOURCE_RULES = [
  { id: 'dependency-lockfile-missing', revision: '1', domain: 'supply_chain' },
  { id: 'sensitive-env-file-present', revision: '1', domain: 'security_exposure' },
  { id: 'node-inspector-public-bind', revision: '1', domain: 'security_exposure' },
  { id: 'production-source-map-enabled', revision: '1', domain: 'security_exposure' },
  { id: 'source-stack-unsupported', revision: '1', domain: 'evidence_integrity' },
];

export function sourceRuleset() {
  return createRulesetV2([{ ...BUILTIN_SOURCE_ADAPTER, rules: SOURCE_RULES }]);
}

export function sourceRule(ruleId) {
  const rule = SOURCE_RULES.find((item) => item.id === ruleId);
  if (!rule) throw new Error(`source audit returned an unregistered rule: ${ruleId}`);
  return rule;
}

export function sourceCoverage(findings, overrides = {}) {
  return SOURCE_RULES.map((rule) => {
    const override = overrides[rule.id] || {};
    const status = override.status || 'completed';
    const completed = status === 'completed';
    return {
      id: `source-${rule.id}`,
      adapterId: BUILTIN_SOURCE_ADAPTER.id,
      ruleId: rule.id,
      ruleRevision: override.ruleRevision || rule.revision,
      status,
      counts: override.counts || {
        discovered: findings.filter((finding) => finding.ruleId === rule.id).length,
        eligible: 1,
        scanned: completed ? 1 : 0,
        excluded: 0,
        skipped: 0,
        truncated: 0,
        errors: completed ? 0 : 1,
      },
      reasons: override.reasons || (completed ? [] : [{
        code: override.reasonCode || 'check_unavailable',
        count: 1,
        samplePaths: [],
      }]),
    };
  });
}
