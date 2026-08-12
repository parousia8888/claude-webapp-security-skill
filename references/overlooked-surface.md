# Attack surface that phase checklists usually miss

The phases cover the surfaces people think of. These are the ones that show up in real incidents and rarely in plans. Work through them and mark each as *checked* or *accepted*.

## 1. Email, DNS, and domain

- **SPF, DKIM, DMARC.** Without DMARC `p=reject`, anyone can send mail as your domain — phishing your own users with perfect headers. Set the records even if you never send mail.
- **Registrar and DNS account are your real crown jewels.** Whoever controls DNS can obtain certificates for your domain and intercept everything. Registrar lock, MFA, and a separate account from day-to-day tooling.
- **Subdomain takeover.** Every CNAME pointing at a deprovisioned SaaS/bucket/app is a subdomain an attacker can claim and serve content from — with a valid certificate and your cookies if they are scoped to `.example.com`. Enumerate DNS records and confirm each target still exists.
- **CAA record** restricting who may issue certificates.
- **Certificate Transparency** logs (`crt.sh`) list every certificate ever issued for your domain — including for the staging host you forgot. Reviewing your own CT log is free reconnaissance on yourself.
- Expired-domain risk on anything you use for links, images, or OAuth redirects.

## 2. Account recovery and support

The most-attacked path in a consumer product, and rarely tested.

- Password reset tokens: single use, short TTL, invalidated on use *and* on password change; delivered by email, **never placed in a URL that a third-party page could see via `Referer`**.
- Reset must invalidate all existing sessions and refresh tokens.
- Email change flow: confirm at both the old and new address; a hijacked session that can silently change the email owns the account.
- "Sign in with a magic link" has the same threat model as a password reset — treat it as one.
- **Human support is an authentication bypass with a friendly face.** Define what proof support may accept before restoring access, and make sure support cannot change an email or disable MFA on a caller's say-so.
- Deleted accounts: can the email be re-registered and inherit old data?

## 3. Session and browser-boundary issues

- **CSRF** on every cookie-authenticated state change. `SameSite=Lax` blocks the common cases but not everything (top-level POST from a link chain, subdomain attacks); keep tokens for value-moving actions.
- **Clickjacking** — `frame-ancestors` in CSP (or `X-Frame-Options`), especially on any one-click action.
- **Tabnabbing** — `rel="noopener noreferrer"` on every `target="_blank"`.
- **Referrer leakage** — tokens and ids in URLs leak to every third-party resource the page loads. `Referrer-Policy` plus keeping secrets out of URLs entirely.
- **`postMessage` handlers** that do not check `event.origin`.
- **`localStorage` tokens** are readable by any script on the page, including a compromised third-party tag. HttpOnly cookies survive XSS; `localStorage` does not.
- **Cookie scope**: a cookie on `.example.com` is readable by every subdomain, including one taken over per §1. Scope to the exact host unless you need otherwise.
- **Open redirects** — harmless alone, but they are the chaining primitive for OAuth `redirect_uri` abuse and phishing.

## 4. Protocol and infrastructure layer

- **Host header injection** — if the app builds absolute URLs (password reset links!) from the `Host` header, an attacker sets it and your email sends them the victim's token.
- **Web cache poisoning / cache deception**: an unkeyed header influencing a cached response poisons it for everyone; `/account.css`-style path tricks can make a CDN cache a personalized page publicly. Check what your CDN keys on and never cache responses that vary by user without `Vary`/`private`.
- **HTTP request smuggling** where a CDN/proxy and origin disagree on request boundaries. Keep both ends on modern versions and consistent HTTP versions.
- **Origin reachable directly**, bypassing the CDN and every rule on it (see `enforcement-layers.md` §6).
- **Alternate ports** on the origin serving a debug app, a metrics endpoint, or an old deployment.
- **IPv6** — a firewall rule set that only covers IPv4 leaves an open door on the AAAA record.
- **`.well-known` and error pages** disclosing framework versions and internal hostnames.

## 5. File upload and file serving

