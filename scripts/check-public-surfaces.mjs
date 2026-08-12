#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = (path) => readFileSync(`${ROOT}/${path}`, 'utf8');
const normalize = (value) => value.replace(/\s+/g, ' ').trim();
const contract = JSON.parse(read('docs/public-contract.json'));
const capabilities = JSON.parse(read('docs/capabilities.json'));
const en = read('README.md');
const zh = read('README.zh-CN.md');
const evidence = read('docs/demo-evidence.md');

function fail(message) {
  console.error(`public surfaces: ${message}`);
  process.exitCode = 1;
}

if (contract.schemaVersion !== 1) fail('public contract schemaVersion must be 1');
for (const path of [...(contract.projectJourneys || []), ...(contract.methodStudies || [])]) {
  if (!existsSync(`${ROOT}/${path}`)) fail(`public evidence document is missing: ${path}`);
}
const journeyCount = contract.projectJourneys?.length ?? 0;
const studyCount = contract.methodStudies?.length ?? 0;
if (!en.includes(`## ${journeyCount} ordinary project journeys`)) fail('English project-journey count is stale');
if (!zh.includes(`## ${journeyCount} 个普通项目旅程`)) fail('Chinese project-journey count is stale');
if (!en.includes(`${studyCount} earlier source methodology studies`)) fail('English methodology-study count is stale');
if (!zh.includes(`${studyCount} 个既有源码方法论案例`)) fail('Chinese methodology-study count is stale');

for (const [locale, text] of [['en', en], ['zh-CN', zh]]) {
  if (!normalize(text).includes(normalize(contract.firstTaskPrompt[locale]))) {
    fail(`${locale} first-task prompt differs from docs/public-contract.json`);
  }
}

const headingOrder = [
  ['README.md', en, ['## See the result', '## Install', '## Run the first project', '## Capability boundary', '## Deterministic tools', '## Trust and release evidence']],
  ['README.zh-CN.md', zh, ['## 查看结果', '## 安装', '## 执行第一个项目', '## 能力边界', '## 确定性工具', '## 信任与 release 证据']],
];
for (const [path, text, headings] of headingOrder) {
  let cursor = -1;
  for (const heading of headings) {
    const index = text.indexOf(heading);
    if (index === -1) fail(`${path} is missing ${heading}`);
    if (index <= cursor) fail(`${path} has an invalid outcome-to-trust section order`);
    cursor = index;
  }
}

for (const [path, text] of [['README.md', en], ['README.zh-CN.md', zh]]) {
  for (const anchor of text.matchAll(/<a href="#([^"]+)">/g)) {
    if (!text.includes(`id="${anchor[1]}"`) && !text.includes(`name="${anchor[1]}"`)) {
      const derived = [...text.matchAll(/^#{1,6} (.+)$/gm)].some((match) => match[1]
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s-]/gu, '')
        .trim()
        .replace(/\s+/g, '-') === anchor[1]);
      if (!derived) fail(`${path} navigation anchor does not resolve: #${anchor[1]}`);
    }
  }
}

const labels = Object.keys(capabilities.labels);
const states = Object.keys(capabilities.resultStates);
for (const [path, text] of [['README.md', en], ['README.zh-CN.md', zh]]) {
  for (const state of states) if (!text.includes(`\`${state}\``)) fail(`${path} is missing ${state}`);
  if (!text.includes(`${labels.length} capability levels`)) {
    const localized = `${labels.length} 层能力`;
    if (!text.includes(localized)) fail(`${path} does not expose the generated capability-level count`);
  }
}

const result = evidence.match(/\| Owned local fixture \| (\d+) high, (\d+) medium .* \| (\d+) high, (\d+) medium \|/);
if (!result) fail('generated demo evidence has no result row');
if (result) {
  const [beforeHigh, beforeMedium, afterHigh, afterMedium] = result.slice(1);
  for (const [path, text] of [['README.md', en], ['README.zh-CN.md', zh]]) {
    for (const marker of [`${beforeHigh} high`, `${beforeMedium} medium`, `${afterHigh} high`, `${afterMedium} medium`]) {
      if (!text.includes(marker)) fail(`${path} is missing generated demo count ${marker}`);
    }
  }
}

if (/Replace the placeholder|替换占位符/.test(`${en}\n${zh}`)) fail('stale Action placeholder copy remains');
if (!process.exitCode) console.log(`public surfaces ok: ${journeyCount} journeys, ${studyCount} methodology studies, ${labels.length} capability levels, ${states.length} result states`);
