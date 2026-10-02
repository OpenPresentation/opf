// RR-23: the export API (src/export.js) without a browser: file names, which slides are exported, ZIP packing, SVG output with the
// registry's embedded faces, the permissive-license rule, cancellation, diagnostics and the converter hand-off (the real PDF and
// PNG conversion is checked in a browser by test/playground-download.mjs).
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { loadBundledFontRegistry } from '@openpresentation/opf-render/fonts-node';
import { EXPORT_FORMATS, describeDiagnostic, embeddableFonts, exportDeck, exportFileName, slidesToExport } from '../src/export.js';
import { crc32, createZip } from '../src/zip.js';

const JSZip = createRequire(import.meta.resolve('@openpresentation/opf-pptx'))('jszip');
const registry = await loadBundledFontRegistry();
const renderOptions = { textMeasurement: registry.textMeasurement };
const deck = {
  name: 'Quarterly review', filename: 'q3-review.PPTX', design: { fontScheme: 'roboto' },
  slides: [
    { id: 'a', title: 'Revenue grew', text: 'Every region grew.' },
    { id: 'b', title: 'Hidden backup', text: 'Not for the room.', hidden: true },
    { id: 'c', title: 'Next steps', items: ['Hire', 'Ship'] },
  ],
};

// ---- File names -------------------------------------------------------------------------------------------------------------------
assert.equal(exportFileName(deck, 'pdf'), 'q3-review.pdf', 'the deck filename wins and loses its .pptx');
assert.equal(exportFileName({ filename: 'deck.PDF' }, 'png', '-01'), 'deck-01.png');
assert.equal(exportFileName({ name: 'A presentation: you can/work on' }, 'svg'), 'A-presentation-you-can-work-on.svg');
assert.equal(exportFileName({ name: '年度レビュー' }, 'pdf'), '年度レビュー.pdf', 'names in other scripts survive');
assert.equal(exportFileName({}, 'pdf'), 'presentation.pdf');
assert.equal(exportFileName({ filename: '../../etc/passwd' }, 'pdf'), 'etc-passwd.pdf', 'path separators never reach the file name');
assert.equal(exportFileName({ filename: '   ', name: 'Named' }, 'pdf'), 'Named.pdf');

// ---- Slide choice ---------------------------------------------------------------------------------------------------------------------
assert.deepEqual(slidesToExport(deck, { slides: 'all' }), [0, 2], 'hidden slides are skipped in an all-slides export');
assert.deepEqual(slidesToExport(deck, { slides: 'all', includeHidden: true }), [0, 1, 2]);
assert.deepEqual(slidesToExport(deck, { slides: 'current', slideIndex: 1 }), [1], 'a chosen slide is exported even when hidden');
assert.deepEqual(slidesToExport(deck, { slides: [2, 9, -1, 0] }), [2, 0]);

// ---- ZIP ---------------------------------------------------------------------------------------------------------------------------------
assert.equal(crc32(new TextEncoder().encode('123456789')), 0xcbf43926, 'CRC-32 check value');
{
  const entries = [{ name: 'a.txt', bytes: new TextEncoder().encode('hello '.repeat(200)) }, { name: 'ü-b.bin', bytes: Uint8Array.from([1, 2, 3]) }];
  const zip = await createZip(entries);
  const stored = await createZip(entries, { compress: false });
  assert.deepEqual(await createZip(entries), zip, 'the same files give the same archive');
  assert.ok(zip.length < stored.length, 'text is deflated');
  for (const bytes of [zip, stored]) {
    const loaded = await JSZip.loadAsync(bytes);
    assert.deepEqual(Object.keys(loaded.files).sort(), ['a.txt', 'ü-b.bin']);
    assert.equal(await loaded.file('a.txt').async('string'), 'hello '.repeat(200));
    assert.deepEqual([...await loaded.file('ü-b.bin').async('uint8array')], [1, 2, 3]);
  }
}

// ---- Fonts: only permissive, only used ---------------------------------------------------------------------------------------------------
{
  const skipped = [];
  const faces = embeddableFonts({ selectEmbeddedFonts: () => [{ family: 'Open', weight: 400, license: 'This Font Software is licensed under the SIL Open Font License, Version 1.1.', dataUrl: 'data:font/ttf;base64,AA==' }, { family: 'Mystery', weight: 400, license: 'All rights reserved. Commercial.', dataUrl: 'data:font/ttf;base64,AA==' }, { family: 'Unlabelled', weight: 400, dataUrl: 'data:font/ttf;base64,AA==' }] }, face => skipped.push(face.family));
  assert.deepEqual(faces.map(face => face.family), ['Open', 'Unlabelled']);
  assert.ok(faces.every(face => face.embed === 'used'), 'each slide embeds only the faces it draws');
  assert.deepEqual(skipped, ['Mystery'], 'a proprietary face is never embedded');
  const real = embeddableFonts(registry);
  assert.ok(real.length >= 1 && real.every(face => face.embed === 'used' && face.dataUrl.startsWith('data:font/')), 'the bundled registry yields embeddable faces');
}

