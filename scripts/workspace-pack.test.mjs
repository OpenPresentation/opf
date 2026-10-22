// MR-23e: the shared packer. Core is the package that used to fail (`ERR_PNPM_CANNOT_RESOLVE_WORKSPACE_PROTOCOL`: its optional
// peers on render and pptx were `workspace:^` and not installed), so it is packed for real, without a fallback.
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { assertLockstep, assertNoWorkspaceSpecs, PACKAGE_DIRECTORIES, packWorkspacePackage, REPOSITORY_ROOT } from './workspace-pack.mjs';

const version = (name) => JSON.parse(readFileSync(path.join(REPOSITORY_ROOT, PACKAGE_DIRECTORIES[name], 'package.json'), 'utf8')).version;

test('core packs with pnpm pack: no workspace: spec, the gallery floor is the release, the optional peers are the concrete ranges', () => {
  const destination = mkdtempSync(path.join(tmpdir(), 'opf-workspace-pack-'));
  try {
    const core = packWorkspacePackage('@openpresentation/opf', destination);
    assert.equal(core.version, version('@openpresentation/opf'));
    assert.equal(core.manifest.dependencies['@openpresentation/gallery'], `^${version('@openpresentation/gallery')}`);
    for (const peer of ['@openpresentation/opf-render', '@openpresentation/opf-pptx']) {
      assert.equal(core.manifest.peerDependencies[peer], `^${version(peer)}`);
      assert.equal(core.manifest.peerDependenciesMeta[peer].optional, true);
    }
    assert.ok(core.files.some((file) => file.path === 'package.json'));
    assert.match(core.integrity, /^sha512-/);
    assertLockstep({ name: 'consumer', manifest: { dependencies: { '@openpresentation/opf': `^${core.version}` } } }, core);
  } finally {
    rmSync(destination, { recursive: true, force: true });
  }
});

test('a packed manifest with a workspace: or catalog: spec, or a sibling range that is not the packed version, fails', () => {
  assert.throws(() => assertNoWorkspaceSpecs({ name: 'x', peerDependencies: { y: 'workspace:^' } }), /peerDependencies y is still workspace:\^/);
  assert.throws(() => assertNoWorkspaceSpecs({ name: 'x', devDependencies: { y: 'catalog:' } }), /devDependencies y is still catalog:/);
  assertNoWorkspaceSpecs({ name: 'x', dependencies: { y: '^0.26.0' } });
  assert.throws(() => assertLockstep({ name: 'a', manifest: { dependencies: { b: '^0.25.0' } } }, { name: 'b', version: '0.26.0' }), /a packs b@\^0\.25\.0; the workspace packs 0\.26\.0/);
  assert.throws(() => packWorkspacePackage('@openpresentation/nope', tmpdir()), /unknown workspace package/);
});
