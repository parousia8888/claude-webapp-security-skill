# Open WebUI ordinary project journey

## Scope

- Repository: `open-webui/open-webui`
- Commit: [`01f4282f1ffe0d6212f58d3afbeae21fffd0c4be`](https://github.com/open-webui/open-webui/tree/01f4282f1ffe0d6212f58d3afbeae21fffd0c4be)
- Stack: SvelteKit/Vite frontend plus Python/FastAPI backend
- Method: immutable source, deterministic discovery/audit, source trace, and local representative
  patch/retest
- Network: denied during discovery, audit and fixture retest
- No hosted instance was probed; deployment authorization remained pending.

## Discovery and raw result

Discovery returned `supported` / `split-stack`; identified SvelteKit, Vite, Svelte and FastAPI;
found npm, uv and pip evidence; and recorded `package-lock.json`, `uv.lock`, Docker and workflow
surfaces. The corrected audit returned exactly one result:

| Rule | Location | Severity | Evidence state | Baseline |
|---|---|---|---|---|
| `production-source-map-enabled` | `vite.config.ts:24` | medium | `suspected` | `new` |

There were 0 confirmed findings. The configuration says `sourcemap: true`:
[vite.config.ts#L19-L31](https://github.com/open-webui/open-webui/blob/01f4282f1ffe0d6212f58d3afbeae21fffd0c4be/vite.config.ts#L19-L31).

## False-positive closure

The first run also reported `.env.example` and `backend/requirements.txt`. The former is an
explicit template. The latter is a pinned deployment dependency input, while root
`pyproject.toml` is covered by `uv.lock`; neither is evidence of a missing lockfile. Both leads
were removed by planted tool regressions, not hidden from the case report.

## Manual trace

The package build invokes `vite build`:
[package.json#L5-L22](https://github.com/open-webui/open-webui/blob/01f4282f1ffe0d6212f58d3afbeae21fffd0c4be/package.json#L5-L22).
The Docker frontend stage runs that build:
[Dockerfile#L26-L44](https://github.com/open-webui/open-webui/blob/01f4282f1ffe0d6212f58d3afbeae21fffd0c4be/Dockerfile#L26-L44),
then copies `/app/build` into the final image:
[Dockerfile#L179-L185](https://github.com/open-webui/open-webui/blob/01f4282f1ffe0d6212f58d3afbeae21fffd0c4be/Dockerfile#L179-L185).
FastAPI mounts the frontend build as the root static application:
[main.py#L2866-L2878](https://github.com/open-webui/open-webui/blob/01f4282f1ffe0d6212f58d3afbeae21fffd0c4be/backend/open_webui/main.py#L2866-L2878).

Classification remains `suspected`: this is stronger than a bare config match, but no dependency
execution, build artifact or hosted response was inspected. It does not confirm that a `.map` file
is emitted, packaged or publicly retrievable.

## Repair, regression, and retest

The generated proposal changes only this build option:

```diff
-    sourcemap: true
+    sourcemap: false
```

The upstream checkout was not modified. `test/fixtures/case-open-webui` contains a minimal local
representative of the same config. `test/case-journeys.test.mjs` records a baseline with one medium
`suspected` lead, changes `true` to `false` in the temporary copy, and invokes required-baseline
`retest`. The output retains the evidence state as `suspected` and records baseline state `fixed`;
this proves the rule's repair loop, not an upstream or deployment fix.

## Unreached surfaces

- Actual Vite output, image contents and hosted `.map` delivery remain `unknown`.
- Authentication, LLM, API, plugin, data and deployment boundaries were not reviewed.
- The case does not establish exploitability, sensitive source content or reportability under the
  project's disclosure policy.

## Reproduce

```bash
git clone https://github.com/open-webui/open-webui.git /tmp/open-webui-case
git -C /tmp/open-webui-case checkout 01f4282f1ffe0d6212f58d3afbeae21fffd0c4be
node scripts/run-case-journey.mjs open-webui /tmp/open-webui-case --out /tmp/open-webui-evidence
```
