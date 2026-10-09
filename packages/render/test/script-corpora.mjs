// FF-44 (RR-17): script shaping corpora and per-family qualification, Node side.
//
// test/fixtures/script-corpora.json holds short original text per ISO 15924 script, written to exercise one shaping behaviour at a time
// (joining, ligatures, marks, conjuncts, vowel placement, stacking, tone marks, digits, punctuation, bidi, mixed Latin, no-space text). Every
// sample runs through every bundled open face that serves its script (regular and bold, all 63 script and Noto Sans faces) and is checked for
//   1. coverage: the face has a glyph for every letter of the group's own script (Latin, digits and punctuation in mixed samples are the
//      glyph-fallback chain's job: some loaded face must have them);
//   2. shaping: fontkit, as the renderer uses it (opf-render's own measurement, with its Mongolian lookup guard, its mark-positioning retry
//      and the OpenType language system of the sample's lang), shapes the text;
//   3. agreement with HarfBuzz (harfbuzzjs, the shaper Chromium and resvg use) on the advance width at 100 px, to 0.011 px, except the
//      recorded `knownShapingLimits` (fontkit 2.0.4 has no Myanmar shaper, mis-joins one Syriac word and cannot position Nastaliq marks), whose
//      deviations are bounded and must still exist (a limit that no longer deviates must be removed from the fixture);
//   4. shaping really applied where the category says so (joining, conjuncts, vowel placement, tone marks change the glyph run).
// It also checks that the corpus covers every script of the 93 languages of core's engine language vocabulary (`LANGUAGES`) and every script
// slot the renderer names, and that the gallery catalog's own font-scheme samples are covered by the script faces. The report is written when
// a path is passed (CI uploads it).
import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {LANGUAGES} from '@openpresentation/opf/composition';
import {defaultCatalog} from '@openpresentation/opf/catalog';
import {toPng, toSvg} from '../dist/index.js';
import {loadFonts} from '../dist/fonts-node.js';
import {SCRIPT_FONT_FAMILIES, SCRIPT_FONT_REPLACEMENTS, itemizeScripts} from '../dist/script-fonts.js';
import {loadCorpora, loadFaces, qualify} from '../scripts/script-corpora.mjs';

const corpora = await loadCorpora();
const {faces, registry} = await loadFaces();
const report = await qualify({faces, registry, corpora});

// The corpus covers the language vocabulary: every language's script and tag, and every script the renderer designates a face for.
const groupByScript = new Map(corpora.groups.map(group => [group.script, group]));
assert.equal(LANGUAGES.length, 93);
const tagged = new Set(corpora.groups.flatMap(group => group.languages));
for (const language of LANGUAGES) {
  assert.ok(groupByScript.has(language.script), `${language.tag}: no corpus group for script ${language.script}`);
  assert.ok(tagged.has(language.tag), `${language.tag} is in no corpus group's languages`);
}
for (const script of Object.keys(SCRIPT_FONT_FAMILIES)) assert.ok(groupByScript.has(script), `script slot ${script} has a corpus group`);
for (const rule of SCRIPT_FONT_REPLACEMENTS) assert.ok(groupByScript.has(rule.script) || rule.script === 'Latn', `${rule.requestedFamily}: script ${rule.script} has a corpus group`);
for (const group of corpora.groups) {
  assert.ok(group.samples.length >= 2, `${group.script} has at least two samples`);
  assert.equal(new Set(group.samples.map(sample => sample.id)).size, group.samples.length, `${group.script} sample ids are unique`);
}

// Every group is served by at least one bundled face, and every face is exercised.
for (const group of corpora.groups) assert.ok(faces.some(face => face.scripts.includes(group.script)), `${group.script}: a bundled face serves it`);
assert.equal(report.faces.length, faces.length);
assert.ok(faces.length >= 63, `${faces.length} script faces`);

