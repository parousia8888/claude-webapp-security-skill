# Enforcement: open to crawlers, closed to scanners

The goal is not "let bots in" or "keep bots out". It is: **serve PUBLIC content to every IP with no friction, while a scanner probing for holes gets stopped within a handful of requests.**

Those two are compatible because crawlers and scanners request *different things*. Classify on behavior, not identity.

## 1. The core split

| | Content class | Probe class |
|---|---|---|
| What it requests | URLs that exist: sitemap entries, linked routes, static assets | URLs that do not exist, or that only an attacker would guess |
| 404 ratio | near 0% | 60–100% |
| Path shape | your route patterns | `.env`, `.git/config`, `wp-login.php`, `/phpmyadmin`, `*.sql`, `/api/v1/keys`, `.aws/credentials`, `*.bak` |
| Methods | GET/HEAD | plus PROPFIND, PUT, TRACE, OPTIONS sweeps |
| Correct response | 200, fast, no challenge, no limit that a crawler could hit | throttle immediately, then block; never a helpful error |

**A real crawler almost never 404s.** It fetches what your sitemap and links told it about. So a per-client 404-rate trigger is the highest-signal, lowest-false-positive scanner detector you can deploy, and it costs your SEO exactly nothing.

## 2. Layer placement

Each rule belongs at exactly one layer. Duplicated rules across layers are how "we blocked GPTBot and nobody knows where" happens.

| Layer | Owns | Must NOT do |
|---|---|---|
| **CDN / WAF (CloudFront+AWS WAF, Cloudflare)** | volumetric rate limits, geo/ASN policy for probe class, managed rule sets, bot tripwires, TLS, caching of PUBLIC | never apply a JS challenge, CAPTCHA, or "bot fight mode" to PUBLIC content paths |
| **Origin lock** | only the CDN may reach the origin (OAC / prefix list / shared secret header) | never leave the origin IP reachable directly on 80/443 |
| **nginx / reverse proxy** | path-regex tripwires, `limit_req` zones per path class, `return 404` for maps/dotfiles/raw sources, real-client-IP recovery, security headers | never implement business authorization here |
| **App** | authn, object-level authz, per-account quotas, `X-Robots-Tag`, canonical, CSRF, input validation | never rely on the proxy having filtered anything |
| **AWS network** | security groups, private subnets for DB, no public DB ports | never be the only thing stopping app-layer abuse |

## 3. Rate limiting that does not kill SEO

Three separate budgets. Do not use one global limit.

**A. Content class — generous, per-client, path-scoped**
- Limit high enough that a fast crawler never trips it (Googlebot can burst; Bingbot honors `Crawl-delay`; Bytespider will not).
- **Exempt forward-confirmed verified crawlers entirely** (see `bot-verification.md`). Exempt by verified identity, never by UA string.
- If a crawler does need slowing: use Search Console / Bing Webmaster crawl-rate settings, or `Crawl-delay` for the ones that honor it — not a 429 wall. Sustained 429/503 to Googlebot reduces crawl rate for weeks.
- Prefer `503` + `Retry-After` over `403` if you must shed crawler load: `403` reads as "this is permanently forbidden".

**B. Probe class — hair trigger**
```nginx
limit_req_zone $binary_remote_addr zone=scanner_probe:10m rate=30r/m;

# dotfiles and credential-ish names
location ~* ^/(?:.*/)?(?:\.env|\.git|\.ssh|\.aws|\.svn|\.htpasswd)(?:[/._-]|$) {
    limit_req zone=scanner_probe burst=5 nodelay;
    return 404;
}
# tech-stack probes for a stack you do not run
location ~* \.(?:php[0-9~]?|phtml|asp|aspx|jsp|bak|old|orig|swp|sql|sqlite|db|dump|zip|rar|7z|tar|gz|tgz)$ {
    limit_req zone=scanner_probe burst=5 nodelay;
    return 404;
}
# build artifacts and raw sources in production
location ~ \.map$ { return 404; }
```
Return `404`, not `403`. `403` confirms the path is special.

