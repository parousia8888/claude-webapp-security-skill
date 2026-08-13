# Mealie ordinary project journey

## Scope

- Repository: `mealie-recipes/mealie`
- Commit: [`2fc22cea43f2978533f3a89a1ddeb1e6a18b245f`](https://github.com/mealie-recipes/mealie/tree/2fc22cea43f2978533f3a89a1ddeb1e6a18b245f)
- Stack: Nuxt/Vue frontend plus Python/FastAPI backend
- Method: immutable source, complete v2 built-in/Gitleaks/OSV path, then one narrow source trace
- Corpus snapshot: `2026-08-14`; Gitleaks `8.30.1`, OSV-Scanner `2.5.0`
- Network: OSV's public advisory path was available; no hosted project or dependency was executed
- No hosted instance was probed; deployment authorization remained pending.

## Discovery and raw result

Discovery returned `supported` / `split-stack`, identified Nuxt, Vue, FastAPI, the frontend and E2E
Yarn locks, and root `uv.lock`. The dated v2 snapshot recorded no built-in or OSV finding. Gitleaks
recorded 15 history matches and the same 15 working-tree matches: **0 confirmed, 30 suspected, 0
unknown**.

## False-positive closure

The matches are in test HTML and auth-cache test paths and span AWS-, GCP- and generic-key patterns.
The report retains sanitized locations and distinct tool fingerprints. It does not infer that test
values are valid credentials, that they remain active, or that the two scan modes represent 30
distinct credentials. No lead was hidden or promoted to confirmed.

## Manual trace

The authenticated recipe-image route accepts a URL:
[recipe_crud_routes.py#L758-L774](https://github.com/mealie-recipes/mealie/blob/2fc22cea43f2978533f3a89a1ddeb1e6a18b245f/mealie/routes/recipe/recipe_crud_routes.py#L758-L774).
The limited path reaches `AsyncSafeTransport`, which resolves the host and rejects private IPs:
[transport.py#L25-L74](https://github.com/mealie-recipes/mealie/blob/2fc22cea43f2978533f3a89a1ddeb1e6a18b245f/mealie/pkgs/safehttp/transport.py#L25-L74).
Authentication uses a fixed JWT algorithm and current database user:
[dependencies.py#L88-L123](https://github.com/mealie-recipes/mealie/blob/2fc22cea43f2978533f3a89a1ddeb1e6a18b245f/mealie/core/dependencies/dependencies.py#L88-L123),
and production passwords use bcrypt:
[hasher.py#L23-L45](https://github.com/mealie-recipes/mealie/blob/2fc22cea43f2978533f3a89a1ddeb1e6a18b245f/mealie/core/security/hasher.py#L23-L45).

Classification: `not_applicable` as a vulnerability for this limited sink-only trace. DNS
rebinding, redirects, proxy/Flaresolverr paths and deployment egress remain unknown.

## Repair, regression, and retest

No upstream patch was fabricated. The URL-fetch lead was closed only for the cited path; all
Gitleaks rows remain suspected for owner triage. A valid repair/retest requires credential validity
or a reproduced boundary failure, neither of which this source-only corpus establishes.

## Unreached surfaces

- Credential validity/exposure for scanner matches.
- DNS rebinding, redirects, proxy/Flaresolverr behavior and deployment egress.
- Role permissions, hosted runtime behavior and other HTTP-client paths.

## Reproduce

```bash
git clone https://github.com/mealie-recipes/mealie.git /tmp/mealie-case
git -C /tmp/mealie-case checkout 2fc22cea43f2978533f3a89a1ddeb1e6a18b245f
node scripts/run-case-journey.mjs mealie /tmp/mealie-case --out /tmp/mealie-evidence
```

Set `WEBAPP_SECURITY_GITLEAKS_BIN` and `WEBAPP_SECURITY_OSV_SCANNER_BIN` to caller-installed pinned
binaries before the last command. The runner performs no automatic download.
