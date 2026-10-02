// RR-23: PNG and PDF output in a real browser (export-browser.js). A page bundles the browser export entry and nothing from Node
// (no sharp, resvg, fs or crypto), takes the SVG the renderer draws (fonts embedded as @font-face data), and
//   - writes a vector PDF whose text pdf.js extracts as the authored text, in the embedded font subsets,
//   - decodes pictures (PNG with alpha, JPEG in all eight EXIF orientations, WebP) through a canvas,
//   - passes an upright JPEG through, rasterizes only the one element that has no vector form (filter) and says so,
//   - writes the raster PDF and PNG output, cancels between pages, reports progress,
//   - makes the same PDF bytes on every run, and the text extraction agrees with the Node export.
// Offline: every request other than the page itself is aborted.
import assert from 'node:assert/strict';
import {readdirSync} from 'node:fs';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {chromium} from 'playwright';
import sharp from 'sharp';
import {renderSvgDeck, svgToPdf as nodeSvgToPdf, svgToPng as nodeSvgToPng} from '../dist/index.js';
import {loadBundledFontRegistry} from '../dist/fonts-node.js';
import {compareImages, openPdf, pageItems, pageText, renderPdfPage} from './pdf-helpers.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDirectory = path.resolve(root, process.argv[2] ?? 'artifacts/export-browser');
await mkdir(outputDirectory, {recursive: true});
const bundle = await build({
  stdin: {contents: "import {svgToPdf,svgToPng,sniffImage} from './dist/export-browser.js';window.opfExport={svgToPdf,svgToPng,sniffImage};", resolveDir: root, sourcefile: 'entry.js', loader: 'js'},
  bundle: true, platform: 'browser', format: 'iife', write: false, minify: true, metafile: true,
});
const inputs = Object.keys(bundle.metafile.inputs);
assert.ok(!inputs.some(input => /sharp|resvg|fonts-node|node:/.test(input)), 'the browser export bundle must not pull in native or Node modules');
assert.ok(!inputs.some(input => /raster\.js|raster-images\.js/.test(input)), 'the browser export bundle must not include the Node raster entry');
const script = bundle.outputFiles[0].text;

const fonts = await loadBundledFontRegistry();
const SCHEMA = 'https://openpresentation.org/schema/opf/v1';
const png = await sharp({create: {width: 40, height: 30, channels: 4, background: {r: 224, g: 48, b: 48, alpha: 0.5}}}).png().toBuffer();
const upright = await readFile(path.join(root, 'test/fixtures/jpeg/orientation-1.jpg'));
const webpName = readdirSync(path.join(root, 'test/fixtures/webp')).find(name => name.endsWith('.webp'));
const webp = await readFile(path.join(root, 'test/fixtures/webp', webpName));
const deck = {
  $schema: SCHEMA, name: 'Browser export', design: {fontScheme: 'roboto'},
  slides: [
    {id: 'one', title: 'Quarterly operating review', text: 'Revenue grew in every region, led by the enterprise segment.'},
    {id: 'two', title: 'Evidence', items: ['First finding', 'Second finding', 'Third finding']},
    {id: 'three', title: 'Data', table: {columns: ['Quarter', 'Revenue'], rows: [['Q1', 12], ['Q2', 18]]}},
  ],
};
const svgs = renderSvgDeck(deck, {trace: true, textMeasurement: fonts.textMeasurement, embeddedFonts: fonts.embeddedFonts});
assert.equal(svgs.length, 3);
const imageSvg = (width, height, uri, extra = '') => `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}" fill="#ffffff"/><image aria-label="Specimen" x="0" y="0" width="${width}" height="${height}" href="${uri}" ${extra}/></svg>`;
const uri = (type, bytes) => `data:${type};base64,${Buffer.from(bytes).toString('base64')}`;
const filterSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80" viewBox="0 0 120 80"><defs><filter id="f"><feColorMatrix type="saturate" values="0.2"/></filter></defs><rect width="120" height="80" fill="#fff"/><g data-opf-path="slides.0.shape" filter="url(#f)"><rect x="10" y="10" width="60" height="40" fill="#d03030"/></g></svg>';

