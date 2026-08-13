import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { sanitizeEvidence, writeAtomicEvidenceBundle } from './evidence-writer.mjs';
import { sha256 } from './report-v2-contract.mjs';

export const REPAIR_WORKFLOW_STATES = [
  'review_required', 'ready_for_review', 'approved', 'applied', 'retested', 'rolled_back',
];
export const REPAIR_APPROVAL_STATES = ['pending', 'approved', 'rejected'];
export const REPAIR_APPLICATION_STATES = ['not_applied', 'applied', 'rolled_back'];
export const REPAIR_VERIFICATION_STATES = ['not_run', 'passed', 'failed', 'unknown'];

const SHA256 = /^[a-f0-9]{64}$/;
const ID = /^[a-z0-9][a-z0-9._-]+$/;
const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

function object(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function exactKeys(value, allowed, label, errors) {
  if (!object(value)) {
    errors.push(`${label} must be an object`);
    return false;
  }
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) errors.push(`${label}.${key} is not allowed`);
  }
  for (const key of allowed) {
    if (!(key in value)) errors.push(`${label}.${key} is required`);
  }
  return true;
}

function text(value, label, errors, { nullable = false, max = 4096 } = {}) {
  if (nullable && value === null) return;
  if (typeof value !== 'string' || !value.trim()) errors.push(`${label} must be non-empty text`);
  else {
    if (value.length > max) errors.push(`${label} exceeds ${max} characters`);
    if (CONTROL.test(value)) errors.push(`${label} contains control characters`);
  }
}

function textList(value, label, errors, { min = 0, paths = false } = {}) {
  if (!Array.isArray(value) || value.length < min || value.length > 50) {
    errors.push(`${label} must contain ${min}..50 entries`);
    return;
  }
  for (const [index, item] of value.entries()) {
    text(item, `${label}[${index}]`, errors, { max: paths ? 160 : 4096 });
    if (paths && (item.startsWith('/') || /^[A-Za-z]:[\\/]/.test(item)
        || item.split(/[\\/]/).includes('..'))) errors.push(`${label}[${index}] must be a project-relative path`);
  }
}

function timestamp(value, label, errors, nullable = false) {
  if (nullable && value === null) return;
  text(value, label, errors, { max: 64 });
  if (typeof value === 'string' && Number.isNaN(Date.parse(value))) errors.push(`${label} must be an ISO timestamp`);
}

function initialWorkflowStatus(finding) {
  if (finding.state === 'unknown') return 'review_required';
  return finding.explanation.proposal.status === 'ready_for_review'
    ? 'ready_for_review'
    : 'review_required';
}

export function createRepairRecord(report, rawBytes, finding, generatedAt = new Date().toISOString()) {
  if (report?.schemaVersion !== 3 || finding?.schemaVersion !== 3) {
    throw new Error('repair records require a finding/report v3 source');
  }
  if (finding.explanation.proposal.status === 'not_applicable' || finding.state === 'not_applicable') {
    throw new Error('not_applicable findings do not have an actionable repair plan');
  }
  const questions = finding.explanation.userDecisions.length
    ? finding.explanation.userDecisions
    : ['Approve the proposed change and touched paths before any file is modified.'];
  const touchedPaths = finding.location?.path ? [finding.location.path] : [];
  const record = sanitizeEvidence({
    schemaVersion: 1,
    generatedAt,
    source: {
      reportSha256: sha256(rawBytes),
      reportSchemaVersion: report.schemaVersion,
      subjectId: report.subject.id,
      findingId: finding.id,
      findingFingerprint: finding.fingerprint,
      evidenceState: finding.state,
      baselineState: finding.baseline.state,
    },
    workflowStatus: initialWorkflowStatus(finding),
    proposal: {
      summary: finding.explanation.proposal.summary,
      touchedPaths,
      assumptions: [
        touchedPaths.length
          ? 'The reported location is the initial review target; dependent files and generated artifacts have not been inferred.'
          : 'No safe touched path can be inferred from this finding; inspect the project before proposing file changes.',
      ],
      alternatives: finding.explanation.alternatives,
      sideEffects: finding.explanation.sideEffects,
      blastRadius: finding.explanation.sideEffects,
    },
    approval: {
      required: true,
      status: 'pending',
      questions,
      recordedBy: null,
      recordedAt: null,
    },
    application: {
      status: 'not_applied',
      changedPaths: [],
      appliedAt: null,
      rolledBackAt: null,
      notes: [],
    },
    verification: {
      security: {
        status: 'not_run',
        procedure: finding.explanation.securityRetest,
        recordedAt: null,
        evidence: [],
      },
      functional: {
        status: 'not_run',
        procedure: finding.explanation.functionalRetest,
        recordedAt: null,
        evidence: [],
      },
    },
    rollback: {
      condition: finding.explanation.sideEffects.join(' '),
      action: finding.explanation.rollback,
    },
  });
  const errors = validateRepairRecord(record);
  if (errors.length) throw new Error(`invalid repair record: ${errors.join('; ')}`);
  return record;
}

