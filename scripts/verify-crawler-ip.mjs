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
const UA_VENDOR = [
  { vendor: 'google', re: /googlebot|google-inspectiontool|googleother|google-extended|feedfetcher-google|apis-google|googleimageproxy|storebot-google/i },
  { vendor: 'bing', re: /bingbot|msnbot|bingpreview|adidxbot/i },
  { vendor: 'apple', re: /applebot/i },
  { vendor: 'yandex', re: /yandex(bot|images|video|media|blogs|favicons|webmaster|accessibilitybot)?/i },
  { vendor: 'baidu', re: /baiduspider/i },
  { vendor: 'openai', re: /gptbot|oai-searchbot|chatgpt-user/i },
  { vendor: 'anthropic', re: /claudebot|claude-searchbot|claude-user|anthropic/i },
  { vendor: 'perplexity', re: /perplexitybot|perplexity-user/i },
  { vendor: 'duckduckgo', re: /duckassistbot|duckduckbot/i },
  { vendor: 'amazon', re: /amazonbot/i },
  { vendor: 'meta', re: /meta-externalagent|facebookexternalhit|facebookbot/i },
  { vendor: 'commoncrawl', re: /ccbot/i },
  { vendor: 'bytedance', re: /bytespider/i },
];

// Range-source name → canonical vendor. Keys must match RANGE_SOURCES above.
const RANGE_VENDOR = {
  googlebot: 'google', 'google-special': 'google', 'google-user-triggered': 'google',
  bingbot: 'bing',
  gptbot: 'openai', 'oai-searchbot': 'openai', 'chatgpt-user': 'openai',
};

/** The canonical vendor a UA claims to be, or null if it claims no known crawler. */
export function uaVendor(ua = '') {
  return UA_VENDOR.find((v) => v.re.test(ua))?.vendor ?? null;
}

/** Canonical vendors we have a usable proof source for (rDNS suffix list OR published range). */
const RANGE_VENDORS = new Set(Object.values(RANGE_VENDOR));
const RDNS_VENDOR_SET = new Set(RDNS_VENDORS.map((v) => v.vendor));
function haveProofSourceFor(vendor) {
  return RANGE_VENDORS.has(vendor) || RDNS_VENDOR_SET.has(vendor);
}

/**
 * Pure decision function — no IO, unit-testable.
 * Inputs: the UA's claimed vendor, the rDNS result, the matched range vendor (if any),
 *         and whether ranges were even consulted.
 * The single rule everywhere: a proven owner that DISAGREES with a non-null claim is a spoof.
 */
export function decideVerdict({ claimedVendor, rdnsOwner, rangeVendor, usedRanges, claimedVendorSourceLoaded = null }) {
  // claimedVendorSourceLoaded: true = the claimed vendor's range source loaded this run,
  //   false = it FAILED to load (network/URL error), null = we have no source for that vendor.
  // This distinction is the whole point of the fix: a source that failed to fetch must never
  // convict a real crawler as spoofed — a transient outage would then get it wrongly blocked.
  // 1. rDNS proved the IP belongs to some vendor
  if (rdnsOwner) {
    if (!claimedVendor || claimedVendor === rdnsOwner) return { verdict: 'verified', vendor: rdnsOwner, method: 'fcrdns' };
    return { verdict: 'spoofed', vendor: rdnsOwner, method: 'fcrdns', mismatch: `UA claims ${claimedVendor}, reverse DNS proves ${rdnsOwner}` };
  }
  // 2. UA claims an rDNS-verifiable vendor but rDNS did not confirm it — suspicious;
  //    ranges cannot rescue an rDNS vendor (they don't publish prefix lists), so it's a spoof.
  if (claimedVendor && RDNS_VENDOR_SET.has(claimedVendor) && !RANGE_VENDORS.has(claimedVendor)) {
    return { verdict: 'spoofed', vendor: claimedVendor, method: 'fcrdns', mismatch: `UA claims ${claimedVendor} but reverse DNS did not confirm it` };
  }
  // 3. published-range path
  if (usedRanges) {
    if (rangeVendor) {
      if (!claimedVendor || claimedVendor === rangeVendor) return { verdict: 'verified', vendor: rangeVendor, method: 'published-range' };
      return { verdict: 'spoofed', vendor: rangeVendor, method: 'published-range', mismatch: `UA claims ${claimedVendor}, IP is in ${rangeVendor}'s published range` };
    }
    // no range matched the claim. Only a SUCCESSFULLY-LOADED source that lacks the IP proves a spoof.
    if (claimedVendor) {
      if (claimedVendorSourceLoaded === true) {
        return { verdict: 'spoofed', vendor: claimedVendor, method: 'published-range', note: `UA claims ${claimedVendor}; IP is in none of its successfully-loaded published prefixes` };
      }
      if (claimedVendorSourceLoaded === false) {
        // fail OPEN, not closed: a fetch failure is not evidence of spoofing.
        return { verdict: 'unverifiable', vendor: null, method: 'published-range', note: `${claimedVendor}'s published ranges could not be fetched this run — cannot decide; do not block on this` };
      }
      return { verdict: 'unverifiable', vendor: null, method: 'published-range', note: `no proof source for ${claimedVendor}; add one with --source before acting` };
    }
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
  if (ip.includes(':')) { const n = v6ToBig(ip); return n === null ? null : { n, bits: 128 }; }
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

  const claimedVendor = uaVendor(ua);
  const claimsRangeOnly = RANGE_ONLY_UA.test(ua);
  const claimsAnyBot = KNOWN_BOT_UA.test(ua);

  // gather evidence (IO)
  const r = await fcrdns(ip);
  out.evidence.rdns = r.ok ? { hostname: r.hostname } : { failed: r.reason, ptrNames: r.names };
  const rdnsOwner = r.ok
    ? (RDNS_VENDORS.find((v) => v.suffixes.some((s) => endsWithLabel(r.hostname, s)))?.vendor ?? null)
    : null;

  let rangeVendor = null;
  // Track whether the CLAIMED vendor's own source(s) actually loaded this run — so a fetch
  // failure yields 'unverifiable', not a wrong 'spoofed'. null = we have no source for it.
  let claimedVendorSourceLoaded = null;
  if (USE_RANGES) {
    for (const [name, url] of Object.entries(RANGE_SOURCES)) {
      const data = await loadRanges(name, url);
      const vendorOfSource = RANGE_VENDOR[name] ?? name;
      if (claimedVendor && vendorOfSource === claimedVendor) {
        // at least one of the claimed vendor's sources loaded → true; else stays false
        claimedVendorSourceLoaded = claimedVendorSourceLoaded === true ? true : data.ok;
      }
      if (data.ok && data.prefixes.some((c) => inCidr(ip, c))) {
        rangeVendor = RANGE_VENDOR[name] ?? name;
        out.evidence.range = name;
        if (rangeVendor === claimedVendor) break; // matched the claim; no need to keep looking
      }
    }
  }

  // decide (pure) — claim must AGREE with proven ownership, never merely "some bot vendor"
  const d = decideVerdict({ claimedVendor, rdnsOwner, rangeVendor, usedRanges: USE_RANGES, claimedVendorSourceLoaded });
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
