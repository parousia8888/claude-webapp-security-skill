#!/usr/bin/env node
import { randomBytes } from 'node:crypto';
import {
  existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync,
} from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const STUDY = 'first-use-v2';
const TARGET_SESSIONS = 5;
const MAX_SESSIONS = 10;
const SESSION_ID = /^S-[A-F0-9]{8}$/;
const SURFACES = ['claude', 'codex', 'cli'];
const ENTRY_PATHS = ['npx', 'claude_repository_plugin', 'verified_installer'];
const SYSTEMS = ['linux', 'macos', 'wsl2'];
const NODE_MAJORS = [22, 24];
const OUTCOMES = ['completed', 'blocked', 'abandoned', 'not_attempted'];
const BLOCKAGES = [
  'none', 'prerequisite', 'install_trust', 'install_conflict', 'command_discovery',
  'scope_comprehension', 'report_generation', 'result_state_comprehension',
  'patch_review', 'retest',
];
const COMPREHENSION = ['correct', 'partial', 'incorrect', 'not_reached'];
const SUSPECTED_MEANINGS = ['lead_requires_confirmation', 'confirmed_vulnerability', 'unclear', 'not_reached'];
const CONFIDENCE = ['ready_with_review', 'needs_help', 'would_not_apply', 'not_reached'];
const SESSION_OUTCOMES = ['completed', 'abandoned', 'incomplete'];
const ALLOWED_TOP_LEVEL = new Set([
  'schemaVersion', 'study', 'sessionId', 'sessionSequence', 'entryPath', 'consent', 'fixture', 'environment',
  'installation', 'firstReport', 'firstBlockage', 'resultStateComprehension',
  'suspectedMeaning', 'patchConfidence', 'sideEffectComprehension', 'retest',
  'retestDistinctionComprehension', 'sessionOutcome', 'manualNotesPresent',
]);
const args = process.argv.slice(2);
const command = args.shift();

function usage(code, message) {
  if (message) console.error(`error: ${message}`);
  console.log(`node scripts/usability-study.mjs <command> [options]

Commands:
  init --out <json> --surface <claude|codex|cli>
       --entry-path <npx|claude_repository_plugin|verified_installer>
       --sequence <1..10> --os <linux|macos|wsl2> --node-major <22|24>
       --consent [--session-id S-XXXXXXXX]
  record <json> [observation options]
  validate <json> [json ...]
  aggregate --dir <session-directory> --out <summary.md> --json <summary.json>

Record options:
  --installation-status <status>  --installation-seconds <0..7200>
  --first-report-status <status>  --first-report-seconds <0..7200>
  --first-blockage <category>
  --comprehension <correct|partial|incorrect|not_reached>
  --suspected-meaning <lead_requires_confirmation|confirmed_vulnerability|unclear|not_reached>
  --patch-confidence <ready_with_review|needs_help|would_not_apply|not_reached>
  --side-effect-comprehension <correct|partial|incorrect|not_reached>
  --retest-status <status>  --retest-seconds <0..7200>
  --retest-distinction <correct|partial|incorrect|not_reached>
  --session-outcome <completed|abandoned|incomplete>
  --manual-notes-present <true|false>

Timed status: completed, blocked, abandoned, or not_attempted. A non-attempted step has null seconds;
every other status requires seconds. Unknown fields and free text are rejected.
`);
  process.exit(code);
}

function take(name, fallback = null) {
  const index = args.indexOf(name);
  if (index === -1) return fallback;
  if (!args[index + 1] || args[index + 1].startsWith('--')) usage(2, `${name} requires a value`);
  return args.splice(index, 2)[1];
}

function flag(name) {
  const index = args.indexOf(name);
  if (index === -1) return false;
  args.splice(index, 1);
  return true;
}

function exactObject(value, keys, label, errors) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    errors.push(`${label} must be an object`);
    return false;
  }
  for (const key of Object.keys(value)) {
    if (!keys.includes(key)) errors.push(`${label}.${key} is not allowed`);
  }
  for (const key of keys) {
    if (!(key in value)) errors.push(`${label}.${key} is required`);
  }
  return true;
}

