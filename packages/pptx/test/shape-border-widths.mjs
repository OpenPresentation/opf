import assert from 'node:assert/strict';
import {unzipSync} from 'fflate';
import {renderSvgDeck} from '@openpresentation/opf-render';
import {toPptx} from '../dist/index.js';

// PptxGenJS ignores `pt` in shape `line` options and writes its 1 pt default
// (12700 EMU). Shape borders are declared with `width`, so the emitted a:ln w
// must equal the intended width, and match the preview's stroke width (1 CSS px
// = .75 pt = 9525 EMU unless the preview declares another). Table borders use
// the table API's own `pt` and are checked as a control.
const decoder = new TextDecoder();
const EMU_PT = 12700, PX_PT = .75;
const shapes = xml => [...xml.matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)].map(([shape]) => ({
  name: shape.match(/<p:cNvPr\b[^>]*\bname="([^"]*)"/)?.[1] ?? '',
  geometry: shape.match(/<a:prstGeom prst="(\w+)"/)?.[1],
  width: shape.match(/<a:ln(?: w="(\d+)")?>/)?.[1],
  hasLine: /<a:ln[ >]/.test(shape),
}));
const deck = dimensions => ({
  design: {contentBox: true, fontScheme: 'roboto', dimensions},
  slides: [
    {title: 'Card', metric: {value: 42, label: 'Latency'}},
    {title: 'Code', code: {source: 'const a = 1;', language: 'js'}},
    {title: 'Media', video: {src: 'https://example.com/v.mp4', title: 'Video'}},
    {title: 'Timeline', timeline: {events: [{when: 'Q1', what: 'Plan'}, {when: 'Q2', what: 'Build'}]}},
    {title: 'Unsupported chart source', chart: {type: 'column', data: {src: 'data.csv'}}},
    {title: 'Image', image: {src: 'https://example.invalid/missing.png', alt: 'Missing'}},
    {title: 'Table', table: {columns: ['A', 'B'], rows: [['1', '2']]}},
  ],
});
// Preview stroke width in px for the traced element of an item path; SVG's default is 1 px.
const previewPx = (svg, path, tag) => {
  const element = [...svg.matchAll(new RegExp(`<${tag} [^>]*>`, 'g'))].map(match => match[0]).find(open => open.includes(`data-opf-path="${path}"`) && open.includes('stroke='));
  assert.ok(element, `${path}: preview ${tag}`);
  return Number(element.match(/stroke-width="([\d.]+)"/)?.[1] ?? 1);
};
const emu = px => String(Math.round(px * PX_PT * EMU_PT));

let checked = 0;
for (const dimensions of [{widthInches: 1280 / 96, heightInches: 720 / 96}, {widthInches: 540 / 96, heightInches: 960 / 96}]) {
  const source = deck(dimensions);
  const previews = renderSvgDeck(source, {trace: true});
  const slides = Object.entries(unzipSync(await toPptx(source, {seed: 1}))).filter(([name]) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort(([a], [b]) => a.localeCompare(b, 'en', {numeric: true})).map(([, bytes]) => shapes(decoder.decode(bytes)));
  const named = (slide, name) => {
    const found = slides[slide].filter(shape => shape.name === name);
    assert.equal(found.length, 1, `${name}: one native shape`);
    return found[0];
  };
  const scale = Math.min(dimensions.widthInches, dimensions.heightInches) * 96 / 720;
  const expectations = [
    // [label, native shape, intended a:ln w in EMU]
    ['card', named(0, 'OPF card slides.0.metric'), emu(1)],
    ['code panel', named(1, 'OPF code 1 panel'), emu(previewPx(previews[1], 'slides.1.code', 'rect'))],
    ['media frame', named(2, 'OPF media slides.2.video frame'), emu(previewPx(previews[2], 'slides.2.video', 'rect'))],
    ['timeline connector', named(3, 'OPF timeline 0 connector'), emu(previewPx(previews[3], 'slides.3.timeline', 'line'))],
    ['unsupported payload rect', slides[4].find(shape => /^Shape \d+$/.test(shape.name) && shape.geometry === 'rect'), emu(previewPx(previews[4], 'slides.4.chart', 'rect'))],
    ['image placeholder', named(5, 'OPF image placeholder 1'), emu(1)],
  ];
  for (const [label, shape, expected] of expectations) {
    assert.ok(shape, `${label}: native shape found`);
    assert.equal(shape.width, expected, `${label}: a:ln w (${dimensions.widthInches.toFixed(2)} in wide)`);
    assert.notEqual(shape.width, '12700', `${label}: not PptxGenJS's 1 pt default`);
    checked++;
  }
  // Declared intents, independent of the preview.
  assert.equal(named(0, 'OPF card slides.0.metric').width, '9525');
  assert.equal(named(1, 'OPF code 1 panel').width, '9525');
  assert.equal(named(2, 'OPF media slides.2.video frame').width, '9525');
  assert.equal(named(3, 'OPF timeline 0 connector').width, String(Math.round(3 * scale * .75 * EMU_PT)), 'connector is 3 px scaled, in points');
  assert.equal(named(5, 'OPF image placeholder 1').width, '9525');
  // Control: table cell borders keep the table API's pt (0.75 pt = 9525 EMU).
  const table = decoder.decode(unzipSync(await toPptx(source, {seed: 1}))['ppt/slides/slide7.xml']);
  const borders = [...table.matchAll(/<a:ln[LRTB] w="(\d+)"/g)].map(match => match[1]);
  assert.ok(borders.length >= 4 && borders.every(width => width === '9525'), `table borders stay 0.75 pt: ${borders}`);
}
console.log(JSON.stringify({test: 'shape-border-widths', passed: true, checked}));
