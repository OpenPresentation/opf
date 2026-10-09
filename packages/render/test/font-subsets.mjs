// RR-65: each face an SVG embeds is cut to the characters the slide draws (hb-subset from the pinned harfbuzzjs), keeping every
// layout feature, so it shapes exactly like the whole face. Checked here: the handle's engine, smaller faces, byte stability,
// `subsetFonts: false`, the permission rule (license, Reserved Font Names, host faces, fsType), identical fontkit shaping on Latin,
// Arabic and Japanese text, a vector PDF made from the subset SVGs alone, and the size over a set of core example decks.
import assert from 'node:assert/strict';
import { create } from 'fontkit';
import { examples } from '@openpresentation/opf/examples';
import { loadFonts } from '../dist/fonts-node.js';
import { fsTypeAllowsSubset, subsetPermitted } from '../dist/font-subset.js';
import { renderSlideSvg, renderSvg, svgToPdf } from './catalog-harness.mjs'; // FA-23: registers the gallery snapshot (the examples name gallery records)

const fonts = await loadFonts({ pack: 'office', substitutionPolicy: 'visual', scripts: 'all', embedScriptFonts: true });
const embedded = (svg) => [...svg.matchAll(/@font-face\{font-family:"([^"]+)";font-weight:(\d+);font-style:(\w+);src:url\("data:font\/\w+;base64,([^"]+)"\)\}/g)]
  .map(([, family, weight, style, base64]) => ({ family, weight: Number(weight), italic: style === 'italic', data: new Uint8Array(Buffer.from(base64, 'base64')) }));
const whole = (face) => fonts.registry.exportFaces()[fonts.registry.describeFaces().findIndex((other) => other.family === face.family && other.weight === face.weight && Boolean(other.italic) === face.italic)].data;

// The Node handle carries the engine; the option is a boolean.
assert.equal(typeof fonts.subsets?.subsetDataUrl, 'function', 'the Node handle carries the subset engine');
const deck = { name: 'Subsets', design: { fontScheme: 'roboto' }, slides: [{ title: 'Quarterly review', text: [{ text: 'Revenue grew 12% — office affine, ' }, { text: 'bold', bold: true }, { text: ' & ' }, { text: 'italic', italic: true }] }] };
assert.throws(() => renderSlideSvg(deck, 0, { fonts, subsetFonts: 'no' }), { code: 'invalid-render-options' });

// Smaller faces with the same family, weight and style; byte-stable; the same from both entry points.
const cut = renderSlideSvg(deck, 0, { fonts }), full = renderSlideSvg(deck, 0, { fonts, subsetFonts: false });
const cutFaces = embedded(cut), fullFaces = embedded(full);
assert.deepEqual(cutFaces.map(({ family, weight, italic }) => [family, weight, italic]), fullFaces.map(({ family, weight, italic }) => [family, weight, italic]), 'the same faces are embedded');
for (const face of cutFaces) assert.ok(face.data.length * 4 < whole(face).length, `${face.family} ${face.weight}${face.italic ? ' italic' : ''}: ${face.data.length} bytes against ${whole(face).length}`);
for (const face of fullFaces) assert.deepEqual(face.data, whole(face), 'subsetFonts: false embeds the whole face');
assert.equal(renderSlideSvg(deck, 0, { fonts }), cut, 'byte-stable');
assert.equal(renderSvg(deck, { fonts })[0], cut, 'renderSvg embeds the same subsets');
assert.ok(cut.length * 5 < full.length, `${cut.length} bytes against ${full.length}`);

// The same shaping: every glyph position of the drawn text is the whole face's.
const shapes = (data, text) => { const run = create(Buffer.from(data)).layout(text); return run.positions.map((position, index) => [run.glyphs[index].codePoints.join('+'), position.xAdvance, position.xOffset, position.yOffset].join(',')); };
const samples = [
  ['Intos', 'Revenue grew 12% — office affine, & '], ['Intos Display', 'Quarterly review'],
  ['Noto Naskh Arabic', 'نما الإيراد في كل منطقة بنسبة ١٢٪'], ['Noto Sans JP', '四半期レビュー：売上は「前年」より増加しました。'],
];
for (const [family, text] of samples) {
  const language = /[؀-ۿ]/.test(text) ? 'ar' : /[　-鿿]/.test(text) ? 'ja' : undefined;
  // The default (Aptos) scheme draws the title in Intos Display and the body in Intos; script text in its designated face.
  const svg = renderSlideSvg({ name: family, ...(language ? { language } : {}), slides: [family === 'Intos' ? { title: 'Review', text } : { title: text }] }, 0, { fonts });
  const face = embedded(svg).find((item) => item.family === family);
  assert.ok(face, `${family} is embedded`);
  assert.ok(face.data.length < whole(face).length / 4, `${family}: ${face.data.length} bytes against ${whole(face).length}`);
  assert.deepEqual(shapes(face.data, text), shapes(whole(face), text), `${family}: the subset shapes like the whole face`);
}

