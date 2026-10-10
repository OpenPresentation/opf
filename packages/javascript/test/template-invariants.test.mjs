import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { paginate } from '../dist/index.js';
import { composeSlide, regionAccepts } from '../dist/composition.js';
import { allocateRows } from '../dist/composition.js';
import { layouts, sampleSlide } from './support/template-samples.mjs';

// OPF 0.19 (RR-79, RR-81 review): composed content never overlaps the heading areas or another region and never leaves
// its own region's box; when content does not fit, the design's tools apply in order (fit down to minFontSize, list
// columns, the overflow region and a continuation slide on the same layout, then the diagnostic).
const tolerance = 0.5;
const inside = (a, b) => a.x >= b.x - tolerance && a.y >= b.y - tolerance && a.x + a.width <= b.x + b.width + tolerance && a.y + a.height <= b.y + b.height + tolerance;
const meet = (a, b) => a.x < b.x + b.width - tolerance && a.x + a.width > b.x + tolerance && a.y < b.y + b.height - tolerance && a.y + a.height > b.y + tolerance;
const HEADINGS = new Set(['title', 'subtitle', 'tag']);
const cases = Object.entries(layouts).flatMap(([id, record]) => ['short', 'long'].flatMap((size) => [1, 2, 3, 4, 5, 6].map((count) => ({ key: `${id} ${count} ${size}`, id, record, slide: sampleSlide(record, count, size) }))));

describe('geometry invariants over the 28 templates x 1 to 6 short and long blocks', () => {
  test('no item crosses a heading or another region, and every item lies inside its region', () => {
    const problems = [];
    for (const { key, record, slide } of cases) {
      const result = composeSlide(slide, { layout: record });
      const headings = result.items.filter((item) => HEADINGS.has(item.field));
      const title = result.headingAreas.find((area) => !area.collapsed);
      for (const heading of headings) if (title && !inside(heading.box, title.box) && !inside(heading.box, result.headingAreas.find((area) => area.name === 'subtitle')?.box ?? title.box)) problems.push(`${key}: ${heading.field} leaves its area`);
      for (const item of result.items) {
        if (HEADINGS.has(item.field)) continue;
        const box = item.frameBox ?? item.box, own = result.regions.find((region) => region.name === item.region);
        // A bled region reaches the slide edge; its items stay inside the region's own (bled) box.
        if (own && !inside(box, own.box)) problems.push(`${key}: ${item.path} leaves ${own.name}`);
        for (const heading of headings) if (meet(box, heading.box)) problems.push(`${key}: ${item.path} crosses the ${heading.field}`);
        for (const region of result.regions) if (region.name !== item.region && !region.collapsed && meet(box, region.box)) problems.push(`${key}: ${item.path} crosses ${region.name}`);
        for (const column of item.listColumns ?? []) if (!inside(column.box, box)) problems.push(`${key}: a list column of ${item.path} leaves its cell`);
      }
      for (const [index, region] of result.regions.entries()) {
        if (region.collapsed || !region.content.length) continue;
        assert.ok(region.box.height > 0 && region.box.width > 0, `${key}: ${region.name} holds content but has no room`);
        for (const other of result.regions.slice(index + 1)) if (!other.collapsed && other.content.length && meet(region.box, other.box)) problems.push(`${key}: ${region.name} crosses ${other.name}`);
      }
    }
    assert.deepEqual(problems, []);
  });

  test('pagination resolves what does not fit: every page fits, on the same layout', () => {
    const left = [];
    for (const { key, id, record, slide } of cases) {
      const { presentation } = paginate({ catalogs: { custom: { layouts: { [id]: record } } }, slides: [{ layout: id, ...slide }] });
      for (const page of presentation.slides) {
        assert.equal(page.layout, id, key);
        const result = composeSlide(page, { layout: record });
        for (const entry of result.diagnostics) {
          if (entry.code === 'text-overflow') left.push(`${key}: ${entry.path}`);
          // A block no region of the layout accepts is drawn below the grid on every page; any other is moved.
          if (entry.code === 'layout-unplaced') {
            const block = page.blocks[Number(entry.path.split('.').pop())];
            if (entry.region !== undefined || result.regions.some((region) => regionAccepts(region, block))) left.push(`${key}: ${entry.path} unplaced`);
          }
        }
      }
    }
    assert.deepEqual(left, []);
  });
});

describe('row allocation', () => {
  test('auto rows never squeeze a numeric row with content to nothing', () => {
    // comparison with long content: a title row, the two columns, a verdict and the implicit row below the grid.
    const heights = allocateRows([{ size: 'auto', need: 132, kind: 'heading' }, { size: 1, need: 153, kind: 'body' }, { size: 'auto', need: 92, kind: 'body' }, { size: 'auto', need: 300, kind: 'below' }], 605, 24);
    assert.equal(heights[0], 132);
    assert.ok(heights[1] >= 153 - 1e-6, 'the numeric row keeps what it needs');
    assert.ok(heights[2] > 0 && heights[3] > 0);
    assert.ok(Math.abs(heights.reduce((a, b) => a + b, 0) + 3 * 24 - 605) < 1e-6, 'the rows fill the content box');
    // With room to spare nothing changes: auto rows take their need, numeric rows the rest.
    assert.deepEqual(allocateRows([{ size: 'auto', need: 60, kind: 'heading' }, { size: 1, need: 100, kind: 'body' }], 600, 20), [60, 520]);
  });

  test('the implicit row below the grid may take more than half the content box', () => {
    const heights = allocateRows([{ size: 1, need: 132, kind: 'heading' }, { size: 'auto', need: 500, kind: 'below' }], 605, 24);
    assert.ok(heights[1] > 605 / 2);
    assert.ok(heights[0] >= 132 - 1e-6);
  });
});
