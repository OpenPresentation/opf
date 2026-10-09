// RR-73: one engine shape for the renderer, `toX(deck, slides?, options?)`. The second argument is a slide number (one result), a
// selection such as "1-3" or [1, 3] (a list), or the options, told apart by type; slides count from 1. `toPng` and `toPdf` draw a
// deck with `toSvg` themselves and still take SVG the renderer drew. The 0.17 names are gone, and their options fail with the new name.
import assert from 'node:assert/strict';
import * as api from '../dist/index.js';
import { toHtml } from '../dist/element.js';

const { toSvg, toPng, toPdf } = api;
for (const name of ['renderSvg', 'renderSlideSvg', 'svgToPng', 'svgToPdf']) assert.equal(api[name], undefined, `${name} is removed`);

const deck = { name: 'Arguments', slides: [{ title: 'One' }, { title: 'Two', hidden: true }, { title: 'Three' }] };
const all = toSvg(deck);
assert.equal(all.length, 3);
assert.equal(toSvg(deck, 2), all[1], 'a slide number draws that slide, counting from 1, hidden or not');
assert.deepEqual(toSvg(deck, '1-2'), all.slice(0, 2));
assert.deepEqual(toSvg(deck, [3, 1]), [all[0], all[2]], 'a list is drawn in slide order');
assert.deepEqual(toSvg(deck, '2-'), all.slice(1));
assert.deepEqual(toSvg(deck, { skipHidden: true }), [all[0], all[2]], 'the options may come second');
assert.deepEqual(toSvg(deck, '1-3', { skipHidden: true }), all, 'a selection draws exactly the slides it names');
assert.deepEqual(toSvg(deck, undefined, { trace: true }), toSvg(deck, { trace: true }));
for (const slide of [0, 4, 1.5]) assert.throws(() => toSvg(deck, slide), (error) => error instanceof api.OPFRenderError && error.code === 'slide-out-of-range' && error.details.slideCount === 3);
for (const slides of ['0-1', 'x', '2-1', '4', [], [0]]) assert.throws(() => toSvg(deck, slides), { code: 'invalid-slide-selection' }, JSON.stringify(slides));

// The 0.17 options name their replacement.
assert.throws(() => toSvg(deck, { embedFonts: false }), (error) => error.code === 'invalid-render-options' && /text: "system"/.test(error.message));
assert.throws(() => toSvg(deck, { fonts: ['fonts'] }), { code: 'invalid-render-options' }, 'font folders cannot measure a deck');
await assert.rejects(toPng(all[0], { fontDirs: ['fonts'] }), (error) => error.code === 'invalid-conversion-option' && /fonts: a font folder/.test(error.message));
await assert.rejects(toPdf(all, { mode: 'raster' }), (error) => error.code === 'invalid-conversion-option' && /raster: true/.test(error.message));

// toPng: a deck or SVG, one PNG for one slide or one SVG, a list otherwise.
const png = await toPng(deck, 3, { scale: 0.25 });
assert.ok(png instanceof Uint8Array);
assert.deepEqual(png, await toPng(all[2], { scale: 0.25 }), 'drawing the deck equals converting its SVG');
assert.deepEqual(await toPng(deck, [1, 3], { scale: 0.25 }), [await toPng(all[0], { scale: 0.25 }), png]);
assert.equal((await toPng(deck, { scale: 0.25 })).length, 3);
assert.equal((await toPng([all[0]], { scale: 0.25 })).length, 1, 'a list of SVG gives a list');
assert.deepEqual(await toPng(new TextEncoder().encode(all[2]), { scale: 0.25 }), png, 'SVG bytes');
await assert.rejects(toPng(all[0], 1), { code: 'invalid-conversion-option' }, 'SVG input is already drawn');
await assert.rejects(toPng(deck, 9), { code: 'slide-out-of-range' });

// toPdf: one PDF of a deck (every slide or a selection) or of SVG slides.
const pdf = await toPdf(deck, '1,3');
assert.equal(Buffer.from(pdf.subarray(0, 5)).toString('latin1'), '%PDF-');
assert.deepEqual(pdf, await toPdf([all[0], all[2]]), 'a selection draws those slides');
assert.deepEqual(await toPdf(deck, 2), await toPdf(all[1]), 'a slide number gives a one-page PDF');
await assert.rejects(toPdf(all, { raster: 'yes' }), { code: 'invalid-conversion-option' });

// toHtml: the first slide and the titles by default; a selection draws those slides of the presented sequence.
const figures = (html) => (html.match(/<figure /g) ?? []).length;
assert.equal(figures(toHtml(deck)), 1);
assert.match(toHtml(deck), /<nav aria-label="Slides">/);
assert.equal(figures(toHtml(deck, '1-')), 2, 'the hidden slide is not presented');
assert.match(toHtml(deck, 2), /Slide 2 of 2: Three/);
assert.doesNotMatch(toHtml(deck, 2), /<nav /, 'a selection lists no titles');
assert.equal(figures(toHtml(deck, '1-', { includeHidden: true })), 3);
assert.throws(() => toHtml(deck, 3), { code: 'invalid-slide-selection' });

console.log('Slide arguments: toSvg, toPng, toPdf and toHtml take a slide number, a selection or the options second; 0.17 options name their replacement.');
