import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const [consumer, target = 'https://www.pptx.dev', output] = process.argv.slice(2);
assert.ok(consumer, 'Usage: node scripts/verify-deployed-browser-fonts.mjs <registry-consumer> [https://deployment] [report.json]');
const origin = new URL(target);
assert.equal(origin.protocol, 'https:', 'Verify an HTTPS deployment');
assert.equal(origin.username + origin.password + origin.search + origin.hash, '', 'Use a public deployment URL without credentials or query parameters');
const require = createRequire(path.resolve(consumer, 'package.json'));
const moduleUrl = pathToFileURL(require.resolve('@openpresentation/opf-render/fonts-node'));
const { loadOfficeFontRegistry } = await import(moduleUrl.href);
const manifest = JSON.parse(await readFile(new URL('../package.json', moduleUrl), 'utf8'));
const registry = await loadOfficeFontRegistry();
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const key = face => JSON.stringify([face.family, face.weight, Boolean(face.italic)]);
const expected = new Map(registry.embeddedFonts.map(face => [key(face), {
  sha256: digest(Buffer.from(face.dataUrl.split(',')[1], 'base64')), license: face.license,
}]));
async function get(url) {
  const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(30_000) });
  assert.equal(response.status, 200, `HTTP status for ${url}`);
  return response;
}
const deployed = await (await get(new URL('/opf-fonts/manifest.json', origin))).json();
assert.equal(deployed.source, `${manifest.name}@${manifest.version}`);
assert.equal(deployed.faces.length, expected.size);
assert.equal(new Set(deployed.faces.map(key)).size, expected.size, 'No duplicate font faces');
const faces = await Promise.all(deployed.faces.map(async face => {
  const match = expected.get(key(face));
  assert.ok(match, `Unknown deployed font face: ${key(face)}`);
  assert.equal(face.sha256, match.sha256);
  assert.equal(face.license, match.license);
  assert.match(face.url, /^\/opf-fonts\/[A-Za-z0-9.-]+\.ttf$/);
  const bytes = Buffer.from(await (await get(new URL(face.url, origin))).arrayBuffer());
  assert.equal(digest(bytes), match.sha256, `Deployed bytes for ${face.url}`);
  return { family: face.family, weight: face.weight, italic: Boolean(face.italic), sha256: face.sha256 };
}));
const report = { passed: true, deployment: origin.origin, source: deployed.source, fontFaces: faces.length, faces };
if (output) await writeFile(path.resolve(output), JSON.stringify(report, null, 2) + '\n');
console.log(`Verified ${faces.length} deployed font files and licenses against installed ${deployed.source}.`);
