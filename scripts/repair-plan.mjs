#!/usr/bin/env node
import { resolve } from 'node:path';
import { readReportV3 } from './lib/evidence-v3.mjs';
import {
  createRepairRecord, readRepairRecord, validateRepairRecord, writeRepairRecord,
} from './lib/repair-record.mjs';

const args = process.argv.slice(2);
const mode = args.shift();

function usage(message = null) {
  if (message) console.error(`error: ${message}`);
  console.error('usage:\n  webapp-security repair-plan <finding-id> --report <report.json> --out <directory>\n  webapp-security repair-validate <repair-record.json>');
  process.exit(2);
}

try {
  if (mode === 'create') {
    const findingId = args.shift();
    const reportIndex = args.indexOf('--report');
    const outIndex = args.indexOf('--out');
    if (!findingId || reportIndex === -1 || outIndex === -1
        || !args[reportIndex + 1] || !args[outIndex + 1] || args.length !== 4) usage();
    const loaded = readReportV3(resolve(args[reportIndex + 1]));
    const finding = loaded.report.findings.find((item) => item.id === findingId);
    if (!finding) throw new Error(`finding not found: ${findingId}`);
    const record = createRepairRecord(loaded.report, loaded.rawBytes, finding);
    const files = writeRepairRecord(record, resolve(args[outIndex + 1]));
    console.log(`repair plan: ${files.json}`);
    console.log(`workflow:    ${record.workflowStatus}`);
    console.log(`approval:    ${record.approval.status}`);
    console.log('patch:       not applied');
    process.exit(0);
  }
  if (mode === 'validate') {
    if (args.length !== 1) usage();
    const record = readRepairRecord(resolve(args[0]));
    const errors = validateRepairRecord(record);
    if (errors.length) throw new Error(errors.join('; '));
    console.log(`repair record valid: ${record.workflowStatus}; security=${record.verification.security.status}; functional=${record.verification.functional.status}`);
    process.exit(0);
  }
  usage();
} catch (error) {
  console.error(`error: ${error.message}`);
  process.exit(2);
}
