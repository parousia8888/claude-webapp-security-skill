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
  <a href="#3-ordinary-project-journeys">Project journeys</a> ·
  <a href="README.zh-CN.md">中文</a>
</p>

<p align="center">
  For web product owners and builders using AI coding agents; no offensive-security background is
  required. Start with the local result below, then install and run the first-project prompt.
</p>

<p align="center">
  <a href="docs/demo-evidence.md"><img src="docs/assets/demo.gif" alt="Owned local fixture: audit finds 13 high and 6 medium issues, a reviewable patch is shown, and the same path retests at 0 high and 0 medium"></a>
</p>

<p align="center"><a href="docs/demo-evidence.md">Read the generated reports and patch behind this demo.</a></p>

## See the result

Run an intentionally misconfigured local web app, audit it, apply the fixture's hardening, and
retest it through the same product path. Nothing reaches the network.

| Input | Confirmed before | Reviewable change | Retest |
|---|---|---|---|
| Owned local fixture | 13 high, 6 medium | crawl policy, exposed artifacts, unknown-route status | 0 high, 0 medium |

```bash
git clone https://github.com/parousia8888/web-app-security-skill.git
cd web-app-security-skill
npm run demo -- --out ./demo-output
```

Read the [generated before / proposed change / retest evidence](docs/demo-evidence.md), then inspect
`demo-output/summary.md`, `before.json`, `hardening.patch`, and `after.json`. The repository check
regenerates this evidence and fails if the result changes without an update.

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

This creates `.webapp-security/runs/<run-id>/security-scope.yml`, records detected framework,
package manager, lockfile and deployment/config paths, and performs no network access. Review the
scope, then send:

```text
Use $web-app-security on this repository. Start with source and local checks only. Record scope and assumptions. Classify every result as confirmed, suspected, unknown, or not_applicable. Prepare the smallest reviewable hardening patch, do not apply risky or production changes without approval, retest every applied fix, and finish with fixed, remaining, and unreached risks.
```

The deterministic source path can then run as:

```bash
webapp-security audit . --fail-on high
webapp-security explain <finding-id> --report .webapp-security/runs/<run-id>/report.json
webapp-security retest . --baseline .webapp-security/runs/<run-id>/report.json
```

Each audit writes JSON, Markdown, HTML, SARIF, JUnit and `proposed.patch`. The patch is never applied
by this command and never counts as fixed until retest evidence removes the finding. The broader
agent task still delivers recorded scope, sanitized findings, reviewed changes, retest evidence and
remaining/unreached risks. None of these commands grants permission to probe a deployment.

## Capability boundary

The project has 3 capability levels:

- **Automated and regression-tested:** project discovery/scoping, narrow source rules, stable
  multi-format reports and baseline retest, the local demo, crawl-boundary audit, crawler identity,
  edge verification, installer and GitHub Action run through deterministic product paths.
- **Agent-guided methodology:** frontend, API, LLM/OAuth, server, database, supply-chain, detection
  and AWS reviews require project context and agent judgment. They are not one automatic scan.
- **Planned:** new framework/rule adapters and deeper deterministic checks remain planned until
  planted regressions prove them.

The [generated capability matrix](docs/capabilities.md) links every statement to evidence. Results
are `confirmed`, `suspected`, `unknown`, or `not_applicable`; a check that could not run is never a
pass. Installing the Skill does not prove a project secure.

## Deterministic tools

Ask Claude Code or Codex to use `web-app-security`, or run the same deterministic tools
directly:

```bash
# Network-free project discovery and versioned scope
webapp-security start .

# Source-only audit, explain and required-baseline retest
webapp-security audit . --fail-on high
webapp-security explain <finding-id> --report <report.json>
webapp-security retest . --baseline <report.json> --fail-on high

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

## GitHub Action

The composite Action is passive by default and will not run until authorization is acknowledged:

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

## 3 ordinary project journeys

The ordinary-project set runs the current deterministic path, then records manual trace,
false-positive closure, repair/retest and unreached surfaces. All source is pinned to immutable
commits; no hosted instance was probed.

| Project | Deterministic result | Manual outcome |
|---|---|---|
| [Linkwarden](docs/case-studies/journeys/linkwarden.md) | 0 findings after workspace/template precision fixes | URL-fetch path traced to scheme, DNS/IP and redirect controls; scoped `not_applicable` |
| [Healthchecks](docs/case-studies/journeys/healthchecks.md) | 0 findings after requirements/template precision fixes | Production environment values remain `unknown` from source |
| [Open WebUI](docs/case-studies/journeys/open-webui.md) | 1 medium `suspected` source-map lead | Local representative patch retests `fixed`; public delivery remains unknown |

Read the [structured journeys, exact commands and evidence boundary](docs/case-studies/journeys/README.md).
Zero-finding and false-positive outcomes are kept visible; this is not a precision score.

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
demo, project-journey, methodology-study and release facts.

MIT licensed.
