import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { SCRIPT, assemble, assembleChangelog, missingNative, nativeSlides, needsFragment, parseFragment, touchesExport, unknownNativeDecks, readFragments, withoutPackage } from './changelog-fragments.mjs';

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
  assert.deepEqual(parsed, { slug: 'a', type: 'fixed', packages: ['opf', 'cli'], drawing: [], native: null, nativeReason: '', body: 'RR-1 (x): text.' });
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
  // MR-40: a package with no change still gets its section when the release passes a summary.
  const unchanged = assembleChangelog(CHANGELOG, { version: '0.13.0', date: '2026-10-23', summary: 'No package changes; released with the set.', entries: [] }).text;
  assert.match(unchanged, /## 0\.13\.0 \(2026-10-23\)\n\nNo package changes; released with the set\.\n\n## /);
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

test('--dir selects the directory whose changes/ and changelog are used, whatever the current directory', () => {
  const root = repo(null, { 'one.md': fragment('added', 'One.') });
  const elsewhere = mkdtempSync(path.join(tmpdir(), 'changes-cwd-'));
  try {
    const run = (...a) => spawnSync(process.execPath, [SCRIPT, ...a, '--dir', root], { cwd: elsewhere, encoding: 'utf8' });
    assert.match(run('check').stdout, /1 fragment\(s\) valid/);
    const done = run('assemble', '--version', '2.0.0', '--date', '2026-02-03');
    assert.equal(done.status, 0, done.stderr);
    assert.match(readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8'), /## 2\.0\.0 \(2026-02-03\)/);
    assert.equal(existsSync(path.join(root, 'changes', 'one.md')), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(elsewhere, { recursive: true, force: true });
  }
});

// MR-35: the `drawing` field of a gallery fragment declares the existing records that draw differently or are gone.
const galleryConfig = { default: 'opf', targets: { opf: 'CHANGELOG.md', gallery: 'packages/gallery/CHANGELOG.md' }, codePaths: [] };
const drawn = (front, packages = '[gallery]') => `---\ntype: changed\npackages: ${packages}\n${front}\n---\nMoved two layouts.\n`;

test('parseFragment reads a drawing list, quoted or bare', () => {
  assert.deepEqual(parseFragment('g.md', drawn('drawing: ["layouts:hero", \'themes:minimal\', colorSchemes:cool-horizon]'), galleryConfig).drawing, ['layouts:hero', 'themes:minimal', 'colorSchemes:cool-horizon']);
  assert.deepEqual(parseFragment('g.md', drawn('', '[gallery, opf]'), galleryConfig).drawing, []);
  assert.deepEqual(parseFragment('g.md', drawn('drawing: [languages:zh-Hans, chartTypes:bar]', '[opf, gallery]'), galleryConfig).drawing, ['languages:zh-Hans', 'chartTypes:bar']);
});

test('parseFragment rejects a malformed or misplaced drawing declaration', () => {
  assert.throws(() => parseFragment('g.md', drawn('drawing: layouts:hero'), galleryConfig), /drawing must be a list/);
  assert.throws(() => parseFragment('g.md', drawn('drawing: []'), galleryConfig), /drawing is empty/);
  assert.throws(() => parseFragment('g.md', drawn('drawing: ["layouts"]'), galleryConfig), /"layouts" is not <kind>:<id>/);
  assert.throws(() => parseFragment('g.md', drawn('drawing: ["layouts:"]'), galleryConfig), /is not <kind>:<id>/);
  assert.throws(() => parseFragment('g.md', drawn('drawing: ["layout:hero"]'), galleryConfig), /"layout:hero" names an unknown kind/);
  assert.throws(() => parseFragment('g.md', drawn('drawing: ["layouts:hero", "layouts:hero"]'), galleryConfig), /duplicate drawing entry/);
  assert.throws(() => parseFragment('g.md', drawn('drawing: ["layouts:hero"]', '[opf]'), galleryConfig), /drawing belongs to a gallery change/);
  assert.throws(() => parseFragment('g.md', drawn('drawing: ["layouts:hero"]', '[]'), galleryConfig), /drawing belongs to a gallery change/);
  assert.throws(() => parseFragment('g.md', drawn('drawing: ["layouts:hero"]\ndrawing: ["tones:formal"]'), galleryConfig), /duplicate key "drawing"/);
});

test('assemble lists the declared ids in the gallery bullet only, and a shared fragment loses the line once the gallery has it', () => {
  const root = repo(galleryConfig, { 'mr-99-layouts.md': drawn('drawing: ["layouts:hero", "themes:minimal"]', '[gallery, opf]') }, { 'CHANGELOG.md': CHANGELOG, 'packages/gallery/CHANGELOG.md': CHANGELOG });
  try {
    const gallery = assemble(root, { version: '0.27.0', date: '2026-10-22', package: 'gallery' });
    assert.match(gallery.text, /- Moved two layouts\.\n {2}Drawing change \(existing records that draw differently or are gone\): `layouts:hero`, `themes:minimal`\./);
    const left = readFileSync(path.join(root, 'changes', 'mr-99-layouts.md'), 'utf8');
    assert.doesNotMatch(left, /drawing:/);
    assert.deepEqual(parseFragment('mr-99-layouts.md', left, galleryConfig).packages, ['opf']);
    const core = assemble(root, { version: '0.27.0', date: '2026-10-22', package: 'opf' });
    assert.doesNotMatch(core.text, /Drawing change/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// NT-07: the `native` and `native-reason` keys.
const monoNt = { default: 'opf', targets: { opf: 'CHANGELOG.md', cli: 'packages/cli/CHANGELOG.md', pptx: 'packages/pptx/CHANGELOG.md' }, codePaths: ['packages/javascript/src/'] };
const withKeys = (keys, packages = '[pptx]', type = 'changed') => `---\ntype: ${type}\npackages: ${packages}\n${keys}\n---\nText.\n`;

test('parseFragment reads native slides, native none and the reason', () => {
  const slides = parseFragment('a.md', withKeys('native: [coverage-charts#16, technical/shapes#1]'), monoNt);
  assert.deepEqual(slides.native, [{ deck: 'coverage-charts', slide: 16 }, { deck: 'technical/shapes', slide: 1 }]);
  const none = parseFragment('a.md', withKeys('native: none\nnative-reason: Only the preview changed.'), monoNt);
  assert.deepEqual(none.native, []);
  assert.equal(none.nativeReason, 'Only the preview changed.');
  assert.equal(parseFragment('a.md', fragment('fixed', 'Text.', '[opf]'), monoNt).native, null);
});

test('parseFragment rejects malformed native values', () => {
  for (const keys of ['native: [deck]', 'native: [deck#0]', 'native: [deck#1.5]', 'native: [deck#-2]', 'native: []', 'native: deck#1', 'native: none', 'native-reason: why', 'native: [deck#1]\nnative-reason: why', 'native: [a#1, a#1]', 'native: none\nnative-reason:']) {
    assert.throws(() => parseFragment('a.md', withKeys(keys), monoNt), /native/, keys);
  }
});

test('assembling a fragment with native keys gives the same text and never prints the keys', () => {
  const plain = repo(monoNt, { 'a.md': withKeys('', '[opf]').replace('\n\n', '\n') }, { 'CHANGELOG.md': CHANGELOG });
  const keyed = repo(monoNt, { 'a.md': withKeys('native: [m-charts#1]', '[opf]') }, { 'CHANGELOG.md': CHANGELOG });
  const a = assemble(plain, { version: '0.13.0', date: '2026-10-09' }, false).text;
  const b = assemble(keyed, { version: '0.13.0', date: '2026-10-09' }, false).text;
  assert.equal(a, b);
  assert.doesNotMatch(b, /native/);
});

test('touchesExport and missingNative apply the warning rule', () => {
  const f = (type, packages, native = null) => ({ type, packages, native });
  assert.equal(touchesExport(f('changed', ['pptx'])), true);
  assert.equal(touchesExport(f('fixed', ['opf'])), true);
  assert.equal(touchesExport(f('changed', ['gallery'])), true);
  assert.equal(touchesExport(f('added', ['pptx'])), true);
  assert.equal(touchesExport(f('added', ['opf', 'gallery'])), false);
  assert.equal(touchesExport(f('fixed', ['cli', 'editor', 'mcp', 'render'])), false);
  assert.equal(touchesExport(f('fixed', [])), false);
  assert.deepEqual(missingNative([f('fixed', ['pptx']), f('fixed', ['pptx'], []), f('fixed', ['pptx'], [{ deck: 'x', slide: 1 }])]).length, 1);
});

test('unknownNativeDecks accepts manifest ids and example paths only, and nativeSlides lists them', () => {
  const root = repo(monoNt, { 'a.md': withKeys('native: [known#2, technical/shapes#1, nope#3]', '[opf]') });
  mkdirSync(path.join(root, 'scripts/native-acceptance/qualification'), { recursive: true });
  writeFileSync(path.join(root, 'scripts/native-acceptance/qualification/manifest.json'), JSON.stringify({ decks: [{ id: 'known' }] }));
  mkdirSync(path.join(root, 'examples/technical'), { recursive: true });
  writeFileSync(path.join(root, 'examples/technical/shapes.opf.json'), '{}');
  const problems = unknownNativeDecks(root, readFragments(root));
  assert.equal(problems.length, 1);
  assert.match(problems[0], /nope/);
  assert.deepEqual(nativeSlides(root).map((s) => `${s.fragment}:${s.deck}#${s.slide}`), ['a:known#2', 'a:technical/shapes#1', 'a:nope#3']);
});
