import assert from 'node:assert/strict';
import { test } from 'node:test';
import { composeSlide } from '../dist/composition.js';
import { examples } from '../dist/examples.js';
import { resolveSlideContext } from '../dist/index.js';

// A card insets a sixteenth of its shorter side, between 12 and 24 px: a tall card gets the roomy 24 px, and a small KPI card keeps
// the room its metric needs. With a fixed 24 px inset the KPI of this gallery deck had no room for its value (layout harvest).
test('a small KPI card keeps its metric whole', () => {
  const { deck } = examples.find((entry) => entry.file.endsWith('library-modernization-roadmap.opf.json'));
  const { slide, options } = resolveSlideContext(deck, 5);
  const result = composeSlide(slide, options);
  assert.deepEqual(result.diagnostics, []);
  const metric = result.items.find((item) => item.field === 'metric');
  assert.ok(metric.frameBox && metric.box.x - metric.frameBox.x < 24, 'a small card insets less than 24 px');
});

test('a tall card insets 24 px', () => {
  const result = composeSlide({ title: 'T', blocks: [{ text: 'A' }, { text: 'B' }] }, { contentBox: true });
  for (const item of result.items.filter((entry) => entry.frameBox)) assert.ok(Math.abs(item.box.x - item.frameBox.x - 24) < 1e-3);
});
