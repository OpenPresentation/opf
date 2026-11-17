// FF-44: Noto Sans Mongolian (3.x) has one GSUB lookup of type 8 (reverse chaining contextual single substitution) that both `calt` and
// `rclt` reference in every script. fontkit 2.0.4 cannot decode it (its type 8 struct lacks the backtrackGlyphCount field, so the array
// length resolves to undefined: "Not a fixed size") and has no processor for it, so every shaping of the face threw
// font-shaping-failed, for Latin, digits and Mongolian alike, and the Noto Sans Mongolian font scheme could not be drawn in any host; the
// renderer then skipped lookups it could not decode. fontkit 3 decodes and applies the lookup, so no guard remains. The expected advances
// below are the widths HarfBuzz (the shaper Chromium uses) measures for the same face at 100 px, and fontkit 3 measures the same: all six
// samples, the one with a variation selector included, are equal within 0.05 px. They follow the pinned face:
// @expo-google-fonts/noto-sans-mongolian 0.4.2 re-spaced the Mongolian advances (0.4.1 measured 603.00, 568.50, 758.41, 1468.50 and
// 630.00 in Edge).
import assert from 'node:assert/strict';
import {toSvg} from './catalog-harness.mjs'; // FA-23: registers the gallery snapshot (the documents name gallery records)
import {loadFonts} from '../dist/fonts-node.js';

const prepared = await loadFonts({pack: 'office', scripts: ['Mong']}), {registry} = prepared;
const style = {fontFamily: 'Noto Sans Mongolian', fontWeight: 400};
const at100 = text => registry.textMeasurement.measure(text, 100, style);
const samples = [
  ['Font scheme preview 2026', 1245.91, 0.05],
  ['ᠮᠣᠩᠭᠣᠯ ᠤᠯᠤᠰ', 576.70, 0.05],
  ['ᠴᠢᠩᠭᠢᠰ ᠬᠠᠭᠠᠨ', 572.50, 0.05],
  ['ᠮᠣᠩᠭᠣᠯ ᠬᠡᠯᠡ ᠪᠢᠴᠢᠭ', 732.10, 0.05],
  ['ᠪᠢᠳᠡ ᠮᠣᠩᠭᠣᠯ ᠤᠯᠤᠰ ᠤᠨ ᠬᠥᠮᠥᠨ ᠪᠢᠨᠢ', 1442.20, 0.05],
  ['ᠰᠠᠢᠨ ᠪᠠᠶᠢᠨ᠎ᠠ ᠤᠤ', 636.80, 0.05],
];
for (const [text, expected, tolerance] of samples) {
  const width = at100(text);
  assert.ok(Math.abs(width - expected) <= tolerance, `${text}: ${width.toFixed(2)} px at 100 px, a browser measures ${expected} (tolerance ${tolerance})`);
}
// Repeated measurement agrees.
assert.equal(at100(samples[1][0]), at100(samples[1][0]));
// The gallery's Noto Sans Mongolian font scheme draws end to end: heading, body and the Mongolian sample text, with the strict registry.
const deck = title => ({$schema: 'https://openpresentation.org/schema/opf/v1', name: 'Mongolian', design: {fontScheme: 'noto-sans-mongolian'}, slides: [{title, text: 'Body'}]});
for (const title of ['Font scheme preview', 'ᠮᠣᠩᠭᠣᠯ ᠤᠯᠤᠰ']) {
  const svgs = toSvg(deck(title), { fonts: {...prepared, textMeasurement: registry.textMeasurement}});
  assert.equal(svgs.length, 1, title);
  assert.ok(svgs[0].includes('Noto Sans Mongolian'), `${title}: drawn in Noto Sans Mongolian`);
}
console.log(`Mongolian shaping passed: ${samples.length} samples within the browser's advances (the GSUB type 8 lookup applied), scheme deck rendered.`);
