#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, realpathSync } from 'node:fs';
import { basename, dirname, relative, resolve, sep } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DEFAULT_CATALOG = `${ROOT}/docs/case-studies/journeys/evidence.json`;
const CLI = `${ROOT}/scripts/webapp-security.mjs`;
const DENY_NETWORK = `${ROOT}/test/helpers/deny-network.cjs`;

function usage(code, message) {
  if (message) console.error(`error: ${message}`);
  console.log(`node scripts/run-case-journey.mjs <journey-id> <checkout> --out <directory> [--catalog <json>]

The checkout must be a clean Git worktree at the journey's exact immutable commit. The output
directory must be outside the checkout. Discovery and audit run with network APIs disabled.`);
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
  mkdirSync(output, { recursive: true, mode: 0o700 });
  const env = {
    ...process.env,
    NODE_OPTIONS: `--require=${DENY_NETWORK}`,
    SOURCE_DATE_EPOCH: '0',
  };
  const startOutput = run(['start', checkout, '--out', `${output}/runs`, '--run-id', id], env);
  const auditOutput = run(['audit', checkout, '--out', `${output}/audit`, '--name', 'report', '--fail-on', 'never'], env);
  const scope = JSON.parse(readFileSync(`${output}/runs/${id}/security-scope.yml`, 'utf8'));
  const report = JSON.parse(readFileSync(`${output}/audit/report.json`, 'utf8'));
  const actualDiscovery = {
    status: scope.target.discoveryStatus,
    layout: scope.target.layout,
    frameworks: scope.target.frameworks.map((item) => `${item.name}@${item.root}`),
    packageManagers: scope.target.packageManagers.map((item) => `${item.name}@${item.root}`),
    lockfiles: scope.target.lockfiles,
  };
  const expected = journey.deterministicAudit;
  const actualRules = report.findings.map((finding) => ({
    ruleId: finding.ruleId,
    severity: finding.severity,
    state: finding.state,
    path: finding.location?.path,
    line: finding.location?.line,
  }));
  if (JSON.stringify(actualDiscovery) !== JSON.stringify(journey.discovery)
      || report.summary.total !== expected.total
      || report.summary.byState.confirmed !== expected.confirmed
      || report.summary.byState.suspected !== expected.suspected
      || JSON.stringify(actualRules) !== JSON.stringify(expected.rules || [])) {
    throw new Error(`observed evidence differs from catalog for ${id}`);
  }
  console.log(`journey:    ${id}`);
  console.log(`commit:     ${head}`);
  console.log(`checkout:   clean`);
  console.log(startOutput.trim());
  console.log(auditOutput.trim());
  console.log('catalog:    matched');
} catch (error) {
  usage(2, error.message);
}
