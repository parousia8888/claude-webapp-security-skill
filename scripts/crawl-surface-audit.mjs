#!/usr/bin/env node
/**
 * crawl-surface-audit.mjs — audit a site's public crawl boundary.
 *
 * Read-only HTTP GET/HEAD only. Run against your own property or with written
 * authorization. See ../references/crawl-boundary.md for how to read the output.
 *
 * Usage:
 *   node crawl-surface-audit.mjs --site https://example.com [options]
 *
 * Options:
 *   --site <url>        required, origin to audit
 *   --out <dir>         write report.json + report.md here (default: stdout only)
 *   --max-urls <n>      sitemap URLs to spot-check (default 20)
 *   --matrix <n>        URLs to replay across the crawler UA matrix (default 3)
 *   --concurrency <n>   parallel requests (default 4)
 *   --delay <ms>        delay between request batches (default 200)
 *   --timeout <ms>      per-request timeout (default 15000)
 *   --no-probe          skip the private-path probe list
 *   --quiet             suppress progress output on stderr
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { parseRobots, robotsVerdict } from './lib/robots.mjs';

// ---------------------------------------------------------------- args

const argv = process.argv.slice(2);
const arg = (name, fallback = null) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? fallback : argv[i + 1];
};
const flag = (name) => argv.includes(`--${name}`);

const SITE = arg('site');
if (!SITE) {
  console.error('error: --site <url> is required');
  process.exit(2);
}
const ORIGIN = new URL(SITE).origin;
const OUT_DIR = arg('out');
const MAX_URLS = Number(arg('max-urls', 20));
const MATRIX_URLS = Number(arg('matrix', 3));
const CONCURRENCY = Number(arg('concurrency', 4));
const DELAY = Number(arg('delay', 200));
const TIMEOUT = Number(arg('timeout', 15000));
const PROBE = !flag('no-probe');
const QUIET = flag('quiet');

const log = (...m) => { if (!QUIET) console.error('·', ...m); };

// ---------------------------------------------------------------- constants

const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

// token -> full UA string. Kept realistic; some edges match on the full string.
const UA_MATRIX = {
  browser: BROWSER_UA,
  Googlebot: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  Bingbot: 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
  'OAI-SearchBot': 'Mozilla/5.0 (compatible; OAI-SearchBot/1.0; +https://openai.com/searchbot)',
  GPTBot: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.1; +https://openai.com/gptbot',
  'ChatGPT-User': 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ChatGPT-User/1.0; +https://openai.com/bot',
  ClaudeBot: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0; +claudebot@anthropic.com)',
  'Claude-SearchBot': 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Claude-SearchBot/1.0; +https://www.anthropic.com)',
  'Claude-User': 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Claude-User/1.0; +https://www.anthropic.com)',
  PerplexityBot: 'Mozilla/5.0 (compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)',
  Applebot: 'Mozilla/5.0 (compatible; Applebot/0.1; +http://www.apple.com/go/applebot)',
};

// Crawlers whose absence from robots.txt named groups is worth reporting,
// grouped by what blocking them actually costs.
const UA_ROLES = {
  Googlebot: 'search', Bingbot: 'search', 'OAI-SearchBot': 'ai-search',
  'Claude-SearchBot': 'ai-search', PerplexityBot: 'ai-search', Applebot: 'search',
  DuckAssistBot: 'ai-search', Baiduspider: 'search', YandexBot: 'search',
  'ChatGPT-User': 'user-triggered', 'Claude-User': 'user-triggered', 'Perplexity-User': 'user-triggered',
  GPTBot: 'training', ClaudeBot: 'training', CCBot: 'training',
  'Google-Extended': 'training-token', 'Applebot-Extended': 'training-token',
  Bytespider: 'training', 'meta-externalagent': 'training',
  AhrefsBot: 'seo-tool', SemrushBot: 'seo-tool', DotBot: 'seo-tool', MJ12bot: 'seo-tool',
};

// Paths that must never return a useful 200 to an unauthenticated client.
const PRIVATE_PROBES = [
  '/.env', '/.git/config', '/.git/HEAD', '/.aws/credentials', '/.DS_Store',
  '/config.json', '/package.json', '/composer.lock', '/docker-compose.yml',
  '/backup.zip', '/db.sql', '/dump.sql', '/wp-login.php', '/phpmyadmin/',
  '/admin', '/administrator', '/actuator/env', '/debug', '/metrics', '/server-status',
  '/api/', '/api/v1/keys', '/.well-known/security.txt',
];

// ---------------------------------------------------------------- http

const findings = [];
const add = (severity, code, message, detail) =>
  findings.push({ severity, code, message, ...(detail ? { detail } : {}) });

const SEV_ORDER = { high: 0, medium: 1, low: 2, info: 3 };

async function req(url, { method = 'GET', ua = BROWSER_UA, redirect = 'manual' } = {}) {
  try {
    const res = await fetch(url, {
      method,
      redirect,
      headers: { 'user-agent': ua, accept: '*/*', 'accept-language': 'en-US,en;q=0.9' },
      signal: AbortSignal.timeout(TIMEOUT),
    });
    let body = '';
    if (method === 'GET') {
      const buf = await res.arrayBuffer();
      body = Buffer.from(buf).toString('utf8');
    }
    return {
      url, ok: true, status: res.status,
      headers: Object.fromEntries(res.headers.entries()),
      body, bytes: method === 'GET' ? Buffer.byteLength(body) : Number(res.headers.get('content-length') || 0),
      location: res.headers.get('location') || null,
    };
  } catch (e) {
    return { url, ok: false, status: 0, headers: {}, body: '', bytes: 0, error: String(e.message || e) };
  }
}

