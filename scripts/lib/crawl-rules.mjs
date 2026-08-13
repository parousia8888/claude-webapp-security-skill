import { createRulesetV2 } from './ruleset-v2.mjs';

export const CRAWL_ADAPTER = {
  id: 'builtin-crawl',
  version: '2.1.0',
  maturity: 'stable',
};

export const CRAWL_RULES = [
  ['robots-group-not-inherited', 'search_discoverability', 'medium', 'crawl_policy_conflict', 'robots'],
  ['robots-no-wildcard-group', 'search_discoverability', 'low', 'crawl_policy_hygiene', 'robots'],
  ['robots-duplicate-groups', 'search_discoverability', 'low', 'crawl_policy_hygiene', 'robots'],
  ['robots-blocks-search-crawler', 'search_discoverability', 'high', 'public_indexing_blocked', 'robots'],
  ['robots-blocks-user-fetcher', 'search_discoverability', 'medium', 'user_fetch_blocked', 'robots'],
  ['robots-no-sitemap', 'search_discoverability', 'medium', 'discovery_degraded', 'robots'],
  ['robots-uses-dollar-anchor', 'search_discoverability', 'info', 'crawl_policy_portability', 'robots'],
  ['robots-missing', 'search_discoverability', 'medium', 'crawl_policy_absent', 'robots'],
  ['robots-http-error', 'reliability', 'high', 'public_boundary_unavailable', 'robots'],
  ['robots-fetch-unknown', 'evidence_integrity', 'high', 'required_evidence_missing', 'robots'],
  ['llms-external-urls', 'search_discoverability', 'info', 'content_inventory_hygiene', 'llms'],
  ['llms-lists-disallowed-urls', 'search_discoverability', 'medium', 'crawl_policy_conflict', 'llms'],
  ['llms-fetch-unknown', 'evidence_integrity', 'low', 'optional_evidence_missing', 'llms'],
  ['sitemap-parse-unknown', 'evidence_integrity', 'high', 'required_evidence_missing', 'sitemap'],
  ['sitemap-fetch-unknown', 'evidence_integrity', 'high', 'required_evidence_missing', 'sitemap'],
  ['sitemap-unreachable', 'search_discoverability', 'high', 'public_indexing_blocked', 'sitemap'],
  ['sitemap-disallowed', 'search_discoverability', 'high', 'public_indexing_blocked', 'sitemap'],
  ['sitemap-empty', 'search_discoverability', 'high', 'public_indexing_blocked', 'sitemap'],
  ['sitemap-url-fetch-unknown', 'evidence_integrity', 'medium', 'sample_evidence_missing', 'sample'],
  ['sitemap-url-5xx', 'reliability', 'high', 'public_content_unavailable', 'sample'],
  ['sitemap-url-404', 'search_discoverability', 'high', 'indexed_content_missing', 'sample'],
  ['sitemap-url-redirect', 'search_discoverability', 'medium', 'discovery_degraded', 'sample'],
  ['sitemap-url-noindex', 'search_discoverability', 'high', 'public_indexing_blocked', 'sample'],
  ['sitemap-url-disallowed', 'search_discoverability', 'high', 'public_indexing_blocked', 'sample'],
  ['thin-initial-html', 'search_discoverability', 'medium', 'retrieval_degraded', 'sample'],
  ['missing-canonical', 'search_discoverability', 'low', 'content_inventory_hygiene', 'sample'],
  ['baseline-fetch-failed', 'reliability', 'high', 'public_content_unavailable', 'matrix'],
  ['matrix-baseline-unknown', 'evidence_integrity', 'high', 'required_evidence_missing', 'matrix'],
  ['matrix-comparison-unavailable', 'evidence_integrity', 'high', 'required_evidence_missing', 'matrix'],
  ['crawler-request-unknown', 'evidence_integrity', 'high', 'required_evidence_missing', 'matrix'],
  ['crawler-blocked', 'search_discoverability', 'high', 'public_indexing_blocked', 'matrix'],
  ['crawler-status-differs', 'search_discoverability', 'medium', 'retrieval_degraded', 'matrix'],
  ['possible-cloaking', 'search_discoverability', 'medium', 'retrieval_degraded', 'matrix'],
  ['public-page-noindex', 'search_discoverability', 'high', 'public_indexing_blocked', 'matrix'],
  ['probe-baseline-unknown', 'evidence_integrity', 'high', 'required_evidence_missing', 'probe'],
  ['probe-request-unknown', 'evidence_integrity', 'high', 'required_evidence_missing', 'probe'],
  ['soft-404-catchall', 'reliability', 'medium', 'route_semantics_degraded', 'probe'],
  ['probe-soft-404', 'reliability', 'info', 'deduplicated_observation', 'probe'],
  ['sensitive-file-exposed', 'security_exposure', 'high', 'sensitive_material_public', 'probe'],
  ['probe-path-200', 'security_exposure', 'medium', 'unexpected_public_surface', 'probe'],
  ['probe-path-403', 'security_exposure', 'low', 'surface_existence_disclosed', 'probe'],
  ['probe-summary', 'security_exposure', 'info', 'bounded_probe_inventory', 'probe'],
  ['source-map-discovery-unknown', 'evidence_integrity', 'high', 'required_evidence_missing', 'source-map'],
  ['source-map-check-unknown', 'evidence_integrity', 'high', 'required_evidence_missing', 'source-map'],
  ['source-map-exposed', 'security_exposure', 'high', 'source_material_public', 'source-map'],
  ['semantic-cache-buster', 'security_exposure', 'low', 'internal_metadata_disclosed', 'source-map'],
].map(([id, domain, severity, rationale, surface]) => ({
  id, revision: '1', domain, severity, rationale, surface,
}));

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
