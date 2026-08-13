import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

export const SOURCE_RULE_FAMILIES = [
  'injection_execution', 'browser_output', 'authentication_session', 'transport',
  'deserialization', 'file_path', 'framework_exposure', 'deployment_configuration',
  'secret_management', 'dependency_configuration',
];
export const SOURCE_RULE_KINDS = ['risk_detection', 'evidence_integrity'];
export const SOURCE_RULE_MATURITIES = ['stable', 'experimental', 'planned', 'rejected', 'deferred'];

const standard = (id, url) => ({ id, url });
const fixture = (id, path) => ({ id, path });

function entry(adapter, rule) {
  return {
    adapter,
    maturity: 'stable',
    revision: '1',
    frameworks: [],
    alternatives: [],
    userDecisions: [],
    ...rule,
  };
}

const builtin = { id: 'builtin-source', version: '1.1.0', maturity: 'stable', type: 'built_in' };
const gitleaks = { id: 'gitleaks', version: '8.30.1', maturity: 'stable', type: 'external' };
const osv = { id: 'osv', version: '2.5.0', maturity: 'stable', type: 'external' };

export const SOURCE_RULE_REGISTRY = [
  entry(builtin, {
    id: 'dependency-lockfile-missing', kind: 'risk_detection', family: 'dependency_configuration',
    languages: ['javascript', 'typescript', 'python'], domain: 'supply_chain', severity: 'low',
    defaultState: 'confirmed', rationale: 'dependency_reproducibility',
    technicalTerm: 'Missing dependency lockfile',
    plainLanguage: 'The project names its dependencies but does not record the exact versions used to build it.',
    consequence: 'A later install can select different package versions, making security review and repeatable deployment less reliable.',
    confidenceBoundary: 'The rule confirms that a supported manifest has no adjacent or applicable workspace lockfile. It does not prove a malicious dependency or exploitable vulnerability.',
    applicability: 'Supported package.json or pyproject.toml project roots, including declared JavaScript workspaces.',
    detection: { type: 'manifest_lockfile_adjacency', manifests: ['package.json', 'pyproject.toml'], workspaceAware: true },
    standards: [standard('NIST-SSDF-1.1-PS.3.2', 'https://csrc.nist.gov/pubs/sp/800/218/final')],
    falsePositiveCauses: ['A lockfile is generated only in a deployment system outside the audited source.', 'An unsupported package manager records resolution in another file.'],
    proposal: { status: 'ready_for_review', summary: 'Generate and commit the lockfile used by CI and deployment.' },
    alternatives: ['Record and verify an equivalent immutable dependency resolution artifact in CI.'],
    proposalRisks: ['A newly generated lockfile can select versions that differ from the current deployment.'],
    sideEffects: ['Dependency versions or transitive packages may change when the first lockfile is generated.'],
    securityRetest: 'Rerun the source audit and confirm the manifest is covered by a supported lockfile.',
    functionalRetest: 'Run the normal install, build and project test commands using the committed lockfile.',
    rollback: 'Revert the lockfile if the locked install or application tests regress, then reconcile the deployed dependency set before regenerating it.',
    userDecisions: ['Confirm which package manager and lockfile CI and production must use.'],
    helpUri: 'https://github.com/parousia8888/web-app-security-skill/blob/main/docs/stable-source-rules.json',
    fixtures: { positive: [fixture('manifest-without-lock', 'test/fixtures/audit-app/package.json')], negative: [fixture('manifest-with-lock', 'test/fixtures/next-app/pnpm-lock.yaml')] },
  }),
  entry(builtin, {
    id: 'sensitive-env-file-present', kind: 'risk_detection', family: 'secret_management',
    languages: ['javascript', 'typescript', 'python'], domain: 'security_exposure', severity: 'medium',
    defaultState: 'suspected', rationale: 'sensitive_material_review',
    technicalTerm: 'Sensitive environment-file presence lead',
    plainLanguage: 'A file named like a real environment configuration is present. The audit does not read its contents.',
    consequence: 'If the file contains live credentials and is committed or published in a build artifact, an attacker may gain access to services or data.',
    confidenceBoundary: 'Filename presence is a lead only. Repository tracking, contents, credential validity and public delivery are not established.',
    applicability: 'Files named .env or .env.<environment>; documented example, sample, template, dist and defaults files are excluded.',
    detection: { type: 'filename_policy', pattern: '.env[.<environment>]', contentRead: false, templateExclusions: true },
    standards: [standard('CWE-798', 'https://cwe.mitre.org/data/definitions/798.html')],
    falsePositiveCauses: ['The file contains only non-sensitive local settings.', 'The file is ignored and never copied into an artifact.'],
    proposal: { status: 'review_required', summary: 'Verify tracking and artifacts without printing values, then move live secrets outside source and builds.' },
    alternatives: ['Keep a placeholder-only .env.example and inject real values through the deployment secret store.'],
    proposalRisks: ['Changing environment injection can break local development, CI or deployment startup.'],
    sideEffects: ['Developers and deployment jobs may need a new documented secret-injection path.'],
    securityRetest: 'Verify the file is absent from Git history and built artifacts, without exposing its contents, then rerun the audit.',
    functionalRetest: 'Start the application in development and its deployment-like test environment with the replacement configuration path.',
    rollback: 'Restore the prior configuration source only in a private environment if startup fails; do not recommit a live secret.',
    userDecisions: ['Confirm whether the file contains live values and where each environment should obtain replacements.'],
    helpUri: 'https://github.com/parousia8888/web-app-security-skill/blob/main/docs/stable-source-rules.json',
    fixtures: { positive: [fixture('real-env-name', 'test/fixtures/audit-app/.env.production')], negative: [fixture('template-env-exclusion', 'test/evidence-loop.test.mjs')] },
  }),
  entry(builtin, {
    id: 'node-inspector-public-bind', kind: 'risk_detection', family: 'framework_exposure',
    languages: ['javascript', 'typescript'], frameworks: ['node.js'], domain: 'security_exposure', severity: 'high',
    defaultState: 'suspected', rationale: 'remote_debug_exposure',
    technicalTerm: 'Public Node.js inspector binding',
    plainLanguage: 'A package script asks the Node debugger to listen on every network interface.',
    consequence: 'If that script runs on a reachable host, someone who reaches the debugger may inspect secrets or control the process.',
    confidenceBoundary: 'The package command is present. The audit does not prove the script runs in production or that the debug port is reachable.',
    applicability: 'String-valued package.json scripts using --inspect or --inspect-brk with 0.0.0.0 or [::].',
    detection: { type: 'json_script_argument', command: 'node-inspector', publicAddresses: ['0.0.0.0', '[::]'] },
    standards: [standard('CWE-489', 'https://cwe.mitre.org/data/definitions/489.html')],
    falsePositiveCauses: ['The script is limited to an isolated local container.', 'Network policy makes the listener unreachable.'],
    proposal: { status: 'review_required', summary: 'Bind the inspector to loopback and keep debug scripts out of reachable production processes.' },
    alternatives: ['Use an authenticated, access-controlled remote debugging tunnel for an explicitly approved incident window.'],
    proposalRisks: ['Remote debugging workflows can stop working after the bind address changes.'],
    sideEffects: ['Container or remote development debugging may require an explicit secure tunnel.'],
    securityRetest: 'Rerun the source audit and verify the deployed process exposes no public inspector listener.',
    functionalRetest: 'Run normal start and approved debugging workflows in their intended environments.',
    rollback: 'Restore the debug workflow only behind verified network isolation if approved debugging becomes impossible.',
    userDecisions: ['Confirm whether the script is used outside local development and whether remote debugging is required.'],
    helpUri: 'https://github.com/parousia8888/web-app-security-skill/blob/main/docs/stable-source-rules.json',
    fixtures: { positive: [fixture('public-inspector-script', 'test/fixtures/audit-app/package.json')], negative: [fixture('loopback-inspector-script', 'test/evidence-loop.test.mjs')] },
  }),
  entry(builtin, {
    id: 'production-source-map-enabled', kind: 'risk_detection', family: 'browser_output',
    languages: ['javascript', 'typescript'], frameworks: ['next.js', 'vite', 'nuxt', 'svelte', 'astro'],
    domain: 'security_exposure', severity: 'medium', defaultState: 'suspected', rationale: 'source_disclosure_lead',
    technicalTerm: 'Production browser source-map exposure lead',
    plainLanguage: 'The build configuration asks for browser source maps that can reveal original source structure if they are published.',
    consequence: 'Public maps can expose source code, comments and internal names that make later attacks easier.',
    confidenceBoundary: 'The configuration enables map output. The audit does not prove a map was built or served publicly.',
    applicability: 'Recognized Next.js, Vite, Nuxt, Svelte and Astro JavaScript/TypeScript configuration files.',
    detection: { type: 'build_config_literal', properties: ['productionBrowserSourceMaps', 'sourcemap', 'sourceMap'], enabledValues: [true, 'inline', 'hidden'] },
    standards: [standard('CWE-540', 'https://cwe.mitre.org/data/definitions/540.html')],
    falsePositiveCauses: ['Maps are uploaded only to an access-controlled monitoring service.', 'The production artifact pipeline removes maps before publication.'],
    proposal: { status: 'ready_for_review', summary: 'Disable public production source maps or keep them only in an access-controlled monitoring service.' },
    alternatives: ['Generate hidden maps in a private build step and prevent them from entering public artifacts.'],
    proposalRisks: ['Browser production debugging and readable error stack traces may become less useful.'],
    sideEffects: ['Error monitoring needs a private source-map upload step to preserve symbolication.'],
    securityRetest: 'Rebuild and verify no public .map response or embedded source map is available, then rerun the source audit.',
    functionalRetest: 'Run the production build, load the application and confirm error monitoring still symbolicates as intended.',
    rollback: 'Restore private map generation if observability regresses, while keeping public artifact delivery blocked.',
    userDecisions: ['Confirm whether production error monitoring requires source maps and where private maps may be stored.'],
    helpUri: 'https://github.com/parousia8888/web-app-security-skill/blob/main/docs/stable-source-rules.json',
    fixtures: { positive: [fixture('source-map-enabled', 'test/fixtures/audit-app/next.config.mjs')], negative: [fixture('source-map-default', 'test/fixtures/next-app/next.config.mjs')] },
  }),
  entry(builtin, {
    id: 'source-stack-unsupported', kind: 'evidence_integrity', family: 'deployment_configuration',
    languages: ['javascript', 'typescript', 'python'], domain: 'evidence_integrity', severity: 'info',
    defaultState: 'unknown', rationale: 'unsupported_scope', technicalTerm: 'Unsupported source-stack evidence gap',
    plainLanguage: 'The built-in audit could not find a supported project manifest, so it could not establish which source checks apply.',
    consequence: 'Relevant source risks may remain unchecked until the stack is identified.',
    confidenceBoundary: 'This proves only that supported Node or Python manifests were not found inside the bounded traversal.',
    applicability: 'Every built-in source audit.', detection: { type: 'supported_manifest_absence', manifests: ['package.json', 'pyproject.toml', 'requirements*.txt'] },
    standards: [], falsePositiveCauses: ['The project uses an unsupported language or non-standard manifest.', 'Traversal limits excluded the manifest.'],
    proposal: { status: 'review_required', summary: 'Record the stack manually or add a reviewed adapter before drawing source conclusions.' },
    proposalRisks: ['Expanding source scope can increase review time and expose additional local paths in sanitized evidence.'],
    sideEffects: ['A new adapter or wider scope may add findings that were previously outside coverage.'],
    securityRetest: 'Provide a supported manifest or adapter and rerun until applicable source checks report coverage.',
    functionalRetest: 'No product change is proposed; verify only that project discovery still identifies the intended root.',
    rollback: 'Remove an incorrect stack override if it causes the wrong files or framework rules to be selected.',
    helpUri: 'https://github.com/parousia8888/web-app-security-skill/blob/main/docs/stable-source-rules.json',
    fixtures: { positive: [fixture('unsupported-stack', 'test/source-coverage-ledger.test.mjs')], negative: [fixture('supported-node-stack', 'test/fixtures/next-app/package.json')] },
  }),
  entry(builtin, {
    id: 'source-evidence-incomplete', kind: 'evidence_integrity', family: 'deployment_configuration',
    languages: ['javascript', 'typescript', 'python'], domain: 'evidence_integrity', severity: 'high',
    defaultState: 'unknown', rationale: 'required_evidence_missing', technicalTerm: 'Incomplete source coverage',
    plainLanguage: 'Some eligible files could not be read or the bounded scan stopped early, so missing findings cannot be treated as a clean result.',
    consequence: 'A security issue may exist in files the audit did not inspect.',
    confidenceBoundary: 'The coverage ledger proves an input was skipped, truncated or unreadable. It does not prove a vulnerability in that input.',
    applicability: 'Every built-in source audit.', detection: { type: 'coverage_ledger_incomplete', outcomes: ['skipped', 'truncated', 'errors'] },
    standards: [], falsePositiveCauses: ['A deliberately excluded large or unreadable file is irrelevant to the application.', 'A conservative traversal limit stopped after all relevant files were already scanned.'],
    proposal: { status: 'review_required', summary: 'Review coverage reasons, restore readable inputs or raise an allowed bound, then rerun.' },
    proposalRisks: ['Higher traversal limits consume more time and memory and may include unrelated files.'],
    sideEffects: ['The next audit can take longer and produce additional findings.'],
    securityRetest: 'Rerun with the same subject and scope until all required source rules have completed coverage.',
    functionalRetest: 'No product code change is required; confirm the audit still targets the intended project root.',
    rollback: 'Restore prior traversal limits if resource use becomes unacceptable, and record the remaining evidence as unknown.',
    helpUri: 'https://github.com/parousia8888/web-app-security-skill/blob/main/docs/stable-source-rules.json',
    fixtures: { positive: [fixture('bounded-traversal', 'test/source-coverage-ledger.test.mjs')], negative: [fixture('complete-small-project', 'test/fixtures/next-app/package.json')] },
  }),
  entry(gitleaks, {
    id: 'gitleaks-committed-secret', kind: 'risk_detection', family: 'secret_management', languages: ['any'],
    domain: 'supply_chain', severity: 'high', defaultState: 'suspected', rationale: 'committed_secret_material',
    technicalTerm: 'Committed secret-pattern lead', plainLanguage: 'A pinned Gitleaks rule matched secret-shaped material in Git history.',
    consequence: 'If the value is a live credential, anyone with repository history access may be able to use it.',
    confidenceBoundary: 'The match and redacted fingerprint are recorded. Credential validity, exposure and authorization are not tested.',
    applicability: 'A Git worktree with the caller-installed tested Gitleaks version.', detection: { type: 'external_adapter', command: 'gitleaks git --report-format json', matchState: 'suspected' },
    standards: [standard('CWE-798', 'https://cwe.mitre.org/data/definitions/798.html')], falsePositiveCauses: ['A test or revoked value matches a secret pattern.', 'A generated example intentionally resembles a credential.'],
    proposal: { status: 'review_required', summary: 'Validate privately, revoke any live credential and remove it from current and historical source where appropriate.' },
    alternatives: ['Use an approved narrow Gitleaks suppression for a proven non-secret fixture.'], proposalRisks: ['History rewriting disrupts existing clones and references.'],
    sideEffects: ['Credential rotation can interrupt services; history rewriting requires repository coordination.'],
    securityRetest: 'Rerun the pinned Gitleaks history scan and confirm the fingerprint is absent or covered by an approved suppression.',
    functionalRetest: 'Verify every service using a rotated credential can authenticate and complete its normal health check.',
    rollback: 'Do not reactivate a leaked credential; roll back application configuration to a separately issued valid credential if rotation breaks service.',
    userDecisions: ['Confirm whether the match is a live credential and whether repository history may be rewritten.'],
    helpUri: 'https://github.com/parousia8888/web-app-security-skill/blob/main/docs/adapter-protocol.md',
    fixtures: { positive: [fixture('gitleaks-redacted-lead', 'test/external-adapters.test.mjs')], negative: [fixture('gitleaks-clean-output', 'test/real-adapters.test.mjs')] },
  }),
  entry(gitleaks, {
    id: 'gitleaks-working-tree-secret', kind: 'risk_detection', family: 'secret_management', languages: ['any'],
    domain: 'supply_chain', severity: 'high', defaultState: 'suspected', rationale: 'working_tree_secret_material',
    technicalTerm: 'Working-tree secret-pattern lead', plainLanguage: 'A pinned Gitleaks rule matched secret-shaped material in the current files.',
    consequence: 'If the value is live and later committed, built or shared, it may grant unauthorized access.',
    confidenceBoundary: 'The match and redacted fingerprint are recorded. Credential validity and distribution are not tested.',
    applicability: 'A readable project directory with the caller-installed tested Gitleaks version.', detection: { type: 'external_adapter', command: 'gitleaks dir --report-format json', matchState: 'suspected' },
    standards: [standard('CWE-798', 'https://cwe.mitre.org/data/definitions/798.html')], falsePositiveCauses: ['A placeholder or test value matches a secret pattern.', 'A local ignored file contains intentionally non-production data.'],
    proposal: { status: 'review_required', summary: 'Validate privately, revoke any live credential and remove it from source and build inputs.' },
    alternatives: ['Use an approved narrow suppression for a proven non-secret fixture.'], proposalRisks: ['Credential rotation can interrupt dependent services.'],
    sideEffects: ['Local development and CI need a replacement secret-injection path.'], securityRetest: 'Rerun the pinned Gitleaks directory scan and confirm the fingerprint is absent or approved.',
    functionalRetest: 'Run dependent service authentication and the project tests with replacement credentials.',
    rollback: 'Do not restore a leaked value; use a separately issued credential if the replacement fails.', userDecisions: ['Confirm whether the match is live and which secret store should replace it.'],
    helpUri: 'https://github.com/parousia8888/web-app-security-skill/blob/main/docs/adapter-protocol.md',
    fixtures: { positive: [fixture('gitleaks-working-tree-lead', 'test/external-adapters.test.mjs')], negative: [fixture('gitleaks-clean-directory', 'test/real-adapters.test.mjs')] },
  }),
  entry(osv, {
    id: 'osv-known-vulnerability', kind: 'risk_detection', family: 'dependency_configuration', languages: ['any'],
    domain: 'supply_chain', severity: 'info', defaultState: 'suspected', rationale: 'known_vulnerable_dependency',
    technicalTerm: 'Known dependency advisory match', plainLanguage: 'OSV-Scanner linked a recorded dependency version to one or more public vulnerability advisories.',
    consequence: 'If the application uses the affected code path, an attacker may be able to trigger the behavior described by the advisory.',
    confidenceBoundary: 'Package identity, version and advisory IDs matched. Reachability, exploitability and local severity are not inferred.',
    applicability: 'Supported lockfiles or dependency manifests accepted by the caller-installed tested OSV-Scanner version.', detection: { type: 'external_adapter', command: 'osv-scanner scan source --format json', matchState: 'suspected' },
    standards: [standard('CWE-1104', 'https://cwe.mitre.org/data/definitions/1104.html')], falsePositiveCauses: ['The vulnerable code path is not reachable in this product.', 'The advisory does not affect the product configuration or platform.'],
    proposal: { status: 'review_required', summary: 'Review advisory applicability, then update, replace or time-bound an explicitly owned suppression.' },
    alternatives: ['Apply an upstream-supported backport or isolate the affected feature until an upgrade is available.'], proposalRisks: ['Dependency upgrades can introduce API, behavior or transitive-dependency changes.'],
    sideEffects: ['Build output, runtime behavior or compatibility can change after the dependency update.'], securityRetest: 'Rerun OSV-Scanner and confirm the advisory identity is absent or explicitly accepted with an owner and expiry.',
    functionalRetest: 'Run the project test suite and the user journeys that depend on the upgraded package.', rollback: 'Revert the dependency change if functional tests regress, then choose a supported mitigation without marking the advisory fixed.',
    userDecisions: ['Confirm whether the affected feature is used and whether update, isolation or time-bounded acceptance is appropriate.'],
    helpUri: 'https://github.com/parousia8888/web-app-security-skill/blob/main/docs/adapter-protocol.md',
    fixtures: { positive: [fixture('osv-advisory-match', 'test/external-adapters.test.mjs')], negative: [fixture('osv-clean-output', 'test/real-adapters.test.mjs')] },
  }),
];

