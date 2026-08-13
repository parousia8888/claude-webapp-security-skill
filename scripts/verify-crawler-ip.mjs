#!/usr/bin/env node
/**
 * verify-crawler-ip.mjs — is this really Googlebot / GPTBot / ClaudeBot, or a spoofed UA?
 *
 * Two methods (see ../references/bot-verification.md):
 *   1. forward-confirmed reverse DNS  — Google, Bing, Apple, Yandex, Baidu
 *   2. vendor-published IP ranges     — OpenAI and others (requires --ranges)
 *
 * Usage:
 *   node verify-crawler-ip.mjs --ip 66.249.66.1 --ua "Googlebot/2.1"
 *   node verify-crawler-ip.mjs --file ips.txt --ranges --out ./reports
 *   node verify-crawler-ip.mjs --ip 1.2.3.4 --ranges --source vendor=https://vendor.example/ips.json
 *   node verify-crawler-ip.mjs --ip 1.2.3.4 --ranges --max-range-age-days 30
 *
 * --file format: one entry per line, `ip` or `ip<TAB or whitespace>user agent`.
 *
 * Exit code 1 if any entry is verdict=spoofed; 3 if evidence is unavailable.
 */

import { promises as dns } from 'node:dns';
import { isIP } from 'node:net';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  createFindingV2, createReportV2, exitCodeV2, initializeFindingsV2, policyForFailOn,
  renderMarkdownV2, writeReportBundleV2,
} from './lib/evidence-v2.mjs';
import {
  CRAWLER_IDENTITY_ADAPTER, crawlerIdentityCoverage, crawlerIdentityRule,
  crawlerIdentityRuleset,
} from './lib/crawler-identity-rules.mjs';
import { digestValue } from './lib/project-identity.mjs';

const argv = process.argv.slice(2);
const arg = (n, d = null) => { const i = argv.indexOf(`--${n}`); return i === -1 ? d : argv[i + 1]; };
const flag = (n) => argv.includes(`--${n}`);
const all = (n) => argv.reduce((acc, v, i) => (v === `--${n}` ? [...acc, argv[i + 1]] : acc), []);

const USE_RANGES = flag('ranges');
const OUT_DIR = arg('out');
const REPORT_NAME = arg('report-name');
const QUIET = flag('quiet');
const FAIL_ON = arg('fail-on', 'high');
const FAIL_ON_DOMAINS = all('fail-on-domain');
const MAX_RANGE_AGE_DAYS = Number(arg('max-range-age-days', 30));
const log = (...m) => { if (!QUIET) console.error('·', ...m); };

if (!Number.isInteger(MAX_RANGE_AGE_DAYS) || MAX_RANGE_AGE_DAYS < 1 || MAX_RANGE_AGE_DAYS > 3650) {
  console.error('error: --max-range-age-days must be an integer from 1 to 3650');
  process.exit(2);
}
if (!['critical', 'high', 'medium', 'low', 'never'].includes(FAIL_ON)) {
  console.error('error: --fail-on must be critical, high, medium, low, or never');
  process.exit(2);
}
let EFFECTIVE_POLICY;
try {
  EFFECTIVE_POLICY = policyForFailOn(FAIL_ON, FAIL_ON_DOMAINS);
} catch (error) {
  console.error(`error: ${error.message}`);
  process.exit(2);
}
if (REPORT_NAME && !/^[a-zA-Z0-9._-]+$/.test(REPORT_NAME)) {
  console.error('error: --report-name contains unsupported characters');
  process.exit(2);
}

// --------------------------------------------------------------- vendor data

// rDNS suffixes that are considered proof of ownership after forward confirmation.
const RDNS_VENDORS = [
  { vendor: 'google', suffixes: ['googlebot.com', 'google.com', 'googleusercontent.com'],
    ua: /googlebot|google-inspectiontool|googleother|google-extended|feedfetcher-google|apis-google|googleimageproxy/i },
  { vendor: 'bing', suffixes: ['search.msn.com'], ua: /bingbot|msnbot|bingpreview|adidxbot/i },
  { vendor: 'apple', suffixes: ['applebot.apple.com'], ua: /applebot/i },
  { vendor: 'yandex', suffixes: ['yandex.ru', 'yandex.net', 'yandex.com'], ua: /yandex/i },
  { vendor: 'baidu', suffixes: ['baidu.com', 'baidu.jp'], ua: /baidu/i },
];

