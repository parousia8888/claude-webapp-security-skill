#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  V2_BASELINE_STATES, V2_DOMAINS, V2_RESULT_STATES, inspectV1MigrationInput, sha256,
  validateFindingV2, validateReportV2,
} from '../scripts/lib/report-v2-contract.mjs';
import { createFinding, createReport } from '../scripts/lib/evidence.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
for (const path of ['docs/finding-v2.schema.json', 'docs/report-v2.schema.json']) {
  assert.doesNotThrow(() => JSON.parse(readFileSync(join(ROOT, path), 'utf8')), `${path} must parse`);
}

const digest = sha256('v2-contract-fixture');
const finding = (overrides = {}) => ({
  schemaVersion: 2,
  id: 'fixture-rule-0123456789ab',
  fingerprint: digest,
  fingerprintVersion: 2,
  rule: { id: 'fixture-rule', revision: '1' },
  adapter: { id: 'fixture-adapter', version: '1.0.0', rulesetDigest: digest },
  domain: 'security_exposure',
  title: 'Fixture finding',
  severity: 'high',
  state: 'confirmed',
  summary: 'Fixture summary.',
  location: null,
  evidence: { observed: 'sanitized fixture' },
  remediation: 'Apply fixture remediation.',
  retest: 'Repeat the fixture check.',
  baseline: {
    state: 'new', priorFingerprint: null, compatibility: 'not_attempted',
    currentCheck: 'completed', coverageRef: 'coverage-fixture', reasonCode: null,
  },
  ...overrides,
});

for (const domain of V2_DOMAINS) assert.deepEqual(validateFindingV2(finding({ domain })), [], domain);
for (const state of V2_RESULT_STATES) assert.deepEqual(validateFindingV2(finding({ state })), [], state);
for (const state of V2_BASELINE_STATES) {
  const variants = {
    new: { state, priorFingerprint: null, compatibility: 'not_attempted', currentCheck: 'completed', coverageRef: 'coverage-fixture', reasonCode: null },
    unchanged: { state, priorFingerprint: digest, compatibility: 'compatible', currentCheck: 'completed', coverageRef: 'coverage-fixture', reasonCode: null },
    regressed: { state, priorFingerprint: digest, compatibility: 'compatible', currentCheck: 'completed', coverageRef: 'coverage-fixture', reasonCode: 'condition_returned' },
    fixed: { state, priorFingerprint: digest, compatibility: 'compatible', currentCheck: 'completed', coverageRef: 'coverage-fixture', reasonCode: 'condition_absent_after_completed_check' },
    unretested: { state, priorFingerprint: digest, compatibility: 'compatible', currentCheck: 'not_run', coverageRef: null, reasonCode: 'adapter_unavailable' },
    not_comparable: { state, priorFingerprint: digest, compatibility: 'not_comparable', currentCheck: 'not_run', coverageRef: null, reasonCode: 'rule_revision_incompatible' },
  };
  assert.deepEqual(validateFindingV2(finding({ baseline: variants[state] })), [], state);
}

for (const [label, baseline, expected] of [
  ['fixed without completed check', { state: 'fixed', priorFingerprint: digest, compatibility: 'compatible', currentCheck: 'not_run', coverageRef: null, reasonCode: 'condition_absent_after_completed_check' }, /completed current check/],
  ['fixed without compatibility', { state: 'fixed', priorFingerprint: digest, compatibility: 'not_comparable', currentCheck: 'completed', coverageRef: 'coverage-fixture', reasonCode: 'condition_absent_after_completed_check' }, /compatible baseline/],
  ['fixed from missing fingerprint', { state: 'fixed', priorFingerprint: null, compatibility: 'compatible', currentCheck: 'completed', coverageRef: 'coverage-fixture', reasonCode: 'condition_absent_after_completed_check' }, /prior fingerprint/],
  ['unretested presented as complete', { state: 'unretested', priorFingerprint: digest, compatibility: 'compatible', currentCheck: 'completed', coverageRef: 'coverage-fixture', reasonCode: 'adapter_unavailable' }, /incomplete or unrun/],
]) {
  assert.match(validateFindingV2(finding({ baseline })).join('\n'), expected, label);
}

