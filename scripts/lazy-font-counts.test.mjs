import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdirSync, mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {readdir, readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {LAZY_FONT_COUNTS, REVIEWED_FONT_SETS, assertLazyFontCount, hashFontSet, lazyFontCountProblem} from './lazy-font-counts.mjs';

test('renderer 0.18.2 retains the reviewed 94-face policy without admitting unknown counts or releases', () => {
  assert.deepEqual(LAZY_FONT_COUNTS['0.18.2'], [94]);
  assertLazyFontCount('0.18.1', 94);
  assertLazyFontCount('0.18.2', 94);
  for (const count of [0, 93, 95, 94.5]) assert.throws(() => assertLazyFontCount('0.18.2', count), /expected 94/);
  for (const version of ['99.99.99', '0.18.2-next.0']) assert.throws(() => assertLazyFontCount(version, 94), /no expected lazy font count/);
  assert.ok(Object.isFrozen(LAZY_FONT_COUNTS));
  assert.ok(Object.isFrozen(LAZY_FONT_COUNTS['0.18.2']));
});

test('reviewed renderer 0.19.0 source retains 94 faces without admitting prereleases or drift',()=>{
 assert.deepEqual(LAZY_FONT_COUNTS['0.19.0'],[94]);assertLazyFontCount('0.19.0',94);
 for(const count of [0,93,95,94.5])assert.throws(()=>assertLazyFontCount('0.19.0',count),/expected 94/);
 for(const version of ['0.19.0-next.0','99.99.99'])assert.throws(()=>assertLazyFontCount(version,94),/no expected lazy font count/);
 assert.ok(Object.isFrozen(LAZY_FONT_COUNTS['0.19.0']));
});

test('renderer 0.19.1 retains the exact reviewed face count with strict refusals', () => {
  assert.deepEqual(LAZY_FONT_COUNTS['0.19.1'], [94]);
  assertLazyFontCount('0.19.1', 94);
  for (const count of [0, 93, 95, 94.5]) assert.throws(() => assertLazyFontCount('0.19.1', count), /expected 94/);
  for (const version of ['99.99.99', '0.19.1-next.0']) assert.throws(() => assertLazyFontCount(version, 94), /no expected lazy font count/);
  assert.ok(Object.isFrozen(LAZY_FONT_COUNTS['0.19.1']));
});

test('renderer 0.20.0 retains the exact reviewed face count with strict refusals', () => {
  assert.deepEqual(LAZY_FONT_COUNTS['0.20.0'], [94]);
  assertLazyFontCount('0.20.0', 94);
  for (const count of [0, 93, 95, 94.5]) assert.throws(() => assertLazyFontCount('0.20.0', count), /expected 94/);
  for (const version of ['99.99.99', '0.20.0-next.0']) assert.throws(() => assertLazyFontCount(version, 94), /no expected lazy font count/);
  assert.ok(Object.isFrozen(LAZY_FONT_COUNTS['0.20.0']));
});

test('renderer 0.20.1 retains the reviewed 94 faces and refuses drift or unrecorded versions', () => {
  assert.deepEqual(LAZY_FONT_COUNTS['0.20.1'], [94]);
  assertLazyFontCount('0.20.1', 94);
  for (const count of [0, 93, 95, 94.5, NaN, Infinity, '94', undefined]) {
    assert.throws(() => assertLazyFontCount('0.20.1', count), /expected 94/);
  }
  for (const version of ['0.20.1-next.0', '0.20.5', '99.99.99']) {
    assert.throws(() => assertLazyFontCount(version, 94), /no expected lazy font count/);
  }
  assert.ok(Object.isFrozen(LAZY_FONT_COUNTS['0.20.1']));
});

// This admits one reviewed prospective release, not every version at the same count.
test('renderer 0.20.2 source retains 94 faces while future releases and count drift still fail', () => {
  assert.deepEqual(LAZY_FONT_COUNTS['0.20.2'], [94]);
  assertLazyFontCount('0.20.2', 94);
  for (const count of [0, 93, 95, 94.5, NaN, Infinity, '94', undefined]) {
    assert.throws(() => assertLazyFontCount('0.20.2', count), /expected 94/);
  }
  for (const version of ['0.20.2-next.0', '0.20.5', '99.99.99']) {
    assert.throws(() => assertLazyFontCount(version, 94), /no expected lazy font count/);
  }
  assert.ok(Object.isFrozen(LAZY_FONT_COUNTS['0.20.2']));
});

// Only this source-reviewed release is admitted; neither equal-count future versions nor drift are inferred.
test('renderer 0.20.3 retains its source-verified 94 faces with strict version and count refusals', () => {
  assert.deepEqual(LAZY_FONT_COUNTS['0.20.3'], [94]);
  assertLazyFontCount('0.20.3', 94);
  for (const count of [0, 93, 95, 94.5, NaN, Infinity, '94', undefined]) {
    assert.throws(() => assertLazyFontCount('0.20.3', count), /expected 94/);
  }
  for (const version of ['0.20.3-next.0', '0.20.5', '99.99.99']) {
    assert.throws(() => assertLazyFontCount(version, 94), /no expected lazy font count/);
  }
  assert.ok(Object.isFrozen(LAZY_FONT_COUNTS['0.20.3']));
});

// Workflow-only recovery does not infer support for the next unreviewed version.
test('renderer 0.20.4 recovery retains exactly 94 reviewed faces and fails closed otherwise', () => {
  assert.deepEqual(LAZY_FONT_COUNTS['0.20.4'], [94]);
  assertLazyFontCount('0.20.4', 94);
  for (const count of [0, 93, 95, 94.5, NaN, Infinity, '94', undefined]) {
    assert.throws(() => assertLazyFontCount('0.20.4', count), /expected 94/);
  }
  for (const version of ['0.20.4-next.0', '0.20.5', '99.99.99']) {
    assert.throws(() => assertLazyFontCount(version, 94), /no expected lazy font count/);
  }
  assert.ok(Object.isFrozen(LAZY_FONT_COUNTS['0.20.4']));
});

// RR-90: renderer 0.22.0 keeps the unchanged 94-face office registry; the next unreviewed versions still fail closed.
test('renderer 0.22.0 retains exactly 94 reviewed faces and fails closed otherwise', () => {
  assert.deepEqual(LAZY_FONT_COUNTS['0.22.0'], [94]);
  assertLazyFontCount('0.22.0', 94);
  for (const count of [0, 93, 95, 94.5, NaN, Infinity, '94', undefined]) {
    assert.throws(() => assertLazyFontCount('0.22.0', count), /expected 94/);
  }
  for (const version of ['0.22.0-next.0', '0.21.0', '0.22.1', '99.99.99']) {
    assert.throws(() => assertLazyFontCount(version, 94), /no expected lazy font count/);
  }
  assert.ok(Object.isFrozen(LAZY_FONT_COUNTS['0.22.0']));
});

// RR-90: an unlisted version passes only with the font files and count of a reviewed set.
const [REVIEWED_SHA, REVIEWED] = Object.entries(REVIEWED_FONT_SETS)[0];
const reviewedFonts = {manifestSha256: REVIEWED.manifestSha256, fontSetSha256: REVIEWED_SHA, files: REVIEWED.files};

test('the reviewed set records the 143 files of the published 0.20.x renderers and the cited manifest hash', () => {
  assert.equal(REVIEWED.files, 143);
  assert.equal(REVIEWED.count, 94);
  assert.equal(REVIEWED.manifestSha256, '16d0b4141054f42c66f3aa9a4f146362693825689c442c8ee693832b729fa699');
  assert.match(REVIEWED_SHA, /^[0-9a-f]{64}$/);
  for (const version of REVIEWED.versions) assert.deepEqual(LAZY_FONT_COUNTS[version], [REVIEWED.count], `${version} keeps its own entry`);
  assert.ok(Object.isFrozen(REVIEWED_FONT_SETS) && Object.isFrozen(REVIEWED) && Object.isFrozen(REVIEWED.versions));
});

test('an unlisted renderer with an unchanged font set and the same count passes', () => {
  assertLazyFontCount('0.22.1', 94, 'renderer', reviewedFonts);
  assert.equal(lazyFontCountProblem({version: '0.22.1', count: 94, counts: LAZY_FONT_COUNTS, reviewedSets: REVIEWED_FONT_SETS, fonts: reviewedFonts}), undefined);
});

test('renderer 0.22.1 (unlisted) passes on the reviewed font set and 94 faces, and fails on anything else', () => {
  assertLazyFontCount('0.22.1', 94, 'renderer', reviewedFonts);
  assert.equal(LAZY_FONT_COUNTS['0.22.1'], undefined, 'no manual entry is needed');
  assert.throws(() => assertLazyFontCount('0.22.1', 95, 'renderer', reviewedFonts), /count changed without the fonts/);
  assert.throws(() => assertLazyFontCount('0.22.1', 94, 'renderer', {...reviewedFonts, fontSetSha256: 'd'.repeat(64)}), /not a reviewed set/);
  assert.throws(() => assertLazyFontCount('0.22.1', 94), /no expected lazy font count/);
  assert.throws(() => assertLazyFontCount('0.22.1-next.0', 94, 'renderer', reviewedFonts), /prerelease/);
});

test('an unlisted renderer whose font files changed fails and asks for a reviewed entry', () => {
  const changed = {...reviewedFonts, fontSetSha256: 'a'.repeat(64), manifestSha256: 'b'.repeat(64)};
  assert.throws(() => assertLazyFontCount('0.22.1', 94, 'renderer', changed), (error) => /no expected lazy font count/.test(error.message) && /not a reviewed set/.test(error.message) && error.message.includes('a'.repeat(64)) && /REVIEWED_FONT_SETS/.test(error.message));
});

test('an unlisted renderer with the reviewed font files and a different count fails and names the change', () => {
  for (const count of [93, 95, 0, 94.5]) {
    assert.throws(() => assertLazyFontCount('0.22.1', count, 'renderer', reviewedFonts), /the count changed without the fonts/);
  }
  assert.throws(() => assertLazyFontCount('0.22.1', 95, 'renderer', reviewedFonts), /reviewed set of renderer 0\.20\.4/);
});

test('without a font set an unlisted version still fails closed, and a prerelease is never admitted by its fonts', () => {
  assert.throws(() => assertLazyFontCount('0.22.1', 94), /no expected lazy font count/);
  for (const version of ['0.22.1-next.0', '0.20.4-next.0']) {
    assert.throws(() => assertLazyFontCount(version, 94, 'renderer', reviewedFonts), /no expected lazy font count.*prerelease/);
    assert.throws(() => assertLazyFontCount(version, 94), /no expected lazy font count/);
  }
});

test('a listed version keeps its own rules whatever the font set says', () => {
  assertLazyFontCount('0.20.4', 94, 'renderer', {...reviewedFonts, fontSetSha256: 'c'.repeat(64)});
  assert.throws(() => assertLazyFontCount('0.20.4', 95, 'renderer', reviewedFonts), /expected 94/);
});

test('the label names the checkout in a refusal', () => {
  assert.throws(() => assertLazyFontCount('0.22.1', 93, 'sibling opf-render', reviewedFonts), /^Error: sibling opf-render 0\.22\.1/);
});

function fakePackage(files) {
  const root = mkdtempSync(path.join(tmpdir(), 'opf-font-set-'));
  for (const [relative, text] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(root, relative)), {recursive: true});
    writeFileSync(path.join(root, relative), text);
  }
  return root;
}
const hashOf = (root) => hashFontSet({root, readdir, readFile, createHash});

