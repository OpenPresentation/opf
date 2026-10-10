import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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
