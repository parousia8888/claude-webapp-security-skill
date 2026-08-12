# OWASP NodeGoat

## Scope

- Repository: `OWASP/NodeGoat`
- Commit: [`c5cb68a7084e4ae7dcc60e6a98768720a81841e8`](https://github.com/OWASP/NodeGoat/tree/c5cb68a7084e4ae7dcc60e6a98768720a81841e8)
- Method: source-only review; no running instance
- Ground truth: the [README](https://github.com/OWASP/NodeGoat/blob/c5cb68a7084e4ae7dcc60e6a98768720a81841e8/README.md#L1-L17)
  describes a vulnerable application with tutorials and fixes.

## Confirmed representative findings

| Classification | Evidence | Boundary and repair |
|---|---|---|
| `confirmed`, server-side code injection | Contributions pass three request fields to `eval`: [contributions.js#L28-L40](https://github.com/OWASP/NodeGoat/blob/c5cb68a7084e4ae7dcc60e6a98768720a81841e8/app/routes/contributions.js#L28-L40) | Parse and range-check numeric input; never execute it |
| `confirmed`, IDOR/BOLA | Allocation ownership comes from `req.params.userId`: [allocations.js#L11-L24](https://github.com/OWASP/NodeGoat/blob/c5cb68a7084e4ae7dcc60e6a98768720a81841e8/app/routes/allocations.js#L11-L24) | The adjacent upstream fix uses `req.session.userId` |
| `confirmed`, open redirect | `/learn` redirects directly to `req.query.url`: [index.js#L69-L73](https://github.com/OWASP/NodeGoat/blob/c5cb68a7084e4ae7dcc60e6a98768720a81841e8/app/routes/index.js#L69-L73) | Use a destination identifier or exact-origin allowlist |

## False-positive handling

The source comments are valid ground truth because this repository is a training target. The same
comments would not confirm exploitability in a production repository: the route, middleware,
deployment configuration and attacker reachability would still need tracing.

## What this does not prove

The study did not execute payloads or test the tutorial UI. It demonstrates that the Phase 4
method recovers three intentional controls, not that the current CLI performs automated source
analysis or that every NodeGoat lesson is covered.
