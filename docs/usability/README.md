# First-use validation kit

This kit records whether an independent participant can install Web App Security Skill, produce a
first report, interpret result states, review a proposed patch and reach a retest using only the
owned clean-room fixture. It does not collect a participant's real repository or turn five records
into a product-quality claim.

The machine-readable contract is `session.schema.json`. A record accepts only an anonymous session
ID, consent booleans, fixed fixture identity, supported environment enums, bounded step durations,
outcome enums and a boolean saying whether separate manual notes exist. There is no field for name,
email, IP address, repository URL, source code, secret, free text or raw terminal output. Unknown
fields are rejected.

## Commands

Initialize a private record only after consent:

```bash
node scripts/usability-study.mjs init \
  --out usability-sessions/S-A1B2C3D4.json \
  --session-id S-A1B2C3D4 \
  --surface codex --os macos --node-major 22 --consent
```

Record observed values. A timed status other than `not_attempted` requires its duration in seconds:

```bash
node scripts/usability-study.mjs record usability-sessions/S-A1B2C3D4.json \
  --installation-status completed --installation-seconds 95 \
  --first-report-status completed --first-report-seconds 240 \
  --first-blockage none --comprehension correct \
  --patch-confidence ready_with_review \
  --retest-status completed --retest-seconds 80 \
  --session-outcome completed --manual-notes-present false
```

Validate and aggregate:

```bash
node scripts/usability-study.mjs validate usability-sessions/*.json
node scripts/usability-study.mjs aggregate --dir usability-sessions \
  --out usability-summary.md --json usability-summary.json
```

With fewer than five schema-valid sessions, the output is `incomplete` and states how many are
missing. At five or more it becomes `sufficient_for_review`, never `passed`. Any malformed record or
duplicate ID stops the entire aggregate without silently dropping that session.

Follow [the facilitator runbook](FACILITATOR.md) and give the participant only
[the participant task](PARTICIPANT_TASK.md). Real participant recruitment, consent and observation
remain `external_validation_pending` until five actual records exist.