function validateTimed(value, label, errors) {
  if (!exactObject(value, ['status', 'seconds'], label, errors)) return;
  if (!OUTCOMES.includes(value.status)) errors.push(`${label}.status is invalid`);
  if (value.status === 'not_attempted') {
    if (value.seconds !== null) errors.push(`${label}.seconds must be null when not_attempted`);
  } else if (!Number.isInteger(value.seconds) || value.seconds < 0 || value.seconds > 7200) {
    errors.push(`${label}.seconds must be an integer from 0 to 7200`);
  }
}

export function validateSession(record) {
  const errors = [];
  if (!record || typeof record !== 'object' || Array.isArray(record)) return ['record must be an object'];
  for (const key of Object.keys(record)) {
    if (!ALLOWED_TOP_LEVEL.has(key)) errors.push(`${key} is not allowed; free text and identifying data are rejected`);
  }
  for (const key of ALLOWED_TOP_LEVEL) {
    if (!(key in record)) errors.push(`${key} is required`);
  }
  if (record.schemaVersion !== 2) errors.push('schemaVersion must be 2');
  if (record.study !== STUDY) errors.push(`study must be ${STUDY}`);
  if (!SESSION_ID.test(record.sessionId || '')) errors.push('sessionId must match S-XXXXXXXX using uppercase hex');
  if (!Number.isInteger(record.sessionSequence)
      || record.sessionSequence < 1 || record.sessionSequence > MAX_SESSIONS) {
    errors.push(`sessionSequence must be an integer from 1 to ${MAX_SESSIONS}`);
  }
  if (!ENTRY_PATHS.includes(record.entryPath)) errors.push('entryPath is invalid');
  if (exactObject(record.consent, ['observationAccepted', 'dataBoundaryAccepted'], 'consent', errors)) {
    if (record.consent.observationAccepted !== true || record.consent.dataBoundaryAccepted !== true) {
      errors.push('both consent values must be true; stop the session otherwise');
    }
  }
  if (exactObject(record.fixture, ['id', 'repositoryDataShared', 'networkRequired'], 'fixture', errors)) {
    if (record.fixture.id !== 'first-use-clean-room-v1') errors.push('fixture.id is invalid');
    if (record.fixture.repositoryDataShared !== false) errors.push('fixture.repositoryDataShared must be false');
    if (record.fixture.networkRequired !== false) errors.push('fixture.networkRequired must be false');
  }
  if (exactObject(record.environment, ['surface', 'os', 'nodeMajor'], 'environment', errors)) {
    if (!SURFACES.includes(record.environment.surface)) errors.push('environment.surface is invalid');
    if (!SYSTEMS.includes(record.environment.os)) errors.push('environment.os is invalid');
    if (!NODE_MAJORS.includes(record.environment.nodeMajor)) errors.push('environment.nodeMajor is invalid');
  }
  if (record.entryPath === 'claude_repository_plugin' && record.environment?.surface !== 'claude') {
    errors.push('claude_repository_plugin requires environment.surface claude');
  }
  validateTimed(record.installation, 'installation', errors);
  validateTimed(record.firstReport, 'firstReport', errors);
  validateTimed(record.retest, 'retest', errors);
  if (!BLOCKAGES.includes(record.firstBlockage)) errors.push('firstBlockage is invalid');
  if (!COMPREHENSION.includes(record.resultStateComprehension)) errors.push('resultStateComprehension is invalid');
  if (!SUSPECTED_MEANINGS.includes(record.suspectedMeaning)) errors.push('suspectedMeaning is invalid');
  if (!CONFIDENCE.includes(record.patchConfidence)) errors.push('patchConfidence is invalid');
  if (!COMPREHENSION.includes(record.sideEffectComprehension)) errors.push('sideEffectComprehension is invalid');
  if (!COMPREHENSION.includes(record.retestDistinctionComprehension)) {
    errors.push('retestDistinctionComprehension is invalid');
  }
  if (!SESSION_OUTCOMES.includes(record.sessionOutcome)) errors.push('sessionOutcome is invalid');
  if (typeof record.manualNotesPresent !== 'boolean') errors.push('manualNotesPresent must be boolean');
  if (record.sessionOutcome === 'completed'
      && [record.installation?.status, record.firstReport?.status, record.retest?.status].some((value) => value !== 'completed')) {
    errors.push('a completed session requires installation, firstReport, and retest to be completed');
  }
  return errors;
}