const ID = /^[a-z0-9][a-z0-9._-]+$/;
const STANDARD = /^(?:CWE-[1-9][0-9]*|OWASP-TOP10-2025-A(?:0[1-9]|10)|OWASP-API-2023-API(?:[1-9]|10)|OWASP-ASVS-5\.0\.0-[1-9][0-9]*(?:\.[0-9]+){1,2}|NIST-SSDF-1\.1-[A-Z]{2}\.[0-9]+\.[0-9]+)$/;
const REQUIRED_TEXT = ['rationale', 'technicalTerm', 'plainLanguage', 'consequence', 'confidenceBoundary', 'applicability', 'securityRetest', 'functionalRetest', 'rollback', 'helpUri'];

export function validateSourceRuleRegistry(registry, { root = null } = {}) {
  const errors = [];
  if (!Array.isArray(registry)) return ['registry must be an array'];
  const ids = new Set();
  for (const [index, rule] of registry.entries()) {
    const label = `registry[${index}]`;
    if (!ID.test(rule?.id || '')) errors.push(`${label}.id is invalid`);
    if (ids.has(rule?.id)) errors.push(`duplicate rule id ${rule.id}`);
    ids.add(rule?.id);
    if (!ID.test(rule?.adapter?.id || '') || !rule?.adapter?.version || !['built_in', 'external'].includes(rule?.adapter?.type)) errors.push(`${label}.adapter is invalid`);
    if (!SOURCE_RULE_KINDS.includes(rule?.kind)) errors.push(`${label}.kind is invalid`);
    if (!SOURCE_RULE_FAMILIES.includes(rule?.family)) errors.push(`${label}.family is invalid`);
    if (!SOURCE_RULE_MATURITIES.includes(rule?.maturity)) errors.push(`${label}.maturity is invalid`);
    if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(rule?.revision || '')) errors.push(`${label}.revision is invalid`);
    if (!Array.isArray(rule?.languages) || !rule.languages.length) errors.push(`${label}.languages is required`);
    if (!Array.isArray(rule?.frameworks)) errors.push(`${label}.frameworks is required`);
    if (!['security_exposure', 'supply_chain', 'evidence_integrity'].includes(rule?.domain)) errors.push(`${label}.domain is invalid`);
    if (!['critical', 'high', 'medium', 'low', 'info'].includes(rule?.severity)) errors.push(`${label}.severity is invalid`);
    if (!['confirmed', 'suspected', 'unknown', 'not_applicable'].includes(rule?.defaultState)) errors.push(`${label}.defaultState is invalid`);
    for (const field of REQUIRED_TEXT) if (typeof rule?.[field] !== 'string' || !rule[field].trim()) errors.push(`${label}.${field} is required`);
    if (!rule?.detection || typeof rule.detection !== 'object' || Array.isArray(rule.detection)) errors.push(`${label}.detection is required`);
    if (!Array.isArray(rule?.standards)) errors.push(`${label}.standards is required`);
    else for (const [standardIndex, item] of rule.standards.entries()) {
      if (!STANDARD.test(item?.id || '') || !/^https:\/\/\S+$/.test(item?.url || '')) errors.push(`${label}.standards[${standardIndex}] is invalid`);
    }
    for (const field of ['falsePositiveCauses', 'proposalRisks', 'alternatives', 'sideEffects', 'userDecisions']) {
      if (!Array.isArray(rule?.[field]) || (['falsePositiveCauses', 'proposalRisks', 'sideEffects'].includes(field) && !rule[field].length)) errors.push(`${label}.${field} is invalid`);
    }
    if (!['ready_for_review', 'review_required', 'no_safe_automatic_change', 'not_applicable'].includes(rule?.proposal?.status) || !rule?.proposal?.summary) errors.push(`${label}.proposal is invalid`);
    for (const fixtureKind of ['positive', 'negative']) {
      const fixtures = rule?.fixtures?.[fixtureKind];
      if (!Array.isArray(fixtures) || (rule.maturity === 'stable' && !fixtures.length)) errors.push(`${label}.fixtures.${fixtureKind} is required for stable rules`);
      for (const item of fixtures || []) {
        if (!ID.test(item?.id || '') || typeof item?.path !== 'string') errors.push(`${label}.fixtures.${fixtureKind} contains an invalid fixture`);
        else if (root && !existsSync(resolve(root, item.path))) errors.push(`${label}.fixtures.${fixtureKind} is missing ${item.path}`);
      }
    }
  }
  return [...new Set(errors)];
}

