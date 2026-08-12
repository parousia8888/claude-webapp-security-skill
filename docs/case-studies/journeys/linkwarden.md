# Linkwarden ordinary project journey

## Scope

- Repository: `linkwarden/linkwarden`
- Commit: [`62f1b81ff7f66001b0f5f613202f87771f3186ee`](https://github.com/linkwarden/linkwarden/tree/62f1b81ff7f66001b0f5f613202f87771f3186ee)
- Stack: Node/Next.js monorepo with Yarn workspaces
- Method: immutable source, deterministic discovery/audit, then a narrow manual source trace
- Network: denied during discovery and audit
- No hosted instance was probed; deployment authorization remained pending.

## Discovery and raw result

Discovery returned `supported` / `monorepo`, found React at `apps/mobile`, Next.js at `apps/web`
and `packages/router`, the root `yarn.lock`, Docker surfaces, and GitHub workflows. The corrected
deterministic audit returned **0 findings**: 0 confirmed, 0 suspected and 0 unknown rule results.
That is a result for the shipped narrow rules, not a claim that Linkwarden is secure.

## False-positive closure

The first run incorrectly reported every nested `package.json` as missing a lockfile and treated
three `.env.sample` / `.env.example` files as possible secrets. The root manifest explicitly
declares `apps/*` and `packages/*` workspaces and the root has `yarn.lock`:
[package.json#L1-L26](https://github.com/linkwarden/linkwarden/blob/62f1b81ff7f66001b0f5f613202f87771f3186ee/package.json#L1-L26).

The tool repair now inherits a lockfile only through a matching declared workspace and excludes
the known template suffixes `.example`, `.sample`, `.template`, `.dist`, and `.defaults`. A real
`.env`, `.env.local`, or `.env.production` remains a filename-only `suspected` result and its
contents are not read.

## Manual trace

Lead: user-controlled URL fetching can resemble SSRF. The traced title path calls `safeFetch`:
[fetchTitleAndHeaders.ts#L1-L18](https://github.com/linkwarden/linkwarden/blob/62f1b81ff7f66001b0f5f613202f87771f3186ee/apps/web/lib/shared/fetchTitleAndHeaders.ts#L1-L18).

`safeFetch` validates the current URL, uses manual redirects and revalidates each redirect:
[safeFetch.ts#L95-L128](https://github.com/linkwarden/linkwarden/blob/62f1b81ff7f66001b0f5f613202f87771f3186ee/packages/lib/safeFetch.ts#L95-L128).
The guard restricts schemes, hostnames and resolved private/special addresses:
[ssrf.ts#L259-L329](https://github.com/linkwarden/linkwarden/blob/62f1b81ff7f66001b0f5f613202f87771f3186ee/packages/lib/ssrf.ts#L259-L329), with representative
tests for localhost, metadata IP, IPv6 loopback and private DNS resolution:
[ssrf.test.ts#L9-L49](https://github.com/linkwarden/linkwarden/blob/62f1b81ff7f66001b0f5f613202f87771f3186ee/packages/lib/ssrf.test.ts#L9-L49).

Classification: `not_applicable` as a vulnerability finding for this limited, default direct
connection path. The source contains a control between input and sink; the presence of `fetch`
alone is not a boundary bypass.

## Repair, regression, and retest

No upstream vulnerability patch was fabricated. The appropriate repair was in this Skill's
workspace-lock and environment-template rules. `test/evidence-loop.test.mjs` plants a root Yarn
workspace, a nested package, pinned requirements, `.env.example`, `.env.sample`, and a real
`.env.production`; it asserts only the real environment filename is reported and no sentinel value
enters evidence. Retesting the fixed rules against this commit returned the 0-finding result above.

## Unreached surfaces

- Proxy-mode DNS and destination enforcement remain `unknown`; the proxy-agent branch differs
  from the direct custom-lookup path.
- Runtime DNS behavior, all URL-ingestion routes, authorization, deployment egress and public
  artifacts were not exercised.
- Dependency vulnerabilities and application/API behavior were outside the four deterministic
  source rule families.

## Reproduce

```bash
git clone https://github.com/linkwarden/linkwarden.git /tmp/linkwarden-case
git -C /tmp/linkwarden-case checkout 62f1b81ff7f66001b0f5f613202f87771f3186ee
node scripts/run-case-journey.mjs linkwarden /tmp/linkwarden-case --out /tmp/linkwarden-evidence
```