// Published prefix lists. Same JSON shape across vendors: { prefixes: [{ipv4Prefix|ipv6Prefix}] }
// Verify these URLs against the vendor's current docs before relying on them; add more with --source.
const RANGE_SOURCES = {
  googlebot: 'https://developers.google.com/static/search/apis/ipranges/googlebot.json',
  'google-special': 'https://developers.google.com/static/search/apis/ipranges/special-crawlers.json',
  'google-user-triggered': 'https://developers.google.com/static/search/apis/ipranges/user-triggered-fetchers.json',
  bingbot: 'https://www.bing.com/toolbox/bingbot.json',
  gptbot: 'https://openai.com/gptbot.json',
  'oai-searchbot': 'https://openai.com/searchbot.json',
  'chatgpt-user': 'https://openai.com/chatgpt-user.json',
};
for (const s of all('source')) {
  const i = s.indexOf('=');
  if (i > 0) RANGE_SOURCES[s.slice(0, i)] = s.slice(i + 1);
}

// UA tokens whose vendors publish ranges but give no usable rDNS.
const RANGE_ONLY_UA = /gptbot|oai-searchbot|chatgpt-user|claudebot|claude-searchbot|claude-user|anthropic|perplexity|duckassist|amazonbot|meta-externalagent|ccbot|bytespider/i;
const KNOWN_BOT_UA = /bot|crawler|spider|gptbot|claude|perplexity|duckassist|bytespider|ccbot|externalagent/i;

// ── UA → canonical vendor ────────────────────────────────────────────────
// The whole point of the verifier is to answer: does this IP belong to the vendor
// the UA CLAIMS to be? So the UA claim must be resolved to the SAME vendor namespace
// that rDNS ownership and range membership resolve to, and then compared strictly.
//
// The bug this fixes: the old code only recognised a UA claim if it matched one of
// the five rDNS vendors. A UA of "GPTBot" produced claimed=undefined, and the verdict
// line `!claimed || claimed.vendor === owner.vendor ? 'verified' : ...` then treated
// "claims a DIFFERENT vendor" as "claims nothing" — so Googlebot-IP + GPTBot-UA verified,
// and (range path) GPTBot-IP + ClaudeBot-UA verified. Both are spoofs.
// UA → { vendor, source }. `source` is the SPECIFIC published-range list this product's IPs
// live in (a key of RANGE_SOURCES), or null for vendors verified by rDNS instead of a range.
// Product-level, not vendor-level: GPTBot's IPs are in gptbot.json, NOT searchbot.json, so
// only gptbot.json can confirm-or-deny a GPTBot claim. A sibling product's list loading (or
// failing) is not evidence about this product — that was the v0.2.1 defect.
// Order matters: put more-specific patterns first (oai-searchbot before a bare gpt match, etc.).
const UA_PRODUCT = [
  { vendor: 'google', source: 'googlebot', re: /googlebot|google-inspectiontool|googleother|google-extended|feedfetcher-google|apis-google|googleimageproxy|storebot-google/i },
  { vendor: 'bing', source: 'bingbot', re: /bingbot|msnbot|bingpreview|adidxbot/i },
  { vendor: 'apple', source: null, re: /applebot/i },
  { vendor: 'yandex', source: null, re: /yandex(bot|images|video|media|blogs|favicons|webmaster|accessibilitybot)?/i },
  { vendor: 'baidu', source: null, re: /baiduspider/i },
  { vendor: 'openai', source: 'oai-searchbot', re: /oai-searchbot/i },
  { vendor: 'openai', source: 'chatgpt-user', re: /chatgpt-user/i },
  { vendor: 'openai', source: 'gptbot', re: /gptbot/i },
  { vendor: 'anthropic', source: 'claude-user', re: /claude-user/i },
  { vendor: 'anthropic', source: 'claudebot', re: /claudebot|claude-searchbot|anthropic/i },
  { vendor: 'perplexity', source: 'perplexitybot', re: /perplexitybot|perplexity-user/i },
  { vendor: 'duckduckgo', source: 'duckassistbot', re: /duckassistbot|duckduckbot/i },
  { vendor: 'amazon', source: 'amazonbot', re: /amazonbot/i },
  { vendor: 'meta', source: 'meta-externalagent', re: /meta-externalagent|facebookexternalhit|facebookbot/i },
  { vendor: 'commoncrawl', source: 'ccbot', re: /ccbot/i },
  { vendor: 'bytedance', source: 'bytespider', re: /bytespider/i },
];

