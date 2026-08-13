# Next patch release readiness

Captured: 2026-08-13

This is a readiness record, not a release record. It does not assign a new version, claim that the
post-v0.3.0 fixes are published, create a tag, move `v1`, or replace the immutable evidence for
v0.3.0.

## Evaluated implementation tree

| Evidence | Value |
|---|---|
| Correctness implementation | `f227c3d8128b72b43dcaabe2cbb3516d94fd0a53` |
| Roadmap issue-state contract | `49cf60fec1a187b3d5f1db8e7d7ead4e31de239c` |
| Existing release | `v0.3.0` at `d7df9fa6efd466c3eb13768c3b9ad259d2636e04` |
| Existing stable major Action | `v1` at `d7df9fa6efd466c3eb13768c3b9ad259d2636e04` |
| Next version | owner decision pending |
| Publication state | `external_validation_pending` |

The next release tree must include this readiness record and the later version/evidence alignment
commit, so neither implementation commit above is asserted to be the final tag target.

## Correctness evidence

- Crawler ranges: missing, wrong-type, empty, invalid-CIDR, future, stale, wrong-product and custom
  product fixtures. Unavailable evidence is `unverifiable` with exit `3`; only a validated claimed
  product source can confirm or deny it.
- AWS inventory: nested permission denial remains `UNCHECKED`, never a fabricated MFA or CloudTrail
  finding. Error payloads are withheld and unknown-only audits exit `3`.
- Sitemaps: predefined and numeric entities plus CDATA normalize; malformed XML, declarations and
  off-origin sitemap/index locations become `sitemap-parse-unknown`, enqueue no URLs from the
  affected document and exit `3` after writing the report.
- All three fixtures are local. The crawler test installs a local-network-only guard; the sitemap
  test proves its separate external listener receives zero requests; the AWS test uses a fake CLI
  and no cloud account.

Issues [#1](https://github.com/parousia8888/web-app-security-skill/issues/1),
[#2](https://github.com/parousia8888/web-app-security-skill/issues/2) and
[#5](https://github.com/parousia8888/web-app-security-skill/issues/5) were closed only after the
focused tests, full local gate and remote CI/CodeQL succeeded. Each closing comment links the exact
implementation and regression evidence.

## Verification evidence

| Gate | Result |
|---|---|
| Full local `npm run check` | passed twice after the final correctness additions |
| Skill Creator validator | passed |
| Correctness CI | [31656913265](https://github.com/parousia8888/web-app-security-skill/actions/runs/31656913265), Ubuntu/macOS on Node 20/22 |
| Correctness CodeQL | [31656913266](https://github.com/parousia8888/web-app-security-skill/actions/runs/31656913266), passed |
| Issue-state contract CI | [31657298727](https://github.com/parousia8888/web-app-security-skill/actions/runs/31657298727), passed |
| Issue-state contract CodeQL | [31657298751](https://github.com/parousia8888/web-app-security-skill/actions/runs/31657298751), passed |
| Release-state contract CI | [31658167450](https://github.com/parousia8888/web-app-security-skill/actions/runs/31658167450), Ubuntu/macOS on Node 20/22, passed |
| Release-state contract CodeQL | [31658167426](https://github.com/parousia8888/web-app-security-skill/actions/runs/31658167426), passed |
| Release-promotion CI | [31658906142](https://github.com/parousia8888/web-app-security-skill/actions/runs/31658906142), Ubuntu/macOS on Node 20/22, passed |
| Release-promotion CodeQL | [31658906192](https://github.com/parousia8888/web-app-security-skill/actions/runs/31658906192), passed |
| Live GitHub metadata contract | passed after #1/#2/#5 closed; open and closed issue states match source |
| Marketplace | HTTP 200; Web App Security Skill listed; latest public version remains `v0.3.0` |
| Existing tag signature | `v0.3.0` verifies against `.github/release-signers` |
| Existing `@v1` baseline | [31657177101](https://github.com/parousia8888/web-app-security-skill/actions/runs/31657177101), passive evidence and authorization rejection passed |

`test/release-artifacts.test.mjs` also passed inside the full gate: two builds were byte-identical,
the manifest/checksums/SBOM verified, and the extracted archive completed the isolated
`install -> version -> start -> upgrade -> uninstall` lifecycle. Because `VERSION` is still
`0.3.0`, that run validates the release mechanism but is not a publishable next-version artifact.

## Version gate

The repository already has an immutable public `v0.3.0` release. Rebuilding the current tree while
leaving `VERSION=0.3.0` would produce different bytes under an already-used identity. Those bytes
must not be uploaded, described as v0.3.0, or used to replace the existing assets.

Before a release candidate can be finalized, the owner must select the next semantic version. The
implemented behavior is patch-shaped: it corrects evidence validation and exit semantics without
adding a new top-level product workflow, so `0.3.1` is the conservative candidate. That version is
not assigned by this document.

After the version decision, the release gate is:

1. Align `VERSION`, `package.json`, `CHANGELOG.md`, generated release-facing evidence and
   `docs/releases/v<version>.md` on one reviewed commit.
2. Run the full local and live contracts, then build the exact commit twice and compare every asset
   byte-for-byte.
3. Verify archive structure, SHA-256 list, release manifest, SPDX SBOM and isolated lifecycle.
4. Obtain explicit owner confirmation before creating or pushing the signed version tag.
5. Wait for release CI and provenance attestation, then verify the public assets and checksums.
6. From the immutable public assets, add the new version, source commit and four asset digests to a
   later verifier commit; then pin that verifier from a later bootstrap commit and update the README
   command to the bootstrap's immutable digest. The release archive cannot contain its own final
   archive digest, so this trust-anchor publication is intentionally post-release.
7. Obtain explicit owner confirmation before moving the mutable `v1` tag; run the public `@v1`
   consumer again after the move.

Until those steps exist as evidence, the next release, provenance and updated `v1` consumer result
remain `external_validation_pending`.

`docs/release-state.json` is the structured boundary between the working product version, the latest
actually published release, the stable Action target and the versions accepted by the verified
installer. Generated launch/publication assets and the live GitHub checker use the published-release
record, so a candidate `VERSION` cannot become an "already published" claim before the release exists.

`scripts/prepare-release-promotion.mjs` removes manual digest transcription from step 6. During the
release workflow it validates the four local assets and writes `release-promotion.json` as a separate
workflow artifact with state `local_candidate`; that file is not uploaded as a fifth public release
asset. After publication, rerun the tool with the downloaded public assets and `--live`. The live gate
requires a non-draft/non-prerelease GitHub Release, the exact four-asset set and GitHub-recorded
digests, the SSH-signed tag at the manifest source commit, and GitHub provenance. It then emits state
`live_verified` plus the exact verifier trust entry and published-release record. For an older release,
the live path executes that signed release commit's artifact verifier, so later archive requirements
cannot retroactively invalidate an earlier valid format; the tag is verified before historical code
is executed.

The tool does not modify the verifier, bootstrap, READMEs, release state, tags or GitHub Release. Those
remain reviewed follow-up changes. Its live path was exercised read-only against public `v0.3.0`: all
four GitHub asset digests, the signed tag, source commit and provenance matched the existing trust
anchors.
