import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isAllowedAocPath } from '../api/aoc-proxy.js';

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
console.log(`AOC cutover boundary passed for ${deployable.length} deployable files.`);
