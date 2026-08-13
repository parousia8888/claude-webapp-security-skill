#!/usr/bin/env node
import assert from 'node:assert/strict';
import {
  chmodSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  createFindingV3, createReportV3, initializeFindingsV3, writeReportBundleV3,
} from '../scripts/lib/evidence-v3.mjs';
import {
  createRepairRecord, readRepairRecord, validateRepairRecord, writeRepairRecord,
} from '../scripts/lib/repair-record.mjs';
import { createRulesetV2 } from '../scripts/lib/ruleset-v2.mjs';
import { sha256 } from '../scripts/lib/report-v2-contract.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const CLI = join(ROOT, 'scripts', 'webapp-security.mjs');
const temp = mkdtempSync(join(tmpdir(), 'web-app-security-repair-'));
const sentinel = 'M7_REPAIR_SECRET_SENTINEL';
const adapter = { id: 'repair-fixture', version: '1.0.0', maturity: 'stable' };
const rules = [
  { id: 'cookie-http-only', revision: '1', domain: 'security_exposure', severity: 'high' },
  { id: 'sast-unavailable', revision: '1', domain: 'evidence_integrity', severity: 'high' },
  { id: 'cors-owner-decision', revision: '1', domain: 'security_exposure', severity: 'medium' },
  { id: 'command-execution-lead', revision: '1', domain: 'security_exposure', severity: 'high' },
];
const ruleset = createRulesetV2([{ ...adapter, rules }]);
const subject = {
  id: 'project-0123456789abcdef', binding: 'persisted',
  scopeDigest: sha256('repair-fixture-scope'), localPathIncluded: false,
};

function explanation({
  technicalTerm, plainLanguage, consequence, evidenceBoundary, proposal, alternatives = [],
  sideEffects, securityRetest, functionalRetest, rollback, userDecisions = [],
}) {
  return {
    technicalTerm, plainLanguage, consequence, evidenceBoundary, standards: [],
    proposal, alternatives, sideEffects, securityRetest, functionalRetest, rollback, userDecisions,
  };
}

function finding(rule, state, title, path, detail) {
  return createFindingV3({
    ruleset, adapterId: adapter.id, rule, title, severity: rule.severity, state,
    summary: detail.plainLanguage, location: path ? { path, line: 7 } : null,
    evidence: { subject: rule.id, reasonCode: state === 'unknown' ? 'adapter_missing' : undefined },
    remediation: detail.proposal.summary, retest: detail.securityRetest, explanation: detail,
  });
}

function coverage(rule, status) {
  return {
    id: `repair-${rule.id}`, adapterId: adapter.id, ruleId: rule.id, ruleRevision: rule.revision,
    status,
    counts: { discovered: 1, eligible: 1, scanned: status === 'completed' ? 1 : 0,
      excluded: 0, skipped: 0, truncated: 0, errors: status === 'completed' ? 0 : 1 },
    reasons: status === 'completed' ? [] : [{ code: 'adapter_missing', count: 1, samplePaths: [] }],
  };
}

