# Rule taxonomy

<!-- Generated from scripts/lib/source-rules.mjs and scripts/lib/crawl-rules.mjs. -->

Severity is interpreted inside the named risk domain. In particular, a HIGH
`search_discoverability` impact is not a HIGH `security_exposure`, and an
`evidence_integrity` severity describes the importance of missing evidence rather than a
confirmed product vulnerability.

## Source rules

| Rule | Domain | Severity | Rationale |
|---|---|---|---|
| `dependency-lockfile-missing` | `supply_chain` | `low` | Dependency resolution cannot be reproduced or reviewed from a committed lock. |
| `sensitive-env-file-present` | `security_exposure` | `medium` | A sensitive-named local file is present and requires repository/artifact review; presence alone is not public exposure. |
| `node-inspector-public-bind` | `security_exposure` | `high` | A debugger is configured for a public bind address and can expose process control if reachable. |
| `production-source-map-enabled` | `security_exposure` | `medium` | Configuration enables source-map output; public delivery still requires artifact or deployment evidence. |
| `source-stack-unsupported` | `evidence_integrity` | `info` | The built-in source adapter cannot identify a supported manifest. |
| `source-evidence-incomplete` | `evidence_integrity` | `high` | A required input could not be obtained or interpreted; severity describes the importance of the evidence gap, not a confirmed vulnerability. |

## Crawl rules

| Rule | Domain | Severity | Rationale |
|---|---|---|---|
| `robots-group-not-inherited` | `search_discoverability` | `medium` | Published discovery directives disagree and can produce inconsistent crawler behavior. |
| `robots-no-wildcard-group` | `search_discoverability` | `low` | The policy is ambiguous or non-portable but does not by itself block intended content. |
| `robots-duplicate-groups` | `search_discoverability` | `low` | The policy is ambiguous or non-portable but does not by itself block intended content. |
| `robots-blocks-search-crawler` | `search_discoverability` | `high` | Intended public content or its discovery path is blocked from search or AI retrieval. |
| `robots-blocks-user-fetcher` | `search_discoverability` | `medium` | A user-triggered assistant fetch is blocked. |
| `robots-no-sitemap` | `search_discoverability` | `medium` | Discovery remains possible but is slower, indirect, or unnecessarily redirected. |
| `robots-uses-dollar-anchor` | `search_discoverability` | `info` | A directive is not interpreted consistently across crawler implementations. |
| `robots-missing` | `search_discoverability` | `medium` | No explicit crawl policy is published. |
| `robots-http-error` | `reliability` | `high` | The public policy endpoint fails at the origin. |
| `robots-fetch-unknown` | `evidence_integrity` | `high` | A required input could not be obtained or interpreted; severity describes the importance of the evidence gap, not a confirmed vulnerability. |
| `llms-external-urls` | `search_discoverability` | `info` | Metadata quality affects inventory or canonicalization without proving lost availability. |
| `llms-lists-disallowed-urls` | `search_discoverability` | `medium` | Published discovery directives disagree and can produce inconsistent crawler behavior. |
| `llms-fetch-unknown` | `evidence_integrity` | `low` | An optional evidence source was unavailable. |
| `sitemap-parse-unknown` | `evidence_integrity` | `high` | A required input could not be obtained or interpreted; severity describes the importance of the evidence gap, not a confirmed vulnerability. |
| `sitemap-fetch-unknown` | `evidence_integrity` | `high` | A required input could not be obtained or interpreted; severity describes the importance of the evidence gap, not a confirmed vulnerability. |
| `sitemap-unreachable` | `search_discoverability` | `high` | Intended public content or its discovery path is blocked from search or AI retrieval. |
| `sitemap-disallowed` | `search_discoverability` | `high` | Intended public content or its discovery path is blocked from search or AI retrieval. |
| `sitemap-empty` | `search_discoverability` | `high` | Intended public content or its discovery path is blocked from search or AI retrieval. |
| `sitemap-url-fetch-unknown` | `evidence_integrity` | `medium` | A bounded content sample could not be evaluated. |
| `sitemap-url-5xx` | `reliability` | `high` | An intended public page or baseline response is unavailable. |
| `sitemap-url-404` | `search_discoverability` | `high` | A URL advertised for indexing is missing. |
| `sitemap-url-redirect` | `search_discoverability` | `medium` | Discovery remains possible but is slower, indirect, or unnecessarily redirected. |
| `sitemap-url-noindex` | `search_discoverability` | `high` | Intended public content or its discovery path is blocked from search or AI retrieval. |
| `sitemap-url-disallowed` | `search_discoverability` | `high` | Intended public content or its discovery path is blocked from search or AI retrieval. |
| `thin-initial-html` | `search_discoverability` | `medium` | Crawler-visible content differs or lacks enough initial content for dependable retrieval. |
| `missing-canonical` | `search_discoverability` | `low` | Metadata quality affects inventory or canonicalization without proving lost availability. |
| `baseline-fetch-failed` | `reliability` | `high` | An intended public page or baseline response is unavailable. |
| `matrix-baseline-unknown` | `evidence_integrity` | `high` | A required input could not be obtained or interpreted; severity describes the importance of the evidence gap, not a confirmed vulnerability. |
| `matrix-comparison-unavailable` | `evidence_integrity` | `high` | A required input could not be obtained or interpreted; severity describes the importance of the evidence gap, not a confirmed vulnerability. |
| `crawler-request-unknown` | `evidence_integrity` | `high` | A required input could not be obtained or interpreted; severity describes the importance of the evidence gap, not a confirmed vulnerability. |
| `crawler-blocked` | `search_discoverability` | `high` | Intended public content or its discovery path is blocked from search or AI retrieval. |
| `crawler-status-differs` | `search_discoverability` | `medium` | Crawler-visible content differs or lacks enough initial content for dependable retrieval. |
| `possible-cloaking` | `search_discoverability` | `medium` | Crawler-visible content differs or lacks enough initial content for dependable retrieval. |
| `public-page-noindex` | `search_discoverability` | `high` | Intended public content or its discovery path is blocked from search or AI retrieval. |
| `probe-baseline-unknown` | `evidence_integrity` | `high` | A required input could not be obtained or interpreted; severity describes the importance of the evidence gap, not a confirmed vulnerability. |
| `probe-request-unknown` | `evidence_integrity` | `high` | A required input could not be obtained or interpreted; severity describes the importance of the evidence gap, not a confirmed vulnerability. |
| `soft-404-catchall` | `reliability` | `medium` | Unknown routes return misleading success semantics. |
| `probe-soft-404` | `reliability` | `info` | An informational observation is summarized under another actionable rule. |
| `sensitive-file-exposed` | `security_exposure` | `high` | A public response matches sensitive configuration or credential material. |
| `probe-path-200` | `security_exposure` | `medium` | A private-looking path responds publicly but content sensitivity is not confirmed. |
| `probe-path-403` | `security_exposure` | `low` | The response discloses that a private-looking route exists. |
| `probe-summary` | `security_exposure` | `info` | An informational count records the bounded probe result. |
| `source-map-discovery-unknown` | `evidence_integrity` | `high` | A required input could not be obtained or interpreted; severity describes the importance of the evidence gap, not a confirmed vulnerability. |
| `source-map-check-unknown` | `evidence_integrity` | `high` | A required input could not be obtained or interpreted; severity describes the importance of the evidence gap, not a confirmed vulnerability. |
| `source-map-exposed` | `security_exposure` | `high` | Original source and comments are publicly reconstructable from a served source map. |
| `semantic-cache-buster` | `security_exposure` | `low` | Asset naming reveals internal release or feature labels. |

