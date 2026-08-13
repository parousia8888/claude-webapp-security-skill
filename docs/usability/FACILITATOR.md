# First-use facilitator runbook

## Before the session

1. Use a clean test account or isolated home. Do not ask for access to a participant's repository,
   deployment, cloud account or secrets.
2. Provide the repository README and the owned `examples/quickstart/before` fixture. Do not provide
   hidden installation or interpretation hints.
3. Read the data boundary aloud: only the fields in `session.schema.json` will be stored; screen,
   audio, source code and terminal logs are not recorded. Any separate notes remain offline and must
   be manually redacted before publication.
4. Obtain both observation and data-boundary consent. If either is declined, stop without creating a
   record. Run `init` only after consent.

## Observation sequence

Start one timer when the participant begins each of these stages and record only bounded seconds and
the enumerated outcome:

1. Install the supported surfaces and show `webapp-security version`.
2. Start and audit the clean-room fixture until a first JSON/Markdown report exists.
3. Explain the distinction among confirmed, suspected, unknown and not_applicable using that report.
4. Inspect the proposed patch and state whether it is ready with review, needs help or would not be
   applied.
5. Apply only the fixture's documented safe change and produce retest evidence.

Record the earliest blockage category. Do not convert a participant's words into a more favorable
enum. `manualNotesPresent` means only that separate notes need human review; their content must not be
copied into the JSON record or aggregate.

## Stop conditions

Stop immediately if consent is withdrawn, a real repository or secret appears, the participant is
asked to run an active network check, the task would overwrite an existing install without informed
approval, or the session reaches two hours. Mark reached steps accurately and the session as
`abandoned` or `incomplete`; do not fill later observations by inference.

## After the session

Validate the record before the participant leaves. Store it in a private directory with mode 0600.
Do not commit real records by default. After five independent sessions, generate the aggregate and
review any offline notes separately for identifying data before deciding whether any excerpt can be
published.
