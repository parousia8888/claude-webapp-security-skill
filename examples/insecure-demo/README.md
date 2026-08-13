# Demo evidence

This is an intentionally vulnerable local Node.js project. `src/export-report.mjs` passes a report
title through a shell; the hardened version uses `execFile` with a separate argument. The demo
never sends network traffic and uses only a fixed harmless functional-test input.

Run `npm run demo -- --out ./demo-output`. Inspect the v3 before/after reports,
`hardening.patch`, `demo-result.json`, and `functional-retest.txt`. A source match remains
`suspected`; `fixed` means only that the same compatible source rule no longer reproduces.
