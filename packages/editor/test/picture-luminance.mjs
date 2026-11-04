// LH-145: the editor's picture meter hands the canvas one stable sampler, measures through the renderer's `measurePictures`, redraws only
// when an answer changed, leaves a host's own sampler alone, and `measureDeck` serves the exports.
import assert from 'node:assert/strict';
import { createPictureMeter, measureDeck, measureOptionsFor } from '../src/picture-luminance.js';

const grid = (value) => ({ columns: 1, rows: 1, values: [value], high: [value] });
const sampling = (entries) => Object.assign((src) => entries[src], { sources: Object.keys(entries), measured: Object.values(entries).filter(Boolean).length });
const resolver = () => null;

// Options come from the render options the host draws with.
{
  const options = measureOptionsFor({ imageResolver: resolver, catalogs: [{ source: 'x' }], onDiagnostic: () => {} }, { fetch: () => {} });
  assert.equal(options.imageResolver, resolver);assert.equal(options.catalogs.length, 1);assert.equal(typeof options.fetch, 'function');assert.equal(typeof options.onDiagnostic, 'function');
}

// The meter: one sampler, answers after the first measurement, redraws on a change only, coalesces calls.
{
  const calls = [], byDeck = { 'deck 1': sampling({ a: grid(0.01) }), 'deck 3': sampling({ a: grid(0.01) }), 'deck 4': sampling({ a: grid(0.5), b: grid(0.2) }) };
  let changes = 0, release;
  const gate = new Promise((resolve) => { release = resolve; });
  // The first deck's answer is the grid object a cache would return again for the same picture: identical grids are no change.
  const shared = grid(0.01);
  byDeck['deck 1'] = sampling({ a: shared });byDeck['deck 3'] = sampling({ a: shared });
  const meter = createPictureMeter({ onChange: () => changes++, measure: async (deck, options) => { calls.push({ deck, cache: options.cache }); await gate; return byDeck[deck]; } });
  const sampler = meter.sampler;
  assert.equal(sampler('a'), undefined, 'nothing is known before the first measurement');
  const first = meter.update('deck 1', {}), second = meter.update('deck 2', {}), third = meter.update('deck 3', {});
  release();
  await Promise.all([first, second, third]);
  assert.deepEqual(calls.map((call) => call.deck), ['deck 1', 'deck 3'], 'the deck asked for last is measured last; the one in between is skipped');
  assert.equal(calls[0].cache, calls[1].cache, 'one cache for the life of the meter');
  assert.equal(sampler('a'), shared);
  assert.equal(changes, 1, 'one change for the first answer; the same grids again are none');
  await meter.update('deck 4', {});
  assert.equal(changes, 2, 'a new picture redraws');
  assert.equal(sampler('b').values[0], 0.2);
  await meter.update('deck 4', {});
  assert.equal(changes, 2, 'an unchanged answer does not redraw');
  meter.dispose();
  await meter.update('deck 5', {});
  assert.equal(calls.length, 4, 'a disposed meter measures nothing');
}

// A host that measures for itself is not measured over, and the exports take its sampler.
{
  let measured = 0;
  const meter = createPictureMeter({ measure: async () => { measured++; return sampling({}); } });
  await meter.update('deck', { pictureLuminance: () => undefined });
  assert.equal(measured, 0);
  const own = () => undefined;
  assert.equal(await measureDeck({}, { pictureLuminance: own }), own);
  const sampler = sampling({ a: grid(0.1) });
  assert.equal(await measureDeck({}, {}, { measure: async () => sampler }), sampler);
  assert.equal(await measureDeck({}, {}, { measure: async () => sampling({}) }), undefined, 'nothing measured: no sampler');
  assert.equal(await measureDeck({}, {}, { measure: async () => { throw new Error('boom'); } }), undefined, 'a failure keeps the worst case');
}
console.log('picture luminance: the meter, its coalescing and the export helper checked.');
