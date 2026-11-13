// RR-105 (coverage finding 21): text in a shape never breaks inside a word. A one-word label wider than a small shape's text rectangle
// stays on one line, centered, and may reach past the insets up to the shape's edges (textWrap 'none', textArea that width); a word
// that does not fit even across the shape is the overflow finding; text that fits keeps its layout.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { composeSlide } from '../dist/composition.js';

const triangle = (text, extra = {}) => ({ shape: 'triangle', fill: 'none', stroke: { color: 'dark2', width: 10 }, text, ...extra });
const compose = (blocks) => {
  const deck = { language: 'en-US', slides: [{ title: 'Shapes', composition: { mode: 'grid', columns: 6 }, blocks }] };
  return composeSlide(deck.slides[0], { presentation: deck, slideIndex: 0 });
};
const words = (fit) => fit.lines.flatMap((line) => line.split(/\s+/u).filter(Boolean));

test('a one-word label in a small triangle stays one word, centered on the text rectangle', () => {
  const composed = compose([triangle('Miter'), triangle('Round'), triangle('Bevel'), { shape: 'rect', text: 'Single' }]);
  for (const item of composed.items.filter((entry) => entry.field === 'shape' && entry.shape.preset === 'triangle')) {
    const { shape, text } = item;
    assert.deepEqual(words(text), [text.lines[0].trim()], `${item.path}: one line, no broken word`);
    assert.equal(text.lines.length, 1);
    assert.equal(shape.textWrap, 'none');
    // Wider than the text rectangle, within the shape, on the same center.
    assert.ok(shape.textArea.width > shape.textBox.width);
    assert.ok(shape.textArea.x >= shape.box.x - 0.01 && shape.textArea.x + shape.textArea.width <= shape.box.x + shape.box.width + 0.01);
    assert.ok(Math.abs(shape.textArea.x + shape.textArea.width / 2 - (shape.textBox.x + shape.textBox.width / 2)) < 0.02);
  }
  assert.ok(!composed.diagnostics.some((diagnostic) => diagnostic.code === 'text-overflow'));
  // A shape whose text fits its text rectangle keeps wrapping there.
  const rect = composed.items.find((entry) => entry.shape?.preset === 'rect');
  assert.equal(rect.shape.textWrap, undefined);
});

test('several words wrap at word boundaries; a word too wide even across the shape is an overflow', () => {
  const composed = compose([triangle('Go now'), triangle('Supercalifragilisticexpialidocious'), triangle('A'), triangle('B')]);
  const [two, long] = composed.items.filter((entry) => entry.field === 'shape' && entry.shape.preset === 'triangle');
  assert.deepEqual(words(two.text), ['Go', 'now']);
  assert.ok(composed.diagnostics.some((diagnostic) => diagnostic.code === 'text-overflow' && diagnostic.path === `${long.path.replace(/\.shape$/, '')}.text`), JSON.stringify(composed.diagnostics));
});
