#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const rootIndex = args.indexOf('--root');
const ROOT = rootIndex === -1
  ? fileURLToPath(new URL('..', import.meta.url))
  : resolve(args[rootIndex + 1] || '');
if (rootIndex !== -1) args.splice(rootIndex, 2);
const live = args.includes('--live');
if (args.some((arg) => arg !== '--live')) {
  console.error('usage: node scripts/check-p7-surfaces.mjs [--root <repository>] [--live]');
  process.exit(2);
}

const read = (path) => readFileSync(`${ROOT}/${path}`, 'utf8');
const normalize = (value) => value.replace(/\s+/g, ' ').trim();
const metadata = JSON.parse(read('docs/github-metadata.json'));
const capabilities = JSON.parse(read('docs/capabilities.json'));
const contract = JSON.parse(read('docs/public-contract.json'));
const journeys = JSON.parse(read('docs/case-studies/journeys/evidence.json'));
const surfaces = {
  readme: read('README.md'),
  zh: read('README.zh-CN.md'),
  agent: read('README_AI.md'),
  tutorial: read('docs/tutorial.md'),
  tutorialZh: read('docs/tutorial.zh-CN.md'),
  launch: read('docs/launch-evidence.md'),
  roadmap: read('ROADMAP.md'),
  release: read(`docs/releases/v${read('VERSION').trim()}.md`),
};

function fail(message) {
  console.error(`P7 surfaces: ${message}`);
  process.exitCode = 1;
}

if (metadata.schemaVersion !== 1) fail('metadata schemaVersion must be 1');
if (metadata.repository !== 'parousia8888/web-app-security-skill') fail('repository identity drifted');
if (metadata.description !== metadata.promise?.en || metadata.description.length > 160) {
  fail('GitHub description must be the canonical short promise and fit the GitHub limit');
}
if (metadata.homepage !== `https://github.com/${metadata.repository}/blob/main/docs/tutorial.md`) {
  fail('homepage must resolve to the maintained human tutorial');
}
if (new Set(metadata.topics).size !== metadata.topics.length
    || [...metadata.topics].sort().join('\n') !== metadata.topics.join('\n')) {
  fail('topics must be unique and sorted');
}

for (const [path, text, markers] of [
  ['README.md', surfaces.readme, [metadata.promise.en, 'docs/tutorial.md', 'docs/launch-evidence.md']],
  ['README.zh-CN.md', surfaces.zh, [metadata.promise['zh-CN'], 'docs/tutorial.zh-CN.md', 'docs/launch-evidence.md']],
  ['docs/tutorial.md', surfaces.tutorial, [metadata.promise.en, 'install', 'version', 'start .', 'audit ', 'explain ', 'proposed.patch', 'retest ', 'upgrade', 'uninstall', '--acknowledge-authorization', 'false-positive.yml']],
  ['docs/tutorial.zh-CN.md', surfaces.tutorialZh, [metadata.promise['zh-CN'], 'install', 'version', 'start .', 'audit ', 'explain ', 'proposed.patch', 'retest ', 'upgrade', 'uninstall', '--acknowledge-authorization', 'false-positive.yml']],
  ['README_AI.md', surfaces.agent, ['Repository-mode first run', 'Result interpretation', 'Patch and change handling', 'Lifecycle', 'Stop conditions', 'patch-only', 'fixed', 'unchanged', 'regressed']],
  [`docs/releases/v${read('VERSION').trim()}.md`, surfaces.release, [metadata.promise.en]],
]) {
  for (const marker of markers) {
    if (!normalize(text).includes(normalize(marker))) fail(`${path} is missing ${marker}`);
  }
}
for (const state of Object.keys(capabilities.resultStates)) {
  for (const [path, text] of [['docs/tutorial.md', surfaces.tutorial], ['docs/tutorial.zh-CN.md', surfaces.tutorialZh], ['README_AI.md', surfaces.agent]]) {
    if (!text.includes(`\`${state}\``)) fail(`${path} is missing result state ${state}`);
  }
}
for (const marker of [
  `${capabilities.capabilities.length} capabilities`,
  `${journeys.journeys.length} fixed-commit source journeys`,
  `${contract.methodStudies.length} fixed-commit studies`,
  '13 high / 6 medium -> 0 high / 0 medium',
  `releases/tag/v${read('VERSION').trim()}`,
]) if (!surfaces.launch.includes(marker)) fail(`launch evidence is missing ${marker}`);

if (!surfaces.roadmap.includes('## Shipped in v0.3.0') || surfaces.roadmap.includes('## v0.4')) {
  fail('roadmap does not separate shipped v0.3.0 behavior from current backlog');
}
for (const [path, text] of [['README.md', surfaces.readme], ['README.zh-CN.md', surfaces.zh], ['docs/launch-evidence.md', surfaces.launch]]) {
  if (/img\.shields\.io\/github\/(?:stars|forks)|\/stargazers|star target/i.test(text)) {
    fail(`${path} uses adoption metrics as a public engineering surface`);
  }
}
const issueForms = ['bug.yml', 'false-positive.yml', 'good-first-issue.yml'].map((name) =>
  read(`.github/ISSUE_TEMPLATE/${name}`)).join('\n');
for (const label of metadata.requiredLabels) {
  if (!/^[0-9a-f]{6}$/.test(label.color) || !label.name || !label.description) fail(`invalid label source: ${label.name}`);
  if (['needs-triage', 'false-positive'].includes(label.name) && !issueForms.includes(`"${label.name}"`)) {
    fail(`issue forms do not use required label ${label.name}`);
  }
}

if (live) {
  const repoResult = spawnSync('gh', ['repo', 'view', metadata.repository, '--json', 'description,homepageUrl,repositoryTopics'], { encoding: 'utf8' });
  if (repoResult.status !== 0) fail(repoResult.stderr || 'unable to read live GitHub metadata');
  else {
    const repo = JSON.parse(repoResult.stdout);
    const topics = (repo.repositoryTopics || []).map((item) => item.name).sort();
    if (repo.description !== metadata.description) fail('live GitHub description differs from source');
    if (repo.homepageUrl !== metadata.homepage) fail('live GitHub homepage differs from source');
    if (topics.join('\n') !== metadata.topics.join('\n')) fail('live GitHub topics differ from source');
  }
  const labelResult = spawnSync('gh', ['label', 'list', '--repo', metadata.repository, '--limit', '100', '--json', 'name,color,description'], { encoding: 'utf8' });
  if (labelResult.status !== 0) fail(labelResult.stderr || 'unable to read live GitHub labels');
  else {
    const labels = new Map(JSON.parse(labelResult.stdout).map((item) => [item.name, item]));
    for (const expected of metadata.requiredLabels) {
      const actual = labels.get(expected.name);
      if (!actual || actual.color.toLowerCase() !== expected.color || actual.description !== expected.description) {
        fail(`live GitHub label differs from source: ${expected.name}`);
      }
    }
  }
}

if (!process.exitCode) {
  console.log(`P7 surfaces ok: tutorials, agent lifecycle, ${capabilities.capabilities.length} capabilities, ${journeys.journeys.length} journeys, ${contract.methodStudies.length} studies${live ? ', live GitHub metadata' : ''}`);
}
