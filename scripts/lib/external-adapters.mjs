import { createHash } from 'node:crypto';
import { existsSync, lstatSync } from 'node:fs';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  GITLEAKS_ADAPTER, GITLEAKS_RULES, OSV_ADAPTER, OSV_RULES,
} from './adapter-definitions.mjs';

const MAX_OUTPUT_BYTES = 16 * 1024 * 1024;
const digest = (value) => createHash('sha256').update(String(value)).digest('hex');
const posix = (value) => value.split(sep).join('/');

function safeProjectPath(projectRoot, value) {
  if (typeof value !== 'string' || !value) return null;
  const absolute = isAbsolute(value) ? resolve(value) : resolve(projectRoot, value);
  const path = posix(relative(projectRoot, absolute));
  if (!path || path === '..' || path.startsWith('../') || isAbsolute(path)) return null;
  return path.slice(0, 160);
}

function counts({ discovered = 1, eligible = 1, scanned = 0, excluded = 0, errors = 0 } = {}) {
  return { discovered, eligible, scanned, excluded, skipped: 0, truncated: 0, errors };
}

function coverage(adapter, rule, status, countValues, reasons = []) {
  return {
    id: `${adapter.id}-${rule.id}`,
    adapterId: adapter.id,
    ruleId: rule.id,
    ruleRevision: rule.revision,
    status,
    counts: counts(countValues),
    reasons,
  };
}

function unknownFinding(adapter, rule, reasonCode, detail = {}) {
  return {
    adapterId: adapter.id,
    ruleId: rule.id,
    title: `${adapter.id} evidence unavailable`,
    severity: rule.severity,
    state: 'unknown',
    summary: `${adapter.id} could not complete this check (${reasonCode}).`,
    location: null,
    evidence: { subject: rule.id, reasonCode, ...detail },
    remediation: `Run webapp-security doctor, install the tested ${adapter.id} version, and rerun the same adapter selection.`,
    retest: `Repeat this audit with ${adapter.id}@${adapter.version} and the same project scope.`,
  };
}

function run(binary, args, { cwd, timeoutSeconds }) {
  const result = spawnSync(binary, args, {
    cwd,
    encoding: 'utf8',
    timeout: timeoutSeconds * 1000,
    maxBuffer: MAX_OUTPUT_BYTES,
    windowsHide: true,
  });
  if (result.error?.code === 'ENOENT') return { kind: 'missing' };
  if (result.error?.code === 'ETIMEDOUT' || result.signal === 'SIGTERM') return { kind: 'timeout' };
  if (result.error?.code === 'ENOBUFS') return { kind: 'output_limit' };
  if (result.error) return { kind: 'internal_error' };
  return { kind: 'completed', status: result.status, stdout: result.stdout || '' };
}

function version(binary, args, adapter, timeoutSeconds, parser) {
  const result = run(binary, args, { timeoutSeconds });
  if (result.kind !== 'completed') return { status: result.kind, expectedVersion: adapter.version };
  if (result.status !== 0) return { status: 'internal_error', expectedVersion: adapter.version };
  const observedVersion = parser(result.stdout);
  if (!observedVersion) return { status: 'malformed_version', expectedVersion: adapter.version };
  return {
    status: observedVersion === adapter.version ? 'available' : 'unsupported_version',
    expectedVersion: adapter.version,
    observedVersion,
  };
}

export function probeGitleaks(binary, timeoutSeconds) {
  return version(binary, ['version'], GITLEAKS_ADAPTER, timeoutSeconds,
    (stdout) => /^(\d+\.\d+\.\d+)\s*$/m.exec(stdout)?.[1]);
}

export function probeOsv(binary, timeoutSeconds) {
  return version(binary, ['--version'], OSV_ADAPTER, timeoutSeconds,
    (stdout) => /osv-scanner version:\s*(\d+\.\d+\.\d+)/.exec(stdout)?.[1]);
}

