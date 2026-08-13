#!/usr/bin/env node
import { existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildScope, discoverProject } from './lib/project-discovery.mjs';
import {
  ensureProjectIdentity, persistedSubject, sourceAuditBoundary, sourceTraversalLimits,
} from './lib/project-identity.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const args = process.argv.slice(2);

function usage(code, message) {
  if (message) console.error(`error: ${message}`);
  console.log(`webapp-security start <project> [options]

Options:
  --out <directory>   Run root (default: <project>/.webapp-security/runs)
  --run-id <id>       Stable run identifier (default: timestamped)
  --origin <url>      Record a likely owned public origin; no request is sent
  --max-depth <n>     Maximum directory depth, 1..64 (default: 12)
  --max-files <n>     Maximum discovered files, 1..200000 (default: 20000)
  --max-entries <n>   Maximum directory entries, 1..500000 (default: 50000)
  --max-file-bytes <n> Maximum candidate bytes, 1024..16777216 (default: 1048576)
`);
  process.exit(code);
}

function take(name) {
  const index = args.indexOf(name);
  if (index === -1) return null;
  if (!args[index + 1] || args[index + 1].startsWith('--')) usage(2, `${name} requires a value`);
  const value = args[index + 1];
  args.splice(index, 2);
  return value;
}

if (args.includes('-h') || args.includes('--help')) usage(0);
const outArg = take('--out');
const runArg = take('--run-id');
const origin = take('--origin');
const maxDepth = take('--max-depth');
const maxFiles = take('--max-files');
const maxEntries = take('--max-entries');
const maxFileBytes = take('--max-file-bytes');
const project = args.shift();
if (!project) usage(2, 'project is required');
if (args.length) usage(2, `unknown argument ${args[0]}`);

const now = process.env.SOURCE_DATE_EPOCH
  ? new Date(Number(process.env.SOURCE_DATE_EPOCH) * 1000)
  : new Date();
if (Number.isNaN(now.getTime())) usage(2, 'SOURCE_DATE_EPOCH must be numeric');
const runId = runArg || `run-${now.toISOString().replace(/[:.]/g, '-')}`;
if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,80}$/.test(runId)) usage(2, '--run-id contains unsupported characters');

try {
  const limits = sourceTraversalLimits(Object.fromEntries([
    ['maxDepth', maxDepth], ['maxFiles', maxFiles], ['maxEntries', maxEntries],
    ['maxFileBytes', maxFileBytes],
  ].filter(([, value]) => value !== null).map(([name, value]) => [name, Number(value)])));
  const auditBoundary = sourceAuditBoundary(limits);
  const discovery = discoverProject(project, { origin, traversalLimits: limits });
  const runRoot = resolve(outArg || join(discovery.projectRoot, '.webapp-security', 'runs'));
  const runDirectory = join(runRoot, runId);
  if (existsSync(runDirectory)) usage(2, `run already exists: ${runDirectory}`);
  mkdirSync(runRoot, { recursive: true });
  const stage = mkdtempSync(join(runRoot, '.start-'));
  let runCreated = false;
  try {
    const identity = ensureProjectIdentity(discovery.projectRoot, now.toISOString());
    const scope = buildScope(discovery, {
      version: readFileSync(join(ROOT, 'VERSION'), 'utf8').trim(),
      generatedAt: now.toISOString(),
      runId,
      runDirectory,
      subject: persistedSubject(identity, auditBoundary),
      auditBoundary,
    });
    writeFileSync(join(stage, 'security-scope.yml'), `${JSON.stringify(scope, null, 2)}\n`, { mode: 0o600 });
    mkdirSync(runDirectory, { mode: 0o700 });
    runCreated = true;
    renameSync(join(stage, 'security-scope.yml'), join(runDirectory, 'security-scope.yml'));
    rmSync(stage, { recursive: true, force: true });
  } catch (error) {
    rmSync(stage, { recursive: true, force: true });
    if (runCreated) rmSync(runDirectory, { recursive: true, force: true });
    throw error;
  }
  console.log(`run:        ${runDirectory}`);
  console.log(`scope:      ${join(runDirectory, 'security-scope.yml')}`);
  console.log(`discovery:  ${discovery.status} (${discovery.layout})`);
  console.log(`frameworks: ${discovery.frameworks.map((item) => `${item.name}@${item.root}`).join(', ') || 'unknown'}`);
  console.log('network:    none');
  console.log('remote:     blocked pending recorded authorization');
} catch (error) {
  usage(2, error.message);
}