const browser = await chromium.launch({channel: process.platform === 'win32' && !process.env.CI ? 'msedge' : undefined});
const errors = [], unexpected = [];
const toBytes = base64 => new Uint8Array(Buffer.from(base64, 'base64'));
const TO_BASE64 = "const toBase64 = bytes => { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(s); };";
try {
  const page = await browser.newPage({viewport: {width: 1300, height: 760}});
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.route(/^https?:/, async route => {
    if (route.request().url() === 'https://app.test/') return route.fulfill({status: 200, contentType: 'text/html', body: '<!doctype html><meta charset="utf-8"><main></main>'});
    unexpected.push(route.request().url()); return route.abort();
  });
  await page.goto('https://app.test/');
  await page.addScriptTag({content: script});
  const run = (code, argument) => page.evaluate(`(async () => { const {svgToPdf, svgToPng, sniffImage} = window.opfExport; const input = ${JSON.stringify(argument ?? null)}; ${TO_BASE64} ${code} })()`);

  // ---- Vector PDF of the rendered deck ------------------------------------------------------------------------------------------
  const vector = await run(`
    const diagnostics = [], progress = [];
    const options = {metadata: {title: 'Browser export', language: 'en'}};
    const pdf = await svgToPdf(input.svgs, {...options, onDiagnostic: d => diagnostics.push(d), onProgress: p => progress.push(p)});
    const again = await svgToPdf(input.svgs, options);
    return {pdf: toBase64(pdf), same: pdf.length === again.length && pdf.every((b, i) => b === again[i]), diagnostics, progress};
  `, {svgs});
  const pdfBytes = toBytes(vector.pdf);
  await writeFile(path.join(outputDirectory, 'vector.pdf'), pdfBytes);
  assert.ok(vector.same, 'the browser PDF is byte-identical across runs');
  assert.deepEqual(vector.progress.map(item => item.page), [1, 2, 3], 'progress is reported after each page');
  const embedded = vector.diagnostics.filter(item => item.code === 'pdf-font-embedded');
  assert.ok(embedded.length >= 1 && embedded.every(item => /roboto/i.test(item.family)), 'the embedded Roboto subsets are reported: ' + JSON.stringify(vector.diagnostics).slice(0, 1500));
  assert.equal(vector.diagnostics.filter(item => /substituted|glyph-missing|unreadable|unavailable/.test(item.code)).length, 0, JSON.stringify(vector.diagnostics));
  const doc = await openPdf(pdfBytes);
  assert.equal(doc.numPages, 3);
  const text = await Promise.all([1, 2, 3].map(number => pageText(doc, number)));
  assert.match(text[0], /Quarterly operating review/);
  assert.match(text[0], /Revenue grew in every region/);
  assert.match(text[1], /First finding.*Second finding.*Third finding/);
  assert.match(text[2], /Quarter.*Revenue/);
  const nodeDoc = await openPdf(await nodeSvgToPdf(svgs));
  for (const number of [1, 2, 3]) assert.equal(await pageText(nodeDoc, number), text[number - 1], `page ${number}: the browser and Node PDFs extract the same text`);
  const rendered = await renderPdfPage(doc, 1);
  const stats = await sharp(rendered.png).stats();
  assert.ok(stats.channels.some(channel => channel.stdev > 5), 'the rendered PDF page draws content');
  assert.ok((await pageItems(doc, 1)).length > 0);

  // ---- Pictures through a canvas ------------------------------------------------------------------------------------------------
  const pictures = await run(`
    const out = {};
    for (const [name, svg] of Object.entries(input)) {
      const diagnostics = [];
      out[name] = {pdf: toBase64(await svgToPdf(svg, {onDiagnostic: d => diagnostics.push(d)})), diagnostics: diagnostics.filter(d => d.code !== 'pdf-font-embedded')};
    }
    return out;
  `, {
    png: imageSvg(40, 30, uri('image/png', png)),
    jpeg: imageSvg(64, 48, uri('image/jpeg', upright)),
    webp: imageSvg(64, 64, uri('image/webp', webp)),
    filter: filterSvg,
  });
  for (const [name, item] of Object.entries(pictures)) {
    const bytes = toBytes(item.pdf);
    const document = await openPdf(bytes);
    assert.equal(document.numPages, 1, name);
    const {png: out} = await renderPdfPage(document, 1);
    const {data, info} = await sharp(out).removeAlpha().raw().toBuffer({resolveWithObject: true});
    let inked = 0;
    for (let index = 0; index < info.width * info.height; index++) if (data[index * 3] < 250 || data[index * 3 + 1] < 250 || data[index * 3 + 2] < 250) inked++;
    assert.ok(inked > info.width * info.height * 0.05, `${name}: the picture is drawn (${inked} non-white pixels)`);
    if (name === 'jpeg') assert.ok(Buffer.from(bytes).includes(Buffer.from('DCTDecode')), 'an upright JPEG passes through compressed');
    if (name === 'filter') assert.ok(item.diagnostics.some(d => d.code === 'pdf-raster-fallback'), 'a filter is the one element rasterized, and says so');
    else assert.deepEqual(item.diagnostics, [], `${name}: no diagnostics`);
  }

  // JPEG orientation: the canvas applies EXIF orientation as sharp does.
  for (const orientation of [1, 2, 3, 4, 5, 6, 7, 8]) {
    const jpeg = await readFile(path.join(root, `test/fixtures/jpeg/orientation-${orientation}.jpg`));
    const expectedPath = path.join(root, `test/fixtures/jpeg/expected-${orientation}.png`);
    const expected = await sharp(expectedPath).metadata();
    const result = await run(`
      const sniffed = sniffImage(Uint8Array.from(atob(input.base64), c => c.charCodeAt(0)));
      return {sniffed, pdf: toBase64(await svgToPdf(input.svg))};
    `, {base64: jpeg.toString('base64'), svg: imageSvg(expected.width, expected.height, uri('image/jpeg', jpeg))});
    assert.equal(result.sniffed.format, 'jpeg');
    assert.equal(result.sniffed.orientation ?? 1, orientation, `orientation ${orientation} is read from EXIF`);
    const {png: out, width, height} = await renderPdfPage(await openPdf(toBytes(result.pdf)), 1);
    assert.equal(width, expected.width); assert.equal(height, expected.height);
    const [a, b] = await Promise.all([sharp(out).removeAlpha().resize(16, 16).raw().toBuffer(), sharp(expectedPath).removeAlpha().resize(16, 16).raw().toBuffer()]);
    let sum = 0; for (let index = 0; index < a.length; index++) sum += Math.abs(a[index] - b[index]);
    assert.ok(sum / a.length < 24, `orientation ${orientation}: drawn upright (mean error ${(sum / a.length).toFixed(1)})`);
  }

  // ---- PNG, raster PDF, cancellation ------------------------------------------------------------------------------------------
  const outputs = await run(`
    const one = await svgToPng(input.svgs[0]);
    const double = await svgToPng(input.svgs[0], {scale: 2});
    const clear = await svgToPng(input.bare, {background: 'transparent'});
    const raster = await svgToPdf(input.svgs, {mode: 'raster', scale: 1});
    const controller = new AbortController();
    let cancelled = null;
    try { await svgToPdf(input.svgs, {signal: controller.signal, onProgress: () => controller.abort()}); } catch (error) { cancelled = error.name; }
    let tooLarge = null;
    try { await svgToPng(input.svgs[0], {scale: 100}); } catch (error) { tooLarge = error.code; }
    return {one: toBase64(one), double: toBase64(double), clear: toBase64(clear), raster: toBase64(raster), cancelled, tooLarge};
  `, {svgs, bare: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect x="10" y="10" width="10" height="10" fill="#d03030"/></svg>'});
  const one = await sharp(toBytes(outputs.one)).metadata(), double = await sharp(toBytes(outputs.double)).metadata();
  assert.deepEqual([one.width, one.height], [1280, 720]);
  assert.deepEqual([double.width, double.height], [2560, 1440]);
  assert.equal(one.format, 'png');
  const first = await sharp(toBytes(outputs.one)).removeAlpha().raw().toBuffer({resolveWithObject: true});
  const colours = new Set();
  for (let index = 0; index < first.data.length; index += 3 * 997) colours.add(`${first.data[index]},${first.data[index + 1]},${first.data[index + 2]}`);
  assert.ok(colours.size >= 2, 'the PNG draws the slide, not a blank page');
  // The canvas draws the SVG's embedded Roboto, as resvg does: the two PNGs agree to anti-aliasing (a wrong font would move every glyph).
  const compared = await compareImages(Buffer.from(toBytes(outputs.one)), Buffer.from(await nodeSvgToPng(svgs[0])), {factor: 4});
  console.log('browser PNG vs resvg PNG', JSON.stringify(compared));
  assert.ok(compared.mae < 6 && compared.largePercent < 3, `the browser PNG matches the resvg PNG: ${JSON.stringify(compared)}`);
  const clearCorner = await sharp(toBytes(outputs.clear)).ensureAlpha().extract({left: 0, top: 0, width: 1, height: 1}).raw().toBuffer();
  assert.ok(clearCorner[3] < 255, 'a transparent PNG keeps transparent pixels');
  const rasterDoc = await openPdf(toBytes(outputs.raster));
  assert.equal(rasterDoc.numPages, 3);
  assert.equal(await pageText(rasterDoc, 1), '', 'raster mode has no text layer');
  assert.equal(outputs.cancelled, 'AbortError', 'an aborted export rejects with AbortError');
  assert.equal(outputs.tooLarge, 'png-render-failed', 'an oversized PNG is refused, not silently clipped');
  await writeFile(path.join(outputDirectory, 'slide-1.png'), toBytes(outputs.one));
} finally {
  await browser.close();
}
assert.deepEqual(errors, [], 'no page errors');
assert.deepEqual(unexpected, [], 'no network request leaves the page');
console.log('Browser export passed: vector PDF (selectable text), pictures, filter fallback, raster PDF, PNG, cancel and progress, offline.');