**C. Expensive endpoints — per-account quota, not per-IP**
LLM calls, search, image generation, email/SMS sends, PDF export. IP limits are trivially bypassed with a proxy pool; the real control is a per-user and per-day quota enforced in the app, plus a hard spend alarm (see `aws-hardening.md` §7).

## 4. Scanner detection signals, in order of value

1. **404 ratio per client over a rolling window.** ≥10 404s in 60s, or ≥80% 404 over ≥20 requests → throttle, then block for an hour. Practically zero false positives against real crawlers.
2. **Sensitive-path tripwire.** One request to `.env`, `.git/config`, `wp-login.php`, `/actuator/env`, `/phpmyadmin` → immediate block. No legitimate client ever asks for these on a site that does not have them.
3. **Honeypot path.** Add a path to robots.txt `Disallow:` that is linked nowhere and does not exist as a real route. Any client fetching it either ignored robots.txt or is enumerating — block on first hit. Note: harmless to `ChatGPT-User`/`Claude-User`, since those only fetch URLs a human handed them.
4. **UA claims a verified crawler but fails rDNS.** High-confidence malicious; block and log. This is the single most common scanner disguise.
5. **Method/protocol anomalies.** PROPFIND, TRACE, raw-IP `Host:` header, absent `Host`, HTTP/1.0 with no UA.
6. **Parameter fuzzing.** Same path, many distinct query keys; `../`, `%00`, `UNION SELECT`, `<script`, `${jndi:` in any parameter.
7. **Distributed low-and-slow.** One request per IP across a large subnet, same UA and same path sequence. Needs ASN-level or fingerprint-level correlation at the CDN — this is the case where a managed WAF rule set earns its cost.

## 5. Rules for not breaking crawlers

- **Never geo-block or ASN-block PUBLIC content paths.** Crawlers come from cloud ASNs worldwide; AI fetchers come from datacenter IPs that look exactly like "bad" traffic.
- **Never require cookies, JS, or a challenge to read PUBLIC content.** Most AI crawlers do not execute JS and drop the page.
- **Never serve different content to a crawler UA than to a browser.** That is cloaking; it is a manual-action risk with Google, and it silently breaks AI retrieval. If your audit shows a size delta between UA fetches, that is a finding, not a feature.
- **Watch out for managed "AI bot blocking" toggles.** Cloudflare's bot-fight / AI-scraper controls and some WAF managed rule groups block AI crawlers by default. This is the most common cause of "our GEO traffic died and nobody changed anything". Check it explicitly whenever AI referral traffic drops.
- **Every WAF/bot/rate-limit change is an SEO change.** Before/after: run the UA matrix in `scripts/crawl-surface-audit.mjs` and diff.

## 6. Prerequisites that make all of the above real

- **Recover the real client IP.** Behind CloudFront/Cloudflare/ALB the origin sees the proxy's IP unless configured. Every rate limit and every log line is meaningless until this is right.
  - nginx + Cloudflare: `real_ip_header CF-Connecting-IP;` plus `set_real_ip_from` for each published Cloudflare range.
  - nginx + CloudFront/ALB: `real_ip_header X-Forwarded-For;` with `set_real_ip_from` for the trusted proxy CIDRs only. **Never trust `X-Forwarded-For` from an untrusted source** — it is client-controlled and lets an attacker forge any IP, bypassing every per-IP limit.
- **Origin lock.** If the origin IP is reachable directly, every edge rule is optional from an attacker's point of view. Restrict origin security groups to the CDN's published prefix list, and/or require a secret header the CDN injects.
- **Log what you need to decide**: timestamp, real client IP, method, path, status, UA, bytes, response time, and the verified-bot verdict. Without status + path you cannot compute 404 ratio; without the verdict you cannot tell Googlebot from someone claiming to be Googlebot.

## 7. Security headers for PUBLIC pages

Set these; none of them hurt crawling:

```
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
X-Content-Type-Options: nosniff
X-Frame-Options: SAMEORIGIN            # or CSP frame-ancestors
Referrer-Policy: strict-origin-when-cross-origin   # no-referrer on UNLISTED pages
Content-Security-Policy: ...           # start report-only, then enforce
Permissions-Policy: geolocation=(), camera=(), microphone=()
```

Notes:
- A CSP does not affect crawlers, which do not execute your scripts. Ship it.
- Do **not** send `X-Robots-Tag: noindex` from a global middleware "for safety" — it is the fastest way to deindex a whole site. Scope it to PRIVATE and UNLISTED responses only, and assert its absence on PUBLIC in the audit.
- CORS is not access control. `Access-Control-Allow-Origin: *` on a PUBLIC JSON feed is fine; on anything cookie-authenticated it is a vulnerability.

## 7b. Real client IP — the control that silently unblocks every IP-based defense

Rate limits, per-IP throttles, IP-hash analytics, geo/ASN rules — all of them are only as trustworthy as the IP the app believes a request came from. Get this wrong and every one of them is bypassable by setting a header, with nothing in the logs to show for it. This is a common, high-impact, and quiet bug.

**The trap.** Behind a proxy, `X-Forwarded-For` is a *chain* the client can prepend to. The proxy appends the real peer at the **end**; the client controls the **front**. So:
- Node/Express `app.set('trust proxy', true)` makes `req.ip` read the **left-most** (client-controlled) XFF entry.
- Any code doing `xff.split(',')[0]` takes the same forgeable value.

Result: `curl -H 'X-Forwarded-For: 1.2.3.4'` gives every request a fresh "IP", so per-IP rate limits never accumulate and IP-based analytics can be poisoned to arbitrary values.

**The fix — trust exactly the hops you control, and no more.**
- At the proxy, *set* (overwrite, don't append) a header from the connection's real peer:
  ```nginx
  proxy_set_header X-Real-IP $remote_addr;   # overwrites any client-sent X-Real-IP
  ```
  `$remote_addr` is the TCP peer nginx sees — the client cannot forge it. Direct-connect → true client; behind a CDN → the CDN egress (stable, still unforgeable). The app then reads **only** this header.
- If you must rely on Express's `req.ip`, set `trust proxy` to the **exact hop count** (`1` for one nginx in front, `2` if a gateway/CDN adds another), never `true`. With a correct count, `req.ip` reads the entry the trusted hop appended, not the client's prepended one.
- Behind Cloudflare specifically: trust `CF-Connecting-IP` and restrict the origin to Cloudflare's ranges (`enforcement-layers.md` §2 origin lock), or the header is spoofable by hitting the origin directly.

**Prove it.** Send the same request several times with different forged `X-Forwarded-For` values and confirm they all resolve to one real source (in logs, in the rate-limit bucket key, or in the analytics row) — not to the forged values. A behavioural regression test on the IP-deriving function belongs in the gate (`regression-gate.md`): feed it a real `X-Real-IP` plus a forged `X-Forwarded-For` and assert it returns the former.

## 8. Verification checklist after any change

1. `curl -sI https://site/` as a plain browser UA → `200`, no `noindex`.
2. Same for `Googlebot`, `Bingbot`, `OAI-SearchBot`, `GPTBot`, `Claude-SearchBot`, `Claude-User`, `PerplexityBot` → all `200`, body size within a few percent of the browser fetch.
3. `robots.txt`, `llms.txt`, every `Sitemap:` URL → `200`.
4. A random `/does-not-exist-<rand>` → `404` (not a soft-200, not a 500).
5. Ten rapid `.env` probes → throttled/blocked, all `404`.
6. A PRIVATE path with no auth → `401`/`404`, never a partial render.
7. A known UNLISTED URL → `200` **with** `X-Robots-Tag: noindex`.
8. Search Console / Bing Webmaster: run a live URL inspection on one PUBLIC page. It is the only check that proves the real crawler, from its real IP, is not being blocked.