export function sourceRuleRegistryEntry(adapterId, ruleId) {
  const rule = SOURCE_RULE_REGISTRY.find((item) => item.adapter.id === adapterId && item.id === ruleId);
  if (!rule) throw new Error(`source rule registry has no entry for ${adapterId}/${ruleId}`);
  return rule;
}

export function sourceRuleHelpUri(adapterId, ruleId) {
  return SOURCE_RULE_REGISTRY.find((item) => item.adapter.id === adapterId && item.id === ruleId)?.helpUri || null;
}

export function runtimeRule(rule) {
  return { id: rule.id, revision: rule.revision, domain: rule.domain, severity: rule.severity, rationale: rule.rationale };
}

export function registrySemanticDigest(registry = SOURCE_RULE_REGISTRY) {
  const semantic = registry.map((rule) => ({
    adapter: { id: rule.adapter.id, version: rule.adapter.version }, id: rule.id,
    revision: rule.revision, kind: rule.kind, family: rule.family, maturity: rule.maturity,
    languages: rule.languages, frameworks: rule.frameworks, domain: rule.domain,
    severity: rule.severity, defaultState: rule.defaultState, applicability: rule.applicability,
    detection: rule.detection,
  })).sort((left, right) => left.id.localeCompare(right.id));
  return createHash('sha256').update(JSON.stringify(semantic)).digest('hex');
}

