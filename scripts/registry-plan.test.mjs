// MR-34: scripts/registry-plan.mjs on a fake registry and a fixture repository. Nothing here touches npm or the network.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { SET, mapCommit, registryPlan, resolveRef, treePath } from './registry-plan.mjs';

const sha = (digit) => digit.repeat(40);

/** Versions and gitHeads of a published set; `heads` overrides single gitHeads. */
const registry = (versions = {}, heads = {}) => (spec) => {
  const at = spec.lastIndexOf('@');
  const entry = SET.find((item) => item.name === spec.slice(0, at));
  assert.ok(entry, spec);
  return { version: versions[entry.name] ?? '0.25.0', gitHead: heads[entry.key] ?? sha('a') };
};

test('the set has the old plan shape: five packages, the gallery apart, a release commit and an example ref per repository', () => {
  const plan = registryPlan({ view: registry({ '@openpresentation/gallery': '5.0.0', '@openpresentation/opf-editor': '0.25.3' }), resolve: (_key, head) => head });
  assert.equal(plan.tag, 'latest');
  assert.deepEqual(plan.packages.map((item) => item.name), ['@openpresentation/opf', '@openpresentation/opf-render', '@openpresentation/opf-editor', '@openpresentation/opf-pptx', '@openpresentation/cli']);
  assert.deepEqual(plan.packages.find((item) => item.name.endsWith('opf-editor')), { name: '@openpresentation/opf-editor', version: '0.25.3' });
  assert.deepEqual(plan.independentPackages, [{ name: '@openpresentation/gallery', version: '5.0.0' }]);
  assert.deepEqual(Object.keys(plan.verificationRefs), ['opf', 'opf-render', 'opf-editor', 'opf-pptx', 'cli', 'gallery']);
  assert.equal(plan.exampleRefs['opf-editor'], plan.verificationRefs['opf-editor']);
});

test('the tag, an override and an unknown override', () => {
  const seen = [];
  const view = (spec) => {
    seen.push(spec);
    return { version: '0.26.0', gitHead: sha('b') };
  };
  registryPlan({ tag: 'next', overrides: '@openpresentation/opf-pptx@0.26.1, @openpresentation/cli@0.26.2', view, resolve: (_key, head) => head });
  assert.ok(seen.includes('@openpresentation/opf@next'));
  assert.ok(seen.includes('@openpresentation/opf-pptx@0.26.1'));
  assert.ok(seen.includes('@openpresentation/cli@0.26.2'));
  assert.throws(() => registryPlan({ overrides: '@openpresentation/other@1.0.0', view }), /not one of/);
  assert.throws(() => registryPlan({ view: () => ({ version: '0.26.0-rc.0', gitHead: sha('b') }), resolve: (_key, head) => head }), /not an exact release version/);
});

test('a commit map translates a commit of an archived repository into its import; a commit this repository has stays', () => {
  const map = `old                                      new\n${sha('1')} ${sha('2')}\n${sha('3')} ${sha('4')}\n`;
  assert.equal(mapCommit(sha('3'), map), sha('4'));
  assert.equal(mapCommit(sha('9'), map), undefined);
  const present = new Set([sha('2'), sha('7')]);
  const options = { exists: (commit) => present.has(commit), readMap: () => map };
  assert.equal(resolveRef('opf-render', sha('1'), options), sha('2'), 'mapped');
  assert.equal(resolveRef('opf', sha('7'), options), sha('7'), 'already in this history');
  assert.throws(() => resolveRef('opf-render', sha('9'), options), /commit-map\/opf-render\.txt/);
  assert.throws(() => resolveRef('opf-render', sha('3'), options), /not in this checkout/, 'mapped, but the import is missing here (a shallow clone)');
  assert.throws(() => resolveRef('opf-render', 'abc1234', options), /not a full commit SHA/);
  assert.throws(() => resolveRef('opf', sha('9'), { exists: () => false, readMap: () => { throw new Error('no map'); } }), /not in this checkout/);
});

test('treePath: core and the CLI are root-relative, the archived repositories\' files move under packages/<directory>', () => {
  assert.equal(treePath('opf', 'packages/javascript/test/x.mjs'), 'packages/javascript/test/x.mjs');
  assert.equal(treePath('cli', 'packages/cli/package.json'), 'packages/cli/package.json');
  assert.equal(treePath('opf-render', 'test/x.mjs'), 'packages/render/test/x.mjs');
  assert.equal(treePath('opf-pptx', './test/y.mjs'), 'packages/pptx/test/y.mjs');
  assert.equal(treePath('opf-editor', 'dist/index.js'), 'packages/editor/dist/index.js');
  assert.equal(treePath('gallery', 'catalog/index.json'), 'packages/gallery/catalog/index.json');
  assert.throws(() => treePath('unknown', 'x'), /unknown repository key/);
});

test('every package of the set is a directory of this repository', () => {
  const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
  for (const entry of SET) {
    assert.ok(execFileSync('git', ['ls-files', `${entry.directory}/package.json`], { cwd: root, encoding: 'utf8' }).trim(), entry.directory);
  }
});

test('a real fixture history: a commit is found by git, a missing one is reported with the fix', () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'registry-plan-'));
  try {
    const git = (...args) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.com', '-c', 'commit.gpgsign=false', ...args], { cwd: directory, encoding: 'utf8' }).trim();
    git('init', '-q');
    mkdirSync(path.join(directory, 'docs/programs/monorepo/commit-map'), { recursive: true });
    writeFileSync(path.join(directory, 'a.txt'), 'a');
    git('add', '-A');
    git('commit', '-q', '-m', 'one');
    const head = git('rev-parse', 'HEAD');
    writeFileSync(path.join(directory, 'docs/programs/monorepo/commit-map/opf-render.txt'), `old new\n${sha('c')} ${head}\n`);
    assert.equal(resolveRef('opf', head, { cwd: directory }), head);
    assert.equal(resolveRef('opf-render', sha('c'), { cwd: directory }), head);
    assert.throws(() => resolveRef('opf-pptx', sha('d'), { cwd: directory }), /git fetch --unshallow/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
