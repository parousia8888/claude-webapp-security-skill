#!/usr/bin/env node
import { resolve } from 'node:path';
import { readReport } from './lib/evidence.mjs';

const args = process.argv.slice(2);
const id = args.shift();
const reportIndex = args.indexOf('--report');
if (!id || reportIndex === -1 || !args[reportIndex + 1] || args.length !== 2) {
  console.error('usage: webapp-security explain <finding-id> --report <report.json>');
  process.exit(2);
}
try {
  const report = readReport(resolve(args[reportIndex + 1]));
  const finding = report.findings.find((item) => item.id === id);
  if (!finding) throw new Error(`finding not found: ${id}`);
  console.log(`# ${finding.id}: ${finding.title}\n`);
  console.log(`Severity: ${finding.severity}`);
  console.log(`Evidence state: ${finding.state}`);
  console.log(`Baseline state: ${finding.baselineState || 'none'}\n`);
  console.log(`${finding.summary}\n`);
  console.log(`Evidence: ${JSON.stringify(finding.evidence)}`);
  console.log(`Remediation: ${finding.remediation}`);
  console.log(`Retest: ${finding.retest}`);
} catch (error) {
  console.error(`error: ${error.message}`);
  process.exit(2);
}
