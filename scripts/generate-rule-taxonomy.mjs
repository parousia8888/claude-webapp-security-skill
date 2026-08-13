#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CRAWL_RULES } from './lib/crawl-rules.mjs';
import { SOURCE_RULES } from './lib/source-rules.mjs';
import { GITLEAKS_RULES, OSV_RULES } from './lib/adapter-definitions.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUTPUT = join(ROOT, 'docs', 'rule-taxonomy.md');
const check = process.argv.includes('--check');
if (process.argv.slice(2).some((argument) => argument !== '--check')) {
  console.error('usage: node scripts/generate-rule-taxonomy.mjs [--check]');
  process.exit(2);
}

const rationale = {
  dependency_reproducibility: 'Dependency resolution cannot be reproduced or reviewed from a committed lock.',
  sensitive_material_review: 'A sensitive-named local file is present and requires repository/artifact review; presence alone is not public exposure.',
  remote_debug_exposure: 'A debugger is configured for a public bind address and can expose process control if reachable.',
  source_disclosure_lead: 'Configuration enables source-map output; public delivery still requires artifact or deployment evidence.',
  unsupported_scope: 'The built-in source adapter cannot identify a supported manifest.',
  required_evidence_missing: 'A required input could not be obtained or interpreted; severity describes the importance of the evidence gap, not a confirmed vulnerability.',
  optional_evidence_missing: 'An optional evidence source was unavailable.',
  sample_evidence_missing: 'A bounded content sample could not be evaluated.',
  crawl_policy_conflict: 'Published discovery directives disagree and can produce inconsistent crawler behavior.',
  crawl_policy_hygiene: 'The policy is ambiguous or non-portable but does not by itself block intended content.',
  public_indexing_blocked: 'Intended public content or its discovery path is blocked from search or AI retrieval.',
  user_fetch_blocked: 'A user-triggered assistant fetch is blocked.',
  discovery_degraded: 'Discovery remains possible but is slower, indirect, or unnecessarily redirected.',
  crawl_policy_portability: 'A directive is not interpreted consistently across crawler implementations.',
  crawl_policy_absent: 'No explicit crawl policy is published.',
  public_boundary_unavailable: 'The public policy endpoint fails at the origin.',
  content_inventory_hygiene: 'Metadata quality affects inventory or canonicalization without proving lost availability.',
  public_content_unavailable: 'An intended public page or baseline response is unavailable.',
  indexed_content_missing: 'A URL advertised for indexing is missing.',
  retrieval_degraded: 'Crawler-visible content differs or lacks enough initial content for dependable retrieval.',
  route_semantics_degraded: 'Unknown routes return misleading success semantics.',
  deduplicated_observation: 'An informational observation is summarized under another actionable rule.',
  sensitive_material_public: 'A public response matches sensitive configuration or credential material.',
  unexpected_public_surface: 'A private-looking path responds publicly but content sensitivity is not confirmed.',
  surface_existence_disclosed: 'The response discloses that a private-looking route exists.',
  bounded_probe_inventory: 'An informational count records the bounded probe result.',
  source_material_public: 'Original source and comments are publicly reconstructable from a served source map.',
  internal_metadata_disclosed: 'Asset naming reveals internal release or feature labels.',
  committed_secret_material: 'A secret pattern was reproduced in Git history; persisted evidence is redacted and fingerprinted.',
  working_tree_secret_material: 'A secret pattern was reproduced in the working tree; persisted evidence is redacted and fingerprinted.',
  known_vulnerable_dependency: 'A recorded dependency version matched an OSV advisory; reachability and remediation priority still require project context.',
};

const lines = [
  '# Rule taxonomy', '',
  '<!-- Generated from scripts/lib/source-rules.mjs and scripts/lib/crawl-rules.mjs. -->', '',
  'Severity is interpreted inside the named risk domain. In particular, a HIGH',
  '`search_discoverability` impact is not a HIGH `security_exposure`, and an',
  '`evidence_integrity` severity describes the importance of missing evidence rather than a',
  'confirmed product vulnerability.', '',
];

for (const [title, rules] of [
  ['Built-in source rules', SOURCE_RULES],
  ['External source adapter rules', [...GITLEAKS_RULES, ...OSV_RULES]],
  ['Crawl rules', CRAWL_RULES],
]) {
  lines.push(`## ${title}`, '', '| Rule | Domain | Severity | Rationale |', '|---|---|---|---|');
  for (const rule of rules) {
    if (!rationale[rule.rationale]) throw new Error(`missing rationale text for ${rule.id}`);
    lines.push(`| \`${rule.id}\` | \`${rule.domain}\` | \`${rule.severity}\` | ${rationale[rule.rationale]} |`);
  }
  lines.push('');
}

const rendered = `${lines.join('\n')}\n`;
if (check) {
  if (!existsSync(OUTPUT) || readFileSync(OUTPUT, 'utf8') !== rendered) {
    console.error('rule taxonomy is stale; run node scripts/generate-rule-taxonomy.mjs');
    process.exit(1);
  }
  console.log(`rule taxonomy current: ${SOURCE_RULES.length} built-in source, ${GITLEAKS_RULES.length + OSV_RULES.length} external source, ${CRAWL_RULES.length} crawl`);
} else {
  writeFileSync(OUTPUT, rendered);
  console.log(OUTPUT);
}
