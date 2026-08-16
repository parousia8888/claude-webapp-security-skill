#!/usr/bin/env node
import assert from 'node:assert/strict';
import {
  cpSync, existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { validateSession } from '../scripts/usability-study.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const CLI = join(ROOT, 'scripts', 'usability-study.mjs');
const FIXTURES = join(ROOT, 'test', 'fixtures', 'usability');
const temp = mkdtempSync(join(tmpdir(), 'web-app-security-usability-'));

function run(commandArgs) {
  return spawnSync(process.execPath, [CLI, ...commandArgs], { cwd: ROOT, encoding: 'utf8' });
}

function read(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

try {
  const session = join(temp, 'S-A1B2C3D4.json');
  let result = run(['init', '--out', session, '--session-id', 'S-A1B2C3D4', '--surface', 'codex',
    '--entry-path', 'npx', '--sequence', '6', '--os', 'macos', '--node-major', '22', '--consent']);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(statSync(session).mode & 0o077, 0, 'session record must be private');
  assert.deepEqual(validateSession(read(session)), []);
  assert.equal(read(session).entryPath, 'npx');

  result = run(['record', session,
    '--installation-status', 'completed', '--installation-seconds', '95',
    '--first-report-status', 'completed', '--first-report-seconds', '240',
    '--first-blockage', 'none', '--comprehension', 'correct',
    '--suspected-meaning', 'lead_requires_confirmation',
    '--patch-confidence', 'ready_with_review',
    '--side-effect-comprehension', 'correct',
    '--retest-status', 'completed', '--retest-seconds', '80',
    '--retest-distinction', 'correct',
    '--session-outcome', 'completed', '--manual-notes-present', 'false']);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(read(session).sessionOutcome, 'completed');
  result = run(['validate', session]);
  assert.equal(result.status, 0, result.stderr);

  const noConsent = join(temp, 'no-consent.json');
  result = run(['init', '--out', noConsent, '--surface', 'cli', '--entry-path', 'npx', '--sequence', '7',
    '--os', 'linux', '--node-major', '24']);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /requires --consent/);
  assert.equal(existsSync(noConsent), false);

  const unsupportedNode = join(temp, 'unsupported-node.json');
  result = run(['init', '--out', unsupportedNode, '--surface', 'cli', '--os', 'linux',
    '--entry-path', 'verified_installer', '--sequence', '8', '--node-major', '20', '--consent']);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /environment\.nodeMajor is invalid/);
  assert.equal(existsSync(unsupportedNode), false);

  const pluginOnCli = join(temp, 'plugin-on-cli.json');
  result = run(['init', '--out', pluginOnCli, '--surface', 'cli',
    '--entry-path', 'claude_repository_plugin', '--sequence', '9', '--os', 'linux',
    '--node-major', '24', '--consent']);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /requires environment\.surface claude/);
  assert.equal(existsSync(pluginOnCli), false);

  result = run(['validate', join(FIXTURES, 'invalid-sensitive.json')]);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /repositoryUrl is not allowed/);
  assert.match(result.stderr, /rawTerminalLog is not allowed/);

  const invalidTransition = join(temp, 'invalid-transition.json');
  cpSync(join(FIXTURES, 'incomplete.json'), invalidTransition);
  const before = readFileSync(invalidTransition, 'utf8');
  result = run(['record', invalidTransition, '--session-outcome', 'completed']);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /completed session requires/);
  assert.equal(readFileSync(invalidTransition, 'utf8'), before, 'invalid update must not rewrite the record');

  const three = join(temp, 'three');
  mkdirSync(three);
  for (const name of ['successful.json', 'abandoned.json', 'incomplete.json']) {
    cpSync(join(FIXTURES, name), join(three, name));
  }
  const summaryMd = join(temp, 'summary.md');
  const summaryJson = join(temp, 'summary.json');
  result = run(['aggregate', '--dir', three, '--out', summaryMd, '--json', summaryJson]);
  assert.equal(result.status, 0, result.stderr);
  const incomplete = read(summaryJson);
  assert.equal(incomplete.dataCollectionStatus, 'incomplete');
  assert.equal(incomplete.recordedSessions, 3);
  assert.equal(incomplete.missingSessions, 2);
  assert.equal(incomplete.publicationGate.state, 'insufficient_data');
  assert.deepEqual(incomplete.manualReviewSessionIds, ['S-00000002']);
  assert.equal(readFileSync(summaryMd, 'utf8').includes('passed'), false);

  const conflictMd = join(temp, 'conflict.md');
  const conflictJson = join(temp, 'conflict.json');
  writeFileSync(conflictMd, 'keep\n');
  result = run(['aggregate', '--dir', three, '--out', conflictMd, '--json', conflictJson]);
  assert.equal(result.status, 2);
  assert.equal(readFileSync(conflictMd, 'utf8'), 'keep\n');
  assert.equal(existsSync(conflictJson), false, 'aggregate preflight must prevent partial output');

  const five = join(temp, 'five');
  mkdirSync(five);
  for (let sequence = 1; sequence <= 5; sequence += 1) {
    const value = read(join(FIXTURES, 'successful.json'));
    value.sessionId = `S-${String(sequence).padStart(8, '0')}`;
    value.sessionSequence = sequence;
    value.entryPath = ['npx', 'claude_repository_plugin', 'verified_installer'][sequence % 3];
    value.environment.surface = value.entryPath === 'claude_repository_plugin' ? 'claude' : 'cli';
    writeFileSync(join(five, `${sequence}.json`), `${JSON.stringify(value, null, 2)}\n`);
  }
  result = run(['aggregate', '--dir', five, '--out', join(temp, 'five.md'),
    '--json', join(temp, 'five.json')]);
  assert.equal(result.status, 0, result.stderr);
  const fiveSummary = read(join(temp, 'five.json'));
  assert.equal(fiveSummary.dataCollectionStatus, 'sufficient_for_review');
  assert.equal(fiveSummary.publicationGate.state, 'owner_review_required');
  assert.equal(fiveSummary.stopConditions.firstFiveFirstReport.completed, 5);
  assert.deepEqual(fiveSummary.publicationGate.triggeredRules, []);

  const stopped = join(temp, 'stopped');
  mkdirSync(stopped);
  for (let sequence = 1; sequence <= 5; sequence += 1) {
    const value = read(join(FIXTURES, 'successful.json'));
    value.sessionId = `S-A${String(sequence).padStart(7, '0')}`;
    value.sessionSequence = sequence;
    if (sequence <= 2) value.suspectedMeaning = 'confirmed_vulnerability';
    if ([3, 4].includes(sequence)) {
      value.firstReport = { status: 'blocked', seconds: 300 };
      value.firstBlockage = 'command_discovery';
      value.sessionOutcome = 'incomplete';
    }
    writeFileSync(join(stopped, `${sequence}.json`), `${JSON.stringify(value, null, 2)}\n`);
  }
  result = run(['aggregate', '--dir', stopped, '--out', join(temp, 'stopped.md'),
    '--json', join(temp, 'stopped.json')]);
  assert.equal(result.status, 0, result.stderr);
  const stoppedSummary = read(join(temp, 'stopped.json'));
  assert.equal(stoppedSummary.publicationGate.state, 'stop');
  assert.deepEqual(stoppedSummary.publicationGate.triggeredRules, [
    'firstFiveFirstReport', 'suspectedTreatedAsConfirmed', 'repeatedInstallOrCommandBlockage',
  ]);
  assert.equal(stoppedSummary.stopConditions.firstFiveFirstReport.completed, 3);
  assert.deepEqual(stoppedSummary.stopConditions.repeatedInstallOrCommandBlockage.categories,
    [{ category: 'command_discovery', sessions: 2 }]);

  cpSync(join(FIXTURES, 'invalid-sensitive.json'), join(five, 'invalid.json'));
  result = run(['aggregate', '--dir', five, '--out', join(temp, 'invalid.md'),
    '--json', join(temp, 'invalid-summary.json')]);
  assert.equal(result.status, 2);
  assert.equal(existsSync(join(temp, 'invalid.md')), false);
  assert.equal(existsSync(join(temp, 'invalid-summary.json')), false);

  rmSync(join(five, 'invalid.json'));
  const duplicate = read(join(five, '1.json'));
  writeFileSync(join(five, 'duplicate.json'), `${JSON.stringify(duplicate, null, 2)}\n`);
  result = run(['aggregate', '--dir', five, '--out', join(temp, 'duplicate.md'),
    '--json', join(temp, 'duplicate-summary.json')]);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /duplicate sessionId/);

  const schema = read(join(ROOT, 'docs', 'usability', 'session.schema.json'));
  assert.equal(schema.additionalProperties, false);
  assert.equal(schema.properties.schemaVersion.const, 2);
  assert.deepEqual(schema.properties.entryPath.enum,
    ['npx', 'claude_repository_plugin', 'verified_installer']);
  assert.deepEqual(schema.properties.environment.properties.nodeMajor.enum, [22, 24]);
  const schemaText = JSON.stringify(schema);
  for (const forbidden of ['name', 'email', 'ipAddress', 'repositoryUrl', 'sourceCode', 'secret', 'terminalLog', 'freeText']) {
    assert.equal(schemaText.includes(`\"${forbidden}\"`), false, `schema must not accept ${forbidden}`);
  }
  console.log('usability study ok: private v2 records, three entry paths, comprehension and stop rules');
} finally {
  rmSync(temp, { recursive: true, force: true });
}
