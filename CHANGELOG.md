# Changelog

All notable changes to **Web App Security Skill** are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.3.0] — 2026-08-13

### Added
- Network-free `webapp-security start <project>` discovery for Node, Python and split-stack layouts,
  with a versioned `security-scope.yml`, explicit source/local/remote modes, pending authorization,
  secret-file avoidance and an installable scope schema.
- Unified zero-dependency CLI with Claude Code, Codex and ordinary CLI installation, atomic
  replacement and timestamped backups.
- Deterministic local before/after demo (`13 high / 6 medium` to zero) with JSON, Markdown and
  patch evidence.
- Passive-by-default composite GitHub Action with explicit authorization and stable report paths.
- Release workflow for reproducible source archive, SPDX 2.3 SBOM, SHA-256 checksums and GitHub
  build-provenance attestation; CodeQL and full-SHA third-party Action pins.
- Security policy, threat model, false-positive policy, compatibility matrix, issue forms, bounded
  good-first issues and versioned release evidence.
- Five immutable-commit source case studies: Juice Shop, NodeGoat, DVWA, Uptime Kuma and Mealie.

### Changed
- Public identity is unified as **Web App Security Skill**: repository `web-app-security-skill`,
  Skill ID `web-app-security`, CLI `webapp-security`, and matching Action/release/SBOM names. The
  installer detects the earlier `webapp-security-hardening` path and backs it up during migration.
- Sensitive-path crawl probes and rate-limit bursts now require an explicit authorization
  acknowledgement; passive checks remain the default.
- Crawl reports support stable filenames and configurable fail thresholds for CI use.
- README now follows result, install, first-project prompt, capability boundary, deterministic
  tools, trust and case-study evidence. English and Chinese claims, demo counts and case counts are
  checked against structured or generated sources.

## [0.2.4] — 2026-08-13

### Changed
- CI: bumped `actions/checkout` and `actions/setup-node` to `@v5`. GitHub was force-running the
  `@v4` actions on Node 24 (the Node 20 action runtime is deprecated) and printing a deprecation
  notice on every run; `@v5` targets the supported runtime and clears the warning. No change to the
  test matrix (ubuntu/macOS × Node 20/22) or what runs.

## [0.2.3] — 2026-08-13

### Changed
- **verify-hardening TLS verification is now per-version and stricter.** It checks TLS 1.0, 1.1,
  and 1.2 handshakes independently (`--tlsvX --tls-max X`), so "1.0/1.1 refused, 1.2 works" is
  actually proven rather than inferred; certificate + hostname validation and connect/max timeouts
  are applied to every request.
- **Three-state outcome: pass / fail / `unknown`.** Network- or TLS-layer failures and
  unverifiable conditions (e.g. `curl` without `--tls-max`, an unreachable redirect endpoint) are
  reported as `unknown`, and the script exits non-zero unless every check passed — an `unknown`
  no longer reads as success.
- `--content-path` / `--probe-path` must start with `/`; added `--help`/usage output.

### Added
- `test/verify-hardening.test.mjs` — a **deterministic** integration test for the shell tool: it
  stands up a real local HTTPS origin (self-signed cert, `minVersion: TLSv1.2`) plus an HTTP→HTTPS
  redirect server, then asserts the passive checks pass, TLS 1.0 is reported rejected while 1.2
  succeeds, the certificate validates, `--active-rate-limit` sees the probe throttled (429) while
  content stays available, out-of-range `--n` exits `2`, and an unreachable target can never be
  reported crawler-safe. No network, no third-party host — the first roadmap v0.3 fixture, landed early.

## [0.2.2] — 2026-08-13

Third-audit fixes — result trustworthiness. Crawler identity moved to product granularity,
the TLS check made real, failure semantics and argument handling tightened, and CI turned into
an actual gate.

### Fixed
- **crawler verifier: identity is now resolved at PRODUCT granularity** (GPTBot⇄`gptbot.json`,
  OAI-SearchBot⇄`searchbot.json`, …), not vendor granularity. A single list's outage while a
  sibling OpenAI list loads no longer brands a real crawler `spoofed`; a sibling product
  containing the IP is not proof the request is GPTBot. Verified end-to-end (not just via
  `decideVerdict`) by a real-CLI integration test with a local fixture.