// Range-source name → canonical vendor (for cross-vendor spoof detection). Only names whose
// default URLs ship above are mapped; --source can add more (name is treated as its own vendor).
const RANGE_VENDOR = Object.fromEntries(
  UA_PRODUCT.filter((product) => product.source).map((product) => [product.source, product.vendor]),
);
Object.assign(RANGE_VENDOR, { 'google-special': 'google', 'google-user-triggered': 'google' });

/** The product a UA claims: { vendor, source } or null. */
export function uaProduct(ua = '') {
  return UA_PRODUCT.find((p) => p.re.test(ua)) ?? null;
}
/** Backwards-compatible: the canonical vendor a UA claims, or null. */
export function uaVendor(ua = '') {
  return uaProduct(ua)?.vendor ?? null;
}

/** Canonical vendors we have a usable proof source for (rDNS suffix list OR published range). */
const RANGE_VENDORS = new Set(Object.values(RANGE_VENDOR));
const RDNS_VENDOR_SET = new Set(RDNS_VENDORS.map((v) => v.vendor));

/**
 * Pure decision — no IO, unit-testable. **Product-level**, per the reported issue:
 * a claim is confirmed or denied ONLY by that product's own range list (GPTBot ⇄ gptbot.json),
 * never by a sibling product's state. A proven owner (rDNS, or another vendor's loaded range)
 * that disagrees with the claim is a spoof; otherwise the claimed product's own source decides.
 *
 * claimedSourceState: 'matched' (loaded, IP present) | 'absent' (loaded, IP absent)
 *                   | 'unavailable' (fetch failed)   | 'no-source' (no URL configured) | null
 */
export function decideVerdict({ claimedVendor, claimedSource, rdnsOwner, crossRangeVendor, claimedSourceState, usedRanges }) {
  // 1. rDNS proved ownership
  if (rdnsOwner) {
    if (!claimedVendor || claimedVendor === rdnsOwner) return { verdict: 'verified', vendor: rdnsOwner, method: 'fcrdns' };
    return { verdict: 'spoofed', vendor: rdnsOwner, method: 'fcrdns', mismatch: `UA claims ${claimedVendor}, reverse DNS proves ${rdnsOwner}` };
  }
  // 2. claimed an rDNS-only vendor (no range source at all) but rDNS did not confirm → spoofed
  if (claimedVendor && !claimedSource && RDNS_VENDOR_SET.has(claimedVendor)) {
    return { verdict: 'spoofed', vendor: claimedVendor, method: 'fcrdns', mismatch: `UA claims ${claimedVendor} but reverse DNS did not confirm it` };
  }
  if (usedRanges) {
    // 3. IP proven in ANOTHER vendor's successfully-loaded range → cross-vendor spoof
    if (crossRangeVendor && claimedVendor && crossRangeVendor !== claimedVendor) {
      return { verdict: 'spoofed', vendor: crossRangeVendor, method: 'published-range', mismatch: `UA claims ${claimedVendor}, IP is in ${crossRangeVendor}'s published range` };
    }
    // 4. the claimed PRODUCT's OWN source decides — sibling products are not evidence
    if (claimedSource) {
      if (claimedSourceState === 'matched') return { verdict: 'verified', vendor: claimedVendor, method: 'published-range' };
      if (claimedSourceState === 'absent') return { verdict: 'spoofed', vendor: claimedVendor, method: 'published-range', note: `UA claims ${claimedVendor}; IP absent from ${claimedSource}, which loaded` };
      // 'unavailable' (fetch failed) or 'no-source' → fail OPEN, never convict on a missing signal
      return { verdict: 'unverifiable', vendor: null, method: 'published-range', note: `${claimedSource} ${claimedSourceState === 'unavailable' ? 'could not be fetched this run' : 'has no configured source'} — cannot decide; do not block` };
    }
    // 5. no product claim, but IP sits in some vendor's loaded range → that vendor, verified
    if (crossRangeVendor) return { verdict: 'verified', vendor: crossRangeVendor, method: 'published-range' };
  }
  return { verdict: 'unverifiable', vendor: null, method: null };
}

