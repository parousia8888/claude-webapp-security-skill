# Web App Security Skill productization plan

Status: active  
Owner: parousia8888  
Started: 2026-08-13  
Canonical repository: `parousia8888/web-app-security-skill`

This document is the source of truth for the P0-P7 productization program. Update a phase record
immediately after its acceptance criteria pass. A phase is not complete because files exist; it is
complete only when its behavior is tested and the evidence below is recorded.

## Product contract

### Audience

Web product owners and builders who use AI coding agents and do not need prior offensive-security
experience. Public copy must not label or segment them as "vibe coders".

### Public identity

- Product name: **Web App Security Skill**
- Planned repository: `parousia8888/web-app-security-skill`
- Skill identifier: `web-app-security`
- CLI command: `webapp-security`
- GitHub Action: `parousia8888/web-app-security-skill@v1`

The product and repository names end in `Skill`. The CLI remains shorter because it is a command,
not a public project name.

### Core promise

> Give an AI coding agent a web project. It scopes the work, finds explainable risks, prepares the
> smallest reviewable hardening changes, retests them, and records what is fixed and what remains.

Chinese:

> 把 Web 项目交给 AI coding agent，完成范围确认、风险检查、最小加固、复测和证据交付。

### First-use path

```text
project source + optional owned deployment
  -> stack and scope discovery
  -> passive/source checks
  -> confirmed / suspected / unknown / not-applicable findings
  -> reviewable patch plan or patch
  -> retest and baseline diff
  -> evidence report and remaining risks
```

### Capability labels

Every public capability claim must use one of these labels:

1. **Automated and regression-tested**: implemented by a deterministic script or CLI path with a
   test that plants the failure.
2. **Agent-guided methodology**: the Skill tells an agent how to perform context-dependent review;
   there is no claim of a general automatic scanner.
3. **Planned**: not shipped and not shown as available.

Never collapse these labels into one undifferentiated coverage claim.

### Result states

- `confirmed`: reproduced with sufficient sanitized evidence.
- `suspected`: a lead requiring more context or reproduction.
- `unknown`: the check or evidence source was unavailable.
- `not_applicable`: outside the recorded scope or absent from the project.

An unavailable check is never a pass. Installing the Skill does not prove a project secure.

## Packaging audit baseline

The useful lesson from `reverse-skill` is product packaging, not website layout:

- Keep one memorable project/repository identity.
- Compress a complex system into a small number of user outcomes before showing internal modules.
- Separate the human entry (`README.md`) from the agent bootstrap (`README_AI.md`) and execution
  contract (`SKILL.md`).
- Turn first use into one copyable prompt or command.
- Use countable, reproducible maturity signals instead of generic claims.
- Provide visible tutorial, release, contribution, community, and evidence paths.

Do not copy these weaknesses:

- Dynamic counts that disagree across surfaces.
- Scope breadth presented without per-capability completion state.
- Stars, sponsors, or growth curves used as correctness evidence.
- Release tags without artifacts and verification material.

Current project strengths at program start:

- deterministic local before/after demo;
- Claude Code, Codex, and ordinary CLI installer;
- passive-by-default Action and explicit active-test authorization gates;
- CI, CodeQL, SPDX generation, checksums, and provenance workflow;
- threat model, false-positive policy, compatibility matrix, and five fixed-commit case studies;
- fail-closed result semantics: evidence failure becomes `unknown`, not safe.

Current project gaps at program start:

- four competing names across repository, UI, Skill ID, and CLI;
- public copy mixes deterministic automation with broad agent-guided methodology;
- no `start <project>` path that discovers a project and creates a scoped run;
- no stable finding schema, HTML/SARIF output, baseline diff, or general retest command;
- examples establish methodology but do not yet show a complete ordinary project journey;
- no published v0.3 release artifacts or stable major Action tag;
- no dedicated human tutorial / agent-bootstrap separation.

## Program rules

1. Complete phases in order unless a later task is an independent prerequisite.
2. Update the phase record in this file before starting the next phase.
3. Keep active network testing behind ownership/written-authorization gates.
4. Prefer source analysis and local fixtures for demonstrations and case studies.
5. Do not publish an unverified metric or claim a methodology is an automated scanner.
6. Keep changes reviewable; use separate commits for phase completion and external migrations.
7. Do not create the `v0.3.0` tag until the release phase verifies the final versioned tree.

## Phase ledger

