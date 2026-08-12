# Contributing

This is a Claude Code **skill** — a package of methodology (`SKILL.md` + `references/`) and a
few read-only tools (`scripts/`). It is prose and small scripts, not an application, so the bar
is different: every claim must be true and reproducible, and every script that has logic must have
a test.

## Repository layout

```
SKILL.md              entry point; the phase map and the three principles
references/*.md        one file per phase / cross-cutting topic; the actual methodology
scripts/*.mjs|*.sh     read-only tools; logic lives in scripts/lib/ so it can be tested
scripts/lib/*.mjs      pure, side-effect-free modules (importable by scripts and tests)
test/*.test.mjs        node-native assertions, no network, no deps
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

## Adding or changing a script

1. Put the logic in a pure function in `scripts/lib/` (or an `export`ed function guarded so the CLI
   doesn't run on import — see `verify-crawler-ip.mjs`).
2. **Add a test in `test/`.** New behaviour needs assertions; a bug fix needs the bug frozen as a
   regression case (name it so). This is the skill's own third principle applied to itself.
3. Prove the test by planting the failure: revert the fix, watch the test go red *for the right
   reason*, restore it. A green test you have never seen fail is decoration (`references/regression-gate.md`).
4. `npm run lint && npm test` must pass. CI runs both on every push and PR.

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
- **Releasing** (maintainers):
  1. Land the changes as focused commits; CI green.
  2. Add a dated section to `CHANGELOG.md` under the new version (Keep a Changelog headings:
     Added / Changed / Fixed / Removed / Security).
  3. Bump `VERSION` (SemVer: breaking → major, new capability → minor, fix/docs only → patch).
  4. `chore(release): vX.Y.Z` committing `VERSION` + `CHANGELOG.md`, then tag `vX.Y.Z`.
- Keep `[Unreleased]` at the top of the changelog for work in flight.
