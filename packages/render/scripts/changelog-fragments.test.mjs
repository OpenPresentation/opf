import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { SCRIPT, assemble, assembleChangelog, needsFragment, parseFragment, withoutPackage } from './changelog-fragments.mjs';

const single = { default: '', targets: { '': 'CHANGELOG.md' }, codePaths: ['src/'] };
const mono = { default: 'opf', targets: { opf: 'CHANGELOG.md', cli: 'packages/cli/CHANGELOG.md' }, codePaths: ['packages/javascript/src/'] };
const fragment = (type, body, packages) => `---\ntype: ${type}\n${packages ? `packages: ${packages}\n` : ''}---\n${body}\n`;

const CHANGELOG = `# Changelog

## Unreleased

## 0.12.2 (2026-10-02)

Patch release: something.

- RR-17 (output-changing): the old entry.

## 0.12.0

- Release 0.12.0.
`;

function repo(config, files, changelogs = { 'CHANGELOG.md': CHANGELOG }) {
  const root = mkdtempSync(path.join(tmpdir(), 'opf-changes-'));
  mkdirSync(path.join(root, 'changes'));
  if (config) writeFileSync(path.join(root, 'changes', 'config.json'), JSON.stringify(config));
  for (const [name, text] of Object.entries(files)) writeFileSync(path.join(root, 'changes', name), text);
  for (const [name, text] of Object.entries(changelogs)) {
    mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
    writeFileSync(path.join(root, name), text);
  }
  return root;
}

test('parseFragment reads type, packages and the entry text', () => {
  const parsed = parseFragment('a.md', fragment('fixed', 'RR-1 (x): text.', '[opf, cli]'), mono);
  assert.deepEqual(parsed, { slug: 'a', type: 'fixed', packages: ['opf', 'cli'], body: 'RR-1 (x): text.' });
});

test('parseFragment rejects what would silently corrupt the changelog', () => {
  assert.throws(() => parseFragment('a.md', 'no front matter', single), /missing front matter/);
  assert.throws(() => parseFragment('a.md', fragment('feature', 'x'), single), /type must be one of/);
  assert.throws(() => parseFragment('a.md', '---\ntype: fixed\ntitle: x\n---\nbody\n', single), /unknown front matter/);
  assert.throws(() => parseFragment('a.md', fragment('fixed', '   '), single), /empty entry/);
  assert.throws(() => parseFragment('a.md', fragment('fixed', '- starts as a bullet'), single), /leading "- "/);
  assert.throws(() => parseFragment('a.md', fragment('fixed', 'x', '[opf]'), single), /one changelog/);
  assert.throws(() => parseFragment('a.md', fragment('fixed', 'x', '[nope]'), mono), /unknown package "nope"/);
});

test('assembleChangelog adds a dated section under an empty Unreleased and keeps the older sections byte for byte', () => {
  const { text } = assembleChangelog(CHANGELOG, {
    version: '0.12.3',
    date: '2026-10-05',
    summary: 'Patch release: two fixes.',
    entries: [{ body: 'First entry.' }, { body: 'Second entry.' }],
  });
  assert.equal(
    text,
    `# Changelog

## Unreleased

## 0.12.3 (2026-10-05)

Patch release: two fixes.

- First entry.
- Second entry.

${CHANGELOG.slice(CHANGELOG.indexOf('## 0.12.2'))}`,
  );
});

test('assembleChangelog follows a loose list and folds leftover Unreleased bullets in first', () => {
  const loose = `# Changelog\n\n## Unreleased\n\n- Hand-written.\n\n## 0.1.0\n\n- A.\n\n- B.\n`;
  const { text, leftover } = assembleChangelog(loose, { version: '0.2.0', date: '', entries: [{ body: 'Fragment.' }] });
  assert.equal(leftover, 1);
  assert.equal(text, `# Changelog\n\n## Unreleased\n\n## 0.2.0\n\n- Hand-written.\n\n- Fragment.\n\n## 0.1.0\n\n- A.\n\n- B.\n`);
});

