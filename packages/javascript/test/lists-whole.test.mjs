import { gallery } from '@openpresentation/gallery';
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { LIST_HEADING_SCALE, LIST_MARKERS, LIST_WHOLE_ENTRIES, composeSlide, fitList, listGridShape } from '../dist/composition.js';

// LH-42, LH-77, LH-85 (layout harvest): lists stay whole. A short list is never dealt across columns, several lists in a region
// are one list per cell in a grid at one shared size whose rows hold descriptions and nested entries, a one-entry described list
// is a heading over its description, and nested markers are glyphs every bundled face has.
const { layouts } = gallery;
const compose = (slide, layout, options = {}) => composeSlide(slide, { layout, ...options });
const lists = (result) => result.items.filter((item) => item.field === 'items' || item.field === 'bullets');
const bottom = (box) => box.y + box.height;
const three = (topic) => [`Agree on the owner for ${topic}.`, 'Confirm the reporting cadence.', 'Return with the first progress readout.'];
const nested = ['Capacity: two regions are at 85% utilization.', { text: 'Churn risk in the legacy tier.', description: 'Mitigation: migration incentives ship in November.' }, { text: 'Vendor SLA renegotiation slips to Q1.', level: 1 }];
const described = { text: 'Decide what to scale', description: 'Compare outcomes with the baseline and agree the next step.' };
// Every drawn line of a list, as boxes: entry text and description (a list in columns draws its columns).
const lineBoxes = (item) => (item.listColumns ? item.listColumns.map((column) => column.text) : [item.text]).flatMap((fit) => fit.listEntries.flatMap((entry) => [entry.textBox, ...(entry.descriptionBox ? [entry.descriptionBox] : [])]));
const overlaps = (a, b) => a.x < b.x + b.width - .5 && b.x < a.x + a.width - .5 && a.y < b.y + b.height - .5 && b.y < a.y + a.height - .5;

describe('LH-42: a list of 6 or fewer entries is never dealt across columns', () => {
  test('a lone short list that overflows one column shrinks instead of splitting', () => {
    const items = Array.from({ length: LIST_WHOLE_ENTRIES }, (_, index) => `Point ${index + 1} explains what the team will measure, report and decide in the coming quarter, and who owns each of those decisions, when they report back to the steering group and what happens when a measure slips.`);
    const [list] = lists(compose({ title: 'Six', items }, layouts.list));
    assert.equal(list.listColumns, undefined);
    assert.ok(list.text.fontSize < 32 && !list.text.overflow, 'it does not fit one column at the starting size, so it shrinks');
    const [longer] = lists(compose({ title: 'Seven', items: [...items, ...items].slice(0, 9) }, layouts.list));
    assert.ok(longer.listColumns?.length >= 2, 'a longer list still flows into columns');
  });

  test('a fixed column count is used as written', () => {
    const [list] = lists(compose({ title: 'Fixed', blocks: [{ items: ['Queue', 'Route', 'Resolve'], columns: 3 }] }, layouts.list));
    assert.equal(list.listColumns.length, 3);
  });
});

