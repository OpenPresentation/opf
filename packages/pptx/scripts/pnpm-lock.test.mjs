import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { lockEvidenceSha256, lockedIntegrity, lockedPackageSet, readRepositoryLock } from './pnpm-lock.mjs';

const LOCK = `lockfileVersion: '9.0'

importers:

  .:
    devDependencies:
      left-pad:
        specifier: 1.0.0
        version: 1.0.0

  packages/pptx:
    dependencies:
      '@scope/zip':
        specifier: 4.3.0
        version: 4.3.0
      '@openpresentation/opf':
        specifier: workspace:^
        version: link:../javascript
      sharp:
        specifier: 0.35.5
        version: 0.35.5(@types/node@24.13.6)
    devDependencies:
      tool:
        specifier: 2.0.0
        version: 2.0.0

packages:

  '@scope/zip@4.3.0':
    resolution: {integrity: sha512-zip}

  '@types/node@24.13.6':
    resolution: {integrity: sha512-types}

  left-pad@1.0.0:
    resolution: {integrity: sha512-pad}

  pako@3.0.2:
    resolution: {integrity: sha512-pako}

  sharp@0.35.5:
    resolution: {integrity: sha512-sharp}
    peerDependencies:
      '@types/node': '>=22'

  tool@2.0.0:
    resolution: {integrity: sha512-tool}

snapshots:

  '@scope/zip@4.3.0':
    dependencies:
      pako: 3.0.2

  '@types/node@24.13.6': {}

  left-pad@1.0.0: {}

  pako@3.0.2: {}

  sharp@0.35.5(@types/node@24.13.6):
    optionalDependencies:
      '@types/node': 24.13.6

  tool@2.0.0: {}
`;

test('lockedIntegrity reads one registry package and refuses an unlocked one', () => {
  assert.equal(lockedIntegrity(LOCK, '@scope/zip', '4.3.0'), 'sha512-zip');
  assert.throws(() => lockedIntegrity(LOCK, '@scope/zip', '9.9.9'), /does not lock/);
});

test('lockedPackageSet is the importer closure (links and other importers excluded), sorted', () => {
  assert.deepEqual(lockedPackageSet(LOCK, 'packages/pptx'), [
    '@scope/zip@4.3.0 sha512-zip',
    '@types/node@24.13.6 sha512-types',
    'pako@3.0.2 sha512-pako',
    'sharp@0.35.5 sha512-sharp',
    'tool@2.0.0 sha512-tool',
  ]);
  assert.deepEqual(lockedPackageSet(LOCK, '.'), ['left-pad@1.0.0 sha512-pad']);
  assert.throws(() => lockedPackageSet(LOCK, 'packages/missing'), /no importer/);
});

test('the evidence hash follows the package set, not the lockfile text', () => {
  const base = lockEvidenceSha256(LOCK, 'packages/pptx');
  assert.match(base, /^[0-9a-f]{64}$/);
  assert.equal(lockEvidenceSha256(LOCK.replace('left-pad:\n        specifier: 1.0.0', 'left-pad:\n        specifier: ^1.0.0'), 'packages/pptx'), base);
  assert.equal(lockEvidenceSha256(LOCK.replace('\r\n', '\n').replaceAll('\n', '\r\n'), 'packages/pptx'), base);
  assert.notEqual(lockEvidenceSha256(LOCK.replace('sha512-pako', 'sha512-other'), 'packages/pptx'), base);
});

test('this package resolves in the repository pnpm-lock.yaml and locks the vendored jszip', () => {
  const { text, importerDir } = readRepositoryLock(fileURLToPath(new URL('..', import.meta.url)));
  assert.equal(importerDir, 'packages/pptx');
  assert.match(lockedIntegrity(text, '@node-projects/jszip', '4.3.0'), /^sha512-/);
  assert.ok(lockedPackageSet(text, importerDir).length > 50);
});