- **verify-hardening TLS check was inert** — it printed `%{http_version}` and, in v0.2.1, the
  non-existent `%{ssl_version}` write-out variable (which errors on curl 8.x). Replaced with an
  active policy test: `--tls-max 1.1` must be **refused**, `--tlsv1.2` must **work**.
- **verify-hardening failure semantics** — `curl 000` / DNS failure / timeout is now `ERROR/UNKNOWN`,
  never counted as "content class safe". An unreachable target no longer reads as a pass.
- **verify-hardening argument handling** — `--n` bounded to 1–100; missing values, bad scheme, and
  non-numeric `--n` all exit `2`.
- **IP parsing** — `net.isIP` gate plus explicit rejection of zone ids (`%`); junk like
  `2001:db8::1g`, `1::2::3`, `:::` no longer silently parses.
- **version metadata** — `package.json` realigned to `VERSION`/tag (was stuck at 0.2.0).

### Added
- `test/integration.test.mjs` — real-CLI, multi-source aggregation over a local HTTP fixture
  (all-ok / fetch-fail / sibling-hit / IP-present), the coverage pure-function tests couldn't give.
- `test/shell-smoke.sh` — exit-code contracts + Bash-3.2 + passive-default, run as a CI gate.
- `test/version-consistency.test.mjs` — CI fails if VERSION / package.json / CHANGELOG disagree.
- `ROADMAP.md` — public roadmap (v0.3 deterministic fixtures + ShellCheck/CodeQL/coverage; v0.4
  SARIF/CLI/Action + hardening-patch generation).

### Changed
- **Rate-limit probe is now opt-in** (`--active-rate-limit`, with a request-volume + authorization
  notice). It sends many concurrent requests and is an ACTIVE test — it no longer runs by default,
  restoring the read-only default the docs claim.
- **CI is a real gate**: dropped every `|| true`; added the shell-smoke gate and a
  ubuntu/macOS × Node 20/22 matrix.

## [0.2.1] — 2026-08-13

Second-audit fixes: three real defects found by re-auditing v0.2.0, each frozen as a regression.

### Fixed
- **`verify-crawler-ip`: a failed range-source fetch convicted a real crawler as `spoofed`.**
  The logic used "we have a source configured" where it needed "the source loaded this run", so
  pointing OpenAI's range URL at an unreachable address made a genuine GPTBot IP resolve to
  `spoofed` — which, wired to an allowlist, would wrongly block it. Now **fails open**: a source
  that fails to fetch yields `unverifiable`, and only a *successfully-loaded* source that lacks the
  IP yields `spoofed`. `decideVerdict` gained a `claimedVendorSourceLoaded` input; `verify()` tracks
  per-source load success.
- **`verify-hardening.sh`: crashed on macOS's Bash 3.2** — an empty `${HOSTHDR[@]}` under `set -u`
  is an unbound-variable error there (the README advertises macOS/Codex support). Reworked to pass
  the optional `Host` header without array expansion; concurrency loop rewritten to be 3.2-safe.
- **`verify-hardening.sh`: reported the HTTP version as if it were the TLS version, and never
  validated the certificate.** It printed `%{http_version}` (HTTP/1.1·2·3) labelled as TLS and ran
  everything under `-k`. Now reads `%{ssl_version}` (the real TLSv1.2/1.3 protocol), fails on weak
  TLS, and — for a bare public hostname — verifies the certificate chain without `-k`.

### Added
- `verify-crawler-ip` tests: the source-fetch-failure case as a named regression, plus 17
  IPv4/IPv6 CIDR-boundary assertions (`inCidr`/`parseIp` now exported) — the CIDR math had zero
  coverage before. Suite is 54 assertions.
- CI now runs on **ubuntu + macOS** (macOS ships Bash 3.2, so the empty-array/`set -u` traps are
  caught in CI) and adds shell smoke steps for the `.sh` tools.

