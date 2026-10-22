import assert from 'node:assert/strict';
import {XMLParser} from 'fast-xml-parser';
import {strFromU8, unzipSync} from 'fflate';
import {loadFonts} from '@openpresentation/opf-render/fonts-node';
import {catalogs, fromPptx, resolvePresentation, toPptx} from './helpers/default-catalog.mjs';

// opf-pptx#169: `toPptx` with the font registry's text measurement (the `loadFonts()` handle passed as `fonts`) threw
// `missing-glyph` where the preview drew the deck, because each run was measured with one face. Since RR-59 the exporter
// measures every slide through the renderer's script planner (`createScriptFonts`), the same per-character glyph fallback
// and symbol code-table mapping the preview uses. This test covers the issue's three patterns with the issue's setup
// (office pack, visual policy, `scripts: 'auto'`): each deck exports, no `missing-glyph` is thrown, and every native text
// line sits where the preview places it with the same text and size (FF-38 parity; the text wraps, so the line breaks
// compare the measured advances too).
//  1. A Latin role face measures a non-Latin run: Ethiopic, Armenian and Georgian.
//  2. Symbol-encoded families with private-use codes (FF-45): Symbol, Wingdings and Webdings runs and scheme roles.
//  3. Mixed emoji and Latin text: a Segoe UI Emoji scheme with Latin letters, and emoji inside an Aptos deck.

const parser = new XMLParser({ignoreAttributes: false, attributeNamePrefix: '', parseTagValue: false, trimValues: false});
const array = value => value === undefined ? [] : Array.isArray(value) ? value : [value];
const text = shape => array(shape['p:txBody']?.['a:p']).map(p => array(p['a:r']).map(run => run['a:t'] ?? '').join('')).join('\n');
const near = (actual, expected, label) => assert.ok(Math.abs(actual - expected) < .002, `${label}: ${actual} vs ${expected}`);
const repeat = (value, count) => Array.from({length: count}, () => value).join(' ');
const scheme = family => ({major: family, minor: family});

const decks = [
  // 1. Script text in a Latin or body face's role.
  [1, {name: 'Ebrima (Amharic)', language: 'am', design: {fontScheme: scheme('Ebrima')}, slides: [{title: 'አማርኛ ርዕስ', text: repeat('ሰላም ዓለም', 30)}]}],
  [1, {name: 'Sylfaen (Armenian)', language: 'hy', design: {fontScheme: 'sylfaen'}, slides: [{title: 'Հայերեն վերնագիր', text: repeat('Բարեւ աշխարհ', 30)}]}],
  [1, {name: 'Sylfaen (Georgian)', language: 'ka', design: {fontScheme: 'sylfaen'}, slides: [{title: 'ქართული სათაური', text: repeat('ეს ჩემი სახლი', 30)}]}],
  [1, {name: 'Armenian in an Aptos deck', slides: [{title: 'Report Հայերեն', text: repeat('Latin Բարեւ աշխարհ text', 20)}]}],
  // 2. Private-use symbol codes in runs that name the symbol family.
  [2, {name: 'Symbol runs', slides: [{title: 'Symbols', text: Array.from({length: 30}, () => [{text: ' check '}, {text: '\uF0FC\uF041', fontFamily: 'Wingdings'}, {text: '\uF061\uF062', fontFamily: 'Symbol'}, {text: '\uF061', fontFamily: 'Webdings'}]).flat()}]}],
  // 3. Emoji and Latin in one run.
  [3, {name: 'Segoe UI Emoji', design: {fontScheme: scheme('Segoe UI Emoji')}, slides: [{title: 'A launch \u{1F680}', text: repeat('Body \u{1F44D} text', 30)}]}],
  [3, {name: 'Emoji inside an Aptos deck', design: {fontScheme: 'aptos'}, slides: [{title: 'Launch \u{1F680}', text: repeat('Body \u{1F44D} text Հայ', 30)}]}],
];
// 2. A symbol-encoded scheme role: the export maps the codes. The preview of 0.18.0 resolves the role to the open symbol
// face before measuring, which drops the encoding, so it throws `missing-glyph` on these decks (an opf-render gap). Parity
// is asserted once the preview draws them.
const symbolSchemes = [
  [2, {name: 'Wingdings scheme', design: {fontScheme: scheme('Wingdings')}, slides: [{title: '\uF041\uF04A', text: repeat('\uF041\uF04A\uF0FC', 40)}]}],
  [2, {name: 'Symbol scheme', design: {fontScheme: scheme('Symbol')}, slides: [{title: '\uF061\uF062\uF067', text: repeat('\uF061\uF062\uF067 abg', 40)}]}],
  [2, {name: 'Webdings scheme', design: {fontScheme: scheme('Webdings')}, slides: [{title: '\uF061\uF062', text: repeat('\uF061\uF062', 40)}]}],
];

