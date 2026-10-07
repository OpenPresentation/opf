// design.watermark exports as one native picture per slide, first in the shape
// tree, at the preview's frame and opacity (never silently dropped), and imports
// back while the native picture is unchanged.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { unzipSync, zipSync } from 'fflate';
import { XMLParser } from 'fast-xml-parser';
import { renderSvgDeck } from '@openpresentation/opf-render';
import { toPptx, fromPptx } from '../dist/index.js';

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '', parseTagValue: false });
const array = value => value == null ? [] : Array.isArray(value) ? value : [value];
const decode = bytes => new TextDecoder().decode(bytes);
const load = async name => (await readFile(new URL(`fixtures/images/${name}`, import.meta.url))).toString('base64');
const wide = `data:image/png;base64,${await load('wide.png')}`;      // 120 x 60
const tall = `data:image/png;base64,${await load('tall.png')}`;
const square = `data:image/png;base64,${await load('square.png')}`;
const EMU_PER_PX = 9525, TOLERANCE_EMU = 0.02 / 72 * 914400;

async function exported(deck, options = {}) {
  const diagnostics = [];
  const bytes = await toPptx(deck, { imageFormat: 'preserve', strictAssets: true, onDiagnostic: d => diagnostics.push(d), ...options });
  const entries = unzipSync(bytes);
  const slides = Object.keys(entries).filter(path => /^ppt\/slides\/slide\d+\.xml$/.test(path)).sort((a, b) => parseInt(a.match(/\d+/)) - parseInt(b.match(/\d+/)));
  return { bytes, entries, diagnostics, xml: slides.map(path => decode(entries[path])),
    trees: slides.map(path => parser.parse(decode(entries[path]))['p:sld']['p:cSld']['p:spTree']) };
}
const watermarkOf = tree => array(tree['p:pic']).filter(picture => picture['p:nvPicPr']['p:cNvPr'].name === 'OPF watermark');
const frameOf = picture => {
  const xfrm = picture['p:spPr']['a:xfrm'];
  return { x: Number(xfrm['a:off'].x), y: Number(xfrm['a:off'].y), w: Number(xfrm['a:ext'].cx), h: Number(xfrm['a:ext'].cy) };
};
const alphaOf = picture => {
  const amount = picture['p:blipFill']['a:blip']['a:alphaModFix']?.amt;
  return amount === undefined ? 1 : Number(amount) / 100000;
};

// The traced preview: the drawn watermark image, its opacity group, and where the
// bitmap lands inside its frame (preserveAspectRatio meet, centered).
function previewWatermark(svg, sourceWidth, sourceHeight, path) {
  const image = svg.match(new RegExp(`<image [^>]*data-opf-path="${path}"[^>]*/>`))?.[0];
  assert.ok(image, `The preview draws ${path}`);
  const number = name => Number(image.match(new RegExp(`[ ]${name}="(-?[0-9.]+)"`))[1]);
  const frame = { x: number('x'), y: number('y'), w: number('width'), h: number('height') };
  assert.match(image, /preserveAspectRatio="xMidYMid meet"/, 'The preview always fits the watermark without cropping');
  const scale = Math.min(frame.w / sourceWidth, frame.h / sourceHeight);
  const drawn = { w: sourceWidth * scale, h: sourceHeight * scale };
  const group = svg.slice(0, svg.indexOf(image)).match(/<g opacity="([0-9.]+)">(?![\s\S]*<g opacity)/);
  return { x: frame.x + (frame.w - drawn.w) / 2, y: frame.y + (frame.h - drawn.h) / 2, w: drawn.w, h: drawn.h,
    opacity: group ? Number(group[1]) : 1, order: svg.indexOf(image) };
}
function assertParity(tree, svg, [sourceWidth, sourceHeight], path, note) {
  const [picture] = watermarkOf(tree), frame = frameOf(picture), preview = previewWatermark(svg, sourceWidth, sourceHeight, path);
  for (const [actual, expected, name] of [[frame.x, preview.x, 'x'], [frame.y, preview.y, 'y'], [frame.w, preview.w, 'width'], [frame.h, preview.h, 'height']])
    assert.ok(Math.abs(actual - expected * EMU_PER_PX) <= TOLERANCE_EMU, `${note}: native ${name} ${actual / EMU_PER_PX} equals the drawn ${expected}`);
  assert.ok(Math.abs(alphaOf(picture) - preview.opacity) < 1e-5, `${note}: native alpha ${alphaOf(picture)} equals the drawn opacity ${preview.opacity}`);
  // Paint order: the preview draws it before any content (the title is the first content).
  const title = svg.indexOf('.title"');
  assert.ok(title < 0 || preview.order < title, `${note}: the preview paints it before content`);
}
const shapeNames = xml => [...xml.matchAll(/<p:cNvPr id="\d+" name="([^"]*)"/g)].map(match => match[1]).filter(Boolean);

