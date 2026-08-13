<h1 align="center">Web App Security Skill</h1>
<h3 align="center">Scope, audit, harden, and retest web projects with AI coding agents and reproducible evidence.</h3>

<p align="center">
  <a href="https://github.com/parousia8888/web-app-security-skill/tags"><img src="https://img.shields.io/github/v/tag/parousia8888/web-app-security-skill?sort=semver" alt="latest tag"></a>
  <a href="https://github.com/parousia8888/web-app-security-skill/actions/workflows/ci.yml"><img src="https://github.com/parousia8888/web-app-security-skill/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://github.com/parousia8888/web-app-security-skill/actions/workflows/codeql.yml"><img src="https://github.com/parousia8888/web-app-security-skill/actions/workflows/codeql.yml/badge.svg" alt="CodeQL"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-green" alt="MIT license"></a>
  <a href="#trust-and-release-evidence"><img src="https://img.shields.io/badge/SBOM-SPDX%202.3-5965d8" alt="SPDX 2.3 SBOM"></a>
</p>

<p align="center">
  <a href="#see-the-result">Demo</a> ·
  <a href="#install">Install</a> ·
  <a href="#run-the-first-project">First project</a> ·
  <a href="docs/tutorial.md">Tutorial</a> ·
  <a href="#github-action">GitHub Action</a> ·
  <a href="#5-ordinary-project-journeys">Project journeys</a> ·
  <a href="README.zh-CN.md">中文</a>
</p>

<p align="center">
  For web product owners and builders using AI coding agents; no offensive-security background is
  required. Start with the local result below, then install and run the first-project prompt.
</p>

<p align="center">
  <a href="docs/demo-evidence.md"><img src="docs/assets/demo.gif" alt="Owned local fixture: audit finds 2 security HIGH, 11 discoverability HIGH plus 5 MEDIUM, and 1 reliability MEDIUM; a reviewable patch is shown and the same path retests with no active HIGH or MEDIUM findings"></a>
</p>

<p align="center"><a href="docs/demo-evidence.md">Read the generated reports and patch behind this demo.</a></p>

## See the result

Run an intentionally misconfigured local web app, audit it, apply the fixture's hardening, and
retest it through the same product path. Nothing reaches the network.

| Input | Security | Discoverability | Reliability | Reviewable change | Retest |
|---|---:|---:|---:|---|---|
| Owned local fixture | 2 HIGH | 11 HIGH + 5 MEDIUM | 1 MEDIUM | crawl policy, exposed artifacts, unknown-route status | 0 active HIGH / MEDIUM |

```bash
git clone https://github.com/parousia8888/web-app-security-skill.git
cd web-app-security-skill
npm run demo -- --out ./demo-output
```

Read the [generated before / proposed change / retest evidence](docs/demo-evidence.md), then inspect
`demo-output/demo-result.json`, `summary.md`, `before.json`, `hardening.patch`, and `after.json`.
Every public demo count is derived from `demo-result.json`; the repository check reruns the fixture
and fails if any surface disagrees.

For the complete install-to-uninstall path, follow the tested
[first project tutorial](docs/tutorial.md).

## Install

This one command installs the skill for Claude Code and Codex, plus the ordinary CLI under
`~/.local/bin`. Existing installs are refused unless you explicitly pass `--force`, which creates
timestamped backups before replacement. It downloads an immutable bootstrap, verifies its SHA-256
before execution, then verifies the selected release manifest, checksums, SBOM, source commit and
archive before installation.

```bash
( set -eu; p="$(mktemp "${TMPDIR:-/tmp}/web-app-security-bootstrap.XXXXXX")"; trap 'rm -f "$p"' EXIT HUP INT TERM; curl --proto '=https' --proto-redir '=https' --tlsv1.2 --fail --silent --show-error --location --output "$p" 'https://raw.githubusercontent.com/parousia8888/web-app-security-skill/55c3de22cb373581b9723467c0d2663917c6df84/scripts/bootstrap-install.sh?immutable=55c3de2'; node -e 'const c=require("node:crypto"),f=require("node:fs"),p=process.argv[1],e=process.argv[2],a=c.createHash("sha256").update(f.readFileSync(p)).digest("hex");if(a!==e){console.error(`bootstrap SHA-256 mismatch: ${a}`);process.exit(1)}' "$p" 'bdb3951d6085d24c83b7590c0295702cdce8b6c15b0247747bf93b67649e78bd'; sh "$p" )
```

Select a surface when needed:

