// FF-45 special families: Segoe UI Emoji previews with Noto Color Emoji (a colour emoji path: ZWJ sequences, flags, skin
// tones, keycaps, tag sequences and variation selectors stay one run and one glyph) and Cambria Math previews with STIX Two
// Math (a math face planned per character, with Noto Sans Math and the glyph fallback chain for what it lacks). Both load as
// optional script packs (pseudo-scripts Zsye and Zmth), resolve under every policy through the script aliases, keep the
// chosen family for exporters, and never fail a preview. The raster path draws emoji with the monochrome Noto Emoji, because
// resvg draws neither COLRv1 nor OT-SVG glyphs; that limit is pinned here. Offline and deterministic.
import assert from 'node:assert/strict';
import * as core from '@openpresentation/opf/composition';
import sharp from 'sharp';
import {svgToPng, renderSlideSvg} from '../dist/index.js';
import {BUNDLED_FONT_MANIFEST, detectPresentationScripts, loadFonts, scriptFontPackages} from '../dist/fonts-node.js';
import {COLOR_FONT_FACES, EMOJI_FONT_FAMILIES, FONT_COMPATIBILITY, createScriptFonts, createScriptTextMeasurement, designatedFamilies, fontPolicyFor, glyphFallbackFamilies, hasEmojiPresentation, hasMathNotation, scriptFontAliases} from '../dist/fonts.js';
import {monochromeColorFonts, rasterFontFiles} from '../dist/color-fonts.js';