export function parseGitleaksJson(stdout, projectRoot, scanMode) {
  let parsed;
  try { parsed = JSON.parse(stdout || '[]'); } catch { throw new Error('malformed_json'); }
  if (!Array.isArray(parsed)) throw new Error('malformed_output');
  const findings = parsed.map((item) => {
    if (!item || typeof item.RuleID !== 'string' || !item.RuleID
        || !Number.isInteger(item.StartLine) || item.StartLine < 1) throw new Error('malformed_output');
    const path = safeProjectPath(projectRoot, item.File);
    if (!path) throw new Error('unsafe_path');
    const toolFingerprintDigest = digest(item.Fingerprint || `${path}:${item.StartLine}:${item.RuleID}`);
    return {
      adapterId: GITLEAKS_ADAPTER.id,
      ruleId: scanMode === 'history' ? GITLEAKS_RULES[0].id : GITLEAKS_RULES[1].id,
      title: `Secret pattern lead from ${item.RuleID}`,
      severity: 'high',
      state: 'suspected',
      summary: `Gitleaks matched rule ${item.RuleID} in ${scanMode === 'history' ? 'committed history' : 'the working tree'}; credential validity and exposure were not inferred.`,
      location: { path, line: item.StartLine },
      evidence: {
        subject: `${scanMode}:${path}:${item.StartLine}:${item.RuleID}:${toolFingerprintDigest}`,
        scanMode,
        externalRuleId: item.RuleID,
        toolFingerprintDigest,
        ...(scanMode === 'history' && /^[a-f0-9]{40,64}$/i.test(item.Commit || '')
          ? { commit: item.Commit.toLowerCase() } : {}),
      },
      remediation: 'Revoke any live credential, remove it from the current tree and history as appropriate, and add a narrowly scoped prevention or suppression control.',
      retest: `Rerun the Gitleaks ${scanMode} adapter and confirm this fingerprint is absent or covered by an approved suppression.`,
    };
  });
  return [...new Map(findings.map((finding) => [finding.evidence.subject, finding])).values()];
}

function unavailable(adapter, rules, reasonCode, detail = {}) {
  return {
    findings: rules.map((rule) => unknownFinding(adapter, rule, reasonCode, detail)),
    coverage: rules.map((rule) => coverage(adapter, rule, 'unavailable', { errors: 1 }, [
      { code: reasonCode, count: 1, samplePaths: [] },
    ])),
  };
}

