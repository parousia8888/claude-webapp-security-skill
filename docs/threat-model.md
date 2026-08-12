# Threat Model

## Assets and trust boundaries

The project protects four assets: the target application's availability, confidential evidence,
the correctness of audit verdicts, and crawler/search availability. Trust boundaries exist between
the user and agent, the local skill and target, vendor-published crawler data, cloud APIs, CI, and
release consumers.

## In-scope threats

| Threat | Consequence | Primary controls |
|---|---|---|
| Unauthorized active testing | Legal or operational harm | Phase 0 gate; active probes opt-in |
| False `verified` crawler | Attacker gains a rate-limit exemption | Product-specific published ranges or FCrDNS |
| False `spoofed` crawler | Legitimate search/AI traffic is blocked | Fail open on unavailable evidence; exact source matching |
| Network failure reported as safe | Missing control is trusted | Explicit `unknown`; non-zero exit |
| Secret leakage in reports | Credential or user-data exposure | Sanitized evidence contract; private reporting |
| CI/release substitution | Consumers run modified code | Full-SHA actions, checksums, SPDX SBOM, artifact attestation |
| Agent overreach | Destructive or out-of-scope actions | Read-only default; minimum proof; explicit phase routing |
| Denial of service by verification | Target availability impact | Bounded concurrency; active rate test opt-in; `--n` cap |

## Non-goals

The project does not make a site secure by installing the skill, replace authenticated application
testing, prove absence of vulnerabilities, or authorize testing of third-party systems. User-agent
identity never grants access to private routes.

## Security invariants

1. Unknown evidence must never be rendered as passing.
2. A crawler claim is verified only by evidence for that exact product or by matching FCrDNS.
3. Active traffic beyond ordinary page retrieval requires an authorization anchor and explicit flag.
4. A confirmed bug fix must have a regression that fails when the bug is restored.
5. Reports must state what was not reached and keep suspected findings separate from confirmed ones.
