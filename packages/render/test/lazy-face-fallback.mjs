// FF-19 (opf-render#57 glyph fallback, #55 scripts: 'auto') for the default Aptos scheme. Aptos previews with the
// vendored Intos family (embed "used", loaded lazily in browsers), which has no CJK, Arabic or other script glyphs.
// A preview of an Aptos deck with Japanese, Arabic or Greek text must therefore keep Latin in Intos and draw the
// rest with the loaded script face, as it does for Calibri (Carlito) and Open Sans:
//   - with `scripts: 'auto'` (or an explicit script list) nothing raises, every drawn run's face has all its glyphs,
//     and only the faces the text needs are loaded (Noto Sans SC for Han-only text in a Latin deck, Noto Sans JP
//     with kana or a Japanese language),
//   - the same registry without the script face raises `missing-glyph` for every family alike (Intos, Carlito and
//     Open Sans behave the same, so a lazy vendored primary is not a special case), and the error says what to load,
//   - `scripts: 'auto'` also loads the face a font scheme itself names (Yu Gothic, Meiryo, Malgun Gothic, Arabic
//     Typesetting, Noto Sans JP), for Latin text and for a slide that overrides the scheme, and Han-only text in such a
//     deck uses that scheme's CJK face instead of pulling in a second one.
// Offline and deterministic. The PPTX keeps the selected font names (checked in test/script-fonts.mjs and opf-pptx).
import assert from 'node:assert/strict';
import * as core from '@openpresentation/opf/composition';
// The decks name gallery font schemes (calibri, yu-gothic, ...): render and select scripts with the host catalog registered.
import {catalogs, toSvg} from './catalog-harness.mjs';
import {loadFonts, autoScriptSelection, detectPresentationScripts} from '../dist/fonts-node.js';

const short = name => name.replace('@expo-google-fonts/', '');
const deck = ({title, text = title, scheme, language, slides}) => ({
  $schema: 'https://openpresentation.org/schema/opf/v1', name: 'lazy face fallback', ...(language ? {language} : {}),
  ...(scheme ? {design: {fontScheme: scheme}} : {}), slides: slides ?? [{id: 'a', title, text}],
});
/** [family, text] for every drawn run; a run without its own font-family inherits its text element's. */
const drawnRuns = svg => [...svg.matchAll(/<text\b([^>]*)>(.*?)<\/text>/gs)].flatMap(([, attributes, content]) => {
  const inherited = /font-family="([^",]*)/.exec(attributes)[1];
  if (!content.includes('<tspan')) return [[inherited, content]];
  return [...content.matchAll(/<tspan\b([^>]*)>([^<]*)<\/tspan>/g)].map(([, own, text]) => [/font-family="([^",]*)/.exec(own)?.[1] ?? inherited, text]);
});
const families = runs => [...new Set(runs.map(([family]) => family))];
const unescape = text => text.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');

let checked = 0;
/** Render one slide of `document` with a `scripts` registry; every run's face must have every glyph of its text. */
async function render(label, document, {scripts = 'auto', policy = 'metric', slideIndex = 0} = {}) {
  const fonts = await loadFonts({pack: 'office', substitutionPolicy: policy, scripts, presentation: document, renderOptions: {catalogs}});
  const strict = fonts.registry.textMeasurement;
  const svg = toSvg(document, slideIndex + 1, {fonts});
  const runs = drawnRuns(svg);
  assert.ok(runs.length > 0, `${label}: draws text`);
  for (const [family, text] of runs) {
    try { strict.measure(unescape(text), 20, {fontFamily: family, fontWeight: 400}); }
    catch (error) { assert.fail(`${label}: ${family} cannot draw ${JSON.stringify(text)}: ${error.message}`); }
  }
  checked++;
  return {fonts, svg, runs, packages: (fonts.registry.scriptSelection?.packages ?? []).map(short)};
}

