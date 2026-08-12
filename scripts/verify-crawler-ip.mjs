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
 *
 * --file format: one entry per line, `ip` or `ip<TAB or whitespace>user agent`.
 *
 * Exit code 1 if any entry is verdict=spoofed.
 */

import { promises as dns } from 'node:dns';
import { isIP } from 'node:net';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const argv = process.argv.slice(2);
const arg = (n, d = null) => { const i = argv.indexOf(`--${n}`); return i === -1 ? d : argv[i + 1]; };
const flag = (n) => argv.includes(`--${n}`);
const all = (n) => argv.reduce((acc, v, i) => (v === `--${n}` ? [...acc, argv[i + 1]] : acc), []);

const USE_RANGES = flag('ranges');
const OUT_DIR = arg('out');
const QUIET = flag('quiet');
const log = (...m) => { if (!QUIET) console.error('·', ...m); };

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
const RANGE_VENDOR = {
  googlebot: 'google', 'google-special': 'google', 'google-user-triggered': 'google',
  bingbot: 'bing',
  gptbot: 'openai', 'oai-searchbot': 'openai', 'chatgpt-user': 'openai',
};

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
async function loadRanges(name, url) {
  if (rangeCache.has(name)) return rangeCache.get(name);
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000), headers: { accept: 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const prefixes = (json.prefixes || []).map((p) => p.ipv4Prefix || p.ipv6Prefix).filter(Boolean);
    rangeCache.set(name, { ok: true, prefixes });
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
  if (USE_RANGES) {
    for (const [name, url] of Object.entries(RANGE_SOURCES)) {
      const data = await loadRanges(name, url);
      const hit = data.ok && data.prefixes.some((c) => inCidr(ip, c));
      sourceState.set(name, !data.ok ? 'failed' : hit ? 'loaded-hit' : 'loaded-miss');
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

const tally = results.reduce((a, r) => ({ ...a, [r.verdict]: (a[r.verdict] || 0) + 1 }), {});

const lines = [];
lines.push(`# Crawler identity verification`, '', `Checked ${results.length} address(es) · ${Object.entries(tally).map(([k, v]) => `${k}: ${v}`).join(' · ')}`, '');
lines.push('| IP | Claimed UA | Verdict | Vendor | Method | Evidence |', '|---|---|---|---|---|---|');
for (const r of results) {
  const ev = r.evidence.mismatch || r.evidence.note || r.evidence.range
    || r.evidence.rdns?.hostname || r.evidence.rdns?.failed || '—';
  lines.push(`| ${r.ip} | ${(r.ua || '—').slice(0, 40)} | ${r.verdict === 'spoofed' ? '**spoofed**' : r.verdict} | ${r.vendor || '—'} | ${r.method || '—'} | ${String(ev).slice(0, 80)} |`);
}
lines.push('', 'Reminder: `verified` permits a rate-limit exemption only. It never authorizes access to a private path.');
const md = lines.join('\n');

if (OUT_DIR) {
  mkdirSync(OUT_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  writeFileSync(join(OUT_DIR, `crawler-verification-${stamp}.json`), JSON.stringify({ generatedAt: new Date().toISOString(), tally, results }, null, 2));
  writeFileSync(join(OUT_DIR, `crawler-verification-${stamp}.md`), md);
  log(`wrote report to ${OUT_DIR}`);
}

console.log(md);
process.exit(tally.spoofed ? 1 : 0);

} // end RUN_CLI
