# Crawl Boundary: what to open, what to close

## 1. The three buckets

Classify every route into exactly one. If two people disagree on a route's bucket, that route is the bug.

### PUBLIC — must be fetchable by every IP, and we want it indexed

Typical members:

- marketing/landing pages, per-locale variants (`/en/`, `/zh-CN/`, `/ja/`)
- documentation, guides, resource/blog articles
- catalog / encyclopedia / reference entries (product pages, card pages, glossary)
- pricing, about, contact
- legal: privacy policy, terms, refund policy
- `robots.txt`, `llms.txt`, `sitemap*.xml`, `favicon`, `manifest.json`, OG images
- the CSS/JS/fonts/images those pages need to render

Requirements for this bucket:

- reachable with **no cookie, no JS execution, no challenge, from any ASN and any country**
- returns `200` with the substantive text **in the initial HTML**. Most AI crawlers do not execute JavaScript; a client-rendered shell is an empty page to them
- stable `<link rel="canonical">`, correct `hreflang` for locale variants
- listed in a sitemap, linked from a crawlable in-page link (not a JS-only router)
- no `X-Robots-Tag: noindex`, no `Disallow`
- excluded from IP rate limiting, bot-fight mode, JS challenge, geo blocking

### PRIVATE — only an authenticated + authorized principal, ever

Typical members:

- `/api/*` (except deliberately public read-only endpoints)
- admin panels, internal dashboards, metrics, health endpoints with detail
- account, settings, billing, invoices, order history
- anything scoped to a user id, and anything that returns another user's data if the id is changed
- build artifacts: `*.map`, `/js/` raw sources in production, `.env`, `.git/*`, backups, dumps
- staging/preview hosts

Requirements:

- **server-side authn + authz on every request**, enforced by middleware that fails closed
- object-level authorization (the classic IDOR check: does the row belong to the caller?)
- `X-Robots-Tag: noindex, nofollow` as a belt-and-braces header (cheap, harmless)
- **do not enumerate them in robots.txt** beyond one coarse prefix. `Disallow: /admin/` tells the world you have `/admin/`. If it is properly authed, `Disallow` buys you crawl-budget savings and costs you a hint — a defensible trade for `/api/`, a bad one for `/internal-tools-v2-backup/`
- prefer `404` to `403` where existence itself is sensitive

### UNLISTED — public by URL knowledge, must never be indexed

Typical members:

- share links / permalinks with a token (`/s/:token`, `/share/:id`)
- one-time links: password reset, email verification, unsubscribe, invite
- signed asset URLs
- user-generated pages the user chose not to publish

Requirements:

- token entropy ≥ 128 bits, unguessable, non-sequential
- `X-Robots-Tag: noindex, nofollow` **on the response** (the page must be fetchable for the header to be read — never `Disallow` these)
- `Referrer-Policy: no-referrer` on pages the token page links out from, so the token does not leak in `Referer` to third parties
- never in a sitemap; never in `llms.txt`; not linked from any PUBLIC page
- expiry/revocation for one-time links; single use where possible
- `Cache-Control: private, no-store` so CDNs and shared proxies do not retain them

## 2. The rule that resolves most confusion

| Goal | Wrong tool | Right tool |
|---|---|---|
| Keep data secret | `robots.txt Disallow` | authn + authz; robots.txt is advisory and public |
| Keep a reachable URL out of the index | `Disallow` | **allow the crawl** + `X-Robots-Tag: noindex` |
| Get an already-indexed URL removed | `Disallow` | allow crawl + `noindex` until it drops, *then* optionally `Disallow` |
| Stop crawl-budget waste on infinite/faceted URLs | `noindex` | `Disallow` (+ canonical, + no crawlable links to them) |
| Deduplicate near-identical URLs | `Disallow` | `rel=canonical` |
| Stop AI training on your text | WAF UA block | robots.txt group per training crawler (they are the ones that honor it); WAF only as backstop |
| Stop scrapers that ignore robots.txt | robots.txt | rate limit + WAF + verified-bot allowlist |

