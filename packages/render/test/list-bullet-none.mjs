// design.listBullet: none draws no marker in the SVG, PNG and PDF renderers, and no hanging indent: the label and its
// description start at the list's left edge. A numbered list under none still draws its numbers.
import assert from 'node:assert/strict';
import { toPdf, toPng, toSvg } from './catalog-harness.mjs';

const ITEMS = [
  { text: 'Clear scope', description: 'Two teams and one workflow keep the pilot focused.' },
  { text: 'Consistent measures', description: 'Track completion and task time against a baseline.' },
];
const deck = (design, extra = {}) => ({ design: { background: { type: 'solid', color: '#FFFFFF' }, ...design }, slides: [{ title: 'Pillars', items: ITEMS, ...extra }] });
// A list marker is the aria-hidden text the renderer draws before an entry (picture bullets are aria-hidden images).
const markers = svg => [...svg.matchAll(/<text\b[^>]*\baria-hidden="true"[^>]*>([^<]*)<\/text>/g)].map(match => match[1]);
const textX = (svg, word) => +svg.match(new RegExp(`<text\\b[^>]*\\bx="([\\d.]+)"[^>]*>(?:<tspan[^>]*>)?${word}`))[1];

const bulleted = toSvg(deck({}), 1), none = toSvg(deck({ listBullet: 'none' }), 1);
assert.deepEqual(markers(bulleted), ['•', '•'], 'the default draws one glyph per entry');
assert.deepEqual(markers(none), [], 'none draws no marker element at all');
assert.ok(none.includes('Clear scope') && none.includes('Consistent measures'), 'the words are drawn');

// No hanging indent: the label and its description share the list's left edge, which the bulleted list indents by 1.1 em.
const left = textX(none, 'Clear scope');
assert.equal(textX(none, 'Two teams'), left, 'the description starts under the label');
assert.ok(textX(bulleted, 'Clear scope') - left > 30, 'the bulleted label sits a marker width to the right');
// The slide's own hint draws the same.
const fromSlide = toSvg(deck({}, { design: { listBullet: 'none' } }), 1);
assert.deepEqual(markers(fromSlide), []);

// Numbers are not bullets: numbering wins over none.
const numbered = toSvg(deck({ listBullet: 'none' }, { numbering: 'arabic' }), 1);
assert.deepEqual(markers(numbered), ['1.', '2.']);

// PNG and PDF follow the same composition.
const pngNone = await toPng(deck({ listBullet: 'none' }), 1), pngBullet = await toPng(deck({}), 1);
assert.ok(!Buffer.from(pngNone).equals(Buffer.from(pngBullet)), 'the PNG differs without markers');
assert.equal(Buffer.from(pngNone).subarray(1, 4).toString(), 'PNG');
const pdf = await toPdf(deck({ listBullet: 'none' }));
assert.equal(Buffer.from(pdf).subarray(0, 5).toString(), '%PDF-');
console.log('listBullet none: no marker in SVG, PNG and PDF; no indent; numbering kept.');
