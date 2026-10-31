import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describeReview } from '../src/review-pill.js';

// CE-29: what the review pill shows for a `review` event (the DOM behavior is in review-pill-browser.mjs), and its package wiring.
const counts = (error, warning, info, extra = {}) => ({ error, warning, info, total: error + warning + info, all: error + warning + info, sources: [], unavailable: false, ...extra });

assert.deepEqual(describeReview(null), { state: 'checking', severity: null, total: 0, text: 'Checking…', parts: [] });
assert.equal(describeReview(undefined).state, 'checking');
assert.deepEqual(describeReview(counts(0, 0, 0)), { state: 'valid', severity: null, total: 0, text: 'Valid', parts: [] });
assert.deepEqual(describeReview(counts(2, 1, 0)), { state: 'issues', severity: 'error', total: 3, text: '3 issues', parts: ['2 errors', '1 warning'] });
assert.deepEqual(describeReview(counts(1, 0, 0)), { state: 'issues', severity: 'error', total: 1, text: '1 issue', parts: ['1 error'] });
assert.equal(describeReview(counts(0, 4, 2)).severity, 'warning', 'warnings outrank notes');
assert.equal(describeReview(counts(0, 0, 2)).severity, 'info');
assert.deepEqual(describeReview(counts(0, 0, 2)).parts, ['2 notes']);
assert.equal(describeReview(counts(3, 2, 1)).severity, 'error', 'the most severe level wins');
assert.equal(describeReview(counts(1, 0, 0, { unavailable: true })).state, 'unavailable', 'unavailable wins over counts');
assert.equal(describeReview(counts(1, 0, 0, { unavailable: true })).text, 'Review unavailable');
assert.equal(describeReview({ error: 'x', warning: -1, info: NaN, total: undefined }).state, 'valid', 'garbage counts read as zero');
assert.equal(describeReview(counts(1, 0, 0), { issues: (n) => `${n} Probleme` }).text, '1 Probleme', 'labels override the text');
assert.equal(describeReview(null, { checking: 'Prüfe…' }).text, 'Prüfe…');

const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
assert.deepEqual(pkg.exports['./review-pill'], { types: './dist/review-pill.d.ts', default: './dist/review-pill.js' });
const types = await readFile(new URL('../src/review-pill.d.ts', import.meta.url), 'utf8');
assert.match(types, /export declare function createReviewPill/);
assert.match(types, /export declare function describeReview/);
const css = await readFile(new URL('../src/styles/review-pill.css', import.meta.url), 'utf8');
for (const [, variable] of css.matchAll(/var\((--[a-z0-9-]+)/g)) assert.ok(variable.startsWith('--opf-ui-'), `review-pill.css uses ${variable}`);
assert.ok(!/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i.test(css), 'review-pill.css has no color literal');
console.log('review pill ok');
