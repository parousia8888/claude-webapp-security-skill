#!/usr/bin/env node
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { once } from 'node:events';
import { createDemoFacts, demoCount } from './lib/demo-facts.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const outIndex = process.argv.indexOf('--out');
const out = resolve(outIndex === -1 ? join(ROOT, 'demo-output') : process.argv[outIndex + 1]);
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

async function fixture(hardened) {
  const args = [join(ROOT, 'examples', 'insecure-demo', 'server.mjs')];
  if (hardened) args.push('--hardened');
  const child = spawn(process.execPath, args, { stdio: ['ignore', 'pipe', 'inherit'] });
  const [line] = await once(child.stdout, 'data');
  return { child, ...JSON.parse(String(line)) };
}

async function audit(mode) {
  const app = await fixture(mode === 'after');
  const args = [
    join(ROOT, 'scripts', 'crawl-surface-audit.mjs'), '--site', app.origin,
    '--out', out, '--report-name', mode, '--active-probe', '--max-urls', '1',
    '--acknowledge-authorization',
    '--matrix', '1', '--delay', '0', '--timeout', '3000', '--fail-on', 'never', '--quiet',
    '--subject-id', 'project-00000000000000000000000000000001',
    '--scope-id', 'owned-insecure-demo-crawl-v1',
    '--mode', mode === 'before' ? 'demo-before' : 'demo-after',
  ];
  if (mode === 'after') args.push('--baseline', join(out, 'before.json'));
  const child = spawn(process.execPath, args, { stdio: ['ignore', 'ignore', 'inherit'] });
  const [code] = await once(child, 'exit');
  app.child.kill('SIGTERM');
  if (code !== 0) throw new Error(`${mode} audit exited ${code}`);
}

await audit('before');
await audit('after');
writeFileSync(join(out, 'hardening.patch'), `--- insecure-demo/before.conf
+++ insecure-demo/after.conf
@@ public crawl policy @@
-User-agent: *
-Disallow: /
+User-agent: *
+Allow: /
+Sitemap: /sitemap.xml
@@ sensitive artifacts @@
-GET /.env       -> 200
-GET /app.js.map -> 200
+GET /.env       -> 404
+GET /app.js.map -> 404
@@ unknown routes @@
-GET /missing -> 200 (SPA shell)
+GET /missing -> 404
`);
const before = JSON.parse(readFileSync(join(out, 'before.json'), 'utf8'));
const after = JSON.parse(readFileSync(join(out, 'after.json'), 'utf8'));
const facts = createDemoFacts(before, after);
writeFileSync(join(out, 'demo-result.json'), `${JSON.stringify(facts, null, 2)}\n`);
const fact = (stage, domain, severity) => demoCount(facts, stage, domain, 'confirmed', severity);
const summary = `# Demo result\n\n| Stage | Security HIGH | Discoverability HIGH | Discoverability MEDIUM | Reliability MEDIUM | Evidence |\n|---|---:|---:|---:|---:|---|\n| Before | ${fact('before', 'security_exposure', 'high')} | ${fact('before', 'search_discoverability', 'high')} | ${fact('before', 'search_discoverability', 'medium')} | ${fact('before', 'reliability', 'medium')} | \`before.json\`, \`before.md\` |\n| Proposed hardening | - | - | - | - | \`hardening.patch\` |\n| Retest | ${fact('after', 'security_exposure', 'high')} | ${fact('after', 'search_discoverability', 'high')} | ${fact('after', 'search_discoverability', 'medium')} | ${fact('after', 'reliability', 'medium')} | \`after.json\`, \`after.md\` |\n\nThe patch is evidence for review. A fix is counted only from the compatible v2 retest output.\n`;
writeFileSync(join(out, 'summary.md'), summary);
console.log(`Demo complete in ${out}
before: ${fact('before', 'security_exposure', 'high')} security HIGH; ${fact('before', 'search_discoverability', 'high')} discoverability HIGH + ${fact('before', 'search_discoverability', 'medium')} MEDIUM; ${fact('before', 'reliability', 'medium')} reliability MEDIUM
after:  ${facts.after.bySeverity.high} active HIGH, ${facts.after.bySeverity.medium} active MEDIUM

Reports:
  ${join(out, 'summary.md')}
  ${join(out, 'demo-result.json')}
  ${join(out, 'before.md')}
  ${join(out, 'after.md')}
Patch evidence:
  ${join(out, 'hardening.patch')}`);