async function pool(items, fn) {
  const out = [];
  for (let i = 0; i < items.length; i += CONCURRENCY) {
    const batch = items.slice(i, i + CONCURRENCY);
    out.push(...(await Promise.all(batch.map(fn))));
    if (DELAY && i + CONCURRENCY < items.length) await new Promise((r) => setTimeout(r, DELAY));
  }
  return out;
}

// ---------------------------------------------------------------- robots.txt

// ---------------------------------------------------------------- sitemap

function extractTags(xml, tag) {
  const out = [];
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'gi');
  let m;
  while ((m = re.exec(xml))) out.push(m[1].trim());
  return out;
}

async function collectSitemap(url, seen = new Set(), depth = 0) {
  if (depth > 2 || seen.has(url)) return { urls: [], maps: [] };
  seen.add(url);
  const res = await req(url);
  const maps = [{ url, status: res.status, bytes: res.bytes }];
  if (res.status !== 200 || !res.body) return { urls: [], maps };

  const isIndex = /<sitemapindex/i.test(res.body);
  const locs = extractTags(res.body, 'loc').map((s) => s.replace(/^<!\[CDATA\[|\]\]>$/g, '').trim());
  if (isIndex) {
    const urls = [];
    for (const child of locs.slice(0, 10)) {
      const sub = await collectSitemap(child, seen, depth + 1);
      urls.push(...sub.urls);
      maps.push(...sub.maps);
    }
    return { urls, maps };
  }
  return { urls: locs, maps };
}

// ---------------------------------------------------------------- main

const report = {
  site: ORIGIN,
  generatedAt: new Date().toISOString(),
  robots: null,
  llms: null,
  sitemaps: [],
  sitemapUrlCount: 0,
  sampledUrls: [],
  uaMatrix: [],
  privateProbes: [],
  findings,
};

log(`auditing ${ORIGIN}`);

