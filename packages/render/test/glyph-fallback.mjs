// FF-19: per-character glyph fallback in previews. A scheme's replacement face that lacks glyphs for the
// text's script never fails a preview: each character the face lacks takes the first bundled face that has it
// (Noto Sans for Cyrillic and Greek, then the CJK faces, then the Noto script faces), in measurement and in
// drawing, deterministically, reported as a `font-glyph-fallback` note. Strict faces (`glyphFallback: "none"`)
// still raise `missing-glyph`. Offline and deterministic.
import assert from 'node:assert/strict';
import * as core from '@openpresentation/opf/composition';
import {svgToPng} from '../dist/index.js';
import {catalogs, renderSvg, renderSlideSvg} from './catalog-harness.mjs';
import {loadFonts} from '../dist/fonts-node.js';
import {createScriptFonts, createScriptTextMeasurement, glyphFallbackFamilies, designatedFamilies} from '../dist/fonts.js';

const fonts = await loadFonts({pack: 'office', substitutionPolicy: 'visual', scripts: 'all'});
const raw = fonts.registry.textMeasurement;
// Font schemes are gallery records: the profile resolves them with the host catalog registered, as the renderer does.
const scriptProfile = document => core.resolveScriptFonts(document, {catalogs});

const TEXT = {
  ru: {title: 'Квартальный обзор', body: 'Выручка выросла, а расходы остались прежними'},
  el: {title: 'Τριμηνιαία ανασκόπηση', body: 'Τα έσοδα αυξήθηκαν ενώ τα έξοδα έμειναν σταθερά'}
};
const deck = (language, fontScheme, title, text) => ({$schema: 'https://openpresentation.org/schema/opf/v1', name: `glyph fallback ${language} ${fontScheme}`, language, design: {fontScheme}, slides: [{id: 'a', title, text}]});
const strictCovers = (family, text, style = {}) => {
  try { raw.measure(text, 20, {fontFamily: family, fontWeight: 400, ...style}); return true; } catch (error) { if (error.code === 'missing-glyph') return false; throw error; }
};
/** [family, text] for every drawn run; a run without its own font-family inherits its text element's. */
const drawnRuns = (svg) => [...svg.matchAll(/<text\b([^>]*)>(.*?)<\/text>/gs)].flatMap(([, attributes, content]) => {
  const inherited = /font-family="([^",]*)/.exec(attributes)[1];
  if (!content.includes('<tspan')) return [[inherited, content]];
  return [...content.matchAll(/<tspan\b([^>]*)>([^<]*)<\/tspan>/g)].map(([, own, text]) => [/font-family="([^",]*)/.exec(own)?.[1] ?? inherited, text]);
});
/** Every planned run must be drawn by a face that has all of its glyphs. */
function assertDrawable(label, document, base = fonts) {
  const diagnostics = [];
  const svg = renderSlideSvg(document, 0, { fonts: {...base, textMeasurement: createScriptTextMeasurement(raw, scriptProfile(document))}, onDiagnostic: (item) => diagnostics.push(item)});
  for (const [family, text] of drawnRuns(svg)) assert.ok(strictCovers(family, text.replace(/&[a-z]+;/g, ' ')), `${label}: ${family} has every glyph of ${JSON.stringify(text)}`);
  return {svg, diagnostics: diagnostics.filter((item) => item.code === 'font-glyph-fallback')};
}