export function validateRepairRecord(record) {
  const errors = [];
  if (!exactKeys(record, [
    'schemaVersion', 'generatedAt', 'source', 'workflowStatus', 'proposal', 'approval',
    'application', 'verification', 'rollback',
  ], 'repair', errors)) return errors;
  if (record.schemaVersion !== 1) errors.push('repair.schemaVersion must be 1');
  timestamp(record.generatedAt, 'repair.generatedAt', errors);
  if (exactKeys(record.source, [
    'reportSha256', 'reportSchemaVersion', 'subjectId', 'findingId', 'findingFingerprint',
    'evidenceState', 'baselineState',
  ], 'repair.source', errors)) {
    if (!SHA256.test(record.source.reportSha256 || '')) errors.push('repair.source.reportSha256 is invalid');
    if (record.source.reportSchemaVersion !== 3) errors.push('repair.source.reportSchemaVersion must be 3');
    text(record.source.subjectId, 'repair.source.subjectId', errors, { max: 128 });
    if (!ID.test(record.source.findingId || '')) errors.push('repair.source.findingId is invalid');
    if (!SHA256.test(record.source.findingFingerprint || '')) errors.push('repair.source.findingFingerprint is invalid');
    if (!['confirmed', 'suspected', 'unknown'].includes(record.source.evidenceState)) {
      errors.push('repair.source.evidenceState is invalid');
    }
    if (![null, 'new', 'unchanged', 'regressed', 'fixed', 'unretested', 'not_comparable']
      .includes(record.source.baselineState)) errors.push('repair.source.baselineState is invalid');
  }
  if (!REPAIR_WORKFLOW_STATES.includes(record.workflowStatus)) errors.push('repair.workflowStatus is invalid');
  if (exactKeys(record.proposal, [
    'summary', 'touchedPaths', 'assumptions', 'alternatives', 'sideEffects', 'blastRadius',
  ], 'repair.proposal', errors)) {
    text(record.proposal.summary, 'repair.proposal.summary', errors);
    textList(record.proposal.touchedPaths, 'repair.proposal.touchedPaths', errors, { paths: true });
    textList(record.proposal.assumptions, 'repair.proposal.assumptions', errors, { min: 1 });
    textList(record.proposal.alternatives, 'repair.proposal.alternatives', errors);
    textList(record.proposal.sideEffects, 'repair.proposal.sideEffects', errors, { min: 1 });
    textList(record.proposal.blastRadius, 'repair.proposal.blastRadius', errors, { min: 1 });
  }
  if (exactKeys(record.approval, [
    'required', 'status', 'questions', 'recordedBy', 'recordedAt',
  ], 'repair.approval', errors)) {
    if (record.approval.required !== true) errors.push('repair.approval.required must remain true');
    if (!REPAIR_APPROVAL_STATES.includes(record.approval.status)) errors.push('repair.approval.status is invalid');
    textList(record.approval.questions, 'repair.approval.questions', errors, { min: 1 });
    text(record.approval.recordedBy, 'repair.approval.recordedBy', errors, { nullable: true, max: 160 });
    timestamp(record.approval.recordedAt, 'repair.approval.recordedAt', errors, true);
    if (record.approval.status === 'approved'
        && (!record.approval.recordedBy || !record.approval.recordedAt)) {
      errors.push('approved repair requires recordedBy and recordedAt');
    }
  }
  if (exactKeys(record.application, [
    'status', 'changedPaths', 'appliedAt', 'rolledBackAt', 'notes',
  ], 'repair.application', errors)) {
    if (!REPAIR_APPLICATION_STATES.includes(record.application.status)) errors.push('repair.application.status is invalid');
    textList(record.application.changedPaths, 'repair.application.changedPaths', errors, {
      min: record.application.status === 'not_applied' ? 0 : 1, paths: true,
    });
    timestamp(record.application.appliedAt, 'repair.application.appliedAt', errors, true);
    timestamp(record.application.rolledBackAt, 'repair.application.rolledBackAt', errors, true);
    textList(record.application.notes, 'repair.application.notes', errors);
    if (record.application.status !== 'not_applied' && !record.application.appliedAt) {
      errors.push('applied or rolled-back repair requires appliedAt');
    }
    if (record.application.status === 'rolled_back' && !record.application.rolledBackAt) {
      errors.push('rolled-back repair requires rolledBackAt');
    }
  }
  if (exactKeys(record.verification, ['security', 'functional'], 'repair.verification', errors)) {
    for (const kind of ['security', 'functional']) {
      const value = record.verification[kind];
      if (exactKeys(value, ['status', 'procedure', 'recordedAt', 'evidence'], `repair.verification.${kind}`, errors)) {
        if (!REPAIR_VERIFICATION_STATES.includes(value.status)) {
          errors.push(`repair.verification.${kind}.status is invalid`);
        }
        text(value.procedure, `repair.verification.${kind}.procedure`, errors);
        timestamp(value.recordedAt, `repair.verification.${kind}.recordedAt`, errors, true);
        textList(value.evidence, `repair.verification.${kind}.evidence`, errors);
        if (value.status !== 'not_run' && !value.recordedAt) {
          errors.push(`repair.verification.${kind} requires recordedAt after execution`);
        }
      }
    }
  }
  if (exactKeys(record.rollback, ['condition', 'action'], 'repair.rollback', errors)) {
    text(record.rollback.condition, 'repair.rollback.condition', errors);
    text(record.rollback.action, 'repair.rollback.action', errors);
  }

  const approval = record.approval?.status;
  const application = record.application?.status;
  if (record.source?.evidenceState === 'unknown' && application !== 'not_applied') {
    errors.push('unknown evidence cannot advance to an applied repair');
  }
  if (application !== 'not_applied' && approval !== 'approved') {
    errors.push('a repair cannot be applied before explicit approval');
  }
  if (['review_required', 'ready_for_review', 'approved'].includes(record.workflowStatus)
      && application !== 'not_applied') errors.push(`${record.workflowStatus} requires application.status not_applied`);
  if (record.workflowStatus === 'approved' && approval !== 'approved') {
    errors.push('approved workflow requires approved approval status');
  }
  if (record.workflowStatus === 'applied' && application !== 'applied') {
    errors.push('applied workflow requires application.status applied');
  }
  if (record.workflowStatus === 'retested') {
    if (application !== 'applied') errors.push('retested workflow requires application.status applied');
    if (approval !== 'approved') errors.push('retested workflow requires explicit approval');
    if (record.verification?.security?.status !== 'passed'
        || record.verification?.functional?.status !== 'passed') {
      errors.push('retested workflow requires passed security and functional verification');
    }
  }
  if (record.workflowStatus === 'rolled_back' && application !== 'rolled_back') {
    errors.push('rolled_back workflow requires application.status rolled_back');
  }
  if (approval === 'rejected' && application !== 'not_applied') {
    errors.push('a rejected repair must remain not_applied');
  }
  return [...new Set(errors)];
}