test('assembleChangelog keeps a multi-line entry together and refuses a duplicate or empty release', () => {
  const { text } = assembleChangelog(CHANGELOG, { version: '0.13.0', date: '', entries: [{ body: 'Top line.\n    - nested' }] });
  assert.match(text, /## 0\.13\.0\n\n- Top line\.\n {4}- nested\n\n## 0\.12\.2/);
  assert.throws(() => assembleChangelog(CHANGELOG, { version: '0.12.2', date: '', entries: [{ body: 'x' }] }), /already has a section/);
  assert.throws(() => assembleChangelog(CHANGELOG, { version: '0.13.0', date: '', entries: [] }), /nothing to assemble/);
  assert.throws(() => assembleChangelog(CHANGELOG, { version: 'v1', date: '', entries: [{ body: 'x' }] }), /semantic version/);
});

test('assembleChangelog adds the Unreleased heading when a changelog lacks one', () => {
  const { text } = assembleChangelog('# Changelog\n\n## 0.1.0\n\n- A.\n', { version: '0.2.0', date: '', entries: [{ body: 'B.' }] });
  assert.equal(text, '# Changelog\n\n## Unreleased\n\n## 0.2.0\n\n- B.\n\n## 0.1.0\n\n- A.\n');
});

test('assemble groups by type (added, changed, fixed) then slug, and deletes the fragments it used', () => {
  const root = repo(null, {
    'b-fixed.md': fragment('fixed', 'Fixed one.'),
    'a-fixed.md': fragment('fixed', 'Fixed two.'),
    'c-added.md': fragment('added', 'Added one.'),
    'd-changed.md': fragment('changed', 'Changed one.'),
    'README.md': 'not a fragment',
  });
  try {
    const result = assemble(root, { version: '1.0.0', date: '2026-01-02', summary: '' });
    assert.equal(result.fragments, 4);
    const text = readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8');
    assert.match(text, /## 1\.0\.0 \(2026-01-02\)\n\n- Added one\.\n- Changed one\.\n- Fixed two\.\n- Fixed one\.\n\n## 0\.12\.2/);
    assert.equal(existsSync(path.join(root, 'changes', 'a-fixed.md')), false);
    assert.equal(existsSync(path.join(root, 'changes', 'README.md')), true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('assemble in a monorepo splits fragments by package and keeps a shared one until both changelogs have it', () => {
  const root = repo(
    mono,
    {
      'core.md': fragment('added', 'Core only.', '[opf]'),
      'cli.md': fragment('added', 'CLI only.', '[cli]'),
      'both.md': fragment('fixed', 'Both.', '[opf, cli]'),
      'tooling.md': fragment('changed', 'No package change.', '[]'),
    },
    { 'CHANGELOG.md': CHANGELOG, 'packages/cli/CHANGELOG.md': '# Changelog\n\n## Unreleased\n\n## 0.10.0\n\n- Old.\n' },
  );
  try {
    assemble(root, { version: '0.13.0', date: '', summary: '' });
    const core = readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8');
    assert.match(core, /## 0\.13\.0\n\n- Core only\.\n- No package change\.\n- Both\.\n\n## 0\.12\.2/);
    assert.equal(existsSync(path.join(root, 'changes', 'core.md')), false);
    assert.equal(existsSync(path.join(root, 'changes', 'tooling.md')), false);
    assert.match(readFileSync(path.join(root, 'changes', 'both.md'), 'utf8'), /packages: \[cli\]/);
    assert.equal(existsSync(path.join(root, 'changes', 'cli.md')), true);

    assemble(root, { version: '0.11.0', date: '', summary: '', package: 'cli' });
    const cli = readFileSync(path.join(root, 'packages/cli/CHANGELOG.md'), 'utf8');
    assert.match(cli, /## 0\.11\.0\n\n- CLI only\.\n- Both\.\n\n## 0\.10\.0/);
    assert.equal(existsSync(path.join(root, 'changes', 'both.md')), false);
    assert.equal(existsSync(path.join(root, 'changes', 'cli.md')), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('withoutPackage drops one package and reports when none remain', () => {
  assert.equal(withoutPackage(fragment('fixed', 'x', '[opf, cli]'), 'opf'), fragment('fixed', 'x', '[cli]'));
  assert.equal(withoutPackage(fragment('fixed', 'x', '[opf]'), 'opf'), null);
});

test('needsFragment warns only for package code without a fragment or a hand edit of the changelog', () => {
  assert.equal(needsFragment(['src/a.js'], single), true);
  assert.equal(needsFragment(['src/a.js', 'changes/fix-a.md'], single), false);
  assert.equal(needsFragment(['src/a.js', 'CHANGELOG.md'], single), false);
  assert.equal(needsFragment(['docs/a.md', 'test/a.mjs'], single), false);
  assert.equal(needsFragment(['src/a.js', 'changes/README.md'], single), true);
  assert.equal(needsFragment(['packages/javascript/src/a.ts'], mono), true);
  assert.equal(needsFragment(['packages/cli/src/a.ts'], mono), false);
});

test('the command line validates fragments, assembles with --dry-run untouched, and fails on a bad fragment', () => {
  const root = repo(null, { 'one.md': fragment('added', 'One.') });
  try {
    const run = (...a) => spawnSync(process.execPath, [SCRIPT, ...a], { cwd: root, encoding: 'utf8' });
    assert.equal(run('check').status, 0);
    const dry = run('assemble', '--version', '2.0.0', '--date', '2026-02-03', '--dry-run');
    assert.equal(dry.status, 0, dry.stderr);
    assert.match(dry.stdout, /## 2\.0\.0 \(2026-02-03\)/);
    assert.equal(readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8'), CHANGELOG);
    assert.equal(existsSync(path.join(root, 'changes', 'one.md')), true);
    writeFileSync(path.join(root, 'changes', 'bad.md'), 'no front matter');
    const bad = run('check');
    assert.equal(bad.status, 1);
    assert.match(bad.stderr, /changes\/bad\.md: missing front matter/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
