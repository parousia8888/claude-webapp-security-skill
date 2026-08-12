#!/usr/bin/env node
/**
 * Integration test for verify-crawler-ip.mjs through its real CLI, with a local HTTP fixture
 * standing in for the vendor range endpoints — no network, no third-party dependency.
 *
 * This is the coverage the pure-function tests could not give: the actual multi-source
 * aggregation path. It pins the reported defect end-to-end — when GPTBot's own list fails
 * to load while sibling OpenAI lists load empty, a genuine crawler must NOT be branded spoofed.
 *
 * Uses TEST-NET-3 (203.0.113.0/24, RFC 5737) as the client IP: it has no PTR, so reverse DNS
 * fails fast and the test exercises the range path in isolation. All default range sources are
 * overridden to the fixture, so nothing reaches the internet.
 */
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';

const SCRIPT = fileURLToPath(new URL('../scripts/verify-crawler-ip.mjs', import.meta.url));

const server = createServer((req, res) => {
  if (req.url === '/503') { res.writeHead(503); res.end('nope'); return; }
  if (req.url === '/empty') { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ prefixes: [] })); return; }
  if (req.url === '/hit') { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ prefixes: [{ ipv4Prefix: '203.0.113.0/24' }] })); return; }
  res.writeHead(404); res.end();
});
server.listen(0, '127.0.0.1');
await once(server, 'listening');
const base = `http://127.0.0.1:${server.address().port}`;

// Override EVERY default range source so nothing hits the internet; only the OpenAI three vary.
const src = ({ gptbot, oai, chatgpt }) => [
  ['googlebot', 'empty'], ['google-special', 'empty'], ['google-user-triggered', 'empty'], ['bingbot', 'empty'],
  ['gptbot', gptbot], ['oai-searchbot', oai], ['chatgpt-user', chatgpt],
].flatMap(([k, v]) => ['--source', `${k}=${base}/${v}`]);

function run(args) {
  return new Promise((resolve) => {
    const p = spawn('node', [SCRIPT, ...args], { stdio: ['ignore', 'pipe', 'ignore'] });
    let out = '';
    p.stdout.on('data', (d) => (out += d));
    p.on('close', (code) => resolve({ code, out }));
  });
}

let failed = 0;
const check = (name, cond) => { if (!cond) { failed++; console.error(`✗ ${name}`); } };
const IP = '203.0.113.1';

// A — REGRESSION: GPTBot's own list 503s, siblings load empty → must be unverifiable, exit 0 (NOT spoofed)
const a = await run(['--ip', IP, '--ua', 'GPTBot/1.2', '--ranges', ...src({ gptbot: '503', oai: 'empty', chatgpt: 'empty' })]);
check('A gptbot-source-503 → exit 0 (not spoofed)', a.code === 0);
check('A gptbot-source-503 → unverifiable verdict', /unverifiable/.test(a.out));

// B — GPTBot's exact source loaded and the IP is absent. Sibling source failures do not
// weaken the successfully-loaded product-specific evidence.
const b = await run(['--ip', IP, '--ua', 'GPTBot/1.2', '--ranges', ...src({ gptbot: 'empty', oai: '503', chatgpt: '503' })]);
check('B exact source loaded + IP absent → exit 1', b.code === 1);
check('B exact source loaded + IP absent → spoofed verdict', /spoofed/.test(b.out));

// C — IP present in a loaded range → verified, exit 0
const c = await run(['--ip', IP, '--ua', 'GPTBot/1.2', '--ranges', ...src({ gptbot: 'hit', oai: 'empty', chatgpt: 'empty' })]);
check('C IP in loaded range → exit 0', c.code === 0);
check('C IP in loaded range → verified verdict', /verified/.test(c.out));

// D — a sibling OpenAI product contains the IP while GPTBot's source is unavailable.
// Vendor ownership alone cannot prove that the request is GPTBot.
const d = await run(['--ip', IP, '--ua', 'GPTBot/1.2', '--ranges', ...src({ gptbot: '503', oai: 'hit', chatgpt: 'empty' })]);
check('D sibling hit + exact source unavailable → exit 0', d.code === 0);
check('D sibling hit + exact source unavailable → unverifiable', /unverifiable/.test(d.out));

server.close();
if (failed) { console.error(`\n${failed} integration assertion(s) failed`); process.exit(1); }
console.log('✓ integration: 8 assertions pass (product-specific range decisions via the real CLI)');
