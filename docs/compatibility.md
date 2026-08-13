# Compatibility matrix

| Surface | Supported | CI / verification |
|---|---|---|
| Node.js | 20, 22 | Ubuntu and macOS CI |
| Bash | 3.2+ | macOS Bash 3.2 smoke and integration tests |
| Verified bootstrap | POSIX `sh`, Node.js and curl | Immutable bootstrap digest plus loopback fixture tests |
| curl | Modern curl with `--tls-max` for full TLS policy | Missing capability becomes `unknown`, never pass |
| OpenSSL | Required only by the local HTTPS test fixture | CI and local integration test |
| Claude Code | Skill directory under `~/.claude/skills/` | Install, marker, upgrade, uninstall and migration tests in an isolated home |
| Codex | Skill directory under `~/.codex/skills/` | `agents/openai.yaml`, Skill validator and isolated lifecycle tests |
| Ordinary CLI | `~/.local/share/web-app-security` plus `~/.local/bin/webapp-security` | Extracted-release lifecycle under a network-denied isolated home |
| GitHub Actions | Linux runner; composite Action | Local entrypoint test plus manually dispatched real `@v1` consumer workflow |
| AWS CLI | v2 recommended | Optional; permission failures are `UNCHECKED` |
| Windows | WSL2 only | Native PowerShell is not currently supported |

Project discovery currently identifies Node projects from `package.json`, common JavaScript
lockfiles and supported framework dependencies; Python projects from `pyproject.toml` or
`requirements*.txt` plus common Python lockfiles; and multi-root combinations of those ecosystems.
It records deployment/config file paths without reading them. Unsupported or ambiguous stacks
remain explicit in `security-scope.yml`.

The deterministic source audit currently recognizes adjacent lockfile absence, environment-named
files without reading their contents, public Node inspector bindings in package scripts and common
production source-map settings. JSON, Markdown, HTML, SARIF 2.1.0 and JUnit render from one report
object. Other security domains remain agent-guided until a specific deterministic adapter ships.

Node 18 may run some scripts but is not a supported release target. TLS results vary by curl TLS
backend; protocol checks are capability-tested and stop with `unknown` if they cannot be proven.

The low-level lifecycle commands do not fetch remote code. `install` copies the extracted release
that executes it. The verified bootstrap downloads a pinned verifier and explicit release assets,
checks their independent SHA-256 trust anchors, manifest, checksum list, SBOM, commit and archive
paths, then invokes the same lifecycle command. Replacement and removal require a recognized install
marker or the documented legacy Skill identity; unknown paths are left untouched. Native Windows,
PowerShell launchers and a native WSL2 evidence run remain unsupported.
