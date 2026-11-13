// RR-105 (coverage finding 21): the preview draws a one-word label wider than a small shape's text rectangle whole, on one line,
// centered on the text rectangle (core's textArea, which reaches past the insets), never broken inside the word ("Mite r").
import assert from 'node:assert/strict';
import { resolveSlideContext } from '@openpresentation/opf';
import { composeSlide } from '@openpresentation/opf/composition';
import { loadFonts } from '../dist/fonts-node.js';
import { toSvg } from '../dist/index.js';

const triangle = (text) => ({ shape: 'triangle', fill: 'none', stroke: { color: 'dark2', width: 10 }, text });
const deck = { language: 'en-US', design: { background: 'light1' }, slides: [{ title: 'Shapes', composition: { mode: 'grid', columns: 6 }, blocks: ['Mitered', 'Rounded', 'Beveled', 'Mitre', 'Arcs', 'Joins'].map(triangle) }] };
const fonts = await loadFonts({ pack: 'office' });
const svg = toSvg(deck, 1, { fonts, trace: true });
const context = resolveSlideContext(deck, 0), composed = composeSlide(context.slide, { ...context.options, textMeasurement: fonts.textMeasurement });
for (const [index, word] of ['Mitered', 'Rounded', 'Beveled'].entries()) {
  assert.ok(new RegExp(`>${word}<`).test(svg), `${word} is drawn whole`);
  const item = composed.items.find((entry) => entry.path === `slides.0.blocks.${index}.shape`);
  assert.equal(item.shape.textWrap, 'none');
  const center = item.shape.textBox.x + item.shape.textBox.width / 2;
  assert.ok(Math.abs(item.shape.textArea.x + item.shape.textArea.width / 2 - center) < 0.02, `${word} is centered on the text rectangle`);
}
for (const piece of ['Mite', 'Roun', 'Beve']) assert.ok(!new RegExp(`>${piece}<`).test(svg), `no broken piece ${piece}`);
console.log('RR-105 shape word split: preview checks passed.');
