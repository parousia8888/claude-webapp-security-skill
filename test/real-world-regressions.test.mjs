#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  renderRealWorldRegressionMarkdown, runRealWorldRegressionCorpus,
  validateRealWorldRegressionCorpus,
} from '../scripts/lib/real-world-regressions.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const corpus = runRealWorldRegressionCorpus(ROOT);
assert.deepEqual(validateRealWorldRegressionCorpus(corpus), []);
assert.deepEqual(corpus.summary, {
  cases: 5,
  passed: 5,
  failed: 0,
  resolvedRegressions: 4,
  expectedBenignMatches: 1,
});
assert.deepEqual(corpus.cases.map((item) => item.id), [
  'v3-summary-object-coercion',
  'pnpm-workspace-lockfile-evidence',
  'nested-template-coverage',
  'path-rename-retest',
  'numeric-svg-innerhtml-review',
]);

const failed = structuredClone(corpus);
failed.cases[0].status = 'failed';
failed.summary.passed -= 1;
failed.summary.failed += 1;
assert.match(validateRealWorldRegressionCorpus(failed).join('; '), /regression guard failed/);
const suppressed = structuredClone(corpus);
suppressed.cases.at(-1).evidence.suppressionApplied = true;
assert.match(validateRealWorldRegressionCorpus(suppressed).join('; '), /without suppression/);

assert.equal(readFileSync(join(ROOT, 'docs', 'regressions', 'v0.5.4-real-world-regressions.json'), 'utf8'),
  `${JSON.stringify(corpus, null, 2)}\n`);
assert.equal(readFileSync(join(ROOT, 'docs', 'regressions', 'v0.5.4-real-world-regressions.md'), 'utf8'),
  renderRealWorldRegressionMarkdown(corpus));
console.log('real-world regressions ok: 4 historical failures and 1 review-visible benign match');