function readSession(path) {
  let record;
  try {
    record = JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    throw new Error(`${basename(path)}: invalid JSON: ${error.message}`);
  }
  const errors = validateSession(record);
  if (errors.length) throw new Error(`${basename(path)}:\n${errors.map((error) => `- ${error}`).join('\n')}`);
  return record;
}

function writePrivate(path, value, overwrite = false) {
  const target = resolve(path);
  if (existsSync(target) && !overwrite) throw new Error(`refusing to overwrite ${target}`);
  mkdirSync(dirname(target), { recursive: true, mode: 0o700 });
  writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
}

function parseInteger(name, value) {
  if (!/^\d+$/.test(value || '')) usage(2, `${name} must be an integer`);
  const number = Number(value);
  if (number > 7200) usage(2, `${name} must not exceed 7200`);
  return number;
}

function parseBoolean(name, value) {
  if (!['true', 'false'].includes(value)) usage(2, `${name} must be true or false`);
  return value === 'true';
}

function emptyTimed() {
  return { status: 'not_attempted', seconds: null };
}

function init() {
  const out = take('--out');
  const surface = take('--surface');
  const entryPath = take('--entry-path');
  const sequence = Number(take('--sequence'));
  const os = take('--os');
  const nodeMajor = Number(take('--node-major'));
  const sessionId = take('--session-id', `S-${randomBytes(4).toString('hex').toUpperCase()}`);
  const consent = flag('--consent');
  if (!out || !surface || !entryPath || !sequence || !os || !nodeMajor) {
    usage(2, 'init requires --out, --surface, --entry-path, --sequence, --os, and --node-major');
  }
  if (!consent) usage(2, 'init requires --consent; stop if the participant does not accept');
  if (args.length) usage(2, `unknown option ${args[0]}`);
  const record = {
    schemaVersion: 2,
    study: STUDY,
    sessionId,
    sessionSequence: sequence,
    entryPath,
    consent: { observationAccepted: true, dataBoundaryAccepted: true },
    fixture: { id: 'first-use-clean-room-v1', repositoryDataShared: false, networkRequired: false },
    environment: { surface, os, nodeMajor },
    installation: emptyTimed(),
    firstReport: emptyTimed(),
    firstBlockage: 'none',
    resultStateComprehension: 'not_reached',
    suspectedMeaning: 'not_reached',
    patchConfidence: 'not_reached',
    sideEffectComprehension: 'not_reached',
    retest: emptyTimed(),
    retestDistinctionComprehension: 'not_reached',
    sessionOutcome: 'incomplete',
    manualNotesPresent: false,
  };
  const errors = validateSession(record);
  if (errors.length) usage(2, errors.join('; '));
  writePrivate(out, record);
  console.log(`initialized: ${resolve(out)}`);
  console.log(`session:     ${sessionId}`);
}

function updateTimed(record, field, statusOption, secondsOption) {
  const status = take(statusOption);
  const seconds = take(secondsOption);
  if (status !== null) record[field].status = status;
  if (seconds !== null) record[field].seconds = parseInteger(secondsOption, seconds);
  if (status === 'not_attempted' && seconds === null) record[field].seconds = null;
}

