// FA-26: layout records with nested placeholder groups, and design.chartPrimary as the group it stands for. The preview draws
// every leaf in the box core composition gives it: the renderer composes through the record's groups (geometry.slots), and
// the traced SVG puts each text, list, metric and chart where the item box says. test/fixtures/placeholder-groups.opf.json is
// core's docs/fixtures/placeholder-groups.opf.json (self-contained: catalogs.custom, "default": false); core's
// scripts/test-placeholder-groups-ecosystem.mjs checks the same fixture against the PPTX exporter.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolveSlideContext } from '@openpresentation/opf';
import { chartPrimaryLayout, composeSlide } from '@openpresentation/opf/composition';
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
  assert.deepEqual(drawn.slots, geometry.slots, `${slide.id}: slots`);
  if (slide.layout) assert.ok(drawn.slots?.length, `${slide.id}: composes through the record's placeholder groups`);
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
assert.ok(leaves >= 30, `${leaves} leaves`);

// The nested example: the two texts stack in the group's column on the left, the chart fills the right track.
const example = resolved.slides[0].geometry;
const [first, second, chart] = example.items.filter((item) => !headings.has(item.field));
assert.equal(first.box.x, second.box.x);
assert.ok(second.box.y > first.box.y && chart.box.x > first.box.x + first.box.width);
assert.deepEqual(example.slots.map((slot) => slot.path), ['layout.placeholders.1', 'layout.placeholders.1.placeholders.0', 'layout.placeholders.1.placeholders.1', 'layout.placeholders.2']);

// chartPrimary draws exactly the record it is sugar for.
for (const side of ['left', 'right', 'top', 'bottom']) {
  const index = deck.slides.findIndex((entry) => entry.id === `chart-primary-${side}`);
  const slide = deck.slides[index], [chartBlock, ...rest] = slide.blocks;
  const blocks = side === 'left' || side === 'top' ? [chartBlock, ...rest] : [...rest, chartBlock];
  const layout = chartPrimaryLayout(side, ['text', 'list']);
  const explicit = resolvePresentation({ ...deck, catalogs: { default: false, custom: { layouts: { sugar: { name: 'Sugar', placeholders: [{ type: 'title' }, ...layout.placeholders], composition: layout.composition } } } }, slides: [{ id: 'explicit', layout: 'sugar', title: slide.title, blocks }] }).slides[0].geometry;
  const byField = (geometry) => Object.fromEntries(geometry.items.map((item) => [item.field, item.box]));
  assert.deepEqual(byField(explicit), byField(resolved.slides[index].geometry), side);
}

console.log(`placeholder groups: ${leaves} leaves of ${deck.slides.length} slides drawn in their composed boxes; chartPrimary draws the group it stands for`);
