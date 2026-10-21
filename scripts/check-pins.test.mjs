// MR-10: check:pins keeps exact pins consistent across the manifests.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { checkPins } from './check-pins.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = (dir, fields) => ({ dir, manifest: { name: dir, ...fields } });

test('manifests that agree on every exact pin, with peers mirrored by devDependencies, pass', () => {
  const peers = { sharp: '0.35.5', '@expo-google-fonts/arimo': '0.4.3' };
  assert.deepEqual(
    checkPins([
      manifest('packages/render', { devDependencies: peers, peerDependencies: peers }),
      manifest('packages/editor', { devDependencies: { '@expo-google-fonts/arimo': '0.4.3', typescript: '^5.9.0' } }),
      manifest('packages/cli', { devDependencies: { typescript: '~5.9.3' }, dependencies: { '@openpresentation/opf': '^0.26.0' } }),
    ]),
    [],
  );
});

test('two exact versions of one package fail and name both places', () => {
  const problems = checkPins([manifest('packages/render', { devDependencies: { playwright: '1.64.0' } }), manifest('packages/editor', { devDependencies: { playwright: '1.64.1' } })]);
  assert.deepEqual(problems, ['playwright is pinned to different exact versions: 1.64.0 (packages/render devDependencies); 1.64.1 (packages/editor devDependencies)']);
});

test('an exact peer pin must equal, and have, its own devDependency pin', () => {
  assert.deepEqual(checkPins([manifest('packages/render', { peerDependencies: { sharp: '0.35.5' }, devDependencies: { sharp: '0.35.4' } })]), ['packages/render: peer sharp is pinned 0.35.5 but its devDependency is 0.35.4']);
  assert.deepEqual(checkPins([manifest('packages/render', { peerDependencies: { 'pdf-lib': '1.17.1' } })]), ['packages/render: peer pdf-lib 1.17.1 has no devDependency pin, so nothing tests it']);
});

test('ranges, catalog and workspace specifiers are not pins, and workspace package names are skipped', () => {
  assert.deepEqual(
    checkPins([
      manifest('packages/a', { devDependencies: { esbuild: 'catalog:', yaml: '^2.9.0', '@openpresentation/opf-render': '0.25.0' }, peerDependencies: { '@openpresentation/opf-render': '^0.25.0' } }),
      manifest('packages/b', { devDependencies: { esbuild: '0.28.2', yaml: '^2.8.0', '@openpresentation/opf-render': '0.25.1' } }),
    ]),
    [],
  );
});

test('this repository passes check:pins', () => {
  const result = spawnSync(process.execPath, [path.join(root, 'scripts/check-pins.mjs'), root], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
});
