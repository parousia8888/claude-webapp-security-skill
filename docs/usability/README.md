# First-use validation kit

This kit records whether an independent participant can install Web App Security Skill, produce a
first report, interpret result states, review a proposed patch and reach a retest using only the
owned clean-room fixture. It does not collect a participant's real repository or turn five records
into a product-quality claim.

The machine-readable contract is `session.schema.json`. A record accepts only an anonymous session
ID, a sequence from 1 to 10, one of three entry paths, consent booleans, fixed fixture identity,
supported environment enums, bounded step durations, outcome/comprehension enums and a boolean saying
whether separate manual notes exist. There is no field for name, email, IP address, repository URL,
source code, secret, free text or raw terminal output. Unknown fields are rejected.

The entry paths are `npx`, `claude_repository_plugin` and `verified_installer`. The repository plugin
path requires the Claude surface. `sessionSequence` records recruitment order without a timestamp or
identity so the first-five stop rule can be evaluated deterministically.

## Commands

Initialize a private record only after consent:

```bash
node scripts/usability-study.mjs init \
  --out usability-sessions/S-A1B2C3D4.json \
  --session-id S-A1B2C3D4 \
  --sequence 1 --entry-path npx \
  --surface codex --os macos --node-major 22 --consent
```

Record observed values. A timed status other than `not_attempted` requires its duration in seconds:

```bash
node scripts/usability-study.mjs record usability-sessions/S-A1B2C3D4.json \
  --installation-status completed --installation-seconds 95 \
  --first-report-status completed --first-report-seconds 240 \
  --first-blockage none --comprehension correct \
  --suspected-meaning lead_requires_confirmation \
  --patch-confidence ready_with_review \
  --side-effect-comprehension correct \
  --retest-status completed --retest-seconds 80 \
  --retest-distinction correct \
  --session-outcome completed --manual-notes-present false
```

Validate and aggregate:

```bash
node scripts/usability-study.mjs validate usability-sessions/*.json
node scripts/usability-study.mjs aggregate --dir usability-sessions \
  --out usability-summary.md --json usability-summary.json
```

With fewer than five schema-valid sessions, the output is `incomplete` and states how many are
missing. From five through ten it becomes `sufficient_for_review`, never `passed`. The publication
gate is `insufficient_data`, `stop`, or `owner_review_required`; it never publishes anything. It
stops broad publication when fewer than four of the first five reach a report, when two participants
treat `suspected` as a confirmed vulnerability, or when the same installation/command-discovery
blockage appears twice. Any malformed record, duplicate ID, duplicate/non-contiguous sequence or
out-of-protocol eleventh session stops aggregation without silently dropping a record.

Follow [the facilitator runbook](FACILITATOR.md) and give the participant only
[the participant task](PARTICIPANT_TASK.md). Real participant recruitment, consent and observation
remain `external_validation_pending` until five actual records exist.
