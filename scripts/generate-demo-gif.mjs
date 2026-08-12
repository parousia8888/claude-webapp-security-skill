#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createCanvas, drawText, encodeGif, fillRect } from './lib/deterministic-gif.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUTPUT = join(ROOT, 'docs', 'assets', 'demo.gif');
const METADATA = join(ROOT, 'docs', 'assets', 'demo.json');
const WIDTH = 840;
const HEIGHT = 472;
const temp = mkdtempSync(join(tmpdir(), 'web-app-security-demo-gif-'));

function count(report, severity) {
  return report.findings.filter((finding) => finding.severity === severity).length;
}

function frame(title, subtitle, lines, { accent = 5, delay = 180 } = {}) {
  const canvas = createCanvas(WIDTH, HEIGHT);
  fillRect(canvas, 0, 0, WIDTH, 10, accent);
  fillRect(canvas, 0, 10, WIDTH, 46, 7);
  drawText(canvas, 'WEB APP SECURITY SKILL', 24, 25, { color: 1, scale: 2 });
  drawText(canvas, title, 34, 88, { color: accent, scale: 3 });
  drawText(canvas, subtitle, 36, 126, { color: 6, scale: 2 });
  fillRect(canvas, 34, 164, WIDTH - 68, 2, 7);
  lines.forEach((line, index) => {
    drawText(canvas, line.text, 42, 194 + index * 42, {
      color: line.color ?? 1,
      scale: line.scale ?? 2,
    });
  });
  drawText(canvas, 'OWNED LOCAL FIXTURE / NO THIRD PARTY TARGET', 36, 444, { color: 6, scale: 1 });
  return { pixels: canvas.pixels, delay };
}

function normalizedPatchLine(patch, matcher) {
  const value = patch.split('\n').find((line) => matcher.test(line));
  if (!value) throw new Error(`demo patch is missing ${matcher}`);
  return value.replace(/\s+/g, ' ').trim();
}

try {
  const demo = spawnSync(process.execPath, [join(ROOT, 'scripts', 'demo.mjs'), '--out', temp], {
    cwd: ROOT, encoding: 'utf8', timeout: 30000,
  });
  if (demo.status !== 0) throw new Error(demo.stderr || demo.stdout || 'demo failed');
  const before = JSON.parse(readFileSync(join(temp, 'before.json'), 'utf8'));
  const after = JSON.parse(readFileSync(join(temp, 'after.json'), 'utf8'));
  const evidenceAfter = JSON.parse(readFileSync(join(temp, 'evidence-after.json'), 'utf8'));
  const patch = readFileSync(join(temp, 'hardening.patch'), 'utf8');
  const codes = new Set(before.findings.map((finding) => finding.code));
  for (const required of [
    'robots-blocks-search-crawler', 'sensitive-file-exposed', 'source-map-exposed', 'soft-404-catchall',
  ]) {
    if (!codes.has(required)) throw new Error(`demo report is missing ${required}`);
  }

  const beforeHigh = count(before, 'high');
  const beforeMedium = count(before, 'medium');
  const afterHigh = count(after, 'high');
  const afterMedium = count(after, 'medium');
  const fixed = evidenceAfter.summary.byBaseline.fixed;
  const patchLines = [
    normalizedPatchLine(patch, /^\+Allow: \/$/),
    normalizedPatchLine(patch, /^\+GET \/\.env\s+-> 404$/),
    normalizedPatchLine(patch, /^\+GET \/missing\s+-> 404$/),
  ];
  const frames = [
    frame('REAL FIXTURE DEMO', '$ WEBAPP-SECURITY DEMO', [
      { text: 'STARTING THE REPOSITORY DEMO PATH...', color: 1 },
      { text: 'AUDIT -> REVIEWABLE PATCH -> RETEST', color: 5 },
      { text: 'REPORTS ARE GENERATED, NOT TYPED BY HAND', color: 6 },
    ], { accent: 5, delay: 150 }),
    frame('AUDIT / BEFORE', `${beforeHigh} HIGH / ${beforeMedium} MEDIUM`, [
      { text: '[HIGH] ROBOTS BLOCK SEARCH CRAWLERS', color: 2 },
      { text: '[HIGH] /.ENV RETURNS 200', color: 2 },
      { text: '[MED] APP.JS.MAP IS PUBLIC', color: 4 },
      { text: '[MED] UNKNOWN ROUTE RETURNS 200', color: 4 },
    ], { accent: 2, delay: 220 }),
    frame('PATCH / REVIEW FIRST', 'MINIMUM FIXTURE HARDENING', [
      { text: patchLines[0], color: 3 },
      { text: patchLines[1], color: 3 },
      { text: patchLines[2], color: 3 },
      { text: 'NOT COUNTED AS FIXED UNTIL RETEST', color: 4 },
    ], { accent: 4, delay: 230 }),
    frame('RETEST / SAME PATH', `${afterHigh} HIGH / ${afterMedium} MEDIUM`, [
      { text: `${fixed} BASELINE FINDINGS FIXED`, color: 3 },
      { text: 'BEFORE.JSON + HARDENING.PATCH + AFTER.JSON', color: 1 },
      { text: 'EVIDENCE FAILURE NEVER BECOMES SAFE', color: 6 },
    ], { accent: 3, delay: 230 }),
    frame('SCOPE -> AUDIT -> PATCH -> RETEST', 'REPRODUCIBLE EVIDENCE', [
      { text: '$ NPM RUN DEMO -- --OUT ./DEMO-OUTPUT', color: 5 },
      { text: 'FIXED ONLY AFTER RETEST EVIDENCE', color: 3 },
      { text: 'READ DOCS/DEMO-EVIDENCE.MD', color: 1 },
    ], { accent: 5, delay: 260 }),
  ];
  const gif = encodeGif({ width: WIDTH, height: HEIGHT, frames });
  const digest = createHash('sha256').update(gif).digest('hex');
  const metadata = `${JSON.stringify({
    schemaVersion: 1,
    generator: 'scripts/generate-demo-gif.mjs',
    sources: ['scripts/demo.mjs', 'before.json', 'hardening.patch', 'after.json', 'evidence-after.json'],
    width: WIDTH,
    height: HEIGHT,
    frames: frames.length,
    durationMilliseconds: frames.reduce((sum, item) => sum + item.delay * 10, 0),
    bytes: gif.length,
    sha256: digest,
    result: { before: { high: beforeHigh, medium: beforeMedium }, after: { high: afterHigh, medium: afterMedium }, fixed },
    boundary: 'owned-local-fixture-no-third-party-target',
  }, null, 2)}\n`;

  if (process.argv.includes('--check')) {
    if (!existsSync(OUTPUT) || !readFileSync(OUTPUT).equals(gif)) {
      throw new Error('demo GIF is stale; run node scripts/generate-demo-gif.mjs');
    }
    if (!existsSync(METADATA) || readFileSync(METADATA, 'utf8') !== metadata) {
      throw new Error('demo GIF metadata is stale; run node scripts/generate-demo-gif.mjs');
    }
    console.log(`demo GIF current: ${frames.length} frames, ${gif.length} bytes, sha256 ${digest}`);
  } else {
    mkdirSync(join(ROOT, 'docs', 'assets'), { recursive: true });
    writeFileSync(OUTPUT, gif);
    writeFileSync(METADATA, metadata);
    console.log(`${OUTPUT}\n${METADATA}\n${gif.length} bytes\nsha256 ${digest}`);
  }
} finally {
  rmSync(temp, { recursive: true, force: true });
}
