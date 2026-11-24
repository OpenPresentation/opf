// MX1: a matrix of other than four entries keeps the matrix's look: its cards in the matrix's paint with their entries centered, in the
// grid whose cards are nearest MATRIX_CARD_ASPECT at the text size (not three wide strips with a letter at their top left).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gallery } from '@openpresentation/gallery';
import { composeSlide } from '../dist/composition.js';
import { resolveSlideContext } from '../dist/index.js';

const compose = (slide) => { const context = resolveSlideContext({ slides: [slide] }, 0, { catalogs: [gallery] }); return composeSlide(context.slide, context.options); };

for (const items of [['A', 'B', 'C'], ['A', 'B', 'C', 'D', 'E', 'F']]) {
  test(`MX1: ${items.length} entries are a grid of the matrix's cards`, () => {
    const result = compose({ layout: 'matrix', title: 'Four ways to run the pilot', blocks: [{ region: 'body', items }] });
    const [cards] = result.arrangements;
    assert.deepEqual([cards.design, cards.paint, cards.align, cards.text], ['cards', 'primary', 'center', 'node']);
    const rows = new Set(cards.nodes.map((node) => Math.round(node.box.y))).size;
    assert.ok(rows < items.length, 'not one column of strips');
    for (const node of cards.nodes) assert.ok(node.box.width / node.box.height < 3, `card ${node.box.width} x ${node.box.height}`);
    // Each entry in the middle of its card.
    const list = result.items.find((item) => item.field === 'items');
    for (const [index, column] of list.listColumns.entries()) {
      const node = cards.nodes[index], middle = node.box.y + node.box.height / 2;
      assert.ok(Math.abs(column.box.y + column.box.height / 2 - middle) < 2);
    }
  });
}
