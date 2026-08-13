# Linkwarden ordinary project journey

## Scope

- Repository: `linkwarden/linkwarden`
- Commit: [`62f1b81ff7f66001b0f5f613202f87771f3186ee`](https://github.com/linkwarden/linkwarden/tree/62f1b81ff7f66001b0f5f613202f87771f3186ee)
- Stack: Node/Next.js monorepo with Yarn workspaces
- Method: immutable source, complete v2 built-in/Gitleaks/OSV path, then a narrow manual trace
- Corpus snapshot: `2026-08-14`; Gitleaks `8.30.1`, OSV-Scanner `2.5.0`
- Network: only OSV's public advisory service; no project deployment or dependency execution
- No hosted instance was probed; deployment authorization remained pending.

## Discovery and raw result

Discovery returned `supported` / `monorepo`, found React at `apps/mobile`, Next.js at `apps/web`
and `packages/router`, and recorded root `yarn.lock`. The v2 path recorded 0 built-in or Gitleaks
findings and 270 OSV advisory matches from `yarn.lock`: **0 confirmed, 270 suspected, 0 unknown**.
The OSV number is a dated mutable-database snapshot, not 270 confirmed vulnerabilities or a stable
score.

## False-positive closure

The first built-in run incorrectly reported every nested `package.json` as missing a lockfile and
treated three `.env.sample` / `.env.example` files as possible secrets. The root manifest declares
`apps/*` and `packages/*` workspaces and has `yarn.lock`:
[package.json#L1-L26](https://github.com/linkwarden/linkwarden/blob/62f1b81ff7f66001b0f5f613202f87771f3186ee/package.json#L1-L26).

The rule now inherits a lockfile only through a matching declared workspace and excludes known
template suffixes. A real `.env`, `.env.local`, or `.env.production` remains filename-only
`suspected`; contents are not read. OSV rows retain package/version/advisory identity at local
severity `info`; reachability, deployed versions and impact were not inferred.

## Manual trace

The traced title path calls `safeFetch`:
[fetchTitleAndHeaders.ts#L1-L18](https://github.com/linkwarden/linkwarden/blob/62f1b81ff7f66001b0f5f613202f87771f3186ee/apps/web/lib/shared/fetchTitleAndHeaders.ts#L1-L18).
It uses manual redirects and revalidates each destination:
[safeFetch.ts#L95-L128](https://github.com/linkwarden/linkwarden/blob/62f1b81ff7f66001b0f5f613202f87771f3186ee/packages/lib/safeFetch.ts#L95-L128).
The guard restricts schemes, hostnames and resolved private/special addresses:
[ssrf.ts#L259-L329](https://github.com/linkwarden/linkwarden/blob/62f1b81ff7f66001b0f5f613202f87771f3186ee/packages/lib/ssrf.ts#L259-L329), with tests for
localhost, metadata IP, IPv6 loopback and private DNS resolution:
[ssrf.test.ts#L9-L49](https://github.com/linkwarden/linkwarden/blob/62f1b81ff7f66001b0f5f613202f87771f3186ee/packages/lib/ssrf.test.ts#L9-L49).

Classification: `not_applicable` as a vulnerability for this limited direct path. This does not
close the proxy branch or every URL-ingestion route.

## Repair, regression, and retest

No upstream vulnerability patch was fabricated. The repair belongs to the Skill's workspace-lock
and environment-template rules. `test/evidence-loop.test.mjs` plants the previous false-positive
shapes plus a real environment filename and proves only the real lead remains. External advisory
leads remain triage input; no upstream dependency patch was fabricated.

## Unreached surfaces

- Proxy-mode DNS and destination enforcement.
- Authorization boundaries on every URL-ingestion route.
- Dependency reachability, deployed package versions, hosted artifacts and runtime egress.

## Reproduce

```bash
git clone https://github.com/linkwarden/linkwarden.git /tmp/linkwarden-case
git -C /tmp/linkwarden-case checkout 62f1b81ff7f66001b0f5f613202f87771f3186ee
node scripts/run-case-journey.mjs linkwarden /tmp/linkwarden-case --out /tmp/linkwarden-evidence
```

Set `WEBAPP_SECURITY_GITLEAKS_BIN` and `WEBAPP_SECURITY_OSV_SCANNER_BIN` to caller-installed pinned
binaries before the last command. The runner performs no download; OSV advisory results can drift
after the recorded snapshot.
