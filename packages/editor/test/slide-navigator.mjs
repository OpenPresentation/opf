import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { formatSlideCounter } from '../src/slide-navigator.js';

// RR-98: the counter format, and the package wiring of the two components (the DOM behavior is in slide-navigator-browser.mjs).
assert.equal(formatSlideCounter(0, 3), '01 / 03');
assert.equal(formatSlideCounter(2, 3), '03 / 03');
assert.equal(formatSlideCounter(98, 99), '99 / 99');
assert.equal(formatSlideCounter(99, 100), '100 / 100', 'a hundred slides need the three-digit width');
assert.equal(formatSlideCounter(0, 100), '001 / 100', 'both numbers pad to the same width');
assert.equal(formatSlideCounter(0, 0), '00 / 00', 'an empty deck has no current slide');
assert.equal(formatSlideCounter(7, 1234), '0008 / 1234');

const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
for (const name of ['slide-navigator', 'thumbnail-strip', 'thumbnail-cache']) {
  assert.deepEqual(pkg.exports[`./${name}`], { types: `./dist/${name}.d.ts`, default: `./dist/${name}.js` }, `./${name} is exported with types`);
}
for (const name of ['slide-navigator', 'thumbnail-strip', 'thumbnail-cache']) {
  const types = await readFile(new URL(`../src/${name}.d.ts`, import.meta.url), 'utf8');
  assert.match(types, /export declare function create(SlideNavigator|ThumbnailStrip|ThumbnailCache)/, `${name}.d.ts declares its factory`);
}
// The styles use only the shared --opf-ui-* tokens (with fallbacks), never a color of their own.
for (const name of ['navigator', 'thumbnails']) {
  const css = await readFile(new URL(`../src/styles/${name}.css`, import.meta.url), 'utf8');
  for (const [, variable] of css.matchAll(/var\((--[a-z0-9-]+)/g)) assert.ok(variable.startsWith('--opf-ui-') || variable.startsWith('--opf-thumbs-'), `${name}.css uses ${variable}`);
  assert.doesNotMatch(css.replace(/var\([^;]*?\)\)?/g, ''), /#[0-9a-f]{3,8}\b|rgba?\(/i, `${name}.css has no color outside a token fallback`);
}
console.log('RR-98 navigator wiring ok');
