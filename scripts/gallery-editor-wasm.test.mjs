import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync, realpathSync, readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {galleryEditorWasmManifest} from './gallery-editor-wasm.mjs';

function fixture() {
  const consumer = realpathSync(mkdtempSync(path.join(tmpdir(), 'gallery-wasm-')));
  const renderer = path.join(consumer, 'node_modules/@openpresentation/opf-render');
  const harfbuzz = path.join(consumer, 'node_modules/harfbuzzjs');
  mkdirSync(renderer, {recursive: true}); mkdirSync(path.join(harfbuzz, 'dist'), {recursive: true});
  const put = (file, value) => writeFileSync(file, JSON.stringify(value));
  put(path.join(consumer, 'package.json'), {private: true});
  put(path.join(renderer, 'package.json'), {name: '@openpresentation/opf-render', version: '0.18.1', dependencies: {harfbuzzjs: '1.6.3'}, exports: {'./package.json': './package.json'}});
  put(path.join(harfbuzz, 'package.json'), {name: 'harfbuzzjs', version: '1.6.3', license: 'MIT', repository: {url: 'git+https://github.com/harfbuzz/harfbuzzjs.git'}, exports: {'./dist/*.wasm': './dist/*.wasm'}});
  writeFileSync(path.join(harfbuzz, 'LICENSE'), 'MIT license notice');
  const bytes = Buffer.from([0, 97, 115, 109, 1, 0, 0, 0]);
  for (const file of ['harfbuzz-subset.wasm', 'harfbuzz.wasm']) writeFileSync(path.join(harfbuzz, 'dist', file), bytes);
  return {consumer, renderer, harfbuzz, put, bytes, args: {consumer, rendererVersion: '0.18.1'}};
}
function withFixture(action) { const data = fixture(); try {action(data);} finally {rmSync(data.consumer, {recursive: true, force: true});} }
function alter(file, change) {const data = JSON.parse(readFileSync(file)); change(data); writeFileSync(file, JSON.stringify(data));}

test('manifest records actual resolved versions, source, license and both byte digests', () => withFixture(({args, bytes}) => {
  const manifest = galleryEditorWasmManifest(args);
  assert.equal(manifest.contract, 'opf-gallery-editor-wasm/v1');
  assert.deepEqual(manifest.renderer, {name: '@openpresentation/opf-render', version: '0.18.1'});
  assert.deepEqual(manifest.package, {name: 'harfbuzzjs', version: '1.6.3', license: 'MIT', source: 'https://github.com/harfbuzz/harfbuzzjs'});
  assert.deepEqual(manifest.files.map(item => item.file), ['harfbuzz-subset.wasm', 'harfbuzz.wasm']);
  for (const item of manifest.files) assert.equal(item.sha256, createHash('sha256').update(bytes).digest('hex'));
}));
test('stale renderer, ranged dependency, stale HarfBuzz and unsupported license cannot produce metadata', () => {
  withFixture(({args}) => assert.throws(() => galleryEditorWasmManifest({...args, rendererVersion: '0.18.0'}), /toolchain/));
  for (const [kind, change, match] of [
    ['renderer', data => {data.dependencies.harfbuzzjs = '^1.6.3';}, /exact HarfBuzz/],
    ['harfbuzz', data => {data.version = '1.6.2';}, /renderer dependency/],
    ['harfbuzz', data => {data.license = 'GPL-3.0';}, /license/],
  ]) withFixture(data => {alter(path.join(data[kind], 'package.json'), change); assert.throws(() => galleryEditorWasmManifest(data.args), match);});
});
test('missing license, non-WASM bytes and aliased or dangling module files fail before a manifest is returned', () => {
  withFixture(({args, harfbuzz}) => {rmSync(path.join(harfbuzz, 'LICENSE')); assert.throws(() => galleryEditorWasmManifest(args));});
  withFixture(({args, harfbuzz}) => {writeFileSync(path.join(harfbuzz, 'dist/harfbuzz.wasm'), 'not wasm'); assert.throws(() => galleryEditorWasmManifest(args), /WebAssembly/);});
  for (const dangling of [false, true]) withFixture(({args, harfbuzz, consumer, bytes}) => {
    const target = path.join(consumer, 'outside.wasm'); if (!dangling) writeFileSync(target, bytes);
    const file = path.join(harfbuzz, 'dist/harfbuzz.wasm'); rmSync(file); symlinkSync(target, file);
    assert.throws(() => galleryEditorWasmManifest(args));
  });
});
