# Demo evidence

`server.mjs` is a deterministic local fixture, not a deployable sample application.

The insecure mode intentionally returns:

- `robots.txt` with `Disallow: /` and no declared sitemap;
- a public `/.env` marker and `/app.js.map`;
- a `200` SPA shell for unknown and sensitive paths;
- no security response headers.

The hardened mode permits public crawling, declares its sitemap, returns 404 for private artifacts
and unknown paths, and adds a minimal header policy. `scripts/demo.mjs` audits both modes through
the real crawl CLI with active probes explicitly authorized against this owned local fixture.

Expected regression result:

```text
before: 13 high, 6 medium
after:   0 high, 0 medium
```

Run `npm run demo -- --out ./demo-output` and inspect `before.json`, `before.md`,
`hardening.patch`, `after.json`, and `after.md`.
