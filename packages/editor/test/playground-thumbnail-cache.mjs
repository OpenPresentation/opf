import assert from 'node:assert/strict';
import {toSvg} from '@openpresentation/opf-render/svg';
import {loadFonts} from '@openpresentation/opf-render/fonts-node';
import {gallery} from '@openpresentation/gallery';
import {createThumbnailCache} from '../examples/thumbnail-cache.js';

const catalogs = [structuredClone(gallery)];
const fonts = await loadFonts({pack: 'office'});
const options = {catalogs, fonts, text: 'system', trace: false, skipHidden: true};
const calls = [];
const cache = createThumbnailCache({toSvg: (deck, selected, settings) => { calls.push(selected); return toSvg(deck, selected, settings); }, getOptions: () => options});
const deck = {
  name: 'Thumbnail context', organization: {id: 'team', role: 'primary', name: 'Original team'},
  design: {theme: 'minimal', fontScheme: 'roboto', footer: {right: {text: '{{slide.number}} / {{deck.slideCount}} · {{slide.section}} · {{organization.name}}'}}},
  slides: [
    {id: 'one', layout: 'text', section: 'Intro', title: 'First', text: 'An inherited design.'},
    {id: 'two', hidden: true, layout: 'text', title: 'Hidden', text: 'Hidden slides still have thumbnails.'},
    {id: 'three', title: 'Groups', composition: {mode: 'row'}, blocks: [{text: 'Left'}, {blocks: [{text: 'Nested'}]}]},
    {id: 'four', layout: 'text', section: 'Close', title: 'Last', text: 'The final slide.'},
  ],
};
const exact = value => value.slides.map((_, index) => toSvg(value, index + 1, options));
const displayed = value => value.slides.map((_, index) => cache.html(value, index));
cache.prepare(deck);
assert.deepEqual(calls, [[1, 2, 3, 4]], 'one bulk toSvg call resolves/composes the whole deck once, including hidden slides');
assert.deepEqual(displayed(deck), exact(deck), 'every SVG is byte-identical to individual rendering at its original deck index');
assert.match(displayed(deck)[1], /Hidden slides still/);
cache.prepare(structuredClone(deck));
assert.equal(calls.length, 1, 'a fresh but unchanged session snapshot and second navigator need no render');

deck.slides[1].title = 'Changed hidden title';
cache.prepare(deck);
assert.deepEqual(calls.at(-1), [2], 'a local content edit renders only its missing thumbnail in one deck resolution');
assert.deepEqual(displayed(deck), exact(deck));

deck.organization.name = 'Updated team';
cache.prepare(deck);
assert.deepEqual(calls.at(-1), [1, 2, 3, 4], 'inherited organization furniture invalidates every affected slide');
assert.deepEqual(displayed(deck), exact(deck));
assert.match(displayed(deck)[0], /Updated team/);
deck.slides[0].section = 'Changed section';
cache.prepare(deck);
assert.deepEqual(calls.at(-1), [1, 2, 3, 4], 'section context changes invalidate the inherited furniture context');
assert.deepEqual(displayed(deck), exact(deck));
assert.match(displayed(deck)[0], /Changed section/);
deck.slides.reverse();
cache.prepare(deck);
assert.deepEqual(displayed(deck), exact(deck), 'reordering preserves section context, numbering and original selection indices');
deck.slides.pop();
cache.prepare(deck);
assert.deepEqual(calls.at(-1), [1, 2, 3], 'count changes invalidate furniture on remaining slides');
assert.deepEqual(displayed(deck), exact(deck));

catalogs[0].themes.minimal.background = {type: 'solid', color: '#112233'};
cache.prepare(deck);
assert.deepEqual(calls.at(-1), [1, 2, 3], 'registered catalog changes invalidate the same references');
assert.deepEqual(displayed(deck), exact(deck));
assert.match(displayed(deck)[0], /#112233/);
const beforeFontClear = calls.length;
cache.clear();
cache.prepare(deck);
assert.equal(calls.length, beforeFontClear + 1, 'the existing font-ready clear forces one fresh batch');

const long = {design: {fontScheme: 'roboto'}, slides: Array.from({length: 60}, (_, index) => ({id: `long-${index}`, title: `Slide ${index + 1}`, text: 'One paragraph that remains editable.'}))};
const beforeLong = calls.length;
cache.prepare(long);
assert.equal(calls.length, beforeLong + 1, '60 thumbnail misses still cause exactly one full-deck composition call');
assert.equal(calls.at(-1).length, 60);
for (const index of [0, 29, 59]) assert.equal(cache.html(long, index), toSvg(long, index + 1, options));
cache.prepare(long);
assert.equal(calls.length, beforeLong + 1, 'a second 60-slide render is entirely cached');

const errorCalls = [];
const isolatedErrors = createThumbnailCache({getOptions: () => ({}), toSvg: (_, selection) => {
  errorCalls.push(selection);
  if (Array.isArray(selection) || selection === 2) throw new Error('One slide cannot be painted');
  return `<svg>${selection}</svg>`;
}});
const small = {slides: [{}, {}, {}]};
assert.deepEqual(small.slides.map((_, index) => isolatedErrors.html(small, index)), ['<svg>1</svg>', 'Preview unavailable', '<svg>3</svg>']);
assert.deepEqual(errorCalls, [[1, 2, 3], 1, 2, 3], 'only exceptional batch failures fall back to the previous per-slide error semantics');
console.log(JSON.stringify({passed: true, byteIdenticalSvg: true, hidden: true, sections: true, furniture: true, registeredCatalogInvalidation: true, fontClear: true, longDeck: {slides: 60, fullDeckCompositionCalls: 1}, perSlideErrorFallback: true}));
