// RR-34: footnotes, citations and captions. Native export (superscript marker runs, tagged footnote
// and caption text boxes at core's geometry), the preview-versus-PPTX parity of those boxes and
// marker numbers, and the round trip with and without provenance.
import assert from 'node:assert/strict';
import {unzipSync} from 'fflate';
import {renderSvg} from '@openpresentation/opf-render';
import {loadOfficeFontRegistry} from '@openpresentation/opf-render/fonts-node';
import {composeSlide} from '@openpresentation/opf';
import {toPptx, fromPptx} from '../dist/index.js';

const decoder = new TextDecoder();
const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9V3iWggAAAAASUVORK5CYII=';
const deck = () => ({
  name: 'RR-34',
  design: {fontScheme: 'roboto'},
  references: [{id: 'a', text: 'Source A, 2026', url: 'https://a.example'}, {id: 'b', text: ['Rich ', {text: 'B', bold: true}]}, {id: 'unused', text: 'Never cited'}],
  slides: [
    {title: 'Cites', text: [{text: 'Growth was strong', cite: 'a'}, ' and margins held', {text: '.', cite: ['a', 'b']}, {text: ' Note', footnote: 'An inline note.'}], design: {footer: {center: {text: 'Footer'}, right: {slideNumber: true}}}},
    {title: 'Caption', blocks: [{image: png, caption: 'Figure 1. A pixel'}, {table: {columns: ['A', 'B'], rows: [[1, 2]]}, caption: {text: ['Table ', {text: '1', bold: true}], position: 'above', align: 'center'}}]},
    {title: 'Bullets', bullets: [[{text: 'again', cite: 'b'}], 'plain'], notes: 'n'},
    {title: 'Root caption', chart: {type: 'bar', data: {columns: ['x', 'y'], rows: [['p', 1], ['q', 2]]}}, caption: 'Figure 2. Chart'},
  ],
});
const unzip = bytes => { const entries = unzipSync(bytes); return {entries, xml: index => decoder.decode(entries[`ppt/slides/slide${index + 1}.xml`])}; };
const shapes = xml => [...xml.matchAll(/<p:(sp|pic|graphicFrame|cxnSp)>[\s\S]*?<\/p:\1>/g)].map(([shape]) => ({
  raw: shape, name: shape.match(/<p:cNvPr\b[^>]*\bname="([^"]*)"/)?.[1] ?? '',
  text: [...shape.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map(match => match[1]).join(''),
  box: (match => match ? {x: Number(match[1]) / 9525, y: Number(match[2]) / 9525, width: Number(match[3]) / 9525, height: Number(match[4]) / 9525} : undefined)(shape.match(/<a:off x="(-?\d+)" y="(-?\d+)"\/><a:ext cx="(\d+)" cy="(\d+)"\/>/)),
}));
const markerRuns = xml => [...xml.matchAll(/<a:r><a:rPr\b([^>]*)>[\s\S]*?<a:t>([^<]*)<\/a:t><\/a:r>/g)].filter(match => /baseline="30000"/.test(match[1])).map(match => match[2]);
const tagRecords = (entries, prefix) => Object.keys(entries).filter(key => key.startsWith(`ppt/tags/${prefix}`)).sort().map(key => {
  const value = decoder.decode(entries[key]).match(/val="([0-9A-F]+)"/)[1];
  return JSON.parse(decoder.decode(Uint8Array.from(value.match(/../g), byte => parseInt(byte, 16))));
});
const close = (a, b, tolerance = 0.02) => Math.abs(a - b) <= tolerance;
// Ordinary body text comes back with its explicit native size, family and colour (the existing rich-text import); only the authored fields are compared.
const stripEngine = value => Array.isArray(value) ? value.map(run => {
  if (typeof run === 'string') return run;
  const kept = Object.fromEntries(Object.entries(run).filter(([key]) => !['fontSize', 'fontFamily', 'color'].includes(key)));
  return Object.keys(kept).length === 1 ? kept.text : kept;
}) : value;
let checks = 0;
const ok = (condition, message) => { assert.ok(condition, message); checks += 1; };

