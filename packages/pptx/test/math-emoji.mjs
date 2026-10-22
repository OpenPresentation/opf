// FF-45: Cambria Math and Segoe UI Emoji in the PPTX. Export writes the chosen family and the authors' characters unchanged
// (emoji ZWJ sequences, flags, keycaps and variation selectors; math alphanumerics and operators), whatever face the preview
// substitutes. Import keeps emoji intact, and an OMML equation (an a14:m math zone, which OPF cannot model) is imported as
// its fallback text with a `math-equation-flattened` diagnostic rather than dropped silently.
import assert from 'node:assert/strict';
import {strFromU8, strToU8, unzipSync, zipSync} from 'fflate';
import {loadFonts} from '@openpresentation/opf-render/fonts-node';
import {fromPptx, toPptx} from '../dist/index.js';
import {nativeShapeParagraphs} from '../src/code-provenance.js';

// The installed renderer may predate the emoji and math packs: aliases and lenient glyphs keep measurement working here, and
// neither changes what the exporter writes.
const options = {fonts: await loadFonts({pack: 'office', strictGlyphs: false, aliases: {'Cambria Math': 'Caladea', 'Segoe UI Emoji': 'Roboto'}})};
const EMOJI = ['\u{1F680}', '\u{1F468}‍\u{1F469}‍\u{1F467}‍\u{1F466}', '\u{1F1E9}\u{1F1EA}', '\u{1F44D}\u{1F3FD}', '1️⃣', '❤️', '❤︎', '\u{1F3F4}\u{E0067}\u{E0062}\u{E0073}\u{E0063}\u{E0074}\u{E007F}'];
const MATH = '∑ ∫ √ \u{1D44E}\u{1D44F} ℝ ≤ ∞ αβ';
const deck = (family, title, text) => ({$schema: 'https://openpresentation.org/schema/opf/v1', name: 'FF-45', design: {fontScheme: {id: 'aptos', heading: family, body: family}}, slides: [{title, text}]});
const typefaces = xml => [...new Set([...xml.matchAll(/typeface="([^"]*)"/g)].map(match => match[1]).filter(name => name && !name.startsWith('+')))];
const texts = xml => [...xml.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map(match => match[1]);
const unescape = value => value.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');

// 1. Export keeps the chosen family and the original characters.
for (const [family, title, text] of [['Segoe UI Emoji', `Launch ${EMOJI.join(' ')}`, `Body ${EMOJI[1]}`], ['Cambria Math', MATH, 'f(x) = ∫ g(t) dt']]) {
  const entries = unzipSync(await toPptx(deck(family, title, text), options));
  const slide = strFromU8(entries['ppt/slides/slide1.xml']), theme = strFromU8(entries['ppt/theme/theme1.xml']);
  assert.deepEqual(typefaces(slide), [family], `${family}: every run names the chosen family`);
  assert.equal(theme.match(/<a:majorFont><a:latin typeface="([^"]*)"/)?.[1], family);
  assert.equal(theme.match(/<a:minorFont><a:latin typeface="([^"]*)"/)?.[1], family);
  const drawn = texts(slide).map(unescape);
  assert.ok(drawn.includes(title) && drawn.includes(text), `${family}: the title and body are written unchanged: ${JSON.stringify(drawn)}`);
  for (const sequence of family === 'Segoe UI Emoji' ? EMOJI : [MATH]) assert.ok(slide.includes(sequence), `${family}: ${JSON.stringify(sequence)} is in the slide XML byte for byte`);
  // Round trip: the characters come back intact (ZWJ, variation selectors and tag characters included).
  const imported = await fromPptx(zipSync(entries));
  assert.equal(imported.slides[0].title, title);
  assert.ok(JSON.stringify(imported.slides[0]).includes(JSON.stringify(text).slice(1, -1)), `${family}: body text survives the round trip`);
}

// 2. Import of a native OMML equation. PowerPoint writes an equation paragraph as mc:AlternateContent whose mc:Choice holds the
// a14:m math zone (m:oMathPara) and whose mc:Fallback holds plain runs. OPF has no equation model: the fallback text is imported
// and the lost layout is diagnosed. Without fallback runs the equation's m:t text is imported in order.
const base = unzipSync(await toPptx(deck('Cambria Math', 'Equation', 'Body'), options));
const xml = strFromU8(base['ppt/slides/slide1.xml']);
const titleRun = xml.match(/<a:r>(?:(?!<\/a:r>).)*?<a:t>Equation<\/a:t><\/a:r>/s)?.[0];
assert.ok(titleRun, 'the exported title run is found');
const omml = '<m:oMathPara xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"><m:oMath><m:f><m:num><m:r><m:t>a</m:t></m:r></m:num><m:den><m:r><m:t>b</m:t></m:r></m:den></m:f><m:r><m:t>+</m:t></m:r><m:rad><m:deg/><m:e><m:r><m:t>x</m:t></m:r></m:e></m:rad></m:oMath></m:oMathPara>';
const zone = fallback => `<mc:AlternateContent xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"><mc:Choice xmlns:a14="http://schemas.microsoft.com/office/drawing/2010/main" Requires="a14"><a14:m>${omml}</a14:m></mc:Choice><mc:Fallback>${fallback}</mc:Fallback></mc:AlternateContent>`;
const withZone = fallback => { const entries = unzipSync(zipSync(base)); entries['ppt/slides/slide1.xml'] = strToU8(xml.replace(titleRun, zone(fallback))); return zipSync(entries); };
{
  const diagnostics = [];
  const imported = await fromPptx(withZone(titleRun.replace('<a:t>Equation</a:t>', '<a:t>a/b+√x</a:t>')), {onDiagnostic: item => diagnostics.push(item)});
  assert.equal(imported.slides[0].title, 'a/b+√x', 'the fallback text is imported');
  const flattened = diagnostics.filter(item => item.code === 'math-equation-flattened');
  assert.equal(flattened.length, 1);
  assert.deepEqual([flattened[0].path, /1 OMML equation \(a14:m\)/.test(flattened[0].message), /no equation model/.test(flattened[0].message)], ['slides.0', true, true]);
}
{
  const diagnostics = [];
  const imported = await fromPptx(withZone(''), {onDiagnostic: item => diagnostics.push(item)});
  assert.equal(imported.slides[0].title, 'ab+x', 'without fallback runs the m:t text is imported in order');
  assert.equal(diagnostics.filter(item => item.code === 'math-equation-flattened').length, 1);
}
// The ordered reader (provenance and furniture) agrees with the keyed one.
const paragraphs = nativeShapeParagraphs(xml.replace(titleRun, zone('')));
const equation = paragraphs.flat().find(paragraph => paragraph.math);
assert.deepEqual(equation && {text: equation.text, math: equation.math}, {text: 'ab+x', math: {zones: 1, text: 'ab+x'}});
// Before FF-45 the paragraph was dropped silently: no run under a:p, nothing read, no diagnostic. The reader never reports a math zone where there is none.
assert.ok(nativeShapeParagraphs(xml).flat().every(paragraph => !paragraph.math));
console.log(`PPTX math and emoji: ${EMOJI.length} emoji sequences and the math corpus exported with their chosen families and characters; OMML equations import as fallback text with a diagnostic.`);
