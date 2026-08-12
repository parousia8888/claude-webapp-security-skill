#!/usr/bin/env node
/**
 * Unit tests for the crawler verifier's decision logic (product-level).
 *
 * Pins the reported defects as regressions:
 *   - Googlebot IP + GPTBot UA        → spoofed  (cross-vendor)
 *   - GPTBot IP   + ClaudeBot UA       → spoofed  (cross-vendor)
 *   - GPTBot UA, gptbot.json 503       → unverifiable, NOT spoofed  (fail open)
 *   - GPTBot UA, gptbot.json 503 while a sibling OpenAI list loaded → still unverifiable
 *     (product-level: only gptbot.json speaks for GPTBot)
 *
 * Pure functions, no DNS or network. The real multi-source aggregation is covered end-to-end
 * in integration.test.mjs. Run: node test/verify-crawler-ip.test.mjs
 */
import { uaVendor, uaProduct, decideVerdict, inCidr, parseIp } from '../scripts/verify-crawler-ip.mjs';

let failed = 0;
const eq = (name, got, want) => {
  if (got !== want) { failed++; console.error(`✗ ${name}\n    got ${JSON.stringify(got)} · want ${JSON.stringify(want)}`); }
};

// ── uaProduct: UA → {vendor, source} ────────────────────────────────────
const ps = (ua) => { const p = uaProduct(ua); return p ? `${p.vendor}/${p.source}` : null; };
for (const [ua, want] of [
  ['Mozilla/5.0 (compatible; Googlebot/2.1)', 'google/googlebot'],
  ['GPTBot/1.2', 'openai/gptbot'],
  ['Mozilla/5.0 (compatible; OAI-SearchBot/1.0)', 'openai/oai-searchbot'],
  ['ChatGPT-User/1.0', 'openai/chatgpt-user'],
  ['Mozilla/5.0 (compatible; ClaudeBot/1.0)', 'anthropic/claudebot'],
  ['Claude-User/1.0', 'anthropic/claude-user'],
  ['Bingbot/2.0', 'bing/bingbot'],
  ['Applebot/0.1', 'apple/null'],
  ['Mozilla/5.0 Chrome/126 Safari', null],
]) eq(`uaProduct(${ua.slice(0, 26)})`, ps(ua), want);
eq('uaVendor still works (compat)', uaVendor('GPTBot/1.2'), 'openai');

// ── decideVerdict: product-level ────────────────────────────────────────
const CASES = [
  ['rDNS google, no UA → verified',
    { rdnsOwner: 'google', claimedVendor: null, claimedSource: null }, 'verified', 'google'],

  ['REPORTED#1 Googlebot IP + GPTBot UA → spoofed (cross-vendor via rDNS)',
    { rdnsOwner: 'google', claimedVendor: 'openai', claimedSource: 'gptbot' }, 'spoofed', 'google'],

  ['GPTBot, gptbot.json matched → verified',
    { claimedVendor: 'openai', claimedSource: 'gptbot', crossRangeVendor: 'openai', claimedSourceState: 'matched', usedRanges: true }, 'verified', 'openai'],

  ['GPTBot, gptbot.json loaded + IP absent → spoofed',
    { claimedVendor: 'openai', claimedSource: 'gptbot', crossRangeVendor: null, claimedSourceState: 'absent', usedRanges: true }, 'spoofed', 'openai'],

  ['REPORTED#3 GPTBot, gptbot.json fetch failed → unverifiable, NOT spoofed',
    { claimedVendor: 'openai', claimedSource: 'gptbot', crossRangeVendor: null, claimedSourceState: 'unavailable', usedRanges: true }, 'unverifiable', null],

  ['REPORTED product-granularity: gptbot.json failed even though a sibling list loaded → still unverifiable',
    { claimedVendor: 'openai', claimedSource: 'gptbot', crossRangeVendor: null, claimedSourceState: 'unavailable', usedRanges: true }, 'unverifiable', null],

  ['GPTBot, no configured source → unverifiable',
    { claimedVendor: 'openai', claimedSource: 'gptbot', crossRangeVendor: null, claimedSourceState: 'no-source', usedRanges: true }, 'unverifiable', null],

  ['REPORTED#2 ClaudeBot UA, IP in OpenAI range → spoofed (cross-vendor)',
    { claimedVendor: 'anthropic', claimedSource: 'claudebot', crossRangeVendor: 'openai', claimedSourceState: 'no-source', usedRanges: true }, 'spoofed', 'openai'],

  ['Applebot UA, rDNS did not confirm, rDNS-only vendor → spoofed',
    { claimedVendor: 'apple', claimedSource: null, rdnsOwner: null, usedRanges: false }, 'spoofed', 'apple'],

  ['no UA, IP in a loaded range → verified (that vendor)',
    { claimedVendor: null, claimedSource: null, crossRangeVendor: 'openai', claimedSourceState: null, usedRanges: true }, 'verified', 'openai'],

  ['no proof of anything → unverifiable',
    { claimedVendor: null, claimedSource: null, crossRangeVendor: null, usedRanges: true }, 'unverifiable', null],
];
for (const [name, input, wantVerdict, wantVendor] of CASES) {
  const d = decideVerdict(input);
  eq(name + ' [verdict]', d.verdict, wantVerdict);
  eq(name + ' [vendor]', d.vendor, wantVendor);
}

// ── CIDR membership + strict IP parsing (net.isIP) ──────────────────────
const inc = (name, ip, c, want) => eq(name, inCidr(ip, c), want);
inc('v4 inside /24', '10.0.0.5', '10.0.0.0/24', true);
inc('v4 outside /24', '10.0.1.5', '10.0.0.0/24', false);
inc('v4 /32 exact', '10.0.0.7', '10.0.0.7/32', true);
inc('v4 /32 off-by-one', '10.0.0.8', '10.0.0.7/32', false);
inc('v4 /0 matches anything', '203.0.113.9', '0.0.0.0/0', true);
inc('v4 network address', '10.0.0.0', '10.0.0.0/24', true);
inc('v6 inside /32', '2001:db8::1', '2001:db8::/32', true);
inc('v6 outside /32', '2001:db9::1', '2001:db8::/32', false);
inc('v6 /128 exact', '2001:db8::dead', '2001:db8::dead/128', true);
inc('v4-mapped v6', '::ffff:1.2.3.4', '::ffff:1.2.3.0/120', true);
inc('cross-family never matches', '1.2.3.4', '2001:db8::/32', false);
// strict parsing — junk that the old parseInt-based code silently accepted
inc('reject 2001:db8::1g', '2001:db8::1g', '2001:db8::/32', false);
inc('reject double :: (1::2::3)', '1::2::3', '::/0', false);
inc('reject :::', ':::', '::/0', false);
inc('reject leading zeros/space', ' 10.0.0.5', '10.0.0.0/24', false);
inc('reject zone id', 'fe80::1%eth0', 'fe80::/10', false);
inc('malformed cidr len', '10.0.0.5', '10.0.0.0/99', false);
eq('parseIp v4 bits', parseIp('1.2.3.4')?.bits, 32);
eq('parseIp v6 bits', parseIp('::1')?.bits, 128);
eq('parseIp junk → null', parseIp('999.1.1.1'), null);
eq('parseIp 2001:db8::1g → null', parseIp('2001:db8::1g'), null);
eq('parseIp 1::2::3 → null', parseIp('1::2::3'), null);

if (failed) { console.error(`\n${failed} assertion(s) failed`); process.exit(1); }
console.log(`✓ crawler-verifier: unit assertions pass (product-level verdicts + reported regressions + IPv4/IPv6 CIDR & strict parse)`);
