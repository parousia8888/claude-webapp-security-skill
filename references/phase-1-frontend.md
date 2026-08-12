# Phase 1 — Frontend exposure reduction (read-only, no gate)

Attacker's first move is reading your client bundle. This phase asks: **what does the browser tell an attacker that it did not have to?**

Calibration up front, and say it plainly in any report: **client code is not a secret and bundling is not a security boundary.** Everything shipped to the browser is readable. The value of this phase is (a) removing things that should never have been client-side at all, and (b) raising recon cost so the attacker's map of your API is not handed to them pre-drawn. The real defense is Phases 2–5.

## 1. Inventory what ships

```bash
# every script the page loads
curl -s https://example.com/ | grep -oE '<script[^>]+src="[^"]+"' | sed 's/.*src="//;s/"//'

# endpoints referenced by the bundle
curl -s https://example.com/js/app.js | grep -oE '["'\''`]/api/[a-zA-Z0-9/_.:-]+' | sort -u

# secret-shaped strings (expect zero real hits; triage every one)
grep -rnoE '(sk-[A-Za-z0-9]{16,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{20,}|ghp_[A-Za-z0-9]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY)' dist/
```

Record: number of endpoints discoverable, whether sources are minified, whether comments survive, whether a source map is reachable.

## 2. Findings to look for

| Finding | Why it matters | Fix |
|---|---|---|
| Unminified ES modules served raw | full API map + business logic + internal naming | bundle, minify, tree-shake to `dist/`; 404 the raw source dir in prod |
| Source map published | reconstructs original source, comments, dead features | build with `sourcemap: 'external'`, do **not** deploy `.map`; `location ~ \.map$ { return 404; }` |
| `console.log` / `debugLog` in prod | leaks state, ids, internal flow; noisy for attackers to read | build-time `drop: ['console','debugger']` |
| Comments naming internal systems | "// TODO: internal dashboard at ..." | `legalComments: 'none'` + review |
| Prompts / model names built client-side | the LLM contract is now attacker-editable (see Phase 3) | move prompt construction server-side; client sends the user's question only |
| Feature flags for unreleased features | pre-announces the roadmap, sometimes gates access client-side | code-split so unshipped features are not in the main bundle; gate server-side |
| Semantic cache-busters (`?v=signup-bonus-100`) | leaks release names and internal audit codes | content-hash filenames |
| Hardcoded API keys | direct compromise | server-side only; if a key must be public (maps, analytics), restrict it by referrer/domain at the vendor |
| Client-side authorization (`if (user.isAdmin) show()`) | reveals privileged endpoints and enforces nothing | server-side authorization; the client may hide UI, never gate data |
| Business rules enforced client-side (limits, prices, quotas) | trivially bypassed by calling the API directly | server is the only authority; client mirrors it |
| Third-party scripts without SRI | CDN compromise = your XSS | `integrity=` + pinned version, or self-host (Phase 6) |
| Verbose error text rendered from API responses | leaks stack traces to any user | generic UI message + server-side log id |

## 3. What must move server-side

Anything where the *client knowing it* is itself the problem:

- **LLM system prompts and model selection.** A client-built prompt means the user can rewrite the system message, switch models, or strip guardrails. Send `{question, spread, locale}`; the server owns everything else.
- **Pricing, credit costs, quota limits, discounts.** Client displays; server decides.
- **Feature entitlement.** "Is this user premium" is a server answer, re-checked on every privileged call.
- **Signing / hashing of anything meaningful.** A client-side signature is a client-controlled signature.
- **Ordering / totals in checkout.** Send item ids and quantities; the server recomputes the price.

## 4. Build pipeline (minimal, framework-free)

For a vanilla ES-module app, esbuild is enough — no need for a bundler framework:

```js
// scripts/build-client.js
import * as esbuild from 'esbuild';

await esbuild.build({
  entryPoints: ['src/public/js/main.js'],
  bundle: true,
  minify: true,
  splitting: true,                 // unshipped features stay out of the main chunk
  format: 'esm',
  outdir: 'src/public/dist',
  entryNames: '[name]-[hash]',     // content hash replaces semantic ?v= tags
  drop: ['console', 'debugger'],
  legalComments: 'none',
  sourcemap: 'external',           // generated for local debugging, NOT deployed
  define: { 'process.env.NODE_ENV': '"production"' },
});
```

Keep dev/prod split so day-to-day development is unaffected:

```json
{ "scripts": {
    "dev":   "nodemon src/server.js",
    "build": "node scripts/build-client.js",
    "start": "npm run build && node src/server.js" } }
```

Proxy rules that make the build meaningful:

```nginx
location ~ \.map$  { return 404; }   # never serve maps
location /js/      { return 404; }   # prod serves /dist/ only
```

Add a CI check that fails the build if `dist/` contains `console.log`, a `.map` file is in the deploy artifact, or a secret-shaped string matches.

## 5. Content Security Policy

CSP does not affect crawlers (they do not execute your scripts), so there is no SEO cost to shipping it.

1. Start `Content-Security-Policy-Report-Only` with a report endpoint.
2. Collect violations for a week, fix the real ones.
3. Enforce. Target: no `unsafe-inline` for scripts (use nonces/hashes), explicit `connect-src`, `frame-ancestors 'self'`, `object-src 'none'`, `base-uri 'self'`.
4. `form-action` restricted — this is the one people forget, and it blocks a class of injected-form credential theft.

## 6. Exit criteria

```
[ ] no secret-shaped strings in the deployed bundle
[ ] no .map reachable in production
[ ] raw source directory returns 404 in production
[ ] no console/debug output in the production bundle
[ ] prompts, pricing, quotas, entitlement all decided server-side
[ ] third-party scripts pinned + SRI, or self-hosted
[ ] CSP enforced (or report-only with a dated plan to enforce)
[ ] asset URLs use content hashes, not semantic labels
[ ] the endpoint list extracted from the bundle is handed to Phase 2 as the test surface
```

The last line matters most: **the endpoint inventory produced here is the input to Phase 2.** Every endpoint the bundle reveals must be individually verified as server-authorized.
