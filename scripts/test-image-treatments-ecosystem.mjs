// Cross-engine check for the 15 pptx.gallery image treatments (FA-22, after FF-26's slide picture check). For every slide
// of docs/fixtures/image-treatments.opf.json, the coordinated renderer's SVG and the exporter's native pictures must
// describe the same frame, mask, line, recolor, opacity and overlay as core composition (SlideComposition.backgroundImage
// and ComposedItem.image), and an unchanged export must import the same OPF. This checks the shared contract, not
// PowerPoint raster parity. It needs engines that draw the 0.15 geometry (OPF_RENDER_DIR, OPF_PPTX_DIR).
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
const { renderSlideSvg } = await import(pathToFileURL(path.join(renderDir, 'dist/index.js')));
const { toPptx, fromPptx } = await import(pathToFileURL(path.join(pptxDir, 'dist/index.js')));
const require = createRequire(path.join(pptxDir, 'package.json'));
const { unzipSync } = require('fflate');
const { XMLParser } = require('fast-xml-parser');
const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '', parseTagValue: false });
const array = (value) => (value == null ? [] : Array.isArray(value) ? value : [value]);
const emu = (value) => Math.round((value / 96) * 914400);
const attr = (tag, name) => tag?.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1];
const xfrmOf = (shape) => { const x = shape['p:spPr']['a:xfrm']; return [x['a:off'].x, x['a:off'].y, x['a:ext'].cx, x['a:ext'].cy].map(Number); };
const boxEmu = (box) => [box.x, box.y, box.width, box.height].map(emu);
const svgImageAt = (svg, box) => [...svg.matchAll(/<image\b[^>]*>/g)].map((match) => match[0]).find((tag) => ['x', 'y', 'width', 'height'].every((name, at) => Math.abs(Number(attr(tag, name)) - [box.x, box.y, box.width, box.height][at]) < 1e-3));

const deck = JSON.parse(await readFile(new URL('../docs/fixtures/image-treatments.opf.json', import.meta.url), 'utf8'));
assert.equal(validate(deck, { only: ['format'] }).valid, true);
assert.equal(deck.slides.length, 15);

const bytes = await toPptx(deck, { imageFormat: 'preserve', strictAssets: true });
const entries = unzipSync(bytes);
const imported = await fromPptx(bytes);

let checked = 0;
for (const [index, slide] of deck.slides.entries()) {
  const geometry = composeSlide(slide, resolveSlideContext(deck, index).options);
  const xml = new TextDecoder().decode(entries[`ppt/slides/slide${index + 1}.xml`]);
  const sld = parser.parse(xml)['p:sld'];
  const tree = sld['p:cSld']['p:spTree'];
  const svg = renderSlideSvg(deck, index, { trace: true });
  const pictures = array(tree['p:pic']);
  const shapes = array(tree['p:sp']);

  // A background without alt is the native slide background; its overlay is one shape above it.
  const background = geometry.backgroundImage;
  if (background) {
    if (background.alt === undefined) assert.ok(sld['p:cSld']['p:bg']?.['p:bgPr']?.['a:blipFill'], `${slide.id}: native background picture`);
    else assert.ok(pictures.some((pic) => pic['p:nvPicPr']['p:cNvPr'].descr === background.alt), `${slide.id}: background picture with alt`);
    assert.ok(svgImageAt(svg, background.box), `${slide.id}: SVG background frame`);
    if (background.recolor) assert.ok(xml.includes(background.recolor.type === 'grayscale' ? '<a:grayscl' : '<a:duotone'), `${slide.id}: background recolor`);
    if (background.overlay) assert.ok(shapes.some((shape) => JSON.stringify(xfrmOf(shape)) === JSON.stringify(boxEmu(background.overlay.box))), `${slide.id}: background overlay shape`);
    checked++;
  }

  for (const item of geometry.items.filter((entry) => entry.field === 'image')) {
    const image = item.image;
    // Same frame: SVG image box and native xfrm.
    assert.ok(svgImageAt(svg, image.box), `${slide.id}: SVG frame ${JSON.stringify(image.box)}`);
    const picture = pictures.find((pic) => JSON.stringify(xfrmOf(pic)) === JSON.stringify(boxEmu(image.box)));
    assert.ok(picture, `${slide.id}: native picture at the frame`);
    // Same fit: cover crops (positive srcRect), contain pads (negative or none).
    const crop = picture['p:blipFill']['a:srcRect'];
    if (crop && image.fit !== 'stretch') assert.ok(image.fit === 'cover' ? Number(crop.l ?? 0) >= 0 && Number(crop.t ?? 0) >= 0 : Number(crop.l ?? 0) <= 0 && Number(crop.t ?? 0) <= 0, slide.id);
    // Same mask: native preset + guides from core, SVG clip outline from core.
    const preset = picture['p:spPr']['a:prstGeom'];
    assert.equal(preset.prst, image.shape.preset, slide.id);
    assert.deepEqual(Object.fromEntries(array(preset['a:avLst']?.['a:gd']).map((gd) => [gd.name, Number(gd.fmla.slice(4))])), image.shape.adjust, slide.id);
    if (image.shape.preset !== 'rect') assert.ok(svg.includes(`d="${image.shape.path}"`), `${slide.id}: SVG clip outline`);
    // Same line.
    const line = picture['p:spPr']['a:ln'];
    if (image.border) assert.equal(Number(line.w), emu(image.border.width), slide.id);
    else assert.ok(line === undefined || line['a:noFill'] !== undefined, slide.id);
    // Same pixel treatment.
    const blip = picture['p:blipFill']['a:blip'];
    if (image.opacity !== undefined) assert.equal(Number(blip['a:alphaModFix'].amt) / 100000, image.opacity, slide.id);
    if (image.recolor?.type === 'grayscale') {
      assert.equal(blip['a:grayscl'], '', slide.id);
      assert.match(svg, /values="0\.299 0\.587 0\.114 0 0 0\.299 0\.587 0\.114 0 0 0\.299 0\.587 0\.114 0 0 0 0 0 1 0"/, slide.id);
    }
    if (image.recolor?.type === 'duotone') assert.ok(blip['a:duotone'], slide.id);
    // Same overlay: one shape directly above the picture, the same outline in SVG.
    if (image.overlay) {
      const overlay = shapes.find((shape) => JSON.stringify(xfrmOf(shape)) === JSON.stringify(boxEmu(image.overlay.box)));
      assert.ok(overlay, `${slide.id}: native overlay`);
      assert.equal(overlay['p:spPr']['a:prstGeom'].prst, image.overlay.shape.preset, slide.id);
      assert.ok(svg.includes(`d="${image.overlay.shape.path}"`), `${slide.id}: SVG overlay outline`);
    }
    checked++;
  }

  // Same OPF after an unchanged round trip (picture sources come back as data URIs).
  const strip = (value) => JSON.parse(JSON.stringify(value, (key, entry) => (key === 'src' || key === 'image' && typeof entry === 'string' ? undefined : entry)));
  assert.deepEqual(strip({ background: imported.slides[index].design?.background, blocks: imported.slides[index].blocks }), strip({ background: slide.design?.background, blocks: slide.blocks }), `${slide.id}: round trip`);
}
assert.ok(checked >= 17, `${checked} pictures checked`);
console.log(`Image treatments ecosystem: ${checked} pictures of the 15 treatments agree across core, SVG and native PPTX (frame, fit, mask, line, recolor, opacity, overlay) and round-trip.`);
