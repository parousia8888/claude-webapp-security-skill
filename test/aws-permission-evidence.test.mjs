#!/usr/bin/env node
import assert from 'node:assert/strict';
import { chmodSync, copyFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SCRIPT = join(ROOT, 'scripts', 'aws-exposure-audit.sh');
const temp = mkdtempSync(join(tmpdir(), 'web-app-security-aws-'));
const bin = join(temp, 'bin');
mkdirSync(bin);
const fake = join(bin, 'aws');
copyFileSync(join(ROOT, 'test', 'fixtures', 'aws', 'fake-aws.sh'), fake);
chmodSync(fake, 0o755);

try {
  const secret = 'FIXTURE_SECRET_MUST_NOT_APPEAR';
  const result = spawnSync('/bin/bash', [SCRIPT, '--region', 'us-east-1'], {
    cwd: ROOT,
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${bin}:/usr/bin:/bin`,
      AWS_SECRET_ACCESS_KEY: secret,
      AWS_SESSION_TOKEN: secret,
    },
  });
  assert.equal(result.status, 3, result.stderr || result.stdout);
  assert.match(result.stdout, /\[UNCHECKED\].*iam list-mfa-devices/i);
  assert.match(result.stdout, /\[UNCHECKED\].*cloudtrail get-trail-status/i);
  assert.match(result.stdout, /root account has MFA enabled/);
  assert.doesNotMatch(result.stdout, /fixture-user.*no MFA/i);
  assert.doesNotMatch(result.stdout, /fixture-trail.*not currently logging/i);
  assert.doesNotMatch(`${result.stdout}\n${result.stderr}`, new RegExp(secret));
  assert.match(result.stdout, /UNCHECKED: 2/);
  console.log('✓ AWS permission evidence: denied nested reads remain UNCHECKED and exit non-success');
} finally {
  rmSync(temp, { recursive: true, force: true });
}