function recordObservation() {
  const path = args.shift();
  if (!path || path.startsWith('--')) usage(2, 'record requires a session JSON path');
  const record = readSession(resolve(path));
  updateTimed(record, 'installation', '--installation-status', '--installation-seconds');
  updateTimed(record, 'firstReport', '--first-report-status', '--first-report-seconds');
  updateTimed(record, 'retest', '--retest-status', '--retest-seconds');
  const blockage = take('--first-blockage');
  const comprehension = take('--comprehension');
  const suspectedMeaning = take('--suspected-meaning');
  const confidence = take('--patch-confidence');
  const sideEffectComprehension = take('--side-effect-comprehension');
  const retestDistinction = take('--retest-distinction');
  const outcome = take('--session-outcome');
  const notes = take('--manual-notes-present');
  if (blockage !== null) record.firstBlockage = blockage;
  if (comprehension !== null) record.resultStateComprehension = comprehension;
  if (suspectedMeaning !== null) record.suspectedMeaning = suspectedMeaning;
  if (confidence !== null) record.patchConfidence = confidence;
  if (sideEffectComprehension !== null) record.sideEffectComprehension = sideEffectComprehension;
  if (retestDistinction !== null) record.retestDistinctionComprehension = retestDistinction;
  if (outcome !== null) record.sessionOutcome = outcome;
  if (notes !== null) record.manualNotesPresent = parseBoolean('--manual-notes-present', notes);
  if (args.length) usage(2, `unknown option ${args[0]}`);
  const errors = validateSession(record);
  if (errors.length) throw new Error(errors.join('\n'));
  writePrivate(path, record, true);
  console.log(`recorded:  ${resolve(path)}`);
  console.log(`outcome:   ${record.sessionOutcome}`);
}

function validateFiles() {
  if (!args.length) usage(2, 'validate requires at least one JSON path');
  for (const path of args) {
    const record = readSession(resolve(path));
    console.log(`valid: ${path} (${record.sessionId}, ${record.sessionOutcome})`);
  }
}

function count(records, field, values) {
  return Object.fromEntries(values.map((value) => [value, records.filter((record) => record[field] === value).length]));
}

function countTimed(records, field) {
  return Object.fromEntries(OUTCOMES.map((value) => [value, records.filter((record) => record[field].status === value).length]));
}

function medianCompleted(records, field) {
  const values = records.filter((record) => record[field].status === 'completed')
    .map((record) => record[field].seconds).sort((a, b) => a - b);
  if (!values.length) return null;
  const middle = Math.floor(values.length / 2);
  return values.length % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2;
}

