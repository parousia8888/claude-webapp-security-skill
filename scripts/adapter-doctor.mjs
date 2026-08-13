#!/usr/bin/env node
import { existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { discoverProject } from './lib/project-discovery.mjs';
import {
  parseAdapterSelection, parseAdapterTimeout, GITLEAKS_ADAPTER, OSV_ADAPTER,
} from './lib/adapter-definitions.mjs';
import { probeGitleaks, probeOsv } from './lib/external-adapters.mjs';

const args = process.argv.slice(2);
function usage(code, message) {
  if (message) console.error(`error: ${message}`);
  console.log(`webapp-security doctor [project] [options]

Options:
  --adapter <id>      builtin, gitleaks, osv, or all; repeatable (default: all)
  --adapter-timeout <seconds> Version-probe timeout, 1..600 (default: 120)
  --json              Print structured status

This command is read-only and never downloads or installs an adapter.`);
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
const json = args.includes('--json');
if (json) args.splice(args.indexOf('--json'), 1);
const adapterValues = [];
while (args.includes('--adapter')) adapterValues.push(take('--adapter'));
const timeoutArg = take('--adapter-timeout');
const projectArg = args.shift();
if (args.length) usage(2, `unknown argument ${args[0]}`);

try {
  const selected = parseAdapterSelection(adapterValues.length ? adapterValues : ['all']);
  const timeoutSeconds = parseAdapterTimeout(timeoutArg === null ? undefined : timeoutArg);
  let discovery = null;
  if (projectArg) {
    const project = resolve(projectArg);
    if (!existsSync(project) || !statSync(project).isDirectory()) throw new Error('project must be an existing directory');
    discovery = discoverProject(project);
  }
  const statuses = [];
  if (selected.includes('builtin')) statuses.push({
    id: 'builtin', status: 'available', version: 'bundled', applicability: 'applicable',
    guidance: null,
  });
  if (selected.includes('gitleaks')) {
    const probe = probeGitleaks(process.env.WEBAPP_SECURITY_GITLEAKS_BIN || 'gitleaks', timeoutSeconds);
    statuses.push({
      id: GITLEAKS_ADAPTER.id,
      status: probe.status,
      expectedVersion: probe.expectedVersion,
      observedVersion: probe.observedVersion || null,
      applicability: discovery ? 'working-tree; history when .git is present' : 'project not supplied',
      guidance: probe.status === 'available' ? null : 'Install Gitleaks 8.30.1 from its verified release; this command will not download it.',
    });
  }
  if (selected.includes('osv')) {
    const probe = probeOsv(process.env.WEBAPP_SECURITY_OSV_SCANNER_BIN || 'osv-scanner', timeoutSeconds);
    statuses.push({
      id: OSV_ADAPTER.id,
      status: probe.status,
      expectedVersion: probe.expectedVersion,
      observedVersion: probe.observedVersion || null,
      applicability: discovery ? (discovery.lockfiles.length ? `${discovery.lockfiles.length} dependency input(s)` : 'not_applicable') : 'project not supplied',
      guidance: probe.status === 'available' ? null : 'Install OSV-Scanner 2.5.0 from its verified release; this command will not download it.',
    });
  }
  const output = { schemaVersion: 1, downloadsPerformed: false, timeoutSeconds, adapters: statuses };
  if (json) console.log(JSON.stringify(output, null, 2));
  else {
    console.log('webapp-security doctor (downloads: none)');
    for (const item of statuses) {
      console.log(`${item.id}: ${item.status}; expected=${item.expectedVersion || item.version}; observed=${item.observedVersion || 'n/a'}; applicability=${item.applicability}`);
      if (item.guidance) console.log(`  ${item.guidance}`);
    }
  }
  process.exit(statuses.some((item) => !['available', 'not_applicable'].includes(item.status)) ? 3 : 0);
} catch (error) {
  usage(2, error.message);
}
