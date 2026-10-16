import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

// Exercise the exact selection functions without reading host fonts or loading fontkit.
const source = readFileSync(new URL('./measure-font-replacements.mjs', import.meta.url), 'utf8');
const start = source.indexOf('function nearestVendored(');
const end = source.indexOf('function loadReplacementFace(', start);
assert.ok(start >= 0 && end > start);
const selection = source.slice(start, end);
const fixture = () => {
  const loaded = [], vendored = new Map();
  const context = vm.createContext({
    vendored, faceCache: new Map(),
    packageOf: family => '@expo-google-fonts/' + family.toLowerCase().replaceAll(' ', '-'),
    loadReplacementFace: (pkg, weight, italic) => {
      const face = {pkg, weight, italic}; loaded.push(face); return face;
    },
  });
  return {select: vm.runInContext(selection + '\nreplacementFace;', context), vendored, loaded};
};

test('exploration selects an explicit candidate package without a named replacement family', () => {
  // This is the actual --explore call contract: measure receives {weight}, plus pkg.
  assert.match(source, /measure\(row.family, \{ weight: row.replacement.weight \}, `@expo-google-fonts\/\$\{name\}`\)/);
  const {select, loaded} = fixture();
  for (const [weight, italic] of [[400, false], [700, false], [400, true]]) {
    const face = select(undefined, weight, italic, '@expo-google-fonts/candidate');
    assert.deepEqual(face, {pkg: '@expo-google-fonts/candidate', weight, italic});
    assert.equal(select(undefined, weight, italic, '@expo-google-fonts/candidate'), face, 'within-package style cache is reused');
  }
  assert.equal(loaded.length, 3);
});

test('named families retain exact and nearest vendored routes before package fallback', () => {
  const {select, vendored, loaded} = fixture();
  const regular = {family: 'Named Family', weight: 400, italic: false};
  const bold = {family: 'Named Family', weight: 700, italic: false};
  vendored.set('named family|400|false', regular);
  vendored.set('named family|700|false', bold);
  assert.equal(select('Named Family', 400, false), regular);
  assert.equal(select('Named Family', 600, false), bold);
  assert.deepEqual(select('Other Family', 400, true), {pkg: '@expo-google-fonts/other-family', weight: 400, italic: true});
  assert.equal(loaded.length, 1);
});