function renderSummary(summary) {
  const table = (title, values) => [
    `## ${title}`, '', '| Value | Sessions |', '|---|---:|',
    ...Object.entries(values).map(([value, total]) => `| \`${value}\` | ${total} |`), '',
  ];
  const lines = [
    '# First-use study summary', '',
    `- Data collection: \`${summary.dataCollectionStatus}\``,
    `- Schema-valid sessions: ${summary.recordedSessions} / ${summary.targetSessions}`,
    `- Missing sessions: ${summary.missingSessions}`,
    `- Manual-note records requiring separate review: ${summary.manualReviewSessionIds.length}`,
    '',
    ...table('Session outcomes', summary.sessionOutcomes),
    ...table('Entry paths', summary.entryPaths),
    ...table('Installation', summary.installation),
    ...table('First report', summary.firstReport),
    ...table('First blockage', summary.firstBlockage),
    ...table('Result-state comprehension', summary.resultStateComprehension),
    ...table('Meaning assigned to suspected', summary.suspectedMeaning),
    ...table('Patch confidence', summary.patchConfidence),
    ...table('Patch-side-effect comprehension', summary.sideEffectComprehension),
    ...table('Retest', summary.retest),
    ...table('Security/product retest distinction', summary.retestDistinctionComprehension),
    '## Broad-publication stop rules', '',
    `- Decision state: \`${summary.publicationGate.state}\``,
    `- First five reaching a report: ${summary.stopConditions.firstFiveFirstReport.completed} / 5 (minimum 4; evaluated: ${summary.stopConditions.firstFiveFirstReport.evaluated})`,
    `- Suspected interpreted as confirmed: ${summary.stopConditions.suspectedTreatedAsConfirmed.observed} (stop at 2)`,
    `- Repeated install/command blockages: ${summary.stopConditions.repeatedInstallOrCommandBlockage.categories.length
      ? summary.stopConditions.repeatedInstallOrCommandBlockage.categories.map((item) => `\`${item.category}\` (${item.sessions})`).join(', ')
      : 'none'}`,
    `- Triggered rules: ${summary.publicationGate.triggeredRules.length
      ? summary.publicationGate.triggeredRules.map((item) => `\`${item}\``).join(', ')
      : 'none'}`,
    '',
    '## Completed-step median seconds', '',
    `- Installation: ${summary.completedStepMedianSeconds.installation ?? 'not available'}`,
    `- First report: ${summary.completedStepMedianSeconds.firstReport ?? 'not available'}`,
    `- Retest: ${summary.completedStepMedianSeconds.retest ?? 'not available'}`,
    '', '## Manual review boundary', '',
    summary.manualReviewSessionIds.length
      ? `Review offline notes for: ${summary.manualReviewSessionIds.map((id) => `\`${id}\``).join(', ')}.`
      : 'No session declared separate manual notes.',
    '', '## Limitations', '',
    ...summary.limitations.map((item) => `- ${item}`), '',
  ];
  return `${lines.join('\n')}\n`;
}

function aggregate() {
  const directory = resolve(take('--dir') || '');
  const out = take('--out');
  const jsonOut = take('--json');
  const force = flag('--force');
  if (!directory || !out || !jsonOut) usage(2, 'aggregate requires --dir, --out, and --json');
  if (args.length) usage(2, `unknown option ${args[0]}`);
  if (!existsSync(directory) || !statSync(directory).isDirectory()) throw new Error(`session directory not found: ${directory}`);
  const markdownPath = resolve(out);
  const jsonPath = resolve(jsonOut);
  if (markdownPath === jsonPath) throw new Error('--out and --json must be different paths');
  for (const target of [markdownPath, jsonPath]) {
    if (existsSync(target) && !force) throw new Error(`refusing to overwrite ${target}`);
  }
  const paths = readdirSync(directory).filter((name) => name.endsWith('.json')).sort()
    .map((name) => join(directory, name));
  const records = paths.map(readSession);
  const ids = records.map((record) => record.sessionId);
  const duplicate = ids.find((id, index) => ids.indexOf(id) !== index);
  if (duplicate) throw new Error(`duplicate sessionId: ${duplicate}`);
  const sequences = records.map((record) => record.sessionSequence).sort((a, b) => a - b);
  const duplicateSequence = sequences.find((value, index) => sequences.indexOf(value) !== index);
  if (duplicateSequence) throw new Error(`duplicate sessionSequence: ${duplicateSequence}`);
  const expectedSequences = Array.from({ length: records.length }, (_, index) => index + 1);
  if (JSON.stringify(sequences) !== JSON.stringify(expectedSequences)) {
    throw new Error(`sessionSequence values must be contiguous from 1; received ${sequences.join(', ') || 'none'}`);
  }
  const ordered = [...records].sort((a, b) => a.sessionSequence - b.sessionSequence);
  const firstFive = ordered.slice(0, TARGET_SESSIONS);
  const firstFiveReports = firstFive.filter((record) => record.firstReport.status === 'completed').length;
  const suspectedAsConfirmed = records.filter((record) =>
    record.suspectedMeaning === 'confirmed_vulnerability').length;
  const stopBlockages = ['prerequisite', 'install_trust', 'install_conflict', 'command_discovery'];
  const stopBlockageCounts = count(records, 'firstBlockage', stopBlockages);
  const repeatedBlockages = Object.entries(stopBlockageCounts)
    .filter(([, total]) => total >= 2).map(([category, sessions]) => ({ category, sessions }));
  const stopConditions = {
    firstFiveFirstReport: {
      evaluated: firstFive.length === TARGET_SESSIONS,
      completed: firstFiveReports,
      minimum: 4,
      triggered: firstFive.length === TARGET_SESSIONS && firstFiveReports < 4,
    },
    suspectedTreatedAsConfirmed: {
      observed: suspectedAsConfirmed,
      threshold: 2,
      triggered: suspectedAsConfirmed >= 2,
    },
    repeatedInstallOrCommandBlockage: {
      categories: repeatedBlockages,
      threshold: 2,
      triggered: repeatedBlockages.length > 0,
    },
  };
  const triggeredRules = Object.entries(stopConditions)
    .filter(([, value]) => value.triggered).map(([name]) => name);
  const publicationGate = {
    state: triggeredRules.length ? 'stop'
      : records.length < TARGET_SESSIONS ? 'insufficient_data' : 'owner_review_required',
    triggeredRules,
  };
  const summary = {
    schemaVersion: 2,
    study: STUDY,
    dataCollectionStatus: records.length < TARGET_SESSIONS ? 'incomplete' : 'sufficient_for_review',
    targetSessions: TARGET_SESSIONS,
    recordedSessions: records.length,
    missingSessions: Math.max(0, TARGET_SESSIONS - records.length),
    sessionOutcomes: count(records, 'sessionOutcome', SESSION_OUTCOMES),
    entryPaths: count(records, 'entryPath', ENTRY_PATHS),
    installation: countTimed(records, 'installation'),
    firstReport: countTimed(records, 'firstReport'),
    firstBlockage: count(records, 'firstBlockage', BLOCKAGES),
    resultStateComprehension: count(records, 'resultStateComprehension', COMPREHENSION),
    suspectedMeaning: count(records, 'suspectedMeaning', SUSPECTED_MEANINGS),
    patchConfidence: count(records, 'patchConfidence', CONFIDENCE),
    sideEffectComprehension: count(records, 'sideEffectComprehension', COMPREHENSION),
    retest: countTimed(records, 'retest'),
    retestDistinctionComprehension: count(records, 'retestDistinctionComprehension', COMPREHENSION),
    stopConditions,
    publicationGate,
    completedStepMedianSeconds: {
      installation: medianCompleted(records, 'installation'),
      firstReport: medianCompleted(records, 'firstReport'),
      retest: medianCompleted(records, 'retest'),
    },
    manualReviewSessionIds: records.filter((record) => record.manualNotesPresent)
      .map((record) => record.sessionId).sort(),
    limitations: [
      'Sufficient_for_review means only that five schema-valid records exist; it is not a pass, usability score, or security result.',
      'The aggregate does not infer missing observations, participant intent, causal attribution, or free-text meaning.',
      'Records use the owned clean-room fixture and do not establish behavior on arbitrary repositories.',
      'Stop rules identify observed thresholds only; they do not establish why a participant blocked or misunderstood a result.',
    ],
  };
  writePrivate(jsonPath, summary, force);
  mkdirSync(dirname(markdownPath), { recursive: true, mode: 0o700 });
  writeFileSync(markdownPath, renderSummary(summary), { mode: 0o600 });
  console.log(`aggregate: ${summary.dataCollectionStatus}`);
  console.log(`sessions:  ${summary.recordedSessions}/${summary.targetSessions}`);
  console.log(`gate:      ${summary.publicationGate.state}`);
  console.log(`summary:   ${markdownPath}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (['-h', '--help', undefined].includes(command)) usage(command ? 0 : 2);
    if (command === 'init') init();
    else if (command === 'record') recordObservation();
    else if (command === 'validate') validateFiles();
    else if (command === 'aggregate') aggregate();
    else usage(2, `unknown command ${command}`);
  } catch (error) {
    console.error(`error: ${error.message}`);
    process.exit(2);
  }
}
