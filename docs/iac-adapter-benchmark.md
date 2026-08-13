# Deployment-policy adapter benchmark: Trivy vs Checkov

Decision date: 2026-08-14. This benchmark selects a bounded v0.5.0 adapter; it is not a general
comparison of every Trivy and Checkov feature.

## Fixed decision scope

The owned positive and negative fixtures contain one root `Dockerfile` and one root
`.github/workflows/ci.yml`. The release candidate requires three understandable leads:

- final Docker image user is root (`CKV_DOCKER_8`);
- Dockerfile has no health check (`CKV_DOCKER_2`);
- GitHub Actions sets top-level `permissions: write-all` (`CKV2_GHA_1`).

Compose, Terraform and Kubernetes were considered benchmark inputs but are not promoted as stable
v0.5.0 claims. Scanner output remains `suspected` until deployment context confirms applicability.

## Pinned candidates and observed cost

| Property | Trivy | Checkov |
|---|---|---|
| Version | `0.73.0` | `3.3.9` |
| Tag commit | `40c73e5d6166dcc0346a1ab4e94499d1572854e4` | `27f879342227f385ce1dbd619155f9aaed9d3cb4e` |
| License | Apache-2.0 | Apache-2.0 |
| Tested macOS release archive SHA-256 | `80cc25faaf6378e37701202d0b4f9f43d9e413d198d594ba60fdf559fe44a683` | `1f6b220faa53dd3f8bd739d77c8d62f7f84555ef3bdd4b2867315a56752ddd85` |
| Extracted macOS binary | Native release binary | Asset named `X86_64`, observed Mach-O ARM64; SHA-256 `30218b7fb690ab2f126c5a21253b5c8dcc6b49d735ac959a09ba5cf786e024c2` |
| First owned-fixture run | About 1.58 s plus about 234.65 KiB policy download | About 13.26 s |
| Repeat run | About 0.42 s with about 2.7 MiB cache | About 8.00 s |
| Fixed Docker findings | Root user and missing health check | Root user and missing health check |
| GitHub Actions in built-in scanner | No | Yes |
| Repeat structured output | Random `ReportID` requires normalization | Byte-identical in the benchmark |

The Checkov Linux CI archive is `checkov_linux_X86_64.zip` with SHA-256
`af7ccf93184fa09b5633dfd68fba78058717e6f80b31a44a3f2ef2eebd716f34`.

## Decision

Promote Checkov `3.3.9` because one fixed, offline-capable command covers the exact Dockerfile and
GitHub Actions scope without maintaining an additional policy bundle. Trivy was not rejected for
quality: it is faster in this benchmark and has broad configuration capabilities, but `trivy
config` did not provide the required GitHub Actions scanner. Meeting this release's scope would add
a separate policy distribution, pinning and evidence contract.

The promoted invocation is limited to:

```bash
cd <project>
checkov -f Dockerfile .github/workflows/ci.yml \
  --framework dockerfile github_actions \
  --check CKV_DOCKER_8,CKV_DOCKER_2,CKV2_GHA_1 \
  --output json --skip-download --compact
```

The adapter uses Checkov's real exit semantics: `0` for no selected failure and `1` for one or more
selected failures. It enumerates the supported root files before execution and passes only those
files through `-f`; an owned nested-Dockerfile control was not scanned. It accepts only version
`3.3.9`, the two named frameworks, the three named rule IDs and the pre-enumerated paths. Unknown
rules, missing per-file evidence, parser errors, malformed output, inconsistent exit status, output
overflow, timeout or path escape make applicable coverage `unknown`.

## Network and local-state boundary

`--skip-download` prevents policy download, and a macOS process sandbox with outbound networking
denied completed the owned fixture scan. Checkov's update-checker source still calls PyPI and exposes
no reliable disable flag. The product therefore says "does not upload project source; may query
PyPI for version metadata," not "never attempts network." HOME, XDG cache, TMPDIR and an empty
configuration are redirected to a private temporary directory and deleted after the version probe
and scan. Raw JSON, source code blocks, resource strings and stderr are not persisted.

## Stable boundary and remaining risk

The stable adapter has three rules, not the Checkov catalogue. It does not claim Compose,
Terraform, Kubernetes, nested Dockerfiles, effective runtime identity, deployment-level health
probes or effective workflow token permissions. Non-root changes can break file access or privileged
ports; health checks can create false unhealthy loops; permission reductions can break release,
publish or deployment jobs. Each finding records these side effects plus separate security and
functional retests.
