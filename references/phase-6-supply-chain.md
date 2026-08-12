# Phase 6 — Supply chain

Everything you did not write but do execute: dependencies, CDN scripts, base images, CI actions, and the humans and tokens that can push to production.

## 1. Dependencies

```bash
npm ci --ignore-scripts          # install without running postinstall while auditing
npm audit --production
osv-scanner -r .
syft . -o cyclonedx-json > sbom.json     # SBOM
grype sbom:sbom.json                     # CVEs against the SBOM
```

- Lockfile committed and honoured in CI (`npm ci`, not `npm install`).
- **`--ignore-scripts` in CI by default.** `postinstall` is the standard malicious-package payload; allowlist the few packages that genuinely need it.
- Pin direct dependencies; review transitive additions in PRs (a lockfile diff adding 40 packages deserves a look).
- Watch for typosquats and sudden maintainer changes on low-download packages.
- Track an SBOM per release so "are we affected by CVE-X" is answerable in minutes, not days.
- Have a policy for unmaintained packages: a dependency with no release in years is a future incident.

## 2. Third-party scripts in the browser

- Every CDN-hosted script gets `integrity="sha384-..."` + `crossorigin="anonymous"` and a pinned version. Without SRI, the CDN can execute arbitrary code in your users' sessions.
- Better: self-host and version the file yourself. One less trust relationship, and it removes a third-party availability dependency.
- Tag managers and analytics that can inject arbitrary JS are a persistent XSS channel with a UI. Restrict who can publish, and constrain them with CSP (`script-src` allowlist, no `unsafe-inline`).
- Audit what third-party scripts can read: any script on the page can read the DOM, tokens in `localStorage`, and form fields. Payment and login pages should carry the fewest third-party scripts of any page — ideally none.

## 3. Container and base images

- Pin base images by digest, not by tag; rebuild on a schedule to pick up patches.
- Scan images on push (ECR scanning, Trivy); fail the build on high-severity fixable CVEs.
- Multi-stage builds so compilers, dev dependencies, and secrets do not ship in the runtime image.
- Non-root user in the final image; read-only filesystem where possible.
- No secrets in image layers — `docker history` shows them even if a later layer deletes the file.

## 4. CI/CD pipeline

The pipeline usually has more privilege than the app. Treat it as production.

- **No long-lived cloud credentials in CI.** Use OIDC federation to an assumed role, with the trust policy pinned to `repo:owner/name:ref:refs/heads/main`. A wildcard `sub` here is a full account takeover path.
- Least-privilege deploy role: it should not be able to read the database or rewrite IAM.
- Pin third-party CI actions by commit SHA, not by tag — tags are mutable.
- Fork PRs must not run privileged workflows or see secrets (`pull_request` vs `pull_request_target` is the classic footgun).
- Branch protection + required review on anything that can deploy; protect the deploy branch and the workflow files themselves.
- Build provenance/signing (SLSA-style attestation, cosign) if the artifact travels between systems.
- Audit who has push access and CI secret access, quarterly. Offboarding removes tokens, not just accounts.

## 5. Third-party services

Each integration is a trust and an availability dependency:

- Scope every API key to the minimum permission; separate keys per environment; rotate on a schedule and immediately on staff change.
- Where the vendor supports it: IP allowlist, spend cap, webhook signing secret.
- Verify webhook signatures and deduplicate event ids (Phase 2 Stage 6).
- Know what data each vendor receives, and whether that matches your privacy policy.
- Have a documented answer for "this vendor is down" and "this vendor is breached — which of our keys and data are implicated".

## Exit criteria

```
[ ] SBOM generated per release; SCA in CI with a failure threshold
[ ] lockfile enforced; postinstall scripts disabled by default in CI
[ ] every third-party browser script has SRI + pinned version, or is self-hosted
[ ] base images pinned by digest and scanned on push
[ ] CI uses OIDC, no long-lived cloud keys; actions pinned by SHA
[ ] fork PRs cannot access secrets or privileged workflows
[ ] vendor keys scoped, rotated, and inventoried with the data each receives
```
