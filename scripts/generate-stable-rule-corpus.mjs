#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stableRuleCorpus, validateStableRuleCorpus } from './lib/rule-corpus.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUTPUT = join(ROOT, 'docs', 'stable-rule-corpus.json');
const check = process.argv.includes('--check');
if (process.argv.slice(2).some((argument) => argument !== '--check')) {
  console.error('usage: node scripts/generate-stable-rule-corpus.mjs [--check]');
  process.exit(2);
}

const corpus = stableRuleCorpus();
const errors = validateStableRuleCorpus(corpus, undefined, { root: ROOT });
if (errors.length) {
  console.error(`stable rule corpus is invalid:\n${errors.map((error) => `- ${error}`).join('\n')}`);
  process.exit(1);
}
const rendered = `${JSON.stringify(corpus, null, 2)}\n`;
if (check) {
  if (!existsSync(OUTPUT) || readFileSync(OUTPUT, 'utf8') !== rendered) {
    console.error('stable rule corpus is stale; run node scripts/generate-stable-rule-corpus.mjs');
    process.exit(1);
  }
  console.log(`stable rule corpus current: ${corpus.rules.length} rules with positive, negative and explanation labels`);
} else {
  writeFileSync(OUTPUT, rendered);
  console.log(OUTPUT);
}
