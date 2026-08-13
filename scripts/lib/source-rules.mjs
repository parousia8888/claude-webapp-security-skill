import { createRulesetV2 } from './ruleset-v2.mjs';
import { adapterDefinitions } from './adapter-definitions.mjs';
import { SOURCE_RULE_REGISTRY, runtimeRule } from './source-rule-registry.mjs';

const builtinRegistry = SOURCE_RULE_REGISTRY.filter((rule) =>
  rule.adapter.type === 'built_in' && rule.maturity === 'stable');
export const BUILTIN_SOURCE_ADAPTER = {
  id: builtinRegistry[0].adapter.id,
  version: builtinRegistry[0].adapter.version,
  maturity: builtinRegistry[0].adapter.maturity,
};

export const SOURCE_RULES = builtinRegistry.map(runtimeRule);

export function sourceRuleset(selected = ['builtin']) {
  return createRulesetV2([
    ...(selected.includes('builtin') ? [{ ...BUILTIN_SOURCE_ADAPTER, rules: SOURCE_RULES }] : []),
    ...adapterDefinitions(selected),
  ]);
}

export function sourceRule(ruleId) {
  const rule = SOURCE_RULES.find((item) => item.id === ruleId);
  if (!rule) throw new Error(`source audit returned an unregistered rule: ${ruleId}`);
  return rule;
}

export function sourceRuleForAdapter(adapterId, ruleId, selected = ['builtin']) {
  if (adapterId === BUILTIN_SOURCE_ADAPTER.id) return sourceRule(ruleId);
  const definition = adapterDefinitions(selected).find((item) => item.id === adapterId);
  const rule = definition?.rules.find((item) => item.id === ruleId);
  if (!rule) throw new Error(`adapter returned an unregistered rule: ${adapterId}/${ruleId}`);
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