const fonts = await loadOfficeFontRegistry({fallbackFamily: 'Roboto', strictGlyphs: false});
for (const options of [{}, {textMeasurement: fonts.textMeasurement}]) {
  const source = deck();
  const diagnostics = [];
  const bytes = await toPptx(source, {seed: 1, ...options, onDiagnostic: diagnostic => diagnostics.push(diagnostic)});
  assert.deepEqual(diagnostics.filter(d => !/^chart/.test(d.code)), []);
  const {entries, xml} = unzip(bytes);
  const geometry = index => composeSlide(source.slides[index], {width: 1280, height: 720, presentation: source, slideIndex: index, layout: {id: 'blank'}, fonts: {heading: 'Roboto', body: 'Roboto', code: 'Roboto Mono'}, textMeasurement: options.textMeasurement, date: '2026-10-01'});

  // Markers: native superscript runs at baseline 30000 with the marker text, in order.
  assert.deepEqual(markerRuns(xml(0)), ['1', '1,2', '3']);
  assert.deepEqual(markerRuns(xml(2)), ['2']);
  ok(!/baseline="30000"/.test(xml(1)) && !/baseline="30000"/.test(xml(3)), 'slides without markers have no superscript runs');
  // Native check 2026-10-01 (PowerPoint 365 probe): a superscript run draws at 2/3 of its sz, so the marker is written at the size of the
  // run it marks (a user ticking Superscript) with baseline 30000 and no extra size reduction.
  {
    const runs = [...xml(0).matchAll(/<a:r><a:rPr\b([^>]*)>[\s\S]*?<a:t>([^<]*)<\/a:t><\/a:r>/g)].map(match => ({sz: match[1].match(/\bsz="(\d+)"/)?.[1], sup: /baseline="30000"/.test(match[1])}));
    const pairs = runs.map((run, index) => run.sup ? [runs[index - 1], run] : undefined).filter(Boolean);
    ok(pairs.length === 3 && pairs.every(([before, marker]) => before && before.sz === marker.sz), 'marker runs carry the size of the run they mark');
  }

  // Footnote area: rule plus one tagged text box per entry at core's boxes, above the footer placeholders.
  const core0 = geometry(0), native0 = shapes(xml(0));
  const rule = native0.find(shape => shape.name === 'OPF footnotes 0 rule');
  ok(rule && close(rule.box.x, core0.footnotes.rule.x) && close(rule.box.width, core0.footnotes.rule.width), 'rule at the area width');
  const entries0 = native0.filter(shape => /^OPF footnotes 0 entry \d+ line 0$/.test(shape.name));
  assert.deepEqual(entries0.map(shape => shape.text), ['1 Source A, 2026', '2 Rich B', '3 An inline note.']);
  for (const [index, shape] of entries0.entries()) {
    const entry = core0.footnotes.entries[index];
    // With measured outlines a line's accepted x carries core's raster clearance (placement.lines[0].x), as every measured text shape does.
    const lineX = entry.fit.placement?.lines[0]?.x ?? entry.box.x;
    ok(close(shape.box.x, lineX) && close(shape.box.width, entry.box.width) && close(shape.box.y, entry.box.y, 0.5) && close(shape.box.height, entry.box.height, 0.5), `entry ${index} box matches core (${JSON.stringify(shape.box)} vs ${JSON.stringify(entry.box)}, line x ${lineX})`);
  }
  const footer = native0.find(shape => shape.text === 'Footer');
  ok(footer && entries0.every(shape => shape.box.y + shape.box.height <= footer.box.y + 0.02), 'entries sit above the footer');
  const footnoteTags = tagRecords(entries, 'opfFootnotes');
  assert.deepEqual(footnoteTags.filter(tag => tag.role === 'entry' && tag.slide === 0).map(tag => [tag.entry, tag.number, tag.kind, tag.id, tag.source, tag.count]), [[0, 1, 'reference', 'a', 'references.0', 1], [1, 2, 'reference', 'b', 'references.1', 1], [2, 3, 'footnote', undefined, 'slides.0.text.3', 1]]);
  ok(footnoteTags.some(tag => tag.role === 'rule' && tag.slide === 0) && footnoteTags.some(tag => tag.slide === 2 && tag.number === 2), 'rule and bullet-slide tags');

  // Captions: one tagged text box per line at core's band, linked to the media shape.
  const core1 = geometry(1), native1 = shapes(xml(1));
  const image = native1.find(shape => shape.name === 'OPF image 1'), imageCaption = native1.find(shape => shape.name === 'OPF caption slides.1.blocks.0.image line 0');
  ok(image && close(image.box.height, core1.items[1].box.height) && close(image.box.y, core1.items[1].box.y), 'image uses the media box');
  const captionLineX = core1.items[1].caption.fit.placement?.lines[0]?.x ?? core1.items[1].caption.box.x;
  ok(imageCaption && imageCaption.text === 'Figure 1. A pixel' && close(imageCaption.box.x, captionLineX) && close(imageCaption.box.width, core1.items[1].caption.box.width) && close(imageCaption.box.y, core1.items[1].caption.box.y, 0.5), 'image caption at the band');
  const tableCaption = native1.find(shape => shape.name === 'OPF caption slides.1.blocks.1.table line 0'), table = native1.find(shape => shape.name === 'OPF table 1');
  ok(tableCaption && tableCaption.text === 'Table 1' && /algn="ctr"/.test(tableCaption.raw) && close(tableCaption.box.y, core1.items[2].caption.box.y, 0.5), 'centered table caption above');
  ok(table && table.box.y >= tableCaption.box.y + tableCaption.box.height - 0.02, 'table below its caption');
  const captionTags = tagRecords(entries, 'opfCaption');
  assert.deepEqual(captionTags.map(tag => [tag.path, tag.field, tag.media, tag.position, tag.align]).sort(), [['slides.1.blocks.0.image', 'slides.1.blocks.0.caption', 'OPF image 1', 'below', 'left'], ['slides.1.blocks.1.table', 'slides.1.blocks.1.caption', 'OPF table 1', 'above', 'center'], ['slides.3.chart', 'slides.3.caption', 'OPF chart 1', 'below', 'left']].sort());

  // Preview parity: the same boxes and marker numbers read from the SVG.
  const svg = index => renderSvg(source, {slideIndex: index, trace: true, date: '2026-10-01', ...options});
  const svg0 = svg(0), svg1 = svg(1);
  const previewMarkers = [...svg0.matchAll(/data-opf-marker="([^"]*)"/g)].map(match => match[1]);
  assert.deepEqual(previewMarkers, markerRuns(xml(0)), 'marker numbers agree');
  const previewBox = (markup, pattern) => { const attrs = markup.match(pattern)?.[0] ?? ''; return Object.fromEntries(['x', 'y', 'width', 'height'].map(key => [key, Number(attrs.match(new RegExp(`data-opf-box-${key}="([^"]*)"`))?.[1])])); };
  // The drawn text origin of a group: the first positioned <text x> after the group tag.
  const previewTextX = (markup, pattern) => { const start = markup.search(pattern); const text = markup.slice(start).match(/<text\b[^>]*\bx="([^"]*)"/); return Number(text?.[1]); };
  for (const [index, shape] of entries0.entries()) {
    const pattern = new RegExp(`<g[^>]*data-opf-footnote="${index + 1}"[^>]*>`), box = previewBox(svg0, pattern);
    ok(close(shape.box.x, previewTextX(svg0, pattern)) && close(shape.box.width, box.width) && close(shape.box.y, box.y, 0.5), `footnote ${index + 1} preview box matches native`);
  }
  const captionPattern = /<g[^>]*data-opf-caption="below"[^>]*>/, previewCaption = previewBox(svg1, captionPattern);
  ok(close(imageCaption.box.x, previewTextX(svg1, captionPattern)) && close(imageCaption.box.width, previewCaption.width) && close(imageCaption.box.y, previewCaption.y, 0.5), 'caption preview box matches native');

  // Round trip: cite, footnote, references (including uncited ones) and captions return.
  const imported = await fromPptx(bytes);
  assert.deepEqual(imported.references, source.references);
  assert.deepEqual(stripEngine(imported.slides[0].text), source.slides[0].text);
  assert.deepEqual(imported.slides[1].blocks.map(block => block.caption), ['Figure 1. A pixel', {text: ['Table ', {text: '1', bold: true}], position: 'above', align: 'center'}]);
  assert.deepEqual(stripEngine(imported.slides[2].bullets[0]), source.slides[2].bullets[0]);
  assert.equal(imported.slides[3].caption, 'Figure 2. Chart');
  ok(!JSON.stringify(imported).includes('"superscript":true'), 'no marker run survives import');
  ok(!imported.slides.some(slide => (slide.blocks ?? []).some(block => typeof block.text === 'string' && /^\d+ /.test(block.text))), 'listed notes are not text blocks');
}

