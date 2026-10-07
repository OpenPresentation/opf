import assert from 'node:assert/strict';
import {strFromU8, unzipSync, zipSync} from 'fflate';
import {XMLValidator} from 'fast-xml-parser';
import * as opf from '@openpresentation/opf';
import {renderSvg} from '@openpresentation/opf-render/svg';
import {fromPptx, toPptx} from '../dist/index.js';

// FA-13: code.highlight, Watermark.text, TextRun.code, TextRun.lang and the 1:1, 4:5 and 9:16 presets, exported natively
// and imported back. Core owns the geometry and colours (codeHighlight*, layoutWatermark); this checks the package.

const exportDeck = async (document, options = {}) => {
  const diagnostics = [];
  const bytes = await toPptx(document, {...options, onDiagnostic: diagnostic => diagnostics.push(diagnostic)});
  const entries = unzipSync(new Uint8Array(bytes));
  const xml = Object.fromEntries(Object.entries(entries).filter(([name]) => /\.(xml|rels)$/.test(name)).map(([name, value]) => [name, strFromU8(value)]));
  for (const [name, text] of Object.entries(xml)) assert.equal(XMLValidator.validate(text), true, `${name} is well-formed XML`);
  return {bytes, entries, xml, diagnostics, slide: (index = 1) => xml[`ppt/slides/slide${index}.xml`]};
};
const importDeck = async (bytes, options = {}) => {
  const diagnostics = [];
  const document = await fromPptx(bytes, {...options, onDiagnostic: diagnostic => diagnostics.push(diagnostic)});
  return {document, diagnostics};
};
const codeOf = document => document.slides[0].code ?? document.slides[0].blocks?.[0]?.code;
const shapes = xml => [...xml.matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)].map(match => match[0]);
const named = (xml, pattern) => shapes(xml).filter(shape => pattern.test(shape.match(/<p:cNvPr\b[^>]*\bname="([^"]*)"/)?.[1] ?? ''));
const fill = shape => shape.match(/<p:spPr>[\s\S]*?<a:solidFill><a:srgbClr val="([0-9A-F]{6})"/)?.[1];
const runColor = shape => shape.match(/<a:rPr\b[\s\S]*?<a:solidFill><a:srgbClr val="([0-9A-F]{6})"/)?.[1];

// --- presets -----------------------------------------------------------------------------------------------------------
for (const [preset, cx, cy] of [['1:1', 6858000, 6858000], ['4:5', 6858000, 8572500], ['9:16', 6858000, 12192000]]) {
  for (const dimensions of [preset, {preset}]) {
    const {bytes, xml} = await exportDeck({design: {dimensions}, slides: [{title: 'Social', text: 'A square feed post.'}]});
    const size = xml['ppt/presentation.xml'].match(/<p:sldSz\b[^>]*\bcx="(\d+)"[^>]*\bcy="(\d+)"/);
    assert.deepEqual([Number(size[1]), Number(size[2])], [cx, cy], `${preset} p:sldSz`);
    // The exporter's document provenance restores the authored form while the slide size still matches.
    const {document} = await importDeck(bytes);
    assert.deepEqual(document.design.dimensions, dimensions, `${preset} imports as the authored ${typeof dimensions === 'string' ? 'string' : 'object'}`);
    assert.equal(opf.validatePresentation(document).valid, true);
    // Without the tags (a deck from another tool) the exact size imports as inches, which compose to the same canvas.
    const stripped = {...unzipSync(bytes)};
    for (const name of Object.keys(stripped)) if (/^ppt\/tags\//.test(name)) delete stripped[name];
    const bare = (await importDeck(zipSync(stripped))).document;
    assert.deepEqual(opf.resolveCanvasDimensions(bare.design.dimensions), opf.resolveCanvasDimensions(preset));
  }
}
{
  // Other sizes behave as before, and a custom size next to a social size is not mistaken for one.
  for (const dimensions of ['16:9', 'a4', {widthInches: 7.5, heightInches: 7.6}]) {
    const {bytes} = await exportDeck({design: {dimensions}, slides: [{title: 'T', text: 'x'}]});
    const {document} = await importDeck(bytes);
    assert.deepEqual(document.design.dimensions, dimensions);
  }
}

// --- code.highlight ----------------------------------------------------------------------------------------------------
const source = ['const a = 1;', 'const b = 2;', 'const c = a + b;', '', 'console.log(c);', 'return c;'].join('\n');
const codeDeck = highlight => ({design: {fontScheme: 'roboto'}, slides: [{title: 'Highlight', code: {source, language: 'ts', ...(highlight ? {highlight} : {})}}]});
const lineShapes = xml => named(xml, /^OPF code \d+ body line \d+$/);
{
  const {bytes, slide, diagnostics} = await exportDeck(codeDeck([2, [3, 3], 5]));
  assert.deepEqual(diagnostics.filter(item => item.code !== 'fonts-estimated'), [], 'no diagnostics');
  const xml = slide();
  const names = shapes(xml).map(shape => shape.match(/name="([^"]*)"/)[1]);
  const panel = names.findIndex(name => /^OPF code \d+ panel$/.test(name));
  const bands = names.map((name, index) => /^OPF code \d+ highlight \d+$/.test(name) ? index : -1).filter(index => index >= 0);
  const firstLine = names.findIndex(name => /body line 1$/.test(name));
  assert.equal(bands.length, 2, 'lines 2-3 are one band and line 5 another');
  assert.ok(panel < bands[0] && bands[1] < firstLine, 'the bands sit between the panel and the line text boxes');
  const bandShapes = named(xml, /highlight/);
  const bandFill = fill(bandShapes[0]);
  assert.match(bandFill, /^[0-9A-F]{6}$/);
  // The band covers lines 2 and 3 (and line 5) of the body.
  const lines = lineShapes(xml);
  const top = shape => Number(shape.match(/<a:off x="\d+" y="(\d+)"/)[1]);
  const height = shape => Number(shape.match(/<a:ext cx="\d+" cy="(\d+)"/)[1]);
  const [line1, line2, line3, line4, line5] = lines;
  assert.equal(top(bandShapes[0]), top(line2));
  assert.equal(top(bandShapes[0]) + height(bandShapes[0]), top(line3) + height(line3));
  assert.equal(top(bandShapes[1]), top(line5));
  assert.ok(top(line1) < top(bandShapes[0]) && top(line4) > top(bandShapes[0]) + height(bandShapes[0]) - 1);
  // Marked lines keep the syntax colours on the band (>= 4.5:1); the others are dimmed on the panel (>= 4.5:1).
  const colors = lines.map(runColor);
  for (const [index, line] of lines.entries()) {
    const marked = [1, 2, 4].includes(index);
    const colorsOfLine = [...line.matchAll(/<a:solidFill><a:srgbClr val="([0-9A-F]{6})"/g)].map(match => match[1]);
    for (const color of colorsOfLine) assert.ok(opf.colorContrast(`#${color}`, marked ? `#${bandFill}` : '#111827') >= 4.5, `line ${index + 1} ${color}`);
  }
  assert.notEqual(colors[0], colors[1], 'a marked line is not coloured like an unmarked one');
  // The band is not content and the highlight comes back with the source.
  const {document, diagnostics: importDiagnostics} = await importDeck(bytes);
  assert.deepEqual(codeOf(document), {source, language: 'ts', highlight: [2, [3, 3], 5]});
  assert.equal(importDiagnostics.filter(item => /watermark|provenance/.test(item.code) && /invalid/.test(item.code)).length, 0);
  assert.equal(JSON.stringify(document).includes('highlight 1'), false, 'no band shape imports as text');
}
{
  // Absent field: no band, no manifest field, the same shapes as before.
  const {slide, xml} = await exportDeck(codeDeck());
  assert.equal(named(slide(), /highlight/).length, 0);
  assert.equal(Object.keys(xml).filter(name => /tags\/opfCode/.test(name)).every(name => !xml[name].includes('bands')), true);
}
{
  // Removing a band in PowerPoint keeps the source and the highlight; a stale or malformed band is rejected.
  const {entries} = await exportDeck(codeDeck([2]));
  const withoutBand = {...entries};
  withoutBand['ppt/slides/slide1.xml'] = new TextEncoder().encode(strFromU8(entries['ppt/slides/slide1.xml']).replace(/<p:sp>(?:(?!<p:sp>)[\s\S])*?name="OPF code \d+ highlight 1"[\s\S]*?<\/p:sp>/, ''));
  const {document, diagnostics} = await importDeck(zipSync(withoutBand));
  assert.deepEqual(codeOf(document), {source, language: 'ts', highlight: [2]});
  assert.equal(diagnostics.some(item => item.code === 'invalid-code-provenance'), false);
}
{
  // A highlight past the last line draws nothing, validates with a warning, and exports.
  const {slide} = await exportDeck(codeDeck([40]));
  assert.equal(named(slide(), /highlight/).length, 0);
  assert.ok(opf.validatePresentation(codeDeck([40])).warnings.some(issue => issue.params.code === 'code-highlight-out-of-range'));
}

// --- Watermark.text ----------------------------------------------------------------------------------------------------
const textDeck = (watermark, slideDesign) => ({design: {fontScheme: 'roboto', ...(watermark === undefined ? {} : {watermark})}, slides: [{title: 'One', text: 'First', ...(slideDesign ? {design: slideDesign} : {})}, {title: 'Two', text: 'Second'}]});
{
  const {bytes, xml, slide} = await exportDeck(textDeck({text: 'DRAFT', opacity: 0.1}));
  for (const index of [1, 2]) {
    const marks = named(slide(index), /^OPF watermark text$/);
    assert.equal(marks.length, 1, `slide ${index} has one watermark`);
    const [mark] = marks;
    assert.match(mark, /<a:t>DRAFT<\/a:t>/);
    assert.match(mark, /rot="19800000"/, 'rotated 30 degrees counterclockwise');
    assert.match(mark, /<a:alpha val="10000"\/>/, 'opacity 0.1 is the text alpha');
    assert.match(mark, /\bb="1"/);
    assert.match(mark, /<a:latin typeface="Roboto"/, 'the heading font');
    // Centered on the slide.
    const x = Number(mark.match(/<a:off x="(\d+)"/)[1]), cx = Number(mark.match(/<a:ext cx="(\d+)"/)[1]);
    assert.ok(Math.abs(x + cx / 2 - 12192000 / 2) < 2, 'centered horizontally');
    // Beneath the content: the first shape of the tree.
    assert.equal(shapes(slide(index))[0], mark);
  }
  const tagParts = Object.keys(xml).filter(name => /^ppt\/tags\/opfWatermark\d+\.xml$/.test(name));
  assert.equal(tagParts.length, 2, 'one provenance tag per slide');
  // Import restores it as the deck's design.watermark, not as text content.
  const {document} = await importDeck(bytes);
  assert.deepEqual(document.design.watermark, {text: 'DRAFT', opacity: 0.1});
  assert.equal(document.slides.every(item => item.design === undefined), true);
  assert.equal(JSON.stringify(document.slides).includes('DRAFT'), false);
  assert.equal(opf.validatePresentation(document).valid, true);
}
{
  // The slide's own watermark replaces the deck's; false suppresses it; a string stays an image watermark.
  const {slide} = await exportDeck(textDeck({text: 'DRAFT', opacity: 0.1}, {watermark: {text: 'CONFIDENTIAL', opacity: 0.2}}));
  assert.match(named(slide(1), /^OPF watermark text$/)[0], /<a:t>CONFIDENTIAL<\/a:t>/);
  assert.match(named(slide(2), /^OPF watermark text$/)[0], /<a:t>DRAFT<\/a:t>/);
  const suppressed = await exportDeck(textDeck({text: 'DRAFT', opacity: 0.1}, {watermark: false}));
  assert.equal(named(suppressed.slide(1), /^OPF watermark text$/).length, 0);
  assert.equal(named(suppressed.slide(2), /^OPF watermark text$/).length, 1);
}
{
  // An edited watermark is ordinary text and is reported; the rest of the deck is untouched.
  const {entries} = await exportDeck(textDeck({text: 'DRAFT', opacity: 0.1}));
  const edited = {...entries};
  edited['ppt/slides/slide1.xml'] = new TextEncoder().encode(strFromU8(entries['ppt/slides/slide1.xml']).replace('<a:t>DRAFT</a:t>', '<a:t>FINAL</a:t>'));
  const {document, diagnostics} = await importDeck(zipSync(edited));
  assert.equal(diagnostics.some(item => item.code === 'invalid-watermark-provenance'), true);
  assert.equal(document.slides[0].design?.watermark, undefined);
}
{
  // Text and image watermark are one or the other.
  assert.equal(opf.validatePresentation(textDeck({text: 'DRAFT', src: 'asset:x', opacity: 0.1})).valid, false);
}

// --- TextRun.code and TextRun.lang -------------------------------------------------------------------------------------
const richDeck = (language, text) => ({...(language ? {language} : {}), design: {fontScheme: 'roboto'}, slides: [{title: 'Runs', text}]});
const runs = xml => [...xml.matchAll(/<a:r>(<a:rPr\b[\s\S]*?<\/a:rPr>)<a:t>([^<]*)<\/a:t><\/a:r>/g)].map(match => ({properties: match[1], text: match[2]}));
{
  const text = ['Run ', {text: 'npm install', code: true}, ' now'];
  const {bytes, slide} = await exportDeck(richDeck('en-US', text));
  const found = runs(slide());
  const code = found.find(run => run.text === 'npm install');
  assert.match(code.properties, /<a:latin typeface="Roboto Mono"/, 'the font scheme code family');
  assert.match(found.find(run => run.text === 'Run ').properties, /<a:latin typeface="Roboto"/);
  const {document} = await importDeck(bytes);
  assert.deepEqual(document.slides[0].text.map(run => typeof run === 'string' ? run : [run.text, run.code === true, run.fontFamily]), [['Run ', false, 'Roboto'], ['npm install', true, undefined], [' now', false, 'Roboto']]);
  assert.equal(opf.validatePresentation(document).valid, true);
}
{
  // A run's own fontFamily wins over code; a body-family run is not mistaken for code.
  const {slide} = await exportDeck(richDeck('en-US', [{text: 'x', code: true, fontFamily: 'Courier New'}]));
  assert.match(runs(slide()).find(run => run.text === 'x').properties, /<a:latin typeface="Courier New"/);
}
{
  const text = ['Hello ', {text: 'bonjour', lang: 'fr-FR'}, ' ', {text: 'hello', lang: 'en-US'}, {text: '日本語', lang: 'ja-JP'}, ' ', {text: '中文', lang: 'zh-CN'}];
  const {bytes, slide} = await exportDeck(richDeck('en-US', text));
  const found = runs(slide());
  const by = value => found.find(run => run.text === value).properties;
  assert.match(by('bonjour'), /lang="fr-FR" altLang="en-US"/);
  assert.match(by('Hello '), /lang="en-US"/);
  assert.doesNotMatch(by('Hello '), /altLang/);
  assert.match(by('hello'), /lang="en-US"/, 'a run in the deck language needs no override');
  assert.match(by('日本語'), /lang="ja-JP"/);
  assert.match(by('日本語'), /<a:ea typeface="Meiryo"\/>/, 'the Japanese East Asian face');
  assert.match(by('中文'), /lang="zh-CN"/);
  assert.match(by('中文'), /<a:ea typeface="Microsoft YaHei"\/>/, 'the Simplified Chinese face');
  assert.doesNotMatch(by('bonjour'), /<a:ea /, 'a Latin run keeps following the theme');
  const {document} = await importDeck(bytes);
  const imported = document.slides[0].text;
  const lang = value => imported.find(run => run.text === value)?.lang;
  assert.equal(lang('bonjour'), 'fr-FR');
  assert.equal(lang('日本語'), 'ja-JP');
  assert.equal(lang('中文'), 'zh-CN');
  assert.equal(lang('Hello '), undefined, 'a run in the deck language carries no lang');
  assert.equal(document.language, 'en-US');
}
{
  // A tag without a region is written with the language's curated OOXML tag, and a deck-language run is not overridden.
  const {slide} = await exportDeck(richDeck('ja-JP', ['日本語 ', {text: 'bonjour', lang: 'fr'}, {text: 'もう', lang: 'ja'}]));
  const found = runs(slide());
  assert.match(found.find(run => run.text === 'bonjour').properties, /lang="fr-FR" altLang="en-US"/);
  assert.doesNotMatch(found.find(run => run.text === 'もう').properties, /altLang/, 'ja is the deck language');
  assert.match(found.find(run => run.text === 'もう').properties, /lang="ja-JP"/);
  // An explicit en-US run in a Japanese deck stays en-US (the deck language never replaces it).
  const english = await exportDeck(richDeck('ja-JP', ['日本語 ', {text: 'English', lang: 'en-US'}]));
  assert.match(runs(english.slide()).find(run => run.text === 'English').properties, /lang="en-US" altLang="en-US"/);
}
{
  // Absent fields: a deck with neither field writes no altLang and no inline-code font.
  const {slide} = await exportDeck(richDeck('en-US', ['plain ', {text: 'bold', bold: true}]));
  assert.equal(slide().includes('altLang'), false);
}

{
  // The stamp is the readable text color of its own slide's background, the same color in the preview and the export, whether
  // the PPTX names it as sRGB or as a scheme color that resolves to exactly that color.
  const deck = {design: {fontScheme: 'roboto', watermark: {text: 'DRAFT', opacity: 0.15}}, slides: [
    {title: 'White', text: 'x', design: {background: '#FFFFFF'}}, {title: 'Dark', text: 'x', design: {background: '#0B1020'}}, {title: 'Default', text: 'x'}]};
  const {xml, slide} = await exportDeck(deck);
  const theme = xml['ppt/theme/theme1.xml'], map = xml['ppt/slideMasters/slideMaster1.xml'].match(/<p:clrMap\b[^>]*>/)[0];
  const slot = name => theme.match(new RegExp(`<a:${map.match(new RegExp(`\\b${name}="(\\w+)"`))[1]}>\\s*<a:srgbClr val="([0-9A-Fa-f]{6})"`))[1].toUpperCase();
  const seen = [];
  for (const index of [1, 2, 3]) {
    const mark = named(slide(index), /^OPF watermark text$/)[0];
    const color = mark.match(/<a:rPr\b[\s\S]*?<a:solidFill><a:(srgbClr|schemeClr) val="(\w+)"/);
    const exported = color[1] === 'srgbClr' ? color[2].toUpperCase() : slot(color[2]);
    const preview = renderSvg(deck, {slideIndex: index - 1}).match(/<text [^>]*fill="(#[0-9A-Fa-f]{6})"[^>]*>DRAFT/)[1].slice(1).toUpperCase();
    assert.equal(exported, preview, `slide ${index}: preview and export use one color`);
    seen.push(exported);
  }
  assert.equal(seen[0], '000000', 'dark text on the white slide');
  assert.equal(seen[1], 'FFFFFF', 'light text on the dark slide');
  const background = ['FFFFFF', '0B1020', undefined];
  for (const [index, color] of seen.entries()) if (background[index]) assert.ok(opf.colorContrast(`#${color}`, `#${background[index]}`) >= 4.5, `slide ${index + 1} is readable`);
}

console.log('FA-13: presets, code highlight, text watermark, inline code and run language export natively and import back.');