// 1. Schemes whose face lacks Cyrillic or Greek: Latin-slot text falls back to Noto Sans per character.
const latinGaps = {
  georgia: ['ru', 'el'], constantia: ['ru', 'el'], mangal: ['ru', 'el'], 'arabic-typesetting': ['ru', 'el'],
  david: ['ru', 'el'], 'angsana-new': ['ru', 'el'],
  meiryo: ['el'], 'yu-gothic': ['el'], 'microsoft-yahei': ['el'], 'malgun-gothic': ['el']
};
let cases = 0;
const covered = [];
for (const [scheme, languages] of Object.entries(latinGaps)) {
  for (const language of languages) {
    const label = `${scheme} + ${language}`;
    const document = deck(language, scheme, TEXT[language].title, TEXT[language].body);
    // The exact face named by the scheme cannot show the text (this is what used to fail). Some schemes now
    // resolve to a face that does (Constantia previews with the open PT Serif, which has Cyrillic): no note then.
    const face = fonts.registry.resolveFont({fontFamily: scriptProfile(document).body.latin, fontWeight: 400}).resolvedFamily;
    if (strictCovers(face, TEXT[language].body)) {
      assert.deepEqual(assertDrawable(label, document).diagnostics, [], `${label}: ${face} covers the text, so no fallback is reported`);
      covered.push(label);
      continue;
    }
    assert.throws(() => renderSlideSvg(document, 0, { fonts: {...fonts, textMeasurement: createScriptTextMeasurement(raw, scriptProfile(document), {glyphFallback: 'none'})}, glyphFallback: 'none'}), {code: 'missing-glyph'}, `${label}: strict faces still raise missing-glyph`);
    // Preview: renders, draws every glyph with a face that has it, notes the substitution.
    const {svg, diagnostics} = assertDrawable(label, document);
    assert.ok(diagnostics.length > 0 && diagnostics.every((item) => item.fallbackFamily === 'Noto Sans' && item.fontFamily === face && item.path), `${label}: reports the Noto Sans fallback: ${JSON.stringify(diagnostics.map((item) => [item.fontFamily, item.fallbackFamily]))}`);
    assert.ok(drawnRuns(svg).some(([family]) => family === 'Noto Sans'), `${label}: draws with Noto Sans`);
    assert.equal(renderSlideSvg(document, 0, { fonts: {...fonts, textMeasurement: createScriptTextMeasurement(raw, scriptProfile(document))}}), assertDrawable(label, document).svg, `${label}: deterministic`);
    // Measurement alone (what the PPTX export and pagination use) succeeds with the same wrapper.
    const measurement = createScriptTextMeasurement(raw, scriptProfile(document));
    const width = measurement.measure(TEXT[language].body, 25, {fontFamily: face, fontWeight: 400, path: 'slides.0.text'});
    assert.ok(width > 0 && measurement.outlineBounds(TEXT[language].body, 25, {fontFamily: face, fontWeight: 400, path: 'slides.0.text'}).width > 0, `${label}: measures`);
    cases++;
  }
}

assert.ok(cases >= 14 && cases + covered.length === 16, `gap cases ${cases}, already covered ${covered}`);
for (const label of ['georgia + ru', 'georgia + el', 'meiryo + el', 'mangal + ru']) assert.ok(!covered.includes(label), `${label} is a fallback case`);
// 2. Faces that already cover the script never report a fallback; plain Latin text is untouched.
for (const [scheme, language] of [['calibri', 'ru'], ['calibri', 'el'], ['roboto', 'el'], ['times-new-roman', 'ru']]) {
  const {diagnostics} = assertDrawable(`${scheme} + ${language}`, deck(language, scheme, TEXT[language].title, TEXT[language].body));
  assert.deepEqual(diagnostics, [], `${scheme} + ${language}: the scheme's face covers the script`);
}
{
  const document = deck('en', 'georgia', 'Quarterly review', 'Revenue grew 12% with “curly” quotes – and dashes…');
  const {svg, diagnostics} = assertDrawable('georgia + english', document);
  assert.deepEqual(diagnostics, []);
  assert.doesNotMatch(svg, /<tspan/, 'Latin text stays one run');
}

