# Web App Security Skill adoption engineering plan

Status: active  
Owner: parousia8888  
Started: 2026-08-13  
Canonical repository: `parousia8888/web-app-security-skill`

This document is the source of truth for the G0-G5 adoption-engineering program that follows the
completed P0-P7 productization program. Update the relevant completion record immediately after a
phase passes. Do not mark an external human action as complete from a template, automation, or
maintainer intention.

## Objective

Improve the engineering conditions that can turn qualified visits into independent successful use,
reviewable trust, external references, and voluntary stars. Star count is an observed downstream
metric, not an engineering acceptance criterion and not evidence that a security conclusion is
correct.

The program optimizes this relationship:

```text
qualified discovery
  -> first-screen comprehension
  -> trusted installation
  -> first report
  -> reviewable patch and retest
  -> independent reference or recommendation
```

## Product and safety constraints

1. Keep the public identity **Web App Security Skill** and the repository name ending in `Skill`.
2. Do not describe the agent-guided methodology as a general automatic scanner.
3. Use owned local fixtures for demonstrations. Do not probe a third-party deployment to produce
   marketing evidence.
4. Do not make unverified `curl | sh` the recommended installation path. A short path must pin or
   verify the code it executes and retain the guarded lifecycle behavior.
5. Generate visible counts and demo output from structured or executable sources. Do not hand-edit
   a result merely to improve presentation.
6. Keep active network checks behind ownership or written-authorization acknowledgement.
7. Never publish a suspected real-project vulnerability as a growth tactic. Coordinate privately
   with the upstream owner before public disclosure.
8. Do not buy stars, exchange stars, use rewards for stars, mass-message maintainers, or treat stars
   as correctness evidence.
9. Separate `completed` engineering work from `external_validation_pending`. A test kit is not five
   completed human sessions, and a publication kit is not a published third-party article.
10. Use separate phase commits. Push a phase only after its local acceptance checks pass, then add
    the commit, CI, live evidence, and limitations to this ledger before starting the next phase.

## Baseline captured before G0

Captured at 2026-08-13 from the public repository and the clean local checkout at
`ffa878610af444e42e010060ef90480d7c7f075c`.

| Surface | Baseline | Interpretation |
|---|---|---|
| GitHub Marketplace | `Web App Security Skill`, `v0.3.0`, Security + Code Scanning Ready | Discoverable Action distribution exists |
| Repository | 2 stars, 0 forks, 0 watchers, 7 open issues | Observation only; not a quality score |
| Releases | one signed/evidenced release, `v0.3.0` | Trust path exists but has no later release cadence yet |
| README demo | generated `13 high / 6 medium -> 0 high / 0 medium` table | Reproducible result exists but is not visible as motion |
| README install | clone to `/tmp`, then run the installer with Node | Tested but high-friction and tied to the moving default branch |
| First-use proof | network-denied clean-room tutorial fixture | Machine path is proven; independent human comprehension is not |
| Case evidence | 3 ordinary journeys + 5 methodology studies at immutable commits | Method evidence exists; upstream maintainer validation is absent |
| Correctness backlog | issues #1, #2, #5 are bounded fail-closed regressions | Trust-sensitive gaps are public and actionable |
| npm channel | package name available; maintainer is not authenticated locally | Publishing requires an explicit owner handoff |

The baseline does not infer conversion from stars, visits, or Marketplace listing presence. GitHub
traffic data is short-lived and repository-owner-only; capture it manually when evaluating a launch
window rather than fabricating historical values.

## Success signals and attribution limits

### Engineering acceptance signals

- a new visitor can see the real before/patch/retest loop without running code;
- the visible demo is generated from the same owned fixture used by repository tests;
- a supported install path reaches `webapp-security version` from a clean home and verifies its
  selected release before execution;
- a first-use session can be recorded without names, emails, repository secrets, or raw project
  contents;
- publication and case-study claims link to reproducible evidence and state their limitations;
- correctness fixtures fail closed and run in the normal CI matrix;
- release-candidate installation, demo, audit, retest, SBOM, checksums, and Action consumer paths
  remain reproducible.