let checked = 0;

// 1. Geometry, alpha and paint order against the traced preview.
const dimensions = { widescreen: [1280, 720], standard: [960, 720], small: [640, 360] };
for (const [label, [width, height]] of Object.entries(dimensions)) {
  for (const [imageLabel, source, size] of [['wide', wide, [120, 60]], ['tall', tall, null], ['square', square, null]]) {
    for (const opacity of [0.08, 0.15, 1, 0]) {
      const deck = { design: { dimensions: { widthInches: width / 96, heightInches: height / 96 }, watermark: { src: source, opacity } },
        slides: [{ title: 'Watermarked', text: 'Body copy over the watermark.' }] };
      const svg = renderSvgDeck(deck, { trace: true })[0];
      const { trees, xml, diagnostics } = await exported(deck);
      assert.equal(diagnostics.filter(d => /watermark/.test(d.path ?? '')).length, 0, 'No diagnostics for a supported watermark');
      assert.equal(watermarkOf(trees[0]).length, 1, `${label} ${imageLabel} ${opacity}: one watermark picture`);
      const dims = size ?? (() => { const bytes = Buffer.from(source.split(',')[1], 'base64'); return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)]; })();
      assertParity(trees[0], svg, dims, 'design.watermark', `${label} ${imageLabel} ${opacity}`);
      // Beneath everything: the first shape in the tree is the watermark, before all text.
      assert.equal(shapeNames(xml[0])[0], 'OPF watermark', `${label} ${imageLabel} ${opacity}: watermark first in the shape tree`);
      assert.ok(xml[0].indexOf('name="OPF watermark"') < xml[0].indexOf('<p:sp>'), 'The picture precedes every text shape');
      checked++;
    }
  }
}

// 2. Names, alt text, string form, asset references, per-slide override and false.
{
  const deck = { assets: { mark: { src: wide, alt: 'Acme confidential' }, plain: wide },
    design: { watermark: 'asset:mark' },
    slides: [{ title: 'Inherits', text: 'a' }, { title: 'Off', text: 'b', design: { watermark: false } },
      { title: 'Own', text: 'c', design: { watermark: { src: 'asset:plain', opacity: 0.3 } } }, { title: 'String', text: 'd', design: { watermark: wide } }] };
  const svgs = renderSvgDeck(deck, { trace: true });
  const { trees, xml } = await exported(deck);
  assert.equal(watermarkOf(trees[0]).length, 1);
  assert.equal(watermarkOf(trees[0])[0]['p:nvPicPr']['p:cNvPr'].descr, 'Acme confidential', 'Alt text comes from the asset');
  assert.equal(alphaOf(watermarkOf(trees[0])[0]), 0.08, 'A string form is the preview default opacity');
  assert.equal(watermarkOf(trees[1]).length, 0, 'design.watermark = false on a slide exports none');
  assert.ok(!svgs[1].includes('design.watermark'), 'and the preview draws none');
  assert.equal(alphaOf(watermarkOf(trees[2])[0]), 0.3);
  assert.equal(watermarkOf(trees[2])[0]['p:nvPicPr']['p:cNvPr'].descr, 'Watermark', 'Alt text falls back to a plain name');
  assert.equal(alphaOf(watermarkOf(trees[3])[0]), 0.08);
  for (const index of [0, 2, 3]) assert.equal(shapeNames(xml[index])[0], 'OPF watermark');
  for (const index of [0, 2, 3]) assertParity(trees[index], svgs[index], [120, 60],
    index === 0 ? 'design.watermark' : `slides.${index}.design.watermark`, `slide ${index}`);
  checked++;
}

