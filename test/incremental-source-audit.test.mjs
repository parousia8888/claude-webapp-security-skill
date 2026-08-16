#!/usr/bin/env node
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const CLI = join(ROOT, 'scripts', 'webapp-security.mjs');
const temp = mkdtempSync(join(tmpdir(), 'web-app-security-diff-'));

function run(program, args, cwd, expected = 0) {
  const result = spawnSync(program, args, { cwd, encoding: 'utf8' });
  assert.equal(result.status, expected, `${program} ${args.join(' ')}\n${result.stdout}\n${result.stderr}`);
  return result;
}

function git(cwd, ...args) {
  return run('git', args, cwd).stdout.trim();
}

function write(path, content) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

function project(name, source = 'export const safe = true;\n') {
  const root = join(temp, name);
  mkdirSync(root, { recursive: true });
  git(root, 'init', '-q');
  git(root, 'config', 'user.name', 'Diff Fixture');
  git(root, 'config', 'user.email', 'diff@example.invalid');
  write(join(root, 'package.json'), '{"private":true}\n');
  write(join(root, 'package-lock.json'), '{"lockfileVersion":3}\n');
  write(join(root, 'src', 'app.ts'), source);
  git(root, 'add', '.');
  git(root, 'commit', '-qm', 'fixture baseline');
  return root;
}

function audit(root, name, options, expected = 0) {
  const out = join(temp, 'reports', name);
  const result = run(process.execPath, [CLI, 'audit', root, '--out', out, '--fail-on', 'never', ...options], ROOT, expected);
  const reportPath = join(out, 'report.json');
  return { result, out, reportPath, report: expected === 2 ? null : JSON.parse(readFileSync(reportPath, 'utf8')) };
}

try {
  const since = project('since', [
    'const oldNode = document.querySelector("#old");',
    'oldNode.innerHTML = legacy;',
    '',
  ].join('\n'));
  write(join(since, 'src', 'app.ts'), [
    'const oldNode = document.querySelector("#old");',
    'oldNode.innerHTML = legacy;',
    'document.body.innerHTML = incoming;',
    '',
  ].join('\n'));
  write(join(since, 'untracked.ts'), 'document.body.innerHTML = excluded;\n');
  let result = audit(since, 'since', ['--since', 'HEAD']);
  assert.equal(result.report.scope.selection.mode, 'since');
  assert.equal(result.report.scope.selection.snapshotKind, 'working_tree');
  assert.equal(result.report.scope.selection.baseCommit, git(since, 'rev-parse', 'HEAD'));
  assert.equal(result.report.scope.selection.untrackedFilesExcluded, 1);
  assert.deepEqual(result.report.findings.filter((item) => item.rule.id === 'browser-html-injection-sink')
    .map((item) => item.location.line), [3], 'only the added vulnerable line should remain');
  assert.match(result.report.limitations.join('\n'), /does not establish whole-repository safety/);

  const renamed = project('renamed', 'document.body.innerHTML = legacy;\n');
  git(renamed, 'mv', 'src/app.ts', 'src/renamed.ts');
  result = audit(renamed, 'renamed', ['--since', 'HEAD']);
  assert.equal(result.report.scope.selection.changedFileCount, 1);
  assert.equal(result.report.findings.some((item) => item.rule.id === 'browser-html-injection-sink'), false,
    'a content-identical rename must not replay the finding');

  const lock = project('lock');
  git(lock, 'rm', '-q', 'package-lock.json');
  result = audit(lock, 'lock', ['--since', 'HEAD']);
  assert.equal(result.report.findings.some((item) => item.rule.id === 'dependency-lockfile-missing'), true,
    'deleting a relevant lockfile must retain the manifest-level finding');

  const malformed = project('malformed');
  write(join(malformed, 'src', 'app.ts'), 'const value = "unterminated\n');
  result = audit(malformed, 'malformed', ['--since', 'HEAD'], 3);
  assert.equal(result.report.findings.some((item) => item.rule.id === 'source-evidence-incomplete'), true,
    'a changed-file parser failure must remain visible');

  const staged = project('staged');
  write(join(staged, 'src', 'app.ts'), 'document.body.innerHTML = stagedInput;\n');
  git(staged, 'add', 'src/app.ts');
  write(join(staged, 'src', 'app.ts'), 'eval(unstagedInput);\n');
  result = audit(staged, 'staged', ['--staged']);
  assert.equal(result.report.scope.selection.snapshotKind, 'git_index');
  assert.equal(result.report.findings.some((item) => item.rule.id === 'browser-html-injection-sink'), true);
  assert.equal(result.report.findings.some((item) => item.rule.id === 'js-dynamic-code-execution'), false,
    'unstaged working-tree content must not enter an index audit');

  const clean = project('clean');
  result = audit(clean, 'clean', ['--staged']);
  assert.equal(result.report.scope.selection.changedFileCount, 0);
  assert.equal(result.report.findings.length, 0);

  const invalid = project('invalid');
  result = audit(invalid, 'invalid-ref', ['--since', 'missing-ref'], 2);
  assert.equal(result.result.stderr.includes('Needed a single revision'), true);
  result = audit(invalid, 'external', ['--since', 'HEAD', '--adapter', 'osv'], 2);
  assert.match(result.result.stderr, /built-in adapter only/);
  result = audit(invalid, 'baseline', ['--since', 'HEAD', '--baseline', 'missing.json'], 2);
  assert.match(result.result.stderr, /cannot be combined with --baseline/);

  const nongit = join(temp, 'nongit');
  mkdirSync(nongit);
  write(join(nongit, 'package.json'), '{"private":true}\n');
  result = audit(nongit, 'nongit', ['--staged'], 2);
  assert.match(result.result.stderr, /not a git repository|Git working tree/);

  console.log('incremental source audit ok: since/staged selection, rename, lockfile, coverage and refusal boundaries');
} finally {
  rmSync(temp, { recursive: true, force: true });
}