### External outcome signals

Record these after a defined launch window, but do not use them to pass a phase:

- unique cloners and repository visitors from GitHub traffic;
- Marketplace and README referrals where GitHub exposes them;
- independent successful first-report sessions;
- external links, citations, discussions, issues, or pull requests;
- stars, forks, and watchers with the capture time and channel context.

These signals cannot prove causality. A star increase after a release may be affected by channel,
timing, author network, topic demand, or unrelated GitHub discovery.

## Phase ledger

| Phase | Deliverable | Status | Evidence |
|---|---|---|---|
| G0 | Adoption contract, baseline, phase acceptance and anti-metric rules | completed | `0599f46` + checks below |
| G1 | Fixture-generated animated terminal demo and README placement | completed | `f1f9728`, `3fe3cc1` + checks below |
| G2 | Verified low-friction install channel and clean-room lifecycle | completed | `11eee87`, `55c3de2`, `02277e8`, `37d822a` + checks below |
| G3 | Privacy-minimal five-session usability kit and deterministic aggregation | completed | `a51640a` + checks below |
| G4 | Reusable English/Chinese publication and upstream case-study kit | completed | `2618447` + checks below |
| G5 | Priority fail-closed correctness fixes and release-candidate evidence | in progress | `f227c3d`, `49cf60f` + readiness record |

## G0 - Adoption contract and measurable baseline

### Deliverables

- Preserve this objective, baseline, scope, phase ledger, external-dependency boundary, and rollback
  rules in version control.
- Add a repository check that requires all phases, status vocabulary, external-validation boundary,
  and the prohibition on star-based acceptance.
- Keep the completed P0-P7 productization history unchanged.

### Acceptance

- The plan names concrete artifacts and tests for G1-G5.
- No phase can pass solely because a file, star target, or planned external action exists.
- `npm run lint`, the focused adoption-contract test, Skill validation, and `git diff --check` pass.

### Completion record

- Status: completed 2026-08-13
- Implementation: this document records the adoption funnel, reproducible baseline, G0-G5 scope,
  engineering/external outcome separation, safety constraints, handoff register and stop conditions.
  `scripts/check-adoption-contract.mjs` requires every phase and completion record, the external
  validation boundary, verified-install rule, owned-fixture rule, disclosure boundary and absence
  of numeric star/fork acceptance gates. The check runs from the normal `npm run lint` path.
- Tests: `node scripts/check-adoption-contract.mjs`; `npm run lint`;
  `/usr/local/bin/python3 /Users/kenn/.codex/skills/.system/skill-creator/scripts/quick_validate.py .`;
  `git diff --check`. All passed. The default `python3` on this machine lacks PyYAML, so Skill
  validation used the existing `/usr/local/bin/python3` environment rather than treating the
  missing optional module as a Skill failure.