| Phase | Deliverable | Status | Evidence |
|---|---|---|---|
| P0 | Product contract and honest capability boundary | completed | `ea90082` + checks below |
| P1 | Unified identity and human/agent entrypoints | completed | `c27a8ec` + migration evidence below |
| P2 | Outcome-led README and first-run packaging | pending | pending |
| P3 | `start <project>` project discovery and scoped run | pending | pending |
| P4 | Finding schema, reports, patch/retest baseline loop | pending | pending |
| P5 | Three ordinary open-source project journeys | pending | pending |
| P6 | Install/upgrade/uninstall, Action v1, signed release | pending | pending |
| P7 | Tutorial, contribution path, launch evidence | pending | pending |

## P0 - Product contract and capability boundary

### Deliverables

- Record the audience, identity, promise, first-use path, result states, and non-goals.
- Publish a capability matrix that separates automated, agent-guided, and planned behavior.
- Align the Skill output contract and public description with the result states.
- Add checks that prevent capability-state drift in the main public surfaces.

### Acceptance

- A first-time reader can state the input, process, output, and limits without knowing AppSec terms.
- API, OAuth, LLM, database, and supply-chain methodology is not presented as one automatic scan.
- `npm run check` and the Skill validator pass.

### Completion record

- Status: completed 2026-08-13
- Implementation: `docs/capabilities.json` is the structured source of truth for 14 capabilities
  across automated/regression-tested, agent-guided, and planned labels. The generated
  `docs/capabilities.md` links every capability to repository evidence. README, Chinese README and
  `SKILL.md` now state the same boundary and the four result states.
- Tests: `npm run check`; `node scripts/generate-capability-matrix.mjs --check`;
  `node scripts/check-product-contract.mjs`; Skill Creator `quick_validate.py`. All passed. The
  contract check fails on missing states, invalid/duplicate capabilities, missing evidence files,
  stale generated output, or missing public-surface markers.
- Commit: `ea90082` (`feat: define product capability contract`)
- Remaining risks: the current repository and Skill identifiers still use the pre-P1 name. The
  capability matrix is English-only until the public documentation phase adds a localized view.

## P1 - Unified identity and entrypoints

### Deliverables

- Migrate public identity to **Web App Security Skill** and repository to
  `parousia8888/web-app-security-skill`.
- Use `web-app-security` as the Skill identifier while preserving documented compatibility for the
  previous `webapp-security-hardening` install path.
- Add `README_AI.md` as the agent bootstrap; keep `README.md` human-facing and `SKILL.md` procedural.
- Update package metadata, Action references, SBOM namespace, installer paths, links, and tests.

### Acceptance

- One public project name appears across GitHub, README, Skill UI, release assets, and Action docs.
- Old repository links redirect; old local installs receive a migration message or upgrade path.
- Claude Code, Codex, and CLI installs pass isolated-home tests.

### Completion record

- Status: completed 2026-08-13
- Implementation: all public and package identities now use **Web App Security Skill**, repository
  `parousia8888/web-app-security-skill`, Skill ID `web-app-security`, CLI `webapp-security`, and the
  matching Action and release artifact prefix. `README_AI.md` is the repository-mode agent entry;
  `README.md` remains the human entry and `SKILL.md` remains the execution contract. The installer
  detects both current and legacy paths, fails before a partial install, and backs up an existing
  `webapp-security-hardening` install only when the user supplies `--force`. An identity gate checks
  package, Skill, Action, README, SBOM, release workflow, and permitted legacy-name locations.
