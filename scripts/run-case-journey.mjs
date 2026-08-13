#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, realpathSync } from 'node:fs';
import { basename, dirname, relative, resolve, sep } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DEFAULT_CATALOG = `${ROOT}/docs/case-studies/journeys/evidence.json`;
const CLI = `${ROOT}/scripts/webapp-security.mjs`;

function usage(code, message) {
  if (message) console.error(`error: ${message}`);
  console.log(`node scripts/run-case-journey.mjs <journey-id> <checkout> --out <directory> [--catalog <json>]

The checkout must be a clean Git worktree at the journey's exact immutable commit. The output
directory must be outside the checkout. Set WEBAPP_SECURITY_GITLEAKS_BIN and
WEBAPP_SECURITY_OSV_SCANNER_BIN to the caller-installed, pinned binaries. The runner does not
download tools, execute project dependencies, or contact a hosted project; OSV-Scanner may query
the public OSV advisory service.`);
  process.exit(code);
}

function take(args, name) {
  const index = args.indexOf(name);
  if (index === -1) return null;
  if (!args[index + 1] || args[index + 1].startsWith('--')) usage(2, `${name} requires a value`);
  return args.splice(index, 2)[1];
}

function git(checkout, args) {
  const result = spawnSync('git', ['-C', checkout, ...args], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr.trim() || `git ${args.join(' ')} failed`);
  return result.stdout.trim();
}

function isInside(parent, child) {
  const path = relative(parent, child);
  return path === '' || (path !== '..' && !path.startsWith(`..${sep}`));
}

function canonicalFuturePath(path) {
  let cursor = resolve(path);
  const tail = [];
  while (!existsSync(cursor)) {
    const parent = dirname(cursor);
    if (parent === cursor) throw new Error(`cannot resolve output ancestor: ${path}`);
    tail.push(basename(cursor));
    cursor = parent;
  }
  return resolve(realpathSync(cursor), ...tail.reverse());
}

function run(args, env) {
  const result = spawnSync(process.execPath, [CLI, ...args], { encoding: 'utf8', env });
  if (result.status !== 0) throw new Error(`${args[0]} failed (${result.status}): ${result.stderr.trim()}`);
  return result.stdout;
}

function digestFindingIds(report, adapterId) {
  const ids = report.findings.filter((finding) => finding.adapter.id === adapterId)
    .map((finding) => finding.id).sort();
  return createHash('sha256').update(JSON.stringify(ids)).digest('hex');
}

function digestFindingContent(report, adapterId) {
  const findings = report.findings.filter((finding) => finding.adapter.id === adapterId)
    .map((finding) => ({
      id: finding.id,
      fingerprint: finding.fingerprint,
      rule: finding.rule,
      adapter: finding.adapter,
      domain: finding.domain,
      title: finding.title,
      severity: finding.severity,
      state: finding.state,
      summary: finding.summary,
      location: finding.location,
      evidence: finding.evidence,
      remediation: finding.remediation,
      retest: finding.retest,
    })).sort((left, right) => left.id.localeCompare(right.id));
  return createHash('sha256').update(JSON.stringify(findings)).digest('hex');
}

function compareReport(journey, report) {
  const expected = journey.corpus;
  const errors = [];
  if (report.schemaVersion !== 3) errors.push('source report schemaVersion is not 3');
  if (report.ruleset.digest !== expected.rulesetDigest) errors.push('ruleset digest changed');
  if (report.summary.byState.confirmed !== expected.snapshot.summary.confirmed) errors.push('confirmed count changed');
  if (report.findings.some((finding) => finding.adapter.id !== 'builtin-source'
      && finding.state !== 'suspected')) errors.push('external adapter finding is not suspected');
  for (const adapter of expected.adapters) {
    const observed = report.ruleset.adapters.find((item) => item.id === adapter.id);
    const runtime = report.scope.adapters.find((item) => item.id === adapter.id);
    if (!observed || observed.version !== adapter.version || observed.rulesetDigest !== adapter.rulesetDigest) {
      errors.push(`${adapter.id} ruleset identity changed`);
    }
    if (adapter.id !== 'builtin-source') {
      const expectedObservedVersion = adapter.status === 'available' ? adapter.version : null;
      if (!runtime || runtime.status !== adapter.status
          || runtime.observedVersion !== expectedObservedVersion) {
        errors.push(`${adapter.id} runtime identity changed`);
      }
    }
    if (adapter.deterministicFindingIdsDigest
        && digestFindingIds(report, adapter.id) !== adapter.deterministicFindingIdsDigest) {
      errors.push(`${adapter.id} deterministic finding identity changed`);
    }
    if (adapter.deterministicFindingContentDigest
        && digestFindingContent(report, adapter.id) !== adapter.deterministicFindingContentDigest) {
      errors.push(`${adapter.id} sanitized finding content changed`);
    }
  }
  const actualCoverage = Object.fromEntries(report.coverage.map((entry) => [entry.ruleId, entry.status]));
  for (const [ruleId, status] of Object.entries(expected.coverage)) {
    if (actualCoverage[ruleId] !== status) errors.push(`${ruleId} coverage changed`);
  }
  const allowedConfirmed = new Set(expected.confirmedFindingIds || []);
  for (const finding of report.findings.filter((item) => item.state === 'confirmed')) {
    if (!allowedConfirmed.has(finding.id)) errors.push(`unreviewed confirmed finding ${finding.id}`);
  }
  if (allowedConfirmed.size !== report.findings.filter((item) => item.state === 'confirmed').length) {
    errors.push('reviewed confirmed finding set changed');
  }
  return errors;
}

