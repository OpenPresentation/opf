// opf-editor#141 (RR-65, RR-64): `convert` uses the fonts handle's subset and outline engines. A browser handle created with
// `loadFonts({ subsetWasm, shapeWasm })` (the Node handle always has both) makes an SVG embed each face cut to the glyphs its slide draws, and
// lets `renderOptions.text: "paths"` draw HarfBuzz-shaped outlines; a handle without them embeds whole faces and cannot outline. The browser
// handle itself is exercised in a real browser by test/playground-download.mjs.
import assert from 'node:assert/strict';
import { defaultCatalog } from '@openpresentation/opf/catalog';
import { loadFonts } from '@openpresentation/opf-render/fonts-node';
import { convert } from '../src/export.js';

const fonts = await loadFonts();
assert.ok(fonts.subsets && fonts.outlines, 'the Node handle carries the subset and outline engines');
// What a browser handle made without the WASM files looks like: the same registry and measurement, neither engine.
const plain = { textMeasurement: fonts.textMeasurement, embeddedFonts: fonts.embeddedFonts, pending: () => [], ensure: async () => {}, registry: fonts.registry };
const catalogs = [defaultCatalog];
const deck = {
  name: 'Subset deck', design: { fontScheme: 'roboto' },
  slides: [{ id: 'a', title: 'Revenue grew', text: 'Every region grew.' }, { id: 'b', title: 'Next steps', items: ['Hire', 'Ship'] }],
};
const text = async (options) => new TextDecoder().decode((await convert(deck, { slides: 1, catalogs, ...options })).files[0].bytes);
const faceBytes = (svg) => [...svg.matchAll(/url\("?data:font\/[^;]+;base64,([A-Za-z0-9+/=]+)/g)].map((match) => Buffer.from(match[1], 'base64').length);

// ---- SVG: faces cut to the slide's glyphs with the subset engine, whole without it ------------------------------------------------------------------
{
  const cut = await text({ format: 'svg', fonts });
  const whole = await text({ format: 'svg', fonts: plain });
  const flagged = await text({ format: 'svg', fonts, renderOptions: { subsetFonts: false } });
  const [cutFaces, wholeFaces] = [faceBytes(cut), faceBytes(whole)];
  assert.ok(cutFaces.length >= 1 && cutFaces.length === wholeFaces.length, 'the same faces are embedded either way');
  assert.ok(Math.max(...cutFaces) < 20000, `each embedded face is cut to the slide's glyphs: ${cutFaces}`);
  assert.ok(Math.min(...wholeFaces) > 50000, `a handle without the subset engine embeds whole faces: ${wholeFaces}`);
  assert.ok(cut.length * 5 < whole.length, `the subset SVG is much smaller (${cut.length} against ${whole.length} characters)`);
  assert.equal(flagged, whole, 'renderOptions.subsetFonts: false embeds whole faces even with the engine');
  assert.match(cut, /Revenue grew/);
}

// ---- A PDF and a PNG keep the faces they have always had ---------------------------------------------------------------------------------------------
{
  const seen = {};
  const converters = {
    async toPdf(svgs) { seen.pdf = svgs[0]; return Uint8Array.from([37, 80, 68, 70]); },
    async toPng(svg) { seen.png = svg; return Uint8Array.from([137, 80, 78, 71]); },
  };
  await convert(deck, { format: 'pdf', slides: 1, catalogs, fonts, converters });
  const withEngine = seen.pdf;
  await convert(deck, { format: 'pdf', slides: 1, catalogs, fonts: plain, converters });
  assert.equal(withEngine, seen.pdf, 'a PDF is drawn from whole faces whether or not the handle can subset (the PDF converter cuts its own subsets)');
  await convert(deck, { format: 'png', slides: 1, catalogs, fonts, converters });
  assert.deepEqual(faceBytes(seen.png), faceBytes(seen.pdf), 'a PNG is drawn from the same whole faces');
}

// ---- Outlined text: glyph outlines from the handle's engine -------------------------------------------------------------------------------------------
{
  const paths = await text({ format: 'svg', fonts, renderOptions: { text: 'paths' } });
  assert.match(paths, /<use\b/, 'glyphs are outlines');
  assert.deepEqual(faceBytes(paths), [], 'outlined text embeds no font');
  assert.match(paths, /Revenue grew/, 'the words stay available as invisible text');
  await assert.rejects(text({ format: 'svg', fonts: plain, renderOptions: { text: 'paths' } }), (error) => error.code === 'text-as-paths-needs-fonts', 'a handle without the outline engine cannot outline');

  const seen = {};
  const converters = {
    async toPdf(svgs) { seen.pdf = svgs[0]; return Uint8Array.from([37, 80, 68, 70]); },
    async toPng(svg) { seen.png = svg; return Uint8Array.from([137, 80, 78, 71]); },
  };
  await convert(deck, { format: 'png', slides: 1, catalogs, fonts, converters, renderOptions: { text: 'paths' } });
  assert.match(seen.png, /<use\b/, 'a PNG is drawn from the outlined SVG');
  await convert(deck, { format: 'pdf', slides: 1, catalogs, fonts, converters, renderOptions: { text: 'paths' } });
  assert.doesNotMatch(seen.pdf, /<use\b/, 'a PDF keeps selectable text whatever the preview options say');
  assert.ok(faceBytes(seen.pdf).length >= 1, 'and embeds the faces its text draws');
}

console.log('Export subset passed: SVG faces cut with the handle\'s subset engine, whole without it, PDF and PNG unchanged, outlined text from the handle.');