const limits = new Map(corpora.knownShapingLimits.flatMap(limit => Object.entries(limit.samples).map(([id, bound]) => [`${limit.family}|${id}`, bound])));
const seenLimit = new Set();
const shapedCategories = new Set(['joining', 'conjunct', 'vowel-placement', 'tone-marks']);
const complexGroups = new Set(['Arab', 'Hebr', 'Deva', 'Beng', 'Guru', 'Gujr', 'Orya', 'Taml', 'Telu', 'Knda', 'Mlym', 'Sinh', 'Thai', 'Laoo', 'Khmr', 'Mymr', 'Tibt', 'Mong', 'Syrc', 'Thaa']);
let samples = 0, exact = 0;
const common = new Set();
for (const entry of report.faces) {
  for (const group of entry.groups) {
    for (const sample of group.samples) {
      samples++;
      const where = `${entry.family} ${entry.weight}${entry.italic ? ' italic' : ''} / ${sample.id}`;
      assert.equal(sample.missingOwn, '', `${where}: no glyph for own-script characters ${[...sample.missingOwn].map(c => 'U+' + c.codePointAt(0).toString(16).toUpperCase()).join(' ')}`);
      for (const character of sample.missing) common.add(character);
      assert.equal(sample.shapingError, null, `${where}: fontkit cannot shape`);
      assert.equal(sample.rendererError, null, `${where}: the renderer's measurement fails (${sample.rendererError})`);
      assert.ok(sample.rendererWidth > 0, where);
      const bound = limits.get(`${entry.family}|${sample.id}`);
      if (bound !== undefined) {
        seenLimit.add(`${entry.family}|${sample.id}`);
        assert.ok(Math.abs(sample.widthDelta) <= bound, `${where}: the recorded limit ${bound} no longer bounds the deviation ${sample.widthDelta}`);
      } else {
        assert.ok(Math.abs(sample.widthDelta) <= 0.011, `${where}: fontkit measures ${sample.rendererWidth} px at 100 px, HarfBuzz ${sample.hbWidth}`);
        exact++;
      }
      if (shapedCategories.has(sample.category) && complexGroups.has(group.script)) assert.ok(sample.shapingApplied, `${where}: shaping did not change the glyph run (${sample.category})`);
      // Marks have no advance in both shapers where the sample is a mark sample.
      if (sample.category === 'marks' && complexGroups.has(group.script) && !bound) assert.ok(sample.zeroAdvance.fontkit > 0 && sample.zeroAdvance.harfbuzz > 0, `${where}: marks keep an advance`);
      // The advance count agrees unless the face is a recorded limit or composes marks differently (the width gate above still holds).
      if (!sample.glyphSequenceEqual && !bound) assert.ok(Math.abs(sample.widthDelta) <= 0.011, where);
    }
  }
  // Line metrics are recorded for every face and are sane (the preview's line box depends on them).
  const {hhea} = entry.lineMetrics;
  assert.ok(hhea.ascent > 0.5 && hhea.ascent < 2.5, `${entry.family}: hhea ascent ${hhea.ascent} em`);
  assert.ok(Math.abs(hhea.descent) < 1.5, `${entry.family}: hhea descent ${hhea.descent} em`);
}
for (const key of limits.keys()) assert.ok(seenLimit.has(key), `known limit ${key} matched no sample`);
// A limit that no longer deviates is stale: every limit family must still deviate in at least one weight and sample.
for (const limit of corpora.knownShapingLimits) {
  const deviating = report.faces.filter(face => face.family === limit.family).flatMap(face => face.groups.flatMap(group => group.samples)).filter(sample => limit.samples[sample.id] !== undefined && Math.abs(sample.widthDelta) > 0.05);
  assert.ok(deviating.length > 0, `${limit.family}: its recorded shaping limit no longer deviates, remove it from the fixture`);
}

// The characters a script face lacks (Latin, digits, punctuation in mixed samples) exist in some loaded face (the glyph-fallback chain).
for (const character of common) assert.ok(faces.some(face => face.font.hasGlyphForCodePoint(character.codePointAt(0))), `U+${character.codePointAt(0).toString(16).toUpperCase()} is in no bundled script face`);

// The gallery catalog's own font-scheme samples (what the gallery shows for each script scheme) are covered by the script faces.
let schemeSamples = 0;
for (const [id, scheme] of Object.entries(defaultCatalog.fontSchemes)) {
  if (!scheme?.textSample || scheme.languageFamily === 'latin') continue;
  schemeSamples++;
  for (const run of itemizeScripts(scheme.textSample, {})) {
    if (run.script === 'Latn') continue;
    const missing = [...run.text].filter(character => !/[\s\p{P}\p{S}\p{M}\p{Cf}]/u.test(character) && !faces.some(face => face.font.hasGlyphForCodePoint(character.codePointAt(0))));
    assert.deepEqual(missing, [], `${id}: sample characters in no script face`);
  }
}
assert.ok(schemeSamples >= 50, `${schemeSamples} script font-scheme samples checked`);

