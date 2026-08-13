# External adapter alert policy

Status: **owner acceptance pending**. This document defines the conditions a repository must accept
before Gitleaks or OSV-Scanner findings become a merge or release gate. It does not assign a person,
enable a GitHub setting or close Issue #7.

## Required assignment

Before passing `--acknowledge-alert-policy` with a blocking threshold, record all of the following in
the consuming repository:

| Responsibility | Required value |
|---|---|
| Signal owner | Named team or person who receives and closes secret/dependency alerts |
| Triage target | Confirm receipt of a HIGH secret alert within one business day; dependency findings within three business days |
| Update owner | Named team or person responsible for adapter/ruleset updates and fixture review |
| Private escalation | A non-public channel for live credentials, private source details and embargoed advisories |
| Gate authority | Named maintainer who may suppress, downgrade or temporarily disable the gate |

The owner chooses the actual assignments and may set stricter targets. Until those assignments are
accepted, run external adapters with `--fail-on never` and treat their reports as evidence only.

## Triage and suppression

1. Reproduce the finding with the recorded adapter version and sanitized evidence.
2. For a potentially live secret, revoke or rotate first; do not paste the value into an issue.
3. For a dependency advisory, establish whether the package/version is shipped and whether the
   vulnerable path is reachable. The adapter's local `info` severity is not a priority decision.
4. Close as fixed only after the same adapter no longer reports the identity under completed
   coverage.

A suppression must be stored in the consuming repository and include the finding/advisory identity,
rationale, evidence link, approving owner and an expiry date. Expired suppressions fail review and
must be removed, renewed with new evidence or replaced by a fix. Broad repository-wide allowlists
without identity, owner and expiry are not accepted.

## Updates and unavailable capability

The update owner reviews new tool versions and rule/database behavior against planted fixtures
before changing a pin. Missing tools, plan-limited GitHub features, timeouts or parse failures remain
`unknown`; no workflow may rewrite them as zero findings. External tools are supplied by the caller
or CI and are never downloaded by the Action.
