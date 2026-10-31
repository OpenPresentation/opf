import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { filterShortcutRows, formatShortcutKeys, opensOnKey, shortcutRows } from '../src/shortcuts-sheet.js';

// CE-29: the pure parts of the help item (key names per platform, rows, filtering, the "?" rule). The dialog is in shortcuts-sheet-browser.mjs.
const mac = { navigator: { platform: 'MacIntel' } };
const pc = { navigator: { platform: 'Win32' } };
assert.deepEqual(formatShortcutKeys(['Mod-z', 'Shift-Mod-z'], mac), ['⌘Z', '⇧⌘Z']);
assert.deepEqual(formatShortcutKeys(['Mod-z', 'Shift-Mod-z'], pc), ['Ctrl+Z', 'Ctrl+Shift+Z']);
assert.deepEqual(formatShortcutKeys(['Mod-Shift-z'], pc), ['Ctrl+Shift+Z'], 'modifier order does not matter');
assert.deepEqual(formatShortcutKeys(['?', 'Shift-?', 'F1'], pc), ['?', 'Shift+?', 'F1']);
assert.deepEqual(formatShortcutKeys(['Mod-k Mod-s'], pc), ['Ctrl+K Ctrl+S'], 'a chord keeps its strokes apart');
assert.deepEqual(formatShortcutKeys(['Mod--'], pc), ['Ctrl+-']);
assert.deepEqual(formatShortcutKeys(['Bogus-z', ''], pc), ['Bogus-z'], 'an unparsable name is shown as it is; an empty one is dropped');
assert.deepEqual(formatShortcutKeys('Mod-s', pc), ['Ctrl+S'], 'a single string works');
assert.deepEqual(formatShortcutKeys(undefined, pc), []);

const rows = shortcutRows([
  { label: 'Undo', keys: ['Mod-z'], group: 'Edit' },
  { label: 'Redo', keys: ['Shift-Mod-z', 'Ctrl-y'], group: 'Edit', id: 'redo' },
  { label: 'Open help', keys: ['?'] },
  { keys: ['x'] },
  null,
], pc);
assert.deepEqual(rows.map((row) => [row.title, row.group, row.keys]), [
  ['Undo', 'Edit', ['Ctrl+Z']],
  ['Redo', 'Edit', ['Ctrl+Shift+Z', 'Ctrl+Y']],
  ['Open help', 'General', ['?']],
], 'rows without a label are dropped and the group defaults');
assert.equal(rows[1].id, 'redo');
assert.deepEqual(shortcutRows(undefined, pc), []);

assert.deepEqual(filterShortcutRows(rows, '').map((row) => row.title), ['Undo', 'Redo', 'Open help']);
assert.equal(filterShortcutRows(rows, '  ').length, 3, 'a blank query keeps every row');
assert.deepEqual(filterShortcutRows(rows, 'undo').map((row) => row.title), ['Undo']);
assert.deepEqual(filterShortcutRows(rows, 'ctrl+y').map((row) => row.title), ['Redo'], 'the keys are searchable');
assert.deepEqual(filterShortcutRows(rows, 'edit').map((row) => row.title), ['Undo', 'Redo'], 'so is the group');
assert.deepEqual(filterShortcutRows(rows, 'edit shift').map((row) => row.title), ['Redo'], 'every word must match');
assert.deepEqual(filterShortcutRows(rows, 'zzz'), []);

// The "?" rule, with minimal event doubles.
const target = (props = {}) => ({ nodeType: 1, tagName: 'DIV', isContentEditable: false, closest: () => null, ...props });
const key = (init = {}) => ({ key: '?', ctrlKey: false, metaKey: false, altKey: false, shiftKey: true, target: target(), ...init });
assert.equal(opensOnKey(key()), true);
assert.equal(opensOnKey(key({ shiftKey: false })), true, 'a layout where ? needs no Shift');
assert.equal(opensOnKey(key({ key: '/' })), false);
assert.equal(opensOnKey(key({ ctrlKey: true })), false);
assert.equal(opensOnKey(key({ metaKey: true })), false);
assert.equal(opensOnKey(key({ altKey: true })), false);
assert.equal(opensOnKey(key({ defaultPrevented: true })), false);
assert.equal(opensOnKey(key({ isComposing: true })), false);
assert.equal(opensOnKey(key({ opfStudioHandled: true })), false, 'another handler already took it');
assert.equal(opensOnKey(key({ target: target({ tagName: 'INPUT', type: 'text' }) })), false, 'typing in a field');
assert.equal(opensOnKey(key({ target: target({ tagName: 'TEXTAREA' }) })), false);
assert.equal(opensOnKey(key({ target: target({ isContentEditable: true }) })), false);
assert.equal(opensOnKey(key({ target: target({ tagName: 'INPUT', type: 'checkbox' }) })), true, 'a checkbox is not typed into');
assert.equal(opensOnKey(key({ target: target({ closest: (selector) => (selector.includes('.cm-editor') ? {} : null) }) })), false, 'inside an editor or dialog');
assert.equal(opensOnKey(key({ target: null })), true);

const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
assert.deepEqual(pkg.exports['./shortcuts-sheet'], { types: './dist/shortcuts-sheet.d.ts', default: './dist/shortcuts-sheet.js' });
const types = await readFile(new URL('../src/shortcuts-sheet.d.ts', import.meta.url), 'utf8');
assert.match(types, /export declare function createHelpButton/);
const css = await readFile(new URL('../src/styles/shortcuts-sheet.css', import.meta.url), 'utf8');
for (const [, variable] of css.matchAll(/var\((--[a-z0-9-]+)/g)) assert.ok(variable.startsWith('--opf-ui-'), `shortcuts-sheet.css uses ${variable}`);
assert.ok(!/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i.test(css), 'shortcuts-sheet.css has no color literal');
console.log('shortcuts sheet ok');
