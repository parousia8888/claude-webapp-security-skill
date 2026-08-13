import { createHash } from 'node:crypto';
import { validateReport as validateReportV1 } from './evidence.mjs';

export const V2_DOMAINS = [
  'security_exposure', 'supply_chain', 'search_discoverability', 'reliability', 'evidence_integrity',
];
export const V2_RESULT_STATES = ['confirmed', 'suspected', 'unknown', 'not_applicable'];
export const V2_BASELINE_STATES = ['new', 'unchanged', 'regressed', 'fixed', 'unretested', 'not_comparable'];
export const V2_COVERAGE_STATES = ['completed', 'partial', 'unavailable', 'not_applicable'];

const SHA256 = /^[a-f0-9]{64}$/;
const ID = /^[a-z0-9][a-z0-9._-]+$/;
const SEVERITIES = ['critical', 'high', 'medium', 'low', 'info'];
const BASELINE_COMPATIBILITY = ['compatible', 'not_comparable', 'not_attempted'];
const CHECK_STATES = ['completed', 'incomplete', 'not_run'];

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function inspectV1MigrationInput(report, rawBytes) {
  if (!Buffer.isBuffer(rawBytes) && typeof rawBytes !== 'string') {
    return { status: 'rejected', reasonCode: 'v1_source_bytes_required', errors: ['original v1 bytes are required'] };
  }
  const errors = validateReportV1(report);
  if (errors.length) return { status: 'rejected', reasonCode: 'malformed_v1_report', errors };
  return {
    status: 'requires_explicit_binding',
    sourceSchemaVersion: 1,
    sourceDigest: sha256(rawBytes),
    compatibility: 'not_comparable',
    reasonCode: 'v1_missing_subject_identity',
    requiredBinding: 'persisted_v2_scope',
    originalMustRemainUnchanged: true,
  };
}

