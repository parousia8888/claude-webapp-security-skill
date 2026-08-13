# Open WebUI ordinary project journey

## Scope

- Repository: `open-webui/open-webui`
- Commit: [`01f4282f1ffe0d6212f58d3afbeae21fffd0c4be`](https://github.com/open-webui/open-webui/tree/01f4282f1ffe0d6212f58d3afbeae21fffd0c4be)
- Stack: SvelteKit/Vite frontend plus Python/FastAPI backend
- Method: immutable source, complete v2 built-in/Gitleaks/OSV path, trace, and local fixture retest
- Corpus snapshot: `2026-08-14`; Gitleaks `8.30.1`, OSV-Scanner `2.5.0`
- Network: only OSV's public advisory service; fixture retest remained network-denied
- No hosted instance was probed; deployment authorization remained pending.

## Discovery and raw result

Discovery returned `supported` / `split-stack`, identified SvelteKit, Vite, Svelte and FastAPI, and
recorded npm, uv and pip evidence. The built-in path returned one result:

| Rule | Location | Severity | Evidence state |
|---|---|---|---|
| `production-source-map-enabled` | `vite.config.ts:24` | medium | `suspected` |

The configuration says `sourcemap: true`:
[vite.config.ts#L19-L31](https://github.com/open-webui/open-webui/blob/01f4282f1ffe0d6212f58d3afbeae21fffd0c4be/vite.config.ts#L19-L31).
Gitleaks returned no match. OSV recorded 143 package/advisory matches across `package-lock.json` and
`uv.lock`. The dated snapshot is **0 confirmed, 144 suspected, 0 unknown**. OSV rows remain local
`info` leads; 143 is not a vulnerability score and may change with the advisory database.

## False-positive closure

The first built-in run also reported `.env.example` and `backend/requirements.txt`. The former is a
template; the latter is a pinned deployment input, while root `pyproject.toml` is covered by
`uv.lock`. Both leads were removed by planted regressions, not hidden from the report. OSV matches
were not promoted from package/version correspondence to project impact.

## Manual trace

The package invokes `vite build`:
[package.json#L5-L22](https://github.com/open-webui/open-webui/blob/01f4282f1ffe0d6212f58d3afbeae21fffd0c4be/package.json#L5-L22).
Docker runs that build:
[Dockerfile#L26-L44](https://github.com/open-webui/open-webui/blob/01f4282f1ffe0d6212f58d3afbeae21fffd0c4be/Dockerfile#L26-L44),
copies `/app/build` into the final image:
[Dockerfile#L179-L185](https://github.com/open-webui/open-webui/blob/01f4282f1ffe0d6212f58d3afbeae21fffd0c4be/Dockerfile#L179-L185),
and FastAPI mounts the frontend build:
[main.py#L2866-L2878](https://github.com/open-webui/open-webui/blob/01f4282f1ffe0d6212f58d3afbeae21fffd0c4be/backend/open_webui/main.py#L2866-L2878).

Classification remains `suspected`: no build artifact or hosted response was inspected, so public
`.map` delivery is not confirmed.

## Repair, regression, and retest

The proposed local change is `sourcemap: true` to `false`. The upstream checkout was not modified.
`test/fixtures/case-open-webui` represents the config; `test/case-journeys.test.mjs` records the
baseline, changes the temporary fixture, and requires a compatible retest that marks the lead
`fixed`. This proves the rule's repair loop, not an upstream or deployment fix. External advisory
leads remain unpatched triage input.

## Unreached surfaces

- Actual Vite output, image contents and hosted `.map` delivery.
- Dependency reachability and deployed package versions.
- Authentication, LLM, API, plugin, data and deployment boundaries.

## Reproduce

```bash
git clone https://github.com/open-webui/open-webui.git /tmp/open-webui-case
git -C /tmp/open-webui-case checkout 01f4282f1ffe0d6212f58d3afbeae21fffd0c4be
node scripts/run-case-journey.mjs open-webui /tmp/open-webui-case --out /tmp/open-webui-evidence
```

Set `WEBAPP_SECURITY_GITLEAKS_BIN` and `WEBAPP_SECURITY_OSV_SCANNER_BIN` to caller-installed pinned
binaries before the last command. The runner performs no download; OSV advisory results can drift
after the recorded snapshot.