export function runGitleaks(projectRoot, { binary = 'gitleaks', timeoutSeconds = 120 } = {}) {
  const gitApplicable = existsSync(resolve(projectRoot, '.git'))
    && !lstatSync(resolve(projectRoot, '.git')).isSymbolicLink();
  const identity = probeGitleaks(binary, timeoutSeconds);
  if (identity.status !== 'available') {
    const reason = `adapter_${identity.status}`;
    const detail = identity.observedVersion ? { observedVersion: identity.observedVersion } : {};
    return {
      adapter: GITLEAKS_ADAPTER,
      identity,
      findings: [
        ...(gitApplicable ? [unknownFinding(GITLEAKS_ADAPTER, GITLEAKS_RULES[0], reason, detail)] : []),
        unknownFinding(GITLEAKS_ADAPTER, GITLEAKS_RULES[1], reason, detail),
      ],
      coverage: [
        ...(gitApplicable
          ? [coverage(GITLEAKS_ADAPTER, GITLEAKS_RULES[0], 'unavailable', { errors: 1 }, [
            { code: reason, count: 1, samplePaths: [] },
          ])]
          : [coverage(GITLEAKS_ADAPTER, GITLEAKS_RULES[0], 'not_applicable', {
            discovered: 1, eligible: 0, excluded: 1,
          }, [{ code: 'not_git_repository', count: 1, samplePaths: [] }])]),
        coverage(GITLEAKS_ADAPTER, GITLEAKS_RULES[1], 'unavailable', { errors: 1 }, [
          { code: reason, count: 1, samplePaths: [] },
        ]),
      ],
      networkAccessPerformed: false,
    };
  }
  const modes = [
    { mode: 'history', rule: GITLEAKS_RULES[0], applicable: gitApplicable, command: 'git' },
    { mode: 'working-tree', rule: GITLEAKS_RULES[1], applicable: true, command: 'dir' },
  ];
  const findings = [];
  const coverageEntries = [];
  for (const item of modes) {
    if (!item.applicable) {
      coverageEntries.push(coverage(GITLEAKS_ADAPTER, item.rule, 'not_applicable', {
        discovered: 1, eligible: 0, excluded: 1,
      }, [{ code: 'not_git_repository', count: 1, samplePaths: [] }]));
      continue;
    }
    const result = run(binary, [item.command, '--no-banner', '--no-color', '--redact=100',
      '--log-level', 'error', '--timeout', String(timeoutSeconds), '--report-format', 'json',
      '--report-path', '-', projectRoot], { cwd: projectRoot, timeoutSeconds });
    if (result.kind !== 'completed' || ![0, 1].includes(result.status)) {
      const reason = result.kind === 'completed' ? 'adapter_internal_error' : `adapter_${result.kind}`;
      findings.push(unknownFinding(GITLEAKS_ADAPTER, item.rule, reason));
      coverageEntries.push(coverage(GITLEAKS_ADAPTER, item.rule, 'unavailable', { errors: 1 }, [
        { code: reason, count: 1, samplePaths: [] },
      ]));
      continue;
    }
    try {
      const parsed = parseGitleaksJson(result.stdout, projectRoot, item.mode);
      if ((result.status === 1) !== (parsed.length > 0)) throw new Error('inconsistent_exit');
      findings.push(...parsed);
      coverageEntries.push(coverage(GITLEAKS_ADAPTER, item.rule, 'completed', { scanned: 1 }));
    } catch (error) {
      const reason = `adapter_${error.message}`;
      findings.push(unknownFinding(GITLEAKS_ADAPTER, item.rule, reason));
      coverageEntries.push(coverage(GITLEAKS_ADAPTER, item.rule, 'unavailable', { errors: 1 }, [
        { code: reason, count: 1, samplePaths: [] },
      ]));
    }
  }
  return { adapter: GITLEAKS_ADAPTER, identity, findings, coverage: coverageEntries, networkAccessPerformed: false };
}

export function parseOsvJson(stdout, projectRoot) {
  let parsed;
  try { parsed = JSON.parse(stdout || '{}'); } catch { throw new Error('malformed_json'); }
  if (!parsed || !Array.isArray(parsed.results)) throw new Error('malformed_output');
  const findings = [];
  for (const result of parsed.results) {
    const sourcePath = safeProjectPath(projectRoot, result?.source?.path);
    if (!sourcePath) throw new Error('unsafe_path');
    if (!Array.isArray(result?.packages)) throw new Error('malformed_packages');
    for (const item of result.packages) {
      const pkg = item?.package;
      if (!pkg || typeof pkg.name !== 'string' || typeof pkg.version !== 'string'
          || typeof pkg.ecosystem !== 'string' || !Array.isArray(item.groups)) throw new Error('malformed_package');
      for (const group of item.groups) {
        if (!Array.isArray(group?.ids) || !group.ids.length
            || group.ids.some((id) => typeof id !== 'string' || !id)) throw new Error('malformed_group');
        const advisoryIds = [...new Set(group.ids)].sort();
        const aliases = Array.isArray(group.aliases)
          ? [...new Set(group.aliases.filter((value) => typeof value === 'string' && value))].sort()
          : [];
        findings.push({
          adapterId: OSV_ADAPTER.id,
          ruleId: OSV_RULES[0].id,
          title: `OSV advisory match for ${pkg.ecosystem}:${pkg.name}`,
          severity: 'info',
          state: 'suspected',
          summary: `OSV-Scanner matched ${pkg.ecosystem}:${pkg.name}@${pkg.version} to ${advisoryIds.join(', ')}. Local impact and priority were not inferred.`,
          location: { path: sourcePath, line: null },
          evidence: {
            subject: `${pkg.ecosystem}:${pkg.name}:${pkg.version}:${advisoryIds.join(',')}`,
            ecosystem: pkg.ecosystem,
            packageName: pkg.name,
            installedVersion: pkg.version,
            advisoryIds,
            aliases,
            upstreamMaxSeverity: typeof group.max_severity === 'string' ? group.max_severity : null,
            sourceType: typeof result.source.type === 'string' ? result.source.type : 'unknown',
          },
          remediation: 'Review the named advisory in project context, update or replace the dependency where applicable, and document any time-bounded suppression.',
          retest: 'Rerun OSV-Scanner with the same dependency inputs and confirm the advisory identity is absent or explicitly suppressed.',
        });
      }
    }
  }
  return findings;
}

