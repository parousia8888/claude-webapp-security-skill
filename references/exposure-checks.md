# Exposure sweep: what leaks from a web app

Read-only checks first, then active probes (own property only). Every item below has produced a real incident somewhere.

## 1. Build and source artifacts

| Check | How | Why it matters |
|---|---|---|
| Source maps in production | `curl -sI https://site/js/app.js.map` | `*.map` reconstructs original source, comments, sometimes internal API docs and staged features |
| Raw unbundled sources served | look for `/js/*.js` unminified in the HTML | publishes the full internal API map and business logic |
| `.env`, `.env.*` | probe | credentials |
| `.git/config`, `.git/HEAD` | probe | full history can often be reconstructed |
| `.svn`, `.DS_Store`, `.idea/`, `.vscode/` | probe | path and structure disclosure |
| Backups: `*.bak .old .orig .swp .sql .zip .tar.gz` | probe common names | frequently a full DB dump |
| `package.json`, `composer.lock`, `yarn.lock` | probe | dependency versions → targeted CVE selection |
| Cache-busting query values | read HTML | `?v=signup-bonus-100` leaks internal release/feature names; use content hashes |
| Comments and debug logging | grep the shipped bundle | `console.log`, `debugLog`, TODOs naming internal hosts/endpoints |

Fix pattern: build to a `dist/` with minify + tree-shake + `drop: ['console','debugger']`, do not deploy `.map`, and `return 404` for `\.map$` and the raw source directory at the proxy.

Note honestly when reporting: **bundling is not a security boundary.** Client JS always reaches the browser. Minification raises recon cost; the actual control is that the server authorizes every request regardless of what the client knows.

## 2. Endpoints and data

- **Every route in the app's route table**, not just the ones in the sitemap. Enumerate from source; compare against the bucket worksheet in `crawl-boundary.md`.
- **Object-level authorization (IDOR/BOLA).** For each route taking an id/token: does the query filter by the caller's principal, or only by the id? Test with two accounts.
- **Mass assignment.** Does an update endpoint accept fields the caller should not set (`role`, `credits`, `isAdmin`)?
- **Verbose errors.** Stack traces, ORM errors, framework banners, DB error text in responses. Should be a generic message + server-side log id.
- **Debug/health endpoints.** `/debug`, `/status`, `/metrics`, `/actuator/*`, `/health` returning versions, env, config, or dependency URLs.
- **Public JSON that mirrors a private page.** A page can be authed while the JSON feeding it is not.
- **GraphQL introspection** enabled in production.
- **CORS.** `Access-Control-Allow-Origin: *` combined with `Allow-Credentials: true` is a serious bug; reflected-origin CORS is equally bad.
- **Enumeration oracles.** Login/register/reset responses that differ for existing vs non-existing accounts; different timing counts too.
- **Unauthenticated write paths.** Any POST/PUT/DELETE reachable without a session.

## 3. Admin and internal surfaces

- Admin panel on the same hostname (`/admin`, `/admindashboard`, `/wp-admin`): confirm it is authenticated **at the app**, not merely hidden or proxy-routed. Test with a fresh browser profile.
- Internal dashboards proxied through the public origin: confirm the proxy cannot be bypassed to reach the internal service directly (origin IP, alternate port, internal ALB DNS).
- Default credentials, or an admin account created during setup and never rotated.
- Admin panels should additionally be IP-restricted or behind SSO/VPN where operationally possible — but never *only* that.
- `X-Robots-Tag: noindex, nofollow` on all admin responses, plus no admin URL in robots.txt beyond a coarse prefix.

## 4. UNLISTED / share links

- Token entropy ≥128 bits, generated with a CSPRNG, non-sequential.
- `X-Robots-Tag: noindex, nofollow` present on the share response — verify with `curl -I`, do not assume.
- `Cache-Control: private, no-store` so CDN/proxies do not retain them.
- `Referrer-Policy: no-referrer` on the share page, so the token does not leak to any third-party link, image, or analytics beacon the page loads.
- Not in sitemap, not in `llms.txt`, not linked from PUBLIC pages.
- Search for leaks: `site:example.com inurl:/s/` in Google and Bing; check the Wayback Machine for archived token URLs.
- One-time links (reset/verify/invite): single use, short TTL, invalidated on use and on password change.

## 5. Hostnames and alternate entrances

- Every DNS record that resolves to the origin: staging, `www` vs apex, legacy domains, regional domains, `*.` wildcards.
- **Staging/preview must not be publicly reachable.** If it is, it needs its own `robots.txt` with `Disallow: /` **and** auth — robots.txt alone will not keep it out of an index once someone links it.
- Origin IP reachable directly, bypassing the CDN → all edge rules become optional. Check by requesting the origin IP with a `Host:` header for the site.
- Old/forgotten subdomains pointing at deprovisioned resources → subdomain takeover. Check every CNAME target still exists.
- Certificate Transparency logs (`crt.sh`) reveal subdomains you forgot you had. Reviewing your own CT log is a read-only, zero-risk exercise and usually surprising.

## 6. Headers to assert (PUBLIC pages)

Present:
```
Strict-Transport-Security, X-Content-Type-Options: nosniff,
Referrer-Policy, Content-Security-Policy, Permissions-Policy,
X-Frame-Options or CSP frame-ancestors
```
Absent:
```
X-Robots-Tag: noindex        (on PUBLIC — a global one deindexes the site)
Server / X-Powered-By with exact versions
X-AspNet-Version, X-Runtime, and similar stack banners
```

## 7. Third-party and supply chain

- CDN-hosted scripts without SRI (`integrity=`) and without a pinned version → the CDN is now in your trust boundary.
- Analytics/tag managers able to inject arbitrary JS into PUBLIC pages.
- Dependency CVEs: generate an SBOM, run SCA in CI.
- Typosquat/postinstall risk in the dependency tree.
- CI: long-lived cloud credentials in the runner (replace with OIDC), and workflow triggers that let a fork run privileged jobs.

## 8. What an audit does *not* prove

State this explicitly in reports:

- A `200` from your IP does not prove a crawler from its IP gets a `200` — only Search Console / Bing Webmaster live inspection proves that.
- A missing `X-Robots-Tag` on one URL does not prove the whole bucket is correct.
- No IDOR found on the sampled routes does not mean the route table is clean.
- Static analysis of robots.txt says nothing about what the WAF does.
- Content rendered by JS was not evaluated by an HTTP-only audit — and that is exactly what most AI crawlers see.