for (const policy of ['metric', 'visual']) {
  // 1. Aptos (the default scheme, no design at all): Intos and Intos Display draw Latin, the script face the rest.
  const japanese = await render(`aptos + japanese heading and body (${policy})`, deck({title: 'こんにちは日本語', text: '日本語のテキスト'}), {policy});
  assert.deepEqual(japanese.packages, ['noto-sans-jp'], 'kana is Japanese, so only Noto Sans JP loads');
  assert.deepEqual(families(japanese.runs), ['Noto Sans JP']);
  const han = await render(`aptos + han-only heading (${policy})`, deck({title: '日本語', text: 'Body 日本語'}), {policy});
  assert.deepEqual(han.packages, ['noto-sans-sc'], 'Han-only text in a deck without a language is Simplified Chinese');
  assert.ok(families(han.runs).includes('Noto Sans SC') && families(han.runs).includes('Intos'), `Latin stays in Intos: ${families(han.runs)}`);
  const mixed = await render(`aptos + latin and japanese in one heading (${policy})`, deck({title: 'Q3 レビュー', text: 'Revenue grew 12% 日本語です', language: 'ja'}), {policy});
  assert.deepEqual(families(mixed.runs).sort(), ['Intos', 'Intos Display', 'Noto Sans JP'], 'the heading is Intos Display plus Noto Sans JP, the body Intos plus Noto Sans JP');
  assert.ok(mixed.runs.some(([family, text]) => family === 'Intos Display' && text.includes('Q3')), 'Latin heading text keeps Intos Display');
  assert.ok(mixed.runs.some(([family, text]) => family === 'Noto Sans JP' && text.includes('レビュー')), 'the katakana draws with Noto Sans JP');
  // The deck language decides Han-only text.
  const languages = await render(`aptos + han with a Japanese language (${policy})`, deck({title: '日本語', language: 'ja'}), {policy});
  assert.deepEqual(languages.packages, ['noto-sans-jp']);
  // Greek and Cyrillic: Intos has them, and nothing else loads.
  for (const [name, title, body] of [['greek', 'Τριμηνιαία ανασκόπηση', 'Τα έσοδα αυξήθηκαν'], ['cyrillic', 'Квартальный обзор', 'Выручка выросла']]) {
    const result = await render(`aptos + ${name} (${policy})`, deck({title, text: body}), {policy});
    assert.deepEqual(result.packages, [], `${name} loads no script package`);
    assert.deepEqual(families(result.runs).sort(), ['Intos', 'Intos Display'], `${name} draws in Intos`);
  }
  // Arabic: Intos has no Arabic glyphs; the Arabic faces draw it and Latin stays in Intos.
  const arabic = await render(`aptos + arabic (${policy})`, deck({title: 'مراجعة ربع سنوية', text: 'ارتفعت المبيعات by 12%', language: 'ar'}), {policy});
  assert.ok(arabic.packages.length > 0 && arabic.packages.every(name => /arabic|urdu/.test(name)), `Arabic packages: ${arabic.packages}`);
  assert.ok(families(arabic.runs).some(family => /Arabic/.test(family)), `Arabic draws with an Arabic face: ${families(arabic.runs)}`);
  // Controls and the other lazy vendored family: the same text with Calibri (Carlito) and Open Sans.
  for (const [scheme, latin] of [['calibri', 'Carlito'], ['open-sans', 'Open Sans']]) {
    const control = await render(`${scheme} + japanese (${policy})`, deck({title: 'Q3 レビュー', text: 'Revenue 日本語です', scheme, language: 'ja'}), {policy});
    assert.deepEqual(control.packages, ['noto-sans-jp']);
    assert.deepEqual(families(control.runs).sort(), [latin, 'Noto Sans JP'].sort(), `${scheme}: Latin stays in ${latin}`);
    const controlHan = await render(`${scheme} + han-only (${policy})`, deck({title: '日本語', scheme}), {policy});
    assert.deepEqual(controlHan.packages, ['noto-sans-sc']);
    const controlArabic = await render(`${scheme} + arabic (${policy})`, deck({title: 'مراجعة', scheme, language: 'ar'}), {policy});
    assert.ok(families(controlArabic.runs).some(family => /Arabic/.test(family)));
  }
}

