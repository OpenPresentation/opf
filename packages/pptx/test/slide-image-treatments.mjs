// design.slideImage treatments export as native DrawingML from core's
// normalized geometry and import back while the native objects are unchanged.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { unzipSync, zipSync } from 'fflate';
import { XMLParser } from 'fast-xml-parser';
import { composeSlide } from '@openpresentation/opf/composition';
import { toPptx, fromPptx } from '../dist/index.js';

// This suite runs against the linked coordinated core; a core without treatment
// geometry is a pinning error, not a reason to skip.
assert.ok(composeSlide({ title: 'probe', design: { slideImage: { src: 'x', position: 'left' } } }).slideImage?.shape,
  'Linked core composition has no slide image treatment geometry; pin a core with the FF-26 treatment vocabulary.');
const parser = new XMLParser({ignoreAttributes:false, attributeNamePrefix:'', parseTagValue:false});
const array = value => value == null ? [] : Array.isArray(value) ? value : [value];
const decode = bytes => new TextDecoder().decode(bytes);
const uri = `data:image/png;base64,${(await readFile(new URL('fixtures/images/square.png', import.meta.url))).toString('base64')}`;
const scheme = { id: 'custom', name: 'Custom', dark1: '#101820', light1: '#F4F1EA', accent1: '#1F5AA6', accent5: '#C0C8D0' };
const deckFor = (treatment, design = {}) => ({ design: { theme: 'classic', colorScheme: scheme, ...design },
  slides: [{ title: 'Treatment', text: 'Body', design: { slideImage: { src: uri, ...treatment } } }] });
async function exported(deck) {
  const bytes = await toPptx(deck, { imageFormat: 'preserve', strictAssets: true });
  const entries = unzipSync(bytes);
  const tree = parser.parse(decode(entries['ppt/slides/slide1.xml']))['p:sld']['p:cSld']['p:spTree'];
  const shapes = array(tree['p:sp']);
  return { bytes, entries, picture: array(tree['p:pic'])[0], overlay: shapes.find(shape => shape['p:nvSpPr']['p:cNvPr'].name === 'OPF slide image overlay slides.0') };
}
const guides = geometry => Object.fromEntries(array(geometry['a:avLst']?.['a:gd']).map(gd => [gd.name, Number(gd.fmla.replace('val ', ''))]));
let checked = 0;

// Masks: the picture's preset geometry and guides equal core's normalized shape.
for (const [shape, extra] of [['rounded', { cornerRadius: 0.12 }], ['circle', {}], ['hexagon', {}], ['rectangle', {}]]) {
  const deck = deckFor({ position: 'right', inset: true, shape, ...extra });
  const geometry = composeSlide(deck.slides[0], { width: 1280, height: 720, presentation: deck }).slideImage;
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
  const deck = deckFor({ position: 'left', shape: 'rounded', border: { color: '#10182080', width: 12 } }, { dimensions: { widthInches: 20, heightInches: 11.25 } });
  const geometry = composeSlide(deck.slides[0], { width: 1920, height: 1080, presentation: deck }).slideImage;
  const line = (await exported(deck)).picture['p:spPr']['a:ln'];
  assert.equal(Number(line.w), Math.round(geometry.border.width / 96 * 914400));
  assert.equal(line.algn, 'ctr');
  assert.equal(line['a:solidFill']['a:srgbClr'].val, '101820');
  assert.equal(Number(line['a:solidFill']['a:srgbClr']['a:alpha'].val), Math.round(0x80 / 255 * 100000));
  assert.equal(line['a:miter'].lim, '800000');
  const themed = (await exported(deckFor({ position: 'left', border: { color: 'accent1', width: 2 } }))).picture['p:spPr']['a:ln'];
  assert.equal(themed['a:solidFill']['a:srgbClr'].val, '1F5AA6');
  checked++;
}

// Recolor then alphaModFix, on the blip only.
{
  const gray = (await exported(deckFor({ position: 'background', recolor: 'grayscale', opacity: 0.12345 }))).picture['p:blipFill']['a:blip'];
  assert.equal(gray['a:grayscl'], '');
  assert.equal(gray['a:alphaModFix'].amt, '12345');
  const duo = (await exported(deckFor({ position: 'background', recolor: { dark: 'accent1', light: 'light1' } }))).picture['p:blipFill']['a:blip'];
  assert.deepEqual(array(duo['a:duotone']['a:srgbClr']).map(color => color.val), ['1F5AA6', 'F4F1EA']);
  const xml = decode((await exported(deckFor({ position: 'background', recolor: 'grayscale', opacity: 0.5 }))).entries['ppt/slides/slide1.xml']);
  assert.match(xml, /<a:blip r:embed="[^"]+"><a:grayscl\/><a:alphaModFix amt="50000"\/><\/a:blip>/);
  const plain = (await exported(deckFor({ position: 'background' }))).picture;
  assert.equal(plain['p:spPr']['a:ln'], undefined);
  assert.deepEqual(Object.keys(plain['p:blipFill']['a:blip']), ['r:embed']);
  checked += 3;
}

