# Known limitations

This file records current product limits and recurring review cases. A clean report means that no
configured rule produced a retained finding within the recorded scope. It does not establish that a
Web application is secure.

## Built-in detection

| Limitation | What users may observe | Current behavior | Required follow-up |
|---|---|---|---|
| Pattern analysis, not whole-program data flow | A dangerous API match can be safe because its input is constant or already sanitized; a vulnerability can be missed when its source and sink are connected indirectly. | Most source matches remain `suspected`; evidence text states that reachability and untrusted input flow were not proved. | Review the call path, trust boundary, sanitization and deployed configuration. Use a pinned external SAST adapter when deeper language coverage is needed. |
| Narrow built-in language depth | JavaScript/TypeScript and Python Web patterns receive the deepest built-in checks. Java, Go, Ruby, PHP, Rust and other code may receive only manifest/configuration checks. | Unsupported source is not counted as scanned language coverage. The report limitations name the checks that did not run. | Select supported external adapters or perform agent-guided review using the phase references. |
| Bounded hand-written tokenizers | Valid but unusual JS/TS, TSX or Python syntax may not be understood. Binary/NUL content and unsupported encodings cannot be tokenized as source. | The affected file becomes explicit incomplete coverage and produces `source-evidence-incomplete / unknown`; it is never treated as a pass. | Confirm that the file is intended source, normalize its encoding when appropriate, then rerun. Report a minimized valid-syntax reproducer when parsing still fails. |
| Bounded pnpm workspace parsing | The parser supports the `packages:` list, `!` exclusions and the documented `*`/`**` package patterns. It is not a general YAML evaluator and does not execute tags, aliases or custom types. | Unreadable or uninterpretable workspace metadata becomes `pnpm_workspace_parse_error` and partial coverage. It cannot produce a confirmed missing-lockfile conclusion. | Validate `pnpm-workspace.yaml` with pnpm and simplify or report unsupported valid syntax. |
| File-local evidence states | A literal such as `rejectUnauthorized: false` is a strong file-local observation, while production reachability is still unknown. | The current stable rule contract keeps these pattern matches `suspected`; only the supported missing-lockfile absence can produce `confirmed`. | Read `evidenceBoundary` before prioritizing. Do not translate `suspected` into “confirmed vulnerability.” |
| Equivalent-condition retest matching | A unique rule/snippet can disappear from one path and appear at another because of a rename, a move, or an unrelated delete-plus-add. Static evidence cannot prove object identity. | The condition remains non-fixed and preserves its prior fingerprint; ambiguous duplicates are not paired. | Review the old and new paths before describing causality or author intent. |

## Incremental audit

`--since` and `--staged` are built-in source-audit noise filters. They do not run external adapters,
cannot be combined with baseline/retest comparison, and do not establish whole-repository safety.
`--since` excludes untracked files because Git has no diff record for them. `--staged` scans the Git
index snapshot and therefore excludes unstaged content by design.

## Rule-contract conformance interpretation

The rule-contract conformance suite uses author-maintained planted examples. Its pass/fail results
answer whether each named built-in rule recognizes its declared positive example in the expected
evidence state and stays quiet on its declared safe neighbour. They do not measure whole-project
vulnerability precision or recall, production reachability, exploitability, language coverage or
the agent-guided methodology. The [historical real-world regression corpus](docs/regressions/v0.5.4-real-world-regressions.md)
guards named minimized failures, while ordinary-project review remains a separate evidence set;
neither is a representative accuracy benchmark.

## MCP and rule expansion

No MCP server ships in v0.5.3. npm/npx, the ordinary CLI and the Claude plugin invoke the current
runtime. Additional stable rules are also outside this release; the current count remains 20
built-in risk rules plus two evidence-integrity rules. The documented architecture gates require a
permission model and client evidence for MCP, and positive/negative fixtures plus false-positive
review for every future stable rule.

## External adapters and runtime evidence

- Checkov, Gitleaks, Opengrep and OSV-Scanner remain opt-in and must be installed and version-pinned
  by the caller. An unavailable adapter produces incomplete evidence, never a pass.
- Source audit does not execute project dependencies, start the application or prove deployed
  reachability. API authorization, identity, LLM, database isolation and cloud runtime review remain
  agent-guided unless a named adapter explicitly records otherwise.
- The CLI proposes review steps and patches but does not edit the target project. Functional side
  effects still require owner approval and product-specific tests.

## Recurring expected matches

These are review classes, not blanket suppressions:

- DOM sinks can be intentional when content is constant or a reviewed sanitizer dominates the sink.
- Command-execution APIs can be safe for constant commands while still deserving review at the
  boundary where user-controlled arguments enter.
- Debug, permissive CORS or TLS options can exist only in tests or local development; the built-in
  rule does not prove which configuration reaches production.
- Security-named literals can be placeholders or test fixtures. The tool records redacted length
  bands and does not test credential validity.
- Missing application security headers can be supplied by a reverse proxy or CDN that source audit
  cannot see. Verify the deployed edge before closing the finding.

## Resolved regressions

The following are historical and covered by machine regressions; they are not current limitations:

| Version fixed | Regression | Guard |
|---|---|---|
| 0.5.2 | pnpm workspace packages covered by the root lockfile could be marked confirmed missing-lockfile facts. | Workspace include/exclude, deep-glob and malformed-metadata regressions. |
| 0.5.2 | v3 Markdown/HTML risk summaries rendered `[object Object]`. | Golden Markdown and HTML summary assertions. |
| 0.5.2 | Nested SSR/TSX template literals could stop analysis of the whole file. | Nested-template and executable-expression tokenizer regressions. |
| 0.5.2 | A pure path rename could appear as `fixed + new`. | Unique equivalent-condition and ambiguous-duplicate retest regressions. |

Report new false-positive classes or minimized parser failures through
[GitHub Issues](https://github.com/parousia8888/web-app-security-skill/issues). The handling and
suppression policy is documented in [docs/false-positive-policy.md](docs/false-positive-policy.md).