// 3. Paint order against a slide image is the traced preview's order, not an assumption:
// the preview paints the slide image, its overlay, then the watermark, then content.
{
  for (const position of ['background', 'left', 'right', 'top', 'bottom']) for (const overlay of [false, true]) {
    const slideImage = { src: square, position, ...(overlay ? { overlay: { color: '#000000', opacity: 0.3 } } : {}) };
    const deck = { design: { watermark: { src: wide, opacity: 0.2 } }, slides: [{ title: 'Layered', text: 'Body', design: { slideImage } }] };
    const svg = renderSvgDeck(deck, { trace: true })[0];
    const at = path => svg.indexOf(`data-opf-path="${path}"`);
    const previewOrder = [['OPF slide image slides.0', 'slides.0.design.slideImage'], ['OPF watermark', 'design.watermark'], ['OPF heading slides.0.title line 0', 'slides.0.title']]
      .map(([name, path]) => ({ name, at: at(path) })).sort((x, y) => x.at - y.at).map(entry => entry.name);
    assert.ok(previewOrder.indexOf('OPF slide image slides.0') < previewOrder.indexOf('OPF watermark') && previewOrder.indexOf('OPF watermark') < previewOrder.indexOf('OPF heading slides.0.title line 0'), 'The traced preview paints slide image, watermark, then content');
    const { xml } = await exported(deck);
    const names = shapeNames(xml[0]).filter(name => previewOrder.includes(name));
    assert.deepEqual(names, previewOrder, `${position}${overlay ? ' with overlay' : ''}: native order equals the preview's`);
    if (overlay) {
      const all = shapeNames(xml[0]);
      assert.ok(all.indexOf('OPF slide image overlay slides.0') < all.indexOf('OPF watermark'), 'The watermark also lies above the slide image overlay');
    }
    checked++;
  }
}

// 4. Never silent: unrepresentable variants report a specific diagnostic.
{
  // FA-13: a watermark names exactly one of src and text, so an opacity-only object (or one with both) is rejected by the schema.
  for (const deck of [
    { design: { watermark: { opacity: 0.2 } }, slides: [{ title: 'A', text: 'b' }] },
    { slides: [{ title: 'A', text: 'b', design: { watermark: { opacity: 0.2 } } }] },
    { design: { watermark: { src: 'asset:a', text: 'DRAFT', opacity: 0.2 } }, slides: [{ title: 'A', text: 'b' }] }
  ]) {
    await assert.rejects(exported(deck), error => error.code === 'invalid-opf');
  }
  const deck = { design: { watermark: 'https://example.com/watermark.png' }, slides: [{ title: 'A', text: 'b' }, { title: 'B', text: 'c', design: { watermark: 'asset:missing' } }] };
  const diagnostics = [];
  await toPptx(deck, { onDiagnostic: d => diagnostics.push(d) });
  assert.deepEqual(diagnostics.filter(d => d.code === 'unresolved-asset' && /watermark/.test(d.path)).map(d => d.path), ['design.watermark', 'slides.1.design.watermark'], 'An unresolved image reports where it was dropped');
  await assert.rejects(toPptx({ design: { watermark: 'https://example.com/watermark.png' }, slides: [{ title: 'A' }] }, { strictAssets: true }), /Remote image assets/, 'strictAssets rejects rather than dropping');
  checked++;
}

