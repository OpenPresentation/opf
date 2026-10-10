import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { escapeRegExp, extractReleaseNotes } from './release-notes.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CHANGELOG = `# Changelog

## Unreleased

## 0.18.10 (2026-10-12)

- Ten.

## 0.18.1 (2026-10-10)

- One.
    - Nested.

## 0.18.0

- Zero.

## 0.17.0 (2026-10-09)

- Seventeen.
`;

test('a dated heading, the form the assembler writes', () => {
  assert.equal(extractReleaseNotes(CHANGELOG, '0.18.1'), '- One.\n    - Nested.');
});

test('a bare heading', () => {
  assert.equal(extractReleaseNotes(CHANGELOG, '0.18.0'), '- Zero.');
});

test('a version that is a prefix of another selects its own section', () => {
  assert.equal(extractReleaseNotes(CHANGELOG, '0.18.10'), '- Ten.');
  assert.equal(extractReleaseNotes(CHANGELOG.replace('## 0.18.1 (2026-10-10)', '## 0.18.1x'), '0.18.1'), '');
  assert.equal(extractReleaseNotes('## 0.18.10 (2026-10-12)\n\n- Ten.\n', '0.18.1'), '');
});

test('a missing or empty section gives an empty string', () => {
  assert.equal(extractReleaseNotes(CHANGELOG, '9.9.9'), '');
  assert.equal(extractReleaseNotes(CHANGELOG, '0.18.2'), '');
  assert.equal(extractReleaseNotes('## 1.0.0 (2026-01-01)\n\n## 0.9.0\n- x\n', '1.0.0'), '');
});

test('the last section runs to the end of the file; CRLF is read', () => {
  assert.equal(extractReleaseNotes(CHANGELOG, '0.17.0'), '- Seventeen.');
  assert.equal(extractReleaseNotes(CHANGELOG.replace(/\n/g, '\r\n'), '0.18.1'), '- One.\n    - Nested.');
});

test('the version is regex-escaped', () => {
  assert.equal(escapeRegExp('0.18.1-rc.1+x'), '0\\.18\\.1-rc\\.1\\+x');
  assert.equal(extractReleaseNotes('## 0X18X1 (2026-01-01)\n- no\n', '0.18.1'), '');
  assert.equal(extractReleaseNotes('## 0.18.1-rc.1 (2026-01-01)\n- rc\n', '0.18.1-rc.1'), '- rc');
});

test('the real CHANGELOG has a section for its latest release', () => {
  const changelog = readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8');
  const latest = /^## (\d+\.\d+\.\d+) \(/m.exec(changelog)[1];
  assert.notEqual(extractReleaseNotes(changelog, latest), '');
});

function cli(args, cwd = root) {
  const result = spawnSync(process.execPath, [path.join(root, 'scripts', 'release-notes.mjs'), ...args], { cwd, encoding: 'utf8' });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

test('--changelog selects the file; the default is the root CHANGELOG.md whatever the working directory', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'release-notes-'));
  const file = path.join(dir, 'CHANGELOG.md');
  writeFileSync(file, '# Changelog\n\n## Unreleased\n\n## 7.7.7 (2026-01-01)\n\n- Seven.\n\n## 7.7.0\n\n- Zero.\n');
  assert.deepEqual(cli(['--version', '7.7.7', '--changelog', file]), { status: 0, stdout: '- Seven.\n', stderr: '' });
  assert.equal(cli(['--version', '7.7.0', '--changelog', file]).stdout, '- Zero.\n');
  assert.deepEqual(cli(['--version', '7.7.', '--changelog', file]), { status: 0, stdout: '', stderr: '' });

  const latest = /^## (\d+\.\d+\.\d+) \(/m.exec(readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8'))[1];
  const fromElsewhere = cli(['--version', latest], dir);
  assert.equal(fromElsewhere.status, 0);
  assert.notEqual(fromElsewhere.stdout, '');
});

test('--out writes the notes to a file; a missing section writes an empty file', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'release-notes-'));
  const out = path.join(dir, 'notes.md');
  const cliChangelog = path.join(root, 'packages', 'cli', 'CHANGELOG.md');
  assert.equal(cli(['--version', '0.0.0-none', '--changelog', cliChangelog, '--out', out]).status, 0);
  assert.equal(readFileSync(out, 'utf8'), '');
});

test('the real CLI changelog has a section for its latest release, and the version is matched whole', () => {
  const cliChangelog = path.join(root, 'packages', 'cli', 'CHANGELOG.md');
  const text = readFileSync(cliChangelog, 'utf8');
  const latest = /^## (\d+\.\d+\.\d+) \(/m.exec(text)[1];
  const notes = extractReleaseNotes(text, latest);
  assert.notEqual(notes, '');
  assert.equal(cli(['--version', latest, '--changelog', cliChangelog]).stdout, `${notes}\n`);
  assert.equal(extractReleaseNotes(text, latest.slice(0, -1)), '');
  assert.equal(cli(['--version', latest]).stdout === `${notes}\n`, false, 'the root changelog is not the CLI changelog');
});
