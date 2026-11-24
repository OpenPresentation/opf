// opf#1412 (A3): the blocks of a column beside the slide's chart sit in the middle of their column.
// - LH-49's chart track: a short text beside the chart takes the height it needs in the middle of its column, and a stack of blocks is
//   centered as one group.
// - A group beside the slide's one chart in a root row: its blocks stack as one group in the middle of their cell.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { composeSlide } from '../dist/composition.js';

const chart = (type = 'column') => ({ chart: { type, alt: 'Two regions.', data: { columns: ['Region', 'Revenue'], rows: [['North', 42], ['South', 31]] } } });
const table = { table: { columns: ['Region', 'Revenue'], rows: [['North', '$4.2M'], ['South', '$3.1M']] } };
const middle = (box) => box.y + box.height / 2;
const bodyMiddle = (result) => middle(result.contentBox);
const of = (result, field) => result.items.filter((item) => item.field === field);

for (const type of ['column', 'line']) {
  test(`a short text beside a ${type} chart's track sits in the middle of its column`, () => {
    const result = composeSlide({ title: 'Text and chart', blocks: [{ text: 'Ship the pilot in March.' }, chart(type)] });
    assert.equal(result.track?.kind, 'chart', 'the chart takes its track');
    const [text] = of(result, 'text').filter((item) => item.path.includes('blocks'));
    assert.ok(text.box.height < result.contentBox.height / 3, 'the text takes the height it needs');
    assert.ok(Math.abs(middle(text.box) - bodyMiddle(result)) < 2, 'in the middle of the body');
  });
}

test('a text and a list beside a chart track stack as one group in the middle of their column', () => {
  const result = composeSlide({ title: 'Stack and chart', blocks: [{ text: 'Ship the pilot in March.' }, { items: ['Faster reviews', 'Fewer handoffs'] }, chart()] });
  assert.equal(result.track?.kind, 'chart');
  const [text] = of(result, 'text').filter((item) => item.path.includes('blocks')), [list] = of(result, 'items');
  assert.ok(Math.abs((text.box.y + list.box.y + list.box.height) / 2 - bodyMiddle(result)) < 2);
});

test('a group beside the chart in a root row stacks in the middle of its cell', () => {
  const result = composeSlide({ title: 'Group', composition: { mode: 'row', weights: [3, 2] }, blocks: [chart(), { blocks: [{ text: 'Ship the pilot in March.' }, { items: ['Faster reviews', 'Fewer handoffs'] }] }] });
  const [text] = of(result, 'text').filter((item) => item.path.includes('blocks')), [list] = of(result, 'items');
  assert.ok(text.box.y < list.box.y, 'the text stays above the list');
  const top = text.box.y, bottom = list.box.y + list.box.height;
  assert.ok(Math.abs((top + bottom) / 2 - bodyMiddle(result)) < 2, 'the stack is centered as one group');
  assert.ok(list.box.y - (text.box.y + text.box.height) < result.contentBox.height / 6, 'its blocks stay together');
});