// Only a face whose license allows it is cut: a Reserved Font Name in the face's name (Carlito), a host's own face, or an
// fsType that forbids subsetting keeps the whole face.
const carlito = renderSlideSvg({ name: 'Carlito', design: { fontScheme: 'x-one' }, catalogs: { custom: { fontSchemes: { 'x-one': { name: 'Carlito', app: 'powerpoint', languageFamily: 'latin', languages: [], major: 'Carlito', minor: 'Carlito', textSample: 'x', type: 'sans-serif' } } } }, slides: [{ title: 'Quarterly review' }] }, 0, { fonts });
const carlitoFaces = embedded(carlito).filter((face) => face.family === 'Carlito');
assert.ok(carlitoFaces.length > 0 && carlitoFaces.every((face) => Buffer.compare(Buffer.from(face.data), Buffer.from(whole(face))) === 0), 'Carlito reserves its name: embedded whole');
const roboto = fonts.registry.exportFaces().find((face) => face.family === 'Roboto').data;
assert.equal(subsetPermitted(roboto), true, 'a bundled OFL face with no reserved name in its name');
assert.equal(subsetPermitted(fonts.registry.exportFaces().find((face) => face.family === 'Carlito').data), false);
assert.equal(subsetPermitted(Uint8Array.from([...roboto, 0, 0, 0, 0])), false, 'bytes the manifest does not pin (a host face) are never cut');
const withFsType = (value) => { const copy = Uint8Array.from(roboto), view = new DataView(copy.buffer); for (let index = 0; index < view.getUint16(4); index++) { const at = 12 + index * 16; if (String.fromCharCode(...copy.subarray(at, at + 4)) === 'OS/2') view.setUint16(view.getUint32(at + 8) + 8, value); } return copy; };
assert.equal(fsTypeAllowsSubset(withFsType(0)), true);
assert.equal(fsTypeAllowsSubset(withFsType(0x0100)), false, 'no subsetting');
assert.equal(fsTypeAllowsSubset(withFsType(0x0002)), false, 'restricted license');
assert.equal(fsTypeAllowsSubset(withFsType(0x0200)), false, 'bitmap embedding only');

// The vector PDF made from the subset SVGs alone (no font files, no bundled pack) still embeds every face the pages draw.
const faces = [];
const pdf = await svgToPdf([cut], { fonts: { fontFiles: [], useBundledFonts: false }, onDiagnostic: (diagnostic) => { if (diagnostic.code === 'pdf-font-embedded') faces.push(diagnostic.family); } });
assert.equal(Buffer.from(pdf.subarray(0, 4)).toString(), '%PDF');
assert.equal(faces.length, cutFaces.length, `the PDF embeds the ${cutFaces.length} subset faces: ${faces}`);

// SSR shared fonts (renderDeckHtml fontMode "shared"): one rule per face for the page, cut to the characters every slide draws.
{
  const { renderDeckHtml } = await import('../dist/element.js');
  const titles = ['One', 'Two', 'Three'], bodies = ['Measured body', 'Other words here', 'Zebra quiz 42%'];
  const page = { name: 'Shared', design: { fontScheme: 'roboto' }, slides: titles.map((title, index) => ({ title, text: bodies[index] })) };
  const shared = renderDeckHtml(page, { slides: 'all', fonts, fontMode: 'shared' }), whole = renderDeckHtml(page, { slides: 'all', fonts, fontMode: 'shared', renderOptions: { subsetFonts: false } });
  const sharedFaces = embedded(shared);
  assert.deepEqual(sharedFaces.map((face) => face.weight).sort(), [400, 700], 'Roboto regular and bold, once for the page');
  assert.ok(shared.length * 4 < whole.length, `shared subsets ${shared.length} bytes against ${whole.length} with whole faces`);
  for (const face of sharedFaces) {
    const font = create(Buffer.from(face.data)), drawn = new Set((face.weight === 700 ? titles : bodies).join('').replace(/\s/g, ''));
    assert.deepEqual([...drawn].filter((character) => !font.hasGlyphForCodePoint(character.codePointAt(0))), [], `the shared ${face.weight} face covers the characters of every slide`);
  }
}

// Size over a set of core example decks.
let before = 0, after = 0, slides = 0;
for (const { deck: example } of examples.filter((_, index) => index % 10 === 0)) {
  const a = renderSvg(example, { fonts, subsetFonts: false }), b = renderSvg(example, { fonts });
  for (const [index, svg] of b.entries()) { before += a[index].length; after += svg.length; slides++; }
}
assert.ok(after * 10 < before, `${slides} example slides: ${after} bytes against ${before}`);
console.log(`Font subsets passed: smaller faces that shape like the whole ones, byte-stable, subsetFonts false, license/RFN/fsType rule, PDF from subset SVGs; ${slides} example slides ${(before / slides / 1e3).toFixed(0)} KB -> ${(after / slides / 1e3).toFixed(0)} KB on average.`);