**The `Disallow` + `noindex` deadlock is the #1 real-world bug.** If a page is disallowed, the crawler never fetches it, never sees `noindex`, and can still list the bare URL in results because someone linked to it. Symptom: a result with a URL and no snippet, often "no information is available for this page".

## 3. Crawler roster and what each one actually does

Never assume from the name. The split that matters is **who feeds an answer engine that can cite you** vs **who only feeds training** vs **who is a live user's fetch**.

### Answer/search engines — allow if you want visibility

| UA token | Vendor | Feeds |
|---|---|---|
| `Googlebot` | Google | Google Search, AI Overviews (uses the search index) |
| `Google-InspectionTool` | Google | Search Console live tests |
| `Bingbot` | Microsoft | Bing, and Copilot's web results |
| `OAI-SearchBot` | OpenAI | ChatGPT search index |
| `Claude-SearchBot` | Anthropic | Claude search index |
| `PerplexityBot` | Perplexity | Perplexity index |
| `Applebot` | Apple | Siri, Spotlight, Apple search |
| `DuckAssistBot` | DuckDuckGo | DuckDuckGo AI answers |
| `Amazonbot` | Amazon | Alexa / Amazon search |
| `Baiduspider`, `YandexBot` | Baidu / Yandex | regional search — allow if those markets matter |

### User-triggered fetchers — a human is waiting

| UA token | Vendor |
|---|---|
| `ChatGPT-User` | OpenAI |
| `Claude-User` | Anthropic |
| `Perplexity-User` | Perplexity |

These fire when a person pastes your URL into an assistant or the assistant opens a link for them. Some vendors document that these may not consult robots.txt, because they act on a user's direct instruction. **Blocking them produces "I couldn't access that page" in front of a live user.** Treat them like a browser, not like a crawler.

### Training crawlers — a business decision, no SEO cost either way

| UA token / control | Vendor | Note |
|---|---|---|
| `GPTBot` | OpenAI | training corpus. Distinct from `OAI-SearchBot` |
| `ClaudeBot` | Anthropic | general crawler |
| `CCBot` | Common Crawl | indirectly feeds many models |
| `Bytespider` | ByteDance | aggressive; often rate-limited even when allowed |
| `meta-externalagent` | Meta | |
| `Google-Extended` | Google | **robots.txt token only, not a real UA.** Controls Gemini training/grounding. Blocking it at the WAF does nothing |
| `Applebot-Extended` | Apple | same: robots.txt token only, gates Apple model training. Does not affect `Applebot` crawling for search |

Blocking these does **not** remove you from Google/Bing/ChatGPT-search results. Allowing them does **not** buy citations. Say this plainly when a user conflates the two.

### Usually deny — no user-facing discovery value

`AhrefsBot`, `SemrushBot`, `DotBot`, `MJ12bot`, `DataForSeoBot`, `BLEXBot`, `Barkrowler`, `serpstatbot`, `PetalBot` (unless Huawei/Petal search matters), plus generic `python-requests`, `scrapy`, `curl`, `Go-http-client` on content routes.

Blocking these is a bandwidth/competitive-intel decision. It has no search cost. It also has no security value — they are the ones that will just change UA.

## 4. Writing robots.txt without shooting yourself

Rules that prevent the usual damage:

1. **Group matching is "most specific wins", not "merge".** A crawler that matches its own `User-agent:` group ignores the `User-agent: *` group entirely. So any private-path `Disallow` must be **repeated inside every named group**, or those crawlers will happily crawl what `*` forbade.
2. **One group per named agent.** Duplicate groups for the same token have undefined merge behavior across vendors.
3. `Allow` beats `Disallow` on longer-path match for Google/Bing; other crawlers vary. Don't build logic that depends on subtle precedence — restructure the paths instead.
4. `Crawl-delay` is ignored by Googlebot. Bing and Yandex honor it. Use Search Console / Bing Webmaster crawl settings for Google-side rate control.
5. **Every sitemap listed must itself be crawlable.** A `Sitemap:` line pointing at a `Disallow`ed or 404 path is a silent failure.
6. Wildcards (`*`, `$`) are supported by major crawlers but not universally. `Disallow: /*.json$` blocks nothing on crawlers without `$` support — do not rely on it for anything that matters.