```bash
sh bootstrap-install.sh --target claude
sh bootstrap-install.sh --target codex
sh bootstrap-install.sh --target cli
sh bootstrap-install.sh --target both   # Claude Code + Codex
```

The shortened examples assume you already downloaded and verified `bootstrap-install.sh` using the
command above. Explicit-version, offline/manual, attestation and trust-anchor details are in
[verified installation](docs/verified-installation.md). Supported environments and current limits
are recorded in the [compatibility matrix](docs/compatibility.md).

Check, upgrade, or remove an installation:

```bash
webapp-security version
# Run the verified bootstrap with --mode upgrade for a recognized installation.
sh bootstrap-install.sh --mode upgrade
webapp-security uninstall
```

`upgrade` replaces only installations carrying a recognized Web App Security Skill marker (or the
documented legacy Skill identity), and keeps timestamped backups. `uninstall` removes recognized
current installs but preserves those backups. Unknown directories and launchers are refused even
with `install --force`.

## Run the first project

Open the target repository in Claude Code or Codex and send this prompt:

```bash
webapp-security start .
```

This creates a private project identity plus `.webapp-security/runs/<run-id>/security-scope.yml`,
records detected framework, package manager, lockfile and deployment/config paths, and performs no
network access. Review the scope, then send:

```text
Use $web-app-security on this repository. Start with source and local checks only. Record scope and assumptions. Classify every result as confirmed, suspected, unknown, or not_applicable. Prepare the smallest reviewable hardening patch, do not apply risky or production changes without approval, retest every applied fix, and finish with fixed, remaining, and unreached risks.
```

The deterministic source path can then run as:

```bash
webapp-security audit .webapp-security/runs/<run-id> --fail-on high
webapp-security explain <finding-id> --report .webapp-security/runs/<run-id>/report.json
webapp-security start . --run-id <retest-run-id>
webapp-security retest .webapp-security/runs/<retest-run-id> \
  --baseline .webapp-security/runs/<run-id>/report.json
```

The default is the bundled, network-free source adapter. Optional external adapters are explicit:

```bash
webapp-security doctor . --adapter all --json
webapp-security audit . --adapter gitleaks --adapter osv --fail-on never
```

Tested versions are Gitleaks `8.30.1` and OSV-Scanner `2.5.0`. The CLI and Action do not download
them. OSV-Scanner may query the public OSV database; project dependencies are not executed. A
blocking external-adapter run additionally requires `--acknowledge-alert-policy` after the consuming
repository accepts the responsibilities in [`docs/alert-policy.md`](docs/alert-policy.md). See the
[`adapter protocol`](docs/adapter-protocol.md) for failure, redaction and version semantics.

Each source audit writes v2 JSON, Markdown, HTML, SARIF, JUnit, a SHA-256 sidecar and
`proposed.patch`. A direct project audit is allowed for one-off review but has ephemeral identity and
cannot be a retest baseline. `fixed` requires the same persisted subject and scope, a compatible
rule, completed current coverage and affirmative absence of the condition. The patch is never
applied by this command. None of these commands grants permission to probe a deployment.

Reports summarize by risk domain, then evidence state, then severity. The default CI policy gates
confirmed HIGH `security_exposure` and `supply_chain` findings only. Existing `--fail-on` behavior
continues to set those two domains; opt into another domain explicitly, for example:

```bash
webapp-security crawl --site https://example.com --out ./security-report \
  --fail-on high --fail-on-domain search_discoverability=high
```

Multiple `--fail-on-domain <domain=threshold>` options may be combined. Effective thresholds are
recorded in the report. The [generated rule taxonomy](docs/rule-taxonomy.md) records each built-in
source/crawl rule's domain, severity and rationale.

## Capability boundary

Capabilities use two independent dimensions so support tooling is not counted as vulnerability
coverage:

- **Category:** Detection; Evidence and reporting; Lifecycle and distribution; or Agent-guided
  methodology.
- **Maturity:** `stable`, `experimental`, `agent_guided`, or `planned`.

The current stable Detection families are the narrow built-in source audit, opt-in Gitleaks and
OSV-Scanner adapters, crawl-boundary audit, crawler identity verification, edge verification, and the read-only AWS inventory helper. Project discovery,
the demo, report renderers, retest infrastructure, installer, and GitHub Action are tested product
capabilities, but are not additional detector families. API authorization, business logic,
LLM/OAuth, data-layer and broader AWS
reviews remain Agent-guided methodology until a named adapter earns regression evidence.