- Commit / CI: implementation `0599f46`; phase record `001092a`;
  [CI run 31652280441](https://github.com/parousia8888/web-app-security-skill/actions/runs/31652280441)
  passed the Ubuntu/macOS x Node 20/22 matrix and
  [CodeQL run 31652280433](https://github.com/parousia8888/web-app-security-skill/actions/runs/31652280433)
  passed.
- Remaining risks: GitHub traffic history was not available through the public repository API;
  launch-window traffic remains a manual owner capture. The baseline stars/forks/watchers are an
  observation only and will not be used to pass a later phase.

## G1 - Real terminal demo in the first screen

### Deliverables

- Generate a short animated GIF from the owned local fixture's real demo reports and patch evidence.
- Keep a deterministic scene/timing source in the repository and generate the binary without a
  network service or unreviewed media dependency.
- Show `before -> proposed change -> retest` and the four representative risk classes without
  implying general scanner coverage.
- Put the animation below the promise and before the long-form demo explanation in both READMEs,
  with useful alt text and a static evidence link.
- Add drift checks tying visible counts, scene text, source reports, and the committed media digest
  together.

### Acceptance

- Regeneration executes the real fixture and produces the same GIF byte-for-byte under the supported
  Node versions.
- The GIF is legible at GitHub README width, loops, remains reasonably sized, and contains no secret,
  external host, or third-party project output.
- `npm run check` fails when the media, source counts, README path, or digest is stale.
- English and Chinese README claims remain aligned.

### Completion record

- Status: completed 2026-08-13
- Implementation: `scripts/generate-demo-gif.mjs` runs the real owned fixture, derives its five
  scenes from `before.json`, `hardening.patch`, `after.json` and baseline evidence, then renders an
  840x472 animated GIF with a repository-owned pixel font and pure Node GIF encoder. The committed
  `docs/assets/demo.json` records source inputs, dimensions, frame count, duration, byte size,
  SHA-256, observed counts and the no-third-party boundary. Both READMEs show the GIF before the
  long-form result section and link to the static generated evidence. `npm run lint` regenerates and
  byte-compares the asset.
- Tests: `npm run check`; `node scripts/generate-demo-gif.mjs --check`;
  `node test/demo-gif.test.mjs`; Skill Creator validator; `git diff --check`. All passed. Independent
  ImageMagick and FFmpeg decoders reported GIF89a, 840x472, five frames, looping playback and 10.9
  seconds. Visual inspection of every coalesced frame found no clipped or overlapping text.
- Commit / CI: implementation `f1f9728`; initial phase record `ad83be4`; release-archive
  remediation `3fe3cc1`. The first pushed tree's
  [CI run 31652732689](https://github.com/parousia8888/web-app-security-skill/actions/runs/31652732689)
  failed in the release-artifact test on macOS and Ubuntu because Node's default `spawnSync`
  `maxBuffer` could not hold the archive after adding the 2.7 MB GIF; this was not a demo drift or
  decoder failure. `3fe3cc1` sets a bounded 64 MB archive buffer and requires `demo.gif` plus
  `demo.json` in release verification. The same tree's
  [CodeQL run 31652732614](https://github.com/parousia8888/web-app-security-skill/actions/runs/31652732614)
  passed. After remediation,
  [CI run 31652969125](https://github.com/parousia8888/web-app-security-skill/actions/runs/31652969125)
  passed Ubuntu/macOS on Node 20/22 and
  [CodeQL run 31652969191](https://github.com/parousia8888/web-app-security-skill/actions/runs/31652969191)
  passed.
- Remaining risks: the 2,742,052-byte GIF is optimized for deterministic cross-platform generation,
  not minimum transfer size. It remains below the 5 MB repository gate; future compression must
  preserve byte reproducibility and legibility. The demo proves the owned crawl-boundary fixture,
  not general automatic AppSec coverage.

## G2 - Verified low-friction installation

### Deliverables

- Add a standalone bootstrap that resolves an explicit version, downloads the release archive plus
  `SHA256SUMS` and release manifest, verifies asset identity and expected repository/tag metadata,
  extracts into a private temporary directory, and invokes the existing guarded installer.
- Reject moving branches, missing checksums, duplicate checksum entries, archive path traversal,
  manifest/tag mismatch, digest mismatch, unexpected redirects, and partial installation.
- Provide one copyable supported command for the latest documented release plus explicit-version and
  offline/fully manual verification paths.
- Keep Claude Code, Codex, ordinary CLI, upgrade, backup, and uninstall semantics unchanged.
- Prepare an npm package only if it is a thin, reviewable wrapper over the same verification path.
  Publishing it remains `external_validation_pending` until the maintainer authenticates and
  explicitly approves registry publication.

### Acceptance

- A network-denied fixture server reproduces success and each tampering failure without contacting
  GitHub.
- A clean isolated home reaches `version -> start -> audit -> retest -> uninstall` from the verified
  release payload.
- The recommended command never executes bytes before their identity is pinned or verified.
- Linux and macOS checksum/extraction behavior is covered in CI; WSL2 remains separately evidenced.

### Completion record

- Status: completed 2026-08-13
- Implementation: `scripts/install-verified.mjs` selects only explicit versions from built-in trust
  anchors, downloads or reads offline the archive, manifest, SPDX SBOM and checksum list, verifies
  their independent SHA-256 values and cross-checks repository, product, version, tag, source commit,
  asset sets and archive paths before invoking the existing atomic lifecycle installer.
  `scripts/bootstrap-install.sh` fixes that verifier to commit
  `11eee876cf94640f5604514c74053729b335b6c2` and verifies its digest before Node executes it. Both
  READMEs provide one copyable command that first fixes and verifies the bootstrap at commit
  `55c3de22cb373581b9723467c0d2663917c6df84`. English and Chinese trust documentation covers
  explicit targets/version, offline installation, required/automatic attestation, upgrade, force,
  uninstall and proof limits. The release contract forbids a moving-clone install path and verifies
  the historical verifier bytes against the recorded digest during normal lint.
- Tests: `test/bootstrap-install.test.mjs` proves mismatched downloaded code cannot execute and HTTP
  is rejected before a request. `test/verified-install.test.mjs` uses only local fixture servers for
  success, offline installation, trusted-digest tampering, manifest/tag mismatch, duplicate
  checksums, traversal, cross-origin redirect and preflight/partial-install rejection. Its isolated
  lifecycle reaches `version -> start -> audit -> retest -> uninstall`. `npm run check`, release
  double-build/lifecycle tests, the release contract, Skill validation and `git diff --check` passed.
  The exact README command also downloaded both immutable public GitHub files, verified the four
  real `v0.3.0` assets and installed the CLI in an isolated home. GitHub API and the published
  `SHA256SUMS` independently matched the recorded release digests.
- Commit / CI: verifier `11eee87`; bootstrap and transport corrections `3dc9834`, `c77da41`,
  `3fef0e1`, `55c3de2`; public docs/contract `02277e8`; full-history CI fix `37d822a`. The first docs
  tree's [CI run 31654345657](https://github.com/parousia8888/web-app-security-skill/actions/runs/31654345657)
  failed because the new trust contract could not resolve its historical verifier commit from the
  default shallow checkout; this exposed a real evidence gap. `37d822a` requires `fetch-depth: 0`,
  after which [CI run 31654461836](https://github.com/parousia8888/web-app-security-skill/actions/runs/31654461836)
  passed Ubuntu/macOS on Node 20/22 and
  [CodeQL run 31654461849](https://github.com/parousia8888/web-app-security-skill/actions/runs/31654461849)
  passed.
- Remaining risks: the local GitHub CLI is not authenticated, so the public-install evidence records
  `attestation: not run (gh is not authenticated)`; `--attestation required` correctly fails closed.
  Native WSL2 remains unverified. npm packaging was intentionally not added because an unauthenticated,
  unpublished wrapper would not reduce the verified path's current prerequisites; registry
  authentication/publication remain `external_validation_pending`.

## G3 - First-use validation kit

### Deliverables

- Define a versioned, privacy-minimal session schema for five independent first-use sessions.
- Provide a facilitator script, participant task, consent/data boundary, stop conditions, and a
  clean-room fixture path that does not require sharing a participant's real repository.
- Add a CLI that initializes an anonymous session record, validates it, and aggregates only:
  installation outcome/time, first-report outcome/time, first blockage, result-state comprehension,
  patch confidence, and retest outcome.
- Generate a Markdown summary that distinguishes recorded observations, missing sessions, and free
  text requiring manual review. Do not infer user intent or invent missing values.

### Acceptance

- Fixtures cover successful, abandoned, invalid, and incomplete sessions.
- The aggregate refuses malformed records and reports fewer than five sessions as incomplete, not
  passed.
- No name, email, IP, repository URL, source code, secret, or raw terminal log is accepted by the
  schema.
- Repository automation proves the kit; `five human sessions` remains
  `external_validation_pending` until real records exist with participant consent.

### Completion record

- Status: completed 2026-08-13
- Implementation: `docs/usability/session.schema.json` and `scripts/usability-study.mjs` define a
  versioned first-use record and `init`, `record`, `validate`, and `aggregate` commands. Records are
  private by default, reject unknown fields, require explicit consent and accept only anonymous IDs,
  a fixed network-free fixture, supported-environment enums, bounded step timing/outcomes,
  comprehension/confidence enums and a boolean indicating separate manual notes. There is no field
  for names, email, IP, repository URLs, source, secrets, free text or terminal logs. The facilitator
  runbook defines data boundaries, observation sequence and stop conditions; the participant task
  is limited to the owned clean-room fixture. Real session output paths are ignored by Git.
- Tests: `test/usability-study.test.mjs` covers private initialization, missing consent, successful
  updates, sensitive extra-field rejection, invalid update rollback, successful/abandoned/incomplete
  fixtures, atomic aggregation output, malformed-record rejection and duplicate IDs. Three valid
  fixtures produce `incomplete` with two missing sessions; five produce `sufficient_for_review`,
  never `passed`. `npm run check`, the focused test, schema JSON parsing, Skill validation and
  `git diff --check` passed.
- Commit / CI: implementation `a51640a`;
  [CI run 31654951251](https://github.com/parousia8888/web-app-security-skill/actions/runs/31654951251)
  passed Ubuntu/macOS on Node 20/22 and
  [CodeQL run 31654951234](https://github.com/parousia8888/web-app-security-skill/actions/runs/31654951234)
  passed.
- Remaining risks: no real participant session was performed in this phase. Recruitment, actual
  consent, observation, separately redacted manual notes and five genuine schema-valid records remain
  `external_validation_pending`; fixture records prove only the kit's behavior.

## G4 - Reusable distribution and case-study assets

### Deliverables

- Build English and Chinese evidence-led launch briefs from the public contract, generated demo,
  release evidence, Marketplace URL, capability labels, and limitations.
- Provide channel-specific drafts for a technical long-form post, Hacker News/Show HN submission,
  Reddit discussion, X/short post, V2EX, and Chinese developer communities. Each draft must fit the
  channel and link to evidence rather than repeat generic promotion copy.
- Add a reusable public case-study template with immutable commit, authorization/source boundary,
  confirmed/suspected/unknown/not-applicable outcomes, false-positive closure, minimal patch, retest,
  disclosure state, and upstream response.
- Add a private-disclosure template and explicit rule that suspected vulnerabilities stay private
  until coordinated publication is approved.
- Generate a compact citation page and share metadata from structured facts so external writers can
  quote accurate claims.

### Acceptance

- All numeric/product claims are generated or checked against repository sources.
- Drafts do not claim external publication, upstream validation, precision, or broad scanner
  coverage that has not occurred.
- English and Chinese briefs preserve the same capability and limitation contract.
- A fixture case renders without a live target and fails validation when commit, evidence state,
  disclosure state, or retest result is absent.

### Completion record

- Status: completed 2026-08-13
- Implementation: `docs/adoption/publication.json` supplies the product, audience, positioning,
  limitations, repository, Marketplace URL and external-state boundary. From that source plus the
  existing public contract, generated demo record, capability contract, immutable journey catalog
  and current release evidence, `scripts/generate-adoption-assets.mjs` deterministically writes
  aligned English/Chinese launch briefs, technical long-form, Show HN, Reddit, X/short, V2EX and
  Chinese developer-community drafts, a citation sheet and machine-readable share metadata.
  `scripts/render-public-case.mjs`, `docs/case-studies/template.schema.json` and the public/private
  templates provide a reusable case workflow with immutable source, explicit authorization and
  network boundary, evidence states, false-positive closure, minimal patch, retest, disclosure and
  upstream-response fields. The public renderer rejects private disclosure states and will not
  render suspected evidence without coordinated public authorization.
- Tests: `test/adoption-assets.test.mjs` runs the valid case under a network-denied preload, proves a
  case can render without a live target, rejects missing or moving commits, missing evidence,
  disclosure or retest state, rejects private suspected evidence, and accepts a coordinated public
  fixture. The same test checks generated external-state and no-upstream-validation metadata.
  `node scripts/generate-adoption-assets.mjs --check`; two complete `npm run check` runs; Skill
  Creator validation; and `git diff --check` passed. The generated short post is 272 characters
  before platform URL shortening.
- Commit / CI: implementation `2618447`;
  [CI run 31655686745](https://github.com/parousia8888/web-app-security-skill/actions/runs/31655686745)
  passed Ubuntu/macOS on Node 20/22 and
  [CodeQL run 31655686723](https://github.com/parousia8888/web-app-security-skill/actions/runs/31655686723)
  passed.
- Remaining risks: no draft was posted and no upstream project was contacted in this phase.
  Publication, community interaction, action-time community-rule review, private coordination and
  any upstream response remain `external_validation_pending` owner actions. The generated channel
  drafts require human tone/context review immediately before posting; the kit does not establish
  conversion, independent use, upstream validation, precision or general scanner coverage.

## G5 - Correctness and release candidate

### Deliverables

- Resolve issue #1 with malformed, empty, stale, wrong-product crawler-range fixtures and explicit
  unavailable/unknown non-zero semantics.
- Resolve issue #2 with a fake AWS CLI permission-denied path that preserves `UNCHECKED` and sanitized
  evidence.
- Resolve issue #5 with sitemap entity, numeric-entity, CDATA, malformed XML, and external-declaration
  fixtures that never make an off-fixture request.
- Update roadmap/issues only after planted regressions and implementation tests pass.
- Prepare the next patch release evidence, changelog, deterministic artifacts, clean install,
  Marketplace metadata check, and public `@v1` consumer verification. Do not tag or publish until
  the release tree, version, notes, and owner release decision are aligned.

### Acceptance

- Each correctness fix includes a test that demonstrates the intended pre-fix gap from a planted
  local fixture and a post-fix fail-closed result.
- Full `npm run check` passes on the repository's Node/OS matrix and Skill validation passes.
- Release artifacts build twice byte-for-byte, verify checksums/SBOM/manifest, and complete the
  extracted lifecycle in an isolated home.
- Any release that is actually published retains the signed version tag, provenance, Marketplace
  listing, and verified `v1` consumer sequence used by `v0.3.0`.

### Completion record

- Status: in progress; repository correctness complete, version/release gate pending owner decision.
- Implementation: `scripts/verify-crawler-ip.mjs` validates non-empty product-specific CIDRs and
  `creationTime`, preserves custom product/vendor identity and returns exit `3` for unavailable
  evidence. `scripts/aws-exposure-audit.sh` routes nested reads through the counted `UNCHECKED`
  path, withholds captured error payloads and returns exit `3` when unknown checks remain without a
  confirmed HIGH. `scripts/crawl-surface-audit.mjs` performs bounded XML structure/entity parsing,
  rejects declarations and constrains every sitemap/index/sample URL to the audited origin.
  Roadmap source metadata now records explicit open/closed Issue state and the live checker validates
  both, so completed work does not make the public contract fail. `docs/release-state.json` now
  separates the working product version, actually published release, stable Action target and
  verified-installer versions. Generated launch/publication assets and the live GitHub checker use
  the published record, while `scripts/check-release-state.mjs` checks it against tags and verifier
  trust anchors. A synthetic candidate regression proves that changing the product to `0.3.1` does
  not advertise a nonexistent `v0.3.1` release. The complete version gate and evidence inventory
  are in `docs/releases/next-patch-readiness.md`.
- Tests: planted local regressions first reproduced all three pre-fix gaps. The new crawler, AWS and
  sitemap tests then passed alongside existing crawler unit/CLI tests and product-surface coverage.
  Two full correctness `npm run check` runs, plus a complete release-state `npm run check`, Skill
  Creator validation, live GitHub metadata validation and `git diff --check` passed. CI
  [31656913265](https://github.com/parousia8888/web-app-security-skill/actions/runs/31656913265)
  passed Ubuntu/macOS on Node 20/22 and CodeQL
  [31656913266](https://github.com/parousia8888/web-app-security-skill/actions/runs/31656913266)
  passed. State-contract CI
  [31657298727](https://github.com/parousia8888/web-app-security-skill/actions/runs/31657298727)
  and CodeQL
  [31657298751](https://github.com/parousia8888/web-app-security-skill/actions/runs/31657298751)
  also passed. Release-state CI
  [31658167450](https://github.com/parousia8888/web-app-security-skill/actions/runs/31658167450)
  passed Ubuntu/macOS on Node 20/22 and CodeQL
  [31658167426](https://github.com/parousia8888/web-app-security-skill/actions/runs/31658167426)
  passed. Live GitHub metadata validation passed after #1/#2/#5 closed and after the release-state
  contract was added.
- Commit / CI / release: correctness implementation `f227c3d`; issue-state contract `49cf60f`;
  release-state implementation `0ca668e`.
  Issues #1, #2 and #5 are closed with commit/test/CI evidence. The Marketplace listing is live and
  still reports `v0.3.0`; the signed `v0.3.0` and `v1` tags both resolve to
  `d7df9fa6efd466c3eb13768c3b9ad259d2636e04`. Existing public `@v1` consumer run
  [31657177101](https://github.com/parousia8888/web-app-security-skill/actions/runs/31657177101)
  passed. No new version, tag, release or `v1` move is claimed.
- Post-release promotion preparation: `scripts/prepare-release-promotion.mjs` validates the exact
  four-asset set and emits a verifier trust entry without changing repository or GitHub state. Its
  `--live` gate additionally requires GitHub-recorded asset digests, a published non-prerelease,
  signed tag/source-commit agreement and provenance. A local tamper regression passes, and a
  read-only run against `v0.3.0` reproduced all existing asset digests and trust anchors. The release
  workflow stores `local_candidate` promotion evidence separately from the four public assets;
  implementation commit and CI evidence remain pending this phase commit.
- Remaining risks: `VERSION` is still the already-published `0.3.0`; rebuilding HEAD under that
  identity is mechanism evidence, not a valid new release candidate. Selecting the next version,
  aligning its exact tree/evidence, publishing it, recording the resulting asset digests in a later
  verifier/bootstrap trust-anchor chain, and moving `v1` remain
  `external_validation_pending` owner-gated actions. Five real user sessions, public channel posts
  and upstream validation also remain external and are not implied by G5 correctness completion.

## External handoff register

These items can be prepared and verified in the repository but cannot be truthfully completed by
repository automation alone:

| Action | Prepared in | Completion evidence |
|---|---|---|
| Publish an npm package | G2 | registry page, immutable version, provenance, clean external install |
| Run five independent human sessions | G3 | five consented schema-valid records, aggregate summary |
| Publish community posts | G4 | live URLs and capture times; edits recorded separately |
| Contact an upstream project about a suspected vulnerability | G4 | private disclosure record and coordinated public state |
| Tag/release and move `v1` | G5 | signed tag, release assets/attestation, CI, public consumer run |

External actions stay pending unless their actual evidence exists. A maintainer may choose not to
perform any of them without invalidating completed repository engineering.

## Rollback and stop conditions

- Revert a phase before release if it weakens authorization gates, evidence state semantics,
  installer path safety, deterministic output, or current lifecycle behavior.
- Stop installation work if a shorter command cannot authenticate the bytes it executes.
- Stop media work if the generated asset cannot be traced to the real fixture output.
- Stop a case publication if disclosure authorization is absent or evidence is only suspected.
- Stop a release if version, commit, evidence note, SBOM, checksum, signature, Marketplace metadata,
  or `v1` consumer evidence disagree.

## Program completion

The repository-engineering program is complete when G0-G5 records are complete, the worktree is
clean, required CI and live public checks pass, and external-only items are either evidenced or
explicitly retained as `external_validation_pending`. Star growth, a five-session result, an npm
publication, a community post, or an upstream response must never be invented to close the program.