// A cited text that wraps over several native lines is one payload again after import (the topology's soft-wrap
// record skips the marker fragments, which have no source text).
{
  const source = {design: {fontScheme: 'roboto'}, references: [{id: 'a', text: 'Source A'}], slides: [{title: 'Wrapped', text: [{text: 'Enterprise adoption doubled in 2025 and kept doubling through the following year as more teams adopted the format', cite: 'a'}, ', revenue grew 18% and headcount stayed flat', {text: ' across every region we measured in the period', cite: 'a'}, '.']}]};
  const diagnostics = [];
  const imported = await fromPptx(await toPptx(source, {seed: 1, textMeasurement: fonts.textMeasurement}), {onDiagnostic: diagnostic => diagnostics.push(diagnostic)});
  ok(!diagnostics.some(d => d.code === 'content-structure-changed'), 'wrapped cited text keeps its stored structure');
  assert.deepEqual(stripEngine(imported.slides[0].text), source.slides[0].text);
}

// References-only provenance: the deck record stores no references, so the list comes from the footnote boxes (cited ones only).
{
  const source = deck();
  const imported = await fromPptx(await toPptx(source, {seed: 1, provenance: 'references-only'}));
  assert.deepEqual(imported.references, [{id: 'a', text: 'Source A, 2026', url: 'https://a.example'}, {id: 'b', text: ['Rich ', {text: 'B', bold: true}]}]);
  // Without the content topology the slide imports as flat blocks.
  assert.deepEqual(stripEngine(imported.slides[0].text ?? imported.slides[0].blocks.find(block => block.text).text), source.slides[0].text);
  assert.equal(imported.slides[1].blocks.find(block => block.image).caption, 'Figure 1. A pixel');
}

