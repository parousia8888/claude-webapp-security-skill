# Roadmap

Priority order (by impact on trust, then adoption):
**correctness → deterministic integration tests → structured output/SARIF → GitHub Action → hardening patches & auto-retest → rule packs.**
The first three move the score; the rest move adoption.

## v0.2.x — result trustworthiness (in progress)
- [x] crawler identity at product granularity (GPTBot⇄gptbot.json); fail-open on fetch failure
- [x] real-CLI integration test for multi-source aggregation (local HTTP fixture)
- [x] TLS: prove TLS≤1.1 refused / TLS1.2+ works (drop the non-existent `%{ssl_version}`)
- [x] failure semantics: `000`/unreachable → ERROR, never "safe"
- [x] `--n` bounds + strict arg exit codes; `net.isIP` parsing; version-metadata consistency
- [x] rate-limit probe is opt-in (`--active-rate-limit`) — it is an ACTIVE test, not read-only
- [ ] CIDR math via a reviewed approach or a vetted library, if hand-rolled edge cases keep surfacing

## v0.3 — a real regression gate
- Deterministic local HTTP/HTTPS fixtures for headers, redirect, cert-fail, 429/503, timeout, connection-refused.
- Crawler JSON fixtures: all-ok / all-fail / partial-fail / malformed / empty / stale-cache.
- End-to-end test for `crawl-surface-audit.mjs`; a fake `aws` CLI fixture asserting permission-denied → `UNCHECKED` for `aws-exposure-audit.sh`.
- ShellCheck, coverage threshold, CodeQL, dependency + secret scanning in CI.
- Matrix: Ubuntu + macOS × Node 20/22 (started).
- Every past bug carries a plant-the-failure regression.

## v0.4 — product-shaped
- Layered: `security-core` (pure rules + finding schema) · `security-cli` · `security-skill` · `policy-packs` (AWS/Cloudflare/nginx/OAuth/LLM).
- CLI: `audit`, `retest --baseline`, `explain FINDING-ID`.
- Outputs: Markdown/HTML · stable JSON schema · SARIF (GitHub code scanning) · JUnit · baseline diff (new/fixed/unchanged/regressed).
- GitHub Action `uses: parousia8888/webapp-security-hardening@v1`, signed releases, pinned action commit, SBOM, checksums.
- Differentiator (not a general scanner — that's Semgrep/ZAP/Nuclei's lane): turn a security recommendation into a verifiable production hardening change and prove it didn't break real users, SEO, or AI-crawler traffic. nginx/Cloudflare/AWS-WAF minimal-patch generation, before/after regression, crawl-boundary matrix, versioned `security-policy.yml`, an evidence ledger, and patch-only-by-default for high-risk fixes.
