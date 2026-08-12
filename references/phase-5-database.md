# Phase 5 — Database and data layer 🔴

**Gate: Phase 0 complete.** Never test against production data you cannot restore.

## 1. Network isolation (do this first)

- Database, cache, and search cluster in **private subnets**, no public IP, no route to an internet gateway.
- Security group allows the port **from the app's security group**, not from a CIDR, and never from `0.0.0.0/0`.
- Self-managed Mongo/Redis/Elasticsearch on a VM: bound to the private interface, **authentication enabled**. Default-open Redis and Mongo remain among the most common mass-compromise vectors — they get found within hours of exposure.
- Verify from outside, not from the config: attempt a connection from an unrelated network and confirm it times out.
- Admin tooling (phpMyAdmin, Mongo Express, RedisInsight, Adminer) must not be reachable from the internet. If it exists at all, put it behind SSM port-forwarding or a VPN.

```bash
# from a machine outside the VPC — expect timeouts
nc -zv -w3 db.example.internal 5432
nc -zv -w3 <public-ip> 27017 6379 9200 3306
```

## 2. Least privilege

- The application uses a dedicated account, not the master/root user.
- Grants limited to the schemas and operations it needs; no DDL rights in normal operation (migrations run under a separate credential in a separate step).
- Separate read-only credentials for analytics/reporting jobs and for the admin dashboard's read paths.
- No shared credential across environments.
- Per-tenant isolation strategy explicit: schema-per-tenant, row filter, or app-level scoping — and whichever it is, enforced in the data layer, not in each handler (ties back to Phase 2 Stage 3).

**Verify it, don't assume it.** "Uses a dedicated account" is often true while that account is still a superuser/owner — which is the whole risk, because a superuser can turn one SQL injection into RCE (`COPY … TO/FROM PROGRAM` on Postgres, `xp_cmdshell` on MSSQL, `LOAD_FILE`/`INTO OUTFILE` on MySQL) and read/write server files. Prove the runtime role cannot:

```sql
-- Postgres, connected AS THE RUNTIME ROLE (not as postgres/admin):
SELECT current_user, (SELECT rolsuper FROM pg_roles WHERE rolname = current_user);  -- rolsuper must be f
CREATE TABLE _priv_probe(x int);          -- must fail: permission denied
COPY (SELECT 1) TO PROGRAM 'id';          -- must fail: permission denied (this is the RCE path)
```

Set it up as: a restricted `app_rt` role with `SELECT/INSERT/UPDATE/DELETE` on the tables + sequences it uses and nothing else; `ALTER DEFAULT PRIVILEGES FOR ROLE <owner> … GRANT …` so tables created by future migrations are auto-granted. Migrations keep the DDL-capable owner role and run as a **separate step with an overridden connection string** — the runtime container never holds DDL rights. (See `deploy-safety.md` for the migration-credential split, or a routine `migrate` breaks with `permission denied` and reads like an outage.)

## 3. Encryption and key handling

- At rest: storage-level encryption on, with a customer-managed key where the compliance story needs one.
- In transit: TLS enforced for client connections; reject non-TLS.
- Field-level encryption or hashing for the highest-sensitivity columns (tokens, government ids, payment references). Passwords are hashed with argon2id/bcrypt, never encrypted.
- Keys managed by a KMS, rotated, with the app holding only decrypt permission for what it needs.

## 4. Availability and resource behaviour

- **Connection pool starvation** is the failure mode most apps meet first: a request that holds a DB connection while awaiting a slow third party (LLM, payments, mail) multiplies latency into an outage. Fix by releasing the connection before the external call, sizing the pool to the DB's limit, and setting timeouts on both sides.
- Statement timeout and idle-in-transaction timeout set server-side, so one bad query cannot pin a connection forever.
- Slow query log on; the top offenders indexed. An unindexed query on a table that grows is a scheduled outage.
- Pagination enforced at the data layer with a maximum page size (Phase 2 Stage 10).
- Read replica for heavy read paths, with the staleness implications understood.

## 5. Backups and recovery

- Automated backups with retention matched to an actual recovery requirement.
- **A restore has been performed and timed.** An untested backup is a hypothesis. Record the achieved RTO/RPO, not the target.
- Backups stored where the app's credentials cannot delete them (separate account/vault) — this is the ransomware and insider control.
- Point-in-time recovery enabled where the data warrants it.
- Deletion protection on production instances/clusters.
- Backup contents are as sensitive as the database: encrypted, access-logged, never copied to a laptop.

## 6. Data lifecycle and privacy

- Retention policy per data class; automatic purge of what is past retention. Keeping everything forever is a liability, not a feature.
- Deletion is real deletion: user-requested deletion must also clear caches, search indexes, vector stores, analytics copies, and backups within the stated window.
- PII inventory: what personal data exists, where, why, and for how long. Access logs on the stores that hold it.
- Non-production environments must not contain production data. If they do, that environment inherits production's controls — or gets masked/synthetic data instead.

## 7. Integrity of value-bearing data

For ledgers, credits, balances, entitlements:

- Append-only event log plus a derived balance, rather than a mutable counter, wherever feasible.
- Unique constraints enforcing idempotency at the database level (`dedupeKey`), so a race that slips past the app still cannot double-credit (Phase 2 Stage 6).
- Transactions with the isolation level the invariant actually needs; document which invariants depend on it.
- A reconciliation job that recomputes balances from events and alerts on drift. This is how you find out you were exploited.

## Exit criteria

```
[ ] no database port reachable from the internet (verified from outside)
[ ] app uses a least-privilege account; migrations use a separate credential
[ ] TLS enforced; encryption at rest on; keys in a KMS
[ ] statement/idle timeouts set; pool sized; external calls do not hold connections
[ ] slow queries indexed; pagination capped
[ ] backups automated, encrypted, immutable to the app role, and a restore drill completed
[ ] retention + deletion propagate to caches, indexes, and vector stores
[ ] value-bearing tables protected by unique idempotency constraints and a reconciliation job
```