// 3. Mixed text keeps each script in its own face: Latin stays in the scheme's face, Greek moves as whole words.
{
  const document = deck('el', 'georgia', 'Revenue Τριμηνιαία ανασκόπηση Growth', 'Body');
  const {svg} = assertDrawable('mixed', document);
  const title = drawnRuns(svg).filter(([, text]) => /Revenue|Τριμηνιαία|Growth/.test(text));
  assert.deepEqual(title.map(([family]) => family), ['Gelasio', 'Noto Sans', 'Gelasio'], 'Latin words keep Gelasio; Greek words use Noto Sans');
}

// 4. CJK: one CJK face is chosen per Han run, but a character it lacks takes another CJK face.
{
  // Japanese-only kanji U+53CE beside Hangul in a Latin deck.
  const document = deck('en', 'calibri', 'Revenue 収益 성장', 'Revenue grew');
  assert.throws(() => raw.measure('収', 20, {fontFamily: 'Noto Sans KR', fontWeight: 400}), {code: 'missing-glyph'}, 'the Korean face lacks the kanji');
  const {svg, diagnostics} = assertDrawable('kanji + hangul', document);
  const title = drawnRuns(svg);
  assert.ok(title.some(([family, text]) => family === 'Noto Sans JP' && text.includes('収')), 'the kanji is drawn with the Japanese face');
  assert.ok(title.some(([family, text]) => family === 'Noto Sans KR' && text.includes('성장')), 'the Hangul keeps the Korean face');
  assert.ok(diagnostics.some((item) => item.fallbackFamily === 'Noto Sans JP' && item.characters.includes('収') && item.scripts.includes('Hani')), 'the substitution is reported');
  assert.throws(() => renderSlideSvg(document, 0, { fonts: {...fonts, textMeasurement: createScriptTextMeasurement(raw, scriptProfile(document), {glyphFallback: 'none'})}, glyphFallback: 'none'}), {code: 'missing-glyph'});
  // Simplified-only hanzi U+53D8 in a Japanese deck.
  const japanese = deck('ja', 'meiryo', '季度回顾 变', '四半期は 变 わった');
  assert.throws(() => raw.measure('变', 20, {fontFamily: 'Noto Sans JP', fontWeight: 400}), {code: 'missing-glyph'}, 'the Japanese face lacks the hanzi');
  const second = assertDrawable('hanzi in japanese', japanese);
  assert.ok(drawnRuns(second.svg).some(([family, text]) => family === 'Noto Sans SC' && text.includes('变')), 'the hanzi is drawn with the Simplified Chinese face');
  assert.ok(drawnRuns(second.svg).some(([family, text]) => family === 'Noto Sans JP' && /^[^变]*$/.test(text)), 'the rest of the line keeps the Japanese face');
  assert.ok(second.diagnostics.every((item) => item.fontFamily === 'Noto Sans JP'));
}

