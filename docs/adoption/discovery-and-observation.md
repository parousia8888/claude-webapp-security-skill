# Discovery and observation runbook

The structured files in this directory separate repository preparation from owner-authorized external
actions:

- `listings.json` records each directory's rules at a fixed upstream commit and the project's current
  eligibility. Re-read the live policy immediately before any submission; the snapshot is evidence of
  a review, not permission to submit later.
- `publication-schedule.json` keeps Show HN, V2EX and Zenn 48-72 hours apart. Every post requires a
  fresh owner decision and manual publication. Reorder the source before the first live action if the
  owner chooses a different channel order.
- `observation.schema.json` defines the pre-publication, 24-hour, 72-hour and 7-day records.
  `observations/pre-publication.json` is the actual baseline captured before any channel post.

Use `null` with a concrete `missingData` entry when a metric is unavailable. Do not convert missing
downloads, Marketplace installs or independent references to zero. GitHub traffic is a rolling 14-day
counter and can include CI, release verification, the author, crawlers and other automation.

After a live post, create a schema-conforming record for each planned window. Record the exact channel,
published time, live URL and source draft. A metric change can be described as occurring after a post;
the record must keep `causalAttribution: false` because channel, timing, author network, GitHub
discovery and unrelated demand remain confounded.

MCP registry submission stays out of scope while this project has no MCP server.
