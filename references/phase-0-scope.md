# Phase 0 — Scope and authorization anchor (gate)

**Purpose:** before a single active request, make it verifiable that the target belongs to the person asking. This separates "auditing my own system" from "attacking someone else's", and it is the only thing that makes that distinction checkable later, by a third party, from artifacts.

Do this even for the user's own property. It takes minutes.

## 1. Write `scope.md`

Copy `assets/scope-template.md` into the workspace root as `scope.md` and fill every field. No 🔴 phase starts until `auth.status = granted` and a proof method has succeeded.

Minimum fields:

```
target:            https://example.com
environment:       staging | production
auth.status:       granted | pending | denied
auth.basis:        self-owned + ownership proof | signed authorization from <party>
auth.proof:        well-known-file | dns-txt | registrar | cloud-console
network_profile:   authorized_target_only
in_scope:          hosts, subdomains, API base paths, mobile/API clients
out_of_scope:      third-party SaaS, payment processor, CDN vendor, OAuth provider,
                   email provider, anything not owned by the requester
window:            2026-08-14 21:00 – 23:00 JST
max_rps:           2
destructive:       forbidden
data_handling:     no bulk extraction; evidence redacted; findings stored in ./reports
rollback:          how to undo any state a test creates
contact:           who to call if production degrades
```

## 2. Prove ownership (pick one, record the result)

**Option A — well-known file**
```bash
# generate a token
openssl rand -hex 16
# place it, then confirm from an independent path
curl -sS https://example.com/.well-known/pentest-authz.txt
```

**Option B — DNS TXT record**
```bash
dig +short TXT _pentest-authz.example.com
```

**Option C — control-plane evidence** (fine for self-owned infra): the user demonstrates access to the AWS account / DNS registrar / hosting console that serves the domain. Record which, and the account id — never credentials.

If the target is a third party, none of the above substitutes for **written authorization from the asset owner** naming the scope and window.

## 3. Environment separation

- Run 🔴 phases against **staging** whenever staging exists and is representative.
- Against production, restrict to passive and read-only verification: status codes, headers, unauthenticated access checks, your own accounts.
- If staging shares a database with production, it is production. Check before assuming.
- Create dedicated test accounts (at least two, so object-level authorization can be tested between them) and label them clearly.

## 4. Rules of engagement

Written into `scope.md`, enforced during the work:

- rate cap (a few requests/second), no parallel floods
- no denial-of-service testing, ever — a missing rate limit is proven by observing that N sequential attempts all succeed, not by sending 10,000
- no testing against other users' data; two accounts you created, or nothing
- no data exfiltration: prove read access with a single record you own, or a marker value
- no persistence, no backdoors, no modifying auth config
- pause immediately on: production degradation, discovery of real third-party PII, evidence of a pre-existing compromise
- **pre-existing compromise is a stop-and-escalate event**, not a finding to keep testing around

## 5. Non-destructive proof patterns

Prefer the weakest evidence that still settles the question:

| Question | Destructive proof (don't) | Non-destructive proof (do) |
|---|---|---|
| Is there IDOR? | dump all users' records | fetch **one** record belonging to your second test account; report only its id |
| Is the redeem code brute-forceable? | run a full wordlist | send 20 sequential wrong codes; show none were rate-limited or locked out |
| Is the email endpoint a bomb? | send 1000 mails | send 5 to your own address; show no throttle, no per-recipient cap |
| Is XSS reachable? | steal a session | render a benign marker (`<b>x</b>` or a `console.log`), screenshot |
| Is SSRF possible? | hit cloud metadata | point it at a host you control and observe the callback; do **not** read instance credentials |
| Is the LLM jailbreakable? | generate harmful content | make it emit a fixed harmless marker string outside its task frame |
| Is there a race condition? | drain the credit ledger | two concurrent claims for one reward on your own account; show balance +2 |

Record the marker values used. They are what makes the finding reproducible without re-running the attack.

## 6. Evidence handling

- Store artifacts under `reports/<date>-<target>/`, and keep raw captures out of git.
- Redact before writing: tokens, cookies, `Authorization` headers, API keys, full share URLs, emails, other users' identifiers, real client IPs.
- Keep a chronological log: timestamp, request summary, observation, verdict. This is what turns "I think it is vulnerable" into a reproducible finding — and what proves what you did *not* do.
- Delete test data (accounts, uploads, redeem codes) at the end, and note what could not be deleted.

## 7. Gate check before any 🔴 phase

```
[ ] scope.md exists, complete, auth.status = granted
[ ] ownership proof executed and its output recorded
[ ] environment chosen (staging preferred) and confirmed not shared with prod
[ ] two test accounts created and labelled
[ ] rate cap and window agreed
[ ] rollback and contact recorded
[ ] evidence directory created, redaction rules understood
```

If any box is unchecked, run the read-only phases (1, 4, X-1, X-4, X-5) instead and say why the rest is blocked.
