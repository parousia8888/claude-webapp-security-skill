#!/usr/bin/env node
import { createServer } from 'node:http';

const hardened = process.argv.includes('--hardened');
const server = createServer((req, res) => {
  const origin = `http://${req.headers.host}`;
  const headers = hardened ? {
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'strict-origin-when-cross-origin',
    'content-security-policy': "default-src 'self'; frame-ancestors 'none'",
  } : {};
  if (req.url === '/robots.txt') {
    res.writeHead(200, { ...headers, 'content-type': 'text/plain' });
    res.end(hardened ? `User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n` : 'User-agent: *\nDisallow: /\n');
    return;
  }
  if (req.url === '/sitemap.xml') {
    res.writeHead(200, { ...headers, 'content-type': 'application/xml' });
    res.end(`<?xml version="1.0"?><urlset><url><loc>${origin}/</loc></url></urlset>`);
    return;
  }
  if (req.url === '/llms.txt') {
    res.writeHead(200, { ...headers, 'content-type': 'text/plain' });
    res.end(`# Demo\n\n- ${origin}/\n`);
    return;
  }
  if (req.url === '/app.js') {
    res.writeHead(200, { ...headers, 'content-type': 'application/javascript' });
    res.end('document.documentElement.dataset.ready="true";');
    return;
  }
  if (req.url === '/app.js.map' && !hardened) {
    res.writeHead(200, { ...headers, 'content-type': 'application/json' });
    res.end('{"version":3,"sources":["src/app.js"],"mappings":""}');
    return;
  }
  if (req.url === '/.env' && !hardened) {
    res.writeHead(200, { ...headers, 'content-type': 'text/plain' });
    res.end('DEMO_API_KEY=not-a-real-secret');
    return;
  }
  if (req.url === '/') {
    res.writeHead(200, { ...headers, 'content-type': 'text/html' });
    res.end(`<!doctype html><html><head><title>Hardening demo</title><link rel="canonical" href="${origin}/"></head><body><main><h1>Hardening demo</h1><p>${'Public content. '.repeat(180)}</p></main><script src="/app.js"></script></body></html>`);
    return;
  }
  if (!hardened) {
    res.writeHead(200, { ...headers, 'content-type': 'text/html' });
    res.end('<!doctype html><html><body>SPA shell</body></html>');
    return;
  }
  res.writeHead(404, { ...headers, 'content-type': 'text/plain' });
  res.end('not found');
});

server.listen(0, '127.0.0.1', () => {
  const address = server.address();
  console.log(JSON.stringify({ origin: `http://127.0.0.1:${address.port}`, hardened }));
});