// 2. An explicit script list and 'all' behave like auto for the same deck.
for (const scripts of [['Jpan'], 'all']) await render(`aptos + japanese with scripts ${JSON.stringify(scripts)}`, deck({title: '日本語', text: 'Body 日本語'}), {scripts});

// 3. Without the script face nothing can draw the text, for every family alike: the vendored Intos, Carlito and Open
// Sans all raise missing-glyph, and the error names what to load.
for (const [scheme, family] of [[undefined, 'Intos Display'], ['calibri', 'Carlito'], ['open-sans', 'Open Sans']]) {
  const document = deck({title: '日本語', scheme});
  const fonts = await loadFonts({pack: 'office'});
  assert.throws(() => toSvg(document, 1, {fonts: fonts}), error => {
    assert.equal(error.code, 'missing-glyph');
    assert.equal(error.details.fontFamily, family);
    assert.equal(error.details.loadedFaceHasGlyph, false);
    assert.match(error.message, /cannot display U\+65E5\..*scripts: 'auto'.*fonts\.ensure\(presentation\)/, error.message);
    return true;
  }, `${scheme ?? 'aptos'}: no script face is loaded`);
}
// A glyph another loaded face has is not reported as missing everywhere.
{
  const fonts = await loadFonts({pack: 'base', scripts: ['Jpan']});
  assert.throws(() => fonts.registry.textMeasurement.measure('日本語', 20, {fontFamily: 'Roboto', fontWeight: 400}), error => error.code === 'missing-glyph' && !('loadedFaceHasGlyph' in error.details) && !/fonts\.ensure/.test(error.message));
}

