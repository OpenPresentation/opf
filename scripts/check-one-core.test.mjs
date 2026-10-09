// RR-62: assertSingleCore fails loudly, with both paths and versions, when a tree holds or resolves a second core.
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';
import { assertSingleCore } from './check-one-core.mjs';

const temp = await mkdtemp(path.join(tmpdir(), 'opf-one-core-'));
after(() => rm(temp, { recursive: true, force: true }));

async function fakePackage(directory, name, version) {
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, 'package.json'), JSON.stringify({ name, version, exports: { './package.json': './package.json' } }));
}

test('one linked core passes; a nested second core fails and names both copies with their versions', async () => {
  const core = path.join(temp, 'workspace', 'core');
  await fakePackage(core, '@openpresentation/opf', '0.17.0');
  const sibling = path.join(temp, 'opf-render');
  await fakePackage(sibling, '@openpresentation/opf-render', '0.16.0');
  await mkdir(path.join(sibling, 'node_modules', '@openpresentation'), { recursive: true });
  await symlink(core, path.join(sibling, 'node_modules', '@openpresentation', 'opf'), 'junction');
  await assertSingleCore({ expected: core, roots: [sibling], resolvers: [path.join(sibling, 'package.json')], label: 'opf-render' });

  // A dependency of the sibling that brought its own published core.
  await fakePackage(path.join(sibling, 'node_modules', 'some-dependency'), 'some-dependency', '1.0.0');
  await fakePackage(path.join(sibling, 'node_modules', 'some-dependency', 'node_modules', '@openpresentation', 'opf'), '@openpresentation/opf', '0.16.0');
  await assert.rejects(
    assertSingleCore({ expected: core, roots: [sibling], resolvers: [path.join(sibling, 'package.json')], label: 'opf-render' }),
    (error) => /opf-render: one core expected at .*core \(0\.17\.0\)/.test(error.message) && /holds another @openpresentation\/opf at .*some-dependency.*\(0\.16\.0\)/.test(error.message),
  );
});

test('a sibling that resolves a different core fails with the resolved path and version', async () => {
  const core = path.join(temp, 'workspace2', 'core');
  await fakePackage(core, '@openpresentation/opf', '0.17.0');
  const sibling = path.join(temp, 'opf-pptx');
  await fakePackage(sibling, '@openpresentation/opf-pptx', '0.16.1');
  await fakePackage(path.join(sibling, 'node_modules', '@openpresentation', 'opf'), '@openpresentation/opf', '0.16.0');
  await assert.rejects(
    assertSingleCore({ expected: core, resolvers: [path.join(sibling, 'package.json')], label: 'opf-pptx' }),
    (error) => /resolves @openpresentation\/opf at .*opf-pptx.*\(0\.16\.0\)/.test(error.message),
  );
});
