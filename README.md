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
  <a href="#see-the-full-loop-in-under-a-second">Demo</a> ·
  <a href="#install-once">Install</a> ·
  <a href="#use-it">CLI</a> ·
  <a href="#github-action">GitHub Action</a> ·
  <a href="#five-source-case-studies">Case studies</a> ·
  <a href="README.zh-CN.md">中文</a>
</p>

<p align="center">
  Give an AI coding agent a web project. The Skill scopes the work, finds explainable risks,
  prepares reviewable hardening changes, retests them, and records what is fixed and what remains.
</p>

## Capability boundary

The project has three explicit capability levels:

- **Automated and regression-tested:** the local demo, crawl-boundary audit, crawler identity,
  edge verification, installer and GitHub Action run through deterministic product paths.
- **Agent-guided methodology:** frontend, API, LLM/OAuth, server, database, supply-chain, detection
  and AWS reviews require project context and agent judgment. They are not one automatic scan.
- **Planned:** automatic project discovery, stable multi-format findings and a general patch/retest
  baseline loop are not shipped yet.

The [generated capability matrix](docs/capabilities.md) links every statement to evidence. Results
are `confirmed`, `suspected`, `unknown`, or `not_applicable`; a check that could not run is never a
pass. Installing the Skill does not prove a project secure.

## See the full loop in under a second

Run an intentionally misconfigured local web app, audit it, apply the fixture's hardening, and
retest it. Nothing reaches the network.

```bash
git clone https://github.com/parousia8888/web-app-security-skill.git
cd web-app-security-skill
npm run demo -- --out ./demo-output
```

```text
before: 13 high, 6 medium
after:   0 high, 0 medium
```

| Input | Before | Patch evidence | Retest |
|---|---|---|---|
| Local insecure fixture | robots blocks search/AI, sitemap is disallowed, `/.env` and source map return 200, unknown routes soft-404 | public crawl policy restored; sensitive artifacts and unknown routes return 404 | same real CLI path, `13H / 6M -> 0H / 0M` |

Inspect [`before.md`](examples/insecure-demo/README.md), generated `demo-output/hardening.patch`,
and `demo-output/after.md`. The counts are regression-tested; they are not hand-written screenshots.

## Install once

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

## Use it

Ask Claude Code or Codex to use `web-app-security`, or run the same deterministic tools
directly:

```bash
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

Replace the placeholder with a full commit SHA after this migration lands. The planned stable alias
is:

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

## Five source case studies

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
