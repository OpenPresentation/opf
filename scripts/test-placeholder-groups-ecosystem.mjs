// FA-26 cross-engine check (the 0.15 design's Nesting test): layout records with nested placeholder groups, and
// design.chartPrimary as the group it stands for, place every leaf in the same box in core composition, the coordinated
// renderer's SVG and the exporter's native shapes, within 0.5 pt. docs/fixtures/placeholder-groups.opf.json is
// self-contained (catalogs.custom, "default": false), so no host catalog is registered. It checks the shared geometry
// contract, not PowerPoint raster parity. The editor's check of the same fixture is opf-editor's test/placeholder-groups.mjs.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolveSlideContext, validate } from '../packages/javascript/dist/index.js';
import { composeSlide } from '../packages/javascript/dist/composition.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const renderDir = path.resolve(process.env.OPF_RENDER_DIR ?? path.join(root, '../opf-render'));
const pptxDir = path.resolve(process.env.OPF_PPTX_DIR ?? path.join(root, '../opf-pptx'));
const { renderSlideSvg, resolvePresentation } = await import(pathToFileURL(path.join(renderDir, 'dist/index.js')));
const { toPptx } = await import(pathToFileURL(path.join(pptxDir, 'dist/index.js')));
const { unzipSync } = createRequire(path.join(pptxDir, 'package.json'))('fflate');

const TOLERANCE_PT = 0.5;
const pt = (px) => (px * 72) / 96;
const emuToPt = (emu) => emu / 12700;
const close = (a, b) => Math.abs(a - b) <= TOLERANCE_PT;
const attr = (tag, name) => tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1];

const deck = JSON.parse(await readFile(new URL('../docs/fixtures/placeholder-groups.opf.json', import.meta.url), 'utf8'));
assert.equal(validate(deck).findings.filter((entry) => entry.severity === 'error').length, 0, 'the fixture validates with no host catalog');

const entries = unzipSync(await toPptx(deck));
const resolved = resolvePresentation(deck);

// Native frames: a text payload is one shape per line, named after its OPF path; a chart is one graphic frame.
function nativeFrames(xml) {
  const frames = [];
  for (const match of xml.matchAll(/<p:(sp|graphicFrame|pic)>([\s\S]*?)<\/p:\1>/g)) {
    const name = match[2].match(/<p:cNvPr\b[^>]*\bname="([^"]*)"/)?.[1] ?? '';
    const off = match[2].match(/<a:off x="(-?\d+)" y="(-?\d+)"\/>\s*<a:ext cx="(\d+)" cy="(\d+)"/);
    if (off) frames.push({ kind: match[1], name, box: { x: emuToPt(+off[1]), y: emuToPt(+off[2]), width: emuToPt(+off[3]), height: emuToPt(+off[4]) } });
  }
  return frames;
}
// Where the SVG draws a leaf: the traced box of its text group or its frame rectangle (`exact`), else the extent of its
// traced parts (a metric's value and label, a list's entry lines), which must start at the box top and stay inside it.
function svgBox(svg, itemPath) {
  const parts = [];
  for (const match of svg.matchAll(/<(g|rect)\b[^>]*>/g)) {
    const tag = match[0], tracePath = attr(tag, 'data-opf-path');
    const box = attr(tag, 'data-opf-box-x') !== undefined ? Object.fromEntries(['x', 'y', 'width', 'height'].map((key) => [key, pt(Number(attr(tag, `data-opf-box-${key}`)))]))
      : match[1] === 'rect' && attr(tag, 'width') !== undefined ? Object.fromEntries(['x', 'y', 'width', 'height'].map((key) => [key, pt(Number(attr(tag, key)))])) : undefined;
    if (box && tracePath === itemPath) return { ...box, exact: true };
    if (!tracePath?.startsWith(`${itemPath}.`)) continue;
    if (box && attr(tag, 'data-opf-metric-role')) parts.push(box);
    const lines = attr(tag, 'data-opf-rich-lines'), width = attr(tag, 'data-opf-box-width');
    if (lines && width) for (const line of JSON.parse(lines.replaceAll('&quot;', '"'))) parts.push({ x: pt(line.x), y: pt(line.y), width: 0, height: pt(line.height) });
  }
  if (!parts.length) return undefined;
  const x = Math.min(...parts.map((box) => box.x)), y = Math.min(...parts.map((box) => box.y));
  return { x, y, width: Math.max(...parts.map((box) => box.x + box.width)) - x, height: Math.max(...parts.map((box) => box.y + box.height)) - y, exact: false };
}

