# Uptime Kuma ordinary project journey

## Scope

- Repository: `louislam/uptime-kuma`
- Commit: [`6b5ea0155793e666666745fb8d6fef1e829543a2`](https://github.com/louislam/uptime-kuma/tree/6b5ea0155793e666666745fb8d6fef1e829543a2)
- Stack: Node/Express plus Vue/Vite
- Method: immutable source, complete v2 built-in/Gitleaks/OSV path, then one narrow policy trace
- Corpus snapshot: `2026-08-14`; Gitleaks `8.30.1`, OSV-Scanner `2.5.0`
- Network: only OSV's public advisory service; no project deployment or dependency execution
- No hosted instance was probed; deployment authorization remained pending.

## Discovery and raw result

Discovery returned `supported` / `single-root`, identified Express, Vite, Vue, npm and the root
`package-lock.json`. The dated snapshot recorded **4 confirmed, 93 suspected, 0 unknown**:

| Rule | Count | State | Interpretation |
|---|---:|---|---|
| `dependency-lockfile-missing` | 4 | `confirmed` low | Independent `extra/` tool/example manifests have no adjacent lockfile |
| Gitleaks history / working tree | 1 + 1 | `suspected` high | The same private-key pattern occurs in a manual TLS test fixture |
| `osv-known-vulnerability` | 91 | `suspected` info | Package/version advisory matches in the root lockfile |

The four built-in rows confirm only a reproducible dependency-hygiene fact. They are not four
application vulnerabilities. The OSV count is a mutable advisory snapshot, not a stable score.

## False-positive closure

The four manifests are separate, non-workspace paths:
[TypeScript push example](https://github.com/louislam/uptime-kuma/blob/6b5ea0155793e666666745fb8d6fef1e829543a2/extra/push-examples/typescript-fetch/package.json#L1-L13),
[JavaScript push example](https://github.com/louislam/uptime-kuma/blob/6b5ea0155793e666666745fb8d6fef1e829543a2/extra/push-examples/javascript-fetch/package.json#L1-L5),
[`kuma-pr`](https://github.com/louislam/uptime-kuma/blob/6b5ea0155793e666666745fb8d6fef1e829543a2/extra/kuma-pr/package.json#L1-L8), and
[`uptime-kuma-push`](https://github.com/louislam/uptime-kuma/blob/6b5ea0155793e666666745fb8d6fef1e829543a2/extra/uptime-kuma-push/package.json#L1-L13).
The report keeps the facts confirmed while avoiding an application-impact claim.

The private-key match sits under `test/manual-test-radius-tls`; no validity, reuse or exposure proof
was collected. Both Gitleaks scan-mode rows remain suspected. OSV matches remain suspected until
reachability, deployed version and impact are established.

## Manual trace

The webhook provider sends to an operator-configured URL:
[webhook.js#L11-L64](https://github.com/louislam/uptime-kuma/blob/6b5ea0155793e666666745fb8d6fef1e829543a2/server/notification-providers/webhook.js#L11-L64).
The disclosure policy excludes generic SSRF reports:
[SECURITY.md#L6-L18](https://github.com/louislam/uptime-kuma/blob/6b5ea0155793e666666745fb8d6fef1e829543a2/SECURITY.md#L6-L18).

Classification: `not_applicable` as a vulnerability for this sink-only evidence. This does not
close role, egress or other outbound-request boundaries.

## Repair, regression, and retest

No upstream patch was applied. The four lockfile facts and every external lead remain in the
structured snapshot. A patch requires owner context about which `extra/` tools are released and
which advisory/credential leads affect a shipped deployment.

## Unreached surfaces

- Whether the four `extra/` tools are independently released or CI-enforced.
- Private-key validity/reuse, dependency reachability and deployed package versions.
- Authenticated roles, network egress and hosted runtime behavior.

## Reproduce

```bash
git clone https://github.com/louislam/uptime-kuma.git /tmp/uptime-kuma-case
git -C /tmp/uptime-kuma-case checkout 6b5ea0155793e666666745fb8d6fef1e829543a2
node scripts/run-case-journey.mjs uptime-kuma /tmp/uptime-kuma-case --out /tmp/uptime-kuma-evidence
```

Set `WEBAPP_SECURITY_GITLEAKS_BIN` and `WEBAPP_SECURITY_OSV_SCANNER_BIN` to caller-installed pinned
binaries before the last command. The runner performs no download; OSV advisory results can drift
after the recorded snapshot.