export function runOsv(projectRoot, lockfiles, { binary = 'osv-scanner', timeoutSeconds = 120 } = {}) {
  if (!lockfiles.length) {
    return {
      adapter: OSV_ADAPTER,
      identity: { status: 'not_applicable', expectedVersion: OSV_ADAPTER.version },
      findings: [],
      coverage: [coverage(OSV_ADAPTER, OSV_RULES[0], 'not_applicable', {
        discovered: 1, eligible: 0, excluded: 1,
      }, [{ code: 'no_supported_dependency_input', count: 1, samplePaths: [] }])],
      networkAccessPerformed: false,
    };
  }
  const identity = probeOsv(binary, timeoutSeconds);
  if (identity.status !== 'available') {
    return { adapter: OSV_ADAPTER, identity, ...unavailable(
      OSV_ADAPTER, OSV_RULES, `adapter_${identity.status}`,
      identity.observedVersion ? { observedVersion: identity.observedVersion } : {},
    ), networkAccessPerformed: false };
  }
  const args = [
    'scan', 'source', '--format', 'json', '--verbosity', 'error',
    '--no-call-analysis', 'go', '--no-call-analysis', 'rust',
  ];
  for (const lockfile of lockfiles) args.push('--lockfile', resolve(projectRoot, lockfile));
  const result = run(binary, args, { cwd: projectRoot, timeoutSeconds });
  if (result.kind !== 'completed' || ![0, 1].includes(result.status)) {
    const reason = result.kind === 'completed' ? 'adapter_internal_error' : `adapter_${result.kind}`;
    return {
      adapter: OSV_ADAPTER, identity,
      ...unavailable(OSV_ADAPTER, OSV_RULES, reason),
      networkAccessPerformed: result.kind !== 'missing',
    };
  }
  try {
    const findings = parseOsvJson(result.stdout, projectRoot);
    if ((result.status === 1) !== (findings.length > 0)) throw new Error('inconsistent_exit');
    return {
      adapter: OSV_ADAPTER, identity, findings,
      coverage: [coverage(OSV_ADAPTER, OSV_RULES[0], 'completed', {
        discovered: lockfiles.length, eligible: lockfiles.length, scanned: lockfiles.length,
      })],
      networkAccessPerformed: true,
    };
  } catch (error) {
    const reason = `adapter_${error.message}`;
    return {
      adapter: OSV_ADAPTER, identity,
      ...unavailable(OSV_ADAPTER, OSV_RULES, reason),
      networkAccessPerformed: true,
    };
  }
}

export function runExternalAdapters(projectRoot, lockfiles, selected, options = {}) {
  const results = [];
  if (selected.includes('gitleaks')) results.push(runGitleaks(projectRoot, {
    binary: process.env.WEBAPP_SECURITY_GITLEAKS_BIN || 'gitleaks',
    timeoutSeconds: options.timeoutSeconds,
  }));
  if (selected.includes('osv')) results.push(runOsv(projectRoot, lockfiles, {
    binary: process.env.WEBAPP_SECURITY_OSV_SCANNER_BIN || 'osv-scanner',
    timeoutSeconds: options.timeoutSeconds,
  }));
  return results;
}
