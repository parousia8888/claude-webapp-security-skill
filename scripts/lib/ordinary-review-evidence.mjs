import { createHash } from 'node:crypto';

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, stableValue(item)]));
  }
  return value;
}

function normalizedSummary(summary = {}) {
  const byState = summary.byState || summary;
  return {
    total: summary.total,
    confirmed: byState.confirmed,
    suspected: byState.suspected,
    unknown: byState.unknown,
  };
}

export function ordinaryReportSemanticProjection(report) {
  return {
    schemaVersion: report.schemaVersion,
    rulesetDigest: report.ruleset?.digest,
    summary: normalizedSummary(report.summary),
    findings: (report.findings || []).map((finding) => ({ id: finding.id, state: finding.state }))
      .sort((left, right) => left.id.localeCompare(right.id)),
  };
}

export function ordinaryEvidenceSemanticProjection(evidence, project) {
  const findings = [];
  for (const id of project.review.useful_lead || []) findings.push({ id, state: 'suspected' });
  for (const id of project.review.expected_benign_match || []) findings.push({ id, state: 'suspected' });
  for (const id of project.review.unknown || []) findings.push({ id, state: 'unknown' });
  for (const id of project.review.confirmed || []) findings.push({ id, state: 'confirmed' });
  return {
    schemaVersion: project.report.schemaVersion,
    rulesetDigest: evidence.rulesetDigest,
    summary: normalizedSummary(project.report.summary),
    findings: findings.sort((left, right) => left.id.localeCompare(right.id)),
  };
}

export function ordinarySemanticDigest(projection) {
  return createHash('sha256').update(JSON.stringify(stableValue(projection))).digest('hex');
}
