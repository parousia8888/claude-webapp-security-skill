# Ordinary project journeys

These five journeys run the complete v2 source path against ordinary open-source web projects at
exact commits: built-in rules, Gitleaks `8.30.1`, and OSV-Scanner `2.5.0`. They preserve confirmed
source facts, scanner leads, false-positive closures, `unknown`/`not_applicable` coverage, and
unreached surfaces. They are not a vulnerability leaderboard or precision benchmark.

| Project | Stack | v2 snapshot | Manual trace |
|---|---|---|---|
| [Linkwarden](linkwarden.md) | Node/Next.js monorepo | 0 confirmed; OSV leads suspected | Direct URL-fetch path `not_applicable`; proxy path unreached |
| [Healthchecks](healthchecks.md) | Python/Django | 0 confirmed; Gitleaks doc/test leads suspected; OSV not applicable | Deployment values remain `unknown` |
| [Open WebUI](open-webui.md) | SvelteKit/Vite + FastAPI | Source-map plus OSV leads suspected | Local source-map fixture retested `fixed`; delivery unknown |
| [Uptime Kuma](uptime-kuma.md) | Express + Vue/Vite | 4 confirmed lockfile facts; external leads suspected | Operator webhook sink `not_applicable` without a boundary bypass |
| [Mealie](mealie.md) | Nuxt/Vue + FastAPI | 0 confirmed; Gitleaks test-material leads suspected | Limited URL-fetch path `not_applicable`; broader paths unknown |

The machine-readable [`evidence.json`](evidence.json) records immutable commits, discovery,
adapter/ruleset identity, every rule's coverage, the `2026-08-14` snapshot, deterministic sanitized
finding digests, reviewed confirmed IDs, closures, repair/retest outcome and unreached surfaces. OSV uses a mutable public
advisory database: reruns must report advisory drift rather than rewriting the historical snapshot.

Uptime Kuma and Mealie also appear in the separate five-study [source-methodology corpus](../README.md)
at the same commits. Those documents test manual source-to-boundary reasoning; the journeys here
test the v2 CLI/adapter path. This is five ordinary projects plus five studies, not ten distinct
projects.

## Reproduction boundary

Install the exact supported scanner versions yourself, fetch the source explicitly, and run:

```bash
export WEBAPP_SECURITY_GITLEAKS_BIN=/verified/path/to/gitleaks-8.30.1
export WEBAPP_SECURITY_OSV_SCANNER_BIN=/verified/path/to/osv-scanner-2.5.0
git clone https://github.com/linkwarden/linkwarden.git /tmp/linkwarden-case
git -C /tmp/linkwarden-case checkout 62f1b81ff7f66001b0f5f613202f87771f3186ee
node scripts/run-case-journey.mjs linkwarden /tmp/linkwarden-case --out /tmp/linkwarden-evidence
```

The runner refuses missing caller-provided binaries, a dirty checkout, mismatched `HEAD`, an
existing output path, or output inside the checkout. It scans the fixed clean checkout directly so
Gitleaks history coverage remains real, writes evidence outside it, and verifies the checkout is
unchanged. It never downloads tools, executes project dependencies, or contacts a hosted project.
OSV-Scanner may query the public OSV service; this is the only project-journey network exception.

No hosted instance was probed. Reproducing a journey does not authorize remote testing.