const EMOJI = {
  grinning: '\u{1F600}', family: '\u{1F468}\u200D\u{1F469}\u200D\u{1F467}\u200D\u{1F466}', flag: '\u{1F1E9}\u{1F1EA}', thumbsMedium: '\u{1F44D}\u{1F3FD}',
  keycap: '1\uFE0F\u20E3', heartVS16: '\u2764\uFE0F', scotland: '\u{1F3F4}\u{E0067}\u{E0062}\u{E0073}\u{E0063}\u{E0074}\u{E007F}',
  womanTechnologist: '\u{1F469}\u{1F3FE}\u200D\u{1F4BB}', rainbowFlag: '\u{1F3F3}\uFE0F\u200D\u{1F308}', rocket: '\u{1F680}',
};
// Recorded in place from C:\Windows\Fonts\seguiemj.ttf (Segoe UI Emoji 1.33, COLRv1, 2048 upem) on 2026-10-01: every emoji sequence
// above shapes to 1.3730 em there (fontkit; Segoe draws a regional-indicator pair as two 0.55/0.42 em letters, not a flag).
const SEGOE_UI_EMOJI_ADVANCE = 1.3730, NOTO_COLOR_EMOJI_ADVANCE = 1275 / 1024, NOTO_EMOJI_ADVANCE = 2600 / 2048; // 1.2451 em and 1.2695 em
const deck = (title, text = 'Body', extra = {}) => ({$schema: 'https://openpresentation.org/schema/opf/v1', name: 'FF-45', slides: [{title, text}], ...extra});
const scheme = (family, id = 'aptos') => ({design: {fontScheme: {id, heading: family, body: family}}});
const em = (registry, text, family, style = {}) => registry.textMeasurement.measure(text, 1000, {fontFamily: family, fontWeight: 400, ...style}) / 1000;
const near = (actual, expected, tolerance, label) => assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: ${actual} is not within ${tolerance} of ${expected}`);
const strictCovers = (registry, family, text) => { try { registry.textMeasurement.measure(text, 20, {fontFamily: family, fontWeight: 400}); return true; } catch (error) { if (error.code === 'missing-glyph') return false; throw error; } };
/** [family, text] of every drawn run of the SVG; a run without its own font-family inherits its text element's. */
const drawnRuns = svg => [...svg.matchAll(/<text\b([^>]*)>(.*?)<\/text>/gs)].flatMap(([, attributes, content]) => {
  const inherited = /font-family="([^",]*)/.exec(attributes)[1];
  if (!content.includes('<tspan')) return [[inherited, content]];
  return [...content.matchAll(/<tspan\b([^>]*)>([^<]*)<\/tspan>/g)].map(([, own, text]) => [/font-family="([^",]*)/.exec(own)?.[1] ?? inherited, text]);
});
const inkOf = async (png, {x0 = 0, y0 = 0, x1 = Infinity, y1 = Infinity} = {}) => {
  const {data, info} = await sharp(Buffer.from(png)).raw().toBuffer({resolveWithObject: true});
  let ink = 0, colour = 0;
  for (let i = 0; i < data.length; i += info.channels) {
    const index = i / info.channels, x = index % info.width, y = Math.floor(index / info.width);
    if (x < x0 || x >= x1 || y < y0 || y >= y1) continue;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    if (r > 245 && g > 245 && b > 245) continue;
    ink++;
    // Strongly coloured: a saturated pixel (yellow face, red heart, blue flag), never grey anti-aliasing of a black silhouette.
    if (Math.max(r, g, b) - Math.min(r, g, b) > 80) colour++;
  }
  return {ink, colour, width: info.width, height: info.height};
};

// 1. Packs, policy rows and the colour-font record.
assert.deepEqual(scriptFontPackages(['Zsye']).map(item => item.name), ['@expo-google-fonts/noto-color-emoji', '@expo-google-fonts/noto-emoji']);
assert.deepEqual(scriptFontPackages(['Zmth']).map(item => item.name), ['@expo-google-fonts/stix-two-math', '@expo-google-fonts/noto-sans-math']);
const colorEmoji = BUNDLED_FONT_MANIFEST.packages.find(item => item.name === '@expo-google-fonts/noto-color-emoji');
assert.deepEqual(colorEmoji.color, {format: 'COLRv1, SVG', rasterFamily: 'Noto Emoji'});
assert.deepEqual(COLOR_FONT_FACES.map(face => [face.family, face.rasterFamily, face.format]), [['Noto Color Emoji', 'Noto Emoji', 'COLRv1, SVG']]);
assert.deepEqual([...EMOJI_FONT_FAMILIES], ['Noto Color Emoji', 'Noto Emoji']);
assert.deepEqual(designatedFamilies('Zsye'), ['Noto Color Emoji']);
assert.deepEqual(designatedFamilies('Zmth'), ['Noto Sans Math', 'STIX Two Math']);
assert.deepEqual(designatedFamilies('Zmth', true), ['STIX Two Math', 'Noto Sans Math']);
for (const [family, replacement, alternates] of [['Segoe UI Emoji', 'Noto Color Emoji', ['Noto Emoji']], ['Cambria Math', 'STIX Two Math', ['Noto Sans Math', 'Caladea']]]) {
  const row = fontPolicyFor(family);
  assert.deepEqual([row.replacement.family, row.replacement.compatibility, row.replacement.measured, row.alternates], [replacement, 'visual', null, alternates], family);
  assert.deepEqual([...FONT_COMPATIBILITY.find(rule => rule.requestedFamily === family).substitutes], [replacement, ...alternates]);
  for (const open of [replacement, ...alternates]) assert.equal(fontPolicyFor(open).licenseClass, 'open', `${open} has an open row`);
}
assert.equal(scriptFontAliases(['Noto Color Emoji', 'Noto Emoji', 'STIX Two Math', 'Noto Sans Math'])['Segoe UI Emoji'], 'Noto Color Emoji');
assert.equal(scriptFontAliases(['Noto Emoji'])['Segoe UI Emoji'], 'Noto Emoji');
assert.equal(scriptFontAliases(['STIX Two Math', 'Noto Sans Math'])['Cambria Math'], 'STIX Two Math');
assert.equal(scriptFontAliases(['Noto Sans Math'])['Cambria Math'], 'Noto Sans Math');
// The chain tries every real script face before the emoji and math faces; the two symbol faces (FF-45 symbols) close it.
const chain = glyphFallbackFamilies('\u{1F600}', core.resolveScriptFonts(deck('x')));
assert.deepEqual(chain.slice(-5), ['Noto Color Emoji', 'Noto Sans Math', 'STIX Two Math', 'Noto Sans Symbols 2', 'Noto Sans Symbols'], 'a sans deck: the sans math face first, then the symbol faces');
assert.equal(chain[0], 'Noto Sans');

// 2. Detection: emoji presentation and mathematical notation are reported as Zsye and Zmth; text-default symbols are not.
for (const text of Object.values(EMOJI)) assert.ok(hasEmojiPresentation(text), text);
for (const text of ['\u2764', '\u00A9', '\u263A', '123', '#', '\u2764\uFE0E']) assert.ok(!hasEmojiPresentation(text), `text presentation: ${text}`);
for (const text of ['\u{1D44E}', '\u211D', '\u2A00', '\u27C5']) assert.ok(hasMathNotation(text), text);
for (const text of ['x \u2264 y', '\u2211 \u222B \u221A', '\u2192', '\u2122', 'E = mc\u00B2']) assert.ok(!hasMathNotation(text), `plain operators do not load the math pack: ${text}`);
assert.deepEqual(detectPresentationScripts(deck(`Launch ${EMOJI.rocket}`)), ['Zsye']);
assert.deepEqual(detectPresentationScripts(deck(`I ${EMOJI.heartVS16} math \u{1D465}`)), ['Zmth', 'Zsye']);
assert.deepEqual(detectPresentationScripts(deck('\u211D is the real line')), ['Zmth']);
assert.deepEqual(detectPresentationScripts(deck('x \u2264 y \u2192 z')), []);
assert.deepEqual(detectPresentationScripts(deck('Review', 'Body', scheme('Segoe UI Emoji'))), [], 'detection reports drawn text; the scheme font is a design script');

// 3. Loading: scripts 'auto' loads the packs a deck needs, by text or by its font scheme; every face resolves under the metric policy.
{
  const emoji = await loadFonts({pack: 'office', scripts: 'auto', presentation: deck(`Hello ${EMOJI.family}`)});
  assert.deepEqual(emoji.registry.scriptSelection.packages, ['@expo-google-fonts/noto-color-emoji', '@expo-google-fonts/noto-emoji']);
  const math = await loadFonts({pack: 'office', scripts: 'auto', presentation: deck('Theorem', 'Proof', scheme('Cambria Math'))});
  assert.deepEqual(math.registry.scriptSelection.packages, ['@expo-google-fonts/stix-two-math', '@expo-google-fonts/noto-sans-math'], 'a Cambria Math scheme loads the math pack');
  assert.equal(math.registry.resolveFont({fontFamily: 'Cambria Math', fontWeight: 700}).resolvedFamily, 'STIX Two Math');
  const latin = await loadFonts({pack: 'office', scripts: 'auto', presentation: deck('Quarterly review', 'Plain text, x \u2264 y')});
  assert.deepEqual(latin.registry.scriptSelection.packages, [], 'Latin text with plain operators loads nothing');
  // Without the packs the policy says what to load; nothing falls through to body text silently.
  assert.throws(() => latin.registry.resolveFont({fontFamily: 'Segoe UI Emoji', fontWeight: 400}), error => error.code === 'font-unavailable' && error.details.replacement === 'Noto Color Emoji' && error.details.packs.includes('scripts'));
  assert.throws(() => latin.registry.resolveFont({fontFamily: 'Cambria Math', fontWeight: 400}), error => error.code === 'font-unavailable' && error.details.replacement === 'STIX Two Math');
}
const fonts = await loadFonts({pack: 'office', scripts: 'all'});
const {registry} = fonts, raw = registry.textMeasurement;
const resolved = family => registry.resolveFont({fontFamily: family, fontWeight: 400});
assert.deepEqual([resolved('Segoe UI Emoji').resolvedFamily, resolved('Segoe UI Emoji').compatibility, resolved('Segoe UI Emoji').sourceFamily], ['Noto Color Emoji', 'visual', 'Segoe UI Emoji']);
assert.deepEqual([resolved('Cambria Math').resolvedFamily, resolved('Cambria Math').compatibility, resolved('Cambria Math').substitute], ['STIX Two Math', 'visual', true]);
for (const family of ['Noto Color Emoji', 'Noto Emoji', 'STIX Two Math', 'Noto Sans Math']) assert.deepEqual([resolved(family).resolvedFamily, resolved(family).compatibility, resolved(family).substitute], [family, 'exact', false], `${family} resolves to itself`);
// The math faces have one weight: bold and italic requests take the regular face and say so.
assert.deepEqual([resolved('STIX Two Math').resolvedWeight, registry.resolveFont({fontFamily: 'Cambria Math', fontWeight: 700, italic: true}).resolvedWeight], [400, 400]);
assert.equal(registry.resolveFont({fontFamily: 'Cambria Math', fontWeight: 700, italic: true}).compatibility, 'visual');
// Raster font files: the registry lists the colour file (hosts serve it to browsers); the raster path leaves it out.
const colorFile = registry.fontFiles.find(file => /NotoColorEmoji_400Regular\.ttf$/.test(file));
assert.ok(colorFile, 'the colour face is in fontFiles');
assert.ok(!rasterFontFiles(registry.fontFiles).includes(colorFile) && rasterFontFiles(registry.fontFiles).length === registry.fontFiles.length - 1);
assert.ok(rasterFontFiles(registry.fontFiles).some(file => /NotoEmoji_400Regular\.ttf$/.test(file)));

// 4. Shaping: every sequence is one glyph with one advance in the emoji faces; through the alias the Segoe UI Emoji request measures the same.
for (const [name, text] of Object.entries(EMOJI)) {
  near(em(registry, text, 'Noto Color Emoji'), NOTO_COLOR_EMOJI_ADVANCE, 0.0005, `${name} in Noto Color Emoji`);
  near(em(registry, text, 'Noto Emoji'), NOTO_EMOJI_ADVANCE, 0.0005, `${name} in Noto Emoji`);
  near(em(registry, text, 'Segoe UI Emoji'), NOTO_COLOR_EMOJI_ADVANCE, 0.0005, `${name} requested as Segoe UI Emoji`);
  near(em(registry, text + text, 'Noto Color Emoji'), 2 * NOTO_COLOR_EMOJI_ADVANCE, 0.001, `${name} twice`);
  const outline = raw.outlineBounds(text, 1000, {fontFamily: 'Noto Color Emoji', fontWeight: 400});
  assert.ok(outline && outline.width > 1000 && outline.height > 1000, `${name}: a COLRv1 glyph reports its em box, not a crash`);
}
// Variation selector 15 asks for text presentation: the base character alone, drawn by a text face when one has it.
near(em(registry, '\u2764\uFE0E', 'Noto Color Emoji'), NOTO_COLOR_EMOJI_ADVANCE, 0.0005, 'VS15 in the emoji face still draws one glyph');
// The recorded width delta against Segoe UI Emoji: -9.3% per emoji; not pinned by textLength stretching (a stretched emoji is wrong), documented instead.
near(NOTO_COLOR_EMOJI_ADVANCE / SEGOE_UI_EMOJI_ADVANCE - 1, -0.0932, 0.0005, 'documented delta');

// 5. Planning: emoji sequences never split across faces, Latin text and digits of a Segoe UI Emoji run take a text face, VS15 prefers text.
const profile = core.resolveScriptFonts(deck('x'));
const planner = createScriptFonts(profile, raw);
const plan = (text, family = 'Roboto') => planner.plan(text, {fontFamily: family, fontWeight: 400, italic: false}).map(run => [run.own ? family : run.family, run.text]);
for (const [name, text] of Object.entries(EMOJI)) {
  assert.deepEqual(plan(`Hello ${text} world`), [['Roboto', 'Hello '], ['Noto Color Emoji', text], ['Roboto', ' world']], `${name} is one run in the emoji face`);
  assert.deepEqual(plan(text, 'Segoe UI Emoji'), [['Noto Color Emoji', text]], `${name} in a Segoe UI Emoji run`);
}
assert.deepEqual(plan(`${EMOJI.family}${EMOJI.flag}${EMOJI.thumbsMedium}`), [['Noto Color Emoji', `${EMOJI.family}${EMOJI.flag}${EMOJI.thumbsMedium}`]], 'adjacent sequences merge into one run');
{
  // With the symbol faces loaded as well (FF-45), the chain's text faces include Noto Sans Symbols 2, which draws the heart.
  const textFace = ['Roboto', ...designatedFamilies('Latn'), 'Noto Sans Symbols 2'].find(family => strictCovers(registry, family, '❤'));
  const heart = plan('I \u2764\uFE0E you').find(([, text]) => text.includes('\u2764'));
  assert.equal(heart[0], textFace ?? 'Noto Color Emoji', 'VS15 keeps a text face when one has the heart');
}
assert.deepEqual(plan('I \u2764\uFE0F you'), [['Roboto', 'I '], ['Noto Color Emoji', '\u2764\uFE0F'], ['Roboto', ' you']], 'VS16 takes the emoji face even though Roboto draws U+2764');
{
  const runs = plan(`Score 42 ${EMOJI.rocket}`, 'Segoe UI Emoji');
  assert.deepEqual(runs.map(([, text]) => text), ['Score 42 ', EMOJI.rocket]);
  assert.ok(!EMOJI_FONT_FAMILIES.includes(runs[0][0]) && runs[0][0] !== 'Segoe UI Emoji', `Latin text of a Segoe UI Emoji run takes a text face, got ${runs[0][0]}`);
  assert.equal(runs[1][0], 'Noto Color Emoji');
  const digits = plan('2024', 'Segoe UI Emoji');
  assert.ok(digits.length === 1 && !EMOJI_FONT_FAMILIES.includes(digits[0][0]), `digits of a Segoe UI Emoji run take a text face, got ${digits[0][0]}`);
}
// Measurement agreement: the wrapped measurement is the sum of its planned runs, and emoji inside a word never change line-breaking widths elsewhere.
const scripted = createScriptTextMeasurement(raw, profile);
for (const text of [`Hello ${EMOJI.family} world`, `${EMOJI.flag}${EMOJI.keycap}`, `Launch ${EMOJI.rocket}!`]) {
  const expected = planner.plan(text, {fontFamily: 'Roboto', fontWeight: 400}).reduce((total, run) => total + raw.measure(run.text, 24, {fontFamily: run.own ? 'Roboto' : run.family, fontWeight: 400}), 0);
  near(scripted.measure(text, 24, {fontFamily: 'Roboto', fontWeight: 400}), expected, 1e-9, text);
}
near(scripted.measure(`Hello ${EMOJI.grinning} world`, 24, {fontFamily: 'Roboto', fontWeight: 400}) - scripted.measure('Hello  world', 24, {fontFamily: 'Roboto', fontWeight: 400}), NOTO_COLOR_EMOJI_ADVANCE * 24, 1e-6, 'an emoji adds exactly its advance');
assert.ok(planner.fallbacks.some(note => note.fontFamily === 'Roboto' && note.fallbackFamily === 'Noto Color Emoji' && note.scripts.includes('Zyyy')), 'the emoji fallback is noted');
// Strict faces still raise missing-glyph: the emoji path is a glyph fallback, not a change of strict mode.
assert.throws(() => createScriptTextMeasurement(raw, profile, {glyphFallback: 'none'}).measure(`Hi ${EMOJI.grinning}`, 24, {fontFamily: 'Roboto', fontWeight: 400}), {code: 'missing-glyph'});

// 6. Math: coverage of the corpus, per-character fallback, recorded advance deltas against Cambria Math (gated), metrics.
// Advances of Cambria Math 6.99 (cambria.ttc, the "Cambria Math" face, 2048 upem), read in place from C:\Windows\Fonts on 2026-10-01 with fontkit
// 2.0.4 and default features; no outline or table was copied. Widths are in em per corpus string.
const MATH_CORPUS = [
  ['The quick brown fox', 8.7300], ['Let f be continuous on [a, b]', 11.8208], ['where x and y are real numbers', 13.4429], ['Theorem 2.1 (Mean value)', 11.3169], ['Proof. Suppose that', 8.3022],
  ['0123456789', 5.5371], ['3.14159', 3.5273], ['2024', 2.2148],
  ['\u03B1\u03B2\u03B3\u03B4\u03B5\u03B6\u03B7\u03B8', 4.0859], ['\u03BB\u03BC\u03BD\u03BE\u03C0\u03C1\u03C3\u03C4', 4.1104], ['\u0393\u0394\u0398\u039B\u039E\u03A0\u03A3\u03A6\u03A8\u03A9', 6.2886], ['\u03C6\u03C7\u03C8\u03C9', 2.6489],
  ['\u2211 \u222B \u221A \u2264 \u2260 \u221E \u00B1', 6.3667], ['\u2202 \u2207 \u220F \u222E \u2248 \u2261', 5.1377], ['\u00D7 \u00F7 \u00B7 \u2218 \u2217', 3.5508], ['\u2282 \u2286 \u2208 \u2209 \u222A \u2229', 5.2207], ['\u2200 \u2203 \u00AC \u2227 \u2228 \u21D2 \u21D4', 6.3643],
  ['\u2192 \u2190 \u2194 \u21D2 \u21D0', 5.2090], ['\u21A6 \u2191 \u2193 \u27F6', 3.6484],
  ['\u{1D44E}\u{1D44F}\u{1D450}', 1.5562], ['\u{1D465}\u{1D466}\u{1D467}', 1.5752], ['\u{1D453}(\u{1D465})', 1.9121],
  ['\u211D \u2102 \u2115 \u2124 \u211A', 4.3159], ['\u{1D538}\u{1D539}\u{1D53B}', 2.2168],
  ['\u{1D4D0}\u{1D4D1}\u{1D4D2}', 2.3276], ['\u{1D504}\u{1D505}\u{1D507}', 2.2881], ['\u212C \u2130 \u2131', 2.3848],
  ['E = mc\u00B2', 3.4429], ['x\u00B2 + y\u00B2 = r\u00B2', 4.9976], ['f(x) = \u222B g(t) dt', 6.3862], ['a \u2264 b < \u221E', 4.2651],
];
const mathPlanner = createScriptFonts(core.resolveScriptFonts(deck('x', 'y', scheme('Cambria Math'))), raw);
const deltas = [];
for (const [text] of MATH_CORPUS) {
  assert.ok(strictCovers(registry, 'STIX Two Math', text), `STIX Two Math covers ${JSON.stringify(text)}`);
  const runs = mathPlanner.plan(text, {fontFamily: 'Cambria Math', fontWeight: 400, italic: false});
  // One run: either the style's own family (which the registry aliases to STIX Two Math) or STIX Two Math named for a per-character plan.
  assert.ok(runs.length === 1 && (runs[0].own || runs[0].family === 'STIX Two Math'), `${JSON.stringify(text)} is one run in STIX Two Math: ${JSON.stringify(runs)}`);
}
for (const [text, cambria] of MATH_CORPUS) deltas.push(em(registry, text, 'Cambria Math') / cambria - 1);
const meanAbs = deltas.reduce((total, delta) => total + Math.abs(delta), 0) / deltas.length, maxAbs = Math.max(...deltas.map(Math.abs));
// Recorded 2026-10-01: mean 4.98%, max 18.16% (arrows); Latin strings 0.94%. The gate keeps the route from regressing past the record.
assert.ok(meanAbs <= 0.0505 && maxAbs <= 0.185, `Cambria Math -> STIX Two Math widths: mean ${(meanAbs * 100).toFixed(2)}% max ${(maxAbs * 100).toFixed(2)}%`);
const latinDeltas = deltas.slice(0, 5);
assert.ok(latinDeltas.every(delta => Math.abs(delta) <= 0.0140), `Latin text in a Cambria Math run: ${latinDeltas.map(delta => (delta * 100).toFixed(2) + '%').join(' ')}`);
// Per-character advances of the replacement (em) and the real font's, for the native deck.
for (const [character, stix, cambriaMath] of [['\u2211', 0.9360, 0.7085], ['\u222B', 0.6840, 0.5864], ['\u221A', 0.7940, 0.6567], ['\u2264', 0.7200, 0.7490], ['\u221E', 0.9530, 0.8506], ['\u{1D44E}', 0.5550, 0.5571], ['\u211D', 0.7290, 0.7446], ['x', 0.4790, 0.4834], ['2', 0.4950, 0.5537]]) {
  near(em(registry, character, 'STIX Two Math'), stix, 0.0005, `U+${character.codePointAt(0).toString(16)} in STIX Two Math`);
  assert.ok(cambriaMath > 0.4 && cambriaMath < 1);
}
// A character STIX Two Math lacks (U+1D62 subscript i) takes another face per character, noted; nothing fails.
{
  const text = 'x\u1D62 + \u{1D465}';
  const runs = mathPlanner.plan(text, {fontFamily: 'Cambria Math', fontWeight: 400, italic: false});
  assert.ok(!strictCovers(registry, 'STIX Two Math', '\u1D62'));
  const sub = runs.find(run => run.text.includes('\u1D62'));
  assert.ok(sub && sub.family !== 'STIX Two Math' && strictCovers(registry, sub.family, sub.text), `U+1D62 falls back to ${sub?.family}`);
  assert.equal(runs.find(run => run.text.includes('\u{1D465}')).family, 'STIX Two Math');
  assert.ok(mathPlanner.fallbacks.some(note => note.fontFamily === 'STIX Two Math' && note.characters.includes('\u1D62')));
}
// Vertical metrics of the replacement (em): hhea 0.762/-0.238/0.25 and OS/2 typo 0.762/-0.238/0.25; Cambria Math's typo values are
// 0.7778/-0.2222/0.1724 (its hhea line gap 0.1724), so a STIX line is 1.25 em against 1.1724 em in PowerPoint (+6.6%).
{
  const stix = registry.describeFaces().find(face => face.family === 'STIX Two Math');
  assert.ok(stix && stix.scripts.includes('Zmth'));
  const box = raw.outlineBounds('\u222B', 1000, {fontFamily: 'STIX Two Math', fontWeight: 400});
  assert.ok(box && box.height > 900, 'the integral sign has a real outline in STIX Two Math');
}
// Sans schemes fall back to Noto Sans Math first for a math character the design face lacks; serif schemes to STIX Two Math.
assert.equal(createScriptFonts(profile, raw).plan('\u{1D465}', {fontFamily: 'Roboto', fontWeight: 400})[0].family, 'Noto Sans Math');
assert.equal(createScriptFonts({...profile, serif: true}, raw).plan('\u{1D465}', {fontFamily: 'Tinos', fontWeight: 400})[0].family, 'STIX Two Math');

// 7. SVG and raster. The SVG names the emoji and math faces per run; the raster draws emoji as monochrome Noto Emoji (resvg draws no
// COLRv1 or OT-SVG glyphs) and math as STIX outlines; both are deterministic.
const title = `Launch ${EMOJI.rocket} ${EMOJI.family} ${EMOJI.flag}`;
const emojiDeck = deck(title, `Keycap ${EMOJI.keycap} heart ${EMOJI.heartVS16}`);
const svgOptions = document => ({ fonts: {...fonts, textMeasurement: createScriptTextMeasurement(raw, core.resolveScriptFonts(document))}});
const diagnostics = [];
const svg = renderSlideSvg(emojiDeck, 0, {...svgOptions(emojiDeck), onDiagnostic: item => diagnostics.push(item)});
assert.equal(svg, renderSlideSvg(emojiDeck, 0, svgOptions(emojiDeck)), 'deterministic SVG');
const emojiRuns = drawnRuns(svg).filter(([family]) => family === 'Noto Color Emoji').map(([, text]) => text);
assert.deepEqual(emojiRuns, [EMOJI.rocket, EMOJI.family, EMOJI.flag, EMOJI.keycap, EMOJI.heartVS16], 'each sequence is one run in the colour face');
assert.ok(!svg.includes('Noto Emoji') && !svg.includes('Segoe UI Emoji'), 'the SVG names the colour face; exporters keep the chosen family elsewhere');
assert.ok(diagnostics.some(item => item.code === 'font-glyph-fallback' && item.fallbackFamily === 'Noto Color Emoji'));
assert.ok(!diagnostics.some(item => item.code === 'missing-glyph'));
const rasterSvg = monochromeColorFonts(svg);
assert.ok(!rasterSvg.includes('Noto Color Emoji') && (rasterSvg.match(/"Noto Emoji, sans-serif"/g) ?? []).length === emojiRuns.length, 'the raster pass renames every colour run');
assert.equal(monochromeColorFonts('<svg><text font-family="Roboto, sans-serif">x</text></svg>'), '<svg><text font-family="Roboto, sans-serif">x</text></svg>');
const png = await svgToPng(svg, {fonts: fonts});
assert.deepEqual(await svgToPng(svg, {fonts: fonts}), png, 'deterministic raster');
assert.deepEqual(await svgToPng(svg, { fonts: {...fonts, fontFiles: rasterFontFiles(fonts.fontFiles)}}), png, 'the colour file never reaches resvg');
// A minimal emoji-only SVG on white: ink, monochrome; the same text in a face resvg cannot draw would be blank.
const probe = text => `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="120" viewBox="0 0 400 120"><rect width="400" height="120" fill="#fff"/><text x="10" y="90" font-family="Noto Color Emoji, sans-serif" font-size="80" fill="#000">${text}</text></svg>`;
for (const [name, text] of Object.entries(EMOJI)) {
  const ink = await inkOf(await svgToPng(probe(text), {fonts: fonts}));
  assert.ok(ink.ink > 500, `${name}: the raster draws a silhouette (${ink.ink} px)`);
  assert.equal(ink.colour, 0, `${name}: the raster is monochrome (documented limit: resvg has no COLRv1 or OT-SVG support)`);
}
{
  const {Resvg} = await import('@resvg/resvg-js');
  const blank = new Resvg(probe(EMOJI.grinning), {font: {fontFiles: [colorFile], defaultFontFamily: 'Noto Color Emoji'}, logLevel: 'off'}).render().asPng();
  assert.equal((await inkOf(blank)).ink, 0, 'resvg 2.6.2 paints nothing from the COLRv1 and SVG tables: the reason for the monochrome stand-in');
}
const mathDeck = deck('\u2211 \u222B \u221A \u{1D44E} \u211D \u2264 \u221E', 'f(x) = \u222B g(t) dt', scheme('Cambria Math'));
const mathSvg = renderSlideSvg(mathDeck, 0, svgOptions(mathDeck));
assert.ok(drawnRuns(mathSvg).some(([family, text]) => family === 'STIX Two Math' && text.includes('\u2211')), 'the title draws in STIX Two Math');
assert.ok(!mathSvg.includes('Cambria Math'));
const mathInk = await inkOf(await svgToPng(`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="120" viewBox="0 0 600 120"><rect width="600" height="120" fill="#fff"/><text x="10" y="90" font-family="STIX Two Math, serif" font-size="72" fill="#000">\u2211 \u222B \u221A \u{1D44E} \u211D</text></svg>`, {fonts: fonts}));
assert.ok(mathInk.ink > 800, `math glyphs rasterize (${mathInk.ink} px)`);
assert.ok((await svgToPng(mathSvg, {fonts: fonts})).length > 1000);

console.log(JSON.stringify({test: 'emoji-math', sequences: Object.keys(EMOJI).length, emojiAdvanceEm: NOTO_COLOR_EMOJI_ADVANCE, segoeAdvanceEm: SEGOE_UI_EMOJI_ADVANCE, mathCorpus: MATH_CORPUS.length, stixMeanAbs: Number((meanAbs * 100).toFixed(2)), stixMaxAbs: Number((maxAbs * 100).toFixed(2)), raster: 'monochrome Noto Emoji'}));
