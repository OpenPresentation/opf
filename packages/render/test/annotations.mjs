// RR-34: footnotes, citations and captions in the preview. Markers are superscript marker segments
// without source offsets, the footnote area and caption bands draw at core's geometry, and a deck
// without the fields renders exactly as before.
import assert from 'node:assert/strict';
import { composeSlide } from '@openpresentation/opf/composition';
import {toSvg} from '../dist/index.js';

const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9V3iWggAAAAASUVORK5CYII=';
const deck = () => ({
  references: [{ id: 'a', text: 'Source A, 2026', url: 'https://a.example' }, { id: 'b', text: ['Rich ', { text: 'B', bold: true }] }, { id: 'unused', text: 'Never' }],
  slides: [
    { title: 'Cites', text: [{ text: 'Growth was strong', cite: 'a', link: 'https://x.example' }, ' and margins held', { text: '.', cite: ['a', 'b'] }, { text: ' Note', footnote: 'An inline note.' }], design: { footer: { center: { text: 'Footer' } } } },
    { title: 'Caption', blocks: [{ image: png, caption: 'Figure 1. A pixel' }, { table: { columns: ['A', 'B'], rows: [[1, 2]] }, caption: { text: ['Table ', { text: '1', bold: true }], position: 'above', align: 'center' } }] },
    { title: 'Plain', text: 'Nothing cited here' },
    { title: 'Bullets', bullets: [[{ text: 'again', cite: 'b' }]] },
  ],
});
const attrs = element => Object.fromEntries([...element.matchAll(/([\w:-]+)="([^"]*)"/g)].map(match => [match[1], match[2]]));
const elements = (svg, pattern) => [...svg.matchAll(pattern)].map(match => ({ raw: match[0], ...attrs(match[0]) }));
const number = value => Number(value);
let checks = 0;
const ok = (condition, message) => { assert.ok(condition, message); checks += 1; };

const document = deck();
const diagnostics = [];
const svg = index => toSvg(document, index + 1, { trace: true, onDiagnostic: diagnostic => diagnostics.push(diagnostic) });
// Core's geometry for a slide with no layout record (automatic composition), as the preview composes these slides.
const geometry = index => composeSlide(document.slides[index], { presentation: document, slideIndex: index });

// Markers: superscript marker segments after their run, no source offsets, no link.
{
  const slide = svg(0), core = geometry(0);
  const markers = elements(slide, /<tspan[^>]*data-opf-segment="marker"[^>]*>[^<]*<\/tspan>/g);
  assert.deepEqual(markers.map(marker => marker['data-opf-marker']), ['1', '1,2', '3']);
  for (const marker of markers) {
    ok(marker.raw.endsWith(`>${marker['data-opf-marker']}</tspan>`), 'marker text');
    assert.equal(marker['font-size'], '16.667'); // 2/3 of the 25 px body: PowerPoint draws a superscript at 2/3 of its size (native probe 2026-10-01)
    assert.equal(marker['baseline-shift'], '7.5'); // raised 0.3 of the nominal (marked run) size
    ok(!('data-opf-text-start' in marker) && !('data-opf-text-end' in marker), 'a marker has no source offsets');
    ok(!('text-decoration' in marker), 'a marker is not decorated');
  }
  ok(!/<a [^>]*>[^<]*<tspan[^>]*data-opf-segment="marker"/.test(slide), 'a marker is outside the run link');
  const text = elements(slide, /<tspan[^>]*data-opf-text-start="[^"]*"[^>]*>/g).map(run => [number(run['data-opf-text-start']), number(run['data-opf-text-end'])]);
  assert.deepEqual(text, [[0, 17], [17, 34], [34, 35], [35, 40]], 'run offsets are those of the authored runs');
  const fragments = core.items.find(item => item.field === 'text').text.richLines[0].fragments.filter(fragment => fragment.kind === 'marker').map(fragment => fragment.text);
  assert.deepEqual(fragments, ['1', '1,2', '3']);
  // The footnote area draws at core's box, after the content and before the footer furniture.
  const area = elements(slide, /<g[^>]*data-opf-footnotes="slides\.0"[^>]*>/g)[0];
  ok(area, 'footnote area present');
  for (const key of ['x', 'y', 'width', 'height']) assert.equal(number(area[`data-opf-box-${key}`]), core.footnotes.box[key]);
  const entries = elements(slide, /<g[^>]*data-opf-footnote="\d+"[^>]*>/g);
  assert.deepEqual(entries.map(entry => [entry['data-opf-footnote'], entry['data-opf-footnote-kind'], entry['data-opf-footnote-source'], entry['data-opf-footnote-id']]), [['1', 'reference', 'references.0', 'a'], ['2', 'reference', 'references.1', 'b'], ['3', 'footnote', 'slides.0.text.3', undefined]]);
  for (const [index, entry] of entries.entries()) for (const key of ['x', 'y', 'width', 'height']) assert.equal(number(entry[`data-opf-box-${key}`]), core.footnotes.entries[index].box[key]);
  ok(slide.includes('>1 Source A, 2026</text>'), 'reference text listed with its number');
  ok(/>2 <\/tspan><tspan[^>]*>Rich <\/tspan><tspan[^>]*font-weight="700"[^>]*>B<\/tspan>/.test(slide), 'a rich reference keeps its runs after the number');
  ok(slide.includes('>3 An inline note.</text>'), 'inline footnote listed');
  const rule = elements(slide, /<line [^>]*>/g).find(line => number(line.x1) === core.footnotes.rule.x);
  ok(rule && number(rule.x2) === core.footnotes.rule.x + core.footnotes.rule.width && rule['stroke-width'] === '1', 'rule spans the area');
  ok(!/data-opf-path="references\.|data-opf-path="slides\.0\.text\.3"/.test(slide.slice(slide.indexOf('data-opf-footnotes'))), 'listed lines carry no source path');
  const order = [slide.indexOf('data-opf-path="slides.0.text"'), slide.indexOf('data-opf-footnotes='), slide.indexOf('data-opf-furniture-kind="footer"')];
  ok(order[0] < order[1] && order[1] < order[2], 'content, then footnotes, then furniture');
  ok(core.footnotes.box.y + core.footnotes.box.height <= core.furniture.footerTop, 'area above the footer band');
}

// Captions: the media draws in the media box and the band after it, at core's boxes.
{
  const slide = svg(1), core = geometry(1);
  const image = elements(slide, /<image [^>]*>/g)[0], imageItem = core.items[1];
  for (const key of ['x', 'y', 'width', 'height']) assert.equal(number(image[key]), imageItem.box[key]);
  const bands = elements(slide, /<g[^>]*data-opf-caption="(below|above)"[^>]*>/g);
  assert.deepEqual(bands.map(band => [band['data-opf-caption'], band['data-opf-caption-of']]), [['below', 'slides.1.blocks.0.image'], ['above', 'slides.1.blocks.1.table']]);
  for (const [index, band] of bands.entries()) for (const key of ['x', 'y', 'width', 'height']) assert.equal(number(band[`data-opf-box-${key}`]), core.items[index + 1].caption.box[key]);
  ok(slide.includes('data-opf-path="slides.1.blocks.0.caption"') && slide.includes('>Figure 1. A pixel</text>'), 'string caption traced at its field');
  ok(slide.includes('data-opf-path="slides.1.blocks.1.caption.text"'), 'object caption traces its text');
  ok(/<text[^>]*text-anchor="middle"[^>]*><tspan[^>]*>Table <\/tspan><tspan[^>]*font-weight="700"[^>]*>1<\/tspan>/.test(slide), 'rich centered caption');
  const tableTexts = elements(slide, /<text[^>]*data-opf-path="slides\.1\.blocks\.1\.table[^"]*"[^>]*>/g);
  ok(tableTexts.every(text => number(text.y) > core.items[2].caption.box.y + core.items[2].caption.box.height), 'table cells sit below the caption band above them');
}

// Bullets carry markers too; a slide without markers has no area; the fields change nothing else.
{
  const slide = svg(3);
  assert.deepEqual(elements(slide, /<tspan[^>]*data-opf-segment="marker"[^>]*>/g).map(marker => marker['data-opf-marker']), ['2']);
  ok(slide.includes('data-opf-footnotes="slides.3"') && slide.includes('>2 </tspan>'), 'bullet slide lists its reference');
  const plain = svg(2);
  ok(!plain.includes('data-opf-footnotes') && !plain.includes('data-opf-caption') && !plain.includes('data-opf-segment="marker"'), 'nothing drawn without markers');
  const without = { ...document, references: undefined, slides: [document.slides[2]] };
  assert.equal(toSvg(without, 1, { trace: true }).replace(/slides\.0/g, 'slides.2'), plain.replace(/slides\.2/g, 'slides.2'));
  assert.deepEqual(diagnostics, []);
}

console.log(`Annotations passed: ${checks} marker, footnote area and caption checks.`);