describe('LH-42: several lists in a region are one list per cell', () => {
  test('the grid by count: n columns up to 4, 3 for a multiple of 3, otherwise 4; a narrow region fills its rows evenly', () => {
    const shapes = Array.from({ length: 12 }, (_, index) => listGridShape(index + 1).perRow.join('+'));
    assert.deepEqual(shapes, ['1', '2', '3', '4', '4+1', '3+3', '4+3', '4+4', '3+3+3', '4+4+2', '4+4+3', '3+3+3+3']);
    assert.deepEqual(listGridShape(4, 3).perRow, [2, 2]);
    assert.deepEqual(listGridShape(5, 2).perRow, [2, 2, 1]);
  });

  for (const id of ['list', 'agenda', 'faq']) {
    test(`${id}: 7 lists (one nested, one a heading) are 4 + 3 cells at one size, and nothing draws over another list`, () => {
      const blocks = [...['finance', 'human resources', 'operations', 'food security', 'government'].map((topic) => ({ items: three(topic) })), { items: nested }, { items: [described] }];
      const result = compose({ title: 'FY27 Budget Tradeoff', blocks }, layouts[id]);
      const items = lists(result);
      assert.equal(items.length, 7);
      assert.ok(items.every((item) => item.listColumns === undefined), 'no list is dealt across columns');
      assert.deepEqual([...new Set(items.map((item) => Math.round(item.box.y)))].length, 2, 'two rows');
      assert.equal(items.filter((item) => Math.round(item.box.y) === Math.round(items[0].box.y)).length, 4, '4 lists in the first row');
      assert.equal(new Set(items.map((item) => item.text.fontSize)).size, 1, 'one shared size');
      assert.ok(items.every((item) => !item.text.overflow), 'every list fits its cell');
      const regionBox = result.regions.find((entry) => entry.name === items[0].region).box;
      for (const [index, item] of items.entries()) {
        assert.ok(item.text.height <= item.box.height + .5, `${item.path}: the list's height is within its cell`);
        assert.ok(bottom(item.box) <= bottom(regionBox) + .5, `${item.path}: within the region`);
        for (const other of items.slice(index + 1)) {
          assert.ok(!overlaps(item.box, other.box), `${item.path} and ${other.path}: cells do not overlap`);
          for (const line of lineBoxes(item)) for (const otherLine of lineBoxes(other)) assert.ok(!overlaps(line, otherLine), `${item.path} and ${other.path}: no line draws over another list`);
        }
      }
      assert.deepEqual(result.diagnostics.filter((entry) => entry.code === 'text-overflow'), []);
    });
  }

  test('with cards each list is its own card', () => {
    const blocks = ['finance', 'operations', 'government'].map((topic) => ({ items: three(topic) }));
    const items = lists(compose({ title: 'Cards', design: { contentBox: true }, blocks }, layouts.agenda));
    assert.equal(items.length, 3);
    assert.ok(items.every((item) => item.frameBox), 'every list has a card');
    assert.equal(new Set(items.map((item) => Math.round(item.frameBox.y))).size, 1, 'one row of cards');
  });

  test('a region that mixes lists with other blocks keeps its flow', () => {
    const result = compose({ title: 'Mixed', blocks: [{ items: three('finance') }, { text: 'Owners report every week.' }, { items: three('operations') }] }, layouts.agenda);
    assert.notEqual(result.regions.find((entry) => entry.name === 'items').arrangement, 'grid');
  });
});

describe('LH-77: a one-entry described list is a heading over its description', () => {
  test('bold, one step up, no marker, the description at the list size', () => {
    const [item] = lists(compose({ title: 'Heading', blocks: [{ items: [described] }, { items: three('finance') }] }, layouts.list));
    const [entry] = item.text.listEntries;
    assert.equal(entry.heading, true);
    assert.equal(entry.marker.none, true);
    assert.equal(entry.marker.text, '');
    const fragments = entry.text.richLines.flatMap((line) => line.fragments);
    assert.ok(fragments.every((fragment) => fragment.style.fontWeight === 700), 'the heading is bold');
    assert.ok(Math.abs(entry.text.fontSize - item.text.fontSize * LIST_HEADING_SCALE) < .02, 'one size step above the list size');
    assert.ok(Math.abs(entry.description.fontSize - item.text.fontSize) < .02, 'the description at the list size');
    assert.ok(entry.descriptionBox.y >= entry.textBox.y + entry.textBox.height, 'the description sits under the heading');
    assert.equal(entry.textBox.x, item.box.x, 'no indent');
  });

  test('a numbered list, a list of two and fitList without the option keep their markers', () => {
    const box = { x: 0, y: 0, width: 600, height: 400 };
    const style = { style: { fontFamily: 'sans-serif', fontWeight: 400 } };
    assert.equal(fitList([described], box, 32, 16, style).listEntries[0].heading, undefined);
    assert.equal(fitList([described], box, 32, 16, { ...style, heading: true, numbering: 'arabic' }).listEntries[0].heading, undefined);
    assert.ok(fitList([described, described], box, 32, 16, { ...style, heading: true }).listEntries.every((entry) => !entry.heading && entry.marker.text === '•'));
  });
});

describe('LH-85: nested markers are glyphs every bundled face has', () => {
  test('levels 0 to 3 draw •, –, • and –, at the entry size', () => {
    const fit = fitList(['One', { text: 'Two', level: 1 }, { text: 'Three', level: 2 }, { text: 'Four', level: 3 }], { x: 0, y: 0, width: 600, height: 400 }, 32, 16, { style: { fontFamily: 'sans-serif', fontWeight: 400 } });
    assert.deepEqual(fit.listEntries.map((entry) => entry.marker.text), ['•', '–', '•', '–']);
    assert.ok(fit.listEntries.every((entry) => entry.marker.fontSize === fit.fontSize));
    assert.deepEqual(LIST_MARKERS, ['•', '–']);
  });
});
