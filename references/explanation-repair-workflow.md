# Explanation and repair workflow

Use this workflow after a finding exists. It governs interpretation and repair; it does not add
detector evidence or permission to change a project.

## Two independent states

Never merge these axes:

| Axis | States | Question answered |
|---|---|---|
| Finding evidence | `confirmed`, `suspected`, `unknown`, `not_applicable` | What does the audit currently prove? |
| Repair workflow | `review_required`, `ready_for_review`, `approved`, `applied`, `retested`, `rolled_back` | What has actually happened to the proposed change? |

A patch can be `applied` while the original finding remains `suspected`. A finding can become
baseline `fixed` only through the report identity, coverage and retest contract. Never infer either
state from the other.

## Present every actionable finding

Use this order:

1. Professional term and evidence status.
2. Plain-language meaning.
3. Realistic consequence, phrased conditionally when evidence is suspected or unknown.
4. What the evidence proves and does not prove.
5. Proposed change and touched files/configuration.
6. Assumptions and viable alternatives.
7. Side effects and blast radius.
8. Decisions the user must make.
9. Separate security and functional retests.
10. Observable rollback condition and rollback action.

Do not use standards mappings as proof. Do not describe an `unknown` scanner result as a
vulnerability. Explain how to obtain the missing evidence.

## Approval gate

Create a repair record with `webapp-security repair-plan`. Do not apply changes while approval is
pending or rejected. Ask for an explicit decision before changing:

- authentication or authorization behavior;
- public routes, CORS, cookies, sessions or OAuth/OIDC;
- stored data, retention, schema or destructive migrations;
- production infrastructure, IAM, network, CDN/WAF or crawler access;
- any behavior whose allowed values or owners are not recorded.

If a policy choice is missing, show the exact question and pause. Do not choose allowed origins,
roles, retention periods, public paths or deployment behavior for the user.

## Application and verification

After approval:

1. Apply only the reviewed paths and record actual changed paths.
2. Run the smallest security-specific retest named by the finding.
3. Run project-native tests and the affected user journey.
4. Record each result as `passed`, `failed` or `unknown`; unavailable is `unknown`, never pass.
5. Advance to `retested` only when both security and functional verification passed.
6. If behavior regresses, execute or propose the recorded rollback and mark `rolled_back` only
   after it actually occurs.

Never install or execute a target project's dependencies without the user's authorization. When
project-native tests cannot be run under the current boundary, record functional verification as
`unknown` and leave the workflow short of `retested`.

## Scenario checks

- Cookie flag: explain session theft conditionally, ask whether browser code reads the cookie, and
  test login, refresh and logout after the security check.
- Unknown scanner: explain the evidence gap and tested version needed; do not propose an applied
  source change.
- CORS: require the owner to list approved origins per environment; never invent the allowlist.
- Command execution lead: keep it suspected until input influence and reachability are established;
  explain that removing shell parsing may break pipes, redirects or wildcard behavior.
