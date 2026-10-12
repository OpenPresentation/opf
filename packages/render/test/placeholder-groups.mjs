// RR-83: explicit nested content groups and automatic design.chartPrimary. The preview draws
// every authored leaf in the box core composition gives it, and
// the traced SVG puts each text, list, metric and chart where the item box says. test/fixtures/placeholder-groups.opf.json is
// core's docs/fixtures/placeholder-groups.opf.json (self-contained: catalogs.custom, "default": false); core's
// scripts/test-placeholder-groups-ecosystem.mjs checks the same fixture against the PPTX exporter.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolveSlideContext } from '@openpresentation/opf';
import { composeSlide } from '@openpresentation/opf/composition';
import { toSvg, resolvePresentation } from '../dist/svg.js';

const deck = JSON.parse(readFileSync(new URL('./fixtures/placeholder-groups.opf.json', import.meta.url), 'utf8'));
const attr = (tag, name) => tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1];
const headings = new Set(['tag', 'title', 'subtitle']);
// The SVG writes coordinates to three decimals.
const near = (a, b) => Math.abs(a - b) < 0.001 + 1e-9;

// The first traced element of a leaf that carries a box: a text group's data-opf-box-*, a chart's frame rectangle, or the
// value part of a metric (which starts at the box and spans its width).
function tracedBox(svg, path) {
  for (const match of svg.matchAll(/<(g|rect)\b[^>]*>/g)) {
    const tag = match[0], trace = attr(tag, 'data-opf-path');
    if (trace !== path && trace !== `${path}.value`) continue;
    if (attr(tag, 'data-opf-box-x') !== undefined) return Object.fromEntries(['x', 'y', 'width'].map((key) => [key, Number(attr(tag, `data-opf-box-${key}`))]));
    if (match[1] === 'rect' && attr(tag, 'width') !== undefined) return Object.fromEntries(['x', 'y', 'width'].map((key) => [key, Number(attr(tag, key))]));
  }
  return undefined;
}

const resolved = resolvePresentation(deck);
let leaves = 0;
for (const [index, slide] of deck.slides.entries()) {
  const geometry = composeSlide(slide, resolveSlideContext(deck, index).options);
  const drawn = resolved.slides[index].geometry;
  assert.deepEqual(drawn.items.map((item) => [item.path, item.box]), geometry.items.map((item) => [item.path, item.box]), `${slide.id}: the renderer composes like core`);
  assert.equal(drawn.slots, undefined, `${slide.id}: no removed v1 slots`);
  const svg = toSvg(deck, index + 1, { trace: true });
  for (const item of drawn.items.filter((entry) => !headings.has(entry.field))) {
    if (item.field === 'items') {
      // A list draws one traced group per entry; the first entry's first line starts at the box top.
      const first = svg.match(new RegExp(`data-opf-path="${item.path.replaceAll('.', '\\.')}\\.0"[^>]*data-opf-rich-lines="([^"]*)"`));
      assert.ok(first, `${slide.id} ${item.path}: traced entries`);
      const [line] = JSON.parse(first[1].replaceAll('&quot;', '"'));
      assert.ok(near(line.y, item.box.y) && line.x >= item.box.x && line.x < item.box.x + item.box.width, `${slide.id} ${item.path}: first line inside the box`);
    } else {
      const box = tracedBox(svg, item.path);
      assert.ok(box, `${slide.id} ${item.path}: traced box`);
      for (const key of ['x', 'y', 'width']) assert.ok(near(box[key], item.box[key]), `${slide.id} ${item.path}: ${key} ${box[key]} vs ${item.box[key]}`);
    }
    leaves++;
  }
}
assert.equal(leaves, 33, "every authored nested content leaf survives");

// The nested example: the two texts stack in the group's column on the left, the chart fills the right track.
const example = resolved.slides[0].geometry;
const [first, second, chart] = example.items.filter((item) => !headings.has(item.field));
assert.equal(first.box.x, second.box.x);
assert.ok(second.box.y > first.box.y && chart.box.x > first.box.x + first.box.width);
// Automatic chartPrimary retains the same accepted direct-group behavior on every side.
for (const side of ['left', 'right', 'top', 'bottom']) {
  const index = deck.slides.findIndex(entry => entry.id === `chart-primary-${side}`);
  const geometry = resolved.slides[index].geometry;
  const chartItem = geometry.items.find(item => item.field === 'chart');
  const body = geometry.items.filter(item => !headings.has(item.field) && item.field !== 'chart');
  assert.ok(chartItem && body.length === 2, `${side}: chart and both authored body leaves`);
  for (const item of body) {
    if (side === 'left') assert.ok(chartItem.box.x + chartItem.box.width <= item.box.x + 0.001, side);
    if (side === 'right') assert.ok(item.box.x + item.box.width <= chartItem.box.x + 0.001, side);
    if (side === 'top') assert.ok(chartItem.box.y + chartItem.box.height <= item.box.y + 0.001, side);
    if (side === 'bottom') assert.ok(item.box.y + item.box.height <= chartItem.box.y + 0.001, side);
  }
}

console.log(`placeholder groups: ${leaves} leaves of ${deck.slides.length} slides drawn in their composed boxes; automatic chartPrimary preserves its direct group arrangement`);
