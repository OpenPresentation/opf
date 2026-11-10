import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {gunzipSync} from 'node:zlib';

const dir = fileURLToPath(new URL('./', import.meta.url));
const root = fileURLToPath(new URL('../../../../', import.meta.url));
const prefix = 'docs/handoff/2026-11-09/sh20-portable-gate/';
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const git = (...args) => execFileSync('git', args, {cwd: root, encoding: 'utf8'}).trim();
const bytes = fs.readFileSync(path.join(dir, 'manifest.json'));
assert.equal(hash(bytes), fs.readFileSync(path.join(dir, 'manifest.sha256'), 'utf8').split(' ')[0]);
const manifest = JSON.parse(bytes), raw = new Map();
assert.equal(manifest.files.length, 27);
for (const item of manifest.files) {
  assert.match(item.transport, /^logs\/[A-Za-z0-9_.-]+\.gz$/);
  const transport = fs.readFileSync(path.join(dir, item.transport));
  assert.equal(transport.length, item.gzipBytes);
  assert.equal(hash(transport), item.gzipSha256);
  const decoded = gunzipSync(transport, {maxOutputLength: 2 * 1024 * 1024});
  assert.equal(decoded.length, item.bytes);
  assert.equal(hash(decoded), item.sha256);
  assert(!raw.has(item.name));
  raw.set(item.name, decoded);
}
assert.equal([...raw.values()].reduce((sum, value) => sum + value.length, 0), manifest.rawBytes);
assert.equal(git('rev-parse', `${manifest.source}^{tree}`), manifest.sourceTree);
const proof = JSON.parse(raw.get('sh20-source-proof.json'));
assert.equal(proof.source, manifest.source);
assert.equal(proof.base, manifest.base);
assert.deepEqual(git('diff', '--name-only', manifest.base, manifest.source).split('\n').sort(), proof.changed);
for (const item of proof.protectedBlobs) {
  assert.equal(git('rev-parse', `${manifest.base}:${item.path}`), item.blob);
  assert.equal(git('rev-parse', `${manifest.source}:${item.path}`), item.blob);
}
assert.equal(git('rev-parse', `${manifest.base}:spec`), proof.specTree);
assert.equal(git('rev-parse', `${manifest.source}:spec`), proof.specTree);
assert.deepEqual(git('diff', '--name-only', manifest.base, manifest.source, '--', 'packages').split('\n'), ['packages/pptx/test/sh20-layout-xml.mjs']);
const parser = 'tools/shapes/sh-20/layout-xml.mjs';
assert.equal(git('show', `${manifest.source}:${parser}`), git('show', `${manifest.base}:${parser}`).replace("createRequire('C:/opf-work/wave2-review/packages/pptx/package.json')", "createRequire(new URL('../../../packages/pptx/package.json', import.meta.url))"));
const later = git('diff', '--name-only', manifest.source, 'HEAD').split('\n').filter(Boolean);
assert(later.every(file => file.startsWith(prefix) || file === 'docs/programs/shapes/burndown.md'), 'Later changes exceed this frozen repair evidence; verify in its frozen checkout');
assert.equal(JSON.parse(raw.get('sh20-parser-before.exit.json')).exitCode, 1);
assert.match(raw.get('sh20-parser-before.log').toString(), /bad option: --experimental-permission/);
assert.equal(JSON.parse(raw.get('sh20-parser-before-02.exit.json')).exitCode, 1);
assert.match(raw.get('sh20-parser-before-02.log').toString(), /ERR_ACCESS_DENIED/);
assert.match(raw.get('sh20-parser-before-02.log').toString(), /wave2-review/);
for (const name of ['sh20-parser-after', 'sh20-mapped-01', 'sh20-guard-after', 'sh20-final-evidence-check']) assert.equal(JSON.parse(raw.get(`${name}.exit.json`)).exitCode, 0);
assert.match(raw.get('sh20-mapped-01.log').toString(), /check-changed: passed/);
assert.match(raw.get('sh20-guard-after.log').toString(), /14CLI\/7pure refusals/);
console.log(JSON.stringify({files: raw.size, rawBytes: manifest.rawBytes, source: manifest.source, protectedBlobs: proof.protectedBlobs.length, officeCalls: manifest.officeCalls}));
