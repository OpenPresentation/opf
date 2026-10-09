// RR-23, RR-73: the export API (src/export.js) without a browser: file names, which slides are converted, ZIP packing, SVG output with
// the registry's embedded faces, the permissive-license rule, cancellation, findings and the converter hand-off (the real PDF and
// PNG conversion is checked in a browser by test/playground-download.mjs; the `convert` contract itself by test/convert-contract.mjs).
import assert from 'node:assert/strict';
import { defaultCatalog } from '@openpresentation/opf/catalog';
import { loadFonts } from '@openpresentation/opf-render/fonts-node';
import { EXPORT_FORMATS, convert, embeddableFonts, exportFileName, slidesToConvert } from '../src/export.js';
import { crc32, createZip } from '../src/zip.js';

// RR-17: jszip is a test dependency of its own (opf-pptx 0.13 no longer installs it).
import JSZip from 'jszip';
const fonts = await loadFonts();
// OPF 0.15: the host registers its catalogs; the deck's roboto scheme resolves in the default catalog.
const renderOptions = { catalogs: [defaultCatalog] };
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
assert.deepEqual(slidesToConvert(deck), [1, 3], 'hidden slides are skipped when no slides are named');
assert.deepEqual(slidesToConvert(deck, { includeHidden: true }), [1, 2, 3]);
assert.deepEqual(slidesToConvert(deck, { slides: 2 }), [2], 'a named slide is converted even when hidden');
assert.deepEqual(slidesToConvert(deck, { slides: '3,1-2' }), [1, 2, 3], 'a selection is sorted and counted from 1');
assert.deepEqual(slidesToConvert({ slides: [] }), []);
assert.throws(() => slidesToConvert(deck, { slides: [0] }), { code: 'invalid-option' }, 'slides count from 1');
assert.throws(() => slidesToConvert(deck, { slides: 4 }), { code: 'invalid-option' }, 'a slide past the end is refused');

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
  const real = embeddableFonts(fonts.registry);
  assert.ok(real.length >= 1 && real.every(face => face.embed === 'used' && face.dataUrl.startsWith('data:font/')), 'the bundled registry yields embeddable faces');
}

// ---- SVG ---------------------------------------------------------------------------------------------------------------------------------
{
  const progress = [];
  const result = await convert(deck, { format: 'svg', zip: true, renderOptions, fonts, onProgress: item => progress.push(item.stage) });
  assert.equal(result.files.length, 1);
  assert.equal(result.files[0].name, 'q3-review.zip');
  assert.equal(result.files[0].type, 'application/zip');
  assert.deepEqual(result.files[0].entries, ['q3-review-001.svg', 'q3-review-003.svg']);
  const zip = await JSZip.loadAsync(result.files[0].bytes);
  const first = await zip.file('q3-review-001.svg').async('string');
  assert.match(first, /^<\?xml version="1\.0" encoding="UTF-8"\?>\n<svg /);
  assert.match(first, /<\/svg>\s*$/);
  assert.match(first, /Revenue grew/);
  assert.match(first, /@font-face/, 'the SVG carries its fonts');
  assert.doesNotMatch(first, /data-opf-path/, 'a plain SVG has no trace attributes');
  assert.doesNotMatch(first, /Hidden backup/);
  assert.ok(progress.includes('render') && progress.at(-1) === 'done');
  const one = await convert(deck, { format: 'svg', slides: 3, renderOptions, fonts });
  assert.equal(one.files.length, 1);
  assert.equal(one.files[0].name, 'q3-review-003.svg');
  assert.equal(one.files[0].type, 'image/svg+xml');
  assert.equal(one.files[0].slide, 3);
}

