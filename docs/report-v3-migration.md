# Report v3 migration

Report v3 adds a structured explanation and repair-decision contract to each finding. It preserves
v2 subject identity, scope digest, rule revision, ruleset identity, coverage, result state,
baseline state, policy and fingerprint semantics.

## Reading historical reports

- v1 remains historical display input and requires the existing explicit migration/binding path
  before it can participate in any later comparison.
- v2 remains readable by `webapp-security explain`.
- Source `retest` accepts a persisted v2 baseline only when its subject, scope, adapter version,
  rule revision, digest sidecar and coverage meet the existing v2 compatibility contract.
- A compatible v2 baseline is upgraded in memory for comparison. The original report and digest
  sidecar are never modified.

Missing v3 explanation fields are generated for display/continuity only. They do not add evidence,
change a result from `suspected` or `unknown`, or prove exploitability. A retained v2 finding keeps
its existing fingerprint because explanation wording is deliberately outside fingerprint identity.

## New explanation fields

Every v3 finding requires:

- `technicalTerm` and `plainLanguage`;
- `consequence` and `evidenceBoundary`;
- versioned `standards` references when an exact mapping exists;
- a proposal `status` and `summary`, plus `alternatives`;
- at least one `sideEffects` entry;
- separate `securityRetest` and `functionalRetest` instructions;
- `rollback` conditions and any `userDecisions`.

These fields are sanitized and length-bounded. Markdown and HTML renderers lead with the
plain-language view and omit raw evidence. JSON retains sanitized evidence; `explain --technical`
shows the technical evidence block.

## Compatibility boundaries

- Explanation-only edits do not change a finding fingerprint or ruleset digest.
- Detector semantic changes still require a rule revision and become `not_comparable` where the
  existing baseline contract requires it.
- Incomplete current coverage remains `unretested`; it cannot produce `fixed`.
- A v2 or v3 baseline from another subject or scope is rejected before a report bundle is written.
- v3 does not convert a source match, scanner lead or standards mapping into `confirmed`.