// No provenance at all: markers stay superscript runs, listed notes and captions stay text blocks; nothing is guessed.
{
  const source = deck();
  const diagnostics = [];
  const imported = await fromPptx(await toPptx(source, {seed: 1, provenance: false}), {onDiagnostic: diagnostic => diagnostics.push(diagnostic)});
  ok(imported.references === undefined, 'no references without tags');
  ok(imported.slides.every(slide => !JSON.stringify(slide).includes('"cite"') && !JSON.stringify(slide).includes('"footnote"') && !JSON.stringify(slide).includes('"caption"')), 'no cite, footnote or caption without tags');
  ok(JSON.stringify(imported.slides[0]).includes('"superscript":true'), 'marker runs kept as superscript');
  ok(!diagnostics.some(d => /caption|footnote/.test(d.code)), 'no annotation diagnostics without tags');
}

// An edited note keeps its edited text; a caption whose media was deleted becomes a text block.
{
  const source = deck();
  const bytes = await toPptx(source, {seed: 1});
  const {entries} = unzip(bytes);
  const slide1 = decoder.decode(entries['ppt/slides/slide1.xml']).replace('>1 Source A, 2026<', '>1 Source A, revised 2026<');
  const slide2 = decoder.decode(entries['ppt/slides/slide2.xml']).replace(/<p:pic>[\s\S]*?<\/p:pic>/, '');
  const {zipSync} = await import('fflate');
  const edited = zipSync({...entries, 'ppt/slides/slide1.xml': new TextEncoder().encode(slide1), 'ppt/slides/slide2.xml': new TextEncoder().encode(slide2)});
  const diagnostics = [];
  const imported = await fromPptx(edited, {onDiagnostic: diagnostic => diagnostics.push(diagnostic)});
  assert.equal(imported.references[0].text, 'Source A, revised 2026');
  ok(diagnostics.some(d => d.code === 'reference-text-changed' && d.path === 'references.0'), 'edited note reported');
  ok(diagnostics.some(d => d.code === 'caption-detached'), 'detached caption reported');
  ok(imported.slides[1].blocks.some(block => block.text === 'Figure 1. A pixel'), 'detached caption text kept as a text block');
}

// A deck without the fields exports the same bytes as before this change would: no tags, no extra shapes.
{
  const plain = {name: 'Plain', slides: [{title: 'T', text: 'Body', design: {footer: {center: {text: 'Footer'}}}}, {title: 'I', blocks: [{image: png}]}]};
  const {entries, xml} = unzip(await toPptx(plain, {seed: 1}));
  ok(!Object.keys(entries).some(key => /opfCaption|opfFootnotes/.test(key)), 'no annotation tags');
  ok(!/OPF caption|OPF footnotes|baseline="30000"/.test(xml(0) + xml(1)), 'no annotation shapes');
}

console.log(`Annotations passed: ${checks} native export, parity and round-trip checks.`);
