#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createReportV2, writeReportBundleV2 } from './lib/evidence-v2.mjs';
import { digestValue, validatePersistedScope } from './lib/project-identity.mjs';
import { inspectV1MigrationInput } from './lib/report-v2-contract.mjs';

const args = process.argv.slice(2);
const ROOT = fileURLToPath(new URL('..', import.meta.url));

function usage(code, message) {
  if (message) console.error(`error: ${message}`);
  console.log(`webapp-security migrate-report <v1-report.json> [options]

Options:
  --scope <security-scope.yml>       Persisted v2 scope reviewed by the user
  --acknowledge-subject <subject-id> Exact subject ID from that scope
  --out <directory>                  New output directory
  --name <basename>                  Output basename (default: migrated-report)
`);
  process.exit(code);
}

function take(name, fallback = null) {
  const index = args.indexOf(name);
  if (index === -1) return fallback;
  if (!args[index + 1] || args[index + 1].startsWith('--')) usage(2, `${name} requires a value`);
  const value = args[index + 1];
  args.splice(index, 2);
  return value;
}

const scopeArg = take('--scope');
const acknowledgement = take('--acknowledge-subject');
const outputArg = take('--out');
const name = take('--name', 'migrated-report');
const sourceArg = args.shift();
if (!sourceArg || !scopeArg || !acknowledgement || !outputArg || args.length) usage(2, 'source, scope, acknowledgement and output are required');
if (!/^[a-zA-Z0-9._-]+$/.test(name)) usage(2, '--name contains unsupported characters');

try {
  const sourcePath = resolve(sourceArg);
  const scopePath = resolve(scopeArg);
  const output = resolve(outputArg);
  if (!existsSync(sourcePath) || !existsSync(scopePath)) throw new Error('source report and scope must exist');
  const sourceBytes = readFileSync(sourcePath);
  let source;
  try { source = JSON.parse(sourceBytes.toString('utf8')); } catch { throw new Error('v1 source is not valid JSON'); }
  const inspection = inspectV1MigrationInput(source, sourceBytes);
  if (inspection.status === 'rejected') throw new Error(`${inspection.reasonCode}: ${inspection.errors.join('; ')}`);
  const scope = validatePersistedScope(JSON.parse(readFileSync(scopePath, 'utf8')));
  if (acknowledgement !== scope.subject.id) throw new Error('acknowledged subject does not match the reviewed scope');
  const now = process.env.SOURCE_DATE_EPOCH
    ? new Date(Number(process.env.SOURCE_DATE_EPOCH) * 1000)
    : new Date();
  if (Number.isNaN(now.getTime())) throw new Error('SOURCE_DATE_EPOCH must be numeric');
  const ruleset = {
    digest: digestValue({ fingerprintVersion: 2, adapters: [] }),
    fingerprintVersion: 2,
    adapters: [],
  };
  const report = createReportV2({
    version: readFileSync(resolve(ROOT, 'VERSION'), 'utf8').trim(),
    generatedAt: now.toISOString(),
    mode: 'audit',
    subject: { ...scope.subject, binding: 'migrated' },
    ruleset,
    scope: {
      auditBoundary: scope.auditBoundary,
      checkModes: [],
      networkAccessPerformed: false,
      historicalSourceSchemaVersion: 1,
    },
    coverage: [],
    findings: [],
    baseline: {
      sourceDigest: inspection.sourceDigest,
      sourceSchemaVersion: 1,
      subjectId: scope.subject.id,
      scopeDigest: scope.subject.scopeDigest,
      rulesetDigest: ruleset.digest,
      compatibility: 'not_comparable',
      reasonCode: 'v1_missing_subject_identity',
    },
    migration: {
      sourceSchemaVersion: 1,
      sourceDigest: inspection.sourceDigest,
      sourceTool: { name: source.tool.name, version: source.tool.version },
      boundBy: 'explicit_user_binding',
      boundAt: now.toISOString(),
    },
    limitations: [
      `Historical findings remain in the unchanged v1 source named ${basename(sourcePath)}.`,
      'The v1 report has no trustworthy subject, rule revision or coverage identity and is not a comparable baseline.',
      'Run a new persisted v2 audit to establish the first comparable baseline.',
    ],
  });
  const files = writeReportBundleV2(report, output, name);
  console.log(`migration: ${files.json}`);
  console.log(`source:    ${basename(sourcePath)} (${inspection.sourceDigest})`);
  console.log(`subject:   ${scope.subject.id} (explicit binding)`);
  console.log('baseline:  not_comparable');
  console.log(`original:  unchanged in ${dirname(sourcePath)}`);
} catch (error) {
  console.error(`error: ${error.message}`);
  process.exit(2);
}
