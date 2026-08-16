#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCanvas, drawText, encodePng, fillRect } from './lib/deterministic-gif.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUTPUT = join(ROOT, 'docs', 'assets', 'social-preview.png');
const METADATA = join(ROOT, 'docs', 'assets', 'social-preview.json');
const WIDTH = 1280;
const HEIGHT = 640;
const releaseState = JSON.parse(readFileSync(join(ROOT, 'docs', 'release-state.json'), 'utf8'));
const version = releaseState.publishedRelease.version;
const command = `npx --yes web-app-security-skill@${version} audit . --fail-on never`;

const canvas = createCanvas(WIDTH, HEIGHT);
fillRect(canvas, 0, 0, WIDTH, 14, 5);
fillRect(canvas, 0, 14, WIDTH, 4, 3);
drawText(canvas, 'WEB APP SECURITY SKILL', 64, 62, { color: 1, scale: 5 });
drawText(canvas, 'LOCAL WEB SECURITY REVIEW FOR AI CODING WORKFLOWS', 68, 130, { color: 6, scale: 2 });
fillRect(canvas, 64, 188, WIDTH - 128, 4, 7);

fillRect(canvas, 64, 226, WIDTH - 128, 164, 7);
fillRect(canvas, 64, 226, 10, 164, 5);
drawText(canvas, 'TRY IT ON YOUR PROJECT', 96, 250, { color: 6, scale: 2 });
drawText(canvas, `$ NPX --YES WEB-APP-SECURITY-SKILL@${version}`, 96, 294, { color: 5, scale: 3 });
drawText(canvas, '  AUDIT . --FAIL-ON NEVER', 96, 340, { color: 1, scale: 3 });

drawText(canvas, 'FIND  >  EXPLAIN  >  HARDEN  >  RETEST', 64, 456, { color: 3, scale: 3 });
drawText(canvas, 'LOCAL SOURCE / REVIEWABLE EVIDENCE / NO AUTO-EDIT', 68, 548, { color: 6, scale: 2 });
fillRect(canvas, 64, 590, 160, 6, 5);
fillRect(canvas, 232, 590, 80, 6, 4);
fillRect(canvas, 320, 590, 80, 6, 3);

const png = encodePng(canvas);
const digest = createHash('sha256').update(png).digest('hex');
const metadata = `${JSON.stringify({
  schemaVersion: 1,
  generator: 'scripts/generate-social-preview.mjs',
  sources: ['docs/release-state.json', 'docs/github-metadata.json'],
  width: WIDTH,
  height: HEIGHT,
  bytes: png.length,
  sha256: digest,
  version,
  command,
  boundary: 'repository-owned-deterministic-public-metadata',
  liveUpload: 'external_validation_pending',
}, null, 2)}\n`;

if (process.argv.includes('--check')) {
  if (!existsSync(OUTPUT) || !readFileSync(OUTPUT).equals(png)) {
    throw new Error('social preview is stale; run node scripts/generate-social-preview.mjs');
  }
  if (!existsSync(METADATA) || readFileSync(METADATA, 'utf8') !== metadata) {
    throw new Error('social preview metadata is stale; run node scripts/generate-social-preview.mjs');
  }
  console.log(`social preview current: ${WIDTH}x${HEIGHT}, ${png.length} bytes, sha256 ${digest}`);
} else {
  writeFileSync(OUTPUT, png);
  writeFileSync(METADATA, metadata);
  console.log(`${OUTPUT}\n${METADATA}\n${png.length} bytes\nsha256 ${digest}`);
}
