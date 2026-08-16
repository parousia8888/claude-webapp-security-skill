import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { auditSource } from './source-audit.mjs';
import { inspectJsTsSource } from './js-ts-source-audit.mjs';
import { inspectPythonSource } from './python-source-audit.mjs';

const CAVEAT = 'Synthetic planted pattern-contract benchmark; it does not measure production-vulnerability precision, recall, reachability or exploitability.';

export function collectBuiltInObservations(root) {
  const positive = new Map();
  const addPositive = (findings) => {
    for (const finding of findings) {
      const states = positive.get(finding.ruleId) || [];
      states.push(finding.state);
      positive.set(finding.ruleId, states);
    }
  };
  addPositive(inspectJsTsSource('src/vulnerable.tsx', readFileSync(
    join(root, 'test', 'fixtures', 'js-ts-rules', 'vulnerable.tsx'), 'utf8')).findings);
  addPositive(inspectPythonSource('src/vulnerable.py', readFileSync(
    join(root, 'test', 'fixtures', 'python-rules', 'vulnerable.py'), 'utf8')).findings);
  addPositive(auditSource(join(root, 'test', 'fixtures', 'audit-app')).findings);

  const temporary = mkdtempSync(join(tmpdir(), 'web-app-security-ground-truth-'));
  try {
    const incomplete = join(temporary, 'incomplete');
    mkdirSync(join(incomplete, 'src'), { recursive: true });
    writeFileSync(join(incomplete, 'package.json'), '{"private":true}\n');
    writeFileSync(join(incomplete, 'package-lock.json'), '{"lockfileVersion":3}\n');
    writeFileSync(join(incomplete, 'src', 'broken.ts'), 'const value = "unterminated');
    addPositive(auditSource(incomplete).findings);
    const unsupported = join(temporary, 'unsupported');
    mkdirSync(unsupported);
    writeFileSync(join(unsupported, 'README.txt'), 'no supported manifest\n');
    addPositive(auditSource(unsupported).findings);
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }

  const negativeFindings = [
    ...inspectJsTsSource('src/safe.tsx', readFileSync(
      join(root, 'test', 'fixtures', 'js-ts-rules', 'safe.tsx'), 'utf8')).findings,
    ...inspectPythonSource('src/safe.py', readFileSync(
      join(root, 'test', 'fixtures', 'python-rules', 'safe.py'), 'utf8')).findings,
    ...auditSource(join(root, 'test', 'fixtures', 'next-app')).findings,
  ];
  return [...positive.keys()].map((ruleId) => ({
    ruleId,
    positiveFindingCount: positive.get(ruleId).length,
    positiveStates: [...new Set(positive.get(ruleId))].sort(),
    negativeFindingCount: negativeFindings.filter((finding) => finding.ruleId === ruleId).length,
  }));
}

function metrics(results) {
  const expectedPositiveCases = results.length;
  const truePositive = results.filter((item) => item.positive.passed).length;
  const falsePositive = results.filter((item) => !item.negative.passed).length;
  return {
    expectedPositiveCases,
    truePositive,
    falseNegative: expectedPositiveCases - truePositive,
    expectedNegativeCases: results.length,
    trueNegative: results.length - falsePositive,
    falsePositive,
    stateMismatches: results.filter((item) => item.positive.findingCount > 0
      && !item.positive.stateMatched).length,
  };
}

