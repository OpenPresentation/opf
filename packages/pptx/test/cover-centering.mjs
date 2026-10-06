import assert from 'node:assert/strict';
import {XMLParser} from 'fast-xml-parser';
import {unzipSync} from 'fflate';
import {toPptx} from '../dist/index.js';
import {resolvePresentation} from '@openpresentation/opf-render';
import {loadOfficeFontRegistry} from '@openpresentation/opf-render/fonts-node';

// Core centers the heading group of cover slides (no body payload on a
// heading-only layout). Native line shapes must sit where core accepted them:
// every `a:off` y equals the composed line origin, so the recentered group is
// what PowerPoint opens. Content slides keep their top-aligned headings.
const fonts = await loadOfficeFontRegistry({substitutionPolicy: 'none'});
const parser = new XMLParser({ignoreAttributes: false, attributeNamePrefix: '', parseTagValue: false, trimValues: false});
const array = value => value === undefined ? [] : Array.isArray(value) ? value : [value];
const nativeText = shape => array(shape['p:txBody']?.['a:p']).map(p => array(p['a:r']).map(r => r['a:t'] ?? '').join('')).join('\n');
const near = (actual, expected, label, tolerance = .002) => assert.ok(Math.abs(actual - expected) < tolerance, `${label}: ${actual} vs ${expected}`);
const deck = {design: {fontScheme: {id: 'carlito', heading: {family: 'Carlito'}, body: {family: 'Carlito'}}, header: {left: {text: 'Header'}}, footer: {right: {slideNumber: true}}}, slides: [
  {layout: 'title-subtitle', tag: 'Kickoff', title: 'A cover title', subtitle: 'A supporting line'},
  {layout: 'title', title: 'A cover title that is long enough to wrap onto a second line when drawn at the cover size'},
  {layout: 'text-1x', title: 'Content title', text: 'Body text stays below the title.'},
]};
let cover = 0, lines = 0;
for (const options of [{}, {textMeasurement: fonts.textMeasurement}]) {
  const resolved = resolvePresentation(deck, options).slides;
  const zip = unzipSync(await toPptx(deck, options));
  for (const [index, bound] of resolved.entries()) {
    const xml = new TextDecoder().decode(zip[`ppt/slides/slide${index + 1}.xml`]);
    const shapes = array(parser.parse(xml)['p:sld']['p:cSld']['p:spTree']['p:sp']).filter(shape => nativeText(shape) && /^OPF heading /.test(shape['p:nvSpPr']['p:cNvPr'].name));
    const headings = bound.geometry.items.filter(item => ['tag', 'title', 'subtitle'].includes(item.field));
    // Measured hosts accept per-line placements; estimated hosts stack lines from the box origin.
    const expected = headings.flatMap(item => item.text.lines.map((_, line) => ({item, placed: item.text.placement?.lines[line], line})));
    assert.equal(shapes.length, expected.length, `slide ${index}: one native heading shape per accepted line`);
    let first = Infinity, last = -Infinity;
    for (const [i, shape] of shapes.entries()) {
      const {item, placed, line} = expected[i], transform = shape['p:spPr']['a:xfrm'];
      const x = Number(transform['a:off'].x) / 9525, y = Number(transform['a:off'].y) / 9525, height = Number(transform['a:ext'].cy) / 9525;
      const want = placed ? (item.text.richLines?.[line] ? placed.y : placed.baseline - item.text.fontSize) : item.box.y + line * item.text.lineHeight;
      near(y, want, `slide ${index} ${item.field} line ${line} a:off y`);
      // The native line stays inside the composed heading box, wherever core put it.
      assert.ok(y >= item.box.y - .002 && y + height <= item.box.y + item.box.height + .002, `slide ${index} ${item.field} line ${line} inside its box`);
      assert.ok(x >= item.box.x - .002, `slide ${index} ${item.field} x`);
      first = Math.min(first, y); last = Math.max(last, y + height); lines++;
    }
    const height = bound.geometry.height, gap = height / 30, padding = .08 * Math.min(bound.geometry.width, height), furniture = bound.geometry.furniture;
    const top = Math.max(padding, furniture.headerBottom + gap * .5), bottom = Math.min(height - padding, furniture.footerTop - gap * .5);
    if (index < 2) {
      // Cover: the native group is centered between the header and footer furniture within the line-box slack.
      const boxTop = headings[0].box.y, boxBottom = headings.at(-1).box.y + headings.at(-1).box.height;
      near((boxTop + boxBottom) / 2, (top + bottom) / 2, `slide ${index} composed group center`, .01);
      near((first + last) / 2, (top + bottom) / 2, `slide ${index} native group center`, 6);
      assert.ok(first > top + 40, `slide ${index}: the cover is not stuck at the top`);
      cover++;
    } else near(headings[0].box.y, top, 'content title keeps the top origin', .01);
    // Title and subtitle share x and width, so a shared left edge survives centering.
    if (headings.length > 1) for (const item of headings) { near(item.box.x, headings[0].box.x, `${item.path} x`); near(item.box.width, headings[0].box.width, `${item.path} width`); }
  }
}
assert.equal(cover, 4);
console.log(`Cover centering passed ${lines} native line placements on ${cover} covers.`);
