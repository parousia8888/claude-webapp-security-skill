# Mealie

## Scope

- Repository: `mealie-recipes/mealie`
- Commit: [`2fc22cea43f2978533f3a89a1ddeb1e6a18b245f`](https://github.com/mealie-recipes/mealie/tree/2fc22cea43f2978533f3a89a1ddeb1e6a18b245f)
- Method: source and existing-test review only; no URL was fetched
- Disclosure context: the project enables private vulnerability reporting in
  [SECURITY.md](https://github.com/mealie-recipes/mealie/blob/2fc22cea43f2978533f3a89a1ddeb1e6a18b245f/SECURITY.md#L1-L10).

## Reviewed leads and controls

The authenticated recipe image route accepts a URL and calls a data service. It catches a domain
rejection and returns 400:
[recipe_crud_routes.py#L758-L774](https://github.com/mealie-recipes/mealie/blob/2fc22cea43f2978533f3a89a1ddeb1e6a18b245f/mealie/routes/recipe/recipe_crud_routes.py#L758-L774).

Tracing the sink reaches `AsyncSafeTransport`, which resolves the hostname and rejects private IP
addresses before the request:
[transport.py#L25-L74](https://github.com/mealie-recipes/mealie/blob/2fc22cea43f2978533f3a89a1ddeb1e6a18b245f/mealie/pkgs/safehttp/transport.py#L25-L74).
Authentication decodes JWTs with a fixed algorithm and resolves the subject to a current database
user:
[dependencies.py#L88-L123](https://github.com/mealie-recipes/mealie/blob/2fc22cea43f2978533f3a89a1ddeb1e6a18b245f/mealie/core/dependencies/dependencies.py#L88-L123).
Production passwords use bcrypt rather than the test-only fake hasher:
[hasher.py#L23-L45](https://github.com/mealie-recipes/mealie/blob/2fc22cea43f2978533f3a89a1ddeb1e6a18b245f/mealie/core/security/hasher.py#L23-L45).

Classification: the URL-fetch lead is `suspected` before tracing and closed as `not applicable`
for this limited source path after the guard and authenticated route are identified. No
vulnerability is counted.

## Residual questions

Source inspection alone does not test DNS rebinding, redirect behavior, non-private special ranges,
proxy/Flaresolverr boundaries, role permissions or deployment egress. Those remain `unknown`, not
passing. They require maintainer-coordinated tests and are not appropriate for a public case-study
claim.

## What this does not prove

The study does not certify Mealie, execute its tests, or cover every HTTP client. It shows why
source-to-boundary tracing is materially more precise than reporting the presence of a URL fetch.