// 5. The chain is defined, deterministic and comes from the designated families.
{
  const japanese = scriptProfile(deck('ja', 'meiryo', 'x', 'y'));
  const latin = scriptProfile(deck('en', 'calibri', 'x', 'y'));
  const chain = (character, profile) => glyphFallbackFamilies(character, profile);
  assert.deepEqual(chain('ρ', latin).slice(0, 2), ['Noto Sans', 'Noto Sans JP'], 'Cyrillic and Greek: Noto Sans, then the CJK faces');
  assert.deepEqual(chain('変', japanese).slice(0, 5), ['Noto Sans JP', 'Noto Serif JP', 'Noto Sans', 'Noto Sans SC', 'Noto Serif SC'], 'Han in a Japanese deck: the deck face, Noto Sans, the other CJK faces');
  assert.deepEqual(chain('収', latin).slice(0, 3), ['Noto Sans', 'Noto Sans JP', 'Noto Serif JP'], 'Han in a Latin deck: Noto Sans, then every CJK face');
  assert.deepEqual(chain('ก', latin).slice(0, 2), ['Noto Sans Thai', 'Noto Serif Thai'], 'a script character: its own script face first');
  assert.deepEqual(glyphFallbackFamilies('ρ', latin, true).slice(0, 1), ['Noto Sans']);
  // FF-45: the open symbol faces end the chain (arrows, dingbats, pictographs) after every designated script, emoji and math face; Noto Sans Math and STIX Two Math are designated for Zmth and come before them.
  const symbolFaces = ['Noto Sans Symbols 2', 'Noto Sans Symbols', 'Noto Sans Math'], lastFaces = symbolFaces.slice(0, 2);
  assert.deepEqual(chain('ρ', latin).slice(-2), lastFaces, 'the symbol faces are last');
  assert.ok(chain('ρ', latin).indexOf('Noto Sans Math') < chain('ρ', latin).indexOf('Noto Sans Symbols 2'), 'the math faces come before the symbol faces');
  for (const family of chain('ρ', latin)) assert.ok(designatedFamiliesAll().includes(family) || symbolFaces.includes(family), `${family} is a designated family`);
  assert.deepEqual(chain('ρ', latin), chain('ρ', latin), 'deterministic');
}
function designatedFamiliesAll() {
  return ['Latn', 'Jpan', 'Hans', 'Hant', 'Kore', 'Arab', 'Hebr', 'Deva', 'Beng', 'Guru', 'Gujr', 'Orya', 'Taml', 'Telu', 'Knda', 'Mlym', 'Sinh', 'Thai', 'Laoo', 'Khmr', 'Mymr', 'Ethi', 'Armn', 'Geor', 'Mong', 'Thaa', 'Syrc', 'Tibt', 'Zsye', 'Zmth'].flatMap((script) => designatedFamilies(script));
}

// 6. Planner API: notes, options and the unmeasured stack.
{
  const document = deck('el', 'georgia', TEXT.el.title, TEXT.el.body);
  const notes = [];
  const planner = createScriptFonts(scriptProfile(document), raw, {onFallback: (note) => notes.push(note)});
  const runs = planner.plan('Τριμηνιαία και Revenue', {fontFamily: 'Gelasio', fontWeight: 400, path: 'slides.0.text'});
  assert.deepEqual(runs.map((run) => [run.family, run.text]), [['Noto Sans', 'Τριμηνιαία και '], ['Gelasio', 'Revenue']]);
  assert.equal(notes.length, 1);
  assert.deepEqual(planner.fallbacks, notes);
  assert.equal(notes[0].path, 'slides.0.text');
  planner.plan('Τριμηνιαία και Revenue', {fontFamily: 'Gelasio', fontWeight: 400, path: 'slides.0.text'});
  assert.equal(notes.length, 1, 'a note is reported once');
  const none = createScriptFonts(scriptProfile(document), raw, {glyphFallback: 'none'});
  assert.equal(none.plan('Τριμηνιαία', {fontFamily: 'Gelasio', fontWeight: 400}).every((run) => run.own), true, 'strict faces plan the chosen face');
  // Without a registry the renderer names the fallback in the stack, and the browser picks glyphs.
  const estimated = renderSlideSvg(document, 0);
  assert.match(estimated, /font-family="Georgia, Noto Sans, serif"/);
  assert.doesNotMatch(renderSlideSvg(deck('en', 'georgia', 'Quarterly review', 'Body'), 0), /Noto Sans/);
}

// 7. The raster draws the fallback faces.
{
  const document = deck('el', 'georgia', 'Τριμηνιαία', 'Revenue');
  const measured = { fonts: {...fonts, textMeasurement: createScriptTextMeasurement(raw, scriptProfile(document))}};
  const png = await svgToPng(renderSlideSvg(document, 0, measured), {...measured, scale: 0.25});
  assert.deepEqual(png, await svgToPng(renderSlideSvg(document, 0, measured), {...measured, scale: 0.25}), 'deterministic raster');
  const without = await svgToPng(renderSlideSvg(document, 0, measured), {fonts: {...measured.fonts, fontFiles: measured.fonts.fontFiles.filter((file) => !/NotoSans_/.test(file))}, scale: 0.25});
  assert.notDeepEqual(png, without, 'the raster uses the Noto Sans face');
}

