#!/usr/bin/env node
import assert from 'node:assert/strict';
import {
  createFindingV2, createReportV2, exitCodeV2, initializeFindingsV2,
  renderHtmlV2, renderJunitV2, renderMarkdownV2, renderSarifV2, validateRuntimeReportV2,
} from '../scripts/lib/evidence-v2.mjs';
import { sha256 } from '../scripts/lib/report-v2-contract.mjs';
import { createRulesetV2 } from '../scripts/lib/ruleset-v2.mjs';

const ADAPTER = { id: 'fixture-surface', version: '1.0.0', maturity: 'stable' };
const RULES = [
  { id: 'confirmed-exposure', revision: '1', domain: 'security_exposure' },
  { id: 'evidence-unavailable', revision: '1', domain: 'evidence_integrity' },
];
const ruleset = createRulesetV2([{ ...ADAPTER, rules: RULES }]);

function coverage(rule, status = 'completed') {
  const complete = status === 'completed';
  return {
    id: `fixture-${rule.id}`,
    adapterId: ADAPTER.id,
    ruleId: rule.id,
    ruleRevision: rule.revision,
    status,
    counts: {
      discovered: 1,
      eligible: 1,
      scanned: complete ? 1 : 0,
      excluded: 0,
      skipped: 0,
      truncated: 0,
      errors: complete ? 0 : 1,
    },
    reasons: complete ? [] : [{ code: 'fixture_unavailable', count: 1, samplePaths: [] }],
  };
}

function finding(rule, state, severity) {
  return createFindingV2({
    ruleset,
    adapterId: ADAPTER.id,
    rule,
    title: `${rule.id} fixture`,
    severity,
    state,
    summary: `Observed ${rule.id} in the controlled fixture.`,
    evidence: { subject: rule.id, observed: state },
    remediation: 'Apply the fixture remediation.',
    retest: 'Repeat the same fixture check.',
  });
}

function report(findings, ledger) {
  return createReportV2({
    version: '0.4.0-planned',
    generatedAt: '1970-01-01T00:00:00.000Z',
    mode: 'audit',
    subject: {
      id: 'project-0123456789abcdef', binding: 'ephemeral',
      scopeDigest: sha256('fixture-scope'), localPathIncluded: false,
    },
    ruleset,
    scope: { checkModes: ['fixture'], networkAccessPerformed: false },
    coverage: ledger,
    findings: initializeFindingsV2(findings, ledger),
    limitations: ['Controlled contract fixture only.'],
  });
}

const confirmed = finding(RULES[0], 'confirmed', 'high');
const unknown = finding(RULES[1], 'unknown', 'high');
const both = report([confirmed, unknown], [coverage(RULES[0]), coverage(RULES[1], 'unavailable')]);
assert.deepEqual(validateRuntimeReportV2(both), []);
assert.equal(exitCodeV2(both), 1, 'a confirmed policy breach must take precedence over unrelated unknown evidence');

const unknownOnly = report([unknown], [coverage(RULES[0]), coverage(RULES[1], 'unavailable')]);
assert.equal(exitCodeV2(unknownOnly), 3, 'unknown evidence without a policy breach must return 3');

const complete = report([], [coverage(RULES[0]), coverage(RULES[1])]);
assert.equal(exitCodeV2(complete), 0, 'complete coverage without a threshold finding must return 0');

const partial = report([], [coverage(RULES[0]), coverage(RULES[1], 'partial')]);
assert.equal(exitCodeV2(partial), 3, 'partial coverage is explicit incomplete evidence');

const expected = ['security_exposure', 'confirmed', 'new'];
const rendered = [
  JSON.stringify(both),
  renderMarkdownV2(both),
  renderHtmlV2(both),
  renderSarifV2(both),
  renderJunitV2(both),
];
for (const [index, output] of rendered.entries()) {
  for (const value of expected) assert.ok(output.includes(value), `renderer ${index} dropped ${value}`);
}

assert.throws(() => createReportV2({
  ...both,
  coverage: [{ ...both.coverage[0], adapterId: 'missing-adapter' }],
  findings: [],
}), /coverage references absent adapter|ruleset digest is invalid/);

console.log('unified v2 runtime ok: policy precedence, incomplete evidence and renderer semantics');
