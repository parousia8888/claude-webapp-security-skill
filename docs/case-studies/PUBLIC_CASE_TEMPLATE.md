# Public case-study workflow

Use this workflow only for a source or target that the reviewer owns or is authorized to assess.
Copy `test/fixtures/public-case/no-live-target.json`, preserve the fields defined in
`template.schema.json`, and render it with:

```bash
node scripts/render-public-case.mjs --input ./case.json --output ./case.md
```

Before publication:

1. Pin the reviewed source to a full 40-character commit. Do not use a branch or tag as the evidence
   identity.
2. State whether a hosted instance was probed and whether source work ran with network access
   denied.
3. Classify each result as `confirmed`, `suspected`, `unknown`, or `not_applicable`. Do not turn a
   source lead into a confirmed vulnerability without reproduction.
4. Record false-positive closures, the smallest proposed or applied patch, and an explicit retest
   result: `fixed`, `unchanged`, `regressed`, or `not_run`.
5. Keep a suspected vulnerability private while disclosure is `private_draft` or
   `reported_privately`; the public renderer rejects both states. Suspected evidence requires
   `coordinated_public` or `public_by_upstream`. Use `not_required` only when no coordinated
   vulnerability disclosure is needed, such as a repository-owned intentional fixture.
6. Record the upstream response literally. An empty response is not approval or validation.
7. Keep unreached surfaces and evidence limits visible. Do not derive precision, coverage, or a
   security score from one case.

The renderer is deliberately strict about immutable source, evidence state, public disclosure
authorization and retest result. It renders a local fixture without contacting a live target.
