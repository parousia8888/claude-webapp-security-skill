import { SEVERITIES } from './evidence-v2.mjs';
import { V2_DOMAINS, V2_RESULT_STATES } from './report-v2-contract.mjs';

function activeBreakdown(report) {
  const bySeverity = Object.fromEntries(SEVERITIES.map((severity) => [severity, 0]));
  const byDomain = Object.fromEntries(V2_DOMAINS.map((domain) => [domain,
    Object.fromEntries(V2_RESULT_STATES.map((state) => [state,
      Object.fromEntries(SEVERITIES.map((severity) => [severity, 0]))]))]));
  for (const finding of report.findings.filter((item) => item.baseline.state !== 'fixed')) {
    bySeverity[finding.severity] += 1;
    byDomain[finding.domain][finding.state][finding.severity] += 1;
  }
  return { byDomain, bySeverity };
}

export function createDemoFacts(before, after) {
  return {
    schemaVersion: 1,
    generator: 'scripts/demo.mjs',
    boundary: 'owned-local-fixture-no-third-party-target',
    before: activeBreakdown(before),
    after: activeBreakdown(after),
    fixed: after.summary.byBaseline.fixed,
  };
}

export function demoCount(facts, stage, domain, state, severity) {
  return facts[stage].byDomain[domain][state][severity];
}