const args = process.argv.slice(2);
if (args.includes('-h') || args.includes('--help')) usage(0);
const catalogPath = resolve(take(args, '--catalog') || DEFAULT_CATALOG);
const outArg = take(args, '--out');
const id = args.shift();
const checkoutArg = args.shift();
if (!id || !checkoutArg || !outArg || args.length) usage(2, 'journey-id, checkout, and --out are required');

try {
  const catalog = JSON.parse(readFileSync(catalogPath, 'utf8'));
  const journey = catalog.journeys?.find((item) => item.id === id);
  if (!journey) throw new Error(`unknown journey: ${id}`);
  const checkout = realpathSync(resolve(checkoutArg));
  const output = canonicalFuturePath(outArg);
  if (isInside(checkout, output)) throw new Error('output directory must be outside the source checkout');
  const head = git(checkout, ['rev-parse', 'HEAD']);
  if (head !== journey.commit) throw new Error(`checkout HEAD ${head} does not match ${journey.commit}`);
  if (git(checkout, ['status', '--porcelain', '--untracked-files=normal'])) {
    throw new Error('checkout must be clean before a case journey runs');
  }
  if (existsSync(output)) throw new Error(`output already exists: ${output}`);
  const gitleaksBinary = process.env.WEBAPP_SECURITY_GITLEAKS_BIN;
  const osvBinary = process.env.WEBAPP_SECURITY_OSV_SCANNER_BIN;
  if (!gitleaksBinary || !osvBinary) {
    throw new Error('set WEBAPP_SECURITY_GITLEAKS_BIN and WEBAPP_SECURITY_OSV_SCANNER_BIN to pinned binaries');
  }
  for (const [name, binary] of [['Gitleaks', gitleaksBinary], ['OSV-Scanner', osvBinary]]) {
    if (!existsSync(binary)) throw new Error(`${name} binary does not exist: ${binary}`);
  }
  mkdirSync(output, { recursive: true, mode: 0o700 });
  const env = {
    ...process.env,
    SOURCE_DATE_EPOCH: String(Date.parse(journey.corpus.runDate) / 1000),
    WEBAPP_SECURITY_GITLEAKS_BIN: realpathSync(gitleaksBinary),
    WEBAPP_SECURITY_OSV_SCANNER_BIN: realpathSync(osvBinary),
  };
  const auditOutput = run(['audit', checkout, '--out', `${output}/audit`, '--name', 'report',
    '--adapter', 'all', '--fail-on', 'never'], env);
  const scope = JSON.parse(readFileSync(`${output}/audit/security-scope.yml`, 'utf8'));
  const report = JSON.parse(readFileSync(`${output}/audit/report.json`, 'utf8'));
  const actualDiscovery = {
    status: scope.target.discoveryStatus,
    layout: scope.target.layout,
    frameworks: scope.target.frameworks.map((item) => `${item.name}@${item.root}`),
    packageManagers: scope.target.packageManagers.map((item) => `${item.name}@${item.root}`),
    lockfiles: scope.target.lockfiles,
  };
  if (JSON.stringify(actualDiscovery) !== JSON.stringify(journey.discovery)
      || compareReport(journey, report).length) {
    throw new Error(`observed evidence differs from catalog for ${id}`);
  }
  if (git(checkout, ['status', '--porcelain', '--untracked-files=normal'])) {
    throw new Error('source checkout changed while the case journey ran');
  }
  console.log(`journey:    ${id}`);
  console.log(`commit:     ${head}`);
  console.log(`checkout:   clean and unchanged`);
  console.log(auditOutput.trim());
  const osvExpected = journey.corpus.snapshot.byRule['osv-known-vulnerability'] || 0;
  const osvObserved = report.findings.filter((finding) => finding.rule.id === 'osv-known-vulnerability').length;
  console.log(`catalog:    stable contract matched; OSV snapshot ${osvObserved}${osvObserved === osvExpected ? ' matched' : ` drifted from ${osvExpected}`}`);
} catch (error) {
  usage(2, error.message);
}