// --------------------------------------------------------------- ip math

function v4ToBig(ip) {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let n = 0n;
  for (const p of parts) {
    const v = Number(p);
    if (!Number.isInteger(v) || v < 0 || v > 255) return null;
    n = (n << 8n) | BigInt(v);
  }
  return n;
}

function v6ToBig(ip) {
  let [head, tail] = ip.split('::');
  if (tail === undefined) { tail = ''; }
  const hp = head ? head.split(':').filter(Boolean) : [];
  const tp = tail ? tail.split(':').filter(Boolean) : [];
  // embedded IPv4 (::ffff:1.2.3.4)
  const expand = (arr) => {
    const out = [];
    for (const g of arr) {
      if (g.includes('.')) {
        const b = v4ToBig(g);
        if (b === null) return null;
        out.push(((b >> 16n) & 0xffffn).toString(16), (b & 0xffffn).toString(16));
      } else out.push(g);
    }
    return out;
  };
  const h = expand(hp), t = expand(tp);
  if (!h || !t) return null;
  const fill = 8 - h.length - t.length;
  if (fill < 0 || (ip.includes('::') === false && fill !== 0)) {
    if (!ip.includes('::') && h.length + t.length !== 8) return null;
  }
  const groups = ip.includes('::') ? [...h, ...Array(Math.max(0, fill)).fill('0'), ...t] : h;
  if (groups.length !== 8) return null;
  let n = 0n;
  for (const g of groups) {
    const v = parseInt(g || '0', 16);
    if (Number.isNaN(v) || v < 0 || v > 0xffff) return null;
    n = (n << 16n) | BigInt(v);
  }
  return n;
}

export function parseIp(ip) {
  // Strict syntax gate first: parseInt-based expansion silently accepts junk like
  // `2001:db8::1g`, `1::2::3`, `:::`. node:net.isIP rejects them (0 = invalid).
  const str = String(ip);
  // Zone ids (`fe80::1%eth0`) are accepted by isIP on some Node versions but are meaningless
  // for a crawler-IP check and would mis-match a CIDR after the `%` is dropped — reject them.
  if (str.includes('%')) return null;
  const fam = isIP(str);
  if (fam === 0) return null;
  if (fam === 6) { const n = v6ToBig(ip); return n === null ? null : { n, bits: 128 }; }
  const n = v4ToBig(ip);
  return n === null ? null : { n, bits: 32 };
}

export function inCidr(ip, cidr) {
  const [net, lenStr] = cidr.split('/');
  const a = parseIp(ip), b = parseIp(net);
  if (!a || !b || a.bits !== b.bits) return false;
  const len = Number(lenStr);
  if (!Number.isInteger(len) || len < 0 || len > a.bits) return false;
  const shift = BigInt(a.bits - len);
  return (a.n >> shift) === (b.n >> shift);
}

// --------------------------------------------------------------- checks

function endsWithLabel(host, suffix) {
  const h = host.toLowerCase().replace(/\.$/, '');
  return h === suffix || h.endsWith(`.${suffix}`);
}

