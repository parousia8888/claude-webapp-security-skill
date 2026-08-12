---
name: web-app-security
description: End-to-end security program for a web app — scope/authorization gate, frontend exposure reduction, API security (IDOR/BOLA, brute force, rate limiting, race conditions), LLM security (prompt injection, jailbreak, cost abuse), OAuth/OIDC identity, server-side code audit, database isolation, supply chain (SBOM/SCA/SRI), blue-team detection, and AWS hardening. Also owns the crawl boundary — which paths must stay open to every IP including AI crawlers (Googlebot, Bingbot, GPTBot, OAI-SearchBot, ClaudeBot, Claude-User, PerplexityBot) versus what must never be crawled — and how to keep public content open while blocking malicious scanners. Use for security audits, pentest planning, hardening plans, robots.txt/sitemap/noindex policy, verifying a crawler is not a spoofed user agent, WAF or bot-blocking changes that hurt SEO/GEO traffic, leaked source maps or admin panels, IMDSv2/security-group/S3/IAM/CloudTrail review, or writing a phased remediation roadmap.
metadata:
  short-description: Phased web app security audit, hardening, and crawl-boundary program
---

# Web App Security & Hardening Program

A phased program for auditing and hardening a production web app. Phases are ordered so that cheap read-only work happens before anything that touches production, and so findings arrive in the order a small team can actually fix them.

## Capability boundary

Read [`docs/capabilities.md`](docs/capabilities.md) before describing product coverage. Keep these
categories separate in every plan and deliverable:

- **Automated and regression-tested** paths may be described as tool behavior.
- **Agent-guided methodology** requires project context and agent judgment; do not describe it as
  an automatic scan.
- **Planned** behavior is unavailable until its phase is implemented and the capability source is
  updated with regression evidence.

Classify results as `confirmed`, `suspected`, `unknown`, or `not_applicable`. Never convert a source
match or scanner lead directly to `confirmed`, and never convert unavailable evidence to a pass.

**Three things this skill insists on, because they cause most of the confusion:**

1. **Openness and defense are not opposites.** Public content must be fetchable by every IP on earth, including AI crawlers, with zero friction. Malicious scanning is stopped by *what is requested*, not by *who requests it*. See `references/crawl-boundary.md` and `references/enforcement-layers.md`.
2. **Nothing is enforced until the server enforces it.** robots.txt, minified bundles, hidden URLs, and obscure paths are not controls. Every phase below asks: which layer actually says no, and was that verified?
3. **A fix that is not a regression test rots.** An audit is a snapshot; the next refactor silently reverts it with nothing erroring. Every fix that can be quietly undone gets one machine-checked assertion, proven by planting the failure. See `references/regression-gate.md`.

## Phase map

| Phase | Focus | Active testing? | Reference |
|---|---|---|---|
| **0** | Scope and authorization anchor | gate | `references/phase-0-scope.md` |
| **1** | Frontend exposure reduction | no (read-only) | `references/phase-1-frontend.md` |
| **2** | API security, 10 stages | 🔴 yes | `references/phase-2-api.md` |
| **3** | LLM security + federated identity | 🔴 yes | `references/phase-3-llm-identity.md` |
| **4** | Server-side code audit | needs source | `references/phase-4-code-audit.md` |
| **5** | Database and data layer | 🔴 yes | `references/phase-5-database.md` |
| **6** | Supply chain | partial | `references/phase-6-supply-chain.md` |
| **7** | Blue team: detection and monitoring | no | `references/phase-7-detection.md` |
| **8** | Reporting and retest | no | `references/phase-8-report.md` |
| **X-1** | Crawl boundary: what to open, what to close | no | `references/crawl-boundary.md` |
| **X-2** | Crawler identity verification | no | `references/bot-verification.md` |
| **X-3** | Enforcement placement: open content, block scanners | no | `references/enforcement-layers.md` |
| **X-4** | Exposure sweep: maps, dotfiles, admin, share links | light probing | `references/exposure-checks.md` |
| **X-5** | AWS hardening | no (read-only API) | `references/aws-hardening.md` |
| **X-6** | Attack surface people forget | varies | `references/overlooked-surface.md` |
| **X-7** | Regression gates: freeze each fix as a CI assertion | no | `references/regression-gate.md` |
| **X-8** | Deploy safety: ship edge/config changes without an outage | no | `references/deploy-safety.md` |

🔴 = sends real requests to a live target. **Do not start any 🔴 phase before Phase 0 is complete.**

## How to run this

1. **Always start at Phase 0.** Even for the user's own property. It takes minutes, it makes the boundary explicit, and it is the difference between an audit and an incident. Copy `assets/scope-template.md` into the workspace as `scope.md` and fill it in.
2. **Do the free work first.** Phases 1, 4, X-1, X-4, X-5 and the read-only half of X-3 need no permission gate and usually surface the highest-severity findings, because misconfiguration beats exploitation.
3. **Then the 🔴 phases**, in the order 2 → 3 → 5, using non-destructive proofs (see Phase 0 §5): make an endpoint return a marker rather than real data, use accounts you created, cap request volume, never touch other users' records.
4. **Phase 7 last but continuously** — detection is what catches everything the audit missed.
5. **Phase 8 closes the loop**: every finding gets a retest, and the retest result is recorded.