// --- robots.txt
const robotsRes = await req(`${ORIGIN}/robots.txt`);
let robots = null;
if (robotsRes.status === 200 && /disallow|allow|user-agent/i.test(robotsRes.body)) {
  robots = parseRobots(robotsRes.body);
  report.robots = {
    status: 200,
    bytes: robotsRes.bytes,
    groupCount: robots.groups.length,
    agents: robots.groups.flatMap((g) => g.agents),
    sitemaps: robots.sitemaps,
  };
  log(`robots.txt: ${robots.groups.length} groups, ${robots.sitemaps.length} sitemap refs`);

  // finding: named groups that omit the private rules present in `*`
  const star = robots.groups.find((g) => g.agents.includes('*'));
  if (star) {
    const starDisallows = star.rules.filter((r) => r.type === 'disallow' && r.path).map((r) => r.path);
    for (const g of robots.groups) {
      if (g.agents.includes('*')) continue;
      const own = new Set(g.rules.filter((r) => r.type === 'disallow').map((r) => r.path));
      const missing = starDisallows.filter((p) => !own.has(p));
      const blanket = g.rules.some((r) => r.type === 'disallow' && r.path === '/');
      if (missing.length && !blanket) {
        add('medium', 'robots-group-not-inherited',
          `Group "${g.agents.join(', ')}" omits Disallow rules that exist under "*"; crawlers matching their own group ignore the "*" group entirely.`,
          { missing });
      }
    }
  } else {
    add('low', 'robots-no-wildcard-group', 'robots.txt has no "User-agent: *" group; unlisted crawlers get no rules at all.');
  }

  // finding: duplicate groups for the same agent
  const agentCounts = {};
  for (const g of robots.groups) for (const a of g.agents) agentCounts[a] = (agentCounts[a] || 0) + 1;
  const dupes = Object.entries(agentCounts).filter(([, n]) => n > 1).map(([a]) => a);
  if (dupes.length) add('low', 'robots-duplicate-groups', 'Duplicate groups for the same user-agent; merge behaviour is vendor-specific.', { agents: dupes });

  // finding: policy summary per known crawler
  const policy = {};
  for (const [token, role] of Object.entries(UA_ROLES)) {
    const v = robotsVerdict(robots, token, '/');
    policy[token] = { role, rootAllowed: v.allowed, hasOwnGroup: Boolean(v.namedGroup) };
    if (!v.allowed && (role === 'search' || role === 'ai-search')) {
      add('high', 'robots-blocks-search-crawler',
        `robots.txt disallows "/" for ${token} (${role}); this removes you from that engine's index and from AI answers sourced from it.`);
    }
    if (!v.allowed && role === 'user-triggered') {
      add('medium', 'robots-blocks-user-fetcher',
        `robots.txt disallows "/" for ${token}; this is a live user asking an assistant to open your page, and they will see a fetch failure.`);
    }
  }
  report.robots.policy = policy;

  // finding: no sitemap declared
  if (!robots.sitemaps.length) add('medium', 'robots-no-sitemap', 'robots.txt declares no Sitemap:. Crawlers must then discover every URL by link.');

  // finding: wildcard-suffix rules that many crawlers ignore
  const dollarRules = robots.groups.flatMap((g) => g.rules).filter((r) => r.path.includes('$'));
  if (dollarRules.length) {
    add('info', 'robots-uses-dollar-anchor',
      '"$" anchors are honoured by major crawlers but not universally; do not rely on them for anything that matters.',
      { rules: [...new Set(dollarRules.map((r) => `${r.type}: ${r.path}`))] });
  }
} else {
  add(robotsRes.status === 404 ? 'medium' : 'high', 'robots-missing',
    `robots.txt returned ${robotsRes.status || 'no response'}. Every crawler will apply its own defaults.`);
  report.robots = { status: robotsRes.status, error: robotsRes.error || null };
}

