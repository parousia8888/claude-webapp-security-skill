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
import { uaVendor, decideVerdict } from '../scripts/verify-crawler-ip.mjs';

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

  ['Google UA + rDNS fail + ranges checked, IP not in google range → spoofed',
    { claimedVendor: 'google', rdnsOwner: null, rangeVendor: null, usedRanges: true }, 'spoofed', 'google'],

  ['ClaudeBot UA + ranges checked but no anthropic source → unverifiable (do not guess)',
    { claimedVendor: 'anthropic', rdnsOwner: null, rangeVendor: null, usedRanges: true }, 'unverifiable', null],

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

if (failed) { console.error(`\n${failed} assertion(s) failed`); process.exit(1); }
console.log(`✓ crawler-verifier: ${13 + CASES.length * 2} assertions pass (incl. both reported spoof cases)`);
