# Phase 8 — Reporting, retest, and regression

An audit that produces a list nobody can act on has produced nothing. This phase converts findings into fixes that stay fixed.

## 1. Finding format

One entry per finding. Keep it short enough to read and complete enough to fix.

```markdown
### F-07 — Reward claim is not atomic (race condition)

- **Severity:** high            (impact × exploitability, justified in one line)
- **Status:** confirmed         (confirmed | suspected | not-reproducible)
- **Phase / stage:** 2 / stage 6
- **Component:** POST /api/billing/reward-claims
- **Impact:** a user can claim the same reward N times; credits are money
- **Reproduction:** two concurrent POSTs with the same reward id on test account A;
  balance increased by 2 (markers: claim ids <redacted-a>, <redacted-b>)
- **Evidence:** reports/2026-08-14/f07-concurrent-claims.txt (redacted)
- **Root cause:** read-modify-write on the balance without a transaction or unique key
- **Enforcing layer:** database (unique index) + application (transaction)
- **Fix:** unique index on (userId, rewardId); wrap claim in a transaction; return the
  existing claim on duplicate-key instead of erroring
- **Retest:** rerun the concurrent-claim script; expect one claim, balance +1
- **Blast radius of the fix:** touches the claim path only; deploy behind a flag
```

Rules:
- **Never blend confirmed and suspected.** A grep hit is `suspected` until a request or a read of the code path proves it.
- Severity is justified, not asserted. "High because an unauthenticated user can read any other user's readings" is a justification; "High" alone is not.
- Redact evidence at write time — tokens, cookies, headers, emails, other users' identifiers, real IPs.
- If a finding could not be tested (no access, out of scope, gate not granted), record it as **untested**, not as absent.

## 2. Report structure

```
1. Scope and authorization      target, environment, window, auth basis, exclusions
2. Method                       phases run, tools, read-only vs active, coverage limits
3. Executive summary            5 lines: what is at risk, what to do first
4. Findings                     sorted by severity, using the format above
5. What this does not prove     unreached surfaces, JS-rendered content, unaudited
                                permissions, untested phases
6. Priority plan                this week / high / medium / continuous
7. Retest plan                  per finding: who verifies, how, when
8. Appendix                     raw artifacts index (redacted), tool versions, commands
```

Section 5 is not optional and not a disclaimer. It is the difference between an audit and a false sense of safety.

## 3. Prioritization

Rank by **exploitability × blast radius**, then by fix cost. A realistic order for a small team:

| Tier | Typical members |
|---|---|
| This week | anything unauthenticated and remotely exploitable; exposed secrets (rotate first, fix after); money-path races; missing rate limit on cost/abuse endpoints; database or admin panel reachable from the internet |
| High | BOLA on user data; auth-middleware gaps; SSRF; supply-chain keys in CI; IMDSv1 |
| Medium | frontend exposure reduction; CSP; supply chain SBOM/SRI; log retention |
| Continuous | detection rules, alarms, dependency updates, quarterly access review |

If a secret was exposed, **rotation is the fix and it is immediate**. Removing it from the repo is cleanup, not remediation.

## 4. Retest

- Every `confirmed` finding gets a retest with the **same reproduction steps**, recorded with a date and a result.
- Retest in the same environment class where it was found.
- A fix that changes behaviour on a public path triggers a crawl re-check (`crawl-surface-audit.mjs` UA matrix) — WAF and rate-limit fixes are the usual offenders.
- Findings that come back get a root-cause note: why did the fix not hold?

Retest ledger:

| ID | Severity | Fixed at | Retested at | Result | Notes |
|---|---|---|---|---|---|
| F-07 | high | 2026-08-16 | 2026-08-17 | pass | unique index confirmed via duplicate-key path |

## 5. Regression — making fixes permanent

A fix without a test is a fix with a shelf life.

- **Auth coverage test** over the route table (Phase 4 §3) — catches the next unprotected route.
- **A test per confirmed finding**, at least for the high ones: concurrent claim, cross-account fetch, rate-limit assertion, prompt-injection marker.
- **CI gates**: semgrep, secret scan, `npm audit`/osv threshold, and a build-artifact check (no `.map`, no `console.log`, no secret-shaped strings).
- **Scheduled re-audit**: monthly `crawl-surface-audit.mjs` + `aws-exposure-audit.sh`, diffed against the previous run. Drift is the normal failure mode; the diff is what catches it.
- Record the audit date and version in the repo so the next person knows what was covered and when.

## 6. Communicating to non-security stakeholders

- Lead with what an attacker could do to the business, not with the CWE number.
- Give each item a cost: engineer-hours and any risk the fix itself carries.
- Be explicit when a "finding" is a deliberate trade-off (e.g. public content must stay open to all IPs — that is a requirement, not a vulnerability).
- Do not inflate severity to force action. It works once.

## Exit criteria

```
[ ] every finding has severity, status, reproduction, fix, and enforcing layer
[ ] confirmed and suspected clearly separated
[ ] "what this does not prove" written and specific
[ ] priority plan agreed with the person who will do the work
[ ] retest ledger started; each confirmed finding has a retest owner
[ ] regression tests and CI gates added for the high-severity findings
[ ] next audit scheduled
```
