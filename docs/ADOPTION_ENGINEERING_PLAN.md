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
| G0 | Adoption contract, baseline, phase acceptance and anti-metric rules | in progress | pending |
| G1 | Fixture-generated animated terminal demo and README placement | pending | pending |
| G2 | Verified low-friction install channel and clean-room lifecycle | pending | pending |
| G3 | Privacy-minimal five-session usability kit and deterministic aggregation | pending | pending |
| G4 | Reusable English/Chinese publication and upstream case-study kit | pending | pending |
| G5 | Priority fail-closed correctness fixes and release-candidate evidence | pending | pending |

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

- Status: in progress
- Implementation: pending
- Tests: pending
- Commit / CI: pending
- Remaining risks: pending

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

- Status: pending
- Implementation: pending
- Tests: pending
- Commit / CI: pending
- Remaining risks: pending

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

- Status: pending
- Implementation: pending
- Tests: pending
- Commit / CI: pending
- Remaining risks: npm authentication and native WSL2 session remain owner/external actions.

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

- Status: pending
- Implementation: pending
- Tests: pending
- Commit / CI: pending
- Remaining risks: participant recruitment and observation require the maintainer or designated
  facilitator.

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

- Status: pending
- Implementation: pending
- Tests: pending
- Commit / CI: pending
- Remaining risks: posting, community interaction, and upstream disclosure are owner actions and
  require action-time review.

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

- Status: pending
- Implementation: pending
- Tests: pending
- Commit / CI / release: pending
- Remaining risks: release publication and movement of `v1` are external state changes that require
  the final reviewed release tree and explicit owner confirmation at action time.

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
