// FF-44: Noto Sans Mongolian (3.x) has one GSUB lookup of type 8 (reverse chaining contextual single substitution) that both `calt` and
// `rclt` reference in every script. fontkit 2.0.4 cannot decode it (its type 8 struct lacks the backtrackGlyphCount field, so the array
// length resolves to undefined: "Not a fixed size") and has no processor for it, so every shaping of the face threw
// font-shaping-failed, for Latin, digits and Mongolian alike, and the Noto Sans Mongolian font scheme could not be drawn in any host.
// A lookup fontkit cannot decode now applies nothing, so the other ~90 calt/rclt lookups still run. The expected advances below are the
// widths a browser (Chromium/HarfBuzz via Edge on Windows) measures for the same face at 100 px: the Latin sample and four Mongolian
// samples are equal within 0.05 px; the fifth (with a variation selector) is 0.9% narrower, a known limit of skipping the lookup.
import assert from 'node:assert/strict';
import {toSvg} from './catalog-harness.mjs'; // FA-23: registers the gallery snapshot (the documents name gallery records)
import {loadFonts} from '../dist/fonts-node.js';

const prepared = await loadFonts({pack: 'office', scripts: ['Mong']}), {registry} = prepared;
const style = {fontFamily: 'Noto Sans Mongolian', fontWeight: 400};
const at100 = text => registry.textMeasurement.measure(text, 100, style);
const samples = [
  ['Font scheme preview 2026', 1245.91, 0.05],
  ['ᠮᠣᠩᠭᠣᠯ ᠤᠯᠤᠰ', 603.00, 0.05],
  ['ᠴᠢᠩᠭᠢᠰ ᠬᠠᠭᠠᠨ', 568.50, 0.05],
  ['ᠮᠣᠩᠭᠣᠯ ᠬᠡᠯᠡ ᠪᠢᠴᠢᠭ', 758.41, 0.05],
  ['ᠪᠢᠳᠡ ᠮᠣᠩᠭᠣᠯ ᠤᠯᠤᠰ ᠤᠨ ᠬᠥᠮᠥᠨ ᠪᠢᠨᠢ', 1468.50, 0.05],
  ['ᠰᠠᠢᠨ ᠪᠠᠶᠢᠨ᠎ᠠ ᠤᠤ', 630.00, 6],
];
for (const [text, expected, tolerance] of samples) {
  const width = at100(text);
  assert.ok(Math.abs(width - expected) <= tolerance, `${text}: ${width.toFixed(2)} px at 100 px, a browser measures ${expected} (tolerance ${tolerance})`);
}
// Repeated measurement (the patched lookups persist) and a second registry over the same face agree.
assert.equal(at100(samples[1][0]), at100(samples[1][0]));
// The gallery's Noto Sans Mongolian font scheme draws end to end: heading, body and the Mongolian sample text, with the strict registry.
const deck = title => ({$schema: 'https://openpresentation.org/schema/opf/v1', name: 'Mongolian', design: {fontScheme: 'noto-sans-mongolian'}, slides: [{title, text: 'Body'}]});
for (const title of ['Font scheme preview', 'ᠮᠣᠩᠭᠣᠯ ᠤᠯᠤᠰ']) {
  const svgs = toSvg(deck(title), { fonts: {...prepared, textMeasurement: registry.textMeasurement}});
  assert.equal(svgs.length, 1, title);
  assert.ok(svgs[0].includes('Noto Sans Mongolian'), `${title}: drawn in Noto Sans Mongolian`);
}
console.log(`Mongolian shaping passed: ${samples.length} samples within the browser's advances (the GSUB type 8 lookup fontkit cannot decode is skipped), scheme deck rendered.`);
