#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildGroundTruthBenchmark, collectBuiltInObservations, renderGroundTruthMarkdown,
  validateGroundTruthBenchmark,
} from './lib/ground-truth-benchmark.mjs';
import { readStableRuleCorpus, validateStableRuleCorpus } from './lib/rule-corpus.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const JSON_OUTPUT = join(ROOT, 'docs', 'benchmarks', 'v0.5.3-ground-truth.json');
const MARKDOWN_OUTPUT = join(ROOT, 'docs', 'benchmarks', 'v0.5.3-ground-truth.md');
const check = process.argv.includes('--check');
if (process.argv.slice(2).some((argument) => argument !== '--check')) {
  console.error('usage: node scripts/run-ground-truth-benchmark.mjs [--check]');
  process.exit(2);
}

const corpus = readStableRuleCorpus(join(ROOT, 'docs', 'stable-rule-corpus.json'));
const corpusErrors = validateStableRuleCorpus(corpus, undefined, { root: ROOT });
if (corpusErrors.length) {
  console.error(`stable rule corpus is invalid:\n${corpusErrors.map((error) => `- ${error}`).join('\n')}`);
  process.exit(1);
}
const benchmark = buildGroundTruthBenchmark(corpus, collectBuiltInObservations(ROOT));
const errors = validateGroundTruthBenchmark(benchmark);
if (errors.length) {
  console.error(`ground-truth benchmark failed:\n${errors.map((error) => `- ${error}`).join('\n')}`);
  process.exit(1);
}
const outputs = [
  [JSON_OUTPUT, `${JSON.stringify(benchmark, null, 2)}\n`],
  [MARKDOWN_OUTPUT, renderGroundTruthMarkdown(benchmark)],
];
if (check) {
  const stale = outputs.filter(([path, content]) => !existsSync(path) || readFileSync(path, 'utf8') !== content);
  if (stale.length) {
    console.error('ground-truth benchmark is stale; run npm run benchmark:ground-truth');
    process.exit(1);
  }
  console.log('ground-truth benchmark current: 20 risk + 2 evidence-integrity pattern contracts');
} else {
  for (const [path, content] of outputs) writeFileSync(path, content);
  console.log(`${JSON_OUTPUT}\n${MARKDOWN_OUTPUT}`);
}

