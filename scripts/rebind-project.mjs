#!/usr/bin/env node
import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { readProjectIdentity, validatePersistedScope, writeProjectIdentity } from './lib/project-identity.mjs';

const args = process.argv.slice(2);

function usage(code, message) {
  if (message) console.error(`error: ${message}`);
  console.log(`webapp-security rebind <project> [options]

Options:
  --scope <security-scope.yml>       Prior persisted v2 scope
  --acknowledge-subject <subject-id> Exact subject ID reviewed by the user
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

const scopeArg = take('--scope');
const acknowledgement = take('--acknowledge-subject');
const projectArg = args.shift();
if (!projectArg || !scopeArg || !acknowledgement || args.length) usage(2, 'project, scope and acknowledgement are required');

try {
  const project = resolve(projectArg);
  const scopePath = resolve(scopeArg);
  if (!existsSync(project) || !statSync(project).isDirectory()) throw new Error('project must be an existing directory');
  const existing = readProjectIdentity(project);
  if (existing) throw new Error(`project already has subject ${existing.subjectId}; refusing to replace it`);
  const scope = validatePersistedScope(JSON.parse(readFileSync(scopePath, 'utf8')));
  if (acknowledgement !== scope.subject.id) throw new Error('acknowledged subject does not match the reviewed scope');
  const now = process.env.SOURCE_DATE_EPOCH
    ? new Date(Number(process.env.SOURCE_DATE_EPOCH) * 1000)
    : new Date();
  if (Number.isNaN(now.getTime())) throw new Error('SOURCE_DATE_EPOCH must be numeric');
  writeProjectIdentity(project, {
    schemaVersion: 1,
    product: 'Web App Security Skill',
    subjectId: scope.subject.id,
    createdAt: now.toISOString(),
    lineage: {
      type: 'explicit_rebind',
      sourceScopeDigest: scope.subject.scopeDigest,
      boundAt: now.toISOString(),
    },
  });
  console.log(`project: ${project}`);
  console.log(`subject: ${scope.subject.id}`);
  console.log('binding: explicit_rebind');
} catch (error) {
  console.error(`error: ${error.message}`);
  process.exit(2);
}
