// The historical gallery 1 alignment-only fixture remains in docs/evidence/rr-81-layout-review/.
// Gallery 2 templates change region geometry as well as design. Compare each accepted
// line directly with native geometry and preview anchors instead of assuming only alignment changes.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {XMLParser} from 'fast-xml-parser';
import {unzipSync} from 'fflate';
import {gallery} from '@openpresentation/gallery';
import {layoutTemplate} from '@openpresentation/opf/composition';
import {resolvePresentation} from '@openpresentation/opf-render';
import {toSvg} from '@openpresentation/opf-render/svg';
import {toPptx, fromPptx} from '../dist/index.js';
import {loadFonts} from '@openpresentation/opf-render/fonts-node';
const fonts = await loadFonts({pack: 'office', substitutionPolicy: 'none'});
const image = `data:image/png;base64,${(await readFile(new URL('./fixtures/images/wide.png', import.meta.url))).toString('base64')}`;
const sample = {
  text: () => ({text: 'Readable body'}), list: () => ({items: ['Alpha', 'Beta']}), image: () => ({image: {src: image}}),
  chart: () => ({chart: {type: 'bar', data: {columns: ['Quarter', 'Value'], rows: [['Q1', 1], ['Q2', 2]]}}}),
  table: () => ({table: {columns: ['A', 'B'], rows: [[1, 2]]}}), code: () => ({code: 'const a = 1;'}),
  metric: () => ({metric: {value: 12, label: 'Customers'}}), quote: () => ({quote: {text: 'Keep these words.', attribution: 'Someone'}}),
  timeline: () => ({timeline: {events: [{when: 'Q1', what: 'Pilot'}]}}),
};
const parser = new XMLParser({ignoreAttributes: false, attributeNamePrefix: '', parseTagValue: false, trimValues: false});
const array = value => value === undefined ? [] : Array.isArray(value) ? value : [value];
const textOf = shape => array(shape['p:txBody']?.['a:p']).map(p => array(p['a:r']).map(r => r['a:t'] ?? '').join('')).join('\n');
const near = (a, b, message) => assert.ok(Math.abs(a - b) < .002, `${message}: ${a} vs ${b}`);
const dec = new TextDecoder();
let lines = 0;
for (const [id, record] of Object.entries(gallery.layouts)) for (const alignment of ['left', 'center', 'right']) {
  const blocks = layoutTemplate(record).regions.map(region => ({...sample[region.accepts.find(kind => sample[kind])](), region: region.name}));
  const document = {design: {fontScheme: {id: 'carlito', heading: 'Carlito', body: 'Carlito'}, titleAlignment: alignment, contentAlignment: alignment}, slides: [{layout: id, title: 'Clear title', subtitle: 'Supporting words', ...(blocks.length ? {blocks} : {})}]};
  const options = {fonts, catalogs: [gallery], seed: 1, timestamp: '2026-01-01T00:00:00Z'};
  const bound = resolvePresentation(document, options).slides[0];
  const expected = bound.geometry.items.filter(item => item.text?.placement && ['title', 'subtitle', 'text'].includes(item.field)).flatMap(item => item.text.placement.lines.map((placed, index) => ({item, placed, index})));
  const bytes = await toPptx(document, options);
  const xml = dec.decode(unzipSync(bytes)['ppt/slides/slide1.xml']);
  const shapes = array(parser.parse(xml)['p:sld']['p:cSld']['p:spTree']['p:sp']).filter(shape => textOf(shape) && /^OPF (?:heading|text) /.test(shape['p:nvSpPr']['p:cNvPr'].name));
  assert.equal(shapes.length, expected.length, `${id}: one editable shape per accepted line`);
  const svg = toSvg(document, options)[0];
  const previewTexts = [...svg.matchAll(/<text\b([^>]*)>([\s\S]*?)<\/text>/g)].map(([, attributes, body]) => ({text: body.replace(/<[^>]+>/g, ''), anchor: attributes.match(/text-anchor="([^"]+)"/)?.[1] ?? 'start'}));
  for (const [index, shape] of shapes.entries()) {
    const {item, placed, index: lineIndex} = expected[index];
    const transform = shape['p:spPr']['a:xfrm'];
    const factor = item.alignment === 'right' ? 1 : item.alignment === 'center' ? .5 : 0;
    near(Number(transform['a:off'].x) / 9525 + Number(transform['a:ext'].cx) / 9525 * factor, placed.x + placed.width * factor, `${id}: native line anchor`);
    near(Number(transform['a:off'].y) / 9525, item.text.richLines?.[lineIndex] ? placed.y : placed.baseline - item.text.fontSize, `${id}: native line top`);
    assert.equal(textOf(shape), item.text.lines[lineIndex]);
    const preview = previewTexts.filter(value => value.text === textOf(shape));
    assert.ok(preview.length, `${id}: accepted line appears in preview`);
    assert.ok(preview.some(value => value.anchor === {left: 'start', center: 'middle', right: 'end'}[item.alignment]), `${id}: preview and native alignment agree`);
    for (const paragraph of array(shape['p:txBody']['a:p'])) assert.equal(paragraph['a:pPr'].algn, {left: 'l', center: 'ctr', right: 'r'}[item.alignment]);
    assert.equal(shape['p:txBody']['a:bodyPr'].wrap, 'none');
    assert.ok(!shape['p:txBody']['a:bodyPr']['a:normAutofit']);
    assert.ok(!shape['p:txBody']['a:bodyPr']['a:spAutoFit']);
    lines++;
  }
  assert.ok(svg.includes('<svg'), `${id}: preview renders`);
  assert.deepEqual((await fromPptx(bytes, options)).slides, document.slides, `${id}: layout and explicit region round trip`);
  assert.deepEqual(await toPptx(document, options), bytes, `${id}: deterministic archive`);
}
console.log(`Gallery 2 geometry/alignment passed: 28 templates × three alignments, ${lines} native accepted lines, editable geometry, previews, deterministic exports and region round trips.`);
