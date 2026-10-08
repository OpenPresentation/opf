// FA-23: image block treatments export as native DrawingML from core's composed geometry (ComposedItem.image) and
// import back while the native objects are unchanged: the 0.14 slide-level image mapping, applied to image blocks.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { unzipSync, zipSync } from 'fflate';
import { XMLParser } from 'fast-xml-parser';
import { composeSlide } from '@openpresentation/opf/composition';
import { toPptx, fromPptx } from '../dist/index.js';

// This suite runs against the linked coordinated core; a core without image block treatment geometry is a pinning error.
assert.ok(composeSlide({ title: 'probe', blocks: [{ type: 'image', image: 'x', shape: 'circle' }] }).items.find(item => item.field === 'image')?.image?.shape,
  'Linked core composition has no image block treatment geometry; pin a core with the FA-22 image blocks.');
const parser = new XMLParser({ignoreAttributes:false, attributeNamePrefix:'', parseTagValue:false});
const array = value => value == null ? [] : Array.isArray(value) ? value : [value];
const decode = bytes => new TextDecoder().decode(bytes);
const uri = `data:image/png;base64,${(await readFile(new URL('fixtures/images/square.png', import.meta.url))).toString('base64')}`;
const scheme = { name: 'Custom', dark1: '#101820', light1: '#F4F1EA', dark2: '#2A3440', light2: '#E8E4DC', accent1: '#1F5AA6', accent2: '#4A7A3A', accent3: '#B05A2A', accent4: '#7A4A9A', accent5: '#C0C8D0', accent6: '#5A8A9A', hyperlink: '#1F5AA6', followedHyperlink: '#7A4A9A' };
const deckFor = (treatment, design = {}) => ({ design: { colorScheme: scheme, ...design },
  slides: [{ title: 'Treatment', blocks: [{ type: 'image', image: uri, ...treatment }, { type: 'text', text: 'Body' }] }] });
const geometryOf = (deck, width = 1280, height = 720) => composeSlide(deck.slides[0], { width, height, presentation: deck }).items.find(item => item.field === 'image').image;
async function exported(deck) {
  const bytes = await toPptx(deck, { imageFormat: 'preserve', strictAssets: true });
  const entries = unzipSync(bytes);
  const tree = parser.parse(decode(entries['ppt/slides/slide1.xml']))['p:sld']['p:cSld']['p:spTree'];
  const shapes = array(tree['p:sp']);
  return { bytes, entries, picture: array(tree['p:pic'])[0], overlay: shapes.find(shape => / overlay$/.test(shape['p:nvSpPr']['p:cNvPr'].name)) };
}
const guides = geometry => Object.fromEntries(array(geometry['a:avLst']?.['a:gd']).map(gd => [gd.name, Number(gd.fmla.replace('val ', ''))]));
let checked = 0;

// Masks: the picture's preset geometry and guides equal core's normalized shape, at core's frame.
for (const [shape, extra] of [['rounded', { cornerRadius: 0.12 }], ['circle', {}], ['hexagon', {}], ['rectangle', {}]]) {
  const deck = deckFor({ placement: { edge: 'right', inset: true }, shape, ...extra });
  const geometry = geometryOf(deck);
  const { picture } = await exported(deck);
  const preset = picture['p:spPr']['a:prstGeom'];
  assert.equal(preset.prst, geometry.shape.preset, shape);
  assert.deepEqual(guides(preset), geometry.shape.adjust, shape);
  const xfrm = picture['p:spPr']['a:xfrm'];
  assert.deepEqual([xfrm['a:off'].x, xfrm['a:off'].y, xfrm['a:ext'].cx, xfrm['a:ext'].cy].map(Number),
    [geometry.box.x, geometry.box.y, geometry.box.width, geometry.box.height].map(v => Math.round(v / 96 * 914400)), shape);
  checked++;
}

