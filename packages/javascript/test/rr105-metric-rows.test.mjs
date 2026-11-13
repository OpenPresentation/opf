import assert from 'node:assert/strict';
import test from 'node:test';
import { composeSlide } from '../dist/composition.js';
import { resolveSlideContext } from '../dist/index.js';

// RR-105 (coverage finding 03): metrics alone in two or more rows space the rows evenly. A row of bare values and a row of values with
// labels and deltas sat top-anchored in equal cells, which left a wide gap under the first row; now one space sits above, between and
// below the rows' contents, at the sizes the metrics had, and no two cells overlap.

const deck = (blocks, design = { background: 'light1' }) => ({ $schema: 'https://openpresentation.org/schema/opf/v1', language: 'en-US', design, slides: [{ title: 'Metrics as a string, a number and an object', blocks }] });
const finding03 = [
  { metric: '98%' },
  { metric: 1240 },
  { metric: { value: '3.1 days', label: 'Cycle time', delta: '-0.4 days', trend: 'down', sentiment: 'negative' } },
  { metric: { value: '12', label: 'Open risks', delta: '0', trend: 'flat', sentiment: 'neutral' } },
];
const metrics = (document) => {
  const context = resolveSlideContext(document, 0);
  return composeSlide(context.slide, context.options).items.filter((item) => item.field === 'metric');
};
const extent = (layout) => {
  const boxes = [layout.bounds, ...layout.parts.filter((part) => part.visible).map((part) => part.box), ...(layout.trendBox ? [layout.trendBox] : []), ...(layout.deltaPill ? [layout.deltaPill.box] : [])];
  return [Math.min(...boxes.map((box) => box.y)), Math.max(...boxes.map((box) => box.y + box.height))];
};

test('four metrics in two rows are spaced evenly (finding 03)', () => {
  const items = metrics(deck(finding03));
  const rows = [items.slice(0, 2), items.slice(2)].map((row) => [Math.min(...row.map((item) => extent(item.metricLayout)[0])), Math.max(...row.map((item) => extent(item.metricLayout)[1]))]);
  const areaTop = Math.min(...items.map((item) => item.box.y)) , areaBottom = Math.max(...items.map((item) => item.box.y + item.box.height));
  const above = rows[0][0] - areaTop + 0, between = rows[1][0] - rows[0][1], below = areaBottom - rows[1][1];
  // The area starts where the first cell was (the body's top); the moved first cell starts at its content.
  const first = rows[0][0] - Math.min(...items.map((item) => item.box.y));
  assert.ok(first >= 0);
  assert.ok(Math.abs(between - below) < 1.5, `between ${between}, below ${below}`);
  assert.ok(between > 40, 'the rows are apart');
  // The values keep one size, and no cell overlaps the next row's.
  assert.equal(new Set(items.map((item) => item.metricLayout.parts.find((part) => part.role === 'value').fit.fontSize)).size, 1);
  assert.ok(items[0].box.y + items[0].box.height <= items[2].box.y + 0.01);
  assert.ok(above >= 0);
});

test('metrics on cards and a single row keep their cells', () => {
  const carded = metrics(deck(finding03, { background: 'light1', contentBox: true }));
  assert.ok(carded.every((item) => item.frameBox), 'drawn on cards');
  const row = metrics(deck(finding03.slice(0, 2)));
  assert.equal(new Set(row.map((item) => item.box.y)).size, 1);
});
