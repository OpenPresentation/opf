// Cross-engine check for design.slideImage treatments (FF-26). For every slide of
// docs/fixtures/image-treatments.opf.json, the coordinated renderer's SVG and the
// exporter's native picture must describe the same frame, mask, line, recolor,
// opacity and overlay as core composition, and an unchanged export must import
// the same treatment. This checks the shared contract, not PowerPoint raster parity.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { validatePresentation } from '../packages/javascript/dist/index.js';
import { composeSlide } from '../packages/javascript/dist/composition.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const renderDir = path.resolve(process.env.OPF_RENDER_DIR ?? path.join(root, '../opf-render'));
const pptxDir = path.resolve(process.env.OPF_PPTX_DIR ?? path.join(root, '../opf-pptx'));
const { renderSvg } = await import(pathToFileURL(path.join(renderDir, 'dist/index.js')));
const { toPptx, fromPptx } = await import(pathToFileURL(path.join(pptxDir, 'dist/index.js')));
const require = createRequire(path.join(pptxDir, 'package.json'));
const { unzipSync } = require('fflate');
const { XMLParser } = require('fast-xml-parser');
const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '', parseTagValue: false });
const array = value => value == null ? [] : Array.isArray(value) ? value : [value];
const emu = value => Math.round(value / 96 * 914400);
const attr = (tag, name) => tag?.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1];

const deck = JSON.parse(await readFile(new URL('../docs/fixtures/image-treatments.opf.json', import.meta.url), 'utf8'));
assert.equal(validatePresentation(deck).valid, true);
assert.equal(deck.slides.length, 15);
// The 14 slide-image treatments are distinct OPF; collage-grid is composed from content blocks.
const treatments = deck.slides.filter(slide => slide.design?.slideImage).map(slide => JSON.stringify(slide.design));
assert.equal(new Set(treatments).size, 14);

const bytes = await toPptx(deck, { imageFormat: 'preserve', strictAssets: true });
const entries = unzipSync(bytes);
const diagnostics = [];
const imported = await fromPptx(bytes, { onDiagnostic: diagnostic => diagnostics.push(diagnostic) });
// Only collage-grid content pictures carry an unrepresented native crop; slide images re-derive theirs.
const unexpected = diagnostics.filter(diagnostic => /slide-image/.test(diagnostic.code) || (diagnostic.code === 'unsupported-image-crop' && !diagnostic.path.startsWith('slides.10.pictures.')));
assert.deepEqual(unexpected, []);

