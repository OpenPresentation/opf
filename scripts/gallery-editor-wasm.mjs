// Registry gallery build metadata only: binaries are materialized by the site's existing verifier.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {lstatSync, readFileSync, realpathSync} from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';

const RENDERER = '@openpresentation/opf-render';
const PACKAGE = 'harfbuzzjs';
const FILES = ['harfbuzz-subset.wasm', 'harfbuzz.wasm'];
const exact = /^\d+\.\d+\.\d+$/;
const licenses = new Set(['OFL-1.1', 'Apache-2.0', 'MIT', 'UFL-1.0']);
function regular(file) {
  assert.ok(lstatSync(file).isFile(), `WASM input must be a regular file: ${file}`);
  assert.equal(realpathSync(file), file, `WASM input must not be aliased: ${file}`);
  return readFileSync(file);
}
const json = file => JSON.parse(regular(file));

/** Resolve from the pristine npm consumer, then bind each module to the renderer's exact dependency. */
export function galleryEditorWasmManifest({consumer, rendererVersion}) {
  const root = realpathSync(consumer);
  const modules = path.join(root, 'node_modules');
  const require = createRequire(path.join(root, 'package.json'));
  const rendererFile = require.resolve(`${RENDERER}/package.json`);
  assert.equal(rendererFile, path.join(modules, RENDERER, 'package.json'), 'WASM renderer must be the registry consumer package');
  const renderer = json(rendererFile);
  assert.equal(renderer.name, RENDERER);
  assert.ok(exact.test(rendererVersion), 'WASM renderer needs an exact release version');
  assert.equal(renderer.version, rendererVersion, 'WASM renderer differs from the registry toolchain');
  const version = renderer.dependencies?.[PACKAGE];
  assert.ok(exact.test(version ?? ''), 'WASM renderer must pin an exact HarfBuzz dependency');
  const fromRenderer = createRequire(rendererFile);
  const first = fromRenderer.resolve(`${PACKAGE}/dist/${FILES[0]}`);
  const packageRoot = path.dirname(path.dirname(first));
  assert.ok(packageRoot.startsWith(modules + path.sep), 'WASM package must stay in the registry consumer');
  const manifest = json(path.join(packageRoot, 'package.json'));
  assert.equal(manifest.name, PACKAGE);
  assert.equal(manifest.version, version, 'Resolved HarfBuzz differs from the renderer dependency');
  assert.ok(licenses.has(manifest.license), 'HarfBuzz license must satisfy the gallery WASM contract');
  assert.ok(regular(path.join(packageRoot, 'LICENSE')).length, 'HarfBuzz must ship its license notice');
  const repository = typeof manifest.repository === 'string' ? manifest.repository : manifest.repository?.url;
  assert.ok(typeof repository === 'string', 'HarfBuzz must identify its source repository');
  const source = repository.replace(/^git\+/, '').replace(/\.git$/, '');
  assert.ok(source.startsWith('https://'), 'HarfBuzz source must be an HTTPS repository');
  const files = FILES.map(file => {
    const resolved = fromRenderer.resolve(`${PACKAGE}/dist/${file}`);
    assert.equal(resolved, path.join(packageRoot, 'dist', file), 'HarfBuzz modules must resolve from one package');
    const bytes = regular(resolved);
    assert.ok(bytes.subarray(0, 8).equals(Buffer.from([0, 97, 115, 109, 1, 0, 0, 0])), 'Expected a WebAssembly module');
    return {file, sha256: createHash('sha256').update(bytes).digest('hex')};
  });
  return {contract: 'opf-gallery-editor-wasm/v1', renderer: {name: RENDERER, version: rendererVersion}, package: {name: PACKAGE, version, license: manifest.license, source}, files};
}
