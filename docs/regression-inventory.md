# Release regression inventory

This inventory links known correctness failures to executable regressions. It is not a test-count
claim: one test can cover several related failure modes, and every row names the narrow contract it
protects. Restoring the defect or mutating the guarded path must make the named regression fail.

| Historical correctness failure | Protected contract | Regression |
|---|---|---|
| A crawler IP owned by one vendor could verify a different vendor's user-agent claim | Claimed product and proven owner must agree | `test/verify-crawler-ip.test.mjs`, `test/integration.test.mjs` |
| Failure to fetch the claimed product's range list could convict the crawler as spoofed | Unavailable identity evidence is `unverifiable`, never a negative proof | `test/integration.test.mjs` |
| A sibling product's range could verify or convict the claimed product | Product-specific sources remain authoritative | `test/integration.test.mjs`, `test/crawler-range-evidence.test.mjs` |
| Invalid IP/CIDR, stale/future/empty range data could enter identity decisions | Range evidence must parse and validate before use | `test/verify-crawler-ip.test.mjs`, `test/crawler-range-evidence.test.mjs` |
| The edge verifier labelled HTTP version as TLS and skipped certificate validation | TLS policy and certificate/hostname checks are active proofs | `test/verify-hardening.test.mjs` |
| Network failure could be reported as a safe edge result | Unreachable or missing-tool evidence remains unknown and non-zero | `test/verify-hardening.test.mjs` |
| Bash 3.2 empty-array expansion crashed the edge verifier | Supported macOS shell path stays executable | `test/verify-hardening.test.mjs`, `test/shell-smoke.sh` |
| Rate-limit and sensitive-path probes could run without explicit authorization | Active traffic stops before the first request without acknowledgement | `test/product-surfaces.test.mjs`, `test/shell-smoke.sh` |
| Sitemap XML entities, CDATA, external declarations or off-origin URLs could corrupt scope | Sitemap parsing is bounded, same-origin and fail-closed | `test/sitemap-evidence.test.mjs` |
| Nested AWS permission denial could become a fabricated pass or finding | Denied/malformed inventory is explicit unknown coverage | `test/aws-permission-evidence.test.mjs` |
| Cross-project, tampered or forged baseline evidence could manufacture `fixed` | Subject, scope, bytes, ruleset and adapter lineage must match | `test/baseline-identity.test.mjs` |
| A missing, unavailable or revised rule could manufacture `fixed` | Only a completed compatible check proves absence | `test/baseline-identity.test.mjs`, `test/evidence-loop.test.mjs` |
| v1 evidence could be silently compared as a v2 baseline | Migration preserves lineage but remains non-comparable | `test/baseline-identity.test.mjs` |
| Workspace packages, pinned requirements and environment templates generated false positives | Workspace lock inheritance and template exclusions are explicit | `test/evidence-loop.test.mjs`, `test/case-journeys.test.mjs` |
| Source traversal silently dropped deep, large, unreadable, malformed or oversized candidates | Per-rule coverage reconciles and incomplete evidence exits `3` | `test/source-coverage-ledger.test.mjs` |
| Search crawler failures shared one security severity headline | Domain/state summaries and policies remain separate | `test/domain-aware-reporting.test.mjs`, `test/product-surfaces.test.mjs` |
| Demo and public counts could drift through copied prose | One structured demo source generates every public count | `test/domain-aware-reporting.test.mjs`, `test/demo-gif.test.mjs`, `test/p7-surfaces.test.mjs` |
| A renderer/write failure could leave partial, public or overwritten evidence | Evidence bundles are private, staged, non-overwriting and rollback on handled failure | `test/evidence-writer.test.mjs` |
| External-tool missing/version/timeout/error/malformed output could look clean | Adapter failure is unavailable coverage plus unknown finding | `test/external-adapters.test.mjs`, `test/real-adapters.test.mjs` |
| External severity metadata could inflate local OSV severity | Advisory severity stays upstream evidence; local severity is `info` | `test/external-adapters.test.mjs` |
| Gitleaks/OSV scanner hits could be labelled confirmed without reproduction | Every external scanner match is a `suspected` lead | `test/external-adapters.test.mjs`, `test/real-adapters.test.mjs` |
| Duplicate Gitleaks records could collide on one finding identity | Exact duplicate records are removed and distinct tool fingerprints remain distinct | `test/external-adapters.test.mjs` |
| A numeric 12-character fingerprint prefix could be rewritten by AWS-account sanitization | Finding IDs include a non-numeric `f` discriminator and survive sanitization | `test/external-adapters.test.mjs` |

The five-project corpus adds real-project applicability and false-positive closure around these
planted regressions. It does not replace the fixtures: mutable advisory data and unlabelled public
projects cannot provide a statistically meaningful precision or recall score.

## Stable detector applicability

| Advertised stable detector | Planted positive/negative/failure evidence | Five-project applicability |
|---|---|---|
| Crawl-boundary audit | `test/crawl-evidence-v2.test.mjs`, `test/sitemap-evidence.test.mjs`, `test/product-surfaces.test.mjs` | `not_applicable`: no hosted project was contacted |
| Crawler identity | `test/verify-crawler-ip.test.mjs`, `test/integration.test.mjs`, `test/crawler-range-evidence.test.mjs` | `not_applicable`: no project traffic or claimed crawler identity was in scope |
| Edge verification | `test/verify-hardening.test.mjs` covers positive, unreachable, missing-tool, authorization and redaction paths | `not_applicable`: no hosted edge was authorized or contacted |
| Narrow deterministic source audit | `test/evidence-loop.test.mjs`, `test/source-coverage-ledger.test.mjs` cover positive, clean, incomplete and precision paths | `completed` for all five fixed commits; every built-in rule has a coverage row |
| AWS exposure inventory | `test/aws-permission-evidence.test.mjs` covers positive, denied, malformed, redaction and private output | `not_applicable`: no third-party cloud account was in scope |
| Gitleaks secret detection | `test/external-adapters.test.mjs`, `test/real-adapters.test.mjs` cover positive, clean, unavailable/malformed, dedupe and redaction | `completed` for all five; every match remains `suspected` |
| OSV dependency detection | `test/external-adapters.test.mjs`, `test/real-adapters.test.mjs` cover positive, clean, unavailable/malformed, severity and redaction | `completed` for four projects; `not_applicable` for Healthchecks without a supported lockfile |

No detector has a generic suppression engine in v0.4.0. Case-specific closure is recorded as
structured evidence and planted precision regressions; introducing a suppression mechanism would
require its own owner, expiry and audit contract rather than an untracked ignore list.
