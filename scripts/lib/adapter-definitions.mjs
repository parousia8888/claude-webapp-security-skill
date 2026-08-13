import { SOURCE_RULE_REGISTRY, runtimeRule } from './source-rule-registry.mjs';

export const EXTERNAL_ADAPTER_TIMEOUT_SECONDS = 120;
export const SUPPORTED_EXTERNAL_ADAPTERS = ['gitleaks', 'opengrep', 'osv'];

const gitleaksRegistry = SOURCE_RULE_REGISTRY.filter((rule) => rule.adapter.id === 'gitleaks');
const opengrepRegistry = SOURCE_RULE_REGISTRY.filter((rule) => rule.adapter.id === 'opengrep');
const osvRegistry = SOURCE_RULE_REGISTRY.filter((rule) => rule.adapter.id === 'osv');
export const GITLEAKS_ADAPTER = {
  id: gitleaksRegistry[0].adapter.id,
  version: gitleaksRegistry[0].adapter.version,
  maturity: gitleaksRegistry[0].adapter.maturity,
};

export const GITLEAKS_RULES = gitleaksRegistry.map(runtimeRule);

export const OPENGREP_ADAPTER = {
  id: opengrepRegistry[0].adapter.id,
  version: opengrepRegistry[0].adapter.version,
  maturity: opengrepRegistry[0].adapter.maturity,
};

export const OPENGREP_RULES = opengrepRegistry.map(runtimeRule);
export const OPENGREP_RULESET = {
  relativePath: 'rules/opengrep-source.yml',
  sha256: '3a3a28549f516b50e716449d9e80ee6f855d912f9bb41371d514f2e324667979',
};

export const OSV_ADAPTER = {
  id: osvRegistry[0].adapter.id,
  version: osvRegistry[0].adapter.version,
  maturity: osvRegistry[0].adapter.maturity,
};

export const OSV_RULES = osvRegistry.map(runtimeRule);

export function adapterDefinitions(selected = ['builtin']) {
  const definitions = [];
  if (selected.includes('gitleaks')) definitions.push({ ...GITLEAKS_ADAPTER, rules: GITLEAKS_RULES });
  if (selected.includes('opengrep')) definitions.push({ ...OPENGREP_ADAPTER, rules: OPENGREP_RULES });
  if (selected.includes('osv')) definitions.push({ ...OSV_ADAPTER, rules: OSV_RULES });
  return definitions;
}

export function parseAdapterSelection(values = []) {
  const requested = values.length ? values : ['builtin'];
  const expanded = requested.flatMap((value) => value.split(',')).map((value) => value.trim()).filter(Boolean);
  const selected = new Set();
  for (const value of expanded) {
    if (value === 'all') {
      selected.add('builtin');
      for (const adapter of SUPPORTED_EXTERNAL_ADAPTERS) selected.add(adapter);
    } else if (value === 'osv-scanner') {
      selected.add('osv');
    } else if (value === 'builtin' || SUPPORTED_EXTERNAL_ADAPTERS.includes(value)) {
      selected.add(value);
    } else {
      throw new Error(`unsupported adapter ${value}; use builtin, gitleaks, opengrep, osv, or all`);
    }
  }
  if (!selected.size) throw new Error('at least one adapter is required');
  return ['builtin', ...SUPPORTED_EXTERNAL_ADAPTERS].filter((value) => selected.has(value));
}

export function parseAdapterTimeout(value = EXTERNAL_ADAPTER_TIMEOUT_SECONDS) {
  const timeout = Number(value);
  if (!Number.isInteger(timeout) || timeout < 1 || timeout > 600) {
    throw new Error('adapter timeout must be an integer from 1 to 600 seconds');
  }
  return timeout;
}
