# Capability matrix

<!-- Generated from docs/capabilities.json. Run `node scripts/generate-capability-matrix.mjs`. -->

This matrix separates deterministic product behavior from work an AI agent performs using the
Skill methodology. Installing the Skill does not prove that a web project is secure.

## Automated and regression-tested

| Capability | Current boundary | Evidence |
|---|---|---|
| Local before/after demo | Runs the real crawl audit against an intentionally misconfigured local fixture, records JSON/Markdown evidence and a fixture patch, then retests. | [`scripts/demo.mjs`](../scripts/demo.mjs), [`test/product-surfaces.test.mjs`](../test/product-surfaces.test.mjs) |
| Crawl-boundary audit | Checks robots, sitemap, crawler accessibility, soft-404 behavior and optional authorized sensitive-path probes. | [`scripts/crawl-surface-audit.mjs`](../scripts/crawl-surface-audit.mjs), [`test/integration.test.mjs`](../test/integration.test.mjs), [`test/product-surfaces.test.mjs`](../test/product-surfaces.test.mjs) |
| Crawler identity verification | Verifies an exact crawler product through published ranges or matching forward-confirmed reverse DNS; a user-agent string is never sufficient. | [`scripts/verify-crawler-ip.mjs`](../scripts/verify-crawler-ip.mjs), [`test/verify-crawler-ip.test.mjs`](../test/verify-crawler-ip.test.mjs), [`test/integration.test.mjs`](../test/integration.test.mjs) |
| Edge hardening verification | Checks security headers, HTTP-to-HTTPS redirect, certificate validation and TLS policy; bounded rate-limit traffic is separately authorized. | [`scripts/verify-hardening.sh`](../scripts/verify-hardening.sh), [`test/verify-hardening.test.mjs`](../test/verify-hardening.test.mjs) |
| Installer and GitHub Action | Installs Claude Code, Codex and CLI surfaces with conflict preflight/backups, and runs a passive-by-default composite Action with an authorization gate. | [`scripts/webapp-security.mjs`](../scripts/webapp-security.mjs), [`action.yml`](../action.yml), [`test/product-surfaces.test.mjs`](../test/product-surfaces.test.mjs) |
| Automatic project discovery and scoped run | Detects supported Node/Python and split-stack projects, package managers, lockfiles and config/deployment paths, then creates a versioned network-free security scope. It never establishes deployment ownership. | [`scripts/project-start.mjs`](../scripts/project-start.mjs), [`scripts/lib/project-discovery.mjs`](../scripts/lib/project-discovery.mjs), [`test/project-discovery.test.mjs`](../test/project-discovery.test.mjs), [`docs/security-scope.schema.json`](../docs/security-scope.schema.json) |
| Stable multi-format finding reports | Renders the versioned finding/report schema as JSON, Markdown, escaped HTML, SARIF 2.1.0 and JUnit while preserving evidence states and stable fingerprints. | [`docs/finding.schema.json`](../docs/finding.schema.json), [`docs/report.schema.json`](../docs/report.schema.json), [`scripts/lib/evidence.mjs`](../scripts/lib/evidence.mjs), [`test/evidence-loop.test.mjs`](../test/evidence-loop.test.mjs) |
| General patch and retest loop | Runs narrow deterministic source rules, writes patch-only proposals, explains findings and compares required retest baselines as new/fixed/unchanged/regressed. Agent-guided reviews still require agent-authored findings. | [`scripts/project-audit.mjs`](../scripts/project-audit.mjs), [`scripts/lib/source-audit.mjs`](../scripts/lib/source-audit.mjs), [`scripts/explain-finding.mjs`](../scripts/explain-finding.mjs), [`test/evidence-loop.test.mjs`](../test/evidence-loop.test.mjs) |

## Agent-guided methodology

| Capability | Current boundary | Evidence |
|---|---|---|
| Frontend exposure review | Guides source/build-artifact review for secrets, source maps, endpoints, client-side trust and CSP. It is not a general automatic frontend scanner. | [`references/phase-1-frontend.md`](../references/phase-1-frontend.md), [`references/exposure-checks.md`](../references/exposure-checks.md) |
| API and business-logic review | Guides scoped review of authentication, object/function authorization, abuse controls, races, injection, SSRF and data exposure. | [`references/phase-2-api.md`](../references/phase-2-api.md) |
| LLM and OAuth/OIDC review | Guides context-dependent review of prompt injection, cost abuse, tool permissions, OAuth state/PKCE and identity linking. | [`references/phase-3-llm-identity.md`](../references/phase-3-llm-identity.md) |
| Server code and data-layer review | Guides source and architecture review for dangerous sinks, authorization coverage, secret handling, tenant isolation, least privilege, backup and integrity. | [`references/phase-4-code-audit.md`](../references/phase-4-code-audit.md), [`references/phase-5-database.md`](../references/phase-5-database.md) |
| Supply-chain and detection review | Guides dependency, browser script, container, CI/CD, logging, alerting and incident-response review; existing release SBOM generation covers this repository only. | [`references/phase-6-supply-chain.md`](../references/phase-6-supply-chain.md), [`references/phase-7-detection.md`](../references/phase-7-detection.md) |
| AWS posture review | Provides a read-only inventory helper and an agent review guide. The helper is not yet backed by a deterministic fake-AWS regression fixture. | [`scripts/aws-exposure-audit.sh`](../scripts/aws-exposure-audit.sh), [`references/aws-hardening.md`](../references/aws-hardening.md) |

## Planned

| Capability | Current boundary | Evidence |
|---|---|---|

## Result states

| State | Meaning |
|---|---|
| `confirmed` | Reproduced with sufficient sanitized evidence. |
| `suspected` | A lead that still needs context or reproduction. |
| `unknown` | The check or evidence source was unavailable. |
| `not_applicable` | Outside the recorded scope or absent from the project. |

An unavailable check is `unknown`, never a pass. Only a reproduced result with sufficient
sanitized evidence is `confirmed`.

