import { createRulesetV2 } from './ruleset-v2.mjs';

export const CRAWLER_IDENTITY_ADAPTER = {
  id: 'builtin-crawler-identity',
  version: '2.0.0',
  maturity: 'stable',
};

export const CRAWLER_IDENTITY_RULES = [
  { id: 'crawler-identity-verified', revision: '1', domain: 'security_exposure' },
  { id: 'crawler-identity-spoofed', revision: '1', domain: 'security_exposure' },
  { id: 'crawler-identity-unverifiable', revision: '1', domain: 'evidence_integrity' },
  { id: 'crawler-identity-not-known', revision: '1', domain: 'security_exposure' },
];

export function crawlerIdentityRuleset() {
  return createRulesetV2([{
    ...CRAWLER_IDENTITY_ADAPTER,
    rules: CRAWLER_IDENTITY_RULES,
  }]);
}

export function crawlerIdentityRule(ruleId) {
  const rule = CRAWLER_IDENTITY_RULES.find((item) => item.id === ruleId);
  if (!rule) throw new Error(`crawler identity returned an unregistered rule: ${ruleId}`);
  return rule;
}

export function crawlerIdentityCoverage(results) {
  const unavailable = results.filter((result) => result.verdict === 'unverifiable').length;
  return CRAWLER_IDENTITY_RULES.map((rule) => {
    const verdict = rule.id.replace('crawler-identity-', '')
      .replace('not-known', 'not-a-known-bot');
    const discovered = results.filter((result) => result.verdict === verdict).length;
    const isUnknownRule = rule.id === 'crawler-identity-unverifiable';
    const status = unavailable
      ? isUnknownRule ? 'unavailable' : 'partial'
      : 'completed';
    return {
      id: `crawler-identity-${rule.id}`,
      adapterId: CRAWLER_IDENTITY_ADAPTER.id,
      ruleId: rule.id,
      ruleRevision: rule.revision,
      status,
      counts: status === 'completed'
        ? { discovered, eligible: results.length, scanned: results.length, excluded: 0, skipped: 0, truncated: 0, errors: 0 }
        : { discovered, eligible: results.length, scanned: results.length - unavailable, excluded: 0, skipped: 0, truncated: 0, errors: unavailable },
      reasons: status === 'completed' ? [] : [{
        code: 'crawler_identity_evidence_unavailable',
        count: unavailable,
        samplePaths: [],
      }],
    };
  });
}
