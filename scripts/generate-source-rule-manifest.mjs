#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SOURCE_RULE_REGISTRY, stableSourceRuleManifest, validateSourceRuleRegistry,
} from './lib/source-rule-registry.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUTPUT = join(ROOT, 'docs', 'stable-source-rules.json');
const check = process.argv.includes('--check');
if (process.argv.slice(2).some((argument) => argument !== '--check')) {
  console.error('usage: node scripts/generate-source-rule-manifest.mjs [--check]');
  process.exit(2);
}

const errors = validateSourceRuleRegistry(SOURCE_RULE_REGISTRY, { root: ROOT });
if (errors.length) {
  console.error(`source rule registry is invalid:\n${errors.map((error) => `- ${error}`).join('\n')}`);
  process.exit(1);
}
const manifest = stableSourceRuleManifest();
const rendered = `${JSON.stringify(manifest, null, 2)}\n`;
if (check) {
  if (!existsSync(OUTPUT) || readFileSync(OUTPUT, 'utf8') !== rendered) {
    console.error('stable source rule manifest is stale; run node scripts/generate-source-rule-manifest.mjs');
    process.exit(1);
  }
  console.log(`stable source rule manifest current: ${manifest.counts.builtInRisk} built-in risk, ${manifest.counts.builtInIntegrity} integrity, ${manifest.counts.externalRisk} external risk`);
} else {
  writeFileSync(OUTPUT, rendered);
  console.log(OUTPUT);
}