const coverage = {
  id: 'coverage-fixture', adapterId: 'fixture-adapter', ruleId: 'fixture-rule', ruleRevision: '1', status: 'completed',
  counts: { discovered: 1, eligible: 1, scanned: 1, excluded: 0, skipped: 0, truncated: 0, errors: 0 },
  reasons: [],
};
const report = (overrides = {}) => ({
  schemaVersion: 2,
  tool: { name: 'Web App Security Skill', version: '0.4.0-planned' },
  generatedAt: '1970-01-01T00:00:00.000Z',
  mode: 'retest',
  subject: { id: 'project-0123456789abcdef', binding: 'persisted', scopeDigest: digest, localPathIncluded: false },
  ruleset: { digest, fingerprintVersion: 2, adapters: [{ id: 'fixture-adapter', version: '1.0.0', rulesetDigest: digest, maturity: 'stable' }] },
  scope: { modes: ['source'] },
  policy: {
    thresholds: [
      { domain: 'security_exposure', failOn: 'high' },
      { domain: 'supply_chain', failOn: 'high' },
      { domain: 'search_discoverability', failOn: 'never' },
      { domain: 'reliability', failOn: 'never' },
      { domain: 'evidence_integrity', failOn: 'never' },
    ],
    precedence: 'confirmed_threshold_before_incomplete',
  },
  coverage: [coverage],
  summary: {},
  findings: [finding()],
  limitations: [],
  baseline: { sourceDigest: digest, sourceSchemaVersion: 2, subjectId: 'project-0123456789abcdef', scopeDigest: digest, rulesetDigest: digest, compatibility: 'compatible', reasonCode: null },
  migration: null,
  ...overrides,
});

assert.deepEqual(validateReportV2(report()), []);
assert.match(validateReportV2(report({
  policy: { ...report().policy, thresholds: report().policy.thresholds.slice(0, 4) },
})).join('\n'), /missing domain/);
assert.match(validateReportV2(report({
  policy: { ...report().policy, thresholds: [...report().policy.thresholds, report().policy.thresholds[0]] },
})).join('\n'), /duplicate domain/);
assert.match(validateReportV2(report({ subject: { ...report().subject, binding: 'ephemeral' } })).join('\n'), /persisted subject/);
assert.match(validateReportV2(report({ coverage: [{ ...coverage, counts: { ...coverage.counts, scanned: 0 } }] })).join('\n'), /not reconciled/);
assert.match(validateReportV2(report({ findings: [finding({ baseline: { ...finding().baseline, coverageRef: 'missing-coverage' } })] })).join('\n'), /missing coverage/);

const migrated = report({
  subject: { ...report().subject, binding: 'migrated' },
  baseline: { ...report().baseline, sourceSchemaVersion: 1, compatibility: 'not_comparable', reasonCode: 'v1_missing_identity' },
  migration: {
    sourceSchemaVersion: 1,
    sourceDigest: digest,
    sourceTool: { name: 'Web App Security Skill', version: '0.3.0' },
    boundBy: 'explicit_user_binding',
    boundAt: '1970-01-01T00:00:00.000Z',
  },
  findings: [finding({ baseline: { state: 'not_comparable', priorFingerprint: digest, compatibility: 'not_comparable', currentCheck: 'not_run', coverageRef: null, reasonCode: 'v1_missing_identity' } })],
});
assert.deepEqual(validateReportV2(migrated), []);
assert.match(validateReportV2({
  ...migrated, migration: { ...migrated.migration, sourceTool: null },
}).join('\n'), /migration is invalid/);
assert.match(validateReportV2({ ...migrated, migration: null }).join('\n'), /explicit migration lineage/);
assert.match(validateReportV2({ ...migrated, baseline: { ...migrated.baseline, compatibility: 'compatible' } }).join('\n'), /v1 baseline cannot be comparable/);

const v1Finding = createFinding({
  ruleId: 'v1-fixture', title: 'Version 1 fixture', severity: 'low', state: 'suspected',
  summary: 'Version 1 lacks persisted subject and ruleset identity.',
  evidence: { observed: 'sanitized' }, remediation: 'Start a v2 scope.', retest: 'Create a new v2 baseline.',
});
const v1 = createReport({
  version: '0.3.0', generatedAt: '1970-01-01T00:00:00.000Z', mode: 'audit',
  scope: { projectRoot: '/private/path-that-must-not-be-identity' },
  findings: [{ ...v1Finding, baselineState: 'new' }], limitations: [],
});
const v1Bytes = `${JSON.stringify(v1, null, 2)}\n`;
const migrationInspection = inspectV1MigrationInput(v1, v1Bytes);
assert.equal(migrationInspection.status, 'requires_explicit_binding');
assert.equal(migrationInspection.compatibility, 'not_comparable');
assert.equal(migrationInspection.reasonCode, 'v1_missing_subject_identity');
assert.equal(migrationInspection.sourceDigest, sha256(v1Bytes));
assert.equal(migrationInspection.originalMustRemainUnchanged, true);
assert.equal(inspectV1MigrationInput({ ...v1, schemaVersion: 99 }, v1Bytes).reasonCode, 'malformed_v1_report');
assert.equal(inspectV1MigrationInput(v1, null).reasonCode, 'v1_source_bytes_required');

console.log('report v2 contract ok: domains, evidence states, baseline states, coverage and v1 migration');
