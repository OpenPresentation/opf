import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createPresenter, createPresentButton, bindPresentShortcut } from '../src/presenter.js';

// RR-98: the package wiring of the presenter (the behavior is in presenter-browser.mjs and present-button-browser.mjs).
assert.equal(typeof createPresenter, 'function');
assert.equal(typeof createPresentButton, 'function');
assert.equal(typeof bindPresentShortcut, 'function');
assert.throws(() => createPresenter({}, {}), /DOM container/, 'a container is required');
assert.throws(() => createPresentButton(null), /DOM container/);
assert.throws(() => bindPresentShortcut(undefined, undefined), /needs onPresent/);

const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
assert.deepEqual(pkg.exports['./presenter'], { types: './dist/presenter.d.ts', default: './dist/presenter.js' }, './presenter is exported with types');
const types = await readFile(new URL('../src/presenter.d.ts', import.meta.url), 'utf8');
for (const name of ['createPresenter', 'createPresentButton', 'bindPresentShortcut']) assert.match(types, new RegExp(`export declare function ${name}`), `${name} is declared`);
for (const method of ['start', 'stop', 'next', 'previous', 'goTo', 'destroy']) assert.match(types, new RegExp(`\\b${method}\\(`), `Presenter.${method} is declared`);

// The styles use only the shared --opf-ui-* tokens (test/styles.mjs checks the rest), and the presenter runs on black bars.
const css = await readFile(new URL('../src/styles/presenter.css', import.meta.url), 'utf8');
for (const [, variable] of css.matchAll(/var\((--[a-z0-9-]+)/g)) assert.ok(variable.startsWith('--opf-ui-'), `presenter.css uses ${variable}`);
assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i, 'presenter.css has no color literal');
assert.match(css, /@media \(prefers-reduced-motion: reduce\)/, 'motion is guarded');
console.log('RR-98 presenter wiring ok');
