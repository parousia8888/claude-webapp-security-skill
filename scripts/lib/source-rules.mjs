import { createRulesetV2 } from './ruleset-v2.mjs';

export const BUILTIN_SOURCE_ADAPTER = {
  id: 'builtin-source',
  version: '1.1.0',
  maturity: 'stable',
};

export const SOURCE_RULES = [
  { id: 'dependency-lockfile-missing', revision: '1', domain: 'supply_chain' },
  { id: 'sensitive-env-file-present', revision: '1', domain: 'security_exposure' },
  { id: 'node-inspector-public-bind', revision: '1', domain: 'security_exposure' },
  { id: 'production-source-map-enabled', revision: '1', domain: 'security_exposure' },
  { id: 'source-stack-unsupported', revision: '1', domain: 'evidence_integrity' },
  { id: 'source-evidence-incomplete', revision: '1', domain: 'evidence_integrity' },
];

export function sourceRuleset() {
  return createRulesetV2([{ ...BUILTIN_SOURCE_ADAPTER, rules: SOURCE_RULES }]);
}

export function sourceRule(ruleId) {
  const rule = SOURCE_RULES.find((item) => item.id === ruleId);
  if (!rule) throw new Error(`source audit returned an unregistered rule: ${ruleId}`);
  return rule;
}

function syntheticCoverage(findings, rule, override) {
  const status = override.status || 'completed';
  const completed = status === 'completed';
  return {
    discovered: 1,
    eligible: 1,
    scanned: completed ? 1 : 0,
    excluded: 0,
    skipped: 0,
    truncated: 0,
    errors: completed ? 0 : 1,
  };
}

export function sourceCoverage(audit, overrides = {}) {
  const findings = Array.isArray(audit) ? audit : audit.findings;
  return SOURCE_RULES.map((rule) => {
    const override = overrides[rule.id] || {};
    const measured = Array.isArray(audit) ? null : audit.coverage[rule.id];
    const status = override.status || measured?.status || 'completed';
    const completed = status === 'completed';
    return {
      id: `source-${rule.id}`,
      adapterId: BUILTIN_SOURCE_ADAPTER.id,
      ruleId: rule.id,
      ruleRevision: override.ruleRevision || rule.revision,
      status,
      counts: override.counts || measured?.counts || syntheticCoverage(findings, rule, override),
      reasons: override.reasons || measured?.reasons || (completed ? [] : [{
        code: override.reasonCode || 'check_unavailable',
        count: 1,
        samplePaths: [],
      }]),
    };
  });
}