// 8a. Strict mode set on the wrapper alone is not undone by the renderer's own (undefined) option.
{
  const document = deck('el', 'georgia', TEXT.el.title, TEXT.el.body);
  const strict = createScriptTextMeasurement(raw, scriptProfile(document), {glyphFallback: 'none'});
  assert.throws(() => renderSlideSvg(document, 0, { fonts: {...fonts, textMeasurement: strict}}), {code: 'missing-glyph'}, 'the wrapper strict mode holds');
  assert.throws(() => renderSlideSvg(document, 0, { fonts: {...fonts, textMeasurement: strict}, glyphFallback: undefined}), {code: 'missing-glyph'});
  assert.doesNotThrow(() => renderSlideSvg(document, 0, { fonts: {...fonts, textMeasurement: strict}, glyphFallback: 'chain'}), 'an explicit render option overrides');
  assert.throws(() => renderSlideSvg(document, 0, { fonts: {...fonts, textMeasurement: strict}, glyphFallback: 'none'}), {code: 'missing-glyph'});
}

// 8b. Combining marks: coverage is checked per grapheme cluster, so a base and a mark the chosen face lacks move together.
{
  const marks = Array.from({length: 0x70}, (_, index) => String.fromCodePoint(0x300 + index));
  const style = {fontFamily: 'Carlito', fontWeight: 400};
  const lacking = marks.filter((mark) => !strictCovers('Carlito', mark) && strictCovers('Noto Sans', mark));
  assert.ok(lacking.length > 0, 'Carlito lacks a combining mark that Noto Sans has');
  const mark = lacking[0];
  const document = deck('en', 'calibri', 'Title', 'Body');
  const planner = createScriptFonts(scriptProfile(document), raw);
  const runs = planner.plan(`Nice e${mark} word`, style);
  assert.deepEqual(runs.map((run) => [run.family, run.text]), [['Carlito', 'Nice '], ['Noto Sans', `e${mark} `], ['Carlito', 'word']], 'the base and its mark are one cluster in one face; only their word moves');
  for (const run of runs) assert.ok(strictCovers(run.family, run.text), `${run.family} has every glyph of its run`);
  const measurement = createScriptTextMeasurement(raw, scriptProfile(document));
  assert.ok(measurement.measure(`Nice e${mark} word`, 20, style) > 0, 'measures without missing-glyph');
  // The note lists what the chosen face lacks: the mark, not the base letter Carlito covers.
  const markNotes = [];
  const noting = createScriptFonts(scriptProfile(document), raw, {onFallback: (note) => markNotes.push(note)});
  noting.plan(`e${mark}`, style);
  assert.deepEqual(markNotes.map((note) => note.characters), [[mark]]);
  // NFD Vietnamese and NFD Cyrillic (breve U+0306) render without missing-glyph, in every registry font.
  for (const [language, scheme, text] of [['vi', 'calibri', 'Vie\u0323\u0302t Nam'.normalize('NFD') + ' Tie\u0302\u0301ng Vie\u0323\u0302t'], ['ru', 'georgia', 'Кра\u0306й и\u0306 ё'.normalize('NFD')], ['ru', 'roboto', 'Кра\u0306й и\u0306'.normalize('NFD')], ['el', 'georgia', 'ά'.normalize('NFD') + ' ώ'.normalize('NFD')]]) {
    const value = {$schema: 'https://openpresentation.org/schema/opf/v1', name: 'nfd', language: language === 'vi' ? 'en' : language, design: {fontScheme: scheme}, slides: [{id: 'a', title: text, text}]};
    const {svg} = assertDrawable(`NFD ${language} ${scheme}`, value);
    for (const [family, run] of drawnRuns(svg)) for (const cluster of run.normalize('NFD').match(/\P{M}\p{M}*/gu) ?? []) assert.ok(strictCovers(family, cluster), `NFD ${language} ${scheme}: ${family} has the whole cluster ${JSON.stringify(cluster)}`);
  }
}

