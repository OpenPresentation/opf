// MR-13: changes/config.json names the seven packages of the monorepo (docs/programs/monorepo/README.md sections 1 and 5):
// one fragment directory, one changelog per package, `check:changes` rejects a name that is not one of them.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { SCRIPT, loadConfig, missingChangelogs, needsFragment, parseFragment, readFragments } from './changelog-fragments.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const config = loadConfig(root);
// The package names a fragment uses, the changelog each writes to, and the source directory that package's code lives in.
const PACKAGES = {
  opf: { changelog: 'CHANGELOG.md', dir: 'packages/javascript' },
  cli: { changelog: 'packages/cli/CHANGELOG.md', dir: 'packages/cli' },
  render: { changelog: 'packages/render/CHANGELOG.md', dir: 'packages/render' },
  pptx: { changelog: 'packages/pptx/CHANGELOG.md', dir: 'packages/pptx' },
  editor: { changelog: 'packages/editor/CHANGELOG.md', dir: 'packages/editor' },
  gallery: { changelog: 'packages/gallery/CHANGELOG.md', dir: 'packages/gallery' },
  mcp: { changelog: 'packages/mcp/CHANGELOG.md', dir: 'packages/mcp' },
};
const fragment = (packages, type = 'fixed') => `---\ntype: ${type}\n${packages === undefined ? '' : `packages: ${packages}\n`}---\nMR-13: an entry.\n`;

test('the config names the seven packages, the root changelog for core and packages/<x>/CHANGELOG.md for the others', () => {
  assert.equal(config.default, 'opf');
  assert.deepEqual(Object.keys(config.targets).sort(), Object.keys(PACKAGES).sort());
  for (const [name, { changelog }] of Object.entries(PACKAGES)) assert.equal(config.targets[name], changelog, name);
});

test('every package has code paths, and each stays inside its own directory', () => {
  for (const [name, { dir }] of Object.entries(PACKAGES)) {
    assert.ok(config.codePaths.some((prefix) => prefix.startsWith(`${dir}/`)), `${name} has a code path under ${dir}/`);
  }
  for (const prefix of config.codePaths) assert.ok(prefix.endsWith('/'), `${prefix} is a directory prefix`);
  // Tests, docs and evidence are not code paths: a change to them needs no fragment.
  for (const prefix of config.codePaths) assert.doesNotMatch(prefix, /\/(test|docs|scripts)\//);
});

test('a fragment may name any of the seven packages, several at once, or none; any other name fails', () => {
  for (const name of Object.keys(PACKAGES)) assert.deepEqual(parseFragment('a.md', fragment(`[${name}]`), config).packages, [name]);
  assert.deepEqual(parseFragment('a.md', fragment('[opf, cli, render, pptx, editor, gallery, mcp]'), config).packages, Object.keys(PACKAGES));
  assert.deepEqual(parseFragment('a.md', fragment('[]'), config).packages, []);
  assert.deepEqual(parseFragment('a.md', fragment(undefined), config).packages, []);
  for (const unknown of ['core', 'javascript', 'opf-render', 'opf-pptx', 'opf-editor', '@openpresentation/gallery', 'Render', 'integration', 'sites']) {
    assert.throws(() => parseFragment('a.md', fragment(`[${unknown}]`), config), new RegExp(`unknown package "${unknown.replace(/[/@]/g, '\\$&')}"`), unknown);
  }
  assert.throws(() => parseFragment('a.md', fragment('[render, render]'), config), /duplicate package/);
  assert.throws(() => parseFragment('a.md', fragment('[render, nope]'), config), /unknown package "nope"/);
});

test('the fragments in changes/ today are valid under the seven-package config (none is valid: changes/ is empty right after a release)', () => {
  const fragments = readFragments(root, config);
  assert.deepEqual(missingChangelogs(root, fragments, config), []);
});

test('code in any of the seven packages asks for a fragment; tests, docs and evidence do not', () => {
  const code = ['packages/javascript/src/a.ts', 'packages/cli/src/a.ts', 'packages/render/src/a.js', 'packages/render/fonts/x/X.ttf', 'packages/pptx/src/a.js', 'packages/pptx/vendor/pptxgenjs/a.js', 'packages/editor/src/a.js', 'packages/gallery/catalog/layouts/hero.json', 'packages/gallery/previews/layouts/hero.svg', 'packages/gallery/src/index.d.ts', 'packages/mcp/src/server.ts', 'spec/schemas/opf.schema.json'];
  for (const file of code) assert.equal(needsFragment([file], config), true, file);
  for (const file of ['packages/render/test/a.mjs', 'packages/pptx/docs/evidence/a.png', 'packages/editor/README.md', 'packages/gallery/scripts/build.mjs', 'packages/gallery/test/a.test.mjs', 'docs/a.md', 'scripts/a.mjs']) {
    assert.equal(needsFragment([file], config), false, file);
  }
  assert.equal(needsFragment(['packages/render/src/a.js', 'changes/mr-13-render.md'], config), false, 'a fragment answers it');
  assert.equal(needsFragment(['packages/render/src/a.js', 'packages/render/CHANGELOG.md'], config), false, 'so does a changelog edit');
});

function temporaryRepo(t, files) {
  const dir = mkdtempSync(path.join(tmpdir(), 'opf-changes-config-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  mkdirSync(path.join(dir, 'changes'));
  writeFileSync(path.join(dir, 'changes', 'config.json'), JSON.stringify(config));
  for (const [name, text] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
    writeFileSync(path.join(dir, name), text);
  }
  return dir;
}

const check = (dir) => spawnSync(process.execPath, [SCRIPT, 'check'], { cwd: dir, encoding: 'utf8' });

test('check:changes fails on an unknown package name, and on a package whose changelog is not in the repository', (t) => {
  const unknown = temporaryRepo(t, { 'CHANGELOG.md': '# Changelog\n\n## Unreleased\n', 'changes/a.md': fragment('[renderer]') });
  const unknownRun = check(unknown);
  assert.equal(unknownRun.status, 1);
  assert.match(unknownRun.stderr, /changes\/a\.md: unknown package "renderer" \(known: opf, cli, render, pptx, editor, gallery, mcp\)/);

  // Before the import the render package has no changelog: the fragment would fail the release-prep assemble, so it fails here.
  const early = temporaryRepo(t, { 'CHANGELOG.md': '# Changelog\n\n## Unreleased\n', 'changes/a.md': fragment('[opf, render]') });
  const earlyRun = check(early);
  assert.equal(earlyRun.status, 1);
  assert.match(earlyRun.stderr, /changes\/a\.md: package "render" has no changelog at packages\/render\/CHANGELOG\.md/);

  const imported = temporaryRepo(t, { 'CHANGELOG.md': '# Changelog\n\n## Unreleased\n', 'packages/render/CHANGELOG.md': '# Changelog\n\n## Unreleased\n', 'changes/a.md': fragment('[opf, render]'), 'changes/b.md': fragment(undefined, 'added') });
  const importedRun = check(imported);
  assert.equal(importedRun.status, 0, importedRun.stderr);
  assert.match(importedRun.stdout, /2 fragment\(s\) valid/);
});

test('check:changes passes with no fragment at all (changes/ is empty right after a release)', (t) => {
  const empty = temporaryRepo(t, { 'CHANGELOG.md': '# Changelog\n\n## Unreleased\n' });
  const run = check(empty);
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /0 fragment\(s\) valid/);
});
