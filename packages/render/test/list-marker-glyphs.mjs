// LH-85: nested-list markers never draw as a missing-glyph box. Core's markers (LIST_MARKERS: • and the en dash, by level)
// are glyphs every bundled face a font scheme draws list text in has; ◦ and ▪, the former level 1 and 2 markers, are missing
// from most of them (Roboto among them), which drew a box in the preview (b13 s27). Offline and deterministic.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import * as fontkit from 'fontkit';
import {LIST_MARKERS} from '@openpresentation/opf/composition';
import {BUNDLED_FONT_MANIFEST} from '../src/font-manifest.js';
import {loadFonts} from '../dist/fonts-node.js';
import {toPng, toSvg} from './catalog-harness.mjs';

const require = createRequire(import.meta.url), root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const markers = [...LIST_MARKERS];
assert.deepEqual(markers, ['•', '–'], 'the markers are the bullet and the en dash');

// 1. Every face of the base, office and open packs (the faces font schemes draw text in) has every marker glyph.
let faces = 0;
const lacking = new Set();
for (const pkg of BUNDLED_FONT_MANIFEST.packages.filter(item => ['base', 'office', 'open'].includes(item.pack))) {
  const directory = pkg.vendored ? path.join(root, pkg.vendored) : path.dirname(require.resolve(`${pkg.name}/package.json`));
  for (const face of pkg.faces) {
    const font = fontkit.create(await readFile(path.join(directory, face.file)));
    for (const marker of markers) assert.ok(font.hasGlyphForCodePoint(marker.codePointAt(0)), `${face.family} ${face.weight}${face.italic ? ' italic' : ''} has ${marker}`);
    if (!font.hasGlyphForCodePoint(0x25e6) || !font.hasGlyphForCodePoint(0x25aa)) lacking.add(face.family);
    faces++;
  }
}
assert.ok(lacking.has('Roboto'), 'the default face lacks ◦ or ▪, the glyphs the markers no longer use');

// 2. A nested list rendered in the default scheme and in an open-pack scheme: every drawn marker is a glyph of its face. The
// registry's strict measurement raises missing-glyph for a character its face lacks.
const {registry} = await loadFonts({pack: 'office'});
const items = ['Capacity', {text: 'Churn risk', description: 'Mitigation ships in November.'}, {text: 'Vendor SLA', level: 1}, {text: 'Escalate', level: 2}, {text: 'Owner', level: 3}];
const drawn = svg => [...svg.matchAll(/<text\b([^>]*\baria-hidden="true"[^>]*)>([^<]*)<\/text>/g)].map(([, attributes, text]) => ({
  text, family: /font-family="([^",]*)/.exec(attributes)[1].replace(/^'|'$/g, ''), size: +/font-size="([^"]*)"/.exec(attributes)[1],
}));
let checked = 0;
for (const fontScheme of ['roboto', 'montserrat']) {
  const deck = {$schema: 'https://openpresentation.org/schema/opf/v1', name: `markers ${fontScheme}`, design: {fontScheme}, slides: [{id: 'a', title: 'Why this matters', items}]};
  const svg = toSvg(deck, 1);
  const list = drawn(svg);
  assert.deepEqual(list.map(marker => marker.text), ['•', '•', '–', '•', '–'], `${fontScheme}: levels 0, 0, 1, 2 and 3 draw •, •, –, • and –`);
  for (const marker of list) {
    assert.doesNotThrow(() => registry.textMeasurement.measure(marker.text, marker.size, {fontFamily: marker.family, fontWeight: 400}), `${fontScheme}: ${marker.family} draws ${marker.text}`);
    checked++;
  }
  assert.ok((await toPng(svg, {scale: .25})).length > 0, `${fontScheme}: the slide rasterizes`);
}

console.log(`List marker glyphs passed: ${faces} bundled faces have ${markers.join(' and ')}; ${checked} drawn markers measured without a missing glyph (${lacking.size} families lack ◦ or ▪).`);