// 8c. Default registry: Noto Sans is bundled with the office pack as the Latin, Cyrillic and Greek fallback, so Georgia with
// Russian text previews without the scripts option; CJK fallback faces come from the scripts a document needs.
{
  const bare = await loadFonts({pack: 'office', substitutionPolicy: 'visual'});
  const bareMeasurement = bare.registry.textMeasurement;
  for (const [scheme, language] of [['georgia', 'ru'], ['georgia', 'el']]) {
    const document = deck(language, scheme, TEXT[language].title, TEXT[language].body);
    const notes = [];
    const svg = renderSlideSvg(document, 0, { fonts: {...bare, textMeasurement: createScriptTextMeasurement(bareMeasurement, scriptProfile(document))}, onDiagnostic: (item) => notes.push(item)});
    assert.ok(notes.some((note) => note.code === 'font-glyph-fallback' && note.fallbackFamily === 'Noto Sans'), `${scheme} + ${language} previews with the default registry`);
    assert.ok(drawnRuns(svg).some(([family]) => family === 'Noto Sans'));
    // Noto Sans is embed "used": offered to the renderer, embedded only in an SVG whose text draws it.
    const notoSans = bare.embeddedFonts.filter((face) => face.family === 'Noto Sans');
    assert.ok(notoSans.length === 4 && notoSans.every((face) => face.embed === 'used'), 'the fallback faces are offered as embed "used"');
    assert.ok(svg.includes('@font-face{font-family:"Noto Sans"'), `${scheme} + ${language}: the standalone SVG embeds the Noto Sans it draws`);
    assert.ok(bare.registry.embeddedFonts.every((face) => face.family !== 'Noto Sans'), 'the eager embedded list stays the 33 office and base faces');
    const english = deck('en', scheme, 'Quarterly review', 'Revenue grew');
    assert.ok(!renderSlideSvg(english, 0, { fonts: {...bare, textMeasurement: createScriptTextMeasurement(bareMeasurement, scriptProfile(english))}}).includes('font-family:"Noto Sans"'), 'a slide that does not draw Noto Sans does not embed it');
    assert.ok(bare.fontFiles.some((file) => /NotoSans_400Regular\.ttf$/.test(file)), 'the raster reads it from fontFiles');
  }
  // Italic and bold styles exist for the fallback, and other families preview exactly as before.
  const italic = bare.registry.resolveFont({fontFamily: 'Noto Sans', fontWeight: 700, italic: true});
  assert.deepEqual([italic.resolvedFamily, italic.resolvedWeight, italic.italic], ['Noto Sans', 700, true]);
  // With the script pack requested explicitly, Noto Sans is loaded once.
  const all = await loadFonts({pack: 'office', substitutionPolicy: 'visual', scripts: ['Latn', 'Jpan']});
  assert.equal(all.registry.describeFaces().filter((face) => face.family === 'Noto Sans').length, 4);
  // Auto script selection (scripts: 'auto') owns fallback packages: kanji beside Hangul loads the language face plus at most
  // one CJK fallback face, and Greek needs no package because Noto Sans is always loaded.
  const cjk = {language: 'en', design: {fontScheme: 'calibri'}, slides: [{title: 'Revenue 収益 성장', text: 'Revenue grew'}]};
  const auto = await loadFonts({pack: 'office', substitutionPolicy: 'visual', scripts: 'auto', presentation: cjk, renderOptions: {catalogs}});
  assert.equal(auto.registry.describeFaces().filter((face) => face.family === 'Noto Sans').length, 4, 'Noto Sans is loaded once under auto');
  assert.ok(auto.registry.scriptSelection.packages.length <= 2, `${auto.registry.scriptSelection.packages}`);
  assert.doesNotThrow(() => renderSlideSvg(deck('en', 'calibri', 'Revenue 収益 성장', 'Revenue grew'), 0, { fonts: {...auto, textMeasurement: createScriptTextMeasurement(auto.registry.textMeasurement, scriptProfile(cjk))}}));
  const greek = await loadFonts({pack: 'office', substitutionPolicy: 'visual', scripts: 'auto', presentation: {language: 'el', design: {fontScheme: 'georgia'}, slides: [{title: TEXT.el.title}]}, renderOptions: {catalogs}});
  assert.deepEqual(greek.registry.scriptSelection.packages, []);
}

