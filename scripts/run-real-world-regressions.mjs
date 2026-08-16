#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  renderRealWorldRegressionMarkdown, runRealWorldRegressionCorpus,
  validateRealWorldRegressionCorpus,
} from './lib/real-world-regressions.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const JSON_OUTPUT = join(ROOT, 'docs', 'regressions', 'v0.5.4-real-world-regressions.json');
const MARKDOWN_OUTPUT = join(ROOT, 'docs', 'regressions', 'v0.5.4-real-world-regressions.md');
const check = process.argv.includes('--check');
if (process.argv.slice(2).some((argument) => argument !== '--check')) {
  console.error('usage: node scripts/run-real-world-regressions.mjs [--check]');
  process.exit(2);
}

const corpus = runRealWorldRegressionCorpus(ROOT);
const errors = validateRealWorldRegressionCorpus(corpus);
if (errors.length) {
  console.error(`real-world regression corpus failed:\n${errors.map((error) => `- ${error}`).join('\n')}`);
  process.exit(1);
}
const outputs = [
  [JSON_OUTPUT, `${JSON.stringify(corpus, null, 2)}\n`],
  [MARKDOWN_OUTPUT, renderRealWorldRegressionMarkdown(corpus)],
];
if (check) {
  const stale = outputs.filter(([path, content]) => !existsSync(path) || readFileSync(path, 'utf8') !== content);
  if (stale.length) {
    console.error('real-world regression corpus is stale; run npm run regressions:real-world');
    process.exit(1);
  }
  console.log('real-world regression corpus current: 4 resolved regressions + 1 expected benign match');
} else {
  mkdirSync(join(ROOT, 'docs', 'regressions'), { recursive: true });
  for (const [path, content] of outputs) writeFileSync(path, content);
  console.log(`${JSON_OUTPUT}\n${MARKDOWN_OUTPUT}`);
}
