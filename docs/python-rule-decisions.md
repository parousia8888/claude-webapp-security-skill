# Python built-in rule decisions

Status: v0.5.0 M4 implementation record

This record separates stable detectors from Python candidates that need data flow, deployment
state or framework execution. The built-in engine tokenizes source only: it never imports a project
module, installs dependencies, executes migrations or invokes Python. A deferred candidate is not
executable and is not included in public rule counts.

## Stable in v0.5.0

| Rule | Promoted signal | Evidence limit |
|---|---|---|
| `python-dynamic-code-execution` | Direct built-in `eval` or `exec` | No input-flow or reachability proof. |
| `python-shell-command-execution` | Resolved `os` shell APIs or `subprocess` with `shell=True` | No argument-flow proof. |
| `python-unsafe-deserialization` | Resolved Pickle or Dill `load`/`loads` | No serialized-input trust proof. |
| `python-unsafe-yaml-load` | Resolved PyYAML `load` with explicit `Loader` or `UnsafeLoader` | No YAML-input trust proof. |
| `python-tls-verification-disabled` | Resolved Requests or HTTPX call with `verify=False` | No deployment-use or network-path proof. |
| `python-framework-debug-enabled` | Explicit Flask or Django debug literal | No production-selection or reachability proof. |
| `python-hardcoded-framework-secret` | Flask/Django secret setting plus non-placeholder literal | The value is never persisted; validity and deployment use are unknown. |
| `python-cors-wildcard-with-credentials` | Supported CORS configuration with paired wildcard and credentials | No browser or middleware-runtime proof. |

All eight rules report `suspected`. Direct and aliased imports, multiline calls and explicit keyword
arguments are supported. Comments, strings and docstrings are opaque. Conventional tests, fixtures,
generated code, migrations and vendored paths are excluded from built-in risk findings. Each rule
has a vulnerable fixture, safe near-neighbour, sanitized structural evidence, professional and
plain-language explanation, security and functional retests, side effects, rollback and user
decisions.

## Deferred from the built-in engine

| Candidate | Reason |
|---|---|
| Cookie security defaults | Correct flags depend on cookie purpose, framework defaults, HTTPS termination, proxies and cross-site flows. |
| Weak hashes and `random` | These APIs are often valid for caches, sampling or non-security identifiers; security purpose must be established. |
| Logging credential-named values | A name does not prove runtime contents, production logging or the absence of downstream redaction. |
| Generic paths and temporary files | Useful conclusions require input trust, filesystem permissions, lifecycle and deployment context. |
| Permissive hosts | Development servers, reverse proxies and production host validation require deployment context. |

These candidates remain suitable for agent-guided review or the mature SAST benchmark. Their
absence from a report must not be described as a passed check.
