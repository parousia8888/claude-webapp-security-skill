#!/usr/bin/env node
import assert from 'node:assert/strict';
import {
  chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  parseGitleaksJson, parseOsvJson, runGitleaks, runOsv,
} from '../scripts/lib/external-adapters.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const CLI = join(ROOT, 'scripts', 'webapp-security.mjs');
const temp = mkdtempSync(join(tmpdir(), 'web-app-security-adapters-'));
const project = join(temp, 'project');
const secret = 'M6_EXTERNAL_SECRET_SENTINEL';
mkdirSync(project);
mkdirSync(join(project, '.git'));
writeFileSync(join(project, 'package.json'), '{"name":"fixture","version":"1.0.0"}\n');
writeFileSync(join(project, 'package-lock.json'), '{"name":"fixture","version":"1.0.0","lockfileVersion":3,"packages":{}}\n');
writeFileSync(join(project, 'config.txt'), 'fixture\n');

const fakeGitleaks = join(temp, 'fake-gitleaks.mjs');
writeFileSync(fakeGitleaks, `#!/usr/bin/env node
const [command] = process.argv.slice(2);
const mode = process.env.FAKE_GITLEAKS_MODE || 'clean';
if (command === 'version') {
  console.log(mode === 'version-drift' ? '8.29.0' : '8.30.1');
  process.exit(0);
}
if (mode === 'timeout') { setTimeout(() => {}, 5000); }
else if (mode === 'internal') { console.error('${secret} raw stderr'); process.exit(2); }
else if (mode === 'malformed') { console.log('{bad'); process.exit(1); }
else if (mode === 'inconsistent') { console.log('[]'); process.exit(1); }
else if (mode === 'finding') {
  console.error('${secret} raw stderr');
  console.log(JSON.stringify([{
    RuleID: 'github-pat', StartLine: 2, File: 'config.txt', Fingerprint: 'fixture-fingerprint',
    Secret: '${secret}', Match: '${secret}', Email: '${secret}@example.invalid', Commit: 'a'.repeat(40),
  }]));
  process.exit(1);
} else { console.log('[]'); process.exit(0); }
`);
chmodSync(fakeGitleaks, 0o755);

const fakeOsv = join(temp, 'fake-osv.mjs');
writeFileSync(fakeOsv, `#!/usr/bin/env node
const args = process.argv.slice(2);
const mode = process.env.FAKE_OSV_MODE || 'clean';
if (args[0] === '--version') {
  console.log('osv-scanner version: ' + (mode === 'version-drift' ? '2.4.0' : '2.5.0'));
  process.exit(0);
}
if (mode === 'timeout') { setTimeout(() => {}, 5000); }
else if (mode === 'internal') { console.error('${secret} raw stderr'); process.exit(2); }
else if (mode === 'malformed') { console.log('{bad'); process.exit(1); }
else if (mode === 'inconsistent') { console.log('{"results":[]}'); process.exit(1); }
else if (mode === 'finding' || mode === 'no-severity') {
  console.error('${secret} raw stderr');
  const group = { ids: ['GHSA-fixture-0001'], aliases: ['CVE-2099-0001'] };
  if (mode === 'finding') group.max_severity = '9.9';
  console.log(JSON.stringify({ results: [{
    source: { path: args[args.indexOf('--lockfile') + 1], type: 'lockfile' },
    packages: [{
      package: { name: 'fixture-package', version: '1.0.0', ecosystem: 'npm' },
      groups: [group],
      vulnerabilities: [{ id: 'GHSA-fixture-0001', database_specific: { severity: 'CRITICAL', secret: '${secret}' } }],
    }],
  }] }));
  process.exit(1);
} else { console.log('{"results":[]}'); process.exit(0); }
`);
chmodSync(fakeOsv, 0o755);

