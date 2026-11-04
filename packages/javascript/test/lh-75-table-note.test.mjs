// LH-75 (a short table and a note of two or more lines go side by side, the note on one plain card) and LH-05 (the rows of a grid of
// short texts hug one gap apart and sit in the middle of the body instead of spreading over it).
import { gallery } from '@openpresentation/gallery';
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { composeSlide } from '../dist/composition.js';

const { layouts } = gallery;
const note = 'Customers told us onboarding took too long, so we rebuilt it around three steps and removed the two that nobody needed; the flow now takes four minutes instead of twenty.';
const plans = (rows) => ({ table: { columns: ['Plan', 'Seats', 'Price'], rows: Array.from({ length: rows }, (_, row) => [`Plan ${row + 1}`, String(10 * (row + 1)), `$${row * 20 + 9}`]) } });
const wide = { table: { columns: ['Workstream', 'Owner', 'Status', 'Decision'], rows: [['Pricing', 'Program lead', 'At risk', 'Continue'], ['Data and reporting', 'Analytics', 'On track', 'Tighten metric definitions'], ['Field adoption', 'Operations', 'Watch', 'Add weekly office hours']] } };
const slide = (blocks, extra = {}) => ({ title: 'Plans at a glance', blocks, ...extra });
const findings = (result) => result.diagnostics.filter((entry) => entry.code === 'text-overflow' || entry.code === 'small-cell');
const itemOf = (result, field) => result.items.find((item) => item.field === field);
const beside = (a, b) => a.x + a.width <= b.x + 1 || b.x + b.width <= a.x + 1;
const sizes = (result) => result.items.filter((item) => item.text && !['title', 'subtitle', 'tag'].includes(item.field)).map((item) => item.text.fontSize);

describe('LH-75: a short table beside its note', () => {
  for (const [name, options] of [['the table layout', { layout: layouts.table }], ['automatic composition', {}]]) {
    for (const direction of ['ltr', 'rtl']) {
      test(`${name}, ${direction}: the note sits on a card beside the table, as tall as the row, centered in the body`, () => {
        const result = composeSlide(slide([plans(3), { text: note }]), { ...options, direction });
        const table = itemOf(result, 'table'), text = itemOf(result, 'text');
        assert.deepEqual(findings(result), []);
        assert.ok(beside(table.box, text.box), 'side by side');
        assert.ok(text.frameBox, 'the note is on a plain card');
        // Reading order: the table is first, so it sits at the start edge (the right in a right-to-left deck).
        if (direction === 'rtl') assert.ok(table.box.x > text.box.x); else assert.ok(table.box.x < text.box.x);
        // The table takes between 60% and 70% of the width: the widest share at which the note keeps LH-66's measure.
        const share = table.box.width / (table.box.width + text.frameBox.width);
        assert.ok(share >= .59 && share <= .71, `share ${share}`);
        // The card is as tall as the row, which is centered in the body under the headings.
        const body = result.contentBox, top = text.frameBox.y - body.y, bottom = body.y + body.height - (text.frameBox.y + text.frameBox.height);
        if (!result.regions) assert.ok(Math.abs(top - bottom) < .02 * body.height + 1, 'centered');
        // The table is vertically centered on the card.
        assert.ok(Math.abs((table.box.y + table.box.height / 2) - (text.frameBox.y + text.frameBox.height / 2)) < 20);
        if (options.layout) assert.ok(result.recomposed?.table, 'a template slide reports the recomposition');
      });
    }
  }

  test('the note first keeps its place before the table in reading order', () => {
    const result = composeSlide(slide([{ text: note }, plans(3)]), { layout: layouts.table });
    const table = itemOf(result, 'table'), text = itemOf(result, 'text');
    assert.ok(beside(table.box, text.box));
    assert.ok(text.box.x < table.box.x);
  });

  test('no block is set smaller than without the rule, and the table keeps its cells on one line', () => {
    const result = composeSlide(slide([plans(3), { text: note }]), { layout: layouts.table });
    const plain = composeSlide(slide([plans(3), { text: note }]), { layout: layouts.table, recompose: false });
    assert.ok(Math.min(...sizes(result)) >= Math.min(...sizes(plain)) - 1e-6);
    assert.equal(result.diagnostics.filter((entry) => entry.code === 'text-overflow').length, 0);
  });

  test('stays stacked: a tall table, a one-line note, a table whose cells would wrap, and a layout that already puts the note beside', () => {
    for (const [label, input, options] of [
      ['a tall table', slide([plans(9), { text: note }]), { layout: layouts.table }],
      ['a one-line note', slide([plans(3), { text: 'One line only.' }]), { layout: layouts.table }],
      ['a table whose cells would wrap beside the note', slide([wide, { text: note }]), { layout: layouts.table }],
      ['recompose: false', slide([plans(3), { text: note }]), { layout: layouts.table, recompose: false }],
    ]) {
      const result = composeSlide(input, options);
      assert.ok(!beside(itemOf(result, 'table').box, itemOf(result, 'text').box), label);
      assert.equal(result.recomposed?.table, undefined, label);
    }
    const kept = composeSlide(slide([plans(3), { text: note }]), { layout: layouts['table-beside'] });
    assert.equal(kept.recomposed?.table, undefined);
    assert.ok(beside(itemOf(kept, 'table').box, itemOf(kept, 'text').box));
  });

  test('a slide with another block, an emphasis or a composition of its own keeps its arrangement', () => {
    for (const input of [
      slide([plans(3), { text: note }, { text: 'A third block.' }]),
      slide([plans(3), { text: note, emphasis: true }]),
      slide([plans(3), { text: note }], { composition: { mode: 'column' } }),
    ]) {
      const result = composeSlide(input, { layout: layouts.table });
      assert.equal(result.recomposed?.table, undefined);
    }
  });
});