// ---- PDF and PNG hand-off -----------------------------------------------------------------------------------------------------------------
{
  const seen = {};
  const converters = {
    async toPdf(svgs, options) {
      seen.pdf = { svgs, options };
      for (const [index] of svgs.entries()) options.onProgress({ page: index + 1, pages: svgs.length });
      options.onDiagnostic({ code: 'pdf-font-embedded', family: 'roboto', weight: 400, italic: false, embedding: 'subset', glyphs: 12 });
      options.onDiagnostic({ code: 'pdf-font-substituted', message: 'Aptos was drawn with Roboto.', path: 'slides.2.title' });
      options.onDiagnostic({ code: 'pdf-glyph-missing', message: 'No face has U+2603.', path: 'slides.1.text' });
      return Uint8Array.from([37, 80, 68, 70]);
    },
    async toPng(svg, options) { (seen.png ??= []).push({ svg, options }); return Uint8Array.from([137, 80, 78, 71]); },
  };
  const pdf = await convert(deck, { format: 'pdf', raster: true, scale: 9, renderOptions, fonts, converters });
  assert.equal(pdf.files[0].name, 'q3-review.pdf');
  assert.equal(pdf.files[0].type, EXPORT_FORMATS.pdf.type);
  assert.deepEqual([pdf.files[0].pages, pdf.files[0].slides], [2, [1, 3]], 'the PDF says which slides its pages show');
  assert.equal(seen.pdf.svgs.length, 2);
  assert.equal(seen.pdf.options.raster, true);
  assert.ok(!('mode' in seen.pdf.options), 'the 0.17 mode option is gone');
  assert.ok(!('pdfLib' in seen.pdf.options), 'no pdfLib option is invented when the host passes none');
  assert.equal(seen.pdf.options.fonts, undefined, 'the fonts handle itself is never given to the converter: it would embed faces whatever their license');
  assert.ok(seen.pdf.options.fontData.length > 0 && seen.pdf.options.fontData.every(face => face.family && face.data instanceof Uint8Array && face.data.length > 0), 'the PDF gets the registry faces as bytes, so script faces can be embedded');
  assert.equal(seen.pdf.options.scale, 4, 'the scale is capped');
  assert.equal(seen.pdf.options.metadata.title, 'Quarterly review');
  assert.match(seen.pdf.svgs[0], /data-opf-path/, 'the PDF is drawn with trace paths for its diagnostics');
  assert.deepEqual(pdf.findings.map(item => [item.ruleId, item.severity, item.slide, item.path]), [['pdf/pdf-font-embedded', 'info', undefined, ''], ['pdf/pdf-font-substituted', 'warning', 2, '/slides/2/title']], 'converter notes are findings, and one for a slide that is not converted is dropped');
  assert.equal(pdf.findings[0].message, 'Embedded roboto 400 (subset, 12 glyphs).');
  assert.deepEqual(pdf.findings[0].measured, { family: 'roboto', weight: 400, italic: false, embedding: 'subset', glyphs: 12 });
  assert.equal(pdf.findings[1].slideId, 'c');

  // RR-63: the renderer's export-browser entry imports no pdf-lib; the raster PDF gets the module the host passes, the vector PDF never does.
  const pdfLib = { PDFDocument: { create: async () => ({}) } };
  await convert(deck, { format: 'pdf', slides: 1, raster: true, pdfLib, renderOptions, fonts, converters });
  assert.equal(seen.pdf.options.pdfLib, pdfLib, 'a raster PDF is given the pdf-lib module the host passes');
  await convert(deck, { format: 'pdf', slides: 1, pdfLib, renderOptions, fonts, converters });
  assert.ok(!('raster' in seen.pdf.options), 'a vector PDF is the converter default');
  assert.ok(!('pdfLib' in seen.pdf.options), 'a vector PDF needs no pdf-lib');

  const png = await convert(deck, { format: 'png', scale: 3, renderOptions, fonts, converters });
  assert.equal(seen.png.length, 2);
  assert.equal(seen.png[0].options.scale, 3);
  assert.deepEqual(png.files.map(file => [file.name, file.slide, file.id]), [['q3-review-001.png', 1, 'a'], ['q3-review-003.png', 3, 'c']], 'one PNG per slide without zip');
  const zipped = await convert(deck, { format: 'png', zip: true, renderOptions, fonts, converters });
  assert.deepEqual(zipped.files.map(file => file.name), ['q3-review.zip']);
  const single = await convert(deck, { format: 'png', slides: 1, renderOptions, fonts, converters });
  assert.equal(single.files[0].name, 'q3-review-001.png');
  assert.equal(single.files[0].type, 'image/png');
}

