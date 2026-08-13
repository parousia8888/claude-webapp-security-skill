# AWS hardening for a public web app

Scoped to a typical stack: Route53/DNS → CloudFront (or Cloudflare) → ALB or EC2 → app → managed DB, plus S3, IAM, secrets, logging.

Run `scripts/aws-exposure-audit.sh` first — read-only `describe`/`list`/`get` calls that produce the inventory these checks refer to. Anything the script could not check due to missing IAM permissions must appear in the report as *unchecked*, never as *passed*. Nested inventory calls follow the same rule: a denied per-user MFA read cannot become "no MFA", and a denied trail-status read cannot become "not logging". The script exits `3` when no confirmed HIGH finding exists but one or more checks remain `UNCHECKED`; `1` remains reserved for confirmed HIGH findings.

Priority order below is by real-world blast radius, not by checklist convention.

---

## 1. Identity (highest blast radius)

- [ ] Root account: MFA enabled (hardware key preferred), **no access keys**, used for nothing operational
- [ ] IAM Identity Center / SSO for humans; delete standalone IAM users where possible
- [ ] Every remaining IAM user has MFA; access keys rotated ≤90d; unused keys deleted (check `credential-report`)
- [ ] No `"Action": "*"` + `"Resource": "*"` in any customer-managed policy still attached
- [ ] No `AdministratorAccess` on service roles; EC2 instance roles scoped to the exact buckets/parameters they need
- [ ] No IAM role trust policy with `"Principal": {"AWS": "*"}` or an unconstrained external account
- [ ] CI/CD uses **GitHub OIDC → assumed role**, not long-lived keys stored as secrets; the trust policy pins `repo:owner/name:ref:refs/heads/main` (a `sub` wildcard here is a full account takeover path)
- [ ] SCP or permission boundary preventing CloudTrail/GuardDuty/Config from being disabled by app roles

## 2. Network edge and origin lock

- [ ] Security groups: **no `0.0.0.0/0` on 22, 3389, 3306, 5432, 27017, 6379, 9200, or any admin port**. Only 80/443 may face the world, and ideally not even those
- [ ] Origin is reachable **only from the CDN**: CloudFront → use the `com.amazonaws.global.cloudfront.origin-facing` managed prefix list in the SG, plus a secret header the distribution injects and the origin requires. Cloudflare → SG limited to published Cloudflare ranges + Authenticated Origin Pulls
- [ ] The origin's public IP/DNS does not serve the site when requested directly with a spoofed `Host` header
- [ ] No default VPC security group left permissive; no unused SGs with wide rules
- [ ] DB and cache in **private subnets**, no public IP, no IGW route; `PubliclyAccessible=false` on RDS
- [ ] Bastion replaced by **SSM Session Manager** — port 22 closed entirely
- [ ] ALB: HTTPS listener with a modern TLS policy, HTTP→HTTPS redirect, deletion protection, access logs to S3
- [ ] AWS WAF attached to CloudFront/ALB with: AWS managed core rule set, known-bad-inputs, IP-reputation, plus **your own rate rule for the probe class only** (see `enforcement-layers.md` — do not rate-limit PUBLIC content paths, and confirm no managed rule group is blocking AI crawlers)
- [ ] VPC Flow Logs enabled to CloudWatch or S3

## 3. Compute

- [ ] **IMDSv2 required** (`HttpTokens=required`) on every instance and launch template, with `HttpPutResponseHopLimit=1`. IMDSv1 + any SSRF in the app = instance-role credential theft. This is the single highest-value EC2 setting
- [ ] Instance profile scoped narrowly; no `iam:PassRole` wildcards
- [ ] EBS volumes encrypted; account-level "encrypt new EBS by default" on
- [ ] No secrets in EC2 user-data (it is readable from the metadata service by anything running on the box)
- [ ] Patching via SSM Patch Manager on a schedule; AMIs rebuilt, not patched forever in place
- [ ] No public AMIs or public EBS snapshots owned by the account
- [ ] Auto Scaling / at least an AMI + IaC path to rebuild the box from scratch
- [ ] Container images scanned (ECR scan on push), tags immutable, no `:latest` in production

## 4. Storage

- [ ] **S3 Block Public Access on at the account level**, and on every bucket
- [ ] Any intentionally public bucket (static assets) is served via CloudFront with OAC, bucket itself private
- [ ] Bucket policies reviewed for `"Principal": "*"`; ACLs disabled (`BucketOwnerEnforced`)
- [ ] Default encryption (SSE-S3 or SSE-KMS) on every bucket; TLS-only bucket policy (`aws:SecureTransport: false` → deny)
- [ ] Versioning + lifecycle rules on data buckets; MFA delete or Object Lock on backup buckets
- [ ] Server access logging or CloudTrail data events on buckets holding user data
- [ ] No user uploads served from the same origin as the app without content-type pinning and `nosniff` (stored-XSS path)

## 5. Data stores