// Coverage floors per face (measured 2026-10-01 over the Unicode scripts of this Node's ICU): own-script BMP coverage, and for the CJK faces the
// national charset each one is held to. Noto Nastaliq Urdu is an Urdu-only face; Noto Sans Syriac lacks the Syriac Supplement block.
for (const entry of report.faces) {
  for (const item of entry.coverage.scripts) {
    const floor = entry.family === 'Noto Nastaliq Urdu' ? 0.2 : 0.84;
    assert.ok(item.bmpCovered / item.bmpAssigned >= floor, `${entry.family}: only ${item.bmpCovered} of ${item.bmpAssigned} ${item.unicodeScript} BMP characters`);
  }
  for (const [family, charset, floor, hanFloor] of [['Noto Sans JP', 'JIS X 0208', 0.999, 0.999], ['Noto Sans SC', 'GB 2312', 0.91, 0.999], ['Noto Sans TC', 'Big5 levels 1 and 2', 0.99, 0.999], ['Noto Sans KR', 'KS X 1001', 0.98, 0.99]]) {
    if (entry.family !== family) continue;
    const item = entry.coverage.charsets.find(candidate => candidate.charset === charset);
    assert.ok(item.covered / item.size >= floor, `${family}: ${item.covered} of ${item.size} ${charset} characters`);
    assert.ok(item.hanCovered / item.han >= hanFloor, `${family}: ${item.hanCovered} of ${item.han} ${charset} ideographs`);
  }
}

// text-spacing-trim: Chromium trims adjacent fullwidth punctuation unless the SVG asks for space-all, which matches the measured advances (see
// test/script-corpora-browser.mjs for the browser proof). Only slides that draw such punctuation carry the style.
{
  const deck = (language, title) => ({$schema: 'https://openpresentation.org/schema/opf/v1', name: 'FF-44', language, slides: [{title, text: 'Body'}]});
  const prepared = await loadFonts({pack: 'office', scripts: 'all'});
  assert.match(toSvg(deck('ja', '「括弧」、（かっこ）。'), 1, {fonts: prepared}), /<svg[^>]*style="text-spacing-trim:space-all"/);
  assert.match(toSvg(deck('zh-Hans', '，。！？；：'), 1, {fonts: prepared}), /<svg[^>]*style="text-spacing-trim:space-all"/);
  assert.match(toSvg(deck('zh-Hans', '“引号”'), 1, {fonts: prepared}), /<svg[^>]*style="text-spacing-trim:space-all"/);
  assert.doesNotMatch(toSvg(deck('ja', '日本語のタイトル'), 1, {fonts: prepared}), /text-spacing-trim/);
  assert.doesNotMatch(toSvg(deck('en', 'Quarterly review “quoted”'), 1, {fonts: prepared}), /text-spacing-trim/);
}

// Host loading, Node: for each corpus script, a document in a language of that script whose text is a corpus sample loads exactly the pinned face
// for the script with scripts: 'auto' (the editor's and the gallery host's selection), renders with the strict registry (no missing glyph, no
// font fallback note for the script's own letters) and draws the designated family. Latin, Cyrillic and Greek need no script pack (Noto Sans is
// the always-loaded fallback face).
{
  const designated = {Jpan: 'Noto Sans JP', Hans: 'Noto Sans SC', Hant: 'Noto Sans TC', Kore: 'Noto Sans KR', Arab: 'Noto Naskh Arabic', Hebr: 'Noto Serif Hebrew', Deva: 'Noto Sans Devanagari', Beng: 'Noto Sans Bengali', Guru: 'Noto Sans Gurmukhi', Gujr: 'Noto Sans Gujarati', Orya: 'Noto Sans Oriya', Taml: 'Noto Sans Tamil', Telu: 'Noto Sans Telugu', Knda: 'Noto Sans Kannada', Mlym: 'Noto Sans Malayalam', Sinh: 'Noto Sans Sinhala', Thai: 'Noto Sans Thai', Laoo: 'Noto Sans Lao', Khmr: 'Noto Sans Khmer', Mymr: 'Noto Sans Myanmar', Tibt: 'Noto Serif Tibetan', Mong: 'Noto Sans Mongolian', Ethi: 'Noto Sans Ethiopic', Armn: 'Noto Sans Armenian', Geor: 'Noto Sans Georgian', Syrc: 'Noto Sans Syriac', Thaa: 'Noto Sans Thaana'};
  let loaded = 0;
  for (const group of corpora.groups) {
    const [first, second] = group.samples, language = group.languages[0];
    const deck = {$schema: 'https://openpresentation.org/schema/opf/v1', name: `FF-44 ${group.script}`, language, slides: [{title: first.text, text: second.text}]};
    const fallbacks = [];
    const prepared = await loadFonts({pack: 'office', scripts: 'auto', presentation: deck, onDiagnostic: note => fallbacks.push(note)}), {registry} = prepared;
    const family = designated[group.script];
    if (family) {
      assert.ok(registry.scriptSelection.packages.length > 0, `${group.script}: auto loads a pinned package`);
      assert.ok(registry.describeFaces().some(face => face.family === family), `${group.script}: ${family} is loaded for a ${language} document`);
      loaded++;
    }
    const svg = toSvg(deck, 1, {fonts: prepared});
    assert.ok(svg.includes(family ?? 'Noto Sans') || group.script === 'Latn' || group.script === 'Cyrl' || group.script === 'Grek', `${group.script}: the SVG draws ${family}`);
    assert.deepEqual(fallbacks.filter(note => note.code === 'script-font-unavailable' || note.code === 'script-glyph-uncovered'), [], `${group.script}: no unavailable script`);
    const png = await toPng(svg, {fonts: prepared, scale: 0.25});
    assert.ok(png.length > 1000, `${group.script}: a raster is produced`);
  }
  assert.equal(loaded, Object.keys(designated).length);
}

