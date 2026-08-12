#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const argv = process.argv.slice(2);
const outIndex = argv.indexOf('--out');
const output = resolve(outIndex === -1 ? 'dist/web-app-security-skill.spdx.json' : argv[outIndex + 1]);
const version = readFileSync(new URL('../VERSION', import.meta.url), 'utf8').trim();
const digest = createHash('sha256').update(`${version}:parousia8888/web-app-security-skill`).digest('hex');
const created = process.env.SOURCE_DATE_EPOCH
  ? new Date(Number(process.env.SOURCE_DATE_EPOCH) * 1000).toISOString()
  : new Date().toISOString();

const document = {
  spdxVersion: 'SPDX-2.3',
  dataLicense: 'CC0-1.0',
  SPDXID: 'SPDXRef-DOCUMENT',
  name: `web-app-security-skill-${version}`,
  documentNamespace: `https://github.com/parousia8888/web-app-security-skill/sbom/${version}/${digest}`,
  creationInfo: {
    created,
    creators: ['Tool: web-app-security-skill/generate-sbom'],
    licenseListVersion: '3.26',
  },
  packages: [{
    name: 'web-app-security-skill',
    SPDXID: 'SPDXRef-Package-web-app-security-skill',
    versionInfo: version,
    downloadLocation: `https://github.com/parousia8888/web-app-security-skill/archive/refs/tags/v${version}.tar.gz`,
    filesAnalyzed: false,
    licenseConcluded: 'MIT',
    licenseDeclared: 'MIT',
    copyrightText: 'NOASSERTION',
    externalRefs: [{
      referenceCategory: 'PACKAGE-MANAGER',
      referenceType: 'purl',
      referenceLocator: `pkg:github/parousia8888/web-app-security-skill@v${version}`,
    }],
  }],
  relationships: [{
    spdxElementId: 'SPDXRef-DOCUMENT',
    relationshipType: 'DESCRIBES',
    relatedSpdxElement: 'SPDXRef-Package-web-app-security-skill',
  }],
};

mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, `${JSON.stringify(document, null, 2)}\n`);
console.log(output);
