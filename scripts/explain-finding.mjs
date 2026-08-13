#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { readReport } from './lib/evidence.mjs';
import { readReportV2 } from './lib/evidence-v2.mjs';
import { readReportV3, renderFindingMarkdownV3 } from './lib/evidence-v3.mjs';

const args = process.argv.slice(2);
const id = args.shift();
const technicalIndex = args.indexOf('--technical');
const technical = technicalIndex !== -1;
if (technical) args.splice(technicalIndex, 1);
const reportIndex = args.indexOf('--report');
if (!id || reportIndex === -1 || !args[reportIndex + 1] || args.length !== 2) {
  console.error('usage: webapp-security explain <finding-id> --report <report.json> [--technical]');
  process.exit(2);
}
try {
  const path = resolve(args[reportIndex + 1]);
  let header;
  try { header = JSON.parse(readFileSync(path, 'utf8')); } catch { throw new Error('report is not valid JSON'); }
  const report = header.schemaVersion === 3
    ? readReportV3(path).report
    : header.schemaVersion === 2 ? readReportV2(path).report : readReport(path);
  const finding = report.findings.find((item) => item.id === id);
  if (!finding) throw new Error(`finding not found: ${id}`);
  if (finding.schemaVersion === 3) {
    console.log(`${renderFindingMarkdownV3(finding, { technical }).join('\n')}\n`);
    process.exit(0);
  }
  const ruleId = finding.rule?.id || finding.ruleId;
  const baselineState = finding.baseline?.state ?? finding.baselineState ?? 'none';
  console.log(`# ${finding.id}: ${finding.title}\n`);
  console.log(`Rule: ${ruleId}`);
  if (finding.domain) console.log(`Risk domain: ${finding.domain}`);
  console.log(`Severity: ${finding.severity}`);
  console.log(`Evidence state: ${finding.state}`);
  console.log(`Baseline state: ${baselineState}\n`);
  console.log(`${finding.summary}\n`);
  if (technical) console.log(`Evidence: ${JSON.stringify(finding.evidence)}`);
  console.log(`Remediation: ${finding.remediation}`);
  console.log(`Retest: ${finding.retest}`);
} catch (error) {
  console.error(`error: ${error.message}`);
  process.exit(2);
}