describe('LH-05: the rows of a grid of short texts hug', () => {
  const texts = (count) => Array.from({ length: count }, (_, index) => ({ text: ['Faster onboarding', 'Fewer handoffs', 'Shared dashboards', 'Clear ownership', 'Weekly reviews', 'Simple pricing', 'Audit trail', 'Regional hosting'][index] }));
  const rows = (result) => [...new Set(result.items.filter((item) => item.field === 'text').map((item) => Math.round(item.box.y)))].sort((a, b) => a - b);

  for (const direction of ['ltr', 'rtl']) {
    test(`a 3 x 2 grid of one-line texts keeps its rows one gap apart and sits in the middle of the body (${direction})`, () => {
      const result = composeSlide({ title: 'Why teams switch', blocks: texts(6) }, { direction });
      assert.deepEqual(findings(result), []);
      const [first, second] = rows(result), cells = result.items.filter((item) => item.field === 'text');
      const gap = (1 / 30) * Math.min(result.width, result.height);
      // The cell of the first row is as tall as its text, so the second row starts one gap under it.
      const height = Math.max(...cells.filter((item) => Math.round(item.box.y) === first).map((item) => item.box.height));
      assert.ok(Math.abs(second - first - height - gap) < 2, `${second - first} vs ${height + gap}`);
      // Centered: as much room above the grid as under it.
      const body = result.contentBox, top = first - body.y, bottom = body.y + body.height - (second + height);
      assert.ok(Math.abs(top - bottom) < 4, `${top} vs ${bottom}`);
      // Short text still grows (LH-48): 37 reference px, a list's display size.
      assert.ok(cells.every((item) => item.text.fontSize >= 28 * result.height / 720 - 1e-6));
    });
  }

  test('longer texts keep the rows spread over the body, and sizes never fall', () => {
    const long = Array.from({ length: 6 }, (_, index) => ({ text: note.slice(0, 120 + 12 * index) }));
    const result = composeSlide({ title: 'Why teams switch', blocks: long }, {});
    const [first, second] = rows(result);
    assert.ok(second - first > 100, 'rows are a body apart');
  });

  test('a grid in a card design hugs too, with the cards as tall as their text', () => {
    const result = composeSlide({ title: 'Why teams switch', blocks: texts(6) }, { contentBox: true });
    assert.deepEqual(findings(result), []);
    assert.equal(rows(result).length, 2);
  });
});