### Sitemap evidence boundary

`scripts/crawl-surface-audit.mjs` treats a sitemap as confirmed evidence only after bounded XML
parsing succeeds. It supports normal escaped text, decimal/hex numeric entities and CDATA, while
rejecting DOCTYPE/entity declarations, malformed nesting, unknown entities, empty locations and
non-HTTP(S) URLs. Every sitemap, sitemap-index child and sampled `<loc>` must stay on the audited
origin. An invalid or off-origin entry produces `sitemap-parse-unknown`, queues no URLs from that
document, writes the report, and exits `3` even with `--fail-on never`. This keeps an evidence
failure distinct from both a confirmed finding and a passing audit, and prevents sitemap content
from turning the audit into an off-scope request mechanism.
7. Serve robots.txt from the **apex of every host and scheme you serve**, including `www.` and any bare-IP or alternate domain that resolves to the origin. A staging host with the production robots.txt is a common leak.
8. Changing robots.txt is a production change: keep it in version control, diff it in review, and re-run the audit script after deploy.

Skeleton:

```
# 1. Baseline for everyone
User-agent: *
Allow: /
Disallow: /api/
Disallow: /admin/
Disallow: /s/

# 2. Repeat the private rules inside every named group you add.
User-agent: Googlebot
Allow: /
Disallow: /api/
Disallow: /admin/
Disallow: /s/

# ...same block for Bingbot, OAI-SearchBot, ChatGPT-User, GPTBot,
#    Claude-SearchBot, Claude-User, ClaudeBot, PerplexityBot, Applebot

# 3. Training opt-outs are separate lines, only if that is the decision.
User-agent: Google-Extended
Disallow: /

# 4. Deny SEO scrapers.
User-agent: AhrefsBot
Disallow: /

Sitemap: https://example.com/sitemap.xml
```

## 5. llms.txt — what it is and is not

`llms.txt` is an informational map for automated readers: a short description of the site plus a curated URL list. It is **not** a ranking directive, **not** an access control, and **not** honored as policy by any major crawler. It is cheap and occasionally useful for AI retrieval.

Rules:

- everything you list must be in the PUBLIC bucket, `200`, and indexable. Auditing this is worth it — an UNLISTED or PRIVATE URL leaking into `llms.txt` is a real disclosure
- keep it consistent with the sitemap; a URL in one and not the other is a smell
- no tokens, no query strings with parameters, no staging hosts
- do not put policy statements there and assume they bind anyone

## 6. Bucket worksheet

Fill this in from the route table, not from the sitemap — the sitemap only shows what you remembered to list.

| Route pattern | Bucket | Auth required? | Indexable? | In sitemap? | `X-Robots-Tag` | Enforcing layer | Verified how |
|---|---|---|---|---|---|---|---|
| `/`, `/:locale/` | PUBLIC | no | yes | yes | — | — | UA matrix 200 |
| `/:locale/resources/*` | PUBLIC | no | yes | yes | — | — | UA matrix 200 |
| `/api/*` | PRIVATE | yes | no | no | noindex | app middleware | 401 unauth |
| `/admindashboard*` | PRIVATE | yes | no | no | noindex | nginx + app | 401/404 unauth |
| `/s/:token` | UNLISTED | no | **no** | no | noindex | app header | header present |
| `*.map`, `/js/` (prod) | PRIVATE | n/a | no | no | — | nginx `return 404` | 404 |

Red flags to look for while filling it in:

- a row where "Auth required? = no" and the content is user-specific → IDOR risk
- a row where "Indexable? = no" and the enforcement is only robots.txt → not enforced
- a row in the sitemap that is not PUBLIC → leak
- a PUBLIC row sitting behind a rate limit or challenge → SEO/GEO outage risk
