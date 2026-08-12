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
  'This matrix separates deterministic product behavior from work an AI agent performs using the',
  'Skill methodology. Installing the Skill does not prove that a web project is secure.',
  '',
];

for (const [label, title] of Object.entries(source.labels)) {
  lines.push(`## ${title}`, '', '| Capability | Current boundary | Evidence |', '|---|---|---|');
  for (const capability of source.capabilities.filter((item) => item.label === label)) {
    const evidence = capability.evidence.map((path) => `[\`${path}\`](../${path})`).join(', ');
    lines.push(`| ${capability.name} | ${capability.scope} | ${evidence} |`);
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
