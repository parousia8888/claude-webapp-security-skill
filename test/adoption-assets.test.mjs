#!/usr/bin/env node
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const GENERATOR = join(ROOT, 'scripts', 'generate-adoption-assets.mjs');
const RENDERER = join(ROOT, 'scripts', 'render-public-case.mjs');
const FIXTURE = join(ROOT, 'test', 'fixtures', 'public-case', 'no-live-target.json');
const temp = mkdtempSync(join(tmpdir(), 'web-app-security-adoption-'));

function runRenderer(value, name) {
  const input = join(temp, `${name}.json`);
  const output = join(temp, `${name}.md`);
  writeFileSync(input, `${JSON.stringify(value, null, 2)}\n`);
  return {
    result: spawnSync(process.execPath, [RENDERER, '--input', input, '--output', output], {
      cwd: ROOT,
      encoding: 'utf8',
      env: { ...process.env, NODE_OPTIONS: `--require=${join(ROOT, 'test', 'helpers', 'deny-network.cjs')}` },
    }),
    output,
  };
}

try {
  let result = spawnSync(process.execPath, [GENERATOR, '--check'], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /10 files, 18 capabilities, 3 journeys, 5 studies/);

  const schema = JSON.parse(readFileSync(join(ROOT, 'docs', 'case-studies', 'template.schema.json'), 'utf8'));
  assert.equal(schema.properties.source.properties.commit.pattern, '^[a-f0-9]{40}$');
  assert.deepEqual(schema.properties.evidence.items.properties.state.enum,
    ['confirmed', 'suspected', 'unknown', 'not_applicable']);
  assert.ok(schema.properties.retest.required.includes('result'));
  assert.ok(schema.properties.disclosure.required.includes('state'));
  assert.deepEqual(schema.allOf[0].then.properties.disclosure.properties.state.enum,
    ['coordinated_public', 'public_by_upstream']);

  const fixture = JSON.parse(readFileSync(FIXTURE, 'utf8'));
  const valid = runRenderer(fixture, 'valid');
  assert.equal(valid.result.status, 0, valid.result.stderr);
  const rendered = readFileSync(valid.output, 'utf8');
  assert.match(rendered, /Hosted instance probed: `false`/);
  assert.match(rendered, /Network denied during source work: `true`/);
  assert.match(rendered, new RegExp(fixture.source.commit));
  assert.match(rendered, /Retest: `fixed`/);

  for (const [name, mutate, expected] of [
    ['missing-commit', (value) => delete value.source.commit, /source\.commit/],
    ['moving-commit', (value) => { value.source.commit = 'main'; }, /source\.commit/],
    ['missing-evidence-state', (value) => delete value.evidence[0].state, /evidence\[0\]\.state/],
    ['missing-disclosure-state', (value) => delete value.disclosure.state, /disclosure\.state/],
    ['missing-retest-result', (value) => delete value.retest.result, /retest\.result/],
  ]) {
    const invalid = structuredClone(fixture);
    mutate(invalid);
    const attempt = runRenderer(invalid, name);
    assert.notEqual(attempt.result.status, 0, `${name} unexpectedly rendered`);
    assert.match(attempt.result.stderr, expected);
  }

  const privateSuspected = structuredClone(fixture);
  privateSuspected.evidence[0].state = 'suspected';
  privateSuspected.disclosure = {
    state: 'reported_privately',
    upstreamResponse: 'Receipt acknowledged; no publication approval.',
    publicAuthorization: false,
  };
  const privateCase = runRenderer(privateSuspected, 'private-suspected');
  assert.notEqual(privateCase.result.status, 0);
  assert.match(privateCase.result.stderr, /public rendering requires/);

  const coordinated = structuredClone(privateSuspected);
  coordinated.disclosure = {
    state: 'coordinated_public',
    upstreamResponse: 'The upstream approved this sanitized scope for publication.',
    publicAuthorization: true,
  };
  const publicCase = runRenderer(coordinated, 'coordinated-suspected');
  assert.equal(publicCase.result.status, 0, publicCase.result.stderr);
  assert.match(readFileSync(publicCase.output, 'utf8'), /coordinated_public/);

  const unsafeDisclosure = structuredClone(privateSuspected);
  unsafeDisclosure.disclosure.state = 'not_required';
  unsafeDisclosure.disclosure.publicAuthorization = true;
  const unsafe = runRenderer(unsafeDisclosure, 'unsafe-disclosure');
  assert.notEqual(unsafe.result.status, 0);
  assert.match(unsafe.result.stderr, /suspected evidence requires coordinated public disclosure/);

  const share = JSON.parse(readFileSync(join(ROOT, 'docs', 'adoption', 'share-metadata.json'), 'utf8'));
  assert.equal(share.ownedLocalDemo.thirdPartyTarget, false);
  assert.equal(share.ownedLocalDemo.before.byDomain.security_exposure.high, 2);
  assert.equal(share.ownedLocalDemo.before.byDomain.search_discoverability.high, 11);
  assert.equal(share.ownedLocalDemo.before.byDomain.search_discoverability.medium, 5);
  assert.equal(share.ownedLocalDemo.before.byDomain.reliability.medium, 1);
  assert.equal(share.ownedLocalDemo.after.active.high, 0);
  assert.equal(share.caseEvidence.upstreamValidationClaimed, false);
  assert.equal(share.externalState.communityPublication, 'external_validation_pending');

  const generated = [
    'launch-brief.md',
    'launch-brief.zh-CN.md',
    'citations.md',
    'channels/technical-long-form.md',
    'channels/show-hn.md',
    'channels/reddit.md',
    'channels/x-short-post.md',
    'channels/v2ex.md',
    'channels/chinese-developer-community.md',
  ].map((path) => readFileSync(join(ROOT, 'docs', 'adoption', path), 'utf8')).join('\n');
  assert.doesNotMatch(generated, /precision (?:rate|score|of)|universal scanner|upstream (?:approved|validated|endorsed) us/i);
  assert.doesNotMatch(generated, /13\s+(?:high|HIGH)/);
  assert.match(generated, /2 security HIGH; 11 discoverability HIGH \+ 5 MEDIUM; 1 reliability MEDIUM/);
  assert.match(generated, /external_validation_pending|Publication status: draft|发布状态：草稿/);

  console.log('✓ adoption assets: structured claims, channel drafts, no-live-target case and fail-closed fields');
} finally {
  rmSync(temp, { recursive: true, force: true });
}
