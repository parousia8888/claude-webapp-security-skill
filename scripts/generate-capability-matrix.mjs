#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const sourcePath = `${ROOT}/docs/capabilities.json`;
const outputPath = `${ROOT}/docs/capabilities.md`;
const check = process.argv.includes('--check');
const source = JSON.parse(readFileSync(sourcePath, 'utf8'));

const lines = [
  '# Capability matrix',
  '',
  '<!-- Generated from docs/capabilities.json. Run `node scripts/generate-capability-matrix.mjs`. -->',
  '',
  'This matrix separates what detects project risk from the infrastructure that records evidence,',
  'distributes the product, or guides an AI agent. A capability count is not vulnerability coverage,',
  'and installing the Skill does not prove that a web project is secure.',
  '',
  'Maturity is independent of category: `stable` behavior is implemented and regression-tested,',
  '`experimental` behavior has an explicit unstable boundary, `agent_guided` requires project',
  'context and judgment, and `planned` behavior is unavailable.',
  '',
];

for (const [category, title] of Object.entries(source.categories)) {
  lines.push(`## ${title}`, '', '| Capability | Maturity | Current boundary | Evidence |', '|---|---|---|---|');
  for (const capability of source.capabilities.filter((item) => item.category === category)) {
    const evidence = capability.maturity === 'planned'
      ? `Not shipped; planned for \`v${capability.plannedFor}\``
      : capability.evidence.map((path) => '[`' + path + '`](../' + path + ')').join(', ');
    lines.push(`| ${capability.name} | \`${capability.maturity}\` | ${capability.scope} | ${evidence} |`);
  }
  lines.push('');
}

lines.push(
  '## Result states',
  '',
  '| State | Meaning |',
  '|---|---|',
  ...Object.entries(source.resultStates).map(([state, meaning]) => `| \`${state}\` | ${meaning} |`),
  '',
  'An unavailable check is `unknown`, never a pass. Only a reproduced result with sufficient',
  'sanitized evidence is `confirmed`.',
  '',
);

const rendered = `${lines.join('\n')}\n`;
if (check) {
  if (!existsSync(outputPath) || readFileSync(outputPath, 'utf8') !== rendered) {
    console.error('capability matrix is stale; run node scripts/generate-capability-matrix.mjs');
    process.exit(1);
  }
  console.log('capability matrix current');
} else {
  writeFileSync(outputPath, rendered);
  console.log(outputPath);
}
