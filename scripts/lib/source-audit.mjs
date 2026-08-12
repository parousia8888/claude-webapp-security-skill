import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { createFinding } from './evidence.mjs';

const IGNORED = new Set([
  '.git', '.hg', '.svn', '.next', '.nuxt', '.output', '.webapp-security', 'build', 'coverage',
  'dist', 'node_modules', 'target', 'vendor', '__pycache__', '.venv', 'venv',
]);
const CONFIG_FILES = /^(?:next|vite|nuxt|svelte|astro)\.config\.(?:js|mjs|cjs|ts)$/;
const ENV_FILE = /^\.env(?:\.[a-z0-9_-]+)?$/i;
const ENV_TEMPLATE = /^\.env\.(?:example|sample|template|dist|defaults)$/i;

const posix = (value) => value.split(sep).join('/');

function walk(root, maxDepth = 5, maxFiles = 5000) {
  const files = [];
  function visit(directory, depth) {
    if (depth > maxDepth || files.length >= maxFiles) return;
    let entries;
    try { entries = readdirSync(directory, { withFileTypes: true }); } catch { return; }
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (entry.isSymbolicLink()) continue;
      const absolute = join(directory, entry.name);
      if (entry.isDirectory()) {
        if (!IGNORED.has(entry.name)) visit(absolute, depth + 1);
      } else if (entry.isFile()) {
        files.push({ absolute, path: posix(relative(root, absolute)), name: entry.name });
      }
      if (files.length >= maxFiles) break;
    }
  }
  visit(root, 0);
  return files;
}

function readSmall(file) {
  try {
    if (statSync(file.absolute).size > 1024 * 1024) return null;
    return readFileSync(file.absolute, 'utf8');
  } catch { return null; }
}

function lineOf(text, index) {
  return text.slice(0, index).split('\n').length;
}

function patchLine(path, text, match, replacement) {
  const line = text.slice(0, match.index).split('\n').length;
  const before = match[0];
  const after = before.replace(match[1], replacement);
  return `--- a/${path}\n+++ b/${path}\n@@ line ${line} @@\n-${before}\n+${after}\n`;
}

function workspacePatterns(manifest) {
  if (Array.isArray(manifest.workspaces)) return manifest.workspaces;
  if (Array.isArray(manifest.workspaces?.packages)) return manifest.workspaces.packages;
  return [];
}