const cookie = finding(rules[0], 'suspected', 'Session cookie may be readable by scripts', 'src/session.ts', explanation({
  technicalTerm: 'Missing HttpOnly cookie attribute',
  plainLanguage: 'Browser page code may be able to read the login cookie.',
  consequence: 'If hostile script runs in the page, it may steal the session and use the account.',
  evidenceBoundary: 'Source omits HttpOnly; no XSS path or deployed response was proven.',
  proposal: { status: 'review_required', summary: 'Enable HttpOnly after checking browser dependencies.' },
  alternatives: ['Move browser-readable state to a separate non-session value.'],
  sideEffects: ['Login or refresh can fail if frontend code reads the session cookie.'],
  securityRetest: 'Verify browser script cannot read the session cookie.',
  functionalRetest: 'Run login, refresh and logout journeys.',
  rollback: 'Revert the flag if login fails, then remove the browser dependency before retrying.',
  userDecisions: ['Confirm whether frontend code intentionally reads the session cookie.'],
}));
const unavailable = finding(rules[1], 'unknown', 'SAST evidence unavailable', null, explanation({
  technicalTerm: 'Unavailable SAST evidence',
  plainLanguage: 'The required source scanner did not run, so this area was not checked.',
  consequence: 'The project may contain a problem or may be safe; current evidence cannot decide.',
  evidenceBoundary: 'Missing tool evidence proves neither a vulnerability nor a pass.',
  proposal: { status: 'review_required', summary: 'Install the tested local scanner version and rerun before proposing source changes.' },
  sideEffects: ['Installing the local scanner uses disk space and may require a caller-controlled download.'],
  securityRetest: 'Rerun the same scanner rule with the tested version.',
  functionalRetest: 'No source change is proposed; if one follows later, run project-native tests.',
  rollback: 'Remove the caller-installed scanner if it is not accepted; preserve the result as unknown.',
}));
const cors = finding(rules[2], 'suspected', 'Credentialed wildcard CORS lead', 'src/cors.ts', explanation({
  technicalTerm: 'Credentialed wildcard CORS policy lead',
  plainLanguage: 'The configuration appears to trust every website while sending user credentials.',
  consequence: 'An overly broad effective policy may expose authenticated responses or break browsers.',
  evidenceBoundary: 'A literal object was found; live middleware and response headers were not proven.',
  proposal: { status: 'review_required', summary: 'Replace the wildcard with owner-approved origins for each environment.' },
  alternatives: ['Use same-origin requests where cross-origin browser sessions are unnecessary.'],
  sideEffects: ['Any legitimate origin omitted from the list will stop working.'],
  securityRetest: 'Verify an untrusted owned origin cannot read the authenticated response.',
  functionalRetest: 'Run login and API journeys from every approved origin.',
  rollback: 'Restore the prior explicit allowlist if a legitimate client breaks; do not restore a credentialed wildcard.',
  userDecisions: ['List the production, preview and development origins that must send credentials.'],
}));
const command = finding(rules[3], 'suspected', 'Request-to-command execution lead', 'src/jobs.ts', explanation({
  technicalTerm: 'OS command injection lead',
  plainLanguage: 'A request value appears to reach code that starts a system command.',
  consequence: 'If the route is reachable and input reaches a shell, an attacker may run commands.',
  evidenceBoundary: 'Same-file source-to-sink flow was observed; reachability and execution were not proven.',
  proposal: { status: 'review_required', summary: `Use an executable and argument array; never place token=${sentinel} in command text.` },
  alternatives: ['Map allowed user choices to fixed server-side operations.'],
  sideEffects: ['Pipes, redirects and wildcard expansion may stop working without a shell.'],
  securityRetest: 'Send harmless shell metacharacters and verify they remain one inert argument.',
  functionalRetest: 'Run the normal export or job workflow on supported platforms.',
  rollback: 'Revert to a fixed validated wrapper if jobs fail, while restricting the untrusted route.',
  userDecisions: ['Confirm which operations and shell features are product requirements.'],
}));

const findings = [cookie, unavailable, cors, command];
const ledger = rules.map((rule, index) => coverage(rule, index === 1 ? 'unavailable' : 'completed'));
const report = createReportV3({
  version: '0.5.0-dev', generatedAt: '1970-01-01T00:00:00.000Z', mode: 'audit', subject,
  ruleset, scope: { checkModes: ['fixture'], networkAccessPerformed: false }, coverage: ledger,
  findings: initializeFindingsV3(findings, ledger), limitations: ['Local workflow fixture only.'],
});

