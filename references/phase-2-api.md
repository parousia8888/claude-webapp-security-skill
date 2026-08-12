# Phase 2 — API security, 10 stages 🔴

**Gate: Phase 0 must be complete.** Use test accounts you created. Non-destructive proofs only (Phase 0 §5).

Input: the endpoint inventory from Phase 1 plus the server's route table. Test the route table, not the documentation — undocumented routes are where the bugs live.

Work each endpoint through the stages. Record for every endpoint: authenticated? authorized per-object? rate limited? idempotent? validated?

---

## Stage 1 — Inventory and recon

- Enumerate routes from source (`grep -rE "router\.(get|post|put|patch|delete)"`, or the framework's route dump), not from the client.
- Diff against the client-discovered list from Phase 1. Routes in source but not in the client are the interesting ones.
- Old API versions still mounted (`/api/v1` beside `/api/v2`) — v1 often lacks the fixes.
- Debug/admin/internal routes reachable on the public origin.
- HTTP methods per route: does `PUT`/`DELETE` exist where only `GET` was intended? Does an `OPTIONS` sweep reveal more?
- Alternate entry points: GraphQL, websocket messages, webhook receivers, file-upload callbacks, server actions. Each is an API even if it does not look like one.

Deliverable: a table of every route × method × intended auth level.

## Stage 2 — Authentication

- Every non-public route rejects a missing token, an expired token, a malformed token, and a token for a deleted/disabled user.
- **JWT**: algorithm pinned server-side (reject `none` and algorithm switching), signature verified, `exp`/`iat`/`nbf` checked, `aud`/`iss` checked, key id not attacker-controlled. Never trust a JWT's claims to decide identity without verifying the signature first.
- **Sessions**: cookie `HttpOnly; Secure; SameSite=Lax|Strict`; session rotated on login and on privilege change (fixation); server-side invalidation on logout; sessions invalidated on password change/reset.
- Refresh tokens: rotation with reuse detection; a replayed refresh token revokes the family.
- Password storage: argon2id/bcrypt/scrypt with sane parameters, never a bare hash.
- Login brute force: lockout or exponential backoff per account **and** per IP; credential-stuffing resistance (a breached-password check is cheap and effective).
- Timing/response differences that reveal whether an account exists.

## Stage 3 — Object-level authorization (BOLA / IDOR)

The single most common serious API bug. For every route that takes an identifier:

- Does the query filter by `owner == caller`, or only by `id`?
- Test: account A requests account B's resource id. Expected `404`/`403`; anything else is a finding.
- Test the same on nested resources (`/orders/:id/items/:itemId`), on `PATCH`/`DELETE` (not just `GET`), and on bulk/list endpoints with a filter parameter.
- Sequential or guessable ids make this exploitable at scale; UUIDs reduce discovery but **do not fix** the missing check.
- Share/permalink tokens: is the token itself the authorization? Then entropy and revocation are the control (see `crawl-boundary.md` UNLISTED).

Fix pattern: authorization in the data layer — every query carries the principal — rather than an `if` at the top of each handler that someone will forget.

## Stage 4 — Function-level authorization (BFLA)

- A normal user calling an admin route: expected `403`, not `200`.
- Admin routes discovered only from the bundle or from route enumeration — those are the ones missing middleware.
- Role checks present on `GET` but missing on `POST`/`DELETE` for the same resource.
- Middleware ordering: does the auth middleware actually run before the handler for *every* mount point? A route registered before the middleware silently bypasses it.
- **Coverage test, not spot check**: assert in an automated test that every route is covered by an auth middleware unless explicitly allowlisted as public. This is the only way it stays true after the next refactor.

## Stage 5 — Rate limiting and anti-automation

Per endpoint class, verify a limit exists *and* what it keys on (IP alone is bypassable; key on account + IP + device):

| Endpoint | Attack | Required control |
|---|---|---|
| login, verify-code, reset-password | credential/code brute force | per-account lockout + per-IP limit + captcha escalation |
| send-code (email/SMS) | mail/SMS bombing; vendor cost | per-recipient cap, per-IP cap, global daily cap, cooldown |
| redeem-code / gift-card | enumeration of valid codes | high entropy codes, per-account attempt cap, lockout after N failures |
| signup | mass account creation | email verification before value is granted, disposable-domain policy |
| search / list | scraping | pagination cap + per-account quota |
| expensive endpoints (LLM, export, image) | cost abuse | per-account quota + spend alarm (Phase 3, Phase 7) |

Proof pattern: send ~20 sequential wrong attempts and show none were throttled. Never run a real brute-force.

Also check: does the limit survive a changed IP (proxy pool)? Does it survive case/whitespace variants of the same email? Is the limit enforced at the edge only (bypassable if the origin is reachable directly — see `enforcement-layers.md` §6)?

## Stage 6 — Business logic, race conditions, idempotency

The bugs a scanner never finds:

- **Race / TOCTOU**: two concurrent requests both pass a "has the user already claimed this?" check. Test with two simultaneous requests on your own account; a doubled balance is the proof.
- **Idempotency**: retries and double-clicks must not double-charge or double-grant. Require an idempotency key on every value-moving operation, with a unique index enforcing it in the database.
- **Read-modify-write on balances** — must be an atomic DB operation or a transaction with the right isolation, never `read → compute → save`.
- **Replay**: can a captured request be re-sent to repeat its effect?
- **Negative / overflow values**: quantity `-1`, price `0`, huge integers, float precision on money.
- **State machine skipping**: can checkout complete without payment; can a reward be claimed before the qualifying action; can a step be re-entered?
- **Coupon/referral logic**: self-referral, stacking, reuse after refund.
- **Webhook trust**: is the payment webhook's signature verified, is the event id deduplicated, can it be replayed to credit twice?

## Stage 7 — Input handling and injection

- SQL / NoSQL injection, including operator injection in document stores (`{"$gt": ""}` as a password).
- Command injection anywhere user input reaches a shell, image processor, PDF renderer, or archive tool.
- Template injection (server-side templating with user data).
- Path traversal in any file read/write/download path, including archive extraction (zip-slip).
- XXE in XML parsers; disable external entities.
- **Mass assignment**: does an update accept `role`, `credits`, `isAdmin`, `emailVerified`? Allowlist fields explicitly; never spread the request body into a model.
- Deserialization of untrusted data.
- Unicode/normalization tricks in identity fields (emails that normalize to an existing account).
- Stored XSS via any field later rendered — including fields that only appear in the admin panel. The admin panel is a high-value XSS target precisely because nobody tests it.

## Stage 8 — SSRF and outbound requests

Any feature that fetches a URL: avatar-from-URL, webhook registration, link preview, import-from-URL, PDF/HTML renderer, image proxy.

- Block by **allowlist** of destinations, not a denylist of IPs.
- Resolve the hostname and validate the resolved IP *after* resolution, then connect to that IP (prevents DNS rebinding).
- Block private ranges, loopback, link-local (**`169.254.169.254` — cloud metadata**), IPv6 equivalents, and redirects to any of them.
- Cap redirects, timeouts, and response size.
- **IMDSv2 required on the instance** (see `aws-hardening.md` §3) so an SSRF cannot steal instance-role credentials even if it lands.

## Stage 9 — Data exposure in responses

- Over-fetching: does the user object returned to the client contain password hashes, internal flags, other users' data, or full email addresses of third parties?
- Error verbosity: stack traces, SQL text, ORM errors, file paths, framework versions.
- Aggregate endpoints leaking counts that should be private.
- PII in logs, in analytics payloads, and in URLs (query strings end up in referrers, proxies, and browser history).
- Different responses for existing vs non-existing objects, where existence is itself sensitive.
- CORS: `Allow-Origin: *` with `Allow-Credentials: true`, or origin reflection.

## Stage 10 — Resource consumption

- Pagination without a maximum `limit`.
- Unbounded query parameters (sort on an unindexed column, `include` chains, GraphQL query depth/complexity).
- File uploads: size cap, type validation by content not extension, image bomb / zip bomb limits, stored outside the web root, served with `Content-Disposition` and `nosniff`.
- Regular-expression DoS on user-supplied patterns or on your own greedy regexes.
- Requests that hold a database connection while waiting on a third party (LLM, payments) — connection-pool starvation (Phase 5).
- Body size limits at the proxy, not only in the app.

---

## Per-endpoint checklist

For each endpoint record: `auth? | object-authz? | rate-limited (keyed on?) | idempotent? | input validated? | data minimized? | resource capped?`

Any endpoint with a blank cell is untested, not passed. Say so in the report.

## Exit criteria

```
[ ] complete route inventory, source-derived, diffed against the client bundle
[ ] every route classified public / authenticated / privileged, and verified as classified
[ ] BOLA tested cross-account on GET, PATCH, DELETE for every id-taking route
[ ] automated test asserting auth-middleware coverage over the route table
[ ] rate limits verified on all six endpoint classes in Stage 5
[ ] idempotency key + unique index on every value-moving operation
[ ] race condition tested on the highest-value operation
[ ] SSRF-capable features allowlisted and IMDSv2 confirmed required
[ ] error responses generic; verbose errors only in server logs
```
