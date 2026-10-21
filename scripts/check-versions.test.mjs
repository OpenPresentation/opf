// MR-10: check:versions compares the workspace members among the six published packages.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { checkVersions } from './check-versions.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = (dir, name, version, extra = {}) => ({ dir: `packages/${dir}`, manifest: { name, version, ...extra } });

test('all members at one version pass; so does a workspace with fewer than six packages', () => {
  assert.deepEqual(checkVersions([pkg('javascript', '@openpresentation/opf', '0.26.0'), pkg('cli', '@openpresentation/cli', '0.26.0')]), []);
  assert.deepEqual(checkVersions([]), []);
});

test('a differing version fails and names every package', () => {
  const problems = checkVersions([pkg('javascript', '@openpresentation/opf', '0.26.0'), pkg('render', '@openpresentation/opf-render', '0.25.3'), pkg('cli', '@openpresentation/cli', '0.26.0')]);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /one version, found 0\.25\.3, 0\.26\.0: packages\/javascript 0\.26\.0, packages\/render 0\.25\.3, packages\/cli 0\.26\.0/);
});

test('the gallery must match once it is a member (D16: it goes from 5.0.0 to the shared line)', () => {
  assert.equal(checkVersions([pkg('javascript', '@openpresentation/opf', '0.26.0'), pkg('gallery', '@openpresentation/gallery', '5.0.0')]).length, 1);
  assert.deepEqual(checkVersions([pkg('javascript', '@openpresentation/opf', '0.26.0'), pkg('gallery', '@openpresentation/gallery', '0.26.0')]), []);
});

test('an imported gallery that is not a workspace member is inert, and private packages are not part of the set', () => {
  // Not a member means it is absent from the list checkVersions receives (loadWorkspace reads pnpm-workspace.yaml only).
  assert.deepEqual(checkVersions([pkg('javascript', '@openpresentation/opf', '0.26.0'), pkg('integration', '@openpresentation/integration', '0.0.0', { private: true })]), []);
});

test('a version that is not semver fails', () => {
  assert.match(checkVersions([pkg('cli', '@openpresentation/cli', 'latest')])[0], /not a semver version/);
});

test('this repository passes check:versions', () => {
  const result = spawnSync(process.execPath, [path.join(root, 'scripts/check-versions.mjs'), root], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
});
