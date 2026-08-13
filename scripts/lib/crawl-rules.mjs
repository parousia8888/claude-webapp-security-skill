import { createRulesetV2 } from './ruleset-v2.mjs';

export const CRAWL_ADAPTER = {
  id: 'builtin-crawl',
  version: '2.1.0',
  maturity: 'stable',
};

export const CRAWL_RULES = [
  ['robots-group-not-inherited', 'search_discoverability', 'robots'],
  ['robots-no-wildcard-group', 'search_discoverability', 'robots'],
  ['robots-duplicate-groups', 'search_discoverability', 'robots'],
  ['robots-blocks-search-crawler', 'search_discoverability', 'robots'],
  ['robots-blocks-user-fetcher', 'search_discoverability', 'robots'],
  ['robots-no-sitemap', 'search_discoverability', 'robots'],
  ['robots-uses-dollar-anchor', 'search_discoverability', 'robots'],
  ['robots-missing', 'search_discoverability', 'robots'],
  ['robots-http-error', 'reliability', 'robots'],
  ['robots-fetch-unknown', 'evidence_integrity', 'robots'],
  ['llms-external-urls', 'search_discoverability', 'llms'],
  ['llms-lists-disallowed-urls', 'search_discoverability', 'llms'],
  ['llms-fetch-unknown', 'evidence_integrity', 'llms'],
  ['sitemap-parse-unknown', 'evidence_integrity', 'sitemap'],
  ['sitemap-fetch-unknown', 'evidence_integrity', 'sitemap'],
  ['sitemap-unreachable', 'search_discoverability', 'sitemap'],
  ['sitemap-disallowed', 'search_discoverability', 'sitemap'],
  ['sitemap-empty', 'search_discoverability', 'sitemap'],
  ['sitemap-url-fetch-unknown', 'evidence_integrity', 'sample'],
  ['sitemap-url-5xx', 'reliability', 'sample'],
  ['sitemap-url-404', 'search_discoverability', 'sample'],
  ['sitemap-url-redirect', 'search_discoverability', 'sample'],
  ['sitemap-url-noindex', 'search_discoverability', 'sample'],
  ['sitemap-url-disallowed', 'search_discoverability', 'sample'],
  ['thin-initial-html', 'search_discoverability', 'sample'],
  ['missing-canonical', 'search_discoverability', 'sample'],
  ['baseline-fetch-failed', 'reliability', 'matrix'],
  ['matrix-baseline-unknown', 'evidence_integrity', 'matrix'],
  ['matrix-comparison-unavailable', 'evidence_integrity', 'matrix'],
  ['crawler-request-unknown', 'evidence_integrity', 'matrix'],
  ['crawler-blocked', 'search_discoverability', 'matrix'],
  ['crawler-status-differs', 'search_discoverability', 'matrix'],
  ['possible-cloaking', 'search_discoverability', 'matrix'],
  ['public-page-noindex', 'search_discoverability', 'matrix'],
  ['probe-baseline-unknown', 'evidence_integrity', 'probe'],
  ['probe-request-unknown', 'evidence_integrity', 'probe'],
  ['soft-404-catchall', 'reliability', 'probe'],
  ['probe-soft-404', 'reliability', 'probe'],
  ['sensitive-file-exposed', 'security_exposure', 'probe'],
  ['probe-path-200', 'security_exposure', 'probe'],
  ['probe-path-403', 'security_exposure', 'probe'],
  ['probe-summary', 'security_exposure', 'probe'],
  ['source-map-discovery-unknown', 'evidence_integrity', 'source-map'],
  ['source-map-check-unknown', 'evidence_integrity', 'source-map'],
  ['source-map-exposed', 'security_exposure', 'source-map'],
  ['semantic-cache-buster', 'security_exposure', 'source-map'],
].map(([id, domain, surface]) => ({ id, revision: '1', domain, surface }));

export function crawlRule(ruleId) {
  const rule = CRAWL_RULES.find((item) => item.id === ruleId);
  if (!rule) throw new Error(`crawl audit returned an unregistered rule: ${ruleId}`);
  return rule;
}

export function crawlRuleset() {
  return createRulesetV2([{ ...CRAWL_ADAPTER, rules: CRAWL_RULES }]);
}

export function crawlCoverage(signals, surfaceStatuses) {
  return CRAWL_RULES.map((rule) => {
    const status = surfaceStatuses[rule.surface] || 'unavailable';
    const counts = status === 'completed'
      ? { discovered: 1, eligible: 1, scanned: 1, excluded: 0, skipped: 0, truncated: 0, errors: 0 }
      : status === 'not_applicable'
        ? { discovered: 1, eligible: 0, scanned: 0, excluded: 1, skipped: 0, truncated: 0, errors: 0 }
        : status === 'partial'
          ? { discovered: 2, eligible: 2, scanned: 1, excluded: 0, skipped: 0, truncated: 0, errors: 1 }
          : { discovered: 1, eligible: 1, scanned: 0, excluded: 0, skipped: 0, truncated: 0, errors: 1 };
    return {
      id: `crawl-${rule.id}`,
      adapterId: CRAWL_ADAPTER.id,
      ruleId: rule.id,
      ruleRevision: rule.revision,
      status,
      counts,
      reasons: status === 'completed' ? [] : [{
        code: status === 'not_applicable' ? 'active_probe_disabled' : `crawl_${rule.surface.replace('-', '_')}_${status}`,
        count: 1,
        samplePaths: [],
      }],
    };
  });
}
