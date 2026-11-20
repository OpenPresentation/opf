import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveSlideContext } from '../dist/index.js';
import { composeSlide } from '../dist/composition.js';

const compose = composition => {
  const doc = { slides: [{ id: 'stack', title: 'A stack', ...(composition ? { composition } : {}),
    blocks: Array.from({ length: 4 }, (_, i) => ({ id: 'b'.concat(i), text: 'Short line '.concat(i + 1) })) }] };
  const { slide, options } = resolveSlideContext(doc, 0);
  return { doc, geometry: composeSlide(slide, options) };
};
const body = geometry => geometry.items.filter(item => item.field === 'text');
const unique = (items, key) => new Set(items.map(item => item.box[key])).size;
const values = ['Short line 1', 'Short line 2', 'Short line 3', 'Short line 4'];
function assertFrames(geometry, mode) {
  const items = body(geometry), flow = geometry.flows.find(entry => entry.path === 'slides.0');
  assert.equal(items.length, 4);
  assert.deepEqual(items.map(item => item.value), values);
  for (let i = 0; i < items.length; i++) {
    const row = flow.rows[mode === 'row' ? 0 : i], column = flow.columns[mode === 'row' ? i : 0];
    const item = items[i], x = flow.box.x + column.offset, y = flow.box.y + row.offset;
    assert.ok(item.box.x >= x - 1e-5 && item.box.x + item.box.width <= x + column.size + 1e-5, 'displayed item fits its reported column');
    assert.ok(item.box.y >= y - 1e-5 && item.box.y + item.box.height <= y + row.size + 1e-5, 'displayed item fits its reported row');
    assert.equal(item.text.fontSize, 56, 'the existing display size fits this authored layout');
    assert.equal(item.text.overflow, false);
  }
}

test('explicit COLUMN and ROW keep the schema-defined single vertical/horizontal track', () => {
  for (const [mode, fixed, changing] of [['column', 'x', 'y'], ['row', 'y', 'x']]) {
    const { geometry } = compose({ mode });
    assert.equal(unique(body(geometry), fixed), 1, mode.concat(' never retiles across its fixed axis'));
    assert.equal(unique(body(geometry), changing), 4);
    assertFrames(geometry, mode);
  }
});

test('explicit grid/automatic column counts and weights remain authoritative at fitting display size', () => {
  for (const composition of [{ mode: 'grid', columns: 1 }, { mode: 'auto', columns: 1 }, { mode: 'column', weights: [1, 1, 1, 1] }]) {
    const { geometry } = compose(composition);
    assert.equal(unique(body(geometry), 'x'), 1, JSON.stringify(composition));
    assert.equal(unique(body(geometry), 'y'), 4);
    assertFrames(geometry, 'column');
  }
});

test('unconstrained implicit/explicit AUTO keeps the existing readable tile grid', () => {
  for (const composition of [undefined, { mode: 'auto' }]) {
    const { geometry } = compose(composition);
    assert.equal(unique(body(geometry), 'x'), 2);
    assert.equal(unique(body(geometry), 'y'), 2);
    assert.equal(geometry.steps.filter(step => step.form === 'tiles').length, 1);
    assert.ok(body(geometry).every(item => item.text.fontSize === 56 && !item.text.overflow));
    assert.deepEqual(body(geometry).map(item => item.value), values);
  }
});

test('authored column flow frames contain every actual displayed item', () => {
  const { geometry } = compose({ mode: 'column' });
  assert.equal(geometry.flows.find(flow => flow.path === 'slides.0').rows.length, 4);
  assertFrames(geometry, 'column');
});
