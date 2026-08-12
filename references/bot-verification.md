# Verifying a crawler is who it claims to be

## The premise

A `User-Agent` header is a free-text claim set by the client. Anyone can send `Googlebot/2.1`. In real logs, a large share of "Googlebot" traffic is scanners hiding behind the one UA everyone is afraid to block.

So:

- **UA string → may be used to *deny*** (blocking `AhrefsBot` costs nothing if it lies, it just keeps crawling and gets rate-limited like anyone else).
- **UA string → must never be used to *grant***. Every allowlist, rate-limit exemption, WAF bypass, or "trusted bot" rule must key on verified identity.

Two verification methods. Use whichever the vendor supports; some support only one.

## Method 1 — Forward-confirmed reverse DNS (FCrDNS)

The standard for Google, Bing, Apple, Yandex, Baidu.

```
1. reverse-lookup the client IP        → hostname
2. check hostname ends with a vendor-owned suffix (exact label boundary!)
3. forward-resolve that hostname       → IP set
4. confirm the original IP is in that set
```

Step 3 is not optional. Reverse DNS alone is attacker-controllable if they own the PTR for their own IP; only the forward confirmation closes it. Step 2 must match on a label boundary — `evil-googlebot.com` must not pass a naive "ends with googlebot.com" test.

Vendor suffixes:

| Claimed UA | Valid rDNS suffixes |
|---|---|
| Googlebot, Google-InspectionTool, GoogleOther | `.googlebot.com`, `.google.com` |
| Google user-triggered fetchers | `.google.com`, `.googleusercontent.com` |
| Bingbot, MSNBot, BingPreview | `.search.msn.com` |
| Applebot | `.applebot.apple.com` |
| YandexBot | `.yandex.ru`, `.yandex.net`, `.yandex.com` |
| Baiduspider | `.baidu.com`, `.baidu.jp` |

## Method 2 — Vendor-published IP ranges

Required for the AI vendors, which generally do **not** provide usable rDNS.

Fetch the vendor's published JSON, cache it (refresh daily), and CIDR-match the client IP. Known publication endpoints:

| Vendor | Endpoint |
|---|---|
| Google (Googlebot) | `https://developers.google.com/static/search/apis/ipranges/googlebot.json` |
| Google (other crawlers) | `.../ipranges/special-crawlers.json` |
| Google (user-triggered) | `.../ipranges/user-triggered-fetchers.json`, `.../user-triggered-fetchers-google.json` |
| Bing | `https://www.bing.com/toolbox/bingbot.json` |
| OpenAI GPTBot | `https://openai.com/gptbot.json` |
| OpenAI OAI-SearchBot | `https://openai.com/searchbot.json` |
| OpenAI ChatGPT-User | `https://openai.com/chatgpt-user.json` |

For **Anthropic (ClaudeBot / Claude-SearchBot / Claude-User)**, **Perplexity**, **DuckDuckGo**, **Amazon** and **Meta**: these vendors publish ranges through their crawler documentation pages, and the URLs change. **Look up the current published location in the vendor's own docs before trusting any list** — do not hardcode a range you found in a blog post, and do not let this skill's list go stale. `scripts/verify-crawler-ip.mjs` accepts extra sources via `--source name=url` for exactly this reason.

Cloudflare and other CDNs also ship a "verified bot" signal derived from the same data. If you are behind such a CDN, prefer its signal over rolling your own — but confirm what it treats as verified, since some verified-bot categories include SEO scrapers you meant to block.

## Using the script

```bash
# single IP, offline (rDNS only — no network calls to vendors)
node ~/.claude/skills/webapp-exposure-hardening/scripts/verify-crawler-ip.mjs --ip 66.249.66.1 --ua "Mozilla/5.0 (compatible; Googlebot/2.1)"

# also fetch and match vendor-published ranges
node .../verify-crawler-ip.mjs --ip 20.171.207.1 --ua GPTBot --ranges

# batch from a log-derived list (one "ip<TAB>ua" or "ip" per line)
node .../verify-crawler-ip.mjs --file ./ips.txt --ranges --out ./reports/exposure

# add a source the skill does not ship
node .../verify-crawler-ip.mjs --ip 1.2.3.4 --ranges --source claude=https://vendor.example/ips.json
```

Verdicts:

| Verdict | Meaning | Action |
|---|---|---|
| `verified` | FCrDNS or published range matched the claimed vendor | may be exempted from rate limits — still never from auth |
| `spoofed` | proven owner **disagrees** with the vendor the UA claims (rDNS proves vendor B, or the IP is absent from vendor A's *successfully-loaded* range) | block, and treat every other request from that client as hostile |
| `unverifiable` | no usable signal — vendor publishes none, **or its range list could not be fetched this run** | treat as an anonymous client; rate-limit normally; do **not** block |
| `not-a-known-bot` | UA matches no known crawler | ordinary client |

## Extracting the candidates from logs

```bash
# top claimed-crawler IPs from an nginx access log (adjust field indexes to your format)
awk '$0 ~ /bot|crawler|spider|GPTBot|ClaudeBot|Perplexity/ {print $1}' access.log \
  | sort | uniq -c | sort -rn | head -50
```

Then feed the IP list to the script. Two things worth measuring on the verified set:

1. **404 ratio.** A verified crawler with a high 404 ratio means your sitemap is stale or your links are broken — a content bug, not a security one.
2. **Spoof ratio.** The share of "Googlebot" hits that fail verification tells you how much of your traffic is hostile recon, and justifies the tripwire rules in `enforcement-layers.md`.

## Traps

- **`Google-Extended` and `Applebot-Extended` are robots.txt tokens, not crawler user agents.** They will never appear in logs. Blocking them at the WAF does nothing; they are honored only by the respective vendor reading robots.txt.
- **Verification is per-request identity, not per-request intent.** A verified `Claude-User` fetch is a live human's request, not a bulk crawl — do not shape it like a crawler.
- **Never grant a verified bot access to PRIVATE paths.** Verification answers "is this really Googlebot", not "should Googlebot see this". Nothing about being a real crawler authorizes anything.
- **IPv6.** Vendor ranges include IPv6 prefixes; a matcher that only handles IPv4 will silently return `spoofed` for legitimate traffic. The bundled script handles both (with IPv4/IPv6 CIDR-boundary tests).
- **Fail open on a fetch failure, never closed.** If the vendor's published range list can't be downloaded (network blip, URL moved), the verdict must be `unverifiable`, not `spoofed`. A verifier that convicts on "we couldn't check" turns a transient outage into a wrongful block of a real crawler — an SEO self-inflicted wound. The script distinguishes "source loaded, IP absent" (spoof) from "source failed to load" (unverifiable).
- **Cache the vendor lists** and fail *open for logging, closed for privileges*: if a fetch fails, log `unverifiable` and apply normal limits rather than granting an exemption.