try {
  const reportDir = join(temp, 'report');
  const reportFiles = writeReportBundleV3(report, reportDir);
  const raw = readFileSync(reportFiles.json);
  const records = report.findings.map((item) => createRepairRecord(report, raw, item,
    '1970-01-01T00:00:00.000Z'));
  const byRule = new Map(records.map((item) => [
    report.findings.find((finding) => finding.id === item.source.findingId).rule.id, item,
  ]));
  assert.deepEqual(records.map((item) => item.workflowStatus), [
    'review_required', 'review_required', 'review_required', 'review_required',
  ]);
  assert.match(byRule.get('cookie-http-only').approval.questions[0], /frontend code/);
  assert.match(byRule.get('sast-unavailable').proposal.summary, /scanner version/);
  assert.match(byRule.get('cors-owner-decision').approval.questions[0], /origins/);
  assert.match(byRule.get('command-execution-lead').proposal.sideEffects[0], /Pipes/);
  assert.equal(JSON.stringify(records).includes(sentinel), false, 'repair records redact secret-like text');

  const unapproved = structuredClone(byRule.get('cookie-http-only'));
  unapproved.workflowStatus = 'applied';
  unapproved.application = {
    ...unapproved.application, status: 'applied', changedPaths: ['src/session.ts'],
    appliedAt: '1970-01-01T00:01:00.000Z',
  };
  assert.match(validateRepairRecord(unapproved).join('; '), /before explicit approval/);

  const unknownApplied = structuredClone(byRule.get('sast-unavailable'));
  unknownApplied.approval = {
    ...unknownApplied.approval, status: 'approved', recordedBy: 'project owner',
    recordedAt: '1970-01-01T00:01:00.000Z',
  };
  unknownApplied.workflowStatus = 'applied';
  unknownApplied.application = {
    ...unknownApplied.application, status: 'applied', changedPaths: ['src/unknown.ts'],
    appliedAt: '1970-01-01T00:02:00.000Z',
  };
  assert.match(validateRepairRecord(unknownApplied).join('; '), /unknown evidence cannot advance/);

  const retested = structuredClone(byRule.get('command-execution-lead'));
  retested.approval = {
    ...retested.approval, status: 'approved', recordedBy: 'project owner',
    recordedAt: '1970-01-01T00:01:00.000Z',
  };
  retested.application = {
    ...retested.application, status: 'applied', changedPaths: ['src/jobs.ts'],
    appliedAt: '1970-01-01T00:02:00.000Z',
  };
  retested.workflowStatus = 'retested';
  retested.verification.security = {
    ...retested.verification.security, status: 'passed',
    recordedAt: '1970-01-01T00:03:00.000Z', evidence: ['Owned marker remained inert.'],
  };
  retested.verification.functional = {
    ...retested.verification.functional, status: 'unknown',
    recordedAt: '1970-01-01T00:04:00.000Z', evidence: ['Project dependencies were not authorized.'],
  };
  assert.match(validateRepairRecord(retested).join('; '), /passed security and functional/);
  retested.verification.functional.status = 'passed';
  retested.verification.functional.evidence = ['Project-native tests and the job journey passed.'];
  assert.deepEqual(validateRepairRecord(retested), []);
  retested.approval.status = 'pending';
  retested.approval.recordedBy = null;
  retested.approval.recordedAt = null;
  assert.match(validateRepairRecord(retested).join('; '), /retested workflow requires explicit approval/);

  const output = join(temp, 'repair-output');
  const cookieRecord = byRule.get('cookie-http-only');
  const files = writeRepairRecord(cookieRecord, output);
  assert.equal(statSync(output).mode & 0o777, 0o700);
  for (const path of Object.values(files)) assert.equal(statSync(path).mode & 0o777, 0o600);
  assert.throws(() => writeRepairRecord(cookieRecord, output), /refusing to overwrite/);
  assert.equal(readRepairRecord(files.json).source.findingId, cookieRecord.source.findingId);

  const projectFile = join(temp, 'project-source.ts');
  writeFileSync(projectFile, 'export const unchanged = true;\n');
  chmodSync(projectFile, 0o600);
  const before = sha256(readFileSync(projectFile));
  const cliOut = join(temp, 'cli-repair');
  let result = spawnSync(process.execPath, [
    CLI, 'repair-plan', report.findings[2].id, '--report', reportFiles.json, '--out', cliOut,
  ], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /patch:\s+not applied/);
  assert.equal(sha256(readFileSync(projectFile)), before, 'repair-plan must not edit project files');
  const cliJson = join(cliOut, `repair-${report.findings[2].id}.json`);
  result = spawnSync(process.execPath, [CLI, 'repair-validate', cliJson], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /security=not_run; functional=not_run/);
  result = spawnSync(process.execPath, [
    CLI, 'repair-plan', report.findings[2].id, '--report', reportFiles.json, '--out', cliOut,
  ], { encoding: 'utf8' });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /refusing to overwrite/);

  console.log('repair workflow ok: four scenarios, approval gate, dual retest gate, redaction and review-only CLI');
} finally {
  rmSync(temp, { recursive: true, force: true });
}
