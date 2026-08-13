import { digestValue } from './project-identity.mjs';

export function adapterRulesetDigest(adapter, rules) {
  return digestValue({
    adapter: { id: adapter.id, version: adapter.version },
    rules: [...rules].map(({ id, revision }) => ({ id, revision }))
      .sort((left, right) => left.id.localeCompare(right.id)),
  });
}

export function createRulesetV2(definitions) {
  const adapters = definitions.map(({ rules, ...adapter }) => ({
    ...adapter,
    rulesetDigest: adapterRulesetDigest(adapter, rules),
  })).sort((left, right) => left.id.localeCompare(right.id));
  return {
    digest: digestValue({ fingerprintVersion: 2, adapters }),
    fingerprintVersion: 2,
    adapters,
  };
}
