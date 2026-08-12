#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { BASELINE_STATES, RESULT_STATES, SEVERITIES } from './lib/evidence.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const findingSchema = JSON.parse(readFileSync(`${ROOT}/docs/finding.schema.json`, 'utf8'));
const reportSchema = JSON.parse(readFileSync(`${ROOT}/docs/report.schema.json`, 'utf8'));

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
if (!process.exitCode) console.log(`evidence contract ok: ${SEVERITIES.length} severities, ${RESULT_STATES.length} states, ${BASELINE_STATES.length} baseline states`);
