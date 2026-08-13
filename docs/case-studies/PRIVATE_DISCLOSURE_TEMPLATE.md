# Private vulnerability disclosure template

Do not place suspected vulnerability details in a public issue, pull request, case study, social
post, or repository branch. Use the upstream project's declared private security channel.

## Subject

Private security report: `<short impact and affected component>`

## Message

```text
Hello <maintainer/security team>,

I reviewed <repository/component> at immutable commit <40-character commit> within this boundary:
<owned or written-authorization boundary>. I did not probe a hosted instance unless stated below.

Observed state: <confirmed | suspected | unknown>
Affected versions or commits: <known range or unknown>
Smallest reproduction: <sanitized, non-destructive steps>
Expected behavior: <expected security boundary>
Observed behavior: <actual result>
Potential impact: <bounded impact; distinguish evidence from hypothesis>
Evidence: <sanitized paths, line references, fixture output or hashes>
Proposed minimal repair: <patch summary or none>
Retest status: <fixed | unchanged | regressed | not_run>

No credentials, tokens, private user data, target identifiers, or raw production logs are included.
Please confirm your preferred coordination window and whether/when a sanitized public case may be
published. Silence or receipt acknowledgement will not be treated as publication approval.

Credit preference: <name/handle | anonymous>
Secure reply channel: <channel>
```

## Disclosure record

- `private_draft`: prepared locally; not sent.
- `reported_privately`: sent through the upstream private channel; keep details private.
- `coordinated_public`: upstream explicitly approved the recorded public scope/timing.
- `public_by_upstream`: upstream already published the relevant details; cite the immutable advisory.

Store sensitive correspondence outside the public repository. The public JSON records only the
state and a sanitized upstream response; it does not store private messages or contact data.
