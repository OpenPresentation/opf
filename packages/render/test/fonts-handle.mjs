// RR-55: one fonts handle. `loadFonts()` returns { textMeasurement, embeddedFonts, fontFiles, useBundledFonts, loadSystemFonts, registry, outlines (RR-64),
// manifest, substitutions, ensure, pending }; every deck-level function takes it as `{ fonts }`; `renderSvg` draws the deck and
// `renderSlideSvg` one slide.
import assert from 'node:assert/strict';
import { OPFFontError } from '../dist/fonts.js';
import { loadFonts } from '../dist/fonts-node.js';
import { OPFRenderError, renderSlideSvg, renderSvg, svgToPdf, svgToPng } from './catalog-harness.mjs'; // FA-23: registers the gallery snapshot (the documents name gallery records)

const deck = { name: 'Handle', design: { fontScheme: 'roboto' }, slides: [{ title: 'One', text: 'First slide' }, { title: 'Two', text: 'Second slide' }, { title: 'Three', items: ['a', 'b'] }] };
const fonts = await loadFonts();

// The handle.
assert.deepEqual(Object.keys(fonts).sort(), ['embeddedFonts', 'ensure', 'fontFiles', 'loadSystemFonts', 'manifest', 'outlines', 'pending', 'registry', 'substitutions', 'textMeasurement', 'useBundledFonts']);
assert.equal(fonts.textMeasurement, fonts.registry.textMeasurement);
assert.equal(fonts.embeddedFonts.length, 9);
assert.equal(fonts.fontFiles.length, 9);
assert.equal(fonts.useBundledFonts, false);
assert.equal(fonts.loadSystemFonts, false);
assert.equal(fonts.manifest.packages.length > 60, true);
assert.equal(fonts.dispose, undefined, 'a Node handle holds nothing to release');
await assert.rejects(loadFonts({ pack: 'nope' }), { code: 'invalid-font-pack' });
// pack "none" holds only the faces you supply.
{
  await assert.rejects(loadFonts({ pack: 'none' }), { code: 'empty-font-registry' });
  const own = await loadFonts({ pack: 'none', faces: [{ path: fonts.fontFiles[0] }] });
  assert.equal(own.registry.describeFaces().length, 1);
  assert.deepEqual(own.fontFiles, [fonts.fontFiles[0]]);
  await assert.rejects(loadFonts({ pack: 'none', faces: [{ data: new Uint8Array([0, 1, 2]) }] }), OPFFontError);
}

// The deck and the slide.
const slides = renderSvg(deck, { fonts });
assert.equal(Array.isArray(slides), true);
assert.equal(slides.length, 3);
for (const [index, svg] of slides.entries()) assert.equal(renderSlideSvg(deck, index, { fonts }), svg, `slide ${index}`);
assert.throws(() => renderSlideSvg(deck, 3, { fonts }), (error) => error instanceof OPFRenderError && error.code === 'slide-index-out-of-range' && error.details.slideCount === 3);
assert.throws(() => renderSlideSvg(deck, -1, { fonts }), { code: 'slide-index-out-of-range' });
assert.equal(typeof renderSlideSvg(deck, 0), 'string');
// An invalid deck throws one error whose findings are core's.
assert.throws(() => renderSvg({ slides: 'not an array' }), (error) => error.code === 'invalid-opf' && error.findings.length > 0 && error.findings.every((finding) => finding.severity === 'error' && typeof finding.ruleId === 'string') && error.details.findings === error.findings && error.details.report.valid === false);
// The measurement and the faces of the handle are what the SVG uses: embedding follows `fonts.embeddedFonts`.
assert.match(slides[0], /@font-face/);
assert.doesNotMatch(renderSlideSvg(deck, 0, { fonts: { textMeasurement: fonts.textMeasurement } }), /@font-face/);
// A stale top-level option is not read; the handle is the only way in.
assert.doesNotMatch(renderSlideSvg(deck, 0, { embeddedFonts: fonts.embeddedFonts }), /@font-face/);

// Conversions take the same handle.
const png = await svgToPng(slides[0], { fonts, scale: 0.25 });
assert.deepEqual(png, await svgToPng(slides[0], { scale: 0.25 }), 'the handle holds the bundled base faces the default draws with');
assert.equal(Buffer.from(png.subarray(1, 4)).toString(), 'PNG');
const pdf = await svgToPdf(slides, { fonts });
assert.equal(Buffer.from(pdf.subarray(0, 4)).toString(), '%PDF');
await assert.rejects(svgToPdf(slides, { fonts: { ...fonts, loadSystemFonts: true } }), { code: 'pdf-system-fonts-unsupported' });

// ensure() and pending(): script faces the text needs are loaded on demand, once.
{
  const base = await loadFonts();
  const japanese = { name: 'ja', language: 'ja', design: { fontScheme: 'roboto' }, slides: [{ title: '四半期レビュー', text: '売上は増加しました。' }] };
  assert.throws(() => renderSvg(japanese, { fonts: base }), { code: 'missing-glyph' });
  const needed = base.pending(japanese);
  assert.deepEqual(needed, ['@expo-google-fonts/noto-sans-jp']);
  const files = base.fontFiles.length, embedded = base.embeddedFonts.length;
  const result = await base.ensure(japanese);
  assert.deepEqual(result.scripts, ['@expo-google-fonts/noto-sans-jp']);
  assert.deepEqual(result.lazy, []);
  assert.deepEqual(base.pending(japanese), []);
  assert.equal(base.fontFiles.length, files + 2, 'the files are in the handle for the raster');
  assert.equal(base.embeddedFonts.length, embedded, 'script faces are embedded only on request');
  assert.match(renderSvg(japanese, { fonts: base })[0], /Noto Sans JP/);
  assert.deepEqual((await base.ensure(japanese)).scripts, [], 'nothing is loaded twice');
  await assert.rejects(base.ensure(null), { code: 'invalid-font-scripts' });
}
console.log('Fonts handle: shape, pack none, renderSvg and renderSlideSvg, findings on invalid decks, raster and PDF with the handle, ensure and pending.');
