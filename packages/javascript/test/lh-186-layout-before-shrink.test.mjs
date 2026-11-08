// LH-186: the layout changes before the text gets smaller. A body block more than one step of the type scale under its role size tries the
// arrangements that keep text larger (a long list in columns, a layout template as LH-83's automatic grid) under the guarded rule
// `layout-first`, kept only when they add no finding, set no block smaller and set the shrunk block at least one step larger.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gallery } from '@openpresentation/gallery';
import { composeSlide } from '../dist/composition.js';

const words = (count) => Array.from({ length: count }, (_, index) => ['growth', 'revenue', 'customers', 'market', 'platform', 'strategy', 'quarter', 'team'][index % 8]).join(' ');
const HEADINGS = new Set(['title', 'subtitle', 'tag']);
const body = (result) => result.items.filter((item) => !HEADINGS.has(item.field));
const smallest = (result) => Math.min(...body(result).map((item) => item.text.fontSize));
const findings = (result) => result.diagnostics.map((entry) => entry.code).sort();
const longList = { title: 'Ten points', items: Array.from({ length: 10 }, (_, index) => `Point ${index + 1}: ${words(12)}`) };
const agenda = (count) => ({ title: 'Workstreams to align before the budget cycle', blocks: Array.from({ length: count }, (_, index) => ({ items: Array.from({ length: 6 }, (_, item) => `Workstream ${index + 1}, step ${item + 1}: agree the owner and the first readout`) })) });

test('LH-186: a long list set more than one step under its role size takes the columns that set it larger', () => {
  const plain = composeSlide(longList, { fill: false }), result = composeSlide(longList);
  const [list] = body(result);
  assert.equal(body(plain)[0].listColumns, undefined, 'one column with the rule off');
  assert.equal(body(plain)[0].text.fontSize, 21, 'one column sets it at 21 px, under the 30 px step below its 32 px role');
  assert.equal(list.listColumns?.length, 2, 'two columns');
  assert.equal(list.text.fontSize, 26, 'two steps larger');
  assert.deepEqual(findings(result), findings(plain), 'no new finding');
  assert.deepEqual(composeSlide(longList), result, 'deterministic');
  // Every entry is drawn once, in order, across the columns.
  assert.deepEqual(list.listColumns.flatMap((column) => Array.from({ length: column.end - column.start }, (_, index) => column.start + index)), longList.items.map((_, index) => index));
});

test('LH-186: a layout template more than one step under its role size is recomposed as the automatic grid', () => {
  const record = gallery.layouts['agenda-split'];
  const kept = composeSlide(agenda(2), { layout: record, recompose: false }), result = composeSlide(agenda(2), { layout: record });
  assert.equal(smallest(kept), 18, 'the layout sets the two lists at 18 px, above the floor');
  assert.ok(result.recomposed, 'recomposed');
  assert.equal(result.regions, undefined);
  assert.ok(smallest(result) >= 20, `at least one step larger (${smallest(result)})`);
  assert.equal(result.recomposed.layoutSize, 18);
  assert.equal(result.recomposed.size, smallest(result));
  assert.deepEqual(findings(result), findings(kept), 'no new finding');
  // Sibling lists keep one size (LH-43).
  assert.equal(new Set(body(result).map((item) => item.text.fontSize)).size, 1);
  assert.equal(composeSlide(agenda(2), { layout: record, fill: false }).recomposed, undefined, 'fill: false keeps the layout');
});

test('LH-186: where no arrangement sets the text larger, the slide keeps the composition it had', () => {
  // A 14-item list fits at 24 px in one column; two columns would set it at 23 px, three at 20 px.
  const list = { title: 'Fourteen points', items: Array.from({ length: 14 }, (_, index) => `Point ${index + 1}: ${words(10)}`) };
  assert.deepEqual(composeSlide(list), composeSlide(list, { fill: false }));
  assert.equal(body(composeSlide(list))[0].listColumns, undefined);
  // A long paragraph and a long table have no arrangement that holds them larger on an automatic slide.
  const prose = { title: 'Prose', text: words(160) };
  assert.equal(body(composeSlide(prose))[0].text.fontSize, 26);
  const table = { title: 'Table', table: { columns: ['A', 'B', 'C', 'D'], rows: Array.from({ length: 14 }, (_, index) => [`r${index}`, words(3), words(4), String(index * 100)]) } };
  assert.deepEqual(body(composeSlide(table)).map((item) => item.box), body(composeSlide(table, { fill: false })).map((item) => item.box));
});

test('LH-186: explicit author choices are kept', () => {
  // A payload's own count, one column included.
  assert.equal(body(composeSlide({ ...longList, columns: 1 }))[0].listColumns, undefined, 'columns: 1');
  assert.equal(body(composeSlide({ ...longList, columns: 3 }))[0].listColumns.length, 3, 'columns: 3');
  // A run size of the author's.
  const sized = { title: 'Ten points', items: longList.items.map((text) => [{ text, fontSize: 21 }]) };
  assert.equal(body(composeSlide(sized))[0].listColumns, undefined, 'a run size');
  // A short list (LH-42) and a list beside another list (LH-43 shares their size) stay in one column.
  const short = { title: 'Six points', items: longList.items.slice(0, 6) };
  assert.equal(body(composeSlide(short))[0].listColumns, undefined, 'six entries');
  const pair = { title: 'Two lists', blocks: [{ items: longList.items }, { items: longList.items }] };
  assert.ok(body(composeSlide(pair)).every((item) => item.listColumns === undefined), 'sibling lists');
  // A block pinned to a region keeps the layout.
  const pinned = agenda(2);
  pinned.blocks[0].region = 'items';
  assert.equal(composeSlide(pinned, { layout: gallery.layouts['agenda-split'] }).recomposed, undefined, 'a pinned block');
});
