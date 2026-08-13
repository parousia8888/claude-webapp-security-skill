# External source adapter protocol

External adapters are optional. The built-in source audit remains the default and performs no
adapter download. `webapp-security doctor` only probes installed executables and exits `3` when a
selected prerequisite is unavailable.

## Contract

An adapter must define a stable ID, exact tested version, maturity, rule inventory, applicability,
machine-output command, timeout and network behavior. Each rule declares a revision, risk domain,
local severity and rationale. Reports record adapter and ruleset identity even when no finding is
produced.

Execution follows this sequence:

1. Verify the executable reports the exact supported version.
2. Determine applicability from recorded project inputs.
3. Invoke the bounded machine-output command without executing project dependencies.
4. Parse only documented fields and reject malformed, oversized or path-escaping output.
5. Convert results to sanitized v2 findings and per-rule coverage.
6. Convert missing tools, version drift, timeout, malformed output, inconsistent exit status and
   internal errors to `unknown`/unavailable coverage, never a clean result.

Raw stdout and stderr are not persisted. Adapter implementations must discard secret values,
credentials and unnecessary personal data before constructing a finding. Scanner matches are
`suspected` leads: Gitleaks does not establish credential validity or exposure, and OSV does not
establish reachability or production impact.

## Supported adapters

| Adapter | Tested version | License | Invocation boundary | Persisted evidence | Network |
|---|---:|---|---|---|---|
| Gitleaks | `8.30.1` | MIT | Git history when `.git` is present, plus working tree; `--redact=100` | External rule ID, sanitized path/line, optional commit and SHA-256 fingerprint digest | No |
| OSV-Scanner | `2.5.0` | Apache-2.0 | Recorded lockfiles; call analysis disabled | Ecosystem, package/version, advisory IDs, aliases and upstream maximum severity | May query the public OSV database |

OSV matches use local severity `info`: upstream CVSS or database severity is preserved as evidence,
not converted into a Web App Security severity. Project reachability and priority require review.

Use `--adapter builtin|gitleaks|osv|all` repeatedly and `--adapter-timeout 1..600`. A persisted run
fixes both values in its scope. Use `--fail-on never` for evidence-only external runs. Any external
adapter run that can affect an exit-code gate also requires `--acknowledge-alert-policy`; see
[`alert-policy.md`](alert-policy.md).

## Provenance and deferred adapters

CI obtains Gitleaks and OSV-Scanner only from their upstream versioned releases and verifies the
fixed SHA-256 values in `test/install-pinned-adapters.sh`. The product does not download either tool
at runtime.

Semgrep is deferred beyond v0.4.0. No ruleset was promoted because this release does not contain a
pinned ruleset identity plus planted positive, negative, malformed and suppression fixtures under
the protocol above. ZAP is outside the v0.4.0 source-adapter scope.
