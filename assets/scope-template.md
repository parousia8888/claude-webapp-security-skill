# scope.md — authorization anchor

> Copy to the workspace root, fill every field, keep it in version control.
> No active (🔴) testing begins until `auth.status: granted` and a proof method has succeeded.

## Target

```yaml
target:            https://example.com
environment:       staging            # staging | production
shares_db_with_prod: false            # if true, treat as production
in_scope:
  - example.com
  - api.example.com
  - /api/**
out_of_scope:
  - third-party payment processor
  - OAuth provider (Google/Apple/GitHub)
  - email/SMS provider
  - CDN vendor control plane
  - any host not owned by the requester
```

## Authorization

```yaml
auth.status:       pending            # granted | pending | denied
auth.basis:        self-owned         # self-owned | written authorization from <party>
auth.proof:                           # well-known-file | dns-txt | registrar | cloud-console
auth.proof_value:                     # token used, or account id shown (never credentials)
auth.proof_at:                        # timestamp the proof was verified
authorized_by:                        # name + role, if not self
```

Ownership proof, one of:

```bash
openssl rand -hex 16                                   # generate token
curl -sS https://example.com/.well-known/pentest-authz.txt
dig +short TXT _pentest-authz.example.com
```

## Rules of engagement

```yaml
network_profile:   authorized_target_only
window:            YYYY-MM-DD HH:MM – HH:MM TZ
max_rps:           2
destructive:       forbidden
dos_testing:       forbidden
third_party_data:  forbidden          # stop immediately if real user PII is reached
test_accounts:
  - sec-test-a@example.com
  - sec-test-b@example.com            # two accounts, so BOLA can be tested
rollback:                             # how to undo any state created
contact:                              # who to call if production degrades
stop_conditions:
  - production error rate rises
  - real third-party PII encountered
  - evidence of pre-existing compromise   # stop and escalate, do not keep testing
```

## Data handling

```yaml
evidence_dir:      ./reports/YYYY-MM-DD-example.com
redact:            [tokens, cookies, authorization headers, api keys, emails,
                    full share URLs, other users' ids, real client IPs]
bulk_extraction:   forbidden
retention:         delete raw captures after the report is accepted
```

## Phase gate

```
[ ] scope.md complete, auth.status = granted
[ ] ownership proof executed and recorded
[ ] environment confirmed (and confirmed not sharing prod data)
[ ] two test accounts created
[ ] rate cap + window agreed
[ ] rollback + contact recorded
[ ] evidence dir created
```

## Activity log

| Time | Phase | Action | Observation | Verdict |
|---|---|---|---|---|
| | | | | |