The [generated capability matrix](docs/capabilities.md) links every category and maturity statement
to evidence. Results
are `confirmed`, `suspected`, `unknown`, or `not_applicable`; a check that could not run is never a
pass. Installing the Skill does not prove a project secure.

## Deterministic tools

Ask Claude Code or Codex to use `web-app-security`, or run the same deterministic tools
directly:

```bash
# Network-free project discovery and versioned scope
webapp-security start .

# Source-only audit, explain and required-baseline retest
webapp-security audit .webapp-security/runs/<run-id> --fail-on high
webapp-security doctor . --adapter all
webapp-security audit . --adapter gitleaks --adapter osv --fail-on never
webapp-security explain <finding-id> --report <report.json>
webapp-security start . --run-id <retest-run-id>
webapp-security retest .webapp-security/runs/<retest-run-id> \
  --baseline <report.json> --fail-on high

# Historical v1 reports stay non-comparable; moved/cloned projects require explicit binding
webapp-security migrate-report <v1-report.json> --scope <security-scope.yml> \
  --acknowledge-subject <subject-id> --out <new-directory>
webapp-security rebind <moved-project> --scope <security-scope.yml> \
  --acknowledge-subject <subject-id>

# Passive crawl-boundary and crawler accessibility audit
webapp-security crawl --site https://example.com --out ./security-report

# Active sensitive-path probes require both ownership/written authorization and an explicit gate
webapp-security crawl --site https://example.com --out ./security-report \
  --active-probe --acknowledge-authorization

# Crawler identity: exact product ranges or FCrDNS, never a user-agent string alone
webapp-security verify-crawler --ip 66.249.66.1 --ua Googlebot --ranges

# Passive headers, redirect, certificate and TLS policy verification
webapp-security verify-edge --site https://example.com

# Read-only AWS posture inventory
webapp-security aws --profile default --region us-east-1 --out ./security-report
```

Active rate-limit verification also requires `--acknowledge-authorization`. Network or evidence
failure is `unknown` and exits non-zero; it is never rendered as safe.

Source, crawl, demo, crawler identity, edge and AWS conclusions use the same v2 finding, coverage,
policy and exit-code runtime. Report bundles and their tool-specific observations are sanitized in
memory, staged as private files in the target directory, and committed together without overwriting
prior evidence. A renderer or handled write failure is rolled back without leaving a partial new
bundle. Historical v1 reports remain readable only for display, release verification and explicit
non-comparable migration; they are never accepted as a comparable baseline.

## GitHub Action

The composite Action keeps the v0.3 crawl inputs and outputs. Crawl mode is passive by default and
requires deployment authorization acknowledgement:

```yaml
- name: Audit public crawl boundary
  uses: parousia8888/web-app-security-skill@d7df9fa6efd466c3eb13768c3b9ad259d2636e04
  with:
    site: https://example.com
    acknowledge-authorization: true
    active-probe: false
    fail-on: high
```

For repeatable CI, use the immutable commit above. The stable major-version alias is:

```yaml
uses: parousia8888/web-app-security-skill@v1
```

Source mode defaults to the bundled adapter. External binaries must be installed and pinned by the
caller; the Action never downloads them:

```yaml
- name: Audit source
  uses: parousia8888/web-app-security-skill@v1
  with:
    mode: source
    project: .
    adapters: builtin
    fail-on: high
```

The moving `v1` tag is updated only after a versioned release passes the real consumer workflow;
review release notes before accepting an update to it.

## Trust and release evidence

- CI runs Ubuntu/macOS x Node 20/22, deterministic HTTP/HTTPS fixtures and Bash 3.2 smoke tests.
- Third-party Actions in release and CodeQL workflows are pinned to full commit SHAs.
- Tagged releases require matching `VERSION`, changelog and a versioned evidence note. The tag is
  signed and the release records its source commit.
- Release assets contain a reproducible source archive, SPDX 2.3 SBOM, `SHA256SUMS` and GitHub
  build-provenance attestation. CI builds the archive twice, compares every byte, then runs the
  lifecycle from the extracted archive in an isolated home with network access denied.
- [`SECURITY.md`](SECURITY.md), [threat model](docs/threat-model.md),
  [false-positive policy](docs/false-positive-policy.md) and
  [compatibility matrix](docs/compatibility.md) make the trust boundary reviewable.

Verify downloaded release assets:

