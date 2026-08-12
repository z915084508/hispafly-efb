import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import aocProxy, { isAllowedAocPath, isAllowedPdfRedirect } from '../api/aoc-proxy.js';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const files = [];
function walk(directory) {
  for (const name of readdirSync(directory)) {
    const path = join(directory, name), key = relative(root, path).replaceAll('\\', '/');
    if (name === '.git' || name === 'node_modules' || name === 'public' || key === 'assets/aviation-abbreviations-data.json') continue;
    if (statSync(path).isDirectory()) walk(path); else files.push(path);
  }
}
walk(root);
const deployable = files.filter((file) => /\.(?:js|html|json|md|example)$/.test(file) && !file.endsWith('aoc-cutover.test.js'));
for (const file of deployable) assert.doesNotMatch(readFileSync(file, 'utf8'), /vamsys\.io|oauth\/token|vamsys_token|VAMSYS_/i, `${relative(root, file)} retains a prohibited runtime dependency`);
assert.match(readFileSync(join(root, 'index.html'), 'utf8'), /api\/auth\/local\/login/);
assert.match(readFileSync(join(root, 'api/aoc-proxy.js'), 'utf8'), /AOC_ROUTE_RULES/);
assert.match(readFileSync(join(root, 'api/token-proxy.js'), 'utf8'), /410/);
assert.equal(isAllowedAocPath('/api/auth/local/login', 'POST'), true);
assert.equal(isAllowedAocPath('/api/auth/local/login', 'GET'), false);
assert.equal(isAllowedAocPath('/api/efb/pilot/bookings'), true);
assert.equal(isAllowedAocPath('/api/efb/../staff/users'), false);
assert.equal(isAllowedAocPath('/api/efb/%2e%2e/staff/users'), false);
assert.equal(isAllowedAocPath('/api/efb/..%2fstaff/users'), false);
assert.equal(isAllowedAocPath('/api/staff/users'), false);
assert.equal(isAllowedAocPath('/api/pilot/live-flights', 'POST'), false);
assert.equal(isAllowedAocPath('/api/ofp/abc12345/pdf', 'GET'), true);
assert.equal(isAllowedPdfRedirect('https://www.simbrief.com/ofp/flightplans/HF0123.pdf'), true);
assert.equal(isAllowedPdfRedirect('https://cdn.cloudfront.net/ofp/HF0123.pdf'), true);
assert.equal(isAllowedPdfRedirect('https://aoc.hispafly.es/api/ofp/abc12345/pdf'), true);
assert.equal(isAllowedPdfRedirect('https://aoc.hispafly.es/pilot'), false);
assert.equal(isAllowedPdfRedirect('https://example.com/ofp.pdf'), false);

const originalFetch = globalThis.fetch;
const proxyRequests = [];
globalThis.fetch = async (url, options) => {
  proxyRequests.push({ url: String(url), cookie: options.headers.Cookie });
  if (proxyRequests.length === 1) {
    return new Response(null, { status: 302, headers: { Location: 'https://www.simbrief.com/ofp/flightplans/HF0123.pdf' } });
  }
  return new Response(Buffer.from('%PDF-1.7 test'), { status: 200, headers: { 'Content-Type': 'application/pdf' } });
};
const proxyResponse = {
  statusCode: 0,
  headers: {},
  status(code) { this.statusCode = code; return this; },
  setHeader(name, value) { this.headers[name] = value; },
  send(body) { this.body = body; return this; },
  json(body) { this.body = body; return this; },
};
try {
  await aocProxy({
    method: 'GET',
    query: { path: '/api/ofp/abc12345/pdf' },
    headers: { cookie: 'aoc_session=secret' },
  }, proxyResponse);
} finally {
  globalThis.fetch = originalFetch;
}
assert.equal(proxyResponse.statusCode, 200);
assert.equal(proxyResponse.headers['Content-Type'], 'application/pdf');
assert.equal(proxyRequests.length, 2);
assert.equal(proxyRequests[0].cookie, 'aoc_session=secret');
assert.equal(proxyRequests[1].cookie, undefined);
console.log(`AOC cutover boundary passed for ${deployable.length} deployable files.`);