async function fcrdns(ip) {
  let names = [];
  try { names = await dns.reverse(ip); } catch (e) { return { ok: false, reason: `no PTR (${e.code || e.message})`, names: [] }; }
  for (const name of names) {
    let forward = [];
    try {
      const [a, aaaa] = await Promise.allSettled([dns.resolve4(name), dns.resolve6(name)]);
      forward = [...(a.value || []), ...(aaaa.value || [])];
    } catch { /* ignore */ }
    if (forward.some((f) => f === ip || (parseIp(f)?.n === parseIp(ip)?.n))) {
      return { ok: true, hostname: name, names, forward };
    }
  }
  return { ok: false, reason: 'forward lookup did not confirm the PTR hostname', names };
}

const rangeCache = new Map();
function rangeClockMs() {
  const epoch = Number(process.env.SOURCE_DATE_EPOCH);
  return Number.isFinite(epoch) && epoch >= 0 ? epoch * 1000 : Date.now();
}

function parseCreationTime(value) {
  if (typeof value !== 'string' || !value.trim()) throw new Error('creationTime is missing');
  const normalized = /(?:Z|[+-]\d\d:\d\d)$/i.test(value) ? value : `${value}Z`;
  const timestamp = Date.parse(normalized);
  if (!Number.isFinite(timestamp)) throw new Error('creationTime is invalid');
  const ageMs = rangeClockMs() - timestamp;
  if (ageMs < 0) throw new Error('creationTime is unexpectedly in the future');
  const ageDays = ageMs / 86400000;
  if (ageDays > MAX_RANGE_AGE_DAYS) {
    throw new Error(`creationTime is stale (${Math.floor(ageDays)} days; max ${MAX_RANGE_AGE_DAYS})`);
  }
  return new Date(timestamp).toISOString();
}

function validatePrefix(entry, index) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    throw new Error(`prefixes[${index}] must be an object`);
  }
  const keys = ['ipv4Prefix', 'ipv6Prefix'].filter((key) => Object.hasOwn(entry, key));
  if (keys.length !== 1 || typeof entry[keys[0]] !== 'string') {
    throw new Error(`prefixes[${index}] must contain exactly one string ipv4Prefix or ipv6Prefix`);
  }
  const cidr = entry[keys[0]];
  const pieces = cidr.split('/');
  const parsed = pieces.length === 2 ? parseIp(pieces[0]) : null;
  const length = Number(pieces[1]);
  const expectedBits = keys[0] === 'ipv4Prefix' ? 32 : 128;
  if (!parsed || parsed.bits !== expectedBits || !Number.isInteger(length) || length < 0 || length > expectedBits) {
    throw new Error(`invalid CIDR at prefixes[${index}]: ${cidr}`);
  }
  return cidr;
}

async function loadRanges(name, url) {
  if (rangeCache.has(name)) return rangeCache.get(name);
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000), headers: { accept: 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (!json || typeof json !== 'object' || Array.isArray(json)) throw new Error('range response must be a JSON object');
    if (!Object.hasOwn(json, 'prefixes')) throw new Error('prefixes is missing');
    if (!Array.isArray(json.prefixes)) throw new Error('prefixes must be an array');
    if (json.prefixes.length === 0) throw new Error('prefixes array is empty');
    const creationTime = parseCreationTime(json.creationTime);
    const prefixes = json.prefixes.map(validatePrefix);
    rangeCache.set(name, { ok: true, prefixes, creationTime });
    log(`ranges ${name}: ${prefixes.length} prefixes`);
  } catch (e) {
    rangeCache.set(name, { ok: false, error: String(e.message || e), prefixes: [] });
    log(`ranges ${name}: unavailable (${e.message || e})`);
  }
  return rangeCache.get(name);
}