let leaves = 0;
for (const [index, slide] of deck.slides.entries()) {
  const geometry = composeSlide(slide, resolveSlideContext(deck, index).options);
  const rendered = resolved.slides[index].geometry;
  const svg = renderSlideSvg(deck, index, { trace: true });
  const frames = nativeFrames(new TextDecoder().decode(entries[`ppt/slides/slide${index + 1}.xml`]));
  const body = geometry.items.filter((item) => !['tag', 'title', 'subtitle'].includes(item.field));
  assert.ok(body.length > 0, slide.id);
  if (slide.layout) assert.ok(geometry.slots?.length, `${slide.id}: composes through the record's groups`);
  // The renderer draws from the same composition.
  assert.deepEqual(rendered.items.map((item) => [item.path, item.box]), geometry.items.map((item) => [item.path, item.box]), `${slide.id}: renderer geometry`);
  assert.deepEqual(rendered.slots ?? null, geometry.slots ?? null, `${slide.id}: renderer slots`);
  for (const item of body) {
    const box = Object.fromEntries(Object.entries(item.box).map(([key, value]) => [key, pt(value)]));
    const where = `${slide.id} ${item.path}`;
    // Preview: the traced SVG box.
    const drawn = svgBox(svg, item.path);
    assert.ok(drawn, `${where}: SVG trace`);
    if (drawn.exact) for (const key of ['x', 'y', 'width']) assert.ok(close(drawn[key], box[key]), `${where}: SVG ${key} ${drawn[key]} vs ${box[key]}`);
    else {
      assert.ok(close(drawn.y, box.y), `${where}: SVG parts start at the box top`);
      assert.ok(drawn.x >= box.x - TOLERANCE_PT && drawn.x + drawn.width <= box.x + box.width + TOLERANCE_PT, `${where}: SVG parts inside the box`);
    }
    // PPTX: the chart's frame is the box; a text payload's lines start at the box and stay inside it.
    if (item.field === 'chart') {
      assert.ok(frames.some((frame) => frame.kind === 'graphicFrame' && ['x', 'y', 'width', 'height'].every((key) => close(frame.box[key], box[key]))), `${where}: native chart frame`);
    } else {
      // Text shapes carry their OPF path in the name; a metric's value and label shapes carry the payload kind only, so they
      // are the metric shapes that start at the box.
      const named = frames.filter((frame) => frame.name.includes(item.path));
      const own = named.length ? named : frames.filter((frame) => frame.name.startsWith(`OPF ${item.field} `) && close(frame.box.x, box.x) && frame.box.y >= box.y - TOLERANCE_PT && frame.box.y < box.y + box.height);
      assert.ok(own.length, `${where}: native shapes`);
      assert.ok(close(Math.min(...own.map((frame) => frame.box.x)), box.x), `${where}: native x`);
      assert.ok(close(Math.min(...own.map((frame) => frame.box.y)), box.y), `${where}: native y`);
      for (const frame of own) {
        assert.ok(frame.box.x + frame.box.width <= box.x + box.width + TOLERANCE_PT, `${where}: native right edge`);
        assert.ok(frame.box.y + frame.box.height <= box.y + box.height + TOLERANCE_PT, `${where}: native bottom edge`);
      }
    }
    leaves++;
  }
}
assert.ok(leaves >= 30, `${leaves} leaves checked`);
console.log(`Placeholder groups ecosystem: ${leaves} leaves of ${deck.slides.length} slides (nested records and chartPrimary) agree across core, SVG and native PPTX within ${TOLERANCE_PT} pt.`);