function withEnv(values, callback) {
  const prior = Object.fromEntries(Object.keys(values).map((key) => [key, process.env[key]]));
  Object.assign(process.env, values);
  try { return callback(); } finally {
    for (const [key, value] of Object.entries(prior)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
}

function cli(args, env = {}) {
  return spawnSync(process.execPath, [CLI, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 10000,
    env: { ...process.env, ...env, SOURCE_DATE_EPOCH: '0' },
  });
}

try {
  assert.deepEqual(parseGitleaksJson('[]', project, 'working-tree'), []);
  assert.throws(() => parseGitleaksJson('{bad', project, 'working-tree'), /malformed_json/);
  assert.throws(() => parseGitleaksJson('[{"RuleID":"x","StartLine":1,"File":"../escape"}]', project, 'working-tree'), /unsafe_path/);
  const parsedSecret = parseGitleaksJson(JSON.stringify([{
    RuleID: 'github-pat', StartLine: 2, File: 'config.txt', Fingerprint: 'fixture',
    Secret: secret, Match: secret, Email: `${secret}@example.invalid`, Commit: 'b'.repeat(40),
  }]), project, 'history');
  assert.equal(parsedSecret.length, 1);
  assert.equal(JSON.stringify(parsedSecret).includes(secret), false);
  assert.equal(parsedSecret[0].evidence.externalRuleId, 'github-pat');

  let result = withEnv({ FAKE_GITLEAKS_MODE: 'clean' }, () => runGitleaks(project, {
    binary: fakeGitleaks, timeoutSeconds: 1,
  }));
  assert.ok(result.coverage.every((entry) => entry.status === 'completed'));
  assert.equal(result.findings.length, 0);

  for (const [mode, reason] of [
    ['malformed', 'adapter_malformed_json'], ['inconsistent', 'adapter_inconsistent_exit'],
    ['internal', 'adapter_internal_error'], ['timeout', 'adapter_timeout'],
  ]) {
    result = withEnv({ FAKE_GITLEAKS_MODE: mode }, () => runGitleaks(project, {
      binary: fakeGitleaks, timeoutSeconds: 1,
    }));
    assert.ok(result.coverage.every((entry) => entry.status === 'unavailable'));
    assert.ok(result.findings.every((finding) => finding.state === 'unknown'));
    assert.ok(result.findings.every((finding) => finding.evidence.reasonCode === reason));
  }
  result = withEnv({ FAKE_GITLEAKS_MODE: 'version-drift' }, () => runGitleaks(project, {
    binary: fakeGitleaks, timeoutSeconds: 1,
  }));
  assert.equal(result.identity.status, 'unsupported_version');
  assert.ok(result.findings.every((finding) => finding.state === 'unknown'));

  const nonGit = join(temp, 'non-git');
  mkdirSync(nonGit);
  result = runGitleaks(nonGit, { binary: join(temp, 'missing-gitleaks'), timeoutSeconds: 1 });
  assert.equal(result.coverage.find((entry) => entry.ruleId === 'gitleaks-committed-secret').status, 'not_applicable');
  assert.equal(result.coverage.find((entry) => entry.ruleId === 'gitleaks-working-tree-secret').status, 'unavailable');

  assert.deepEqual(parseOsvJson('{"results":[]}', project), []);
  assert.throws(() => parseOsvJson('{bad', project), /malformed_json/);
  const conflicting = withEnv({ FAKE_OSV_MODE: 'finding' }, () => runOsv(project, ['package-lock.json'], {
    binary: fakeOsv, timeoutSeconds: 1,
  }));
  const missingSeverity = withEnv({ FAKE_OSV_MODE: 'no-severity' }, () => runOsv(project, ['package-lock.json'], {
    binary: fakeOsv, timeoutSeconds: 1,
  }));
  assert.equal(conflicting.findings[0].severity, 'info');
  assert.equal(missingSeverity.findings[0].severity, 'info');
  assert.equal(conflicting.findings[0].evidence.upstreamMaxSeverity, '9.9', JSON.stringify(conflicting));
  assert.equal(missingSeverity.findings[0].evidence.upstreamMaxSeverity, null);
  assert.equal(JSON.stringify(conflicting).includes(secret), false);

  for (const [mode, reason] of [
    ['malformed', 'adapter_malformed_json'], ['inconsistent', 'adapter_inconsistent_exit'],
    ['internal', 'adapter_internal_error'], ['timeout', 'adapter_timeout'],
  ]) {
    result = withEnv({ FAKE_OSV_MODE: mode }, () => runOsv(project, ['package-lock.json'], {
      binary: fakeOsv, timeoutSeconds: 1,
    }));
    assert.equal(result.coverage[0].status, 'unavailable');
    assert.equal(result.findings[0].state, 'unknown');
    assert.equal(result.findings[0].evidence.reasonCode, reason);
  }
  result = runOsv(project, [], { binary: join(temp, 'missing-osv'), timeoutSeconds: 1 });
  assert.equal(result.coverage[0].status, 'not_applicable');
  assert.equal(result.findings.length, 0);
  result = runOsv(project, ['package-lock.json'], { binary: join(temp, 'missing-osv'), timeoutSeconds: 1 });
  assert.equal(result.coverage[0].status, 'unavailable');
  assert.equal(result.findings[0].state, 'unknown');

  const gateDir = join(temp, 'gate');
  result = cli(['audit', project, '--out', gateDir, '--adapter', 'all'], {
    WEBAPP_SECURITY_GITLEAKS_BIN: fakeGitleaks,
    WEBAPP_SECURITY_OSV_SCANNER_BIN: fakeOsv,
  });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /requires --acknowledge-alert-policy/);
  assert.equal(existsSync(gateDir), false);

  const reportDir = join(temp, 'report');
  result = cli(['audit', project, '--out', reportDir, '--adapter', 'all', '--fail-on', 'never'], {
    WEBAPP_SECURITY_GITLEAKS_BIN: fakeGitleaks,
    WEBAPP_SECURITY_OSV_SCANNER_BIN: fakeOsv,
    FAKE_GITLEAKS_MODE: 'finding',
    FAKE_OSV_MODE: 'finding',
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(readFileSync(join(reportDir, 'report.json'), 'utf8'));
  assert.deepEqual(report.ruleset.adapters.map((adapter) => adapter.id), ['builtin-source', 'gitleaks', 'osv']);
  assert.ok(report.findings.some((finding) => finding.rule.id === 'gitleaks-committed-secret'));
  assert.ok(report.findings.some((finding) => finding.rule.id === 'osv-known-vulnerability'));
  assert.equal(report.findings.find((finding) => finding.rule.id === 'osv-known-vulnerability').severity, 'info');
  assert.equal(report.scope.networkAccessPerformed, true);
  for (const name of readdirSync(reportDir)) {
    assert.equal(readFileSync(join(reportDir, name), 'utf8').includes(secret), false, `${name} persisted raw adapter output`);
  }
  for (const name of ['report.md', 'report.html', 'report.sarif', 'report.junit.xml']) {
    const output = readFileSync(join(reportDir, name), 'utf8');
    assert.match(output, /gitleaks/);
    assert.match(output, /8\.30\.1/);
    assert.match(output, /osv/);
    assert.match(output, /2\.5\.0/);
    assert.match(output, /coverage|Coverage/);
  }

  result = cli(['doctor', project, '--adapter', 'all', '--json'], {
    WEBAPP_SECURITY_GITLEAKS_BIN: join(temp, 'missing-gitleaks'),
    WEBAPP_SECURITY_OSV_SCANNER_BIN: join(temp, 'missing-osv'),
  });
  assert.equal(result.status, 3);
  const doctor = JSON.parse(result.stdout);
  assert.equal(doctor.downloadsPerformed, false);
  assert.ok(doctor.adapters.filter((adapter) => adapter.id !== 'builtin').every((adapter) => adapter.status === 'missing'));
  assert.ok(doctor.adapters.filter((adapter) => adapter.id !== 'builtin').every((adapter) => /will not download/.test(adapter.guidance)));

  console.log('external adapters ok: identity, failure states, redaction, severity boundary, reports, doctor and gate acknowledgement');
} finally {
  rmSync(temp, { recursive: true, force: true });
}
