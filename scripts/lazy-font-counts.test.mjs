import assert from 'node:assert/strict';
import test from 'node:test';
import {LAZY_FONT_COUNTS, assertLazyFontCount} from './lazy-font-counts.mjs';

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
  for (const version of ['0.20.1-next.0', '0.20.2', '99.99.99']) {
    assert.throws(() => assertLazyFontCount(version, 94), /no expected lazy font count/);
  }
  assert.ok(Object.isFrozen(LAZY_FONT_COUNTS['0.20.1']));
});
