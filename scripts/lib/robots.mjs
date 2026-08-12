/**
 * robots.txt parsing + evaluation — shared by crawl-surface-audit.mjs and its tests.
 *
 * Kept as a pure module (no IO) so the tricky bits — most-specific group selection,
 * longest-match wins, Allow breaking ties, `*`/`$` wildcards — are unit-testable.
 * Getting these wrong makes the audit misreport the crawl boundary: a mis-parsed
 * Disallow can make you "confirm" that a public path is blocked, or vice versa.
 */

export function parseRobots(text) {
  const groups = []; // { agents: [], rules: [{type, path}], crawlDelay }
  const sitemaps = [];
  let current = null;
  let lastWasAgent = false;

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, '').trim();
    if (!line) continue;
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const field = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();

    if (field === 'user-agent') {
      if (!current || !lastWasAgent) { current = { agents: [], rules: [], crawlDelay: null }; groups.push(current); }
      current.agents.push(value);
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (field === 'sitemap') { sitemaps.push(value); continue; }
    if (!current) { current = { agents: ['*'], rules: [], crawlDelay: null }; groups.push(current); }
    if (field === 'allow' || field === 'disallow') current.rules.push({ type: field, path: value });
    else if (field === 'crawl-delay') current.crawlDelay = Number(value);
  }
  return { groups, sitemaps };
}

export function ruleToRegex(pattern) {
  if (pattern === '') return null;
  let re = '^';
  for (const ch of pattern) {
    if (ch === '*') re += '.*';
    else if (ch === '$') re += '$';
    else re += ch.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(re);
}

/** Most-specific group wins (no merging with `*`), longest match wins, Allow breaks ties. */
export function robotsVerdict(robots, uaToken, path) {
  if (!robots) return { allowed: true, by: 'no-robots' };
  const lower = uaToken.toLowerCase();
  let group = robots.groups.find((g) => g.agents.some((a) => a.toLowerCase() === lower));
  if (!group) group = robots.groups.find((g) => g.agents.some((a) => a !== '*' && lower.includes(a.toLowerCase())));
  let matchedNamed = Boolean(group);
  if (!group) group = robots.groups.find((g) => g.agents.includes('*'));
  if (!group) return { allowed: true, by: 'no-group' };

  let best = null;
  for (const rule of group.rules) {
    const re = ruleToRegex(rule.path);
    if (!re || !re.test(path)) continue;
    const len = rule.path.length;
    if (!best || len > best.len || (len === best.len && rule.type === 'allow')) best = { ...rule, len };
  }
  return {
    allowed: best ? best.type === 'allow' : true,
    by: best ? `${best.type}: ${best.path}` : 'default-allow',
    group: group.agents.join(', '),
    namedGroup: matchedNamed,
  };
}