- Tests: `npm run check`; Skill Creator `quick_validate.py`; PyYAML parse of every YAML file;
  isolated-home Claude Code, Codex, CLI, legacy-conflict, and forced-migration tests. GitHub CI run
  [31627604914](https://github.com/parousia8888/web-app-security-skill/actions/runs/31627604914)
  passed on Node 20/22 and Ubuntu/macOS. CodeQL run
  [31627604893](https://github.com/parousia8888/web-app-security-skill/actions/runs/31627604893)
  passed.
- Commit / migration: `c27a8ec` (`feat: unify Web App Security Skill identity`) and `10942b7`
  (`docs: pin Action example to immutable commit`). GitHub renamed the repository in place; the new
  URL returns HTTP 200 and the previous URL returns HTTP 301 to it. `main`, tags `v0.2.0` through
  `v0.2.4`, stars, topics, and workflow history remained attached. Local `origin` now uses the new
  URL. The documented immutable Action reference is
  `c27a8ecae69271a5a2fdfb6acc314cb4ef3ea967`.
- Remaining risks: the public `v1` Action tag and a real `v0.3.0` release do not exist until P6.
  GitHub reports that the pinned CodeQL v3 Action will be deprecated in December 2026 and that
  pinned Actions declaring Node 20 are being forced onto Node 24; P6 must refresh those immutable
  pins and rerun the supply-chain checks.

## P2 - README and first-run packaging

### Deliverables

- Order README as outcome -> demo -> install -> first task -> evidence -> capability limits -> trust.
- Add one copyable first-task prompt for project owners.
- Show a readable before / proposed change / retest example using generated evidence.
- Keep advanced security vocabulary in the detailed references.

### Acceptance

- The first screen states what the Skill does, who it is for, and the next action.
- Every count shown is generated from a checked source of truth.
- English and Chinese public claims remain aligned by an automated consistency test.

### Completion record

- Status: pending
- Implementation: pending
- Tests: pending
- Commit: pending
- Remaining risks: pending

## P3 - Project start and discovery

### Deliverables

- Add `webapp-security start <project>`.
- Detect supported frameworks, package managers, lockfiles, deployment/config surfaces, and likely
  public origins without reading secrets.
- Create a versioned `security-scope.yml` and run directory before audit work.
- Separate source checks, local checks, passive remote checks, and authorized active checks.
- Make unsupported or ambiguous evidence explicit instead of guessing.

### Acceptance

- Deterministic fixtures cover at least Node/Next.js, Python/FastAPI or Django, and split frontend /
  backend layouts.
- Discovery never prints secret values and performs no network access by default.
- Invalid targets and missing authorization fail before active traffic.

### Completion record

- Status: pending
- Implementation: pending
- Tests: pending
- Commit: pending
- Remaining risks: pending

## P4 - Finding, report, patch, and retest loop

### Deliverables

- Define a versioned finding/report JSON schema.
- Add Markdown, HTML, SARIF, and JUnit renderers where the target format fits.
- Add baseline diff states: `new`, `fixed`, `unchanged`, and `regressed`.
- Add `audit`, `explain <finding-id>`, and `retest --baseline` CLI paths.
- Generate reviewable patch evidence; default risky changes to patch-only.

### Acceptance

- The demo and project fixtures use the same schema and renderer paths.
- Schema validation, renderer snapshots, planted regressions, and exit-code contracts pass.
- A patch never becomes a confirmed fix until its retest evidence passes.

### Completion record

- Status: pending
- Implementation: pending
- Tests: pending
- Commit: pending
- Remaining risks: pending

## P5 - Ordinary open-source project journeys

### Deliverables

- Publish three fixed-commit, source-only journeys covering Node, Python, and a split-stack project.
- For each: scope, discovery, leads, false-positive closure, minimal patch or upstream repair,
  regression, retest, and unreached surfaces.
- Keep intentionally vulnerable benchmarks as ground truth, not as the only product story.

### Acceptance

- No third-party hosted instance is probed.
- Every confirmed statement links to immutable source evidence and a reproducible local path.
- Unknown and false-positive outcomes remain visible.

### Completion record

- Status: pending
- Implementation: pending
- Tests: pending
- Commit: pending
- Remaining risks: pending

## P6 - Distribution and release

### Deliverables

- Support install, upgrade, uninstall, version, and migration across Claude Code, Codex, and CLI.
- Publish the renamed composite Action and maintain `v1` plus immutable SHA documentation.
- Produce a GitHub Release with source archive, SPDX SBOM, checksums, provenance, and evidence note.
- Verify clean installation from the actual release artifact, not only the working tree.

### Acceptance

- Release/tag/version/evidence match and all public install commands run in clean temporary homes.
- Release assets verify by checksum and GitHub attestation.
- The Action succeeds and fails correctly from an external fixture repository or equivalent isolated
  consumer test.

### Completion record

- Status: pending
- Implementation: pending
- Tests: pending
- Release / Action pin: pending
- Remaining risks: pending

## P7 - Tutorial, contribution, and launch evidence

### Deliverables

- Publish a concise human tutorial and a separate agent bootstrap.
- Cover installation, first project, result interpretation, patch review, retest, troubleshooting,
  upgrade, uninstall, authorization, and false-positive reporting.
- Convert bounded roadmap work into labeled issues with contribution and test instructions.
- Prepare launch evidence using only reproducible counts, release links, and project journeys.

### Acceptance

- A clean-room first-time flow reaches a report in ten minutes on a supported fixture.
- Tutorial commands are tested as documentation examples.
- GitHub description, topics, homepage, README, tutorial, and release use the same promise.
- No star target is used as an engineering acceptance criterion.

### Completion record

- Status: pending
- Implementation: pending
- Tests: pending
- Commit / public URLs: pending
- Remaining risks: pending

## Program completion

The program is complete only when P0-P7 are completed, the final worktree is clean, required CI and
release checks pass, public links resolve, and any unavoidable external limitation is recorded with
an exact owner action rather than silently marked done.