// Border: centered solid line on the picture; width in EMU from scaled reference pixels, alpha from #RRGGBBAA.
{
  const deck = deckFor({ placement: { edge: 'left' }, shape: 'rounded', border: { color: '#10182080', width: 12 } }, { dimensions: { widthInches: 20, heightInches: 11.25 } });
  const geometry = geometryOf(deck, 1920, 1080);
  const line = (await exported(deck)).picture['p:spPr']['a:ln'];
  assert.equal(Number(line.w), Math.round(geometry.border.width / 96 * 914400));
  assert.equal(line.algn, 'ctr');
  assert.equal(line['a:solidFill']['a:srgbClr'].val, '101820');
  assert.equal(Number(line['a:solidFill']['a:srgbClr']['a:alpha'].val), Math.round(0x80 / 255 * 100000));
  assert.equal(line['a:miter'].lim, '800000');
  const themed = (await exported(deckFor({ border: { color: 'accent1', width: 2 } }))).picture['p:spPr']['a:ln'];
  assert.equal(themed['a:solidFill']['a:srgbClr'].val, '1F5AA6');
  checked++;
}

// Recolor then alphaModFix, on the blip only.
{
  const gray = (await exported(deckFor({ recolor: 'grayscale', opacity: 0.12345 }))).picture['p:blipFill']['a:blip'];
  assert.equal(gray['a:grayscl'], '');
  assert.equal(gray['a:alphaModFix'].amt, '12345');
  const duo = (await exported(deckFor({ recolor: { dark: 'accent1', light: 'light1' } }))).picture['p:blipFill']['a:blip'];
  assert.deepEqual(array(duo['a:duotone']['a:srgbClr']).map(color => color.val), ['1F5AA6', 'F4F1EA']);
  const xml = decode((await exported(deckFor({ recolor: 'grayscale', opacity: 0.5 }))).entries['ppt/slides/slide1.xml']);
  assert.match(xml, /<a:blip r:embed="[^"]+"><a:grayscl\/><a:alphaModFix amt="50000"\/><\/a:blip>/);
  const plain = (await exported(deckFor({}))).picture;
  assert.equal(plain['p:spPr']['a:ln'], undefined);
  assert.deepEqual(Object.keys(plain['p:blipFill']['a:blip']), ['r:embed']);
  checked += 3;
}

// Overlay: one native shape directly above the picture, in the frame's shape or an edge band.
{
  const deck = deckFor({ placement: { edge: 'right', inset: true }, shape: 'circle', overlay: { color: '#00000080', opacity: 0.5 } });
  const geometry = geometryOf(deck);
  const { overlay, entries } = await exported(deck);
  assert.equal(overlay['p:spPr']['a:prstGeom'].prst, 'ellipse');
  assert.equal(Number(overlay['p:spPr']['a:solidFill']['a:srgbClr']['a:alpha'].val), Math.round(0x80 / 255 * 0.5 * 100000));
  assert.deepEqual(overlay['p:spPr']['a:ln'], { 'a:noFill': '' });
  const xml = decode(entries['ppt/slides/slide1.xml']);
  const names = [...xml.matchAll(/<p:cNvPr\b[^>]*\bname="([^"]*)"/g)].map(match => match[1]).filter(Boolean);
  const picture = names.findIndex(name => /^OPF image \d+$/.test(name));
  assert.equal(names[picture + 1], `${names[picture]} overlay`, 'the overlay lies directly above its picture');
  assert.ok(names.slice(picture + 2).some(name => /^OPF text /.test(name)) || xml.lastIndexOf('<p:sp>') > xml.indexOf(' overlay"'), 'the body follows');
  const bandDeck = deckFor({ placement: { edge: 'top', inset: true }, overlay: { color: 'dark1', opacity: 0.75, edge: 'bottom', size: 0.25 } });
  const band = (await exported(bandDeck)).overlay;
  const bandGeometry = geometryOf(bandDeck).overlay;
  assert.equal(band['p:spPr']['a:prstGeom'].prst, 'rect');
  assert.equal(Number(band['p:spPr']['a:xfrm']['a:off'].y), Math.round(bandGeometry.box.y / 96 * 914400));
  assert.equal(band['p:spPr']['a:solidFill']['a:srgbClr'].val, '101820');
  assert.equal(geometry.overlay.shape.preset, 'ellipse');
  checked += 2;
}