export function buildGroundTruthBenchmark(corpus, observations) {
  const observed = new Map(observations.map((item) => [item.ruleId, item]));
  const rules = corpus.rules.filter((rule) => rule.adapterType === 'built_in').map((rule) => {
    const item = observed.get(rule.ruleId) || {
      positiveFindingCount: 0, positiveStates: [], negativeFindingCount: 0,
    };
    const stateMatched = item.positiveStates.length === 1
      && item.positiveStates[0] === rule.expectedPositiveState;
    return {
      ruleId: rule.ruleId,
      kind: rule.kind,
      family: rule.family,
      positive: {
        fixtureIds: rule.positiveFixtures.map((fixture) => fixture.id),
        expectedState: rule.expectedPositiveState,
        observedStates: item.positiveStates,
        findingCount: item.positiveFindingCount,
        stateMatched,
        passed: item.positiveFindingCount > 0 && stateMatched,
      },
      negative: {
        fixtureIds: rule.negativeFixtures.map((fixture) => fixture.id),
        findingCount: item.negativeFindingCount,
        passed: item.negativeFindingCount === 0,
      },
    };
  });
  const risk = rules.filter((rule) => rule.kind === 'risk_detection');
  const integrity = rules.filter((rule) => rule.kind === 'evidence_integrity');
  return {
    schemaVersion: 1,
    release: 'v0.5.3',
    benchmarkType: 'synthetic_planted_pattern_contract',
    caveat: CAVEAT,
    rulesetSemanticDigest: corpus.rulesetSemanticDigest,
    metrics: {
      risk: metrics(risk),
      evidenceIntegrity: metrics(integrity),
      combined: metrics(rules),
    },
    rules,
  };
}

export function validateGroundTruthBenchmark(benchmark) {
  const errors = [];
  if (benchmark?.schemaVersion !== 1) errors.push('benchmark.schemaVersion must be 1');
  if (benchmark?.benchmarkType !== 'synthetic_planted_pattern_contract') errors.push('benchmark type is invalid');
  if (benchmark?.caveat !== CAVEAT) errors.push('benchmark caveat is missing or changed');
  for (const result of benchmark?.rules || []) {
    if (!result.positive.passed) errors.push(`${result.ruleId} planted positive failed`);
    if (!result.negative.passed) errors.push(`${result.ruleId} planted negative produced a finding`);
  }
  for (const [group, expected] of [['risk', 20], ['evidenceIntegrity', 2], ['combined', 22]]) {
    const value = benchmark?.metrics?.[group];
    if (value?.expectedPositiveCases !== expected || value?.expectedNegativeCases !== expected) {
      errors.push(`${group} case count differs from the 20 risk + 2 integrity contract`);
    }
  }
  return [...new Set(errors)];
}

function metricLine(label, value) {
  return `| ${label} | ${value.expectedPositiveCases} | ${value.truePositive} | ${value.falseNegative} | ${value.expectedNegativeCases} | ${value.trueNegative} | ${value.falsePositive} | ${value.stateMismatches} |`;
}

export function renderGroundTruthMarkdown(benchmark) {
  const lines = [
    '# v0.5.3 ground-truth pattern benchmark', '',
    `> ${benchmark.caveat}`, '',
    `Ruleset semantic digest: \`${benchmark.rulesetSemanticDigest}\``, '',
    '## Results', '',
    '| Group | Positive cases | TP | FN | Negative cases | TN | FP | State mismatches |',
    '|---|---:|---:|---:|---:|---:|---:|---:|',
    metricLine('Risk detection', benchmark.metrics.risk),
    metricLine('Evidence integrity', benchmark.metrics.evidenceIntegrity),
    metricLine('Combined', benchmark.metrics.combined), '',
    'TP means the planted positive emitted the named rule in its expected evidence state. FP means',
    'the same rule emitted on its planted safe neighbour. These fixture results do not establish',
    'production vulnerability precision or recall.', '',
    '## Rule cases', '',
    '| Rule | Kind | Expected state | Positive | Negative |',
    '|---|---|---|---:|---:|',
    ...benchmark.rules.map((rule) => `| \`${rule.ruleId}\` | ${rule.kind} | \`${rule.positive.expectedState}\` | ${rule.positive.passed ? 'pass' : 'fail'} | ${rule.negative.passed ? 'pass' : 'fail'} |`),
    '',
    'Regenerate with `npm run benchmark:ground-truth`. CI uses the same runner with `--check` to',
    'compare committed JSON and Markdown bytes.', '',
  ];
  return `${lines.join('\n')}\n`;
}