const fontsFor = deck => loadFonts({pack: 'office', substitutionPolicy: 'visual', scripts: 'auto', presentation: deck, renderOptions: {catalogs}});
const exported = async (deck, fonts) => {
  const diagnostics = [];
  const bytes = await toPptx(structuredClone(deck), {fonts, onDiagnostic: diagnostic => diagnostics.push(diagnostic)});
  return {bytes, entries: unzipSync(bytes), diagnostics};
};

const parity = (deck, bound, entries) => {
  for (let index = 0; index < deck.slides.length; index++) {
    const xml = strFromU8(entries[`ppt/slides/slide${index + 1}.xml`]);
    const shapes = array(parser.parse(xml)['p:sld']['p:cSld']['p:spTree']['p:sp']).filter(shape => text(shape));
    const expected = bound.slides[index].geometry.items.flatMap(item => item.text?.placement?.lines?.map((placed, line) => ({item, placed, line})) ?? []);
    assert.ok(expected.length > 2, `${deck.name}: the text wraps, so line breaks compare measured advances`);
    assert.equal(shapes.length, expected.length, `${deck.name}: one native text shape per previewed line`);
    for (const [position, shape] of shapes.entries()) {
      const {item, placed, line} = expected[position];
      const transform = shape['p:spPr']['a:xfrm'];
      near(Number(transform['a:off'].y) / 9525, placed.y ?? placed.baseline - item.text.fontSize, `${deck.name}: line ${position + 1} top`);
      near(Number(transform['a:ext'].cy) / 9525, placed.height, `${deck.name}: line ${position + 1} height`);
      assert.equal(text(shape), item.text.lines[line], `${deck.name}: line ${position + 1} breaks where the preview breaks`);
      for (const run of array(shape['p:txBody']['a:p']).flatMap(p => array(p['a:r']))) near(Number(run['a:rPr'].sz) / 100, item.text.fontSize * .75, `${deck.name}: line ${position + 1} size`);
    }
  }
};

const covered = new Set();
for (const [pattern, deck] of decks) {
  const fonts = await fontsFor(deck);
  const {bytes, entries, diagnostics} = await exported(deck, fonts);
  parity(deck, resolvePresentation(structuredClone(deck), {fonts}), entries);
  assert.ok(!diagnostics.some(issue => /glyph|font-unavailable/.test(issue.code)), `${deck.name}: no glyph diagnostics: ${diagnostics.map(issue => issue.code)}`);
  // The package names the chosen families, never the preview faces that drew the text.
  for (const [name, value] of Object.entries(entries).filter(([name]) => /^ppt\/slides\/slide\d+\.xml$/.test(name))) {
    assert.doesNotMatch(strFromU8(value), /typeface="(?:Noto |Intos)/, `${deck.name}: ${name} names no preview face`);
  }
  // The authored characters survive the round trip (private-use codes and emoji included).
  const imported = await fromPptx(bytes);
  assert.equal(imported.slides[0].title, deck.slides[0].title, `${deck.name}: title round-trips`);
  covered.add(pattern);
}

// The handle itself stays glyph-strict (render's policy): measuring script text with one Latin face throws. The exporter
// never measures that way, so the decks above export.
{
  const fonts = await fontsFor(decks[1][1]);
  assert.throws(() => fonts.textMeasurement.measure('Հ', 24, {fontFamily: 'Arimo'}), error => error.code === 'missing-glyph');
}

let previewGaps = 0;
for (const [, deck] of symbolSchemes) {
  const fonts = await fontsFor(deck);
  const {entries, diagnostics} = await exported(deck, fonts);
  assert.ok(!diagnostics.some(issue => /glyph/.test(issue.code)), `${deck.name}: no glyph diagnostics`);
  const family = deck.design.fontScheme.major, slide = strFromU8(entries['ppt/slides/slide1.xml']);
  assert.match(strFromU8(entries['ppt/theme/theme1.xml']), new RegExp(`<a:majorFont><a:latin typeface="${family}"`), `${deck.name}: the theme names ${family}`);
  assert.ok(slide.includes(deck.slides[0].title), `${deck.name}: the private-use codes are written unchanged`);
  let bound;
  try { bound = resolvePresentation(structuredClone(deck), {fonts}); }
  catch (error) {
    assert.equal(error.code, 'missing-glyph', `${deck.name}: the only known preview gap is the unmapped scheme role`);
    previewGaps++;
    continue;
  }
  parity(deck, bound, entries);
}
assert.deepEqual([...covered].sort(), [1, 2, 3]);
console.log(JSON.stringify({test: 'registry-glyph-fallback', passed: true, decks: decks.length, symbolSchemes: symbolSchemes.length, previewGaps}));