// 8d. Notes: one per path (a cached plan still reports its own path), the face actually drawn, and copied arrays.
{
  const document = deck('el', 'georgia', TEXT.el.title, TEXT.el.body);
  const notes = [];
  const planner = createScriptFonts(scriptProfile(document), raw, {onFallback: (note) => notes.push(note)});
  planner.plan('Τριμηνιαία', {fontFamily: 'Gelasio', fontWeight: 400, path: 'slides.0.title'});
  planner.plan('Τριμηνιαία', {fontFamily: 'Gelasio', fontWeight: 400, path: 'slides.1.title'});
  assert.deepEqual(notes.map((note) => note.path), ['slides.0.title', 'slides.1.title']);
  assert.ok(notes.every((note) => note.fontFamily === 'Gelasio' && note.fallbackFamily === 'Noto Sans'));
  const bold = createScriptFonts(scriptProfile(document), raw, {onFallback: (note) => notes.push(note)});
  bold.plan('Τριμηνιαία', {fontFamily: 'Gelasio', fontWeight: 700, path: 'slides.0.title'});
  assert.equal(notes.at(-1).fallbackFamily, 'Noto Sans', 'the resolved face is reported');
  // A planner's own onFallback chains with the wrapper's, and does not replace it.
  const fromWrapper = [], fromPlanner = [];
  const wrapper = createScriptTextMeasurement(raw, scriptProfile(document), {onFallback: (note) => fromWrapper.push(note.fallbackFamily)});
  createScriptFonts(scriptProfile(document), wrapper, {onFallback: (note) => fromPlanner.push(note.fallbackFamily)}).plan('Τριμηνιαία', {fontFamily: 'Gelasio', fontWeight: 400, path: 'slides.0.title'});
  wrapper.measure('Τριμηνιαία', 20, {fontFamily: 'Gelasio', fontWeight: 400, path: 'slides.1.title'});
  assert.deepEqual([fromWrapper, fromPlanner], [['Noto Sans', 'Noto Sans'], ['Noto Sans']], 'both callbacks are notified');
  const diagnostics = [];
  renderSlideSvg(document, 0, { fonts: {...fonts, textMeasurement: createScriptTextMeasurement(raw, scriptProfile(document))}, onDiagnostic: (item) => diagnostics.push(item)});
  const first = diagnostics.find((item) => item.code === 'font-glyph-fallback');
  const characters = [...first.characters];
  first.characters.push('#'); first.scripts.push('#');
  const again = [];
  renderSlideSvg(document, 0, { fonts: {...fonts, textMeasurement: createScriptTextMeasurement(raw, scriptProfile(document))}, onDiagnostic: (item) => again.push(item)});
  assert.deepEqual(again.find((item) => item.code === 'font-glyph-fallback').characters, characters, 'diagnostic arrays are copies');
}

// 8. Without a fallback face loaded, the error is unchanged.
{
  const base = await loadFonts({pack: 'base'});
  assert.throws(() => renderSvg(deck('ja', 'roboto', '四半期', 'Body'), {fonts: base}), {code: 'missing-glyph'});
}
console.log(`Glyph fallback passed: ${cases} scheme and script cases, CJK Han fallback, strict faces, chain order, notes, estimated stacks and raster.`);
