#!/usr/bin/env node
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { once } from 'node:events';

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
  ];
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
const before = JSON.parse(await (await import('node:fs/promises')).readFile(join(out, 'before.json'), 'utf8'));
const after = JSON.parse(await (await import('node:fs/promises')).readFile(join(out, 'after.json'), 'utf8'));
const count = (report, severity) => report.findings.filter((finding) => finding.severity === severity).length;
const summary = `# Demo result\n\n| Stage | High | Medium | Evidence |\n|---|---:|---:|---|\n| Before | ${count(before, 'high')} | ${count(before, 'medium')} | \`before.json\`, \`before.md\` |\n| Proposed hardening | - | - | \`hardening.patch\` |\n| Retest | ${count(after, 'high')} | ${count(after, 'medium')} | \`after.json\`, \`after.md\` |\n\nThe patch is evidence for review. A fix is counted only from the retest output.\n`;
writeFileSync(join(out, 'summary.md'), summary);
console.log(`Demo complete in ${out}
before: ${count(before, 'high')} high, ${count(before, 'medium')} medium
after:  ${count(after, 'high')} high, ${count(after, 'medium')} medium

Reports:
  ${join(out, 'summary.md')}
  ${join(out, 'before.md')}
  ${join(out, 'after.md')}
Patch evidence:
  ${join(out, 'hardening.patch')}`);
