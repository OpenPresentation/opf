// opf#1412 (A2): a block in a cell that runs the body's full height (`start`, `center+end`) sits in the middle of it: a block shorter than
// the column takes the height it needs there, instead of the top of the column over an empty foot, on a slide whose cells are all
// full-height columns. Beside cells of their own rows a full-height block keeps the top (reading order). A slide that draws cards keeps them.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { composeSlide } from '../dist/composition.js';

const pie = { type: 'pie', alt: 'Two regions.', data: { columns: ['Region', 'Revenue'], rows: [['North', 42], ['South', 31]] } };
const line = { ...pie, type: 'line' };
const table = { columns: ['Region', 'Revenue'], rows: [['North', '$4.2M'], ['South', '$3.1M']] };
const paragraph = 'The pilot cut review time by a third, so we can widen it to two more sites this quarter.';
const block = (result, index) => result.items.find((item) => item.path.startsWith(`slides.0.blocks.${index}.`));
const centered = (result, box) => Math.abs(box.y + box.height / 2 - (result.contentBox.y + result.contentBox.height / 2)) < 2;

for (const direction of ['ltr', 'rtl']) {
  test(`a pie in start and a paragraph in center+end sit in the middle of their columns (${direction})`, () => {
    const result = composeSlide({ title: 'Pie and text', blocks: [{ region: 'start', chart: pie }, { region: 'center+end', text: paragraph }] }, { direction });
    const text = block(result, 1);
    assert.ok(text.box.height < result.contentBox.height / 2, 'the paragraph takes the height it needs');
    assert.ok(centered(result, text.box), 'in the middle of its column');
    assert.ok(centered(result, block(result, 0).box), 'the pie too');
  });
}

test('a table in a sidebar beside a chart sits in the middle of its column', () => {
  const result = composeSlide({ title: 'Sidebar', blocks: [{ region: 'start', table }, { region: 'center+end', chart: line }] });
  const sidebar = block(result, 0);
  assert.ok(sidebar.box.height < result.contentBox.height / 2 && centered(result, sidebar.box));
});

test('beside cells of their own rows a full-height block keeps the top, so the slide reads in its composed order', () => {
  const result = composeSlide({ title: 'Start beside two spans', blocks: [{ region: 'start', text: 'Ship the pilot in March.' }, { region: 'top:center+end', text: paragraph }, { region: 'bottom:center+end', table }] });
  assert.ok(Math.abs(block(result, 0).box.y - result.contentBox.y) < 1, 'the start text keeps the top of its column');
  assert.ok(Math.abs(block(result, 1).box.y - result.contentBox.y) < 1, 'the top span keeps the top of the body');
});

test('a quote in a full-height cell beside a chart keeps its card', () => {
  const chart = { type: 'column', alt: 'Two regions.', data: { columns: ['Region', 'Revenue'], rows: [['North', 42], ['South', 31]] } };
  const result = composeSlide({ title: 'Chart and quote', blocks: [{ region: 'start+center', chart }, { region: 'end', quote: { text: 'The weekly review keeps the next step clear.', attribution: 'Product lead' } }] });
  const quote = block(result, 1);
  assert.ok(quote.frameBox && quote.box.width < quote.frameBox.width, 'drawn on its card, inset from it');
  const card = quote.frameBox, body = result.contentBox;
  assert.ok(Math.abs(card.y + card.height / 2 - (body.y + body.height / 2)) < body.height / 20, 'about the middle of its cell (the card hugs its text)');
});

test('full-height cells of paragraphs and lists only keep LH-102 band and growth', () => {
  const result = composeSlide({ title: 'Start and end', blocks: [{ region: 'start', text: 'Ship the pilot in March.' }, { region: 'end', items: ['Faster reviews', 'Fewer handoffs'] }] });
  const text = block(result, 0), list = block(result, 1);
  assert.ok(Math.abs(text.box.y - list.box.y) < 1, 'one band: the two share their top');
});
