#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const args = process.argv.slice(2);
const inputIndex = args.indexOf('--input');
const outputIndex = args.indexOf('--output');
if (inputIndex === -1 || outputIndex === -1 || !args[inputIndex + 1] || !args[outputIndex + 1]
    || args.some((arg, index) => !['--input', '--output'].includes(arg)
      && index !== inputIndex + 1 && index !== outputIndex + 1)) {
  console.error('usage: node scripts/render-public-case.mjs --input <case.json> --output <case.md>');
  process.exit(2);
}

const input = resolve(args[inputIndex + 1]);
const output = resolve(args[outputIndex + 1]);
const states = new Set(['confirmed', 'suspected', 'unknown', 'not_applicable']);
const patchStates = new Set(['not_required', 'proposed', 'applied_locally', 'applied_upstream']);
const retestStates = new Set(['fixed', 'unchanged', 'regressed', 'not_run']);
const disclosureStates = new Set(['not_required', 'private_draft', 'reported_privately', 'coordinated_public', 'public_by_upstream']);
const publicDisclosureStates = new Set(['not_required', 'coordinated_public', 'public_by_upstream']);

function requireValue(condition, path) {
  if (!condition) throw new Error(`invalid or missing ${path}`);
}

function validate(value) {
  requireValue(value && typeof value === 'object' && !Array.isArray(value), 'case');
  requireValue(value.schemaVersion === 1, 'schemaVersion');
  requireValue(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value.caseId || ''), 'caseId');
  requireValue(typeof value.project?.name === 'string' && value.project.name.length > 0, 'project.name');
  requireValue(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(value.project?.repository || ''), 'project.repository');
  requireValue(/^[a-f0-9]{40}$/.test(value.source?.commit || ''), 'source.commit');
  requireValue(typeof value.source?.hostedInstanceProbed === 'boolean', 'source.hostedInstanceProbed');
  requireValue(typeof value.source?.networkDenied === 'boolean', 'source.networkDenied');
  requireValue(typeof value.authorizationBoundary === 'string' && value.authorizationBoundary.length > 0, 'authorizationBoundary');
  requireValue(Array.isArray(value.evidence) && value.evidence.length > 0, 'evidence');
  value.evidence.forEach((item, index) => {
    requireValue(typeof item.id === 'string' && item.id.length > 0, `evidence[${index}].id`);
    requireValue(typeof item.title === 'string' && item.title.length > 0, `evidence[${index}].title`);
    requireValue(states.has(item.state), `evidence[${index}].state`);
    requireValue(typeof item.summary === 'string' && item.summary.length > 0, `evidence[${index}].summary`);
    requireValue(Array.isArray(item.locations) && item.locations.length > 0
      && item.locations.every((location) => typeof location === 'string' && location.length > 0), `evidence[${index}].locations`);
  });
  requireValue(Array.isArray(value.falsePositiveClosures), 'falsePositiveClosures');
  requireValue(patchStates.has(value.patch?.status), 'patch.status');
  requireValue(typeof value.patch?.summary === 'string' && value.patch.summary.length > 0, 'patch.summary');
  requireValue(retestStates.has(value.retest?.result), 'retest.result');
  requireValue(typeof value.retest?.summary === 'string' && value.retest.summary.length > 0, 'retest.summary');
  requireValue(disclosureStates.has(value.disclosure?.state), 'disclosure.state');
  requireValue(typeof value.disclosure?.upstreamResponse === 'string', 'disclosure.upstreamResponse');
  requireValue(typeof value.disclosure?.publicAuthorization === 'boolean', 'disclosure.publicAuthorization');
  requireValue(Array.isArray(value.limitations) && value.limitations.length > 0, 'limitations');
  requireValue(publicDisclosureStates.has(value.disclosure.state),
    'disclosure.state: public rendering requires not_required, coordinated_public, or public_by_upstream');
  requireValue(value.disclosure.publicAuthorization === true, 'disclosure.publicAuthorization for public rendering');
  if (value.evidence.some((item) => item.state === 'suspected')) {
    requireValue(['coordinated_public', 'public_by_upstream'].includes(value.disclosure.state),
      'disclosure.state: suspected evidence requires coordinated public disclosure');
  }
}

function bullets(items, empty) {
  return items.length ? items.map((item) => `- ${item}`).join('\n') : `- ${empty}`;
}

try {
  requireValue(existsSync(input), 'input file');
  const value = JSON.parse(readFileSync(input, 'utf8'));
  validate(value);
  const commitUrl = `https://github.com/${value.project.repository}/tree/${value.source.commit}`;
  const lines = [
    `# ${value.project.name}: public security case`,
    '',
    '> Evidence record, not a project security score or a claim of complete coverage.',
    '',
    '## Source and boundary',
    '',
    `- Repository: [${value.project.repository}](https://github.com/${value.project.repository})`,
    `- Immutable source: [\`${value.source.commit}\`](${commitUrl})`,
    `- Hosted instance probed: \`${value.source.hostedInstanceProbed}\``,
    `- Network denied during source work: \`${value.source.networkDenied}\``,
    `- Authorization/source boundary: ${value.authorizationBoundary}`,
    '',
    '## Evidence outcomes',
    '',
    '| ID | State | Outcome | Evidence |',
    '|---|---|---|---|',
    ...value.evidence.map((item) => `| \`${item.id}\` | \`${item.state}\` | ${item.title}: ${item.summary} | ${item.locations.map((location) => `\`${location}\``).join('<br>')} |`),
    '',
    '## False-positive closure',
    '',
    bullets(value.falsePositiveClosures, 'No false-positive closure recorded.'),
    '',
    '## Minimal patch and retest',
    '',
    `- Patch: \`${value.patch.status}\` - ${value.patch.summary}`,
    `- Retest: \`${value.retest.result}\` - ${value.retest.summary}`,
    '',
    '## Disclosure',
    '',
    `- State: \`${value.disclosure.state}\``,
    `- Public authorization: \`${value.disclosure.publicAuthorization}\``,
    `- Upstream response: ${value.disclosure.upstreamResponse || 'None; not required or not received.'}`,
    '',
    '## Limitations',
    '',
    bullets(value.limitations, 'No limitation recorded.'),
    '',
  ];
  writeFileSync(output, lines.join('\n'));
  console.log(`public case rendered: ${value.caseId} -> ${output}`);
} catch (error) {
  console.error(`public case: ${error.message}`);
  process.exit(1);
}