async function verify(ip, ua = '') {
  const out = { ip, ua: ua || null, verdict: 'unverifiable', method: null, vendor: null, evidence: {} };

  if (!parseIp(ip)) { out.verdict = 'invalid-ip'; return out; }

  const product = uaProduct(ua);
  const claimedVendor = product?.vendor ?? null;
  const claimedSource = product?.source ?? null;
  const claimsRangeOnly = RANGE_ONLY_UA.test(ua);
  const claimsAnyBot = KNOWN_BOT_UA.test(ua);

  // gather evidence (IO)
  const r = await fcrdns(ip);
  out.evidence.rdns = r.ok ? { hostname: r.hostname } : { failed: r.reason, ptrNames: r.names };
  const rdnsOwner = r.ok
    ? (RDNS_VENDORS.find((v) => v.suffixes.some((s) => endsWithLabel(r.hostname, s)))?.vendor ?? null)
    : null;

  // Per-source outcome, so the claimed PRODUCT's own list can be judged independently of siblings.
  // crossRangeVendor = the vendor of the first successfully-loaded range that contains the IP.
  let crossRangeVendor = null;
  const sourceState = new Map(); // source name -> 'loaded-hit' | 'loaded-miss' | 'failed'
  const sourceError = new Map();
  if (USE_RANGES) {
    for (const [name, url] of Object.entries(RANGE_SOURCES)) {
      const data = await loadRanges(name, url);
      const hit = data.ok && data.prefixes.some((c) => inCidr(ip, c));
      sourceState.set(name, !data.ok ? 'failed' : hit ? 'loaded-hit' : 'loaded-miss');
      if (!data.ok) sourceError.set(name, data.error);
      if (hit && !crossRangeVendor) { crossRangeVendor = RANGE_VENDOR[name] ?? name; out.evidence.range = name; }
    }
  }
  let claimedSourceState = null;
  if (claimedSource) {
    const st = sourceState.get(claimedSource);
    claimedSourceState = st === undefined ? 'no-source' : st === 'failed' ? 'unavailable' : st === 'loaded-hit' ? 'matched' : 'absent';
  }

  // decide (pure) — product-level: only the claimed product's own source confirms or denies it
  const d = decideVerdict({ claimedVendor, claimedSource, rdnsOwner, crossRangeVendor, claimedSourceState, usedRanges: USE_RANGES });
  out.verdict = d.verdict;
  out.vendor = d.vendor;
  out.method = d.method;
  if (d.mismatch) out.evidence.mismatch = d.mismatch;
  if (d.note) out.evidence.note = d.note;
  if (out.verdict === 'unverifiable' && claimedSourceState === 'unavailable') {
    out.evidence.note = `${claimedSource} unavailable: ${sourceError.get(claimedSource) || 'range evidence could not be validated'} — cannot decide; do not block`;
  }

  if (out.verdict === 'unverifiable' && !claimsAnyBot) out.verdict = 'not-a-known-bot';
  if (out.verdict === 'unverifiable' && claimsRangeOnly && !USE_RANGES) {
    out.evidence.note = 'This vendor has no usable rDNS. Re-run with --ranges to check published prefixes.';
  }
  return out;
}

// --------------------------------------------------------------- main

