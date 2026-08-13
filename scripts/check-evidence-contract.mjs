#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { BASELINE_STATES, RESULT_STATES, SEVERITIES } from './lib/evidence.mjs';
import {
  V2_BASELINE_STATES, V2_COVERAGE_STATES, V2_DOMAINS, V2_RESULT_STATES,
} from './lib/report-v2-contract.mjs';
import { V3_EXPLANATION_FIELDS, V3_PROPOSAL_STATES } from './lib/report-v3-contract.mjs';
import {
  REPAIR_APPLICATION_STATES, REPAIR_APPROVAL_STATES, REPAIR_VERIFICATION_STATES,
  REPAIR_WORKFLOW_STATES,
} from './lib/repair-record.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const findingSchema = JSON.parse(readFileSync(`${ROOT}/docs/finding.schema.json`, 'utf8'));
const reportSchema = JSON.parse(readFileSync(`${ROOT}/docs/report.schema.json`, 'utf8'));
const findingV2Schema = JSON.parse(readFileSync(`${ROOT}/docs/finding-v2.schema.json`, 'utf8'));
const reportV2Schema = JSON.parse(readFileSync(`${ROOT}/docs/report-v2.schema.json`, 'utf8'));
const findingV3Schema = JSON.parse(readFileSync(`${ROOT}/docs/finding-v3.schema.json`, 'utf8'));
const reportV3Schema = JSON.parse(readFileSync(`${ROOT}/docs/report-v3.schema.json`, 'utf8'));
const repairSchema = JSON.parse(readFileSync(`${ROOT}/docs/repair-record.schema.json`, 'utf8'));

function equal(label, actual, expected) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    console.error(`evidence contract: ${label} differs: ${JSON.stringify(actual)} != ${JSON.stringify(expected)}`);
    process.exitCode = 1;
  }
}

equal('finding severities', findingSchema.properties.severity.enum, SEVERITIES);
equal('finding states', findingSchema.properties.state.enum, RESULT_STATES);
equal('baseline states', findingSchema.properties.baselineState.enum, [...BASELINE_STATES, null]);
equal('report modes', reportSchema.properties.mode.enum, ['audit', 'retest', 'demo-before', 'demo-after']);
if (reportSchema.properties.findings.items.$ref !== './finding.schema.json') {
  console.error('evidence contract: report findings must reference finding.schema.json');
  process.exitCode = 1;
}
equal('v2 finding domains', findingV2Schema.properties.domain.enum, V2_DOMAINS);
equal('v2 finding states', findingV2Schema.properties.state.enum, V2_RESULT_STATES);
equal('v2 baseline states', findingV2Schema.properties.baseline.properties.state.enum, [...V2_BASELINE_STATES, null]);
equal('v2 coverage states', reportV2Schema.properties.coverage.items.properties.status.enum, V2_COVERAGE_STATES);
if (reportV2Schema.properties.findings.items.$ref !== './finding-v2.schema.json') {
  console.error('evidence contract: v2 report findings must reference finding-v2.schema.json');
  process.exitCode = 1;
}
equal('v3 explanation fields', findingV3Schema.properties.explanation.required, V3_EXPLANATION_FIELDS);
equal('v3 proposal states', findingV3Schema.properties.explanation.properties.proposal.properties.status.enum, V3_PROPOSAL_STATES);
equal('v3 finding states', findingV3Schema.properties.state.$ref, '#/$defs/resultState');
equal('v3 coverage states', reportV3Schema.properties.coverage.items.properties.status.enum, V2_COVERAGE_STATES);
if (reportV3Schema.properties.findings.items.$ref !== './finding-v3.schema.json') {
  console.error('evidence contract: v3 report findings must reference finding-v3.schema.json');
  process.exitCode = 1;
}
equal('repair workflow states', repairSchema.properties.workflowStatus.enum, REPAIR_WORKFLOW_STATES);
equal('repair approval states', repairSchema.properties.approval.properties.status.enum, REPAIR_APPROVAL_STATES);
equal('repair application states', repairSchema.properties.application.properties.status.enum, REPAIR_APPLICATION_STATES);
equal('repair verification states', repairSchema.$defs.verification.properties.status.enum, REPAIR_VERIFICATION_STATES);
if (!process.exitCode) console.log(`evidence contract ok: v1 ${SEVERITIES.length}/${RESULT_STATES.length}/${BASELINE_STATES.length}; v2 ${V2_DOMAINS.length} domains, ${V2_RESULT_STATES.length} states, ${V2_BASELINE_STATES.length} baseline states; v3 ${V3_EXPLANATION_FIELDS.length} explanation fields; repair ${REPAIR_WORKFLOW_STATES.length} workflow states`);