let pictures = 0;
for (const [index, slide] of deck.slides.entries()) {
  const geometry = composeSlide(slide, { width: 1280, height: 720, layout: {}, presentation: deck, slideIndex: index }).slideImage;
  const xml = new TextDecoder().decode(entries[`ppt/slides/slide${index + 1}.xml`]);
  const tree = parser.parse(xml)['p:sld']['p:cSld']['p:spTree'];
  const picture = array(tree['p:pic']).find(pic => pic['p:nvPicPr']['p:cNvPr'].name === `OPF slide image slides.${index}`);
  if (!geometry) {
    assert.equal(picture, undefined, slide.id);
    assert.equal(array(tree['p:pic']).length, slide.blocks.length, `${slide.id}: content pictures`);
    continue;
  }
  pictures++;
  const svg = renderSvg(deck, { slideIndex: index, trace: true });
  const image = svg.match(/<image\b[^>]*>/)[0];
  const box = geometry.box;
  // Same frame: SVG image box and native xfrm.
  assert.deepEqual(['x', 'y', 'width', 'height'].map(name => Number(attr(image, name))), [box.x, box.y, box.width, box.height], slide.id);
  const xfrm = picture['p:spPr']['a:xfrm'];
  assert.deepEqual([xfrm['a:off'].x, xfrm['a:off'].y, xfrm['a:ext'].cx, xfrm['a:ext'].cy].map(Number), [box.x, box.y, box.width, box.height].map(emu), slide.id);
  assert.equal(attr(image, 'preserveAspectRatio'), geometry.fill === 'crop' ? 'xMidYMid slice' : 'xMidYMid meet', slide.id);
  const crop = picture['p:blipFill']['a:srcRect'];
  if (crop) assert.ok(geometry.fill === 'crop' ? Number(crop.l) >= 0 && Number(crop.t) >= 0 : Number(crop.l) <= 0 && Number(crop.t) <= 0, slide.id);
  // Same mask: SVG clip outline from core, native preset + guides from core.
  const preset = picture['p:spPr']['a:prstGeom'];
  assert.equal(preset.prst, geometry.shape.preset, slide.id);
  assert.deepEqual(Object.fromEntries(array(preset['a:avLst']?.['a:gd']).map(gd => [gd.name, Number(gd.fmla.slice(4))])), geometry.shape.adjust, slide.id);
  if (geometry.shape.preset !== 'rect') assert.ok(svg.includes(`<clipPath id="opf-s${index + 1}-slide-image-clip"><path d="${geometry.shape.path}"/>`), slide.id);
  // Same line.
  const line = picture['p:spPr']['a:ln'];
  const stroke = svg.match(/<path\b[^>]*stroke="[^"]*"[^>]*>/)?.[0];
  if (geometry.border) {
    assert.equal(Number(line.w), emu(geometry.border.width), slide.id);
    assert.equal(`#${line['a:solidFill']['a:srgbClr'].val}`, attr(stroke, 'stroke'), slide.id);
    assert.equal(Number(attr(stroke, 'stroke-width')), geometry.border.width, slide.id);
  } else assert.equal(line, undefined, slide.id);
  // Same pixel treatment.
  const blip = picture['p:blipFill']['a:blip'];
  if (geometry.opacity !== undefined) {
    assert.equal(Number(blip['a:alphaModFix'].amt) / 100000, geometry.opacity, slide.id);
    assert.match(svg, new RegExp(`opacity="${geometry.opacity}"><image `), slide.id);
  }
  if (geometry.recolor?.type === 'grayscale') {
    assert.equal(blip['a:grayscl'], '', slide.id);
    assert.match(svg, /values="0\.299 0\.587 0\.114 0 0 0\.299 0\.587 0\.114 0 0 0\.299 0\.587 0\.114 0 0 0 0 0 1 0"/, slide.id);
  }
  if (geometry.recolor?.type === 'duotone') {
    const [dark, light] = array(blip['a:duotone']['a:srgbClr']).map(color => [0, 2, 4].map(at => parseInt(color.val.slice(at, at + 2), 16) / 255));
    const values = attr(svg.match(/<feColorMatrix\b[^>]*>/)[0], 'values').split(' ').map(Number);
    for (const channel of [0, 1, 2]) {
      assert.ok(Math.abs(values[channel * 5 + 4] - dark[channel]) < 1e-6, `${slide.id} duotone dark`);
      assert.ok(Math.abs(values[channel * 5] - (light[channel] - dark[channel]) * 0.299) < 1e-6, `${slide.id} duotone slope`);
    }
  }
  // Same overlay.
  const overlay = array(tree['p:sp']).find(shape => shape['p:nvSpPr']['p:cNvPr'].name === `OPF slide image overlay slides.${index}`);
  if (geometry.overlay) {
    const scrim = svg.match(/<path\b[^>]*data-opf-slide-image-overlay[^>]*>/)[0];
    assert.equal(attr(scrim, 'd'), geometry.overlay.shape.path, slide.id);
    assert.equal(overlay['p:spPr']['a:prstGeom'].prst, geometry.overlay.shape.preset, slide.id);
    const fill = overlay['p:spPr']['a:solidFill']['a:srgbClr'];
    assert.equal(`#${fill.val}`, attr(scrim, 'fill'), slide.id);
    assert.ok(Math.abs(Number(fill['a:alpha']?.val ?? 100000) / 100000 - Number(attr(scrim, 'fill-opacity'))) < 1e-5, slide.id);
    const o = overlay['p:spPr']['a:xfrm'];
    assert.deepEqual([o['a:off'].x, o['a:off'].y, o['a:ext'].cx, o['a:ext'].cy].map(Number), ['x', 'y', 'width', 'height'].map(key => emu(geometry.overlay.box[key])), slide.id);
  } else assert.equal(overlay, undefined, slide.id);
  // Same treatment after an unchanged round trip.
  const { src, ...treatment } = imported.slides[index].design.slideImage;
  const { src: _authored, ...authored } = slide.design.slideImage;
  assert.deepEqual(treatment, authored, slide.id);
  assert.match(src, /^data:image\/png;base64,/);
}
assert.equal(pictures, 14);
console.log(`Slide image ecosystem: 14 treatments agree across core, SVG and native PPTX (frame, mask, line, recolor, opacity, overlay) and round-trip; collage-grid exports 4 native content pictures.`);