// Serif originals (MS Mincho, SimSun, MingLiU, Batang and their kin) have no bundled serif face: Noto Serif CJK files are 12 to 20 MiB each and are
// not part of the pinned pack, so they preview in the sans face of their script, recorded as visual in the policy table. A host that supplies a
// Noto Serif CJK face (here: stand-in bytes of the Noto Sans JP file, renamed) gets it first, through the script-font alias rules.
{
  const jp = faces.find(face => face.family === 'Noto Sans JP' && face.weight === 400);
  const {registry: sansOnly} = await loadFonts({pack: 'office', scripts: ['Jpan']});
  assert.equal(sansOnly.textMeasurement.resolveStyle({fontFamily: 'MS Mincho', fontWeight: 400}).fontFamily, 'Noto Sans JP');
  const {registry: withSerif} = await loadFonts({pack: 'office', scripts: ['Jpan'], faces: [{path: jp.file, family: 'Noto Serif JP', weight: 400, italic: false, scripts: ['Jpan']}]});
  assert.equal(withSerif.textMeasurement.resolveStyle({fontFamily: 'MS Mincho', fontWeight: 400}).fontFamily, 'Noto Serif JP');
  assert.equal(withSerif.textMeasurement.resolveStyle({fontFamily: 'Meiryo', fontWeight: 400}).fontFamily, 'Noto Sans JP');
}

// Noto Sans Mongolian ships regular only (upstream has no bold): a bold request draws the regular face and the registry says so (visual).
{
  const {registry: mongolian} = await loadFonts({pack: 'office', scripts: ['Mong']});
  const bold = mongolian.textMeasurement.resolveStyle({fontFamily: 'Noto Sans Mongolian', fontWeight: 700});
  assert.equal(bold.fontFamily, 'Noto Sans Mongolian');
  assert.equal(bold.fontWeight, 400);
  assert.ok(mongolian.describeFaces().filter(face => face.family === 'Noto Sans Mongolian').every(face => face.weight === 400));
  const measured = mongolian.textMeasurement.measure('ᠮᠣᠩᠭᠣᠯ ᠬᠡᠯᠡ', 100, {fontFamily: 'Noto Sans Mongolian', fontWeight: 700, lang: 'mn'});
  assert.equal(measured, mongolian.textMeasurement.measure('ᠮᠣᠩᠭᠣᠯ ᠬᠡᠯᠡ', 100, {fontFamily: 'Noto Sans Mongolian', fontWeight: 400, lang: 'mn'}));
}

if (process.argv[2]) {
  await mkdir(path.dirname(process.argv[2]), {recursive: true});
  await writeFile(process.argv[2], `${JSON.stringify(report, null, 2)}\n`);
}
console.log(`Script corpora passed: ${corpora.groups.length} scripts, ${samples} face-samples over ${report.faces.length} faces (${exact} within 0.011 px of HarfBuzz, ${samples - exact} recorded fontkit limits), own-script coverage complete, ${schemeSamples} catalog scheme samples covered.`);
