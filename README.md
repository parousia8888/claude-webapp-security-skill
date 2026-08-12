# Web App Security & Hardening — a Claude Code skill

**English** · [中文](README.zh-CN.md)

Take a web app from *never audited* to *hardened*, in nine phases — with the crawl boundary settled instead of guessed.

Let every AI crawler in. Keep every scanner out. Those two goals are compatible, and this skill shows exactly how.

[Install](#install) · [When it loads](#when-an-agent-should-load-this-skill) · [The idea](#the-idea-worth-stealing) · [Phase map](#phase-map) · [Scripts](#the-scripts) · [Limits](#what-this-skill-will-not-do) · [Repo map](#repository-map)

---

## Table of contents

- [What this is](#what-this-is)
- [Install](#install)
- [When an agent should load this skill](#when-an-agent-should-load-this-skill)
- [The idea worth stealing](#the-idea-worth-stealing)
- [Phase map](#phase-map)
  - [Phase 0–8](#phase-map)
  - [Cross-cutting guides](#cross-cutting-usable-on-their-own)
- [The scripts](#the-scripts)
  - [crawl-surface-audit.mjs](#crawl-surface-auditmjs)
  - [verify-crawler-ip.mjs](#verify-crawler-ipmjs)
  - [aws-exposure-audit.sh](#aws-exposure-auditsh)
- [What this skill will not do](#what-this-skill-will-not-do)
- [Repository map](#repository-map)
- [Contributing](#contributing)
- [License](#license)

---

## What this is

- **A phased audit program** — scope gate → frontend → API → LLM & identity → code → database → supply chain → detection → retest. Each phase is a reference file with concrete checks, test procedures, and exit criteria.
- **Three read-only audit scripts** — a crawl-surface auditor with a crawler user-agent matrix, a crawler identity verifier (FCrDNS + vendor IP ranges), and an AWS posture inventory.
- **A decision model for the crawl boundary** — which paths must stay open to Googlebot, Bingbot, GPTBot, OAI-SearchBot, ClaudeBot, Claude-User and PerplexityBot, which must never be crawled, and which layer actually enforces that.

Written for an agent to execute and for a human to review. No dependencies beyond Node 18+ and, optionally, the AWS CLI.

[↑ back to top](#web-app-security--hardening--a-claude-code-skill)

---

## Install

```bash
# Claude Code
git clone https://github.com/parousia8888/claude-webapp-security-skill \
  ~/.claude/skills/webapp-security-hardening

# Codex
git clone https://github.com/parousia8888/claude-webapp-security-skill \
  ~/.codex/skills/webapp-security-hardening
```

The directory name must be `webapp-security-hardening` — it has to match the `name:` field in `SKILL.md`.

Then ask your agent something like *"audit what my site exposes"* or *"harden my AWS account"*. The skill loads on its own.

To run the scripts directly, no agent required:

```bash
node ~/.claude/skills/webapp-security-hardening/scripts/crawl-surface-audit.mjs --site https://example.com --out ./reports
node ~/.claude/skills/webapp-security-hardening/scripts/verify-crawler-ip.mjs --ip 66.249.66.1 --ua Googlebot --ranges
bash  ~/.claude/skills/webapp-security-hardening/scripts/aws-exposure-audit.sh --profile default --region us-east-1
```

[↑ back to top](#web-app-security--hardening--a-claude-code-skill)

---

## When an agent should load this skill

```yaml
load_when:
  - user asks for a security audit, pentest plan, or hardening roadmap for a web app
  - user asks what should be crawlable, or mentions robots.txt / llms.txt / sitemap / noindex
  - user wants AI crawlers allowed but scanners blocked
  - search or AI-referral traffic dropped after a WAF, CDN, or bot-blocking change
  - user asks whether a crawler hitting their site is really Googlebot / GPTBot
  - a private page, admin panel, source map, or share link was found indexed or exposed
  - user asks about IDOR, BOLA, brute force, rate limiting, race conditions, or SSRF
  - user asks about prompt injection, LLM cost abuse, or OAuth token confusion
  - user asks to harden AWS: security groups, IMDSv2, S3 public access, IAM, CloudTrail, budgets
do_not_load_when:
  - the task is writing application features with no security question attached
  - the target is a third party the user does not control
```

[↑ back to top](#web-app-security--hardening--a-claude-code-skill)

---

## The idea worth stealing

Most "what do I open to bots" confusion comes from making one decision where there are two.

**Decide by path first, by bot second.**

| Bucket | Who may fetch it | What enforces that |
|---|---|---|
| **PUBLIC** | every IP, no cookie, no JS, no challenge | nothing — and that is the point. A rate limit here is an SEO outage waiting to happen |
| **PRIVATE** | only an authenticated, authorized principal | server-side authn + authz. Never robots.txt |
| **UNLISTED** | anyone with the URL, but never indexed | `X-Robots-Tag: noindex` + a high-entropy token. Never `Disallow` |

Consequences that resolve most of the pain:

- **`robots.txt` is not access control.** It is a published list of paths you consider interesting. Treat every line as intelligence you handed an attacker.
- **`Disallow` + `noindex` on the same path is a deadlock.** A crawler that obeys `Disallow` never fetches the page, so it never reads the `noindex`, so a linked URL can stay indexed forever with no snippet. Pick one.
- **Blocking training crawlers does not reduce search or AI-citation visibility.** `GPTBot` is training; `OAI-SearchBot` is the search index. `ClaudeBot` is the general crawler; `Claude-SearchBot` and `Claude-User` are search and live-user fetches. Separate decisions, constantly conflated.
- **Never block user-triggered fetchers** (`ChatGPT-User`, `Claude-User`, `Perplexity-User`) — a human is waiting on the other end and will see a broken site.
- **`Google-Extended` and `Applebot-Extended` are robots.txt tokens, not user agents.** Blocking them at your WAF does nothing.

And the part that makes openness safe:

> **Crawlers and scanners request different things.** A real crawler almost never 404s — it fetches what your sitemap and links told it about. A scanner 404s on 60–100% of its requests. So per-client 404 rate is the highest-signal, lowest-false-positive scanner detector available, and it costs your SEO exactly nothing.

[↑ back to top](#web-app-security--hardening--a-claude-code-skill)

---

## Phase map

| Phase | Focus | Active testing | Reference |
|---|---|---|---|
| 0 | Scope and authorization anchor | gate | [`phase-0-scope.md`](references/phase-0-scope.md) |
| 1 | Frontend exposure reduction | no | [`phase-1-frontend.md`](references/phase-1-frontend.md) |
| 2 | API security, 10 stages | yes | [`phase-2-api.md`](references/phase-2-api.md) |
| 3 | LLM security + federated identity | yes | [`phase-3-llm-identity.md`](references/phase-3-llm-identity.md) |
| 4 | Server-side code audit | needs source | [`phase-4-code-audit.md`](references/phase-4-code-audit.md) |
| 5 | Database and data layer | yes | [`phase-5-database.md`](references/phase-5-database.md) |
| 6 | Supply chain | partial | [`phase-6-supply-chain.md`](references/phase-6-supply-chain.md) |
| 7 | Blue team: detection and monitoring | no | [`phase-7-detection.md`](references/phase-7-detection.md) |
| 8 | Reporting and retest | no | [`phase-8-report.md`](references/phase-8-report.md) |

### Cross-cutting, usable on their own

| Topic | Reference |
|---|---|
| What to open, what to close; robots.txt, llms.txt, sitemap, noindex | [`crawl-boundary.md`](references/crawl-boundary.md) |
| Proving a crawler is not a spoofed user agent | [`bot-verification.md`](references/bot-verification.md) |
| Where each rule belongs: CDN, WAF, nginx, app | [`enforcement-layers.md`](references/enforcement-layers.md) |
| Source maps, dotfiles, admin panels, share links | [`exposure-checks.md`](references/exposure-checks.md) |
| AWS: security groups, IMDSv2, S3, IAM, CloudTrail, budgets | [`aws-hardening.md`](references/aws-hardening.md) |
| Attack surface that checklists usually miss | [`overlooked-surface.md`](references/overlooked-surface.md) |
| The Phase 0 authorization anchor, ready to copy | [`assets/scope-template.md`](assets/scope-template.md) |

A sample of what Phase 2 alone covers, so the depth is visible: route inventory from source rather than docs, JWT `aud`/`iss`/algorithm verification, cross-account BOLA on `GET`/`PATCH`/`DELETE`, auth-middleware coverage as an automated test, six classes of rate limit keyed on more than IP, race conditions and idempotency keys backed by database unique constraints, SSRF allowlists with post-resolution IP validation, and response data minimization.

[↑ back to top](#web-app-security--hardening--a-claude-code-skill)

---

## The scripts

### `crawl-surface-audit.mjs`

Parses `robots.txt`, `llms.txt` and every declared sitemap, cross-checks them against live responses, then replays key URLs across eleven crawler user agents to catch WAF blocking and cloaking.

```
# Crawl surface audit — https://example.com

**Findings:** 1 high · 1 medium · 0 low · 3 info

- **[high] source-map-exposed** — A production source map is publicly served;
  it reconstructs original sources and comments.
- **[medium] soft-404-catchall** — A non-existent path returns 200 with the app
  shell instead of 404. Crawlers index and re-crawl garbage URLs, real 404s become
  invisible, and the highest-signal scanner-detection rule (404 ratio per client)
  stops working.

## UA matrix — https://example.com/

| Agent | Status | Bytes | X-Robots-Tag |
|---|---|---|---|
| browser | 200 | 47768 | — |
| Googlebot | 200 | 47768 | — |
| OAI-SearchBot | 200 | 47768 | — |
| GPTBot | 200 | 47768 | — |
| Claude-User | 200 | 47768 | — |
| PerplexityBot | 200 | 47768 | — |
```

A status or size that differs by user agent *is* the finding: `403` means your edge is blocking a crawler, a size delta means you are cloaking.

### `verify-crawler-ip.mjs`

A user agent string is a claim, not an identity. This does forward-confirmed reverse DNS for Google, Bing, Apple, Yandex and Baidu, and CIDR-matches vendor-published prefix lists for the AI crawlers. IPv4 and IPv6.

```
| IP              | Claimed UA   | Verdict     | Vendor  | Method          |
|-----------------|--------------|-------------|---------|-----------------|
| 66.249.66.1     | Googlebot    | verified    | google  | fcrdns          |
| 203.0.113.9     | Googlebot    | **spoofed** | google  | fcrdns          |
| 20.171.207.1    | GPTBot/1.1   | verified    | gptbot  | published-range |
```

Rule enforced throughout: a user agent may be used to **deny**, never to **grant**. Allowlist on verified identity only — and `verified` buys a rate-limit exemption, never access to a private path.

### `aws-exposure-audit.sh`

Read-only `describe`/`list`/`get` calls across identity, network, compute, storage, databases, edge and logging. Checks that fail for lack of permission are reported as `UNCHECKED`, never as passing — an audit that silently drops a check is worse than no audit.

```
- **[HIGH]** no account-level S3 Block Public Access configuration exists
- **[HIGH]** instance `i-0abc…` allows IMDSv1 — any SSRF can steal its role credentials
- **[MED]**  no AWS Budgets configured — for an AI product, spend is the earliest abuse alarm
- [ok] CloudTrail `mgmt-trail` is logging

- HIGH: 1 · MEDIUM: 3 · LOW: 3 · UNCHECKED: 0
```

[↑ back to top](#web-app-security--hardening--a-claude-code-skill)

---

## What this skill will not do

Stated up front, because a security tool that will do anything on request is itself a risk.

- **No active testing without an authorization anchor.** Phase 0 requires a `scope.md` and proof of ownership — a `.well-known` token, a DNS TXT record, or demonstrated control-plane access — before a single active request. Testing a host the user does not control is refused.
- **No destructive proof.** Every finding is demonstrated with the weakest sufficient evidence: one record you own, a returned marker, a status code. Never bulk extraction, never another user's data, never denial-of-service to prove a rate limit is missing.
- **No secrets in output.** Reports carry presence, status codes, counts and sanitized paths — never tokens, cookies, auth headers, full share URLs, user emails, or real client IPs.
- **A finding is not confirmed until it is reproduced.** Scanner hits and grep matches are leads, and the report says so.

Every audit deliverable ends with an explicit *what this does not prove* section: unreached surfaces, JavaScript-rendered content that an HTTP-only audit never evaluated, and checks the credentials could not perform.

[↑ back to top](#web-app-security--hardening--a-claude-code-skill)

---

## Repository map

```
SKILL.md                  entry point; phase map and hard rules
references/               nine phase guides + six cross-cutting guides
scripts/
  crawl-surface-audit.mjs robots/llms/sitemap audit + crawler UA matrix + exposure probes
  verify-crawler-ip.mjs   FCrDNS and published-range crawler verification
  aws-exposure-audit.sh   read-only AWS posture inventory
assets/scope-template.md  the Phase 0 authorization anchor to copy into your repo
llms.txt                  machine-readable summary of this repository
```

[↑ back to top](#web-app-security--hardening--a-claude-code-skill)

---

## Contributing

Corrections are especially welcome on the three things that go stale fastest: vendor crawler user agents, vendor published IP-range endpoints, and AWS service defaults. `verify-crawler-ip.mjs` takes `--source name=url` so a new vendor list can be used without waiting for a release.

## License

MIT.
