import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createDeckTitle, deckNamePatch } from '../src/deck-title.js';

// CE-28: the deck title's pure parts and its package wiring (the DOM behavior is in deck-title-browser.mjs).

// A non-empty name is an add (it also replaces), trimmed.
assert.deepEqual(deckNamePatch(undefined, 'Q4 review'), [{ op: 'add', path: '/name', value: 'Q4 review' }]);
assert.deepEqual(deckNamePatch('Old', 'New'), [{ op: 'add', path: '/name', value: 'New' }]);
assert.deepEqual(deckNamePatch('Old', '  \tNew name \n'), [{ op: 'add', path: '/name', value: 'New name' }], 'the name is trimmed');
assert.deepEqual(deckNamePatch('Old', 'old'), [{ op: 'add', path: '/name', value: 'old' }], 'case counts');
assert.deepEqual(deckNamePatch('Old', 'Old  name'), [{ op: 'add', path: '/name', value: 'Old  name' }], 'inner spaces are kept');

// The same name is no edit.
assert.equal(deckNamePatch('Same', 'Same'), null);
assert.equal(deckNamePatch('Same', '  Same  '), null, 'the same name after trimming is no edit');

// An empty name removes the key, but only when there is one.
assert.deepEqual(deckNamePatch('Old', ''), [{ op: 'remove', path: '/name' }]);
assert.deepEqual(deckNamePatch('Old', '   '), [{ op: 'remove', path: '/name' }], 'blank text is empty');
assert.equal(deckNamePatch(undefined, ''), null, 'no name and no text: nothing to remove');
assert.equal(deckNamePatch(undefined, '  '), null);
assert.deepEqual(deckNamePatch('', ''), [{ op: 'remove', path: '/name' }], 'an empty string name is still a name key');

// Odd input does not throw.
assert.equal(deckNamePatch(undefined, undefined), null);
assert.equal(deckNamePatch(undefined, null), null);
assert.deepEqual(deckNamePatch(undefined, 42), [{ op: 'add', path: '/name', value: '42' }]);
assert.deepEqual(deckNamePatch(7, 'Name'), [{ op: 'add', path: '/name', value: 'Name' }], 'a name that is not a string counts as none');

// The patches are fresh arrays.
assert.notEqual(deckNamePatch('A', 'B'), deckNamePatch('A', 'B'));

// The factory checks its arguments before it touches anything.
assert.throws(() => createDeckTitle(null, { editor: {} }), TypeError);
assert.throws(() => createDeckTitle({}, { editor: {} }), TypeError, 'a container needs an ownerDocument');
assert.throws(() => createDeckTitle({ ownerDocument: {} }, {}), TypeError, 'an editor session is required');
assert.throws(() => createDeckTitle({ ownerDocument: {} }, { editor: {} }), TypeError);

// Package wiring: the export, the types, the stylesheet.
const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
assert.deepEqual(pkg.exports['./deck-title'], { types: './dist/deck-title.d.ts', default: './dist/deck-title.js' });
const types = await readFile(new URL('../src/deck-title.d.ts', import.meta.url), 'utf8');
assert.match(types, /export declare function createDeckTitle/);
assert.match(types, /export declare function deckNamePatch/);
for (const name of ['beforeCommit', 'onRename', 'onError', 'readOnly', 'density', 'placeholder', 'label']) assert.match(types, new RegExp(`\\b${name}\\??:`), `${name} is typed`);
const css = await readFile(new URL('../src/styles/deck-title.css', import.meta.url), 'utf8');
assert.match(css, /field-sizing:\s*content/);
assert.doesNotMatch(css.replace(/\/\*[\s\S]*?\*\//g, ''), /#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i, 'tokens only');
const suites = JSON.parse(await readFile(new URL('./browser-suites.json', import.meta.url), 'utf8'));
assert.ok(suites.suites.browser.tests.some((test) => test.command === 'node test/deck-title-browser.mjs'), 'the browser test is in the browser suite');

console.log('deck-title: ok');