function object(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function requiredObject(value, fields, label, errors) {
  if (!object(value)) {
    errors.push(`${label} must be an object`);
    return false;
  }
  for (const field of fields) if (!(field in value)) errors.push(`${label}.${field} is required`);
  return true;
}

export function validateFindingV2(finding) {
  const errors = [];
  if (finding?.schemaVersion !== 2) errors.push('finding.schemaVersion must be 2');
  if (!ID.test(finding?.id || '')) errors.push('finding.id is invalid');
  if (!SHA256.test(finding?.fingerprint || '')) errors.push('finding.fingerprint must be sha256');
  if (finding?.fingerprintVersion !== 2) errors.push('finding.fingerprintVersion must be 2');
  if (!V2_DOMAINS.includes(finding?.domain)) errors.push('finding.domain is invalid');
  if (!V2_RESULT_STATES.includes(finding?.state)) errors.push('finding.state is invalid');
  if (!SEVERITIES.includes(finding?.severity)) errors.push('finding.severity is invalid');
  if (requiredObject(finding?.rule, ['id', 'revision'], 'finding.rule', errors)) {
    if (!ID.test(finding.rule.id || '')) errors.push('finding.rule.id is invalid');
    if (!finding.rule.revision) errors.push('finding.rule.revision is empty');
  }
  if (requiredObject(finding?.adapter, ['id', 'version', 'rulesetDigest'], 'finding.adapter', errors)) {
    if (!ID.test(finding.adapter.id || '')) errors.push('finding.adapter.id is invalid');
    if (!finding.adapter.version) errors.push('finding.adapter.version is empty');
    if (!SHA256.test(finding.adapter.rulesetDigest || '')) errors.push('finding.adapter.rulesetDigest must be sha256');
  }
  if (requiredObject(finding?.baseline,
    ['state', 'priorFingerprint', 'compatibility', 'currentCheck', 'coverageRef', 'reasonCode'],
    'finding.baseline', errors)) {
    const baseline = finding.baseline;
    if (baseline.state !== null && !V2_BASELINE_STATES.includes(baseline.state)) errors.push('finding.baseline.state is invalid');
    if (!BASELINE_COMPATIBILITY.includes(baseline.compatibility)) errors.push('finding.baseline.compatibility is invalid');
    if (!CHECK_STATES.includes(baseline.currentCheck)) errors.push('finding.baseline.currentCheck is invalid');
    if (baseline.priorFingerprint !== null && !SHA256.test(baseline.priorFingerprint || '')) errors.push('finding.baseline.priorFingerprint is invalid');
    if (baseline.coverageRef !== null && !ID.test(baseline.coverageRef || '')) errors.push('finding.baseline.coverageRef is invalid');
    if (baseline.state === 'fixed') {
      if (!SHA256.test(baseline.priorFingerprint || '')) errors.push('fixed requires a prior fingerprint');
      if (baseline.compatibility !== 'compatible') errors.push('fixed requires compatible baseline evidence');
      if (baseline.currentCheck !== 'completed') errors.push('fixed requires a completed current check');
      if (!baseline.coverageRef) errors.push('fixed requires a current coverage reference');
      if (baseline.reasonCode !== 'condition_absent_after_completed_check') errors.push('fixed requires the affirmative absence reason');
    }
    if (baseline.state === 'unretested') {
      if (!SHA256.test(baseline.priorFingerprint || '')) errors.push('unretested requires a prior fingerprint');
      if (baseline.compatibility !== 'compatible') errors.push('unretested requires a compatible baseline');
      if (!['incomplete', 'not_run'].includes(baseline.currentCheck)) errors.push('unretested requires an incomplete or unrun check');
      if (!baseline.reasonCode) errors.push('unretested requires a reason');
    }
    if (baseline.state === 'not_comparable') {
      if (baseline.compatibility !== 'not_comparable') errors.push('not_comparable requires incompatible evidence');
      if (!baseline.reasonCode) errors.push('not_comparable requires a reason');
    }
  }
  for (const field of ['title', 'summary', 'remediation', 'retest']) {
    if (typeof finding?.[field] !== 'string' || !finding[field]) errors.push(`finding.${field} is required`);
  }
  if (!object(finding?.evidence)) errors.push('finding.evidence must be an object');
  return errors;
}

export function validateReportV2(report) {
  const errors = [];
  if (report?.schemaVersion !== 2) errors.push('report.schemaVersion must be 2');
  if (!['audit', 'retest', 'demo-before', 'demo-after'].includes(report?.mode)) errors.push('report.mode is invalid');
  if (requiredObject(report?.subject, ['id', 'binding', 'scopeDigest', 'localPathIncluded'], 'report.subject', errors)) {
    if (!/^[a-z0-9][a-z0-9._-]{15,127}$/.test(report.subject.id || '')) errors.push('report.subject.id is invalid');
    if (!['persisted', 'ephemeral', 'migrated'].includes(report.subject.binding)) errors.push('report.subject.binding is invalid');
    if (!SHA256.test(report.subject.scopeDigest || '')) errors.push('report.subject.scopeDigest must be sha256');
    if (report.subject.localPathIncluded !== false) errors.push('report.subject cannot include a local path');
  }
  if (requiredObject(report?.ruleset, ['digest', 'fingerprintVersion', 'adapters'], 'report.ruleset', errors)) {
    if (!SHA256.test(report.ruleset.digest || '')) errors.push('report.ruleset.digest must be sha256');
    if (report.ruleset.fingerprintVersion !== 2) errors.push('report.ruleset.fingerprintVersion must be 2');
    if (!Array.isArray(report.ruleset.adapters)) errors.push('report.ruleset.adapters must be an array');
  }
  if (!Array.isArray(report?.coverage)) errors.push('report.coverage must be an array');
  const coverageIds = new Set();
  for (const [index, coverage] of (report?.coverage || []).entries()) {
    const label = `report.coverage[${index}]`;
    if (!requiredObject(coverage, ['id', 'adapterId', 'status', 'counts', 'reasons'], label, errors)) continue;
    if (!ID.test(coverage.id || '') || coverageIds.has(coverage.id)) errors.push(`${label}.id is invalid or duplicate`);
    coverageIds.add(coverage.id);
    if (!V2_COVERAGE_STATES.includes(coverage.status)) errors.push(`${label}.status is invalid`);
    if (requiredObject(coverage.counts,
      ['discovered', 'eligible', 'scanned', 'excluded', 'skipped', 'truncated', 'errors'],
      `${label}.counts`, errors)) {
      for (const [key, value] of Object.entries(coverage.counts)) {
        if (!Number.isInteger(value) || value < 0) errors.push(`${label}.counts.${key} must be a non-negative integer`);
      }
      const accounted = coverage.counts.scanned + coverage.counts.skipped
        + coverage.counts.truncated + coverage.counts.errors;
      if (coverage.counts.eligible !== accounted) errors.push(`${label} eligible count is not reconciled`);
    }
    if (!Array.isArray(coverage.reasons)) errors.push(`${label}.reasons must be an array`);
  }
  if (!Array.isArray(report?.findings)) errors.push('report.findings must be an array');
  for (const [index, finding] of (report?.findings || []).entries()) {
    errors.push(...validateFindingV2(finding).map((error) => `report.findings[${index}]: ${error}`));
    if (finding?.baseline?.coverageRef && !coverageIds.has(finding.baseline.coverageRef)) {
      errors.push(`report.findings[${index}] references missing coverage`);
    }
  }
  if (!object(report?.policy) || report.policy.precedence !== 'confirmed_threshold_before_incomplete') {
    errors.push('report.policy precedence is invalid');
  }
  if (report?.mode === 'retest' && !object(report?.baseline)) errors.push('retest requires baseline metadata');
  if (object(report?.baseline)) {
    for (const field of ['sourceDigest', 'scopeDigest', 'rulesetDigest']) {
      if (!SHA256.test(report.baseline[field] || '')) errors.push(`report.baseline.${field} must be sha256`);
    }
    if (![1, 2].includes(report.baseline.sourceSchemaVersion)) errors.push('report.baseline.sourceSchemaVersion is invalid');
    if (!['compatible', 'not_comparable'].includes(report.baseline.compatibility)) errors.push('report.baseline.compatibility is invalid');
    if (report.baseline.sourceSchemaVersion === 1) {
      if (report.subject?.binding !== 'migrated') errors.push('v1 baseline requires migrated subject binding');
      if (report.baseline.compatibility !== 'not_comparable') errors.push('v1 baseline cannot be comparable');
      if (!object(report.migration)) errors.push('v1 baseline requires explicit migration lineage');
    }
    if (report.baseline.compatibility === 'compatible' && report.subject?.binding !== 'persisted') {
      errors.push('comparable baseline requires persisted subject identity');
    }
  }
  if (object(report?.migration)) {
    if (report.migration.sourceSchemaVersion !== 1
      || !SHA256.test(report.migration.sourceDigest || '')
      || report.migration.boundBy !== 'explicit_user_binding') {
      errors.push('report.migration is invalid');
    }
  }
  return errors;
}