// --- llms.txt
const llmsRes = await req(`${ORIGIN}/llms.txt`);
if (llmsRes.status === 200) {
  const urls = [...llmsRes.body.matchAll(/https?:\/\/[^\s)>\]"']+/g)].map((m) => m[0]);
  report.llms = { status: 200, bytes: llmsRes.bytes, urlCount: urls.length, urls: urls.slice(0, 200) };
  log(`llms.txt: ${urls.length} URLs`);
  const foreign = urls.filter((u) => { try { return new URL(u).origin !== ORIGIN; } catch { return false; } });
  if (foreign.length) add('info', 'llms-external-urls', 'llms.txt references external origins.', { count: foreign.length });
  if (robots) {
    const blocked = urls.filter((u) => {
      try { const p = new URL(u); return p.origin === ORIGIN && !robotsVerdict(robots, 'Googlebot', p.pathname).allowed; }
      catch { return false; }
    });
    if (blocked.length) add('medium', 'llms-lists-disallowed-urls', 'llms.txt advertises URLs that robots.txt disallows.', { urls: blocked.slice(0, 20) });
  }
} else {
  report.llms = { status: llmsRes.status };
}

// --- sitemaps
const sitemapCandidates = robots?.sitemaps?.length ? robots.sitemaps : [`${ORIGIN}/sitemap.xml`];
let sitemapUrls = [];
for (const sm of sitemapCandidates.slice(0, 5)) {
  const { urls, maps } = await collectSitemap(sm);
  report.sitemaps.push(...maps);
  sitemapUrls.push(...urls);
}
sitemapUrls = [...new Set(sitemapUrls)];
report.sitemapUrlCount = sitemapUrls.length;
log(`sitemaps: ${report.sitemaps.length} files, ${sitemapUrls.length} unique URLs`);

for (const m of report.sitemaps) {
  if (m.status !== 200) add('high', 'sitemap-unreachable', `Declared sitemap returned ${m.status}.`, { url: m.url });
  else if (robots) {
    try {
      const p = new URL(m.url);
      if (p.origin === ORIGIN && !robotsVerdict(robots, 'Googlebot', p.pathname).allowed) {
        add('high', 'sitemap-disallowed', 'A declared sitemap is itself disallowed by robots.txt.', { url: m.url });
      }
    } catch { /* ignore */ }
  }
}
if (!sitemapUrls.length) add('high', 'sitemap-empty', 'No URLs discovered from any sitemap.');

// --- sample sitemap URLs
const sample = sitemapUrls.slice(0, MAX_URLS);
if (sample.length) log(`spot-checking ${sample.length} sitemap URLs`);
const sampleResults = await pool(sample, async (u) => {
  const res = await req(u, { redirect: 'manual' });
  const xrt = res.headers['x-robots-tag'] || '';
  const meta = /<meta[^>]+name=["']robots["'][^>]+content=["']([^"']+)["']/i.exec(res.body || '');
  const canonical = /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i.exec(res.body || '');
  let robotsAllowed = true, robotsBy = 'n/a';
  try { const v = robotsVerdict(robots, 'Googlebot', new URL(u).pathname); robotsAllowed = v.allowed; robotsBy = v.by; } catch { /* ignore */ }
  return {
    url: u, status: res.status, bytes: res.bytes,
    xRobotsTag: xrt || null, metaRobots: meta ? meta[1] : null,
    canonical: canonical ? canonical[1] : null,
    location: res.location, robotsAllowed, robotsBy,
  };
});
report.sampledUrls = sampleResults;

for (const r of sampleResults) {
  if (r.status === 0) add('medium', 'sitemap-url-unreachable', 'Sitemap URL did not respond.', { url: r.url });
  else if (r.status >= 500) add('high', 'sitemap-url-5xx', `Sitemap URL returned ${r.status}.`, { url: r.url });
  else if (r.status === 404 || r.status === 410) add('high', 'sitemap-url-404', `Sitemap URL returned ${r.status}; stale sitemap entries waste crawl budget and look like a broken site.`, { url: r.url });
  else if (r.status >= 300 && r.status < 400) add('medium', 'sitemap-url-redirect', `Sitemap URL redirects (${r.status}); list the final URL instead.`, { url: r.url, to: r.location });
  if (/noindex/i.test(r.xRobotsTag || '') || /noindex/i.test(r.metaRobots || '')) {
    add('high', 'sitemap-url-noindex', 'Sitemap URL is marked noindex — it is being advertised and suppressed at the same time.', { url: r.url });
  }
  if (!r.robotsAllowed) {
    add('high', 'sitemap-url-disallowed', 'Sitemap URL is disallowed by robots.txt. The crawler cannot fetch it, so any noindex or canonical on it is never read.', { url: r.url, rule: r.robotsBy });
  }
  if (r.status === 200 && r.bytes > 0 && r.bytes < 2048) {
    add('medium', 'thin-initial-html', 'Initial HTML is very small; if the content is rendered by JavaScript, most AI crawlers will see an empty page.', { url: r.url, bytes: r.bytes });
  }
  if (r.status === 200 && !r.canonical) {
    add('low', 'missing-canonical', 'No rel=canonical in the initial HTML.', { url: r.url });
  }
}

// --- UA matrix
const matrixTargets = [`${ORIGIN}/`, ...sample.filter((u) => u !== `${ORIGIN}/`).slice(0, Math.max(0, MATRIX_URLS - 1))];
log(`UA matrix across ${matrixTargets.length} URL(s) × ${Object.keys(UA_MATRIX).length} agents`);

for (const target of matrixTargets) {
  const rows = [];
  for (const [token, ua] of Object.entries(UA_MATRIX)) {
    const res = await req(target, { ua, redirect: 'follow' });
    rows.push({ agent: token, status: res.status, bytes: res.bytes, xRobotsTag: res.headers['x-robots-tag'] || null, error: res.error || null });
    if (DELAY) await new Promise((r) => setTimeout(r, DELAY));
  }
  report.uaMatrix.push({ url: target, rows });

  const base = rows.find((r) => r.agent === 'browser');
  if (!base || base.status !== 200) {
    add('high', 'baseline-fetch-failed', 'Baseline browser fetch did not return 200; matrix comparison is unreliable.', { url: target, status: base?.status });
    continue;
  }
  for (const r of rows) {
    if (r.agent === 'browser') continue;
    const role = UA_ROLES[r.agent] || 'other';
    if (r.status === 0) {
      add('high', 'crawler-request-failed', `Request as ${r.agent} failed (${r.error}).`, { url: target });
    } else if (r.status === 403 || r.status === 401 || r.status === 429 || r.status === 503) {
      add('high', 'crawler-blocked',
        `${r.agent} received ${r.status} while a browser received 200 — this crawler is being blocked at the edge/WAF. Check bot-fight / AI-scraper settings and managed rule groups.`,
        { url: target, role });
    } else if (r.status !== base.status) {
      add('medium', 'crawler-status-differs', `${r.agent} received ${r.status} vs ${base.status} for a browser.`, { url: target });
    } else if (base.bytes > 0) {
      const delta = Math.abs(r.bytes - base.bytes) / base.bytes;
      if (delta > 0.25) {
        add('medium', 'possible-cloaking',
          `${r.agent} received a response ${Math.round(delta * 100)}% different in size from the browser response. Serving different content by user agent is cloaking and breaks AI retrieval.`,
          { url: target, crawlerBytes: r.bytes, browserBytes: base.bytes });
      }
    }
    if (/noindex/i.test(r.xRobotsTag || '')) {
      add('high', 'public-page-noindex', `${r.agent} received X-Robots-Tag: ${r.xRobotsTag} on a public page.`, { url: target });
    }
  }
}

// --- private path probes
if (PROBE) {
  // Baseline: does the app return a real 404, or a catch-all 200 (SPA soft-404)?
  const nonce = randomUUID().slice(0, 12);
  const baseline = await req(`${ORIGIN}/__no-such-path-${nonce}`);
  const soft = baseline.status === 200 ? { bytes: baseline.bytes } : null;
  report.notFoundBaseline = { status: baseline.status, bytes: baseline.bytes, softNotFound: Boolean(soft) };
  if (soft) {
    add('medium', 'soft-404-catchall',
      'A non-existent path returns 200 with the app shell instead of 404. Crawlers index and re-crawl garbage URLs, real 404s become invisible, and the highest-signal scanner-detection rule (404 ratio per client) stops working. Return a real 404 status for unmatched routes.',
      { probe: `/__no-such-path-${nonce}`, bytes: baseline.bytes });
  }

  log(`probing ${PRIVATE_PROBES.length} private paths`);
  const probeResults = await pool(PRIVATE_PROBES, async (p) => {
    const res = await req(`${ORIGIN}${p}`, { redirect: 'manual' });
    const bodyHint =
      /(BEGIN [A-Z ]*PRIVATE KEY|aws_secret_access_key|[A-Z_]*API[_-]?KEY\s*=|"dependencies"|\[core\]|ref:\s*refs\/)/i.test(res.body || '');
    const isSoft = Boolean(soft) && res.status === 200 &&
      Math.abs(res.bytes - soft.bytes) <= Math.max(512, soft.bytes * 0.02);
    return { path: p, status: res.status, bytes: res.bytes, contentType: res.headers['content-type'] || null, looksSensitive: bodyHint, softNotFound: isSoft };
  });
  report.privateProbes = probeResults;

  const softCount = probeResults.filter((r) => r.softNotFound && !r.looksSensitive).length;
  if (softCount) {
    add('info', 'probe-soft-404', `${softCount} probe path(s) returned the app shell (soft 404), not a real exposure — see soft-404-catchall.`);
  }

  for (const r of probeResults) {
    if (r.softNotFound && !r.looksSensitive) {
      continue; // reported once as soft-404-catchall
    } else if (r.status === 200 && r.looksSensitive) {
      add('high', 'sensitive-file-exposed', `${r.path} returned 200 with content matching a secret/config pattern.`, { path: r.path, bytes: r.bytes });
    } else if (r.status === 200 && !['/api/', '/.well-known/security.txt'].includes(r.path)) {
      add('medium', 'probe-path-200', `${r.path} returned 200. Confirm this is intentional and contains nothing private.`, { path: r.path, bytes: r.bytes, contentType: r.contentType });
    } else if (r.status === 403) {
      add('low', 'probe-path-403', `${r.path} returned 403, which confirms the path exists. Prefer 404 where existence itself is a hint.`, { path: r.path });
    }
  }
  const notFound = probeResults.filter((r) => r.status === 404).length;
  add('info', 'probe-summary', `${notFound}/${probeResults.length} probe paths returned 404.`);

  // source map spot check derived from the homepage HTML
  const home = await req(`${ORIGIN}/`);
  const scripts = [...(home.body || '').matchAll(/<script[^>]+src=["']([^"']+)["']/gi)].map((m) => m[1]);
  const firstJs = scripts.map((s) => { try { return new URL(s, ORIGIN).href; } catch { return null; } }).filter((s) => s && s.startsWith(ORIGIN) && s.includes('.js'))[0];
  if (firstJs) {
    const mapUrl = `${firstJs.split('?')[0]}.map`;
    const mapRes = await req(mapUrl, { method: 'HEAD' });
    report.sourceMap = { url: mapUrl, status: mapRes.status };
    if (mapRes.status === 200) {
      add('high', 'source-map-exposed', 'A production source map is publicly served; it reconstructs original sources and comments.', { url: mapUrl });
    }
  }
  if (scripts.some((s) => /\?v=[a-z][a-z0-9-]{4,}/i.test(s))) {
    add('low', 'semantic-cache-buster', 'Asset URLs carry semantic cache-busting values that leak internal release or feature names; use content hashes.');
  }
}

// ---------------------------------------------------------------- output

findings.sort((a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity]);
const counts = findings.reduce((acc, f) => ({ ...acc, [f.severity]: (acc[f.severity] || 0) + 1 }), {});

function toMarkdown() {
  const L = [];
  L.push(`# Crawl surface audit — ${ORIGIN}`, '', `Generated: ${report.generatedAt}`, '');
  L.push(`**Findings:** ${counts.high || 0} high · ${counts.medium || 0} medium · ${counts.low || 0} low · ${counts.info || 0} info`, '');

  L.push('## Findings', '');
  if (!findings.length) L.push('_None._', '');
  for (const f of findings) {
    L.push(`- **[${f.severity}] ${f.code}** — ${f.message}`);
    if (f.detail) L.push(`  - ${JSON.stringify(f.detail)}`);
  }
  L.push('');

  if (report.robots?.policy) {
    L.push('## robots.txt policy by crawler', '', '| Crawler | Role | `/` allowed | Own group |', '|---|---|---|---|');
    for (const [token, p] of Object.entries(report.robots.policy)) {
      L.push(`| ${token} | ${p.role} | ${p.rootAllowed ? 'yes' : '**no**'} | ${p.hasOwnGroup ? 'yes' : 'no'} |`);
    }
    L.push('');
  }

  for (const m of report.uaMatrix) {
    L.push(`## UA matrix — ${m.url}`, '', '| Agent | Status | Bytes | X-Robots-Tag |', '|---|---|---|---|');
    for (const r of m.rows) L.push(`| ${r.agent} | ${r.status} | ${r.bytes} | ${r.xRobotsTag || '—'} |`);
    L.push('');
  }

  if (report.sampledUrls.length) {
    L.push('## Sitemap URL spot check', '', '| URL | Status | Bytes | robots | noindex |', '|---|---|---|---|---|');
    for (const r of report.sampledUrls) {
      const ni = /noindex/i.test(`${r.xRobotsTag || ''} ${r.metaRobots || ''}`) ? 'yes' : '—';
      L.push(`| ${r.url} | ${r.status} | ${r.bytes} | ${r.robotsAllowed ? 'allow' : '**disallow**'} | ${ni} |`);
    }
    L.push('');
  }

  if (report.privateProbes.length) {
    L.push('## Private-path probes', '', '| Path | Status | Bytes | Note |', '|---|---|---|---|');
    for (const r of report.privateProbes) {
      L.push(`| ${r.path} | ${r.status} | ${r.bytes} | ${r.softNotFound ? 'soft 404 (app shell)' : '—'} |`);
    }
    L.push('');
  }

  L.push('## Not covered by this audit', '',
    '- JavaScript-rendered content (this audit is HTTP-only — and so are most AI crawlers)',
    '- Authenticated flows and object-level authorization',
    '- Whether a real crawler from its own IP is served the same response (use Search Console / Bing Webmaster URL inspection)',
    '- WAF behaviour under sustained load', '');
  return L.join('\n');
}

const md = toMarkdown();

if (OUT_DIR) {
  mkdirSync(OUT_DIR, { recursive: true });
  const stamp = report.generatedAt.replace(/[:.]/g, '-');
  const host = new URL(ORIGIN).hostname;
  writeFileSync(join(OUT_DIR, `crawl-surface-${host}-${stamp}.json`), JSON.stringify(report, null, 2));
  writeFileSync(join(OUT_DIR, `crawl-surface-${host}-${stamp}.md`), md);
  log(`wrote report to ${OUT_DIR}`);
}

console.log(md);
process.exit(counts.high ? 1 : 0);
