# Changelog

All notable changes to **webapp-security-hardening** are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

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
