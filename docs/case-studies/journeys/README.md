# Ordinary project journeys

These three journeys run the network-free product path against ordinary open-source web projects
at exact commits. They preserve zero-finding results, false-positive closures, `unknown` surfaces,
and one `suspected` lead. They are not a vulnerability leaderboard or a precision benchmark.

| Project | Stack | Deterministic result | Manual trace |
|---|---|---|---|
| [Linkwarden](linkwarden.md) | Node/Next.js monorepo | 0 findings | URL-fetch sink closed as `not_applicable` for the traced direct path |
| [Healthchecks](healthchecks.md) | Python/Django | 0 findings | Deployment values remain `unknown` from source alone |
| [Open WebUI](open-webui.md) | SvelteKit/Vite + FastAPI | 1 medium `suspected` | Source-map delivery lead; local representative patch retested `fixed` |

The machine-readable source is [`evidence.json`](evidence.json). It records immutable commits,
discovery, raw deterministic results, manual evidence links, repairs and unreached surfaces. The
repository gate checks that public documents retain those boundaries.

## Reproduction boundary

Fetch the source explicitly, then run the network-denied audit separately:

```bash
git clone https://github.com/linkwarden/linkwarden.git /tmp/linkwarden-case
git -C /tmp/linkwarden-case checkout 62f1b81ff7f66001b0f5f613202f87771f3186ee
node scripts/run-case-journey.mjs linkwarden /tmp/linkwarden-case --out /tmp/linkwarden-evidence
```

The runner refuses a dirty checkout, a mismatched `HEAD`, an existing output path, or an output
path inside the source checkout. It exports the exact tracked commit to an isolated snapshot under
the evidence directory, so project identity and audit files never modify the reviewed checkout. It
preloads `test/helpers/deny-network.cjs` for `start` and `audit`, then verifies that the original
checkout is still clean. Source acquisition itself is outside that deny-network step and remains
visible.

No hosted instance was probed. Reproducing a journey does not authorize remote testing.