// Round trip: every treatment field returns while the native objects are unchanged.
const full = { placement: { edge: 'right', size: 0.46, inset: true }, aspectRatio: 0.5, shape: 'rounded', cornerRadius: 0.12, fit: 'cover', focus: { x: 0.3, y: 0.6 },
  border: { color: 'dark1', width: 12 }, opacity: 0.8, recolor: { dark: 'accent1', light: 'light1' }, overlay: { color: '#000000', opacity: 0.2 } };
{
  const deck = deckFor(full);
  deck.slides[0].blocks[0].image = { src: uri, alt: 'Phone' };
  const { bytes, picture } = await exported(deck);
  assert.equal(picture['p:nvPicPr']['p:cNvPr'].descr, 'Phone');
  for (const provenance of ['full', false]) {
    const diagnostics = [];
    const source = provenance === false ? await toPptx(deck, { imageFormat: 'preserve', strictAssets: true, provenance: false }) : bytes;
    const imported = await fromPptx(source, { onDiagnostic: d => diagnostics.push(d) });
    const { image, type, ...treatment } = imported.slides[0].blocks[0];
    assert.equal(type, 'image');
    assert.deepEqual(image, { src: uri, alt: 'Phone' });
    assert.deepEqual(treatment, full, `provenance ${provenance}`);
    assert.equal(diagnostics.some(d => /image-provenance|image-crop/.test(d.code)), false, JSON.stringify(diagnostics));
    assert.equal(JSON.stringify(imported.slides[0].blocks).includes('PowerPoint shape'), false, 'overlay not imported as content');
    const again = await exported({ ...imported, design: { ...imported.design, colorScheme: scheme } });
    assert.deepEqual(again.picture['p:spPr'], picture['p:spPr']);
    assert.deepEqual(again.picture['p:blipFill']['a:blip']['a:duotone'], picture['p:blipFill']['a:blip']['a:duotone']);
  }
  checked += 2;
}

// An edited overlay drops only the overlay; an edited effect drops the treatment.
{
  const { entries } = await exported(deckFor(full));
  const path = 'ppt/slides/slide1.xml', xml = decode(entries[path]);
  const edited = { ...entries, [path]: new TextEncoder().encode(xml.replace(/( overlay"[\s\S]*?<a:alpha val=")\d+/, '$150000')) };
  const diagnostics = [];
  const imported = await fromPptx(zipSync(edited), { onDiagnostic: d => diagnostics.push(d) });
  const block = imported.slides[0].blocks.find(entry => entry.type === 'image');
  assert.equal(block.overlay, undefined);
  assert.equal(block.shape, 'rounded');
  assert.ok(diagnostics.some(d => d.code === 'invalid-image-provenance'));
  const recolored = { ...entries, [path]: new TextEncoder().encode(xml.replace('<a:alphaModFix amt="80000"/>', '<a:alphaModFix amt="60000"/>')) };
  const plain = await fromPptx(zipSync(recolored), { onDiagnostic: () => {} });
  const ordinary = plain.slides[0].blocks.find(entry => entry.type === 'image');
  assert.equal(ordinary.shape, undefined);
  checked += 2;
}

// An edge overlay on a non-rectangle mask is core's unsupported-image-treatment and is not drawn.
{
  const deck = deckFor({ shape: 'circle', overlay: { color: 'dark1', opacity: 0.5, edge: 'bottom' } });
  const diagnostics = [];
  const bytes = await toPptx(deck, { imageFormat: 'preserve', onDiagnostic: d => diagnostics.push(d) });
  assert.ok(diagnostics.some(d => d.code === 'unsupported-image-treatment' && d.path === 'slides.0.blocks.0.overlay.edge'));
  assert.doesNotMatch(decode(unzipSync(bytes)['ppt/slides/slide1.xml']), / overlay"/);
  checked++;
}
console.log(`image treatments: ${checked} native checks passed`);
