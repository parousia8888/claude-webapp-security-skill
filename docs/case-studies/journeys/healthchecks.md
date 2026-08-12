# Healthchecks ordinary project journey

## Scope

- Repository: `healthchecks/healthchecks`
- Commit: [`49653c350cddc47fc00a471bd1b08b5771a7967c`](https://github.com/healthchecks/healthchecks/tree/49653c350cddc47fc00a471bd1b08b5771a7967c)
- Stack: Python/Django with pip requirements
- Method: immutable source, deterministic discovery/audit, then a narrow configuration trace
- Network: denied during discovery and audit
- No hosted instance was probed; deployment authorization remained pending.

## Discovery and raw result

Discovery returned `supported` / `single-root`, identified Django from `requirements.txt`, pip,
`manage.py`, `hc/wsgi.py`, Docker surfaces and GitHub workflows. The corrected deterministic audit
returned **0 findings**: 0 confirmed, 0 suspected and 0 unknown rule results. The absence of a
finding from four narrow rule families is not a security certification.

## False-positive closure

The first run called pinned `requirements.txt` and `requirements-dev.txt` manifests with no
adjacent lockfile. The deployment input itself pins packages with `==`:
[requirements.txt#L1-L15](https://github.com/healthchecks/healthchecks/blob/49653c350cddc47fc00a471bd1b08b5771a7967c/requirements.txt#L1-L15).
Requiring a second lockfile was a tool-model error, so requirements files no longer enter the
adjacent-lockfile rule. `docker/.env.example` was also closed as a documentation template; the
audit did not read its values.

## Manual trace

Lead: `DEBUG=True` and `SECRET_KEY=---` are unsafe for production, but source defaults do not show
what a deployment uses. The defaults are explicit:
[settings.py#L68-L79](https://github.com/healthchecks/healthchecks/blob/49653c350cddc47fc00a471bd1b08b5771a7967c/hc/settings.py#L68-L79).
The UI emits warnings for debug mode and the placeholder secret:
[hc_extras.py#L99-L119](https://github.com/healthchecks/healthchecks/blob/49653c350cddc47fc00a471bd1b08b5771a7967c/hc/front/templatetags/hc_extras.py#L99-L119),
and tests preserve both behaviors:
[test_basics.py#L13-L28](https://github.com/healthchecks/healthchecks/blob/49653c350cddc47fc00a471bd1b08b5771a7967c/hc/front/tests/test_basics.py#L13-L28).
Django system checks also validate `SITE_ROOT`/`ALLOWED_HOSTS`, proxy-header shape and a private-IP
integration caveat:
[apps.py#L17-L82](https://github.com/healthchecks/healthchecks/blob/49653c350cddc47fc00a471bd1b08b5771a7967c/hc/api/apps.py#L17-L82).

Classification: `unknown` for any third-party production deployment. The source establishes
operator-visible guardrails but neither proves secure runtime values nor proves a vulnerability.

## Repair, regression, and retest

No upstream patch was appropriate. The Skill's regression fixture now establishes that a pinned
requirements input is not reported as lacking a second lockfile and that `.env.example` remains
excluded without reading it. Retesting this fixed commit returned 0 deterministic findings.

## Unreached surfaces

- Actual environment variables, proxy/TLS headers and host configuration remain `unknown`.
- Authenticated account, project, integration and tenant boundaries were not exercised.
- Dependency resolution across platforms and dependency vulnerabilities were not analyzed.

## Reproduce

```bash
git clone https://github.com/healthchecks/healthchecks.git /tmp/healthchecks-case
git -C /tmp/healthchecks-case checkout 49653c350cddc47fc00a471bd1b08b5771a7967c
node scripts/run-case-journey.mjs healthchecks /tmp/healthchecks-case --out /tmp/healthchecks-evidence
```