// 5. Round trip: an unchanged watermark imports back as design.watermark.
{
  const deck = { design: { watermark: { src: wide, opacity: 0.15 } }, slides: [{ title: 'One', text: 'a' }, { title: 'Two', text: 'b' }, { title: 'Three', text: 'c' }] };
  const { bytes, entries } = await exported(deck);
  const diagnostics = [];
  const imported = await fromPptx(bytes, { onDiagnostic: d => diagnostics.push(d) });
  assert.equal(diagnostics.filter(d => /watermark/i.test(d.code + d.path)).length, 0, 'No watermark diagnostics on an unchanged import');
  assert.equal(imported.design.watermark.opacity, 0.15);
  assert.equal(typeof imported.design.watermark.src, 'string');
  assert.ok(imported.slides.every(slide => slide.design?.watermark === undefined), 'A deck-wide watermark is restored at deck level');
  assert.ok(imported.slides.every(slide => !JSON.stringify(slide).includes('"kind":"image"') && !(slide.image || slide.blocks?.some(block => block.image))), 'The watermark is not imported as content');
  // Re-export is stable: same picture geometry and alpha.
  const again = await exported(imported);
  assert.deepEqual(watermarkOf(again.trees[1]).map(frameOf), watermarkOf((await exported(deck)).trees[1]).map(frameOf));
  assert.equal(alphaOf(watermarkOf(again.trees[1])[0]), 0.15);

  // A watermark absent from one slide stays slide-level on the others.
  const mixed = { ...deck, slides: [deck.slides[0], { ...deck.slides[1], design: { watermark: false } }, deck.slides[2]] };
  const mixedImport = await fromPptx((await exported(mixed)).bytes, { onDiagnostic: () => {} });
  assert.equal(mixedImport.design?.watermark, undefined);
  assert.equal(mixedImport.slides[0].design.watermark.opacity, 0.15);
  assert.equal(mixedImport.slides[1].design?.watermark, undefined);
  assert.equal(mixedImport.slides[2].design.watermark.opacity, 0.15);

  // An edited picture is ordinary content plus one specific diagnostic.
  const slidePart = 'ppt/slides/slide1.xml';
  const moved = { ...entries, [slidePart]: new TextEncoder().encode(decode(entries[slidePart]).replace(/(name="OPF watermark"[\s\S]*?<a:off x=")(\d+)/, (_, head, x) => `${head}${Number(x) + 9525}`)) };
  const editedDiagnostics = [];
  const edited = await fromPptx(zipSync(moved), { onDiagnostic: d => editedDiagnostics.push(d) });
  assert.equal(editedDiagnostics.filter(d => d.code === 'invalid-watermark-provenance').length, 1);
  assert.equal(edited.slides[0].design?.watermark, undefined);
  assert.ok(JSON.stringify(edited.slides[0]).includes('data:image/png'), 'The edited picture is kept as ordinary content');

  // Stripped tag: the picture is ordinary content and nothing is lost.
  const stripped = { ...entries };
  for (const path of Object.keys(stripped)) if (/^ppt\/tags\/opfWatermark\d+\.xml$/.test(path)) delete stripped[path];
  const strippedDiagnostics = [];
  const plain = await fromPptx(zipSync(stripped), { onDiagnostic: d => strippedDiagnostics.push(d) });
  assert.ok(JSON.stringify(plain.slides[0]).includes('data:image/png'), 'A picture without its tag is ordinary content');
  assert.equal(plain.design?.watermark, undefined);
  checked++;
}

// 6. Package integrity: tag parts are typed and related.
{
  const { entries } = await exported({ design: { watermark: { src: wide, opacity: 0.1 } }, slides: [{ title: 'A' }, { title: 'B' }] });
  const types = decode(entries['[Content_Types].xml']);
  for (const path of Object.keys(entries).filter(path => /^ppt\/tags\/opfWatermark\d+\.xml$/.test(path))) assert.ok(types.includes(`PartName="/${path}"`));
  assert.equal(Object.keys(entries).filter(path => /^ppt\/tags\/opfWatermark\d+\.xml$/.test(path)).length, 2);
  const media = Object.keys(entries).filter(path => path.startsWith('ppt/media/'));
  assert.ok(media.length >= 1);
  checked++;
}

// An SVG watermark is a native SVG picture over its PNG fallback, translucent or not (PowerPoint applies a:alphaModFix to an
// SVG picture). test/svg-image.mjs covers SVG pictures in depth.
{
  const svg = 'data:image/svg+xml;base64,' + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="#c00"/></svg>').toString('base64');
  const opaque = await exported({ design: { watermark: { src: svg, opacity: 1 } }, slides: [{ title: 'A' }] });
  assert.match(opaque.xml[0], /<asvg:svgBlip /, 'an opaque SVG watermark is a native SVG picture');
  assert.deepEqual(opaque.diagnostics, []);
  const faint = await exported({ design: { watermark: { src: svg, opacity: 0.1 } }, slides: [{ title: 'A' }] });
  assert.match(faint.xml[0], /<a:blip r:embed="rId\d+"><a:alphaModFix amt="10000"\/><a:extLst><a:ext uri="\{96DAC541[^>]*><asvg:svgBlip /, 'a translucent SVG watermark: the effect, then the SVG extension, in the blip');
  assert.deepEqual(faint.diagnostics, []);
  checked++;
}

console.log(`Watermark export checks passed (${checked}).`);
