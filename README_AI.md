# Web App Security Skill - agent bootstrap

This file is the repository-mode entry for an AI coding agent. Human-facing product and install
information lives in `README.md`; the execution contract lives in `SKILL.md`.

## Start here

1. Read `SKILL.md` and `docs/capabilities.md` completely.
2. Identify the user's project root, deployment context if supplied, and requested outcome.
3. Separate available deterministic tools from agent-guided review. Do not imply that every
   methodology phase is an automatic scan.
4. Create or update an authorization scope before any active request. Passive/source work may be
   prepared first, but do not access a third-party host without written authorization.
5. Prefer source review and local fixtures. Use the smallest non-destructive proof necessary.
6. Classify every result as `confirmed`, `suspected`, `unknown`, or `not_applicable`.
7. Prepare reviewable changes, preserve existing user edits, and retest every applied fix.
8. Report evidence, limitations, remaining risks, and the exact verification that ran.

## First task prompt

```text
Use $web-app-security on this web project. Start with source and local checks, explain each risk in
plain language, prepare the smallest reviewable hardening changes, and retest applied fixes. Do not
run active checks against a deployment until I provide ownership or written authorization.
```

## Required inputs

Use what the user supplied. Ask only when a missing item changes authorization or the requested
result:

- project root or repository;
- optional owned deployment origin;
- environment (`local`, `staging`, or `production`);
- ownership or written authorization before active traffic;
- prohibited actions and availability constraints;
- whether the agent may apply patches or must produce patch-only evidence.

Never infer ownership from repository access, DNS reachability, or a user-agent string.

## Current execution surfaces

- `node scripts/webapp-security.mjs start <project>`
- `node scripts/webapp-security.mjs demo`
- `node scripts/webapp-security.mjs crawl ...`
- `node scripts/webapp-security.mjs verify-crawler ...`
- `node scripts/webapp-security.mjs verify-edge ...`
- `node scripts/webapp-security.mjs aws ...`

Stable multi-format findings and the general patch/retest baseline loop remain planned until their
capability entries link to regression evidence. Project discovery only establishes source/local
scope; it does not prove deployment ownership or authorize remote traffic.

## Stop conditions

Stop active work when authorization is missing or ambiguous, scope expands, real third-party data
is reached, production health degrades, credentials appear in output, or required evidence cannot
be obtained safely. Record the state as `unknown` or `suspected`; do not convert it to a pass.
