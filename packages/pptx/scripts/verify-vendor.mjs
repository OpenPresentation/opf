import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const verify = async (root, manifest) => {
  for (const [name, record] of Object.entries(manifest.files)) {
    const bytes = await readFile(new URL(name, root));
    assert.equal(bytes.length, record.bytes, `${name}: upstream length`);
    assert.equal(sha256(bytes), record.sha256, `${name}: upstream hash`);
  }
};
const root = new URL('../vendor/pptxgenjs/', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('UPSTREAM.json', root), 'utf8'));
assert.equal(manifest.name, 'pptxgenjs-plus');
assert.equal(manifest.version, '4.3.4');
assert.equal(manifest.license, 'MIT');
await verify(root, manifest);

// RR-20: the browser build of the engine's ZIP dependency (vendor/jszip/UPSTREAM.json). It must be the published
// lib/index-min.js of exactly the @node-projects/jszip version opf-pptx pins and installs, so browser and Node run the
// same JSZip release. The browser field of vendor/pptxgenjs/package.json points the engine's import at it.
const zipRoot = new URL('../vendor/jszip/', import.meta.url);
const zipManifest = JSON.parse(await readFile(new URL('UPSTREAM.json', zipRoot), 'utf8'));
const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const lock = JSON.parse(await readFile(new URL('../package-lock.json', import.meta.url), 'utf8'));
assert.equal(zipManifest.name, '@node-projects/jszip');
assert.equal(zipManifest.version, pkg.dependencies['@node-projects/jszip'], 'vendor/jszip matches the pinned @node-projects/jszip dependency');
assert.equal(zipManifest.integrity, lock.packages['node_modules/@node-projects/jszip'].integrity, 'vendor/jszip comes from the locked archive');
assert.equal(zipManifest.licenseUsed, 'MIT');
await verify(zipRoot, zipManifest);
const vendorPackage = JSON.parse(await readFile(new URL('package.json', root), 'utf8'));
assert.equal(vendorPackage.browser['@node-projects/jszip'], '../jszip/index-min.js', 'browser builds use the vendored ZIP bundle');
// The installed package (npm verified its archive integrity) must ship the same bundle.
const installed = path.join(path.dirname(createRequire(import.meta.url).resolve('@node-projects/jszip')), 'index-min.js');
assert.equal(sha256(await readFile(installed)), zipManifest.files['index-min.js'].sha256, 'vendor/jszip/index-min.js equals the installed package bundle');
console.error('Vendored upstream distribution and license match recorded hashes.');
