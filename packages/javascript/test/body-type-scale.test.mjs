import { gallery } from '@openpresentation/gallery';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { composeSlide, fitText, fitRichText, LIST_NOMINAL_SIZE, PROSE_NOMINAL_SIZE, TABLE_NOMINAL_SIZE } from '../dist/composition.js';

// WI-4 (P16, owner decision D2): body prose asks for 28 px (21 pt), up from 25 px; list items stay at 32 px; a table keeps its
// 25 px data role. Every size fits down to the readability floor (16 px by default), and an explicit run size wins.
const { layouts } = gallery;
const columns = { name: 'Three columns', direction: 'column', regions: [{ name: 'title' }, { direction: 'row', regions: ['first', 'second', 'third'].map((name) => ({ name, accepts: ['text', 'list'], role: 'primary', flow: 'none' })) }] };
const words = (count) => Array.from({ length: count }, (_, index) => `word${index % 7}`).join(' ');

test('the role sizes: prose 28 px, lists 32 px, tables 25 px', () => {
  assert.deepEqual([PROSE_NOMINAL_SIZE, LIST_NOMINAL_SIZE, TABLE_NOMINAL_SIZE], [28, 32, 25]);
  // The shared fitters ask for the prose size by default.
  const box = { x: 0, y: 0, width: 4000, height: 400 };
  assert.equal(fitText('Short prose.', box).fontSize, 28);
  assert.equal(fitRichText(['Short ', { text: 'prose.', bold: true }], box).fontSize, 28);
});

test('prose and lists on a slide request their role sizes; the subtitle follows the prose size', () => {
  const text = composeSlide({ title: 'Prose', subtitle: 'A subtitle', blocks: [{ text: 'Test with two teams for six weeks.' }, { text: 'Keep the scope narrow.' }] }, { layout: layouts.text });
  assert.deepEqual(text.items.filter((item) => item.field === 'text').map((item) => item.text.fontSize), [28, 28]);
  assert.equal(text.items.find((item) => item.field === 'subtitle').text.fontSize, 28);
  const list = composeSlide({ title: 'List', items: ['Close the audit gaps', 'Pilot with two teams', 'Report every week'] }, { layout: layouts.list });
  assert.equal(list.items.find((item) => item.field === 'items').text.fontSize, 32);
  const table = composeSlide({ title: 'Table', table: { columns: ['Plan', 'Seats'], rows: [['A', '10'], ['B', '20']] } }, { layout: layouts.table });
  const tableItem = table.items.find((item) => item.field === 'table');
  assert.ok(tableItem && !(tableItem.text?.fontSize > 25), 'the table keeps its own data size');
});

test('dense three-column prose fits down together without overflow', () => {
  const blocks = ['first', 'second', 'third'].map((region, index) => ({ region, text: words(80 + index * 30) }));
  const result = composeSlide({ title: 'Dense prose', blocks }, { layout: columns });
  const sizes = result.items.filter((item) => item.field === 'text').map((item) => item.text.fontSize);
  assert.equal(new Set(sizes).size, 1, `peers share one size: ${sizes}`);
  assert.ok(sizes[0] < 28 && sizes[0] >= 16, `fitted down from 28 px: ${sizes[0]}`);
  assert.deepEqual(result.diagnostics, []);
});

test('a size the author wrote wins over the role size', () => {
  const result = composeSlide({ title: 'Explicit', blocks: [{ text: [{ text: 'Large ', fontSize: 30 }, { text: 'and plain' }] }, { text: 'Second paragraph.' }] }, { layout: layouts.text });
  const item = result.items.find((entry) => entry.field === 'text');
  const sizes = new Set(item.text.richLines.flatMap((line) => line.fragments.map((fragment) => fragment.fontSize)));
  assert.ok(sizes.has(40), `30 pt is 40 px: ${[...sizes]}`);
  assert.ok(sizes.has(28), `the plain run takes the prose size: ${[...sizes]}`);
});

test('a lower floor does not raise the size, a higher floor does', () => {
  const low = composeSlide({ title: 'Floor', text: 'Short.', composition: { minFontSize: 20 } }, { layout: layouts.text });
  assert.equal(low.items.find((item) => item.field === 'text').text.fontSize >= 28, true);
  const high = composeSlide({ title: 'Floor', text: 'Short.', composition: { minFontSize: 30 } }, { layout: layouts.text });
  assert.ok(high.items.find((item) => item.field === 'text').text.fontSize >= 30);
});
