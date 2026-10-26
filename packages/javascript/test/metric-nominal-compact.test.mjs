import { gallery } from '@openpresentation/gallery';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { composeSlide, layoutMetric } from '../dist/composition.js';

// WI-1 (P26): a metric value asks for its 76 px role size whatever its box; the box only limits it. It used to ask for
// min(76, 28% of the box height), which turned 76 px into 46.27 px in a compact (auto) region.
const { layouts } = gallery;
const statement = structuredClone(layouts.statement);
const message = statement.regions.find((region) => region.name === 'message');
message.size = 'auto';

test('a metric in an auto region keeps 76 px', () => {
  const result = composeSlide({ title: 'Adoption doubled', metric: { value: '2x', label: 'Weekly active teams' } }, { layout: statement });
  const metric = result.items.find((item) => item.field === 'metric');
  assert.equal(metric.metricLayout.parts.find((part) => part.role === 'value').fit.fontSize, 76);
  assert.deepEqual(result.diagnostics, []);
});

test('the value keeps 76 px in a box that holds it, at any box height', () => {
  for (const height of [140, 300, 600]) {
    const layout = layoutMetric({ value: '98%', label: 'Uptime' }, { x: 0, y: 0, width: 400, height });
    assert.equal(layout.parts[0].fit.fontSize, 76, `height ${height}`);
  }
});

test('a genuinely small box still fits the value down, with no diagnostics', () => {
  const layout = layoutMetric({ value: '98%', label: 'Uptime' }, { x: 0, y: 0, width: 400, height: 90 });
  assert.ok(layout.parts[0].fit.fontSize < 76);
  assert.deepEqual(layout.diagnostics, []);
});
