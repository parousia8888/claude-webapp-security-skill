export const EXTERNAL_ADAPTER_TIMEOUT_SECONDS = 120;
export const SUPPORTED_EXTERNAL_ADAPTERS = ['gitleaks', 'osv'];

export const GITLEAKS_ADAPTER = {
  id: 'gitleaks',
  version: '8.30.1',
  maturity: 'stable',
};

export const GITLEAKS_RULES = [
  {
    id: 'gitleaks-committed-secret', revision: '1', domain: 'supply_chain', severity: 'high',
    rationale: 'committed_secret_material',
  },
  {
    id: 'gitleaks-working-tree-secret', revision: '1', domain: 'supply_chain', severity: 'high',
    rationale: 'working_tree_secret_material',
  },
];

export const OSV_ADAPTER = {
  id: 'osv',
  version: '2.5.0',
  maturity: 'stable',
};

export const OSV_RULES = [{
  id: 'osv-known-vulnerability', revision: '1', domain: 'supply_chain', severity: 'info',
  rationale: 'known_vulnerable_dependency',
}];

export function adapterDefinitions(selected = ['builtin']) {
  const definitions = [];
  if (selected.includes('gitleaks')) definitions.push({ ...GITLEAKS_ADAPTER, rules: GITLEAKS_RULES });
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
      throw new Error(`unsupported adapter ${value}; use builtin, gitleaks, osv, or all`);
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
