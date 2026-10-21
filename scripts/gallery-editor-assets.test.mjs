import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { linkedLocalAssets, packageAssetSources, verifyLinkedAssets, versionLinkedAssets } from './gallery-editor-assets.mjs';

const page = '<!doctype html><link rel="stylesheet" href="styles.css"><link rel="stylesheet" href="playground.css"><link rel="icon" href="favicon.ico">'
  + '<link rel="stylesheet" href="https://fonts.example/x.css"><script type="module" src="playground.js"></script><script src="/abs.js"></script>';
const sha256 = value => createHash('sha256').update(value).digest('hex');
function withDirectory(action) {
  const directory = mkdtempSync(path.join(tmpdir(), 'gallery-assets-'));
  return Promise.resolve(action(directory)).finally(() => rmSync(directory, { recursive: true, force: true }));
}
function stage(directory, html, files, omit = []) {
  const manifest = { files: {} };
  writeFileSync(path.join(directory, 'index.html'), html);
  for (const [file, content] of Object.entries(files)) {
    writeFileSync(path.join(directory, file), content);
    if (!omit.includes(file)) manifest.files[file] = sha256(content);
  }
  writeFileSync(path.join(directory, 'manifest.json'), JSON.stringify(manifest));
}

test('lists the local stylesheets and scripts the page links, not icons, remote or absolute URLs', () => {
  assert.deepEqual(linkedLocalAssets(page), ['styles.css', 'playground.css', 'playground.js']);
  assert.deepEqual(linkedLocalAssets('<link rel=stylesheet href=a.css><script src=b.js></script>'), []);
});

test('cache-busts every linked local asset and leaves the others alone', () => {
  const html = versionLinkedAssets(page, 'abc123');
  assert.deepEqual(linkedLocalAssets(html), ['styles.css', 'playground.css', 'playground.js']);
  for (const file of ['styles.css', 'playground.css', 'playground.js']) assert.match(html, new RegExp(`${file}\\?v=abc123`));
  assert.match(html, /href="favicon\.ico"/);
  assert.match(html, /href="https:\/\/fonts\.example\/x\.css"/);
  assert.match(html, /src="\/abs\.js"/);
});

test('a linked asset comes from the editor package export, or the build fails', () => withDirectory(async directory => {
  mkdirSync(path.join(directory, 'dist'));
  writeFileSync(path.join(directory, 'package.json'), JSON.stringify({ name: '@openpresentation/opf-editor', exports: { './styles.css': { style: './dist/styles.css', default: './dist/styles.css' }, './escape.css': '../x.css' } }));
  const staged = ['playground.js', 'playground.css'];
  assert.deepEqual(await packageAssetSources({ linked: ['styles.css', 'playground.css'], staged, editorDirectory: directory }), [{ file: 'styles.css', from: path.join(directory, 'dist/styles.css') }]);
  await assert.rejects(packageAssetSources({ linked: ['new-asset.css'], staged, editorDirectory: directory }), /new-asset\.css/);
  await assert.rejects(packageAssetSources({ linked: ['escape.css'], staged, editorDirectory: directory }), /outside the package/);
}));

test('verification passes when every linked file is in the manifest and on disk', () => withDirectory(async directory => {
  stage(directory, page, { 'styles.css': 'a', 'playground.css': 'b', 'playground.js': 'c' });
  await verifyLinkedAssets(directory);
}));

test('verification fails when a linked stylesheet or script is missing from the manifest', () => withDirectory(async directory => {
  stage(directory, page, { 'styles.css': 'a', 'playground.css': 'b', 'playground.js': 'c' }, ['styles.css']);
  await assert.rejects(verifyLinkedAssets(directory), /styles\.css is linked by index\.html but missing from manifest\.json/);
}));

test('verification fails when a manifest file is absent from the output or changed', () => withDirectory(async directory => {
  stage(directory, page, { 'styles.css': 'a', 'playground.css': 'b', 'playground.js': 'c' });
  rmSync(path.join(directory, 'playground.js'));
  writeFileSync(path.join(directory, 'playground.css'), 'changed');
  await assert.rejects(verifyLinkedAssets(directory), /playground\.css differs[\s\S]*playground\.js is linked by index\.html but missing from/);
}));
