# Healthchecks ordinary project journey

## Scope

- Repository: `healthchecks/healthchecks`
- Commit: [`49653c350cddc47fc00a471bd1b08b5771a7967c`](https://github.com/healthchecks/healthchecks/tree/49653c350cddc47fc00a471bd1b08b5771a7967c)
- Stack: Python/Django with pip requirements
- Method: immutable source, complete v2 built-in/Gitleaks/OSV path, then a narrow configuration trace
- Corpus snapshot: `2026-08-14`; Gitleaks `8.30.1`, OSV-Scanner `2.5.0`
- Network: no request was needed; OSV was `not_applicable` without a supported lockfile
- No hosted instance was probed; deployment authorization remained pending.

## Discovery and raw result

Discovery returned `supported` / `single-root`, identified Django from `requirements.txt`, pip,
`manage.py`, `hc/wsgi.py`, Docker and workflow surfaces. The v2 path recorded 0 built-in findings,
49 Gitleaks history matches and the same 49 working-tree matches: **0 confirmed, 98 suspected, 0
unknown**. OSV coverage is explicit `not_applicable`, not a clean dependency result.

## False-positive closure

The first built-in run called pinned `requirements.txt` and `requirements-dev.txt` manifests with
no adjacent lockfile. The deployment input itself pins packages with `==`:
[requirements.txt#L1-L15](https://github.com/healthchecks/healthchecks/blob/49653c350cddc47fc00a471bd1b08b5771a7967c/requirements.txt#L1-L15).
Requiring a second lockfile was a tool-model error. `docker/.env.example` was also closed as a
template without reading its values.

Gitleaks matches occur in API documentation, migrations and a test path. This source-only run did
not establish credential validity or exposure, so every match remains `suspected`. The repeated
history and working-tree views are separate scan modes, not 98 distinct credentials.

## Manual trace

Development defaults are explicit:
[settings.py#L68-L79](https://github.com/healthchecks/healthchecks/blob/49653c350cddc47fc00a471bd1b08b5771a7967c/hc/settings.py#L68-L79).
The UI warns about debug mode and the placeholder secret:
[hc_extras.py#L99-L119](https://github.com/healthchecks/healthchecks/blob/49653c350cddc47fc00a471bd1b08b5771a7967c/hc/front/templatetags/hc_extras.py#L99-L119),
with tests preserving both behaviors:
[test_basics.py#L13-L28](https://github.com/healthchecks/healthchecks/blob/49653c350cddc47fc00a471bd1b08b5771a7967c/hc/front/tests/test_basics.py#L13-L28).
Django checks cover host/proxy configuration:
[apps.py#L17-L82](https://github.com/healthchecks/healthchecks/blob/49653c350cddc47fc00a471bd1b08b5771a7967c/hc/api/apps.py#L17-L82).

Classification: `unknown` for any third-party production deployment. Source shows guardrails but
does not prove runtime values or a vulnerability.

## Repair, regression, and retest

No upstream patch was appropriate. The Skill regression establishes that pinned requirements do
not require a second lockfile and `.env.example` remains excluded without reading it. External
secret-pattern leads remain visible for owner triage rather than being suppressed or auto-patched.

## Unreached surfaces

- Actual environment values, proxy/TLS headers and host configuration.
- Credential validity/exposure.
- Authenticated account, integration and tenant boundaries.

## Reproduce

```bash
git clone https://github.com/healthchecks/healthchecks.git /tmp/healthchecks-case
git -C /tmp/healthchecks-case checkout 49653c350cddc47fc00a471bd1b08b5771a7967c
node scripts/run-case-journey.mjs healthchecks /tmp/healthchecks-case --out /tmp/healthchecks-evidence
```

Set `WEBAPP_SECURITY_GITLEAKS_BIN` and `WEBAPP_SECURITY_OSV_SCANNER_BIN` to caller-installed pinned
binaries before the last command. The runner performs no automatic download.
