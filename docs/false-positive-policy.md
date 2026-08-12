# False-positive policy

## Result states

- `confirmed`: reproduced through the real execution path with sufficient, sanitized evidence.
- `suspected`: a source pattern or scanner hit that still requires runtime or ownership context.
- `unknown`: the check could not run or its evidence source was unavailable.
- `not applicable`: the component or control is outside the recorded scope.

Only `confirmed` findings may be counted as demonstrated vulnerabilities. Case studies and release
notes must not promote `suspected` findings to confirmed for presentation value.

## Reporting a false positive

Open the false-positive issue form with the tool version, sanitized command, affected finding ID,
minimal fixture, actual output, expected output, and environment. For private target details, use
the channel in `SECURITY.md`.

Maintainers reproduce the report, classify whether the error is a rule problem, missing context,
transport failure, or documentation ambiguity, then add a failing regression before changing the
rule. A suppression is accepted only when its scope is narrower than the finding it suppresses.

## Metrics

Releases report confirmed regressions, known unknown states, and case-study false positives. The
project does not publish a single precision percentage until the corpus and ground truth are large
enough to make that number meaningful.