// 4. A font scheme that names a script font needs that font's face, whatever the text: `scripts: 'auto'` loads it.
const schemes = [
  ['yu-gothic', 'noto-sans-jp'], ['meiryo', 'noto-sans-jp'], ['noto-sans-jp', 'noto-sans-jp'], ['malgun-gothic', 'noto-sans-kr'], ['microsoft-yahei', 'noto-sans-sc'],
];
for (const policy of ['metric', 'visual']) for (const [scheme, expected] of schemes) {
  const latin = await render(`${scheme} + latin (${policy})`, deck({title: 'Quarterly review', text: 'Revenue grew 12%', scheme}), {policy});
  assert.deepEqual(latin.packages, [expected], `${scheme}: the scheme's own face loads for Latin text`);
}
{
  const latin = await render('arabic typesetting + latin', deck({title: 'Quarterly review', scheme: 'arabic-typesetting'}));
  assert.ok(latin.packages.length > 0 && latin.packages.every(name => /arabic|urdu/.test(name)), latin.packages.join());
  const mangal = await render('mangal + latin', deck({title: 'Quarterly review', scheme: 'mangal'}));
  assert.deepEqual(mangal.packages, ['noto-sans-devanagari']);
}
// Han-only text in a Japanese scheme with English as the language uses the scheme's face (one package, not two).
for (const [scheme, expected] of [['yu-gothic', 'noto-sans-jp'], ['meiryo', 'noto-sans-jp'], ['malgun-gothic', 'noto-sans-kr'], ['microsoft-yahei', 'noto-sans-sc']]) {
  for (const language of [undefined, 'en']) {
    const result = await render(`${scheme} + han-only (${language ?? 'no language'})`, deck({title: '日本語', text: 'Body', scheme, ...(language ? {language} : {})}));
    assert.deepEqual(result.packages, [expected], `${scheme}: the scheme's CJK face draws Han-only text`);
  }
}
// A slide that overrides the scheme needs the override's face (and only that slide has the CJK scheme).
{
  const document = deck({slides: [
    {id: 'a', title: 'Hello', text: 'Latin slide'},
    {id: 'b', title: 'Second', text: 'Yu Gothic slide', design: {fontScheme: 'yu-gothic'}},
  ]});
  for (const slideIndex of [0, 1]) {
    const result = await render(`slide override yu-gothic, slide ${slideIndex}`, document, {slideIndex});
    assert.deepEqual(result.packages, ['noto-sans-jp']);
  }
}
// Sylfaen (Latin, Greek, Cyrillic, Armenian, Georgian) is replaced by the Latin Noto Sans, which the office registry always loads as a
// fallback-only face (it answers to its own name and to glyph fallback, never as another family's replacement). A Sylfaen scheme selects
// the Latn script, so `auto` must load Noto Sans as a designated replacement, or the deck raises font-unavailable for Sylfaen in Node
// while the browser registry (ensureScripts loads the package itself) draws it. Visual substitution only: the policy row is visual.
for (const [label, document] of [
  ['sylfaen + latin', deck({title: 'Quarterly review', text: 'Revenue grew 12%', scheme: 'sylfaen'})],
  ['sylfaen + armenian', deck({title: 'Եռամսյակային ակնարկ', text: 'Revenue grew 12%', scheme: 'sylfaen', language: 'hy'})],
  ['sylfaen + georgian', deck({title: 'კვარტალური მიმოხილვა', text: 'Revenue grew 12%', scheme: 'sylfaen', language: 'ka'})],
]) {
  const result = await render(label, document, {policy: 'visual'});
  assert.ok(result.packages.includes('noto-sans'), `${label}: Noto Sans loads as Sylfaen's replacement (${result.packages})`);
  assert.equal(result.fonts.registry.resolveFont({fontFamily: 'Sylfaen', fontWeight: 400, italic: false}).resolvedFamily, 'Noto Sans', `${label}: Sylfaen resolves`);
}
assert.deepEqual(autoScriptSelection(deck({title: 'Quarterly review', scheme: 'sylfaen'}), {catalogs}), {detected: [], scripts: ['Latn'], unavailable: []});
// Every other deck keeps Noto Sans fallback-only (glyph fallback and its own name, no replacement for another family).
{
  const fonts = await loadFonts({pack: 'office', substitutionPolicy: 'visual', scripts: 'auto', presentation: deck({title: 'Quarterly review', scheme: 'georgia'}), renderOptions: {catalogs}});
  assert.throws(() => fonts.registry.resolveFont({fontFamily: 'Sylfaen', fontWeight: 400, italic: false}), error => error.code === 'font-unavailable', 'a deck that does not select Latn keeps Noto Sans fallback-only');
  assert.equal(fonts.registry.resolveFont({fontFamily: 'Noto Sans', fontWeight: 400, italic: false}).resolvedFamily, 'Noto Sans', 'and it still answers to its own name');
}
// Latin schemes still load nothing for Latin text, and a Latin-scheme deck's own selection is unchanged.
for (const scheme of [undefined, 'calibri', 'open-sans', 'roboto', 'georgia']) {
  const latin = await render(`${scheme ?? 'aptos'} + latin`, deck({title: 'Quarterly review', text: 'Revenue grew 12%', scheme}));
  assert.deepEqual(latin.packages, [], `${scheme ?? 'aptos'} loads no script package for Latin text`);
}
// The selection API reports it: `detected` stays what the text draws, `scripts` is what to load.
assert.deepEqual(autoScriptSelection(deck({title: 'Quarterly review', scheme: 'yu-gothic'}), {catalogs}), {detected: [], scripts: ['Jpan'], unavailable: []});
assert.deepEqual(detectPresentationScripts(deck({title: 'Quarterly review', scheme: 'yu-gothic'}), {catalogs}), []);
assert.deepEqual(autoScriptSelection(deck({title: '日本語', scheme: 'yu-gothic'}), {catalogs}), {detected: ['Jpan'], scripts: ['Jpan'], unavailable: []});
assert.deepEqual(autoScriptSelection(deck({title: '日本語'}), {catalogs}), {detected: ['Hans'], scripts: ['Hans'], unavailable: []});
// Kana pins Japanese, and a Simplified-only scheme still adds its own face: both load.
assert.deepEqual(autoScriptSelection(deck({title: 'こんにちは', scheme: 'microsoft-yahei'}), {catalogs}).scripts, ['Hans', 'Jpan']);

console.log(`Lazy face fallback passed: ${checked} renders (Aptos, Calibri and Open Sans with Japanese, Arabic, Greek and Cyrillic; script-named schemes), strict failures, selection API.`);