// Overlay: one native shape directly above the picture, in the frame's shape or an edge band.
{
  const deck = deckFor({ position: 'right', inset: true, shape: 'circle', overlay: { color: '#00000080', opacity: 0.5 } });
  const geometry = composeSlide(deck.slides[0], { width: 1280, height: 720, presentation: deck }).slideImage;
  const { overlay, entries } = await exported(deck);
  assert.equal(overlay['p:spPr']['a:prstGeom'].prst, 'ellipse');
  assert.equal(Number(overlay['p:spPr']['a:solidFill']['a:srgbClr']['a:alpha'].val), Math.round(0x80 / 255 * 0.5 * 100000));
  assert.deepEqual(overlay['p:spPr']['a:ln'], { 'a:noFill': '' });
  const xml = decode(entries['ppt/slides/slide1.xml']);
  assert.ok(xml.indexOf('</p:pic>') < xml.indexOf('OPF slide image overlay') && xml.indexOf('OPF slide image overlay') < xml.indexOf('OPF heading'), 'picture, overlay, then content');
  const band = (await exported(deckFor({ position: 'background', inset: true, overlay: { color: 'dark1', opacity: 0.75, edge: 'bottom', size: 0.25 } }))).overlay;
  const bandGeometry = composeSlide(deckFor({ position: 'background', inset: true, overlay: { color: 'dark1', opacity: 0.75, edge: 'bottom', size: 0.25 } }).slides[0], { width: 1280, height: 720 }).slideImage.overlay;
  assert.equal(band['p:spPr']['a:prstGeom'].prst, 'rect');
  assert.equal(Number(band['p:spPr']['a:xfrm']['a:off'].y), Math.round(bandGeometry.box.y / 96 * 914400));
  assert.equal(band['p:spPr']['a:solidFill']['a:srgbClr'].val, '101820');
  assert.equal(geometry.overlay.shape.preset, 'ellipse');
  checked += 2;
}

// Round trip: every treatment field returns while the native objects are unchanged.
const full = { position: 'right', inset: true, size: 0.46, aspectRatio: 0.5, shape: 'rounded', cornerRadius: 0.12, alt: 'Phone', fill: 'crop',
  border: { color: 'dark1', width: 12 }, opacity: 0.8, recolor: { dark: 'accent1', light: 'light1' }, overlay: { color: '#000000', opacity: 0.2 } };
{
  const { bytes, picture } = await exported(deckFor(full));
  assert.equal(picture['p:nvPicPr']['p:cNvPr'].descr, 'Phone');
  const diagnostics = [];
  const imported = await fromPptx(bytes, { onDiagnostic: d => diagnostics.push(d) });
  const { src, ...treatment } = imported.slides[0].design.slideImage;
  assert.equal(src, uri);
  assert.deepEqual(treatment, full);
  assert.equal(diagnostics.some(d => /slide-image|image-crop/.test(d.code)), false, JSON.stringify(diagnostics));
  assert.equal(JSON.stringify(imported.slides[0].blocks ?? []).includes('PowerPoint shape'), false, 'overlay not imported as content');
  const again = await exported({ ...imported, design: { ...imported.design, theme: 'classic', colorScheme: scheme } });
  assert.deepEqual(again.picture['p:spPr'], picture['p:spPr']);
  assert.deepEqual(again.picture['p:blipFill']['a:blip']['a:duotone'], picture['p:blipFill']['a:blip']['a:duotone']);
  checked++;
}

// An edited overlay drops only the overlay; an edited effect drops the slide image.
{
  const { entries } = await exported(deckFor(full));
  const path = 'ppt/slides/slide1.xml', xml = decode(entries[path]);
  const edited = { ...entries, [path]: new TextEncoder().encode(xml.replace(/(OPF slide image overlay[\s\S]*?<a:alpha val=")\d+/, '$150000')) };
  const diagnostics = [];
  const imported = await fromPptx(zipSync(edited), { onDiagnostic: d => diagnostics.push(d) });
  assert.equal(imported.slides[0].design.slideImage.overlay, undefined);
  assert.equal(imported.slides[0].design.slideImage.shape, 'rounded');
  assert.ok(diagnostics.some(d => d.code === 'invalid-slide-image-provenance'));
  const recolored = { ...entries, [path]: new TextEncoder().encode(xml.replace('<a:alphaModFix amt="80000"/>', '<a:alphaModFix amt="60000"/>')) };
  const plain = await fromPptx(zipSync(recolored), { onDiagnostic: () => {} });
  assert.equal(plain.slides[0].design?.slideImage, undefined);
  checked += 2;
}
console.log(`slide image treatments: ${checked} native checks passed`);
