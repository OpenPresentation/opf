import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// CE-29: the package wiring of the toolbar actions part (the DOM behavior is in toolbar-actions-browser.mjs).
const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
assert.deepEqual(pkg.exports['./toolbar-actions'], { types: './dist/toolbar-actions.d.ts', default: './dist/toolbar-actions.js' });
const types = await readFile(new URL('../src/toolbar-actions.d.ts', import.meta.url), 'utf8');
assert.match(types, /export declare function createToolbarActions/);
const css = await readFile(new URL('../src/styles/toolbar-actions.css', import.meta.url), 'utf8');
for (const [, variable] of css.matchAll(/var\((--[a-z0-9-]+)/g)) assert.ok(variable.startsWith('--opf-ui-'), `toolbar-actions.css uses ${variable}`);
assert.ok(!/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i.test(css), 'toolbar-actions.css has no color literal');
const touch = await readFile(new URL('../src/styles/touch.css', import.meta.url), 'utf8');
for (const name of ['opf-review-pill', 'opf-help-button', 'opf-actions-button']) assert.ok(touch.includes(`.${name}`), `touch.css lifts .${name} to 44px`);
console.log('toolbar actions ok');
