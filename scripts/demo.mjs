#!/usr/bin/env node
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { once } from 'node:events';
import { applyBaseline, createFinding, createReport, writeReportBundle } from './lib/evidence.mjs';

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
const now = process.env.SOURCE_DATE_EPOCH
  ? new Date(Number(process.env.SOURCE_DATE_EPOCH) * 1000).toISOString()
  : new Date().toISOString();
const version = (await (await import('node:fs/promises')).readFile(join(ROOT, 'VERSION'), 'utf8')).trim();
const normalized = (raw) => raw.findings.map((finding) => createFinding({
  ruleId: `crawl.${finding.code}`,
  title: finding.message.split(/[.;]\s/)[0],
  severity: finding.severity,
  state: 'confirmed',
  discriminator: JSON.stringify({ message: finding.message, detail: finding.detail || null }),
  summary: finding.message,
  evidence: { subject: raw.site, ...(finding.detail ? { detail: finding.detail } : {}) },
  remediation: 'Review the generated crawl report and enforce the intended boundary at the server or edge.',
  retest: 'Run the same owned local fixture through the crawl audit again.',
}));
const scope = { projectRoot: 'examples/insecure-demo', authorizationStatus: 'owned-local-fixture', checkModes: ['local'], networkAccessPerformed: false };
const beforeEvidence = createReport({
  version, generatedAt: now, mode: 'demo-before', scope,
  findings: normalized(before).map((finding) => ({ ...finding, baselineState: 'new' })),
  limitations: ['Intentional local crawl-boundary fixture only; no third-party target or authenticated application flow was tested.'],
});
const afterEvidence = createReport({
  version, generatedAt: now, mode: 'demo-after', scope,
  findings: applyBaseline(normalized(after), beforeEvidence),
  baseline: { path: 'evidence-before.json', generatedAt: beforeEvidence.generatedAt },
  limitations: ['Intentional local crawl-boundary fixture only; no third-party target or authenticated application flow was tested.'],
});
writeReportBundle(beforeEvidence, out, 'evidence-before');
writeReportBundle(afterEvidence, out, 'evidence-after');
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