// ---- SVG ---------------------------------------------------------------------------------------------------------------------------------
{
  const progress = [];
  const result = await exportDeck(deck, { format: 'svg', slides: 'all', renderOptions, registry, onProgress: item => progress.push(item.stage) });
  assert.deepEqual(result.slides, [0, 2]);
  assert.deepEqual(result.files.map(file => file.name), ['q3-review-01.svg', 'q3-review-03.svg']);
  assert.equal(result.download.name, 'q3-review-svg.zip');
  assert.equal(result.download.type, 'application/zip');
  const zip = await JSZip.loadAsync(result.download.bytes);
  const first = await zip.file('q3-review-01.svg').async('string');
  assert.match(first, /^<\?xml version="1\.0" encoding="UTF-8"\?>\n<svg /);
  assert.match(first, /<\/svg>\s*$/);
  assert.match(first, /Revenue grew/);
  assert.match(first, /@font-face/, 'the SVG carries its fonts');
  assert.doesNotMatch(first, /data-opf-path/, 'a plain SVG has no trace attributes');
  assert.doesNotMatch(first, /Hidden backup/);
  assert.ok(progress.includes('render') && progress.at(-1) === 'done');
  const one = await exportDeck(deck, { format: 'svg', slides: 'current', slideIndex: 2, renderOptions, registry });
  assert.equal(one.files.length, 1);
  assert.equal(one.download.name, 'q3-review-03.svg');
  assert.equal(one.download.type, 'image/svg+xml');
}

// ---- PDF and PNG hand-off -----------------------------------------------------------------------------------------------------------------
{
  const seen = {};
  const convert = {
    async svgToPdf(svgs, options) {
      seen.pdf = { svgs, options };
      for (const [index] of svgs.entries()) options.onProgress({ page: index + 1, pages: svgs.length });
      options.onDiagnostic({ code: 'pdf-font-embedded', family: 'roboto', weight: 400, italic: false, embedding: 'subset', glyphs: 12 });
      options.onDiagnostic({ code: 'pdf-font-substituted', message: 'Aptos was drawn with Roboto.', path: 'slides.2.title' });
      options.onDiagnostic({ code: 'pdf-glyph-missing', message: 'No face has U+2603.', path: 'slides.1.text' });
      return Uint8Array.from([37, 80, 68, 70]);
    },
    async svgToPng(svg, options) { (seen.png ??= []).push({ svg, options }); return Uint8Array.from([137, 80, 78, 71]); },
  };
  const pdf = await exportDeck(deck, { format: 'pdf', slides: 'all', pdfMode: 'raster', scale: 9, renderOptions, registry, convert });
  assert.equal(pdf.download.name, 'q3-review.pdf');
  assert.equal(pdf.download.type, EXPORT_FORMATS.pdf.type);
  assert.equal(seen.pdf.svgs.length, 2);
  assert.equal(seen.pdf.options.mode, 'raster');
  assert.equal(seen.pdf.options.scale, 4, 'the scale is capped');
  assert.equal(seen.pdf.options.metadata.title, 'Quarterly review');
  assert.match(seen.pdf.svgs[0], /data-opf-path/, 'the PDF is drawn with trace paths for its diagnostics');
  assert.deepEqual(pdf.diagnostics.map(item => [item.code, item.severity, item.slide]), [['pdf-font-embedded', 'info', undefined], ['pdf-font-substituted', 'warning', 2]], 'diagnostics are described, and one for a slide that is not exported is dropped');
  assert.equal(describeDiagnostic({ code: 'pdf-font-embedded', family: 'roboto', weight: 700, italic: true, embedding: 'subset', glyphs: 3 }, 'pdf').message, 'Embedded roboto 700 italic (subset, 3 glyphs).');

  const png = await exportDeck(deck, { format: 'png', slides: 'all', scale: 3, renderOptions, registry, convert });
  assert.equal(seen.png.length, 2);
  assert.equal(seen.png[0].options.scale, 3);
  assert.deepEqual(png.files.map(file => file.name), ['q3-review-01.png', 'q3-review-03.png']);
  assert.equal(png.download.name, 'q3-review-png.zip');
  const single = await exportDeck(deck, { format: 'png', slides: 'current', slideIndex: 0, renderOptions, registry, convert });
  assert.equal(single.download.name, 'q3-review-01.png');
  assert.equal(single.download.type, 'image/png');
}

// ---- Errors and cancellation ------------------------------------------------------------------------------------------------------------------
await assert.rejects(exportDeck(deck, { format: 'docx', renderOptions }), error => error.code === 'export-format');
await assert.rejects(exportDeck({ slides: [] }, { format: 'svg', renderOptions }), error => error.code === 'export-no-slides');
await assert.rejects(exportDeck(deck, { format: 'pdf', renderOptions, registry, convert: undefined, signal: AbortSignal.abort() }), error => error.code === 'export-aborted');
{
  const controller = new AbortController();
  await assert.rejects(exportDeck(deck, {
    format: 'png', slides: 'all', renderOptions, registry, signal: controller.signal,
    convert: { async svgToPng() { controller.abort(); return Uint8Array.from([1]); }, async svgToPdf() { return new Uint8Array(); } },
  }), error => error.code === 'export-aborted', 'a cancel between slides stops the export');
}
// A face that cannot load stops the export before anything is drawn.
await assert.rejects(exportDeck(deck, { format: 'svg', renderOptions, registry, fonts: { pending: () => ['x'], ensure: async () => { const error = new Error('Fonts for this document could not be loaded'); error.code = 'fonts-unavailable'; throw error; } } }), error => error.code === 'fonts-unavailable');

console.log('Export API passed: file names, slide choice, ZIP, SVG with embedded faces, license rule, converter hand-off, diagnostics and cancel.');