function globMatchesPath(pattern, path) {
  if (typeof pattern !== 'string' || pattern.startsWith('!')) return false;
  const escaped = pattern.replace(/\\/g, '/').replace(/^\.\//, '').replace(/[.+^${}()|[\]\\]/g, '\\$&');
  const expression = escaped.replace(/\*\*/g, '\u0000').replace(/\*/g, '[^/]*').replace(/\u0000/g, '.*');
  return new RegExp(`^${expression}/?$`).test(path);
}

function coveredByWorkspace(manifest, filesByPath, lockRoots) {
  const manifestRoot = posix(dirname(manifest.path));
  if (manifestRoot === '.' || lockRoots.has(manifestRoot)) return lockRoots.has(manifestRoot);
  const segments = manifestRoot.split('/');
  for (let depth = segments.length - 1; depth >= 0; depth -= 1) {
    const ancestor = depth ? segments.slice(0, depth).join('/') : '.';
    if (!lockRoots.has(ancestor)) continue;
    const ancestorManifestPath = ancestor === '.' ? 'package.json' : `${ancestor}/package.json`;
    const ancestorManifest = filesByPath.get(ancestorManifestPath);
    if (!ancestorManifest) continue;
    const text = readSmall(ancestorManifest);
    if (!text) continue;
    let parsed;
    try { parsed = JSON.parse(text); } catch { continue; }
    const relativeRoot = ancestor === '.' ? manifestRoot : manifestRoot.slice(ancestor.length + 1);
    if (workspacePatterns(parsed).some((pattern) => globMatchesPath(pattern, relativeRoot))) return true;
  }
  return false;
}

export function auditSource(projectRoot) {
  const root = resolve(projectRoot);
  if (!existsSync(root) || !statSync(root).isDirectory()) throw new Error(`project root is invalid: ${projectRoot}`);
  const files = walk(root);
  const findings = [];
  const manifests = files.filter((file) => file.name === 'package.json' || file.name === 'pyproject.toml' || /^requirements.*\.txt$/i.test(file.name));
  const lockCheckedManifests = manifests.filter((file) => file.name === 'package.json' || file.name === 'pyproject.toml');
  const lockNames = new Set(['package-lock.json', 'npm-shrinkwrap.json', 'pnpm-lock.yaml', 'yarn.lock', 'bun.lock', 'bun.lockb', 'uv.lock', 'poetry.lock', 'Pipfile.lock']);
  const lockRoots = new Set(files.filter((file) => lockNames.has(file.name)).map((file) => posix(dirname(file.path))));
  const filesByPath = new Map(files.map((file) => [file.path, file]));

  for (const manifest of lockCheckedManifests) {
    const manifestRoot = posix(dirname(manifest.path));
    const hasLockfile = manifest.name === 'package.json'
      ? coveredByWorkspace(manifest, filesByPath, lockRoots)
      : lockRoots.has(manifestRoot);
    if (!hasLockfile) {
      findings.push(createFinding({
        ruleId: 'dependency-lockfile-missing',
        title: 'Dependency manifest has no adjacent lockfile',
        severity: 'low',
        state: 'confirmed',
        summary: 'The project manifest is present, but no supported lockfile was found in the same project root. Dependency resolution is not reproducible from the recorded source alone.',
        location: { path: manifest.path, line: 1 },
        evidence: { subject: manifest.path, observed: 'no adjacent supported lockfile' },
        remediation: 'Generate and commit the package-manager lockfile used by CI and deployment.',
        retest: `Run the source audit again and confirm ${manifest.path} has an adjacent supported lockfile.`,
      }));
    }
  }

  for (const file of files) {
    if (ENV_FILE.test(file.name) && !ENV_TEMPLATE.test(file.name)) {
      findings.push(createFinding({
        ruleId: 'sensitive-env-file-present',
        title: 'Sensitive environment file requires repository and artifact review',
        severity: 'medium',
        state: 'suspected',
        summary: 'An environment-named file exists in the source tree. Its presence does not prove that it is tracked or publicly served, and its contents were not read.',
        location: { path: file.path, line: 1 },
        evidence: { subject: file.path, observed: 'filename only', contentsRead: false },
        remediation: 'Keep secrets outside source control and build artifacts; use an example file containing placeholders when documentation is needed.',
        retest: 'Verify repository tracking and built/deployed artifacts without printing secret values, then rerun this audit.',
      }));
      continue;
    }
    if (file.name === 'package.json') {
      const text = readSmall(file);
      if (!text) continue;
      let manifest;
      try { manifest = JSON.parse(text); } catch { continue; }
      for (const [scriptName, command] of Object.entries(manifest.scripts || {})) {
        if (typeof command !== 'string') continue;
        const match = /--inspect(?:-brk)?(?:=|\s+)(0\.0\.0\.0|\[::\])(?::\d+)?/.exec(command);
        if (!match) continue;
        findings.push(createFinding({
          ruleId: 'node-inspector-public-bind',
          title: 'Node inspector is configured to bind on every interface',
          severity: 'high',
          state: 'suspected',
          discriminator: scriptName,
          summary: `The ${scriptName} script configures the Node inspector on a non-loopback address. Runtime use and network exposure still require confirmation.`,
          location: { path: file.path, line: lineOf(text, text.indexOf(command)) },
          evidence: { subject: `${file.path}#scripts.${scriptName}`, observed: match[0], runtimeReachability: 'unknown' },
          remediation: 'Bind the inspector to loopback and never enable it in an externally reachable production process.',
          retest: 'Run the source audit again, then verify the deployed process has no public inspector listener.',
          patch: `# Review manually: change ${match[1]} to 127.0.0.1 in package.json script ${scriptName}.\n`,
        }));
      }
    }
    if (CONFIG_FILES.test(file.name)) {
      const text = readSmall(file);
      if (!text) continue;
      for (const pattern of [
        /productionBrowserSourceMaps\s*:\s*(true)/,
        /sourcemap\s*:\s*(true|['"](?:inline|hidden)['"])/,
        /sourceMap\s*:\s*(true|['"](?:inline|hidden)['"])/,
      ]) {
        const match = pattern.exec(text);
        if (!match) continue;
        findings.push(createFinding({
          ruleId: 'production-source-map-enabled',
          title: 'Production source maps are enabled in build configuration',
          severity: 'medium',
          state: 'suspected',
          summary: 'The build configuration enables production source maps. This is a lead until the deployed artifact or origin confirms public map delivery.',
          location: { path: file.path, line: lineOf(text, match.index) },
          evidence: { subject: file.path, observed: match[0], publicDelivery: 'unknown' },
          remediation: 'Disable public production source maps or upload them only to an access-controlled error-monitoring service.',
          retest: 'Rebuild, confirm no public .map artifact is emitted or served, and rerun the source audit.',
          patch: patchLine(file.path, text, match, 'false'),
        }));
        break;
      }
    }
  }

  if (!manifests.length) {
    findings.push(createFinding({
      ruleId: 'source-stack-unsupported',
      title: 'No supported source manifest was available',
      severity: 'info',
      state: 'unknown',
      summary: 'The deterministic source rules could not establish a supported Node or Python project boundary.',
      evidence: { subject: '.', observed: 'no supported manifest' },
      remediation: 'Record the stack manually and use the agent-guided methodology for the project framework.',
      retest: 'Provide a supported manifest or an explicit, reviewable stack adapter and rerun.',
    }));
  }
  return findings;
}

export function renderPatch(findings) {
  const patches = findings.filter((finding) => finding.patch).map((finding) =>
    `# ${finding.id}: ${finding.title}\n${finding.patch.trim()}\n`);
  return patches.length
    ? `# Proposed changes only. Review and apply manually; this file does not prove a fix.\n\n${patches.join('\n')}\n`
    : '# No deterministic patch proposal was produced. Findings still require review.\n';
}
