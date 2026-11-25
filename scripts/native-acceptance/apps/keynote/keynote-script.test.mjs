// NT-02: what keynote.applescript must never contain, read as text (it is never run by a test): a document closes only
// with `saving no`; no save command, no quit, no activate or launch; Keynote is addressed only by its bundle id; no
// other application, no shell. And nothing compiled or copied from Keynote's dictionary sits beside it.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { SCRIPT } from './driver.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const source = readFileSync(SCRIPT, 'utf8');
// The code without comments ("-- ..." to the end of a line; the script has no (* *) blocks and no "--" inside strings).
const code = source
  .split('\n')
  .map((line) => line.replace(/--.*$/u, ''))
  .join('\n');

test('the script has no block comments and no "--" inside a string, so the comment stripping above is exact', () => {
  assert.ok(!source.includes('(*'));
  for (const line of source.split('\n')) {
    const comment = line.indexOf('--');
    if (comment >= 0) assert.equal((line.slice(0, comment).match(/"/gu) ?? []).length % 2, 0, line);
  }
});

test('every close of a document says saving no', () => {
  const closes = code
    .split("\n")
    .map((line) => line.replace(/"[^"]*"/gu, '""'))
    .filter((line) => /\bclose\b/u.test(line) && !/\bclose access\b/u.test(line));
  assert.ok(closes.length > 0);
  for (const line of closes) assert.match(line, /\bclose document id docId saving no\b/u, line.trim());
});

test('never save, quit, activate or launch; no other application, no shell, no UI scripting', () => {
  for (const word of ['save', 'quit', 'activate', 'launch', 'reopen', 'delete', 'make new']) {
    assert.ok(!new RegExp(`\\b${word}\\b`, 'iu').test(source), `"${word}" appears in keynote.applescript`);
  }
  for (const banned of ['System Events', 'do shell script', 'Finder', 'keystroke', 'click ']) assert.ok(!source.includes(banned), banned);
});

test('Keynote is addressed only as application id "com.apple.Keynote"', () => {
  const mentions = [...code.matchAll(/\bapplication\b[^\n]*/gu)].map((match) => match[0]);
  assert.ok(mentions.length > 20);
  for (const mention of mentions) assert.ok(mention.startsWith('application id "com.apple.Keynote"'), mention);
  assert.ok(!/\bapplication\s+"/u.test(code), 'no application addressed by name');
});

test('the export verbs write slide images without skipped slides and a Microsoft PowerPoint copy; nothing else is exported', () => {
  const exports = code.split('\n').filter((line) => /\bexport\b/u.test(line));
  assert.deepEqual(
    exports.map((line) => line.trim()),
    [
      'tell application id "com.apple.Keynote" to export d to outFolder as slide images with properties {image format:PNG, skipped slides:false}',
      'tell application id "com.apple.Keynote" to export d to f as Microsoft PowerPoint',
    ],
  );
});

test('the folder holds source text only: no compiled script, no dictionary, no binary', () => {
  const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => (entry.isDirectory() ? walk(path.join(dir, entry.name)) : [entry.name]));
  for (const name of walk(here)) {
    assert.match(name, /\.(mjs|md|applescript|lines|json)$/u, name);
    assert.ok(!/\.(scpt|scptd|sdef|app)$/u.test(name), name);
  }
});