// Only run the CLI when executed directly. When imported (by the test suite),
// stop here so uaVendor / decideVerdict can be unit-tested without touching argv/DNS/network.
const RUN_CLI = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;
if (!RUN_CLI) { /* imported as a module */ } else {

const targets = [];
const fileArg = arg('file');
if (fileArg) {
  for (const line of readFileSync(fileArg, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const m = /^(\S+)\s*(.*)$/.exec(t);
    targets.push({ ip: m[1], ua: m[2] || '' });
  }
} else if (arg('ip')) {
  targets.push({ ip: arg('ip'), ua: arg('ua', '') });
} else {
  console.error('error: --ip <addr> or --file <path> is required');
  process.exit(2);
}

const results = [];
for (const t of targets) results.push(await verify(t.ip, t.ua));
if (results.some((result) => result.verdict === 'invalid-ip')) {
  console.error('error: input contains an invalid IP address');
  process.exit(2);
}

const tally = results.reduce((a, r) => ({ ...a, [r.verdict]: (a[r.verdict] || 0) + 1 }), {});
const ruleset = crawlerIdentityRuleset();
const coverage = crawlerIdentityCoverage(results);
const ruleForVerdict = {
  verified: 'crawler-identity-verified',
  spoofed: 'crawler-identity-spoofed',
  unverifiable: 'crawler-identity-unverifiable',
  'not-a-known-bot': 'crawler-identity-not-known',
};
const stateForVerdict = {
  verified: 'confirmed',
  spoofed: 'confirmed',
  unverifiable: 'unknown',
  'not-a-known-bot': 'not_applicable',
};
const severityForVerdict = {
  verified: 'info',
  spoofed: 'high',
  unverifiable: 'high',
  'not-a-known-bot': 'info',
};
const current = results.map((result) => createFindingV2({
  ruleset,
  adapterId: CRAWLER_IDENTITY_ADAPTER.id,
  rule: crawlerIdentityRule(ruleForVerdict[result.verdict]),
  title: `Crawler identity ${result.verdict}`,
  severity: severityForVerdict[result.verdict],
  state: stateForVerdict[result.verdict],
  summary: result.verdict === 'verified'
    ? `The address evidence matches the claimed crawler identity using ${result.method}.`
    : result.verdict === 'spoofed'
      ? 'The address evidence contradicts the claimed crawler identity.'
      : result.verdict === 'unverifiable'
        ? 'The required crawler identity evidence was unavailable or insufficient; do not block on this result.'
        : 'The user-agent does not claim a crawler product known to this adapter.',
  evidence: {
    subject: `${result.ip}|${result.ua || ''}`,
    ip: result.ip,
    claimedUserAgent: result.ua,
    verdict: result.verdict,
    vendor: result.vendor,
    method: result.method,
    observation: result.evidence,
  },
  remediation: result.verdict === 'spoofed'
    ? 'Do not grant crawler exemptions to this request; apply the normal public-path controls and rate limits.'
    : result.verdict === 'unverifiable'
      ? 'Restore the exact product range or FCrDNS evidence and rerun; keep the request on normal public-path policy meanwhile.'
      : 'Keep crawler identity separate from authorization; verified crawlers may receive only documented public-path exemptions.',
  retest: 'Repeat the exact product-level range or forward-confirmed reverse DNS verification with fresh evidence.',
}));
const generatedAt = process.env.SOURCE_DATE_EPOCH
  ? new Date(Number(process.env.SOURCE_DATE_EPOCH) * 1000).toISOString()
  : new Date().toISOString();
if (Number.isNaN(Date.parse(generatedAt))) {
  console.error('error: SOURCE_DATE_EPOCH must be numeric');
  process.exit(2);
}
const auditBoundary = {
  version: 1,
  surface: 'crawler-identity',
  methods: USE_RANGES ? ['fcrdns', 'published-range'] : ['fcrdns'],
  maxRangeAgeDays: MAX_RANGE_AGE_DAYS,
  inputCount: targets.length,
};
const report = createReportV2({
  version: readFileSync(join(fileURLToPath(new URL('..', import.meta.url)), 'VERSION'), 'utf8').trim(),
  generatedAt,
  mode: 'audit',
  subject: {
    id: `project-${randomUUID().replaceAll('-', '').slice(0, 32)}`,
    binding: 'ephemeral',
    scopeDigest: digestValue(auditBoundary),
    localPathIncluded: false,
  },
  ruleset,
  scope: {
    auditBoundary,
    checkModes: USE_RANGES ? ['dns', 'network-passive'] : ['dns'],
    networkAccessPerformed: true,
  },
  coverage,
  findings: initializeFindingsV2(current, coverage),
  policy: EFFECTIVE_POLICY,
  limitations: [
    'Crawler identity never grants access to a private path and is not an authorization decision.',
    'Published range evidence is product-specific and time-bounded; sibling product ranges cannot confirm a claim.',
  ],
});
const md = renderMarkdownV2(report);

if (OUT_DIR) {
  const stamp = generatedAt.replace(/[:.]/g, '-');
  const base = REPORT_NAME || `crawler-verification-${stamp}`;
  writeReportBundleV2(report, OUT_DIR, base, { additionalFiles: [{
    name: `${base}.observations.json`, json: {
    schemaVersion: 1,
    adapter: CRAWLER_IDENTITY_ADAPTER.id,
    generatedAt,
    tally,
    results,
    },
  }] });
  log(`wrote report to ${OUT_DIR}`);
}

console.log(md);
process.exit(exitCodeV2(report));

} // end RUN_CLI
