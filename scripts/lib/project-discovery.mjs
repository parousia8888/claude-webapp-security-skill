import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { sourceAuditBoundary } from './project-identity.mjs';

const IGNORED_DIRECTORIES = new Set([
  '.git', '.hg', '.svn', '.next', '.nuxt', '.output', '.webapp-security',
  'build', 'coverage', 'dist', 'node_modules', 'target', 'vendor', '__pycache__', '.venv', 'venv',
]);
const REQUIREMENTS = /^requirements(?:\.[a-z0-9_-]+)?\.txt$/i;
const LOCKFILES = new Map([
  ['package-lock.json', 'npm'], ['npm-shrinkwrap.json', 'npm'], ['pnpm-lock.yaml', 'pnpm'],
  ['yarn.lock', 'yarn'], ['bun.lock', 'bun'], ['bun.lockb', 'bun'], ['uv.lock', 'uv'],
  ['poetry.lock', 'poetry'], ['Pipfile.lock', 'pipenv'],
]);
const DEPLOYMENT_NAMES = new Set([
  'Dockerfile', 'compose.yaml', 'compose.yml', 'docker-compose.yaml', 'docker-compose.yml',
  'vercel.json', 'netlify.toml', 'render.yaml', 'render.yml', 'fly.toml', 'Procfile',
  'railway.json', 'railway.toml', 'app.yaml', 'cloudbuild.yaml', 'serverless.yml',
]);
const CONFIG_NAMES = new Set([
  'next.config.js', 'next.config.mjs', 'next.config.ts', 'vite.config.js', 'vite.config.mjs',
  'vite.config.ts', 'nuxt.config.js', 'nuxt.config.ts', 'svelte.config.js', 'astro.config.mjs',
  'manage.py', 'wsgi.py', 'asgi.py',
]);

const posix = (path) => path.split(sep).join('/');

function safeText(path, warnings) {
  try {
    if (statSync(path).size > 1024 * 1024) {
      warnings.push(`${posix(path)} was not read because it exceeds 1 MiB`);
      return null;
    }
    return readFileSync(path, 'utf8');
  } catch {
    warnings.push(`${posix(path)} could not be read`);
    return null;
  }
}

