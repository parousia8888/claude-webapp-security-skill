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

## Correctness backlog

- Malformed, empty and stale crawler-range JSON fixtures with fail-closed result semantics.
- Fake AWS CLI permission-denied fixtures that preserve `UNCHECKED` rather than pass.
- Sitemap XML entities and CDATA regression fixtures.
- An informational `security.txt` check that never labels absence a vulnerability.
- ShellCheck and an evidence-based coverage threshold without weakening Bash 3.2 support.
- Dependency review and secret scanning after alert ownership and response policy are documented.

## Platform and documentation backlog

- Verify and document install, lifecycle and tutorial behavior on a clean WSL2 image.
- Add source adapters only with planted failure fixtures and stable evidence output.
- Add policy packs for common deployment controls only when their patch and rollback behavior can be
  retested without claiming broad scanner coverage.

Tracked, contributor-ready items and acceptance tests live in
[`docs/GOOD_FIRST_ISSUES.md`](docs/GOOD_FIRST_ISSUES.md). The GitHub issue, not this summary, owns
implementation discussion and status.
