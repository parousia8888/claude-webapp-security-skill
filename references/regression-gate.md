# Turning fixes into regression gates (so hardening does not rot)

An audit finds N issues, you fix them, everyone moves on — and six weeks later an unrelated refactor quietly reverts three of them. Nothing errors. The endpoint still returns 200. The only signal is the next audit, if there is one.

**A security fix that is not a regression test is a decaying asset.** This is the difference between "we hardened it once" and "it stays hardened". It is also the single highest-leverage thing you can add on top of a checklist audit, and most audits skip it because it is not glamorous.

The rule: **every fix that can be silently reverted gets one machine-checked assertion, and that assertion is proven by planting the failure.**

## Why "planting the failure" is non-negotiable

A green assertion proves nothing until you have seen it go red for the right reason. Assertions that are silently vacuous are worse than no assertion, because they read as coverage.

Real ways an assertion turns out to be vacuous — all observed in practice:
- The regex never matched the multi-line block it was scanning, so it passed on everything.
- The check read a value the code no longer produces (a renamed field), so it passed on `undefined`.
- The stub returned empty data, so the code path that produces the key never ran, so "is this key labelled" was never actually tested.
- The check scanned a comment that happened to contain the forbidden string, so it failed on correct code — a false alarm that trains people to disable it.

So the workflow for each assertion is:

1. Write the assertion against the fixed code. It passes.
2. **Revert the fix (or plant the exact failure the audit found). The assertion must go red — and red for the reason you expect.**
3. Restore the fix. It goes green.
4. Only now is the assertion trustworthy. Commit both.

If step 2 does not turn it red, the assertion is decoration. Fix the assertion, not the code.

## What deserves a gate, and what does not

Gate the things that (a) are invisible when broken and (b) can be reverted by an edit that looks unrelated:

| Good gate candidate | Why |
|---|---|
| `trust proxy` value / real-IP source | one-token change silently re-opens IP spoofing; nothing errors |
| every social-login endpoint has a rate limit | adding endpoint #4 without the decorator is a normal-looking omission |
| secret self-check covers *all* security secrets | a new signing secret is easy to forget; weak config boots fine |
| salt does not fall back to the signing key | a "tidy up the fallback chain" refactor recouples them |
| `jwt.verify` pins `algorithms` | trivially dropped, invisible with a string secret |
| prompt-injection delimiter still present | a prompt reword deletes the quarantine wrapper |
| outbound-fetch SSRF guard + `redirect:'manual'` | someone "fixes" a missed image by switching back to `follow` |
| DB runtime role is not a superuser | a convenience `GRANT` or a restored dump re-grants it |

Do **not** gate things a type-checker, linter, or existing test already guarantees, and do not gate subjective judgments ("is this name clear"). A gate that fires on style gets muted, and a muted gate protects nothing.

## Shape of the gate

One script, run in the build/CI, that asserts **source-level intent** (scan `src/`, not the built artifact — you are protecting the decision, not the output). Each assertion carries a message that says what breaks in production if it fails, not just "assertion failed".

```js
// check-security-invariants.mjs  — runs in CI, exits non-zero on any breach
import { readFileSync } from 'node:fs';
const read = (p) => readFileSync(p, 'utf8');
const problems = [];
const check = (cond, msg) => { if (!cond) problems.push(msg); };

const main = read('src/main.ts');

// real client IP must not be client-forgeable
check(/trust proxy',\s*1\b/.test(main),
  'trust proxy is not 1 — "true" makes req.ip read the client-forgeable XFF head');

// secret self-check must cover every security secret, not just the JWT ones
for (const k of ['QR_TOKEN_SECRET', 'FINGERPRINT_SALT']) {
  check(new RegExp(`secrets\\s*=\\s*\\[[^\\]]*'${k}'`).test(main),
    `startup secret check dropped ${k} — a weak/absent value boots silently`);
}

// behavioural assertion: load the real function, feed it a forged header, assert it ignores it
const { clientIp } = await import('../dist/common/client-ip.js');
const forged = { get: (h) => ({ 'x-real-ip': '9.9.9.9', 'x-forwarded-for': '1.2.3.4' })[h.toLowerCase()], ip: '10.0.0.1' };
check(clientIp(forged) === '9.9.9.9',
  `clientIp trusted the forged XFF (got ${clientIp(forged)}) — spoofing bypasses rate limits`);

if (problems.length) {
  console.error('✗ security invariants broken:\n' + problems.map((p) => '  · ' + p).join('\n'));
  process.exit(1);
}
console.log('✓ security invariants hold');
```

Two kinds of assertion, both useful:
- **Static** (`regex over source`) — cheap, catches "someone deleted the defense". Watch the vacuous-match traps above; anchor to the assignment/decorator, not to a comment.
- **Behavioural** (`import the real function, feed it the attack input`) — stronger, catches "the defense is present but wrong". Prefer this for anything with logic (IP derivation, signature check, sanitizer). It is the same idea as planting the failure, frozen into CI.

## Wiring it in

- Put the gate in the same command that must pass to ship (the build script, not a separate optional job). A gate that is easy to skip will be skipped on the busy day that needs it most.
- When an audit updates behaviour, an **old gate may now be enforcing the vulnerable behaviour** — e.g. a test that asserted "IP is taken from XFF[0]" is asserting the exact bug you just fixed. Updating that test *is* part of the fix; a gate you cannot change without thought is a gate that ossifies bugs.
- Keep the messages blunt and specific: "spoofing bypasses rate limits", not "invariant 7 failed". The person who trips it at 2am is not the person who wrote it.

## The payoff

This is what a checklist audit cannot give you on its own and what most red-team tooling does not even aim at: the fixes stop being a snapshot and become a ratchet. New code is measured against the hardened baseline at review time, in the dullest, most reliable way — a script that exits 1.
