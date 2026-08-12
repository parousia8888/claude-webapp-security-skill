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
- [x] Deterministic local HTTP/HTTPS fixtures for headers, redirect, TLS, 429, connection-refused,
  passive crawl, active-probe gate, Action entrypoint, installer and SBOM.
- [x] Crawler product-source fixtures: exact-source hit/miss/failure and sibling-source isolation.
- [x] Ubuntu + macOS x Node 20/22 matrix and CodeQL with full-SHA Action pins.
- [x] Composite GitHub Action, unified CLI, one-command multi-client installer and local demo.
- [x] Signed-build release workflow: source archive, SPDX SBOM, checksums and provenance attestation.
- [ ] Fake AWS CLI fixture asserting permission-denied -> `UNCHECKED`.
- [ ] Malformed/empty/stale crawler JSON fixtures, ShellCheck and coverage threshold.
- [ ] Dependency review and secret scanning after repository settings and alert policy are defined.

## v0.4 — structured security product
- Layered: `security-core` (pure rules + finding schema) · `security-cli` · `security-skill` · `policy-packs` (AWS/Cloudflare/nginx/OAuth/LLM).
- CLI: `audit`, `retest --baseline`, `explain FINDING-ID`.
- Outputs: Markdown/HTML · stable JSON schema · SARIF (GitHub code scanning) · JUnit · baseline diff (new/fixed/unchanged/regressed).
- Publish or mirror `parousia8888/webapp-security-hardening`, maintain a moving `v1` Action tag,
  and document a full immutable commit pin after the first Action release.
- Differentiator (not a general scanner — that's Semgrep/ZAP/Nuclei's lane): turn a security recommendation into a verifiable production hardening change and prove it didn't break real users, SEO, or AI-crawler traffic. nginx/Cloudflare/AWS-WAF minimal-patch generation, before/after regression, crawl-boundary matrix, versioned `security-policy.yml`, an evidence ledger, and patch-only-by-default for high-risk fixes.