function scanFiles(root, maxDepth = 4, maxFiles = 5000) {
  const files = [];
  let truncated = false;
  function visit(directory, depth) {
    if (truncated || depth > maxDepth) return;
    let entries;
    try {
      entries = readdirSync(directory, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (files.length >= maxFiles) { truncated = true; return; }
      if (entry.isSymbolicLink()) continue;
      const absolute = join(directory, entry.name);
      if (entry.isDirectory()) {
        if (!IGNORED_DIRECTORIES.has(entry.name)) visit(absolute, depth + 1);
      } else if (entry.isFile()) {
        files.push({ absolute, relative: posix(relative(root, absolute)), name: entry.name });
      }
    }
  }
  visit(root, 0);
  return { files, truncated };
}

function framework(name, ecosystem, root, evidence) {
  return { name, ecosystem, root: root || '.', evidence };
}

function packageFrameworks(manifest, root, path) {
  const dependencies = new Set(Object.keys({
    ...(manifest.dependencies || {}), ...(manifest.devDependencies || {}),
    ...(manifest.peerDependencies || {}), ...(manifest.optionalDependencies || {}),
  }));
  const candidates = [
    ['next', 'Next.js'], ['nuxt', 'Nuxt'], ['@sveltejs/kit', 'SvelteKit'], ['astro', 'Astro'],
    ['@nestjs/core', 'NestJS'], ['fastify', 'Fastify'], ['express', 'Express'], ['koa', 'Koa'],
    ['hono', 'Hono'], ['vite', 'Vite'], ['react', 'React'], ['vue', 'Vue'], ['svelte', 'Svelte'],
  ];
  return candidates.filter(([dependency]) => dependencies.has(dependency))
    .map(([, name]) => framework(name, 'node', root, path));
}

function pythonFrameworks(text, root, path) {
  if (!text) return [];
  const candidates = [['fastapi', 'FastAPI'], ['django', 'Django'], ['flask', 'Flask'], ['starlette', 'Starlette']];
  return candidates.filter(([dependency]) => new RegExp(`(^|[^a-z0-9_-])${dependency}([^a-z0-9_-]|$)`, 'i').test(text))
    .map(([, name]) => framework(name, 'python', root, path));
}

function normalizeOrigin(value, source, warnings) {
  if (!value || typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error();
    return {
      url: `${url.origin}/`,
      source,
      status: source === 'user' ? 'user_supplied_unverified' : 'manifest_hint_unverified',
    };
  } catch {
    warnings.push(`${source} public origin was ignored because it is not a credential-free HTTP(S) URL`);
    return null;
  }
}

export function discoverProject(projectPath, options = {}) {
  const projectRoot = resolve(projectPath);
  if (!existsSync(projectRoot) || !statSync(projectRoot).isDirectory()) {
    throw new Error(`project must be an existing directory: ${projectPath}`);
  }
  const { files, truncated } = scanFiles(projectRoot, options.maxDepth, options.maxFiles);
  const warnings = [];
  const manifests = [];
  const lockfiles = [];
  const packageManagers = [];
  const deploymentSurfaces = [];
  const configSurfaces = [];
  const frameworks = [];
  const origins = [];
  const examined = [];

  for (const file of files) {
    const root = posix(dirname(file.relative)) === '.' ? '.' : posix(dirname(file.relative));
    if (LOCKFILES.has(file.name)) {
      lockfiles.push(file.relative);
      packageManagers.push({ name: LOCKFILES.get(file.name), root, evidence: file.relative });
    }
    if (DEPLOYMENT_NAMES.has(file.name) || file.relative.startsWith('.github/workflows/')) {
      deploymentSurfaces.push(file.relative);
    }
    if (CONFIG_NAMES.has(file.name)) configSurfaces.push(file.relative);
    if (file.name === 'package.json') {
      manifests.push(file.relative);
      examined.push(file.relative);
      const text = safeText(file.absolute, warnings);
      if (!text) continue;
      try {
        const manifest = JSON.parse(text);
        frameworks.push(...packageFrameworks(manifest, root, file.relative));
        if (typeof manifest.packageManager === 'string') {
          const name = manifest.packageManager.split('@')[0];
          if (/^(npm|pnpm|yarn|bun)$/.test(name)) packageManagers.push({ name, root, evidence: file.relative });
        }
        const origin = normalizeOrigin(manifest.homepage, `manifest:${file.relative}`, warnings);
        if (origin) origins.push(origin);
      } catch {
        warnings.push(`${file.relative} is invalid JSON; stack evidence is ambiguous`);
      }
    } else if (file.name === 'pyproject.toml' || REQUIREMENTS.test(file.name)) {
      manifests.push(file.relative);
      examined.push(file.relative);
      if (REQUIREMENTS.test(file.name)) packageManagers.push({ name: 'pip', root, evidence: file.relative });
      frameworks.push(...pythonFrameworks(safeText(file.absolute, warnings), root, file.relative));
    }
  }

  const userOrigin = normalizeOrigin(options.origin, 'user', warnings);
  if (userOrigin) origins.unshift(userOrigin);
  if (truncated) warnings.push('file discovery reached the 5000-file scan limit');

  const unique = (items, key) => [...new Map(items.map((item) => [key(item), item])).values()];
  const detectedFrameworks = unique(frameworks, (item) => `${item.name}:${item.root}`);
  const detectedManagers = unique(packageManagers, (item) => `${item.name}:${item.root}`);
  const ecosystems = new Set(detectedFrameworks.map((item) => item.ecosystem));
  const roots = new Set(detectedFrameworks.map((item) => item.root));
  let layout = 'single-root';
  if (ecosystems.size > 1 && roots.size > 1) layout = 'split-stack';
  else if (roots.size > 1) layout = 'monorepo';
  const status = detectedFrameworks.length ? 'supported' : manifests.length ? 'ambiguous' : 'unsupported';
  const unknowns = [];
  if (!origins.length) unknowns.push('public origin not supplied or found in safe manifest metadata');
  unknowns.push('deployment ownership and authorization are not established by source discovery');
  if (status === 'ambiguous') unknowns.push('manifest found but no supported framework dependency was identified');
  if (status === 'unsupported') unknowns.push('no supported Node or Python manifest was found');

  return {
    projectRoot,
    status,
    layout,
    frameworks: detectedFrameworks,
    packageManagers: detectedManagers,
    manifests: [...new Set(manifests)].sort(),
    lockfiles: [...new Set(lockfiles)].sort(),
    deploymentSurfaces: [...new Set(deploymentSurfaces)].sort(),
    configSurfaces: [...new Set(configSurfaces)].sort(),
    publicOrigins: unique(origins, (item) => item.url),
    examinedFiles: [...new Set(examined)].sort(),
    warnings,
    unknowns,
  };
}

export function buildScope(discovery, metadata) {
  const hasOrigin = discovery.publicOrigins.length > 0;
  if (!metadata.subject) throw new Error('scope subject identity is required');
  return {
    schemaVersion: 2,
    generatedBy: { product: 'Web App Security Skill', version: metadata.version },
    generatedAt: metadata.generatedAt,
    subject: metadata.subject,
    auditBoundary: sourceAuditBoundary(),
    run: { id: metadata.runId, directory: metadata.runDirectory },
    target: {
      projectRoot: discovery.projectRoot,
      discoveryStatus: discovery.status,
      layout: discovery.layout,
      frameworks: discovery.frameworks,
      packageManagers: discovery.packageManagers,
      manifests: discovery.manifests,
      lockfiles: discovery.lockfiles,
      deploymentSurfaces: discovery.deploymentSurfaces,
      configSurfaces: discovery.configSurfaces,
      publicOrigins: discovery.publicOrigins,
    },
    authorization: {
      status: 'pending',
      basis: null,
      proof: null,
      note: 'Source access does not prove ownership of a deployment.',
    },
    checkModes: {
      source: { status: 'ready', network: false, authorizationRequired: false },
      local: { status: 'ready', network: false, authorizationRequired: false },
      remotePassive: {
        status: hasOrigin ? 'blocked_pending_authorization' : 'not_configured',
        network: true,
        authorizationRequired: true,
      },
      remoteActive: {
        status: hasOrigin ? 'blocked_pending_authorization' : 'not_configured',
        network: true,
        authorizationRequired: true,
        explicitAcknowledgementRequired: true,
      },
    },
    discoveryEvidence: {
      examinedFiles: discovery.examinedFiles,
      networkAccessPerformed: false,
      secretFilesRead: false,
      warnings: discovery.warnings,
      unknowns: discovery.unknowns,
    },
    exclusions: [
      'third-party services and hosts not explicitly authorized',
      'secret file contents',
      'production or remote traffic until authorization is recorded',
    ],
  };
}