- [ ] RDS/DocumentDB/ElastiCache: private subnet, SG restricted to the app SG (not a CIDR), `PubliclyAccessible=false`
- [ ] Encryption at rest; TLS enforced in transit
- [ ] Automated backups with a retention that matches the recovery requirement; **a restore actually tested**, not just configured
- [ ] Deletion protection on production instances/clusters
- [ ] App DB user is least-privilege — not the master user, no DDL rights in normal operation
- [ ] Self-managed MongoDB/Redis on EC2: authentication enabled, bound to the private interface, never `0.0.0.0`
- [ ] Connection pool sized and timed out so a slow third-party call (LLM, payments) cannot starve the pool

## 6. Secrets

- [ ] Secrets in Secrets Manager or SSM Parameter Store `SecureString`, fetched at runtime by role
- [ ] No secrets in git, in AMIs, in user-data, in container images, in CloudFormation/Terraform outputs, or in plaintext Lambda env vars
- [ ] Rotation configured where the provider supports it; rotation *procedure* documented where it does not
- [ ] KMS keys with scoped key policies; separate keys per sensitivity domain
- [ ] Third-party keys (LLM, payments, mail) restricted at the vendor side too: IP allowlist, spend cap, scope

## 7. Logging, detection, and cost abuse

- [ ] **CloudTrail** in all regions, multi-region trail, log file validation on, logs in a dedicated bucket with restricted access
- [ ] **GuardDuty** enabled in every region you use (even unused ones — that is where crypto-mining shows up)
- [ ] AWS Config with a conformance pack; Security Hub if you want the aggregated view
- [ ] CloudWatch alarms that page someone: root login, IAM policy change, SG change to `0.0.0.0/0`, CloudTrail disabled, 5xx rate spike, unhealthy targets
- [ ] **Budget + anomaly alarms.** For an AI app this is a security control, not a finance one: a prompt-abuse or scraping incident shows up as a bill before it shows up anywhere else. Alarm on daily spend and on per-service spend, not only on the monthly total
- [ ] Application logs shipped off the instance (CloudWatch Logs) with retention set — default "never expire" is both a cost and a privacy problem
- [ ] Access logs (ALB/CloudFront/nginx) retain **real client IP, path, status, UA** so the scanner-detection signals in `enforcement-layers.md` are computable
- [ ] Log retention and PII: raw IPs and full UAs are personal data in some jurisdictions — set retention deliberately

## 8. Backup and recovery

- [ ] AWS Backup plan covering EBS, RDS, and any EFS, with cross-region or cross-account copy for the tier that matters
- [ ] Backups in an account or vault the app role **cannot delete** (ransomware/insider containment)
- [ ] A written, timed restore drill; record the actual RTO/RPO achieved, not the target

## 9. DNS and certificates

- [ ] Domain registrar lock + registrar MFA
- [ ] Route53 (or provider) access restricted; DNS changes logged
- [ ] ACM certificates auto-renewing; no manually uploaded certs quietly expiring
- [ ] CAA record restricting who may issue for the domain
- [ ] Every CNAME target still owned by you (subdomain takeover check — see `exposure-checks.md` §5)
- [ ] SPF, DKIM, DMARC set if the domain sends mail; `p=reject` with a DMARC policy record even if you never send

---

## Interaction with crawlability — do not skip

Several hardening steps above will silently break search and AI visibility if applied bluntly:

| Hardening step | Risk to crawling | Safe form |
|---|---|---|
| WAF managed rule sets | some groups block AI crawlers and datacenter ASNs by default | after enabling, re-run the UA matrix; exclude PUBLIC paths from bot rules |
| WAF rate-based rules | trips fast crawlers → sustained 429/503 → crawl rate collapses for weeks | scope the rate rule to the probe class; exempt verified crawlers; prefer `503 + Retry-After` over `403` |
| Geo/ASN blocking | crawlers and AI fetchers come from cloud ASNs worldwide | never on PUBLIC content paths |
| CloudFront geo restriction | same | same |
| Requiring a challenge/CAPTCHA | AI crawlers do not solve them and do not run JS | probe class only |
| Origin lock | if misconfigured, the CDN itself gets blocked | verify with an end-to-end fetch, not just an origin-side test |
| Shield Advanced automatic mitigation | can shape legitimate crawler bursts | review the mitigation logs after enabling |

**Rule: any WAF, CDN, or SG change is also an SEO change.** Run `scripts/crawl-surface-audit.mjs` before and after, and diff the UA matrix.

---

## Fast triage order for a small team

1. IMDSv2 required + SG audit (`0.0.0.0/0` on admin/DB ports) — same afternoon
2. S3 Block Public Access at account level — same afternoon
3. Root MFA, delete root keys, kill long-lived CI keys → OIDC — this week
4. CloudTrail + GuardDuty + budget/anomaly alarms — this week
5. Origin lock behind the CDN — this week
6. Secrets out of `.env` on the box into Secrets Manager/SSM — next
7. Backup plan + one real restore drill — next
8. WAF tuning with a before/after crawl check — ongoing
