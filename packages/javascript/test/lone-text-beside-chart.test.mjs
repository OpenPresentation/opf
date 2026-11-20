import assert from 'node:assert/strict';
import { test } from 'node:test';
import { composeSlide } from '../dist/composition.js';
import { resolveSlideContext } from '../dist/index.js';

// LH-193: a short text alone beside the slide's one chart grows and sits in the middle of its side, as design.chartPrimary drew it in 0.34.
const chart = { chart: { type: 'bar', data: { columns: ['Quarter', 'Revenue'], rows: [['Q1', 3], ['Q2', 5], ['Q3', 8], ['Q4', 6]] } } };
const short = 'Revenue grew in three of four quarters.';
const long = 'Revenue grew in three of four quarters, and the fourth fell back because two large renewals moved into the next year. The trend holds once those are counted where they were signed, and the pipeline for the first half is the largest we have had, with most of it in the two regions we opened last spring.';
const custom = anchor => ({ name: 'Chart and statement', direction: 'column', regions: [{ name: 'title' }, { direction: 'row', regions: [{ name: 'media', accepts: ['chart'], size: 3, max: 1 }, { name: 'body', accepts: ['text'], size: 2, max: 1, ...(anchor ? { anchor } : {}) }] }] });
const compose = (slide, deck = {}) => {
  const document = { ...deck, slides: [slide] };
  return composeSlide(slide, resolveSlideContext(document, 0, {}).options);
};
const textOf = result => result.items.find(item => item.field === 'text');
const chartOf = result => result.items.find(item => item.field === 'chart');
const middle = item => item.box.y + item.box.height / 2;

test('LH-193: a short text alone in its cell of a weighted row beside a chart grows to display size and is centered', () => {
  for (const [name, other] of [['in a group', { blocks: [{ text: short }] }], ['as a block', { text: short }]]) {
    const result = compose({ title: 'Revenue', composition: { mode: 'row', weights: [3, 2] }, blocks: [chart, other] });
    const text = textOf(result), plot = chartOf(result);
    assert.ok(text.text.fontSize >= 56 - 1e-6, `${name}: ${text.text.fontSize}`);
    assert.ok(Math.abs(middle(text) - middle(plot)) < plot.box.height / 8, `${name}: centered beside the chart`);
  }
});

test('LH-193: the chart last, and the chart above or below in a weighted column, grow the text the same way', () => {
  for (const [mode, weights, blocks] of [['row', [2, 3], [{ text: short }, chart]], ['column', [3, 2], [chart, { text: short }]], ['column', [2, 3], [{ text: short }, chart]]]) {
    const result = compose({ title: 'Revenue', composition: { mode, weights }, blocks });
    assert.ok(textOf(result).text.fontSize >= 56 - 1e-6, `${mode} ${weights}: ${textOf(result).text.fontSize}`);
  }
});

test('LH-193: a text alone in a max: 1 layout region beside a chart grows and is centered', () => {
  for (const anchor of ['middle', undefined]) {
    const result = compose({ title: 'Revenue', layout: 'custom:cs', blocks: [chart, { text: short, region: 'body' }] }, { catalogs: { custom: { layouts: { cs: custom(anchor) } } } });
    const text = textOf(result), plot = chartOf(result);
    assert.ok(text.text.fontSize >= 56 - 1e-6, `${anchor}: ${text.text.fontSize}`);
    assert.ok(Math.abs(middle(text) - middle(plot)) < plot.box.height / 8, `${anchor}: centered beside the chart`);
  }
});

test('LH-193: a long text, two texts, an unweighted row and a styled text keep their size', () => {
  const base = { title: 'Revenue', composition: { mode: 'row', weights: [3, 2] } };
  const sizes = blocks => compose({ ...base, blocks }).items.filter(item => item.field === 'text').map(item => item.text.fontSize);
  const longSize = sizes([chart, { text: long }])[0];
  assert.ok(longSize <= 28 + 1e-6, `long: ${longSize}`);
  for (const size of sizes([chart, { blocks: [{ text: short }, { text: long }] }])) assert.ok(size <= 32 + 1e-6, `two texts: ${size}`);
  const row = compose({ title: 'Revenue', composition: { mode: 'row' }, blocks: [chart, { text: short }] });
  assert.ok(textOf(row).text.fontSize <= 32 + 1e-6, `unweighted: ${textOf(row).text.fontSize}`);
  const emphasized = compose({ ...base, blocks: [chart, { blocks: [{ text: short }], emphasis: true }] });
  assert.ok(textOf(emphasized).text.fontSize <= 32 + 1e-6, `emphasis: ${textOf(emphasized).text.fontSize}`);
});

test('LH-193: fill: false keeps the text at its size', () => {
  const slide = { title: 'Revenue', composition: { mode: 'row', weights: [3, 2] }, blocks: [chart, { text: short }] };
  const result = composeSlide(slide, { ...resolveSlideContext({ slides: [slide] }, 0, {}).options, fill: false });
  assert.ok(textOf(result).text.fontSize <= 32 + 1e-6, String(textOf(result).text.fontSize));
});
