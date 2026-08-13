import { createRulesetV2 } from './ruleset-v2.mjs';

export const EDGE_ADAPTER = {
  id: 'builtin-edge',
  version: '2.0.0',
  maturity: 'stable',
};

export const EDGE_RULES = [
  ['edge-curl-capability', 'evidence_integrity', 'high'],
  ['edge-hsts', 'security_exposure', 'medium'],
  ['edge-nosniff', 'security_exposure', 'medium'],
  ['edge-frame-protection', 'security_exposure', 'medium'],
  ['edge-referrer-policy', 'security_exposure', 'low'],
  ['edge-content-security-policy', 'security_exposure', 'medium'],
  ['edge-rate-probe-throttling', 'security_exposure', 'medium'],
  ['edge-rate-content-availability', 'reliability', 'high'],
  ['edge-http-redirect', 'security_exposure', 'medium'],
  ['edge-tls-max-capability', 'evidence_integrity', 'high'],
  ['edge-tls12-available', 'reliability', 'high'],
  ['edge-tls11-rejected', 'security_exposure', 'high'],
  ['edge-tls10-rejected', 'security_exposure', 'high'],
  ['edge-certificate-validation', 'security_exposure', 'high'],
].map(([id, domain, severity]) => ({ id, revision: '1', domain, severity }));

export function edgeRuleset() {
  return createRulesetV2([{ ...EDGE_ADAPTER, rules: EDGE_RULES }]);
}

export function edgeRule(ruleId) {
  const rule = EDGE_RULES.find((item) => item.id === ruleId);
  if (!rule) throw new Error(`edge verifier returned an unregistered rule: ${ruleId}`);
  return rule;
}

export function edgeCoverage(observations) {
  const byRule = new Map(observations.map((observation) => [observation.ruleId, observation]));
  return EDGE_RULES.map((rule) => {
    const observation = byRule.get(rule.id);
    if (!observation) throw new Error(`edge verifier omitted required rule observation: ${rule.id}`);
    const status = observation.state === 'unknown'
      ? 'unavailable'
      : observation.state === 'not_applicable'
        ? 'not_applicable'
        : 'completed';
    return {
      id: `edge-${rule.id}`,
      adapterId: EDGE_ADAPTER.id,
      ruleId: rule.id,
      ruleRevision: rule.revision,
      status,
      counts: status === 'completed'
        ? { discovered: observation.state === 'failed' ? 1 : 0, eligible: 1, scanned: 1, excluded: 0, skipped: 0, truncated: 0, errors: 0 }
        : status === 'not_applicable'
          ? { discovered: 0, eligible: 0, scanned: 0, excluded: 1, skipped: 0, truncated: 0, errors: 0 }
          : { discovered: 1, eligible: 1, scanned: 0, excluded: 0, skipped: 0, truncated: 0, errors: 1 },
      reasons: status === 'completed' ? [] : [{
        code: status === 'not_applicable' ? 'edge_check_not_applicable' : 'edge_evidence_unavailable',
        count: 1,
        samplePaths: [],
      }],
    };
  });
}
