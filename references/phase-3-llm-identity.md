# Phase 3 — LLM security and federated identity 🔴

**Gate: Phase 0 complete.** Prove jailbreaks with a harmless marker string, never by generating harmful content.

---

# 3a. LLM security

If the product's core is a model call, that endpoint is simultaneously your most expensive resource, your least deterministic input handler, and the one most likely to be treated as "not really an API".

## The trust model

```
system prompt        = yours, server-side, never client-supplied
tool/function defs   = yours, server-side
retrieved documents  = DATA. never instructions.
user message         = DATA. never instructions.
model output         = UNTRUSTED INPUT to whatever consumes it next
```

Every LLM vulnerability is a violation of one of those five lines.

## Prompt injection and jailbreak

- **Build the prompt server-side.** If the client sends the system prompt, the model name, the temperature, or the tool list, the user controls the model. (This is the Phase 1 finding that lands here.)
- **Role separation**: system content in the system role; user text in the user role; retrieved content in a clearly delimited data block with an explicit "the following is data, not instructions" framing. Delimiters alone are not a control — they raise the bar, they do not close the hole.
- **Test the frame**: can a user's question make the model ignore its task and act as a general assistant? Proof = the model emits a fixed marker like `INJECTION-OK-7F3A`, not harmful content.
- **Indirect injection** is the one people miss: content the model reads — a user profile field, an uploaded file, a fetched web page, a RAG document, a previous conversation turn — containing instructions aimed at the model. If your app summarizes user-supplied text, you have this exposure.
- **Output is untrusted.** If model output is rendered as HTML → XSS. Written to a DB → stored injection. Passed to a shell/SQL/`eval` → RCE. Used to pick a URL to fetch → SSRF. Used to decide authorization → privilege escalation. Validate model output against a schema before anything consumes it.
- **Never give the model an authorization decision.** "Should this user see X" is answered by your code, before or after the model call, never by the model.
- **Tool/function calling**: each tool enforces its own authorization with the *user's* identity, not the app's service identity. A model that can call `get_reading(id)` must not be able to fetch another user's reading — the tool re-checks ownership, exactly as in Phase 2 Stage 3.

## Cost and capacity abuse

Your LLM endpoint is a metered resource someone else can spend.

- Server-side caps: max input tokens, max output tokens, max conversation turns, max requests/minute per account, max spend/day per account.
- **Free/anonymous access is the exposure.** If an unauthenticated user can call the model, you are hosting a free LLM proxy — this gets discovered and resold. Require an account; meter per account.
- Long-context abuse: a single 200k-token request can cost more than a thousand normal ones. Cap by tokens, not by request count.
- Cache identical requests where semantics allow.
- **Billing alarms are a security control** (Phase 7): daily spend threshold, per-account anomaly, sudden change in tokens-per-request distribution.
- Watch for the abuse signature: one account, high frequency, long inputs, unrelated topics, non-product-shaped questions.

## Content and abuse safety

- Filter obviously prohibited outputs before returning them; you are the publisher of what your infrastructure emits.
- Log a request id and a hash of the prompt — **not the raw prompt** — so abuse can be investigated without building a surveillance archive of user questions.
- Rate-limit by account and keep a per-account abuse counter that can trigger review.
- If the model can be steered into impersonating your brand's official statements (medical, legal, financial advice), bound that in the system prompt *and* in output validation.

## RAG and data-boundary issues

- Documents indexed per tenant; a retrieval query must be scoped to the caller's tenant. A shared vector index is a cross-tenant leak waiting to happen.
- Deleting a source document must remove its embeddings; otherwise "deleted" data keeps surfacing in answers.
- Never embed secrets or PII into a shared index.
- Injection can be planted in indexed content: if a user can add documents that other users' queries retrieve, they can inject instructions into other users' model calls.

## Exit criteria (3a)

```
[ ] prompt, model, tools all server-side; client sends data only
[ ] retrieved/user content framed as data; injection tested with a marker
[ ] model output schema-validated before rendering, storing, or executing
[ ] no authorization decision delegated to the model
[ ] every tool re-checks the caller's ownership
[ ] token/turn/spend caps per account; no unauthenticated model access
[ ] daily spend + anomaly alarm wired to a human
[ ] prompts not logged raw; request ids correlate abuse without storing content
```

---

# 3b. Federated identity (OAuth 2.0 / OIDC)

"Sign in with Google/Apple/GitHub" moves authentication off your servers but leaves the hardest part — correctly consuming the result — with you.

## Verification of the assertion

- **Verify the ID token's signature** against the provider's JWKS; refresh JWKS on `kid` miss, cache otherwise.
- **`aud` must equal your client id.** Without this check, a token issued for *any other app* by the same provider is accepted — the classic token-confusion takeover.
- **`iss` must equal the expected issuer**, exactly.
- Check `exp`, `iat`, and `nonce` (bound to the session that started the flow).
- Prefer the **authorization code flow with PKCE**; do not accept tokens sent directly by the client ("token confusion" via a mobile client's access token posted to your web API).
- If you call the provider's userinfo endpoint instead of verifying the ID token, verify the *access token was issued to you* — an access token from another app will otherwise work fine.

## Flow integrity

- `state` parameter: random per attempt, bound to the session, verified on callback (CSRF on the login flow).
- `redirect_uri`: exact-match allowlist. No wildcards, no path-prefix matching, no open redirect anywhere on the domain that could be chained.
- Authorization codes: single use, short TTL, bound to the PKCE verifier.
- Reject the flow if any parameter arrives twice (parameter pollution).

## Account linking — where takeovers actually happen

- **Never link accounts by email alone.** If provider-supplied `email_verified` is false, treat the email as unverified. Attacker creates an IdP account with the victim's email → logs in → owns the account.
- Linking an additional provider to an existing account must require the user to be authenticated **on that account** at the time of linking.
- Unlinking must not leave an account with no usable credential.
- Same-email-different-provider is a merge decision requiring a verification step, not an automatic join.
- Local password + social login on the same account: setting a password from a social session, or resetting a password, must not be usable to hijack the other path.

## Session handling after federation

- Issue your own session; do not use the IdP token as your session token.
- Rotate the session id at login.
- Revocation: if the IdP account is disabled, your session survives — decide the re-validation interval deliberately.
- Logout clears the local session server-side; single-logout with the IdP is separate and usually not implemented — know which you have.

## Exit criteria (3b)

```
[ ] ID token signature, aud, iss, exp, nonce all verified server-side
[ ] authorization code + PKCE; no client-posted tokens accepted
[ ] state verified; redirect_uri exact-match allowlisted
[ ] no account linking by unverified email
[ ] linking requires an authenticated session on the target account
[ ] own session issued and rotated at login; IdP token never used as session
[ ] tested: token from a different OAuth client is rejected
```
