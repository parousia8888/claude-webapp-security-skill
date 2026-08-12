#!/usr/bin/env node
// CI gate: VERSION, package.json version, and the CHANGELOG heading must agree.
// Metadata drift (v0.2.1 tag while package.json said 0.2.0) is a released-inconsistency bug.
import { readFileSync } from 'node:fs';
const ver = readFileSync(new URL('../VERSION', import.meta.url), 'utf8').trim();
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;
const cl = readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8');
let f = 0;
if (pkg !== ver) { console.error(`✗ package.json ${pkg} != VERSION ${ver}`); f = 1; }
if (!new RegExp(`^## \\[${ver.replace(/\./g, '\\.')}\\] — \\d{4}-\\d{2}-\\d{2}`, 'm').test(cl)) { console.error(`✗ CHANGELOG has no dated heading for ${ver}`); f = 1; }
if (f) process.exit(1);
console.log(`✓ version metadata consistent (VERSION = package.json = ${ver}, CHANGELOG dated)`);
