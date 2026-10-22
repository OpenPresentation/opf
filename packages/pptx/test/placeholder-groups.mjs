// FA-26: layout records with nested placeholder groups, and design.chartPrimary as the group it stands for. The export places
// every leaf in the box core composition gives it, within 0.5 pt: a chart's graphic frame is the box, and the shapes of a
// text, list or metric start at the box and stay inside it. The record (groups included) survives an unchanged round trip.
// test/fixtures/placeholder-groups.opf.json is core's docs/fixtures/placeholder-groups.opf.json (self-contained:
// catalogs.custom, "default": false); core's scripts/test-placeholder-groups-ecosystem.mjs checks it against the renderer too.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { unzipSync } from 'fflate';
import { resolveSlideContext } from '@openpresentation/opf';
import { composeSlide } from '@openpresentation/opf/composition';
import { fromPptx, toPptx } from '../dist/index.js';

const TOLERANCE_PT = 0.5;
const deck = JSON.parse(readFileSync(new URL('./fixtures/placeholder-groups.opf.json', import.meta.url), 'utf8'));
const headings = new Set(['tag', 'title', 'subtitle']);
const pt = (px) => (px * 72) / 96;
const close = (a, b) => Math.abs(a - b) <= TOLERANCE_PT;

function frames(xml) {
  const found = [];
  for (const match of xml.matchAll(/<p:(sp|graphicFrame|pic)>([\s\S]*?)<\/p:\1>/g)) {
    const name = match[2].match(/<p:cNvPr\b[^>]*\bname="([^"]*)"/)?.[1] ?? '';
    const off = match[2].match(/<a:off x="(-?\d+)" y="(-?\d+)"\/>\s*<a:ext cx="(\d+)" cy="(\d+)"/);
    if (off) found.push({ kind: match[1], name, box: { x: +off[1] / 12700, y: +off[2] / 12700, width: +off[3] / 12700, height: +off[4] / 12700 } });
  }
  return found;
}

const bytes = await toPptx(deck);
const entries = unzipSync(bytes);
let leaves = 0;
for (const [index, slide] of deck.slides.entries()) {
  const geometry = composeSlide(slide, resolveSlideContext(deck, index).options);
  assert.ok(geometry.items.length, `${slide.id}: explicit nested content groups retain their composed leaves`);
  const shapes = frames(new TextDecoder().decode(entries[`ppt/slides/slide${index + 1}.xml`]));
  for (const item of geometry.items.filter((entry) => !headings.has(entry.field))) {
    const box = Object.fromEntries(Object.entries(item.box).map(([key, value]) => [key, pt(value)]));
    const where = `${slide.id} ${item.path}`;
    if (item.field === 'chart') {
      assert.ok(shapes.some((shape) => shape.kind === 'graphicFrame' && ['x', 'y', 'width', 'height'].every((key) => close(shape.box[key], box[key]))), `${where}: chart frame`);
    } else {
      // Text and list shapes carry their OPF path in the name; a metric's value and label shapes are named by kind.
      const named = shapes.filter((shape) => shape.name.includes(item.path));
      const own = named.length ? named : shapes.filter((shape) => shape.name.startsWith(`OPF ${item.field} `) && close(shape.box.x, box.x) && shape.box.y >= box.y - TOLERANCE_PT && shape.box.y < box.y + box.height);
      assert.ok(own.length, `${where}: shapes`);
      assert.ok(close(Math.min(...own.map((shape) => shape.box.x)), box.x), `${where}: x`);
      assert.ok(close(Math.min(...own.map((shape) => shape.box.y)), box.y), `${where}: y`);
      for (const shape of own) assert.ok(shape.box.x + shape.box.width <= box.x + box.width + TOLERANCE_PT && shape.box.y + shape.box.height <= box.y + box.height + TOLERANCE_PT, `${where}: inside the box`);
    }
    leaves++;
  }
}
assert.ok(leaves >= 30, `${leaves} leaves`);

// The document's own records travel with the deck: the groups come back unchanged, and every slide keeps its layout.
const imported = await fromPptx(bytes);
assert.deepEqual(imported.catalogs, deck.catalogs);
assert.deepEqual(imported.slides.map((slide) => slide.layout), deck.slides.map((slide) => slide.layout));

console.log(`placeholder groups: ${leaves} leaves of ${deck.slides.length} slides exported in their composed boxes (within ${TOLERANCE_PT} pt); the records round-trip`);
