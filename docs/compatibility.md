# Compatibility matrix

| Surface | Supported | CI / verification |
|---|---|---|
| Node.js | 20, 22 | Ubuntu and macOS CI |
| Bash | 3.2+ | macOS Bash 3.2 smoke and integration tests |
| curl | Modern curl with `--tls-max` for full TLS policy | Missing capability becomes `unknown`, never pass |
| OpenSSL | Required only by the local HTTPS test fixture | CI and local integration test |
| Claude Code | Skill directory under `~/.claude/skills/` | Installer copies the release payload |
| Codex | Skill directory under `~/.codex/skills/` | `agents/openai.yaml` plus skill validator |
| GitHub Actions | Linux runner; composite Action | Local action entrypoint test and pinned release actions |
| AWS CLI | v2 recommended | Optional; permission failures are `UNCHECKED` |
| Windows | WSL2 only | Native PowerShell is not currently supported |

Project discovery currently identifies Node projects from `package.json`, common JavaScript
lockfiles and supported framework dependencies; Python projects from `pyproject.toml` or
`requirements*.txt` plus common Python lockfiles; and multi-root combinations of those ecosystems.
It records deployment/config file paths without reading them. Unsupported or ambiguous stacks
remain explicit in `security-scope.yml`.

Node 18 may run some scripts but is not a supported release target. TLS results vary by curl TLS
backend; protocol checks are capability-tested and stop with `unknown` if they cannot be proven.