// ---- PDF font licenses: the SVG rule applies to the PDF too ----------------------------------------------------------------------------
{
  const OFL = 'This Font Software is licensed under the SIL Open Font License, Version 1.1.';
  const face = (family, license, bytes) => ({ family, weight: 400, ...(license ? { license } : {}), dataUrl: 'data:font/ttf;base64,' + Buffer.from(bytes).toString('base64') });
  const registry = { selectEmbeddedFonts: () => [face('Open Sans', OFL, [1, 2, 3]), face('Proprietary Sans', 'All rights reserved. Commercial.', [9, 9, 9]), face('Noto Sans JP', 'Licensed under the Apache License, Version 2.0', [4, 5]), face('Unlabelled', undefined, [7])] };
  const handle = { textMeasurement: fonts.textMeasurement, pending: () => [], ensure: async () => {}, registry };
  let seenPdf;
  const converters = { async toPdf(svgs, options) { seenPdf = options; options.onDiagnostic?.({ code: 'pdf-font-substituted', message: 'Proprietary Sans was drawn with Roboto.', path: 'slides.0.title' }); return Uint8Array.from([37, 80, 68, 70]); }, async toPng() { return new Uint8Array(); } };
  const result = await convert(deck, { format: 'pdf', slides: 1, fonts: handle, catalogs: [defaultCatalog], converters });
  assert.deepEqual(seenPdf.fontData.map(item => item.family), ['Open Sans', 'Noto Sans JP', 'Unlabelled'], 'a face with a non-permissive license is not given to the PDF converter');
  assert.deepEqual([...seenPdf.fontData[0].data], [1, 2, 3], 'the bytes of the face are the registry\'s');
  assert.equal(seenPdf.fonts, undefined);
  const licenseNotes = result.findings.filter(item => item.ruleId === 'fonts/export-font-license');
  assert.equal(licenseNotes.length, 1, 'the dropped face is reported once, for SVG and PDF together');
  assert.equal(licenseNotes[0].measured.family, 'Proprietary Sans');
  assert.equal(licenseNotes[0].severity, 'warning');
  // What the converter then does about text that needed the dropped face is its own report, passed through.
  assert.ok(result.findings.some(item => item.ruleId === 'pdf/pdf-font-substituted' && item.slide === 0), 'the converter\'s substitution notice reaches the caller');
  // Faces handed in explicitly are filtered by the caller; the PDF uses exactly those.
  const explicit = await convert(deck, { format: 'pdf', slides: 1, fonts: handle, catalogs: [defaultCatalog], embeddedFonts: embeddableFonts(registry), converters });
  assert.equal(explicit.findings.filter(item => item.ruleId === 'fonts/export-font-license').length, 0, 'an explicit embeddedFonts list is the caller\'s choice');
  assert.deepEqual(seenPdf.fontData.map(item => item.family), ['Open Sans', 'Noto Sans JP', 'Unlabelled']);
  // The raster PDF draws images and needs no fonts, but the rule is the same.
  await convert(deck, { format: 'pdf', raster: true, slides: 1, fonts: handle, catalogs: [defaultCatalog], converters });
  assert.ok(!seenPdf.fontData.some(item => item.family === 'Proprietary Sans'));
}

// ---- Errors and cancellation ------------------------------------------------------------------------------------------------------------------
await assert.rejects(convert(deck, { format: 'docx', renderOptions }), error => error.code === 'export-format');
await assert.rejects(convert({ slides: [] }, { format: 'svg', renderOptions }), error => error.code === 'export-no-slides');
await assert.rejects(convert(deck, { format: 'pdf', renderOptions, fonts, signal: AbortSignal.abort() }), error => error.code === 'export-aborted');
{
  const controller = new AbortController();
  await assert.rejects(convert(deck, {
    format: 'png', renderOptions, fonts, signal: controller.signal,
    converters: { async toPng() { controller.abort(); return Uint8Array.from([1]); }, async toPdf() { return new Uint8Array(); } },
  }), error => error.code === 'export-aborted', 'a cancel between slides stops the export');
}
// A face that cannot load stops the export before anything is drawn.
await assert.rejects(convert(deck, { format: 'svg', renderOptions, fonts: { pending: () => ['x'], ensure: async () => { const error = new Error('Fonts for this document could not be loaded'); error.code = 'fonts-unavailable'; throw error; } } }), error => error.code === 'fonts-unavailable');

console.log('Export API passed: file names, slide choice, ZIP, SVG with embedded faces, license rule, converter hand-off, findings and cancel.');
