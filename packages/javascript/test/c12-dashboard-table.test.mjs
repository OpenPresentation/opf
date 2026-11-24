// C12 (0.35.2): a dashboard's short table under its row of metrics grows (LH-48 with TAB-1) while the body covers under three quarters of
// its height; the metrics keep their size.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gallery } from '@openpresentation/gallery';
import { composeSlide } from '../dist/composition.js';
import { resolveSlideContext } from '../dist/index.js';

const compose = (slide, extra = {}) => {
  const document = { $schema: 'https://openpresentation.org/schema/opf/v1', language: 'en-US', design: { background: 'light1' }, slides: [slide] };
  const context = resolveSlideContext(document, 0, { catalogs: [gallery] });
  return composeSlide(context.slide, { ...context.options, ...extra });
};
const metrics = [{ metric: { value: '52', label: 'Trial participants' } }, { metric: { value: '84%', label: 'Task completion' } }, { metric: { value: '6.2', label: 'Median task time' } }];
const table = { columns: ['Team', 'Participants', 'Completion'], rows: [['A', '28', '89%'], ['B', '24', '79%']] };

test('a dashboard table of two rows under three metrics grows and stays with them; the metrics keep their size', () => {
  const slide = { layout: 'dashboard', title: 'Pilot at a glance', blocks: [...metrics, { table }] };
  const result = compose(slide), kept = compose(slide, { fill: false });
  assert.equal(result.diagnostics.filter((entry) => entry.code === 'text-overflow').length, 0);
  assert.ok(result.items.find((item) => item.field === 'table').tableGrowth > 1, 'the table grew');
  const values = (composed) => composed.items.filter((item) => item.field === 'metric').map((item) => item.text.fontSize);
  assert.deepEqual(values(result), values(kept));
  // One group: the table follows the metrics one gap down (each row hugs its blocks), not at the foot of its own row.
  const metricBottom = Math.max(...result.items.filter((item) => item.field === 'metric').map((item) => item.box.y + item.box.height));
  const placed = result.items.find((item) => item.field === 'table');
  assert.ok(placed.box.y - metricBottom >= 0 && placed.box.y - metricBottom <= 40, `gap ${placed.box.y - metricBottom}`);
});
