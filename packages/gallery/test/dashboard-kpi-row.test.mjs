// C05: the dashboard's KPI row is one row of metrics above the charts: four or five metrics side by side (not 2 x 2, which set them at
// the floor and gave the slide to LH-83's automatic grid, with the fourth metric alone beside the charts), and one or two metrics
// centered in their cells as three are, at their display size. The charts keep the full width below.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveSlideContext } from '@openpresentation/opf';
import { composeSlide } from '@openpresentation/opf/composition';
import { gallery } from '../dist/index.js';

const metric = (value, label) => ({ metric: { value, label, description: 'Illustrative six-week pilot' } });
const chart = { chart: { type: 'column', title: 'Task completion by week', data: { columns: ['Week', 'Completion'], rows: [['1', 0.68], ['2', 0.72], ['3', 0.84]] } } };
const metrics = [metric(52, 'Trial participants'), metric('84%', 'Task completion'), metric('6.2', 'Median task time'), metric(4, 'Weeks'), metric(2, 'Teams')];
const compose = (count) => {
  const deck = { slides: [{ layout: 'dashboard', title: 'Pilot at a glance', blocks: [...metrics.slice(0, count), chart, chart] }] };
  const context = resolveSlideContext(deck, 0, { catalogs: [gallery] });
  return composeSlide(context.slide ?? deck.slides[0], context.options);
};

test('dashboard: the KPI row region flows as a row', () => assert.equal(gallery.layouts.dashboard.regions.find((region) => region.name === 'lead').flow, 'row'));
for (const count of [1, 2, 3, 4, 5]) {
  test(`dashboard: ${count} metric(s) stand in one centered row over two full-width charts`, () => {
    const result = compose(count);
    assert.equal(result.recomposed, undefined, 'the layout is kept');
    const figures = result.items.filter((item) => item.field === 'metric'), charts = result.items.filter((item) => item.field === 'chart');
    assert.equal(new Set(figures.map((item) => Math.round(item.box.y))).size, 1, 'one row of metrics');
    assert.ok(Math.max(...figures.map((item) => item.box.y + item.box.height)) <= Math.min(...charts.map((item) => item.box.y)), 'the metrics stand over the charts');
    assert.equal(new Set(charts.map((item) => Math.round(item.box.y))).size, 1, 'the charts share a row');
    assert.ok(charts.every((item) => item.box.width > 0.45 * result.contentBox.width), 'the charts keep half the width each');
    for (const item of figures) assert.notEqual(item.metricLayout.alignment, 'left', `${item.path}: centered as three are`);
  });
}
