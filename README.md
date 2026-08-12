<h1 align="center">Web App Security Skill</h1>
<h3 align="center">Evidence-first audit, hardening and retest for AI coding agents</h3>

<p align="center">
  <a href="https://github.com/parousia8888/web-app-security-skill/tags"><img src="https://img.shields.io/github/v/tag/parousia8888/web-app-security-skill?sort=semver" alt="latest tag"></a>
  <a href="https://github.com/parousia8888/web-app-security-skill/actions/workflows/ci.yml"><img src="https://github.com/parousia8888/web-app-security-skill/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://github.com/parousia8888/web-app-security-skill/actions/workflows/codeql.yml"><img src="https://github.com/parousia8888/web-app-security-skill/actions/workflows/codeql.yml/badge.svg" alt="CodeQL"></a>
  <a href="https://github.com/parousia8888/web-app-security-skill/stargazers"><img src="https://img.shields.io/github/stars/parousia8888/web-app-security-skill?style=flat&logo=github" alt="stars"></a>
  <a href="https://github.com/parousia8888/web-app-security-skill/network/members"><img src="https://img.shields.io/github/forks/parousia8888/web-app-security-skill?style=flat&logo=github" alt="forks"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-green" alt="MIT license"></a>
  <a href="#trust-and-release-evidence"><img src="https://img.shields.io/badge/SBOM-SPDX%202.3-5965d8" alt="SPDX 2.3 SBOM"></a>
</p>

<p align="center">
  <a href="#see-the-result">Demo</a> ·
  <a href="#install">Install</a> ·
  <a href="#run-the-first-project">First project</a> ·
  <a href="#github-action">GitHub Action</a> ·
  <a href="#5-source-case-studies">Case studies</a> ·
  <a href="README.zh-CN.md">中文</a>
</p>

<p align="center">
  For web product owners and builders using AI coding agents; no offensive-security background is
  required. Start with the local result below, then install and run the first-project prompt.
</p>

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

## Install

This one command installs the skill for Claude Code and Codex, plus the ordinary CLI under
`~/.local/bin`. Existing installs are refused unless you explicitly pass `--force`, which creates
timestamped backups before replacement.

```bash
git clone --depth 1 https://github.com/parousia8888/web-app-security-skill.git /tmp/web-app-security-skill \
  && node /tmp/web-app-security-skill/scripts/webapp-security.mjs install
```

Select a surface when needed:

```bash
node scripts/webapp-security.mjs install --target claude
node scripts/webapp-security.mjs install --target codex
node scripts/webapp-security.mjs install --target cli
node scripts/webapp-security.mjs install --target both   # Claude Code + Codex
```

Supported environments and current limits are recorded in the
[compatibility matrix](docs/compatibility.md).

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

The expected deliverable is a recorded scope, sanitized findings, a proposed or approved patch,
retest evidence, and explicit remaining/unreached risks. The prompt grants no permission to probe a
deployment; active traffic still requires ownership or written authorization and a separate gate.

## Capability boundary

The project has 3 capability levels:

- **Automated and regression-tested:** project discovery/scoping, the local demo, crawl-boundary
  audit, crawler identity, edge verification, installer and GitHub Action run through deterministic
  product paths.
- **Agent-guided methodology:** frontend, API, LLM/OAuth, server, database, supply-chain, detection
  and AWS reviews require project context and agent judgment. They are not one automatic scan.
- **Planned:** stable multi-format findings and a general patch/retest baseline loop are not shipped
  yet.

The [generated capability matrix](docs/capabilities.md) links every statement to evidence. Results
are `confirmed`, `suspected`, `unknown`, or `not_applicable`; a check that could not run is never a
pass. Installing the Skill does not prove a project secure.

## Deterministic tools

Ask Claude Code or Codex to use `web-app-security`, or run the same deterministic tools
directly:

```bash
# Network-free project discovery and versioned scope
webapp-security start .

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
  uses: parousia8888/web-app-security-skill@c27a8ecae69271a5a2fdfb6acc314cb4ef3ea967
  with:
    site: https://example.com
    acknowledge-authorization: true
    active-probe: false
    fail-on: high
```

The example is pinned to an immutable commit. The planned stable major-version alias is:

```yaml
uses: parousia8888/web-app-security-skill@v1
```

The moving `v1` tag is created only after the first renamed release passes its consumer tests.

## Trust and release evidence

- CI runs Ubuntu/macOS x Node 20/22, deterministic HTTP/HTTPS fixtures and Bash 3.2 smoke tests.
- Third-party Actions in release and CodeQL workflows are pinned to full commit SHAs.
- Tagged releases require matching `VERSION`, changelog and a versioned evidence note.
- Release assets contain a reproducible source archive, SPDX 2.3 SBOM, `SHA256SUMS` and GitHub
  build-provenance attestation.
- [`SECURITY.md`](SECURITY.md), [threat model](docs/threat-model.md),
  [false-positive policy](docs/false-positive-policy.md) and
  [compatibility matrix](docs/compatibility.md) make the trust boundary reviewable.

Verify downloaded release assets:

```bash
sha256sum -c SHA256SUMS
gh attestation verify web-app-security-skill-*.tar.gz \
  --repo parousia8888/web-app-security-skill
```

## 5 source case studies

The corpus combines three intentionally vulnerable benchmarks with two production projects. All
five are pinned to immutable commits and reviewed source-only; no hosted instance was probed.

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

MIT licensed.