test('hashFontSet hashes the manifest and every file under fonts/, independent of creation order', async () => {
  const base = {'dist/font-manifest.js': 'manifest', 'fonts/a/A.ttf': 'aaa', 'fonts/a/OFL.txt': 'license', 'fonts/b/B.ttf': 'bbb', 'dist/index.js': 'not a font file'};
  const one = fakePackage(base);
  const two = fakePackage(Object.fromEntries(Object.entries(base).reverse()));
  const changedFont = fakePackage({...base, 'fonts/b/B.ttf': 'bbc'});
  const changedManifest = fakePackage({...base, 'dist/font-manifest.js': 'manifest2'});
  const extraFile = fakePackage({...base, 'fonts/b/EXTRA.json': '{}'});
  const missingFile = fakePackage(Object.fromEntries(Object.entries(base).filter(([file]) => file !== 'fonts/a/OFL.txt')));
  const unrelated = fakePackage({...base, 'dist/index.js': 'changed code'});
  try {
    const first = await hashOf(one);
    assert.equal(first.files, 4);
    assert.match(first.fontSetSha256, /^[0-9a-f]{64}$/);
    assert.equal(first.manifestSha256, createHash('sha256').update('manifest').digest('hex'));
    assert.deepEqual(await hashOf(two), first);
    assert.deepEqual(await hashOf(unrelated), first, 'code outside the font set does not move the digest');
    for (const root of [changedFont, extraFile, missingFile]) assert.notEqual((await hashOf(root)).fontSetSha256, first.fontSetSha256);
    const moved = await hashOf(changedManifest);
    assert.notEqual(moved.fontSetSha256, first.fontSetSha256);
    assert.notEqual(moved.manifestSha256, first.manifestSha256);
  } finally {
    for (const root of [one, two, changedFont, changedManifest, extraFile, missingFile, unrelated]) rmSync(root, {recursive: true, force: true});
  }
});

test('the helpers the installed-consumer check embeds run on their own', async () => {
  const embedded = (fn) => new Function(`return (${fn.toString()})`)();
  const problem = embedded(lazyFontCountProblem);
  assert.equal(problem({version: '0.22.1', count: 94, counts: LAZY_FONT_COUNTS, reviewedSets: REVIEWED_FONT_SETS, fonts: reviewedFonts}), undefined);
  assert.match(problem({version: '0.22.1', count: 95, counts: LAZY_FONT_COUNTS, reviewedSets: REVIEWED_FONT_SETS, fonts: reviewedFonts}), /count changed/);
  const root = fakePackage({'dist/font-manifest.js': 'm', 'fonts/x/X.ttf': 'x'});
  try {
    assert.deepEqual(await embedded(hashFontSet)({root, readdir, readFile, createHash}), await hashOf(root));
  } finally {
    rmSync(root, {recursive: true, force: true});
  }
});