- Validate type by content, not extension; re-encode images rather than trusting them.
- **Serve user files from a separate origin** (a different domain, not a subdomain) so a malicious file cannot execute in your app's origin.
- `Content-Disposition: attachment` + `X-Content-Type-Options: nosniff` for anything not re-encoded.
- **SVG is executable HTML** — never serve user SVGs inline from your origin.
- HTML, PDF, and Office uploads can carry active content and SSRF payloads (a PDF renderer fetching remote resources is an SSRF).
- Archive extraction: zip-slip path traversal, zip bombs, symlink entries.
- Filename handling: path traversal, null bytes, unicode normalization, case-insensitive collisions.
- Storage: signed URLs with short expiry rather than public buckets; verify the signature is actually required.

## 6. Notifications and outbound content

- **HTML email injection**: user-supplied text rendered into an email template becomes phishing sent from your domain with your DKIM signature.
- Any user-controlled string that reaches another user's screen — display names, share titles, support tickets, admin panel views — is an XSS candidate. **The admin panel is the highest-value target and the least-tested surface.**
- Webhooks you send are an SSRF from your infrastructure into a customer's; webhooks you receive need signature verification and replay protection.
- Notification content should not include secrets ("your code is 123456" in a push notification renders on a lock screen).

## 7. Business-logic abuse that is not a "vulnerability"

Attackers optimize for money, not CVEs:

- Referral and promo fraud: self-referral, multi-account farming, coupon stacking, refund-then-keep.
- Free-tier farming: disposable emails, mass signups for signup bonuses.
- Content scraping to build a competing product — a business risk, not a security one; make the tradeoff consciously rather than by breaking your own SEO.
- Resale of your API/LLM access as a cheaper proxy.
- Chargeback and refund abuse; make the credit ledger reconcilable (Phase 5 §7).

## 8. Multi-client parity

If a mobile app, desktop app, or public API exists, it usually talks to *the same* backend with *different* assumptions:

- Endpoints only the mobile client uses often skipped the web client's hardening review.
- Certificate pinning is not a server-side control — assume every mobile request is attacker-crafted.
- Old app versions must keep working, which is how deprecated, unpatched endpoints stay mounted for years. Track and sunset them deliberately.

## 9. People and operations

- Offboarding: cloud accounts, SSH keys, CI secrets, third-party vendor logins, shared password entries, personal API keys created during employment.
- Developer laptops hold production credentials — disk encryption, screen lock, and a plan for a lost device.
- Shared accounts with a password in a chat message; personal accounts used for production vendors.
- Bus factor: if one person holds the only path to the AWS root account or the domain registrar, that is an availability risk equal to any outage.
- **AI coding assistants and pasted context**: production secrets pasted into any external tool are disclosed secrets. Decide the policy explicitly.
- Backups on personal drives; production data pulled locally for debugging.

## 10. Legal, privacy, and disclosure

- A `/.well-known/security.txt` with a contact — otherwise a finder has no way to reach you and posts publicly instead.
- A stated vulnerability-disclosure policy, even a one-paragraph one, so good-faith reports arrive privately.
- Privacy policy that matches what you actually collect and which vendors receive it.
- Data-subject deletion that reaches caches, search indexes, vector stores, analytics, and backups (Phase 5 §6).
- Log retention that is deliberate: IPs and user agents are personal data in some jurisdictions.
- Breach notification obligations and timelines, known **before** an incident.

## 11. Availability as security

- A single instance with no rebuild path is a security finding: after a compromise you must be able to rebuild from known-good infrastructure-as-code, not repair in place.
- DDoS posture: what absorbs the first hit, and what your CDN does when you exceed a plan limit.
- Third-party dependency outage (LLM provider, payments) must degrade, not cascade — timeouts and circuit breakers, and never holding a database connection while waiting (Phase 5 §4).
- Certificate and domain renewal on autopilot with an alarm — expiry is the most common self-inflicted outage.

## How to use this list

Do not test all of it. Pick the sections matching the product's actual shape (has email? has uploads? has mobile? has money?), mark the rest **accepted with a reason**, and record that decision. A written "we accept X because Y" is a security artifact; an unexamined gap is not.
