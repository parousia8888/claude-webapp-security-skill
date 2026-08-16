#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildGroundTruthBenchmark, collectBuiltInObservations, renderGroundTruthMarkdown,
  validateGroundTruthBenchmark,
} from '../scripts/lib/ground-truth-benchmark.mjs';
import { readStableRuleCorpus } from '../scripts/lib/rule-corpus.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const corpus = readStableRuleCorpus(join(ROOT, 'docs', 'stable-rule-corpus.json'));
const observations = collectBuiltInObservations(ROOT);
const benchmark = buildGroundTruthBenchmark(corpus, observations);
assert.deepEqual(validateGroundTruthBenchmark(benchmark), []);
assert.deepEqual(benchmark.metrics.risk, {
  expectedPositiveCases: 20, truePositive: 20, falseNegative: 0,
  expectedNegativeCases: 20, trueNegative: 20, falsePositive: 0, stateMismatches: 0,
});
assert.equal(benchmark.metrics.evidenceIntegrity.truePositive, 2);
assert.equal(benchmark.metrics.evidenceIntegrity.falsePositive, 0);

const missingPositive = buildGroundTruthBenchmark(corpus, observations.slice(1));
assert.equal(missingPositive.metrics.combined.falseNegative, 1);
assert.match(validateGroundTruthBenchmark(missingPositive).join('; '), /planted positive failed/);
const unexpectedNegative = structuredClone(observations);
unexpectedNegative[0].negativeFindingCount = 1;
const falsePositive = buildGroundTruthBenchmark(corpus, unexpectedNegative);
assert.equal(falsePositive.metrics.combined.falsePositive, 1);
assert.match(validateGroundTruthBenchmark(falsePositive).join('; '), /planted negative produced a finding/);

assert.equal(readFileSync(join(ROOT, 'docs', 'benchmarks', 'v0.5.3-ground-truth.json'), 'utf8'),
  `${JSON.stringify(benchmark, null, 2)}\n`);
assert.equal(readFileSync(join(ROOT, 'docs', 'benchmarks', 'v0.5.3-ground-truth.md'), 'utf8'),
  renderGroundTruthMarkdown(benchmark));
console.log('ground-truth benchmark ok: 22 contracts, committed bytes and planted TP/FP gate failures');