### Changed
- `bot-verification.md` — documents fail-open semantics: a range list that can't be fetched is
  `unverifiable`, never `spoofed`; the verdict table clarifies "source loaded, IP absent" (spoof)
  vs "source failed to load" (unverifiable).

## [0.2.0] — 2026-08-13

First maintenance release. Adds a test suite, CI, and four references distilled from
running the skill end-to-end against a production app — and fixes a real defect in the
crawler verifier found during that run.

### Fixed
- **`verify-crawler-ip`: a UA claiming one vendor from another vendor's IP was reported `verified`.**
  Both verification paths only proved "this IP belongs to *some* known crawler" and never
  compared that against the vendor the UA *claimed*. So `Googlebot IP + GPTBot UA` and
  `GPTBot IP + ClaudeBot UA` both returned `verified` — meaning the script could not safely
  back a rate-limit allowlist. UA claims are now resolved into the same canonical vendor
  namespace as rDNS ownership and published-range membership, and compared strictly: a proven
  owner that **disagrees** with a non-null claim is `spoofed`, never `verified`. Decision logic
  extracted into pure, unit-tested functions (`uaVendor`, `decideVerdict`).

### Added
- **Test suite** (`test/`, run with `npm test`): `verify-crawler-ip.test.mjs` (35 assertions,
  including both reported spoof cases as regressions) and `robots.test.mjs` (17 assertions
  covering most-specific-group, longest-match, Allow tie-break, `*`/`$` wildcards, named-group
  precedence). Pure functions, no network.
- **CI** (`.github/workflows/ci.yml`): Node 22, runs `npm run lint` (syntax check every script +
  `bash -n`) and `npm test` on push/PR. `package.json` added with `test` / `lint` scripts.
- **`references/regression-gate.md`** — turning each fix into a machine-checked CI assertion,
  and the discipline of proving every assertion by planting the failure (so it is never vacuous).
  Elevated to the skill's third core principle.
- **`references/deploy-safety.md`** — shipping edge/proxy/WAF/container changes without an outage:
  validate a throwaway config before cutover (never after), the single-file bind-mount inode trap,
  regex-`location` `proxy_pass` rules, `add_header` non-inheritance, proving a limiter engages,
  and the healthcheck/volume/migration-credential dependencies that hardening breaks.
- **`scripts/verify-hardening.sh`** — read-only external check that the edge hardening actually
  engages: security-header matrix, tiered rate-limit (probe throttled, content not), TLS/redirect.
- **`scripts/lib/robots.mjs`** — robots.txt parse/evaluate extracted from `crawl-surface-audit.mjs`
  into a shared, testable module.

### Changed
- `enforcement-layers.md` — new §7b "Real client IP", the control that silently unblocks every
  IP-based defense: how `X-Forwarded-For` is client-forgeable, why `X-Real-IP`/exact-hop
  `trust proxy` is the fix, and how to prove it.
- `phase-5-database.md` §2 — least-privilege now includes runtime-role **verification** SQL
  (`rolsuper` must be false; `CREATE TABLE` and `COPY … TO PROGRAM` must be denied — the
  injection-to-RCE path) and the migration-vs-runtime credential split.
- `phase-4-code-audit.md` §4–5 — startup self-check must cover *every* security secret (weak
  config that boots silently is the trap), salts must not fall back to the signing key,
  `jwt.verify` must pin `algorithms`, CORS must fail closed, and CSP should ship Report-Only first.
- `SKILL.md` — third principle (regression gates), phase map entries X-7/X-8, `verify-hardening`
  in tooling, and a note that the verifier's `verified` verdict now requires UA↔owner agreement.

## [0.1.0] — 2026-08-13

### Added
- Initial public release: nine-phase web-app security & hardening program with the crawl
  boundary as a first-class concern (open to every AI crawler, closed to scanners).
- References for phases 0–8 plus crawl-boundary, bot-verification, enforcement-layers,
  exposure-checks, overlooked-surface, and aws-hardening.
- Scripts: `crawl-surface-audit.mjs`, `verify-crawler-ip.mjs`, `aws-exposure-audit.sh` (all read-only).
- `assets/scope-template.md`, bilingual README.
