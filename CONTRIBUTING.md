# Contributing

Web App Security Skill is a multi-surface security product: an AI-agent Skill, ordinary CLI,
composite GitHub Action, deterministic evidence/report pipeline, release lifecycle, fixtures and
agent-guided methodology. Every public claim must be bounded and reproducible; every script with
logic needs a regression test.

## Repository layout

```
SKILL.md              entry point; the phase map and the three principles
README_AI.md           repository-mode bootstrap for Claude Code, Codex and other agents
references/*.md        one file per phase / cross-cutting topic; the actual methodology
scripts/*.mjs|*.sh     read-only tools; logic lives in scripts/lib/ so it can be tested
scripts/lib/*.mjs      pure, side-effect-free modules (importable by scripts and tests)
test/*.test.mjs        node-native assertions, no network, no deps
examples/              local demonstrations and tutorial fixtures
docs/*.json            structured public contracts and evidence sources
.github/workflows/     CI, CodeQL, release and real @v1 consumer verification
assets/                templates copied into a workspace (e.g. scope-template.md)
VERSION, CHANGELOG.md  release state
```

## Ground rules

- **Read-only by default.** Tools may send bounded HTTP to a target the *user* owns (Phase 0 gate),
  or make read-only cloud `describe`/`list` calls. Nothing writes to the target, exfiltrates data,
  or acts without an authorization anchor. A tool that could be destructive does not belong here.
- **No new runtime dependencies.** Scripts run on a stock Node 22 / POSIX shell. Keep it that way —
  a security tool people won't `npm install` before trusting is a tool they won't run.
- **A finding is a lead until reproduced.** In references, keep *confirmed* separate from *suspected*,
  and always state what a check does **not** prove. Never print secrets, tokens, full share URLs, or
  real users' IPs in example output.
- **Every change to enforcement advice is also an SEO claim.** If you touch crawl-boundary,
  rate-limiting, or bot rules, the guidance must keep public content open to verified crawlers.
- **No inflated evidence.** Keep `confirmed`, `suspected`, `unknown` and `not_applicable` distinct.
  Adoption metrics are not correctness evidence. Do not turn source patterns or case-study leads
  into demonstrated vulnerabilities.

## Adding or changing a script

1. Put the logic in a pure function in `scripts/lib/` (or an `export`ed function guarded so the CLI
   doesn't run on import — see `verify-crawler-ip.mjs`).
2. **Add a test in `test/`.** New behaviour needs assertions; a bug fix needs the bug frozen as a
   regression case (name it so). This is the skill's own third principle applied to itself.
3. Prove the test by planting the failure: revert the fix, watch the test go red *for the right
   reason*, restore it. A green test you have never seen fail is decoration (`references/regression-gate.md`).
4. `npm run check` must pass. CI runs lint, Node tests and the Bash smoke test on every push and PR.

## Changing a public claim or generated document

- Edit the structured source, not the generated Markdown: `docs/capabilities.json`,
  `docs/public-contract.json` or `docs/case-studies/journeys/evidence.json`.
- Run the matching generator. Files carrying a generated comment must not be edited by hand.
- Update English and Chinese human surfaces together when the product path changes.
- Add a checker assertion when a claim could silently drift across README, tutorial, Action,
  release or GitHub metadata.

## Adding or changing a reference

- Prefer strengthening an existing phase file over adding a new one; a new top-level topic earns a
  new `references/*.md` and a row in the `SKILL.md` phase map.
- Write from real experience, not restated OWASP. The most valuable entries are the ones a first
  pass misses (`overlooked-surface.md`) and the operational traps that only show up in a live deploy
  (`deploy-safety.md`).
- Keep the two decisions the skill exists to separate — *what to open* vs *how to enforce* — actually
  separate. Do not let robots.txt masquerade as access control.

## Commit and release

- **Conventional Commits**: `fix(scope): …`, `feat(scope): …`, `test: …`, `ci: …`, `docs(scope): …`,
  `refactor(scope): …`, `chore(release): …`. One logical change per commit.
- **Releasing** (maintainers): follow [`docs/release-process.md`](docs/release-process.md). A release
  is not complete at tagging: reproducible archives, SPDX SBOM, checksums, manifest, attestation,
  extracted-archive lifecycle, signed tag and the real `@v1` consumer workflow must pass.
- Keep `[Unreleased]` at the top of the changelog for work in flight.

## Pull request evidence

State the planted failure, verification commands and any unreached environment. Security-rule
changes should include a minimal sanitized fixture. Documentation-only changes still run
`npm run check` because generated contracts and executable tutorial examples are checked. Use the
[bounded issue list](docs/GOOD_FIRST_ISSUES.md) when choosing a first contribution.
