# Roadmap

The roadmap separates shipped behavior from proposed work. An unchecked item is not available until
its acceptance test lands. Priorities are correctness and evidence integrity first, then platform
coverage and adoption.

## Shipped in v0.3.0

- Unified `webapp-security` CLI with `start`, `audit`, `explain`, required-baseline `retest`, local
  demo and lifecycle commands.
- Stable JSON finding/report schemas rendered to Markdown, escaped HTML, SARIF 2.1.0 and JUnit.
- Network-free project discovery and narrow source rules with explicit `confirmed`, `suspected`,
  `unknown` and `not_applicable` states.
- Passive-by-default crawl and edge verification with authorization gates before active probes.
- Composite GitHub Action, stable `v1` alias and immutable full-SHA example.
- Claude Code, Codex and ordinary CLI installation, legacy migration, timestamped backups, upgrade
  and guarded uninstall.
- Reproducible source archive, SPDX SBOM, release manifest, checksums, provenance attestation and
  signed release tags.
- Three fixed-commit ordinary-project journeys plus five separate source methodology studies.

See the [v0.3.0 release evidence](docs/releases/v0.3.0.md) and
[generated capability matrix](docs/capabilities.md) for exact boundaries.

## Shipped in v0.4.0

The published v0.4.0 release implements cross-project baseline isolation, honest incomplete-scan semantics,
domain-separated risk reporting, private atomic evidence output, stable Gitleaks and OSV-Scanner
adapters, and regenerated evidence from five fixed-commit ordinary Web projects. It remains an
agent-guided hardening skill with narrow deterministic automation, not a general SAST/DAST scanner.

The complete milestone sequence, tests, stop conditions and Definition of Done live in the
[v0.4.0 engineering plan](docs/V0.4.0_ENGINEERING_PLAN.md). The signed release, immutable asset
verification, verified installer, exact-version external consumer and owner-approved public `v1`
promotion are complete. Final M8 evidence is recorded in the engineering plan.

## Correctness backlog

Included in the published v0.4.0 release:

- [x] [#1](https://github.com/parousia8888/web-app-security-skill/issues/1): malformed, empty, stale
  and wrong-product crawler-range fixtures; invalid evidence is `unverifiable` and exit `3`.
- [x] [#2](https://github.com/parousia8888/web-app-security-skill/issues/2): fake AWS CLI
  permission-denied fixtures preserve `UNCHECKED` and never synthesize MFA/CloudTrail findings.
- [x] [#5](https://github.com/parousia8888/web-app-security-skill/issues/5): sitemap entities, CDATA,
  malformed XML, external declarations and off-origin entries are covered by local fixtures.

Still open:

- [#4](https://github.com/parousia8888/web-app-security-skill/issues/4): an informational
  `security.txt` check that never labels absence a vulnerability.
- [#6](https://github.com/parousia8888/web-app-security-skill/issues/6): ShellCheck and an
  evidence-based coverage threshold without weakening Bash 3.2 support.
- [#7](https://github.com/parousia8888/web-app-security-skill/issues/7): Gitleaks/OSV evidence-only
  adapters and the [response-policy template](docs/alert-policy.md) are implemented on `main`;
  blocking use remains pending explicit signal-owner assignments and owner acceptance.

## Platform and documentation backlog

- [#3](https://github.com/parousia8888/web-app-security-skill/issues/3): verify and document
  install, lifecycle and tutorial behavior on a clean WSL2 image.
- Add source adapters only with planted failure fixtures and stable evidence output.
- Add policy packs for common deployment controls only when their patch and rollback behavior can be
  retested without claiming broad scanner coverage.

Tracked, contributor-ready items and acceptance tests live in
[`docs/GOOD_FIRST_ISSUES.md`](docs/GOOD_FIRST_ISSUES.md). The GitHub issue, not this summary, owns
implementation discussion and status.
