#!/usr/bin/env node
/**
 * Unit tests for the crawler verifier's decision logic.
 *
 * These pin the fix for the reported defect:
 *   Googlebot IP + GPTBot UA  → was 'verified', must be 'spoofed'
 *   GPTBot IP   + ClaudeBot UA → was 'verified', must be 'spoofed'
 * The root cause was that a proven owner was never compared against the UA's claim
 * when the claimed vendor wasn't one of the five rDNS vendors. decideVerdict now
 * compares in a single canonical vendor namespace, so a claim that DISAGREES with
 * proven ownership is a spoof — that is the invariant these tests defend.
 *
 * Pure functions, no DNS or network. Run: node test/verify-crawler-ip.test.mjs
 */
import { uaVendor, decideVerdict, inCidr, parseIp } from '../scripts/verify-crawler-ip.mjs';

let failed = 0;
const eq = (name, got, want) => {
  const ok = got === want;
  if (!ok) { failed++; console.error(`✗ ${name}\n    got ${JSON.stringify(got)} · want ${JSON.stringify(want)}`); }
};

// ── uaVendor: UA string → canonical vendor ──────────────────────────────
for (const [ua, want] of [
  ['Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)', 'google'],
  ['GPTBot/1.2', 'openai'],
  ['Mozilla/5.0 (compatible; OAI-SearchBot/1.0; +https://openai.com/searchbot)', 'openai'],
  ['ChatGPT-User/1.0', 'openai'],
  ['Mozilla/5.0 (compatible; ClaudeBot/1.0; +claudebot@anthropic.com)', 'anthropic'],
  ['Claude-User/1.0', 'anthropic'],
  ['Mozilla/5.0 (compatible; PerplexityBot/1.0)', 'perplexity'],
  ['Bingbot/2.0', 'bing'],
  ['Applebot/0.1', 'apple'],
  ['Bytespider', 'bytedance'],
  ['CCBot/2.0', 'commoncrawl'],
  ['Mozilla/5.0 (Macintosh) AppleWebKit Chrome/126 Safari', null], // a normal browser claims nothing
  ['', null],
]) eq(`uaVendor(${ua.slice(0, 28)})`, uaVendor(ua), want);

// ── decideVerdict: the claim must AGREE with proven ownership ────────────
const CASES = [
  // name, input, expected verdict, expected vendor
  ['Googlebot IP + Googlebot UA → verified',
    { claimedVendor: 'google', rdnsOwner: 'google' }, 'verified', 'google'],

  ['REPORTED#1 Googlebot IP + GPTBot UA → spoofed',
    { claimedVendor: 'openai', rdnsOwner: 'google' }, 'spoofed', 'google'],

  ['Googlebot IP + no UA → verified (IP proven, no claim to contradict)',
    { claimedVendor: null, rdnsOwner: 'google' }, 'verified', 'google'],

  ['GPTBot IP + GPTBot UA (range) → verified',
    { claimedVendor: 'openai', rdnsOwner: null, rangeVendor: 'openai', usedRanges: true }, 'verified', 'openai'],

  ['REPORTED#2 GPTBot IP + ClaudeBot UA (range) → spoofed',
    { claimedVendor: 'anthropic', rdnsOwner: null, rangeVendor: 'openai', usedRanges: true }, 'spoofed', 'openai'],

  ['GPTBot IP + no UA (range) → verified',
    { claimedVendor: null, rdnsOwner: null, rangeVendor: 'openai', usedRanges: true }, 'verified', 'openai'],

  ['Applebot UA + rDNS did not confirm → spoofed (rDNS vendor, no range to rescue)',
    { claimedVendor: 'apple', rdnsOwner: null, usedRanges: false }, 'spoofed', 'apple'],

  ['Google UA + rDNS fail, google range LOADED, IP not in it → spoofed',
    { claimedVendor: 'google', rdnsOwner: null, rangeVendor: null, usedRanges: true, claimedVendorSourceLoaded: true }, 'spoofed', 'google'],

  // REPORTED: a source that FAILED to fetch must not convict a real crawler.
  ['REPORTED#3 claimed vendor range failed to load → unverifiable, NOT spoofed',
    { claimedVendor: 'openai', rdnsOwner: null, rangeVendor: null, usedRanges: true, claimedVendorSourceLoaded: false }, 'unverifiable', null],

  ['ClaudeBot UA + ranges checked but no anthropic source at all → unverifiable (do not guess)',
    { claimedVendor: 'anthropic', rdnsOwner: null, rangeVendor: null, usedRanges: true, claimedVendorSourceLoaded: null }, 'unverifiable', null],

  ['No UA + IP in openai range → verified (ownership proven, nothing claimed)',
    { claimedVendor: null, rdnsOwner: null, rangeVendor: 'openai', usedRanges: true }, 'verified', 'openai'],

  ['No UA + nothing proven → unverifiable',
    { claimedVendor: null, rdnsOwner: null, rangeVendor: null, usedRanges: true }, 'unverifiable', null],
];

for (const [name, input, wantVerdict, wantVendor] of CASES) {
  const d = decideVerdict(input);
  eq(name + ' [verdict]', d.verdict, wantVerdict);
  eq(name + ' [vendor]', d.vendor, wantVendor);
}

// ── CIDR membership: IPv4 / IPv6 boundaries (0 test coverage before) ────
let cidr = 0;
const inc = (name, ip, c, want) => { cidr++; eq(name, inCidr(ip, c), want); };
inc('v4 inside /24', '10.0.0.5', '10.0.0.0/24', true);
inc('v4 outside /24', '10.0.1.5', '10.0.0.0/24', false);
inc('v4 /32 exact match', '10.0.0.7', '10.0.0.7/32', true);
inc('v4 /32 off by one', '10.0.0.8', '10.0.0.7/32', false);
inc('v4 /0 matches anything', '203.0.113.9', '0.0.0.0/0', true);
inc('v4 network boundary low', '10.0.0.0', '10.0.0.0/24', true);
inc('v4 broadcast still in /24', '10.0.0.255', '10.0.0.0/24', true);
inc('v6 inside /32', '2001:db8::1', '2001:db8::/32', true);
inc('v6 outside /32', '2001:db9::1', '2001:db8::/32', false);
inc('v6 /128 exact', '2001:db8::dead', '2001:db8::dead/128', true);
inc('v4-mapped v6 parses', '::ffff:1.2.3.4', '::ffff:1.2.3.0/120', true);
inc('cross-family never matches (v4 vs v6 cidr)', '1.2.3.4', '2001:db8::/32', false);
inc('malformed ip → false', 'not.an.ip', '10.0.0.0/24', false);
inc('malformed cidr → false', '10.0.0.5', '10.0.0.0/99', false);
eq('parseIp v4 bits', parseIp('1.2.3.4')?.bits, 32);
eq('parseIp v6 bits', parseIp('::1')?.bits, 128);
eq('parseIp junk → null', parseIp('999.1.1.1'), null);
cidr += 3;

if (failed) { console.error(`\n${failed} assertion(s) failed`); process.exit(1); }
console.log(`✓ crawler-verifier: ${13 + CASES.length * 2 + cidr} assertions pass (incl. reported spoof + source-failure regressions, IPv4/IPv6 CIDR)`);
