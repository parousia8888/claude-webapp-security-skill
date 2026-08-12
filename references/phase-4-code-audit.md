# Phase 4 — Server-side code audit (needs source, no active testing)

Static analysis is a lead generator, not a verdict. Every hit is triaged by hand; every finding is confirmed by reading the code path from entry to sink. Report unconfirmed hits as unconfirmed.

## 1. Automated sweep

```bash
# OWASP + language rule packs
semgrep --config p/owasp-top-ten --config p/secrets --config p/javascript --error .

# secrets across full history, not just the working tree
gitleaks detect --source . --redact
trufflehog filesystem . --only-verified

# dependency CVEs (also Phase 6)
npm audit --production
osv-scanner -r .
```

Notes that save time:
- Run secret scanning over **git history**. A key removed in a later commit is still published.
- Exclude `node_modules`, `dist`, and vendored code from the app-code rules, or triage drowns.
- Add a `semgrep --config p/ci` gate in CI so new instances are caught at review time, not at audit time.

## 2. Dangerous sinks — grep-able starting points

```bash
grep -rnE "\b(eval|new Function|child_process|execSync|exec\(|spawn\()" --include=*.js src/
grep -rnE "(readFile|createReadStream|sendFile|unlink)\(.*(req\.|params|query|body)" --include=*.js src/
grep -rnE "(fetch|axios|got|request)\(.*(req\.|params|query|body)" --include=*.js src/   # SSRF
grep -rnE "\$where|mapReduce|\\.aggregate\(.*(req\.|body)" --include=*.js src/           # NoSQL
grep -rnE "innerHTML|dangerouslySetInnerHTML|v-html" --include=*.js src/                 # XSS sinks
grep -rnE "JSON\.parse\(.*(req\.|body)" --include=*.js src/
```

For each hit, answer: does untrusted input reach it, is it validated, is the validation an allowlist?

## 3. Authorization coverage — the highest-value manual review

This is where real audits find real bugs.

1. Dump the route table.
2. For each route, identify the middleware chain that actually applies (mount order matters — a route registered before `app.use(auth)` is public).
3. Classify: public / authenticated / privileged.
4. For every authenticated route taking an id, confirm the **query itself** is scoped to the caller, not just an `if` at the top of the handler.
5. Write a test that fails when a new route appears without an auth decision:

```js
// pseudo: every route must be public-allowlisted or auth-covered
for (const route of listRoutes(app)) {
  assert(PUBLIC_ALLOWLIST.has(route.key) || hasAuthMiddleware(route),
    `route ${route.key} has no auth decision`);
}
```

That test is worth more than any scanner, because it holds after the next refactor.

## 4. Secret handling review

- No secrets in the repo, in history, in build artifacts, in container images, in user-data, in CI logs.
- Loaded from environment or a secret manager at runtime; `.env` present in `.gitignore` **and** confirmed absent from history.
- Secrets never logged: check log statements that dump whole request objects, config objects, or error objects containing headers.
- Distinct credentials per environment; production secrets not readable by developers by default.
- Rotation path documented for each secret, including third-party API keys.
- **Startup self-check covers *every* security secret, not just the obvious ones.** A weak or missing secret that boots silently is the trap: teams validate `JWT_SECRET` and forget the QR/venue-token signing key, the webhook HMAC, the fingerprint/PII salt. Fail the boot in production if any is `<32` chars or absent — a signing secret that is weak but present is invisible until it is forged.
- **Derived-secret salts must not fall back to the signing key.** A fallback chain like `FINGERPRINT_SALT ?? JWT_SECRET` couples two independent secrets: if the hashes (and their inputs) ever leak they become an offline oracle against the signing key. Watch for fallbacks to a *non-existent* env var too — `?? config.get('JWT_SECRET')` where the real name is `JWT_ACCESS_SECRET` silently lands on the next fallback (often a hardcoded default), so an IP/PII hash ends up salted with a value the whole world knows.

## 5. Framework and configuration review

- Security middleware present and correctly ordered: helmet-style headers, body size limits, CORS policy, CSRF for cookie-authenticated state changes.
- **JWT verification pins `algorithms`.** `jwt.verify(t, secret)` without an explicit `algorithms: ['HS256']` (or the RS variant) leaves the alg-confusion door ajar; harmless with a string secret today, a footgun the day someone adds an asymmetric key.
- **CORS fails closed.** `origin: process.env.CORS_ORIGIN?.split(',') ?? true` reflects *any* origin when the env var is unset — one forgotten variable turns a control off. In production, missing config should be `origin: false`, not `true`.
- **CSP disabled "temporarily"** is a standing finding — check `contentSecurityPolicy: false` and similar. When enabling CSP on a live app, ship it **`Content-Security-Policy-Report-Only` first**: a mis-scoped enforced policy white-screens the SPA (inline scripts, Google GSI/Fonts/Maps), whereas Report-Only observes violations without blocking. Promote to enforced once the violation stream is clean.
- Cookie flags set centrally, not per-route.
- Trust-proxy setting correct: too permissive and `X-Forwarded-For` becomes attacker-controlled (breaks every rate limit); absent and you rate-limit the CDN.
- Error handler: no stack traces to clients; unhandled rejection and uncaught exception handlers present.
- Debug/dev routes and seed scripts not reachable in production builds.
- Default admin/seed accounts removed.

## 6. Data-flow review for the top 3 assets

Pick the three things whose compromise hurts most (money ledger, user identity, model access). For each, trace end to end:

entry point → validation → authorization → storage → retrieval → rendering → logging → backup

Ask at each hop: who can reach this, what is checked, and what happens if the previous hop lied.

## 7. Triage and reporting

For each candidate finding record: file:line, entry point, sink, whether untrusted input demonstrably reaches it, exploitability, and fix. Mark `confirmed` only when the path is proven by reading it or by a Phase 2 test.

Rank by exploitability × blast radius, not by scanner severity.

## Exit criteria

```
[ ] semgrep OWASP + language + secrets packs run; all hits triaged
[ ] secret scan over full git history; any historical key rotated
[ ] route-table auth coverage reviewed and locked in by a test
[ ] dangerous sinks enumerated and each traced to its input source
[ ] trust-proxy, CORS, CSRF, cookie flags, error handler verified
[ ] CSP enabled or a dated plan recorded
[ ] top-3 asset data flows traced end to end
[ ] semgrep wired into CI as a gate
```
