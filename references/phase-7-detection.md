# Phase 7 — Blue team: detection, monitoring, response (continuous)

Every prior phase reduces what can go wrong. This phase is how you find out when something does anyway — including the things the audit missed.

## 1. Prerequisite: logs you can actually query

Nothing below works without these.

- **Real client IP.** Behind a CDN or load balancer, the origin sees the proxy unless configured. Every rate limit and every detection rule is wrong until this is fixed.
  - Cloudflare: `real_ip_header CF-Connecting-IP;` + `set_real_ip_from <each published Cloudflare range>`
  - CloudFront/ALB: `real_ip_header X-Forwarded-For;` + `set_real_ip_from <trusted proxy CIDRs only>`
  - **Never trust `X-Forwarded-For` from an untrusted source** — it is client-controlled, and trusting it lets an attacker forge any IP and evade every per-IP control.
- Access log fields: timestamp, real IP, method, path, status, bytes, referrer, user agent, response time, request id.
- Application log fields: request id (correlating to the access log), user id, event name, outcome. Never raw prompts, passwords, tokens, or full PII.
- Centralized: logs off the instance (CloudWatch Logs or equivalent) with retention set deliberately — "never expire" is a cost and privacy problem, 3 days is too short to investigate.
- Time synced; timestamps in UTC.

## 2. Detection rules that pay for themselves

Written as logic, not tied to one SIEM. Implement wherever you query logs.

| # | Signal | Condition | Why |
|---|---|---|---|
| 1 | Scanner sweep | ≥10 `404` from one IP in 60s, or ≥80% 404 over ≥20 requests | near-zero false positives; real crawlers barely 404 |
| 2 | Sensitive path probe | any request to `.env`, `.git/`, `wp-login.php`, `/actuator`, `/phpmyadmin` | nobody legitimate asks |
| 3 | Spoofed crawler | UA claims Googlebot/Bingbot/GPTBot and FCrDNS or published-range check fails | the most common disguise (`bot-verification.md`) |
| 4 | Credential stuffing | ≥N failed logins across ≥M distinct accounts from one IP/ASN in 10 min | distributed login abuse |
| 5 | Account brute force | ≥N failed logins on one account from any source in 10 min | targeted |
| 6 | Code/gift enumeration | ≥N failed redeem attempts per account or per IP in 10 min | monetary |
| 7 | Verification-code bombing | ≥N `send-code` per recipient or per IP in 10 min | vendor cost + user harm |
| 8 | Reward/claim race | two claims for the same reward id within 2s | race exploitation |
| 9 | LLM cost abuse | per-account tokens or requests exceed p99 by 5×, or input length distribution shifts | your bill is the alarm |
| 10 | Anonymous LLM access | model endpoint hit without an account | free-proxy resale |
| 11 | Privilege anomaly | non-admin identity hits an admin route; admin route hit from a new IP/ASN | BFLA attempt or compromised admin |
| 12 | Mass data access | one account reads >N distinct object ids in 10 min | BOLA exploitation or scraping |
| 13 | New 5xx cluster | 5xx rate on one route rises >3× baseline | exploitation often looks like errors first |
| 14 | Egress anomaly | outbound requests to new destinations from the app host | SSRF success, or post-compromise C2 |
| 15 | Infrastructure change | security-group opened to `0.0.0.0/0`, IAM policy change, CloudTrail disabled, root login | account-level compromise |

Tune 1, 4, 6 and 9 to your own baseline before alerting — a rule that pages nightly gets muted, and a muted rule is no rule.

## 3. Where to enforce vs where to alert

- **Enforce at the edge** (CDN/WAF): volumetric limits, rules 1 and 2, managed rule sets, geo policy for the probe class only.
- **Enforce in the app**: per-account quotas, lockouts, idempotency.
- **Alert only** (do not auto-block): rules 11–15. Auto-blocking on these produces outages and hides the incident.
- **Never** apply challenges, geo blocks, or bot-fight settings to public content paths — see `enforcement-layers.md` §5. Confirm after every WAF change that the crawler UA matrix is still clean.

## 4. Alarms that must reach a human

- Daily and per-service **spend threshold + anomaly** (for an AI product this is the earliest reliable abuse signal).
- 5xx rate, latency p99, unhealthy targets.
- Root account login, IAM policy change, CloudTrail/GuardDuty disabled, SG opened to the world.
- Certificate expiry, backup failure, disk/DB capacity.
- Sustained `429`/`503` served to verified crawlers — that is an SEO incident with a security cause.

Route them somewhere a person reads. An alarm in a channel nobody watches is documentation, not detection.

## 5. Baseline hygiene

- Weekly: review the top talkers, top 404 sources, top blocked rules, and the spoofed-crawler count.
- Monthly: re-run `crawl-surface-audit.mjs` and the AWS posture script; diff against last month.
- Quarterly: access review (who can deploy, who holds keys, who can read the database), and a restore drill.

## 6. Incident response, minimum viable

Write this down before you need it — a one-page runbook beats a plan you improvise at 3am.

1. **Contacts and roles**: who decides, who communicates, who executes.
2. **Contain**: revoke the credential, block the source, disable the feature, scale down the abused endpoint. Prefer containment over investigation while the bleeding continues.
3. **Preserve**: snapshot the instance and export logs *before* rebuilding. Rebuilding first destroys the evidence.
4. **Rotate**: every secret the compromised component could read — including third-party keys and any secret in the instance's environment.
5. **Assess data impact**: what was reachable ≠ what was taken; state both, and be honest about which you can and cannot determine from your logs.
6. **Notify**: know your obligations and timelines before the incident, not during.
7. **Post-incident**: what detection would have caught it earlier — that becomes a new rule in §2.

**Special case, from Phase 0**: if evidence of a *pre-existing* compromise appears during an audit, stop testing and switch to incident response. Continuing to test contaminates the evidence and can be mistaken for the intrusion.

## Exit criteria

```
[ ] real client IP recovered correctly; X-Forwarded-For trusted only from known proxies
[ ] access + app logs centralized, correlated by request id, retention set
[ ] rules 1, 2, 3, and the money/cost rules relevant to the product implemented
[ ] spend anomaly + infrastructure-change alarms routed to a human
[ ] verified-crawler 429/503 monitored as an SEO-impacting condition
[ ] one-page incident runbook written, with contacts and rotation list
[ ] monthly re-audit scheduled
```
