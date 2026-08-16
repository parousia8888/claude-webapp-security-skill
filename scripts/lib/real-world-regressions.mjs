import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  compareFindingsV3, createReportV3, initializeFindingsV3, renderHtmlV3, renderMarkdownV3,
  sourceFindingV3,
} from './evidence-v3.mjs';
import { inspectJsTsSource } from './js-ts-source-audit.mjs';
import { sha256 } from './report-v2-contract.mjs';
import { auditSource } from './source-audit.mjs';
import { sourceCoverage, sourceRuleset } from './source-rules.mjs';

const LIMITATION = 'Minimized cases derived from observed project failures and review noise; they prove only that the named historical conditions remain guarded. They are not a representative vulnerability benchmark or a production precision/recall measurement.';
const REGRESSION_SOURCE = 'docs/adoption/regressions.json';

function requireCondition(condition, message) {
  if (!condition) throw new Error(message);
}

function write(path, content) {
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, content);
}

function withFixture(name, callback) {
  const root = mkdtempSync(join(tmpdir(), `web-app-security-real-regression-${name}-`));
  try {
    return callback(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function sourceReport(audit, mode = 'audit') {
  const ruleset = sourceRuleset();
  const coverage = sourceCoverage(audit);
  const findings = audit.findings.map((finding) => sourceFindingV3(finding, ruleset));
  return createReportV3({
    version: '0.5.4',
    generatedAt: '1970-01-01T00:00:00.000Z',
    mode,
    subject: {
      id: 'project-real-regression-fixture',
      binding: 'persisted',
      scopeDigest: sha256('v0.5.4-real-world-regression-corpus'),
      localPathIncluded: false,
    },
    ruleset,
    scope: { checkModes: ['source'], networkAccessPerformed: false },
    coverage,
    findings: initializeFindingsV3(findings, coverage),
    limitations: ['Minimized regression fixture only.'],
  });
}

function reportSummaryCase() {
  return withFixture('report-summary', (root) => {
    write(join(root, 'package.json'), '{"private":true}\n');
    write(join(root, 'package-lock.json'), '{"lockfileVersion":3}\n');
    write(join(root, 'src', 'app.js'), 'document.body.innerHTML = userInput;\n');
    const report = sourceReport(auditSource(root));
    const markdown = renderMarkdownV3(report);
    const html = renderHtmlV3(report);
    requireCondition(report.summary.total === 1, 'report fixture must retain one risk finding');
    requireCondition(/security_exposure: total=1; suspected=1 \(medium=1\)/.test(markdown),
      'Markdown risk summary must contain numeric state/severity counts');
    requireCondition(/security_exposure: total=1; suspected=1 \(medium=1\)/.test(html),
      'HTML risk summary must contain numeric state/severity counts');
    requireCondition(!markdown.includes('[object Object]') && !html.includes('[object Object]'),
      'human-readable reports must not coerce state objects to strings');
    return {
      findingCount: report.summary.total,
      markdownNumericSummary: true,
      htmlNumericSummary: true,
      objectCoercionObserved: false,
    };
  });
}

function pnpmWorkspaceCase() {
  return withFixture('pnpm-workspace', (root) => {
    write(join(root, 'package.json'), '{"private":true}\n');
    write(join(root, 'pnpm-lock.yaml'), 'lockfileVersion: 9\n');
    write(join(root, 'pnpm-workspace.yaml'), "packages:\n  - 'apps/*'\n");
    write(join(root, 'apps', 'web', 'package.json'), '{"private":true}\n');
    write(join(root, 'tools', 'outside', 'package.json'), '{"private":true}\n');
    const audit = auditSource(root);
    const missing = audit.findings.filter((finding) => finding.ruleId === 'dependency-lockfile-missing');
    requireCondition(missing.length === 1, 'only the package outside the pnpm workspace may lack a lockfile');
    requireCondition(missing[0].location?.path === 'tools/outside/package.json',
      'the covered apps/web package must inherit the root pnpm lockfile');
    requireCondition(missing[0].state === 'confirmed',
      'the out-of-scope package absence must remain a confirmed file-layout fact');
    return {
      coveredPackage: 'apps/web/package.json',
      coveredPackageFindingCount: 0,
      outsidePackage: missing[0].location.path,
      outsidePackageState: missing[0].state,
    };
  });
}

function nestedTemplateCase() {
  return withFixture('nested-template', (root) => {
    write(join(root, 'package.json'), '{"private":true}\n');
    write(join(root, 'package-lock.json'), '{"lockfileVersion":3}\n');
    write(join(root, 'src', 'server.ts'), 'const html = `${`</b>`}</div>`;\n');
    const audit = auditSource(root);
    const browserCoverage = audit.coverage['browser-html-injection-sink'];
    requireCondition(browserCoverage?.status === 'completed',
      'nested template source must retain completed browser-sink coverage');
    requireCondition(!audit.findings.some((finding) => finding.ruleId === 'source-evidence-incomplete'),
      'nested template source must not create an incomplete-evidence finding');
    return {
      sourcePath: 'src/server.ts',
      browserSinkCoverage: browserCoverage.status,
      incompleteEvidenceFindingCount: 0,
    };
  });
}

function movedConditionCase() {
  return withFixture('moved-condition', (root) => {
    const baselineRoot = join(root, 'baseline');
    const currentRoot = join(root, 'current');
    for (const project of [baselineRoot, currentRoot]) {
      write(join(project, 'package.json'), '{"private":true}\n');
      write(join(project, 'package-lock.json'), '{"lockfileVersion":3}\n');
    }
    write(join(baselineRoot, 'src', 'old.js'), 'document.body.innerHTML = userInput;\n');
    write(join(currentRoot, 'src', 'renamed.js'), 'document.body.innerHTML = userInput;\n');
    const baselineAudit = auditSource(baselineRoot);
    const currentAudit = auditSource(currentRoot);
    const baselineReport = sourceReport(baselineAudit);
    const ruleset = sourceRuleset();
    const currentCoverage = sourceCoverage(currentAudit);
    const currentFindings = currentAudit.findings.map((finding) => sourceFindingV3(finding, ruleset));
    const compared = compareFindingsV3(currentFindings, currentCoverage, baselineReport, ruleset);
    requireCondition(compared.length === 1, 'the path-equivalent condition must remain one finding');
    requireCondition(compared[0].baseline.state === 'unchanged',
      'a path-only equivalent condition must not be reported fixed');
    requireCondition(compared[0].baseline.reasonCode === 'condition_moved',
      'the path-equivalent condition must retain the bounded movement reason');
    return {
      priorPath: 'src/old.js',
      currentPath: 'src/renamed.js',
      baselineState: compared[0].baseline.state,
      reasonCode: compared[0].baseline.reasonCode,
      fixedCount: compared.filter((finding) => finding.baseline.state === 'fixed').length,
      newCount: compared.filter((finding) => finding.baseline.state === 'new').length,
    };
  });
}

function numericSvgReviewCase() {
  const source = [
    'const bounded = Math.max(0, Math.min(100, Number(percent)));',
    'chart.innerHTML = `<svg><rect width="${bounded}" height="10"></rect></svg>`;',
    '',
  ].join('\n');
  const inspected = inspectJsTsSource('src/charts.ts', source);
  requireCondition(!inspected.error, 'the numeric SVG fixture must remain parseable');
  const matches = inspected.findings.filter((finding) => finding.ruleId === 'browser-html-injection-sink');
  requireCondition(matches.length === 1, 'the intentional innerHTML boundary must remain review-visible');
  requireCondition(matches[0].state === 'suspected',
    'the bounded source rule must not promote a context-dependent DOM sink to confirmed');
  return {
    sourcePath: 'src/charts.ts',
    ruleId: matches[0].ruleId,
    evidenceState: matches[0].state,
    manualClassification: 'expected_benign_match',
    requiredClosure: 'Confirm that every interpolated value remains numeric and no untrusted markup reaches the sink.',
    suppressionApplied: false,
  };
}

const DEFINITIONS = [
  {
    id: 'v3-summary-object-coercion',
    classification: 'resolved_regression',
    protectedContract: 'Markdown and HTML risk summaries render numeric state and severity totals.',
    run: reportSummaryCase,
  },
  {
    id: 'pnpm-workspace-lockfile-evidence',
    classification: 'resolved_regression',
    protectedContract: 'A covered pnpm package inherits its workspace lockfile; only proven uncovered manifests may be confirmed.',
    run: pnpmWorkspaceCase,
  },
  {
    id: 'nested-template-coverage',
    classification: 'resolved_regression',
    protectedContract: 'Nested template literals do not silently remove normal JS/TS source-rule coverage.',
    run: nestedTemplateCase,
  },
  {
    id: 'path-rename-retest',
    classification: 'resolved_regression',
    protectedContract: 'A unique path-equivalent condition remains unresolved instead of becoming fixed plus new.',
    run: movedConditionCase,
  },
  {
    id: 'numeric-svg-innerhtml-review',
    classification: 'expected_benign_match',
    protectedContract: 'Context-dependent DOM sinks stay visible for human closure and are not silently suppressed.',
    source: {
      kind: 'external_review_minimized',
      reference: 'KNOWN_LIMITATIONS.md#recurring-expected-matches',
      note: 'Minimized from an external real-project review; original project content is not included.',
    },
    remainingBoundary: 'This fixture is benign only because its constructed values are numeric. The detector does not trace arbitrary input or prove other innerHTML assignments safe.',
    run: numericSvgReviewCase,
  },
];

export function runRealWorldRegressionCorpus(root) {
  const history = JSON.parse(readFileSync(join(root, REGRESSION_SOURCE), 'utf8'));
  const historical = new Map(history.cases.map((item) => [item.id, item]));
  const cases = DEFINITIONS.map((definition) => {
    const sourceCase = historical.get(definition.id);
    if (definition.classification === 'resolved_regression') {
      requireCondition(sourceCase, `historical regression source is missing ${definition.id}`);
    }
    let status = 'passed';
    let evidence;
    try {
      evidence = definition.run();
    } catch (error) {
      status = 'failed';
      evidence = { error: error instanceof Error ? error.message : String(error) };
    }
    return {
      id: definition.id,
      title: sourceCase?.title || 'Numeric SVG innerHTML remains a review-visible expected match',
      classification: definition.classification,
      source: definition.source || {
        kind: 'historical_regression',
        reference: `${REGRESSION_SOURCE}#${definition.id}`,
        fixedVersion: history.fixedVersion,
        fixCommit: history.fixCommit,
      },
      observedFailure: sourceCase?.reproduction
        || 'A numeric-only SVG string assembled with innerHTML matched the intentionally broad DOM-sink rule.',
      protectedContract: definition.protectedContract,
      status,
      evidence,
      remainingBoundary: definition.remainingBoundary || sourceCase.remainingBoundary,
    };
  });
  return {
    schemaVersion: 1,
    release: 'v0.5.4',
    evidenceType: 'historical_real_world_regression_corpus',
    limitation: LIMITATION,
    sourceInventory: REGRESSION_SOURCE,
    summary: {
      cases: cases.length,
      passed: cases.filter((item) => item.status === 'passed').length,
      failed: cases.filter((item) => item.status === 'failed').length,
      resolvedRegressions: cases.filter((item) => item.classification === 'resolved_regression').length,
      expectedBenignMatches: cases.filter((item) => item.classification === 'expected_benign_match').length,
    },
    cases,
  };
}

export function validateRealWorldRegressionCorpus(corpus) {
  const errors = [];
  if (corpus?.schemaVersion !== 1) errors.push('corpus.schemaVersion must be 1');
  if (corpus?.evidenceType !== 'historical_real_world_regression_corpus') {
    errors.push('corpus evidence type is invalid');
  }
  if (corpus?.limitation !== LIMITATION) errors.push('corpus limitation is missing or changed');
  if (corpus?.summary?.cases !== 5) errors.push('corpus must contain five declared cases');
  if (corpus?.summary?.resolvedRegressions !== 4) errors.push('corpus must contain four resolved regressions');
  if (corpus?.summary?.expectedBenignMatches !== 1) errors.push('corpus must contain one expected benign match');
  for (const item of corpus?.cases || []) {
    if (item.status !== 'passed') errors.push(`${item.id} regression guard failed`);
    if (!item.source?.reference || !item.protectedContract || !item.remainingBoundary) {
      errors.push(`${item.id} provenance or boundary is incomplete`);
    }
  }
  const benign = (corpus?.cases || []).find((item) => item.id === 'numeric-svg-innerhtml-review');
  if (benign?.evidence?.manualClassification !== 'expected_benign_match'
      || benign?.evidence?.suppressionApplied !== false) {
    errors.push('numeric SVG case must remain a visible expected benign match without suppression');
  }
  return [...new Set(errors)];
}

export function renderRealWorldRegressionMarkdown(corpus) {
  const lines = [
    '# v0.5.4 historical real-world regression corpus', '',
    `> ${corpus.limitation}`, '',
    '## Results', '',
    '| Cases | Passed | Failed | Resolved regressions | Expected benign matches |',
    '|---:|---:|---:|---:|---:|',
    `| ${corpus.summary.cases} | ${corpus.summary.passed} | ${corpus.summary.failed} | ${corpus.summary.resolvedRegressions} | ${corpus.summary.expectedBenignMatches} |`,
    '',
    '## Cases', '',
    '| Case | Classification | Guard | Result |',
    '|---|---|---|---:|',
    ...corpus.cases.map((item) => `| \`${item.id}\` | \`${item.classification}\` | ${item.protectedContract} | ${item.status} |`),
    '',
    '## Evidence boundaries', '',
  ];
  for (const item of corpus.cases) {
    lines.push(
      `### ${item.title}`, '',
      `- Case: \`${item.id}\``,
      `- Source: \`${item.source.kind}\`; \`${item.source.reference}\``,
      `- Observed failure: ${item.observedFailure}`,
      `- Current evidence: \`${JSON.stringify(item.evidence)}\``,
      `- Remaining boundary: ${item.remainingBoundary}`, '',
    );
  }
  lines.push(
    'Regenerate with `npm run regressions:real-world`. CI uses the same runner with `--check` to',
    'compare committed JSON and Markdown bytes.', '',
  );
  return `${lines.join('\n')}\n`;
}