export function sourceRuleExplanation(adapterId, ruleId, finding) {
  const rule = sourceRuleRegistryEntry(adapterId, ruleId);
  const unknown = finding.state === 'unknown';
  return {
    technicalTerm: rule.technicalTerm,
    plainLanguage: unknown ? finding.summary : rule.plainLanguage,
    consequence: unknown
      ? 'The audit cannot determine whether this area is safe until the missing evidence is available.'
      : rule.consequence,
    evidenceBoundary: unknown
      ? `${finding.summary} This is an evidence gap and does not prove the project is vulnerable or safe.`
      : rule.confidenceBoundary,
    standards: rule.standards,
    proposal: unknown ? { status: 'review_required', summary: finding.remediation } : rule.proposal,
    alternatives: rule.alternatives,
    sideEffects: rule.sideEffects,
    securityRetest: unknown ? finding.retest : rule.securityRetest,
    functionalRetest: rule.functionalRetest,
    rollback: rule.rollback,
    userDecisions: rule.userDecisions,
  };
}

export function stableSourceRuleManifest(registry = SOURCE_RULE_REGISTRY) {
  const stable = registry.filter((rule) => rule.maturity === 'stable');
  const builtInRisk = stable.filter((rule) => rule.adapter.type === 'built_in' && rule.kind === 'risk_detection').length;
  const builtInIntegrity = stable.filter((rule) => rule.adapter.type === 'built_in' && rule.kind === 'evidence_integrity').length;
  const externalRisk = stable.filter((rule) => rule.adapter.type === 'external' && rule.kind === 'risk_detection').length;
  return {
    schemaVersion: 1,
    semanticDigest: registrySemanticDigest(registry),
    counts: { stableTotal: stable.length, builtInRisk, builtInIntegrity, externalRisk },
    rules: stable.map((rule) => structuredClone(rule)).sort((left, right) => left.id.localeCompare(right.id)),
  };
}