Do not run all phases just because they exist. Pick from the task:

| The user says | Go to |
|---|---|
| "what should I let crawlers see", robots.txt, sitemap, noindex, llms.txt | X-1, then X-3 |
| "open to AI but block scanners" | X-3, then X-2 |
| "is this really Googlebot" / weird bot traffic | X-2 |
| "our AI/search traffic dropped" | X-3 §5, X-2, then X-1 |
| "my frontend leaks everything" | 1, then X-4 |
| "audit my API" | 0, then 2 |
| "someone could abuse my LLM endpoint" | 3 |
| "harden my AWS" | X-5 |
| "full security review" | 0 → 1 → 4 → X-4 → X-5 → 2 → 3 → 5 → 6 → 7 → 8 |
| "what am I missing" | X-6 |

## Tooling

```bash
S="${HOME}/.claude/skills/web-app-security"

# Passive crawl boundary + crawler UA matrix
node "$S/scripts/crawl-surface-audit.mjs" --site https://example.com --out ./reports/security

# Active sensitive-path probe: only after Phase 0 authorization
node "$S/scripts/crawl-surface-audit.mjs" --site https://example.com --out ./reports/security \
  --active-probe --acknowledge-authorization

# is this IP really the crawler it claims to be
node "$S/scripts/verify-crawler-ip.mjs" --ip 66.249.66.1 --ua Googlebot --ranges

# read-only AWS posture inventory
bash "$S/scripts/aws-exposure-audit.sh" --profile default --region ap-northeast-1 --out ./reports/security

# prove the edge hardening engages: header matrix, TLS policy (TLS<=1.1 refused / 1.2+ works), cert, redirect.
# PASSIVE by default (read-only). The rate-limit probe is an ACTIVE test (many concurrent requests) and
# only runs with --active-rate-limit, on a target you own.
bash "$S/scripts/verify-hardening.sh" --site https://example.com
bash "$S/scripts/verify-hardening.sh" --site https://example.com \
  --active-rate-limit --acknowledge-authorization --n 30
```

The `verify-crawler-ip` and `robots` logic is unit-tested — `npm test` in the skill repo runs both suites (including the two crawler-spoof regression cases). A `verified` verdict requires the IP's proven owner to **match the UA's claimed vendor**; a mismatch is `spoofed`, never `verified`. Add missing vendor range sources with `--source name=url` before relying on a `spoofed`/`verified` call for a vendor the script has no data for.

Crawler identity verification and AWS inventory are read-only. Crawl and edge verification are
passive by default; sensitive-path probes and rate-limit bursts are active, require Phase 0 and
must carry the explicit authorization acknowledgement flag. Any HTTP audit of a third-party host
still requires written authorization even when the request pattern is passive.

## Hard rules

- **Authorization before action.** No active testing against a host without ownership proof or written authorization. If the user asks to test something they do not control, decline and explain Phase 0.
- **Non-destructive proof.** Demonstrate a vulnerability with the smallest possible evidence — a returned marker, a status code, one record you own. Never mass-extract, never modify other users' data, never DoS to prove a rate limit is missing.
- **Never allowlist by user agent string.** Grant only on verified identity (FCrDNS or published ranges).
- **robots.txt is published intelligence, not access control.**
- **Blocking training crawlers ≠ losing search/AI visibility.** Keep those two decisions separate whenever a user conflates them.
- **Every WAF, CDN, or security-group change is also an SEO change.** Re-run the UA matrix before and after.
- **Minification is not a security boundary.** Client code always reaches the client; it raises recon cost, nothing more.
- **Secrets discipline in output.** Never print keys, tokens, cookies, auth headers, full share URLs, user emails, or real users' IPs. Report presence, status codes, counts, sanitized paths, and sanitized errors.
- **A finding is not confirmed until it is reproduced.** Scanner hits, grep matches, and AI-generated suspicions are leads. Say "unconfirmed" when it is unconfirmed.

## Output contract

Every audit deliverable states:

- **scope**: target, environment (prod vs staging), authorization basis, window, what was excluded
- **method**: which phases ran, which tools, read-only vs active
- **findings**: severity, affected component, reproduction, evidence (sanitized), the layer that should enforce it, concrete fix
- **confirmed vs suspected**, explicitly separated — never blend them
- **what this does not prove**: unreached surfaces, JS-rendered content, unauthenticated-only coverage, permissions the audit lacked
- **priority plan**: this-week / high / medium / continuous, with blast-radius notes for anything that could break live traffic or crawling
- **retest plan**: how each fix will be verified, and by whom
