import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
const root = new URL('../vendor/pptxgenjs/', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('UPSTREAM.json', root), 'utf8'));
assert.equal(manifest.name, 'pptxgenjs');
assert.equal(manifest.version, '4.0.1');
assert.equal(manifest.license, 'MIT');
for (const name of ['pptxgen.es.js', 'LICENSE']) {
  const bytes = await readFile(new URL(name, root));
  assert.equal(bytes.length, manifest.files[name].bytes, `${name}: upstream length`);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), manifest.files[name].sha256, `${name}: upstream hash`);
}
console.error('Vendored upstream distribution and license match recorded hashes.');