```bash
sha256sum -c SHA256SUMS
gh attestation verify web-app-security-skill-*.tar.gz \
  --repo parousia8888/web-app-security-skill
git -c gpg.ssh.allowedSignersFile=.github/release-signers verify-tag v0.3.0
```

## 5 ordinary project journeys

The ordinary-project set runs the complete v2 source path: built-in rules, Gitleaks `8.30.1`, and
OSV-Scanner `2.5.0`, then records manual trace, false-positive closure, repair/retest and unreached
surfaces. All source is pinned to immutable commits; no hosted instance or project dependency was
executed. OSV alone may query its public advisory service, so its dated match counts can drift.

| Project | Evidence outcome | Manual outcome |
|---|---|---|
| [Linkwarden](docs/case-studies/journeys/linkwarden.md) | 0 confirmed; OSV matches remain suspected | Direct URL-fetch path scoped `not_applicable`; proxy path unreached |
| [Healthchecks](docs/case-studies/journeys/healthchecks.md) | 0 confirmed; Gitleaks doc/test matches suspected; OSV not applicable | Production environment values remain `unknown` |
| [Open WebUI](docs/case-studies/journeys/open-webui.md) | Source-map and OSV matches suspected | Local source-map fixture retests `fixed`; public delivery remains unknown |
| [Uptime Kuma](docs/case-studies/journeys/uptime-kuma.md) | 4 confirmed lockfile facts; external matches suspected | Operator webhook sink is not a vulnerability without a boundary bypass |
| [Mealie](docs/case-studies/journeys/mealie.md) | 0 confirmed; Gitleaks test-material matches suspected | Limited URL-fetch path scoped `not_applicable`; broader paths unknown |

Read the [structured journeys, exact commands and evidence boundary](docs/case-studies/journeys/README.md).
Confirmed source facts, scanner leads and false-positive outcomes are kept visible; this is not a
precision score. Uptime Kuma and Mealie overlap with the methodology corpus below at the same
commits, so these are two evidence views rather than ten distinct projects.

The **5 earlier source methodology studies** remain as a separate corpus: three intentionally
vulnerable benchmarks and two production projects.

| Project | Evidence outcome |
|---|---|
| [OWASP Juice Shop](docs/case-studies/juice-shop.md) | Confirmed intentional SQL injection plus upstream prepared-statement repair |
| [OWASP NodeGoat](docs/case-studies/nodegoat.md) | Confirmed intentional server-side `eval`, IDOR and open redirect |
| [DVWA](docs/case-studies/dvwa.md) | Confirmed low/impossible SQLi, XSS and command-injection control pairs |
| [Uptime Kuma](docs/case-studies/uptime-kuma.md) | SSRF-shaped outbound sinks closed as product behavior; no vulnerability counted |
| [Mealie](docs/case-studies/mealie.md) | URL-fetch lead traced to auth and private-IP guard; no vulnerability counted |

Read the [method and corpus limits](docs/case-studies/README.md). These are evidence for the
methodology, not a fabricated precision score for a CLI that is not yet a general SAST engine.

## Program map

| Phase | Focus | Active? |
|---|---|---|
| 0 | Scope, ownership and authorization anchor | gate |
| 1 | Frontend exposure | no |
| 2 | API: IDOR/BOLA, auth, limits, races, SSRF | yes |
| 3 | LLM abuse and OAuth/OIDC | yes |
| 4 | Server-side source audit | source access |
| 5 | Database and tenant isolation | yes |
| 6 | Supply chain, SBOM, SCA and SRI | partial |
| 7 | Blue-team detection | no |
| 8 | Report, patch evidence and retest | no |

Cross-cutting references cover crawl boundaries, verified crawler identity, source-map/dotfile
exposure, enforcement placement, AWS hardening, overlooked surfaces, regression gates and safe
deployment. Start from [`SKILL.md`](SKILL.md).

## Contributing

The [roadmap](ROADMAP.md) separates correctness work from adoption work. New contributors can start
from [bounded good-first issues](docs/GOOD_FIRST_ISSUES.md), the issue forms, and
[`CONTRIBUTING.md`](CONTRIBUTING.md). False-positive reports need a sanitized minimal fixture and
expected classification; sensitive details go through private vulnerability reporting.

The [generated launch evidence](docs/launch-evidence.md) collects only reproducible capability,
demo, project-journey, methodology-study and release facts. The
[publication kit](docs/adoption/launch-brief.md) provides evidence-linked drafts and a reusable
public/private case-study workflow without claiming that external publication has occurred.

MIT licensed.
