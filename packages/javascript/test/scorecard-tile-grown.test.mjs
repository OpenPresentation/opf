// SCO-1: LH-68 metric tiles fill their cards, and the figure grows into the tile: it asks for METRIC_TILE_VALUE_SHARE of the tile (up to
// three times its role size) and stands in the middle of the room between the label and the row's foot, the tallest description of the
// row, so the values of a row share one line however long each tile's target is. No tile keeps an empty middle under its figure.
// (A unit that has to stack under its figure keeps clear of the row foot, so that tile may stand higher.)
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { composeSlide } from '../dist/composition.js';

const record = { id: 'tiles', name: 'Tiles', design: { contentBox: true }, direction: 'column', anchor: 'middle', regions: [{ name: 'title' }, { name: 'body', accepts: ['metric', 'text'], flow: 'grid', metrics: 'tile' }] };
const tiles = [
  { metric: { value: '84%', label: 'Task completion', description: 'Target: at least 80% across every team in the pilot, measured weekly by the analytics lead and reviewed with sponsors' } },
  { metric: { value: 52, label: 'Trial participants' } },
  { metric: { value: '6.2', label: 'Median task time', description: 'Target' } },
];
const part = (item, role) => item.metricLayout.parts.find((entry) => entry.role === role);
const line = (item) => part(item, 'value').box.y + part(item, 'value').box.height / 2;

test('SCO-1: tiles fill their cards; the values grow and share one line between the labels and the row foot', () => {
  const result = composeSlide({ title: 'Uneven', blocks: tiles }, { width: 1280, height: 720, layout: record });
  assert.deepEqual(result.diagnostics.filter((entry) => entry.code === 'text-overflow'), []);
  const items = result.items.filter((item) => item.metricTile), body = result.regions.find((region) => region.name === 'body').box;
  assert.equal(items.length, 3);
  for (const item of items) {
    assert.ok(item.frameBox.height > body.height * 0.9, `${item.path}: the tile fills its cell`);
    assert.ok(part(item, 'value').fit.fontSize > 152, `${item.path}: the figure grows past twice its role size (${part(item, 'value').fit.fontSize})`);
    const description = part(item, 'description');
    if (description?.fit) assert.ok(description.box.y > part(item, 'value').box.y + part(item, 'value').box.height, `${item.path}: the target stays under the figure`);
  }
  assert.ok(Math.max(...items.map(line)) - Math.min(...items.map(line)) < 1, `the values share one line (${items.map(line).map(Math.round)})`);
  const value = part(items[1], 'value').box, label = part(items[1], 'label').box;
  assert.ok(value.y - (label.y + label.height) > 24, 'the figure no longer sits right under its label over an empty middle');
});

test('SCO-1: a text among tiles keeps its card and the tiles still share one value line', () => {
  const result = composeSlide({ title: 'Mixed', blocks: [tiles[0], { text: 'Keep the scope narrow and give each decision a named owner.' }, tiles[2]] }, { width: 1280, height: 720, layout: record });
  const items = result.items.filter((item) => item.metricTile);
  assert.equal(items.length, 2);
  assert.ok(Math.abs(line(items[0]) - line(items[1])) < 1, 'the two values share one line');
});

test('SCO-1 with LH-53: a grown figure keeps its unit beside it at the unit share, never smaller than before the figure grew', () => {
  const withUnit = tiles.map((tile, index) => (index === 2 ? { metric: { ...tile.metric, unit: 'min', value: '6.2' } } : tile));
  const result = composeSlide({ title: 'Units', blocks: withUnit }, { width: 1280, height: 720, layout: record });
  const item = result.items.filter((entry) => entry.metricTile)[2], value = part(item, 'value'), unit = part(item, 'unit');
  assert.ok(unit.box.x > value.box.x + value.box.width - 1, 'the unit stands beside the figure');
  assert.ok(unit.fit.fontSize >= 0.6 * value.fit.fontSize - 2, `the unit at the unit share (${unit.fit.fontSize} beside ${value.fit.fontSize})`);
  assert.ok(unit.fit.fontSize >= 68 - 1e-6, `never under the 68 px the unit had before the figure grew (${unit.fit.fontSize})`);
  assert.ok(value.fit.fontSize > 113.09, `the figure still grows (${value.fit.fontSize})`);
});