export function renderRepairRecordMarkdown(record) {
  const list = (values) => values.length ? values.map((value) => `- ${value}`) : ['- None recorded.'];
  return `${[
    '# Reviewable security repair plan', '',
    `- Finding: \`${record.source.findingId}\``,
    `- Evidence status: \`${record.source.evidenceState}\``,
    `- Repair workflow: \`${record.workflowStatus}\``,
    `- Approval: \`${record.approval.status}\``, '',
    '## Proposed change', '', record.proposal.summary, '',
    '### Touched paths', '', ...list(record.proposal.touchedPaths), '',
    '### Assumptions', '', ...list(record.proposal.assumptions), '',
    '### Alternatives', '', ...list(record.proposal.alternatives), '',
    '### Possible side effects and blast radius', '', ...list(record.proposal.blastRadius), '',
    '## Decisions required before application', '', ...list(record.approval.questions), '',
    '## Security retest', '', record.verification.security.procedure, '',
    '## Functional retest', '', record.verification.functional.procedure, '',
    '## Rollback', '', `Condition: ${record.rollback.condition}`, '', `Action: ${record.rollback.action}`, '',
    'This plan does not apply a patch. Update and validate the JSON record only after each step actually occurs.', '',
  ].join('\n')}\n`;
}

export function writeRepairRecord(record, directory, name = `repair-${record.source.findingId}`) {
  if (!/^[a-zA-Z0-9._-]+$/.test(name)) throw new Error('repair record name contains unsupported characters');
  const errors = validateRepairRecord(record);
  if (errors.length) throw new Error(`refusing invalid repair record: ${errors.join('; ')}`);
  const json = `${JSON.stringify(record, null, 2)}\n`;
  return writeAtomicEvidenceBundle(directory, [
    { key: 'json', name: `${name}.json`, content: json, validate: (bytes) => JSON.parse(bytes.toString('utf8')) },
    { key: 'markdown', name: `${name}.md`, content: renderRepairRecordMarkdown(record) },
    { key: 'digest', name: `${name}.sha256`, content: `${sha256(json)}  ${name}.json\n` },
  ]);
}

export function readRepairRecord(path) {
  let record;
  try { record = JSON.parse(readFileSync(path, 'utf8')); } catch { throw new Error(`invalid repair record JSON: ${basename(path)}`); }
  const errors = validateRepairRecord(record);
  if (errors.length) throw new Error(`invalid repair record ${basename(path)}: ${errors.join('; ')}`);
  return record;
}
