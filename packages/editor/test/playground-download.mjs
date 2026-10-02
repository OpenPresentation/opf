// RR-23: the playground's PDF / PNG / SVG downloads in a real browser, offline. Each format is downloaded through the dialog and
// then read back independently: the PDF opens in pdf.js and its text is the slide text, the PNG has the size the dialog promised,
// the SVG parses as XML and carries its fonts, and a ZIP holds one file per slide. Also: the dialog is operable from the keyboard,
// a long export can be cancelled, the deck's filename names the file, hidden slides are opt-in, and nothing is sent anywhere.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
const JSZip = createRequire(import.meta.resolve('@openpresentation/opf-pptx'))('jszip');

const root = fileURLToPath(new URL('../artifacts/playground/', import.meta.url));
const outputDirectory = path.resolve(process.argv[2] ?? 'artifacts/playground-download');
await mkdir(outputDirectory, { recursive: true });
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/favicon.ico') { res.writeHead(204).end(); return; }
    const target = path.resolve(root, '.' + decodeURIComponent(url.pathname));
    const relative = path.relative(root, target);
    if (relative.startsWith('..') || path.isAbsolute(relative)) { res.writeHead(403).end(); return; }
    res.writeHead(200, { 'Content-Type': types[path.extname(target)] ?? 'application/octet-stream' }).end(await readFile(target));
  } catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));

const pngSize = bytes => ({ width: Buffer.from(bytes).readUInt32BE(16), height: Buffer.from(bytes).readUInt32BE(20) });
const pdfText = async (bytes, pageNumber) => {
  const doc = await pdfjs.getDocument({ data: new Uint8Array(bytes), isEvalSupported: false, verbosity: 0, useSystemFonts: false }).promise;
  if (pageNumber === undefined) return doc.numPages;
  const content = await (await doc.getPage(pageNumber)).getTextContent();
  return content.items.map(item => item.str).join(' ').replace(/\s+/g, ' ').trim();
};
let browser;
try {
  browser = await chromium.launch({ channel: process.platform === 'win32' && !process.env.CI ? 'msedge' : undefined });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
  const errors = [], networkWrites = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('request', request => { if (!['GET', 'HEAD'].includes(request.method())) networkWrites.push(request.url()); });
  const button = name => page.getByRole('button', { name, exact: true });
  await page.goto(`http://127.0.0.1:${server.address().port}/index.html`);
  await page.locator('#preview svg').waitFor();
  await page.waitForFunction(() => !!document.querySelector('#export-files'));
  await page.context().setOffline(true);

  const openDialog = async () => { await page.locator('#export-files').click(); await page.locator('#download-dialog').waitFor({ state: 'visible' }); };
  const choose = async (name, value) => page.locator(`#download-dialog input[name="${name}"][value="${value}"]`).check();
  const create = async () => {
    await page.locator('#download-create').click();
    await page.waitForFunction(() => !document.querySelector('#download-save').disabled || document.querySelector('#download-error').textContent || /cancelled/.test(document.querySelector('#download-summary').textContent), undefined, { timeout: 120000 });
    assert.equal(await page.locator('#download-error').innerText(), '');
  };
  const save = async () => { const event = page.waitForEvent('download'); await page.locator('#download-save').click(); const download = await event; assert.equal(await download.failure(), null); return { name: download.suggestedFilename(), bytes: await readFile(await download.path()) }; };
  const wellFormed = text => page.evaluate(source => { const doc = new DOMParser().parseFromString(source, 'image/svg+xml'); return doc.querySelector('parsererror') ? doc.querySelector('parsererror').textContent : doc.documentElement.localName; }, text);

  // ---- The deck: its own filename, a hidden slide, text that must come back out of the PDF -------------------------------------------------------
  const deck = {
    name: 'Download deck', filename: 'q3-review.pptx', design: { theme: 'classic', fontScheme: 'roboto' },
    slides: [
      { id: 'one', title: 'Revenue grew in every region', text: 'The enterprise segment led the quarter.' },
      { id: 'two', title: 'Hidden backup slide', text: 'Not for the room.', hidden: true },
      { id: 'three', title: 'Next steps', items: ['Hire two engineers', 'Ship the beta'] },
    ],
  };
  await button('Source').click();
  await page.locator('#json').fill(JSON.stringify(deck));
  await page.waitForFunction(() => !document.querySelector('#apply-json').disabled && document.querySelector('#source-preview').textContent.includes('Revenue grew'));
  await button('Apply changes').click();
  await page.locator('#preview svg').waitFor();

  // ---- Keyboard: the button opens the dialog, focus lands on Create, Escape closes it ---------------------------------------------------------------
  await page.locator('#export-files').focus();
  await page.keyboard.press('Enter');
  await page.locator('#download-dialog').waitFor({ state: 'visible' });
  assert.equal(await page.evaluate(() => document.activeElement.id), 'download-create', 'focus starts on the primary action');
  assert.equal(await page.locator('#download-hidden-row').isVisible(), true, 'a deck with a hidden slide offers to include it');
  await page.keyboard.press('Escape');
  await page.locator('#download-dialog').waitFor({ state: 'hidden' });
  assert.equal(await page.evaluate(() => document.activeElement.id), 'export-files', 'focus returns to the button');

  // ---- PDF, vector, every slide but the hidden one ------------------------------------------------------------------------------------------------------------
  await openDialog();
  await create();
  const summary = await page.locator('#download-summary').innerText();
  assert.match(summary, /q3-review\.pdf/);
  assert.match(summary, /2 slides/);
  assert.equal(await page.locator('#download-fonts').isVisible(), true, 'the embedded fonts are listed');
  const pdf = await save();
  assert.equal(pdf.name, 'q3-review.pdf');
  assert.equal(Buffer.from(pdf.bytes.subarray(0, 5)).toString(), '%PDF-');
  await writeFile(path.join(outputDirectory, 'vector.pdf'), pdf.bytes);
  assert.equal(await pdfText(pdf.bytes), 2, 'the hidden slide is left out');
  assert.match(await pdfText(pdf.bytes, 1), /Revenue grew in every region.*The enterprise segment led the quarter/, 'the PDF text is the slide text (selectable)');
  assert.match(await pdfText(pdf.bytes, 2), /Next steps.*Hire two engineers.*Ship the beta/);
  const embedded = Buffer.from(pdf.bytes).toString('latin1');
  assert.match(embedded, /\/FontFile2/, 'font subsets are embedded');
  assert.doesNotMatch(embedded, /Hidden backup/);

  // ---- Include hidden slides ----------------------------------------------------------------------------------------------------------------------------
  await page.locator('#download-hidden').check();
  assert.equal(await page.locator('#download-save').isDisabled(), true, 'changing an option clears the finished file');
  await create();
  assert.equal(await pdfText((await save()).bytes), 3);

  // ---- Raster PDF ----------------------------------------------------------------------------------------------------------------------------------------------------
  await choose('download-pdf-mode', 'raster');
  await choose('download-slides', 'current');
  await create();
  const raster = await save();
  assert.equal(await pdfText(raster.bytes), 1);
  assert.equal(await pdfText(raster.bytes, 1), '', 'raster mode draws the slide as an image');
  await button('Close download dialog').click();

  // ---- PNG: one slide, then all slides as a ZIP ---------------------------------------------------------------------------------------------------------
  await openDialog();
  await choose('download-format', 'png');
  assert.equal(await page.locator('#download-pdf-options').isVisible(), false);
  await choose('download-slides', 'current');
  await page.locator('#download-scale').selectOption('2');
  const size = await page.evaluate(() => ({ width: Number(document.querySelector('#preview svg').getAttribute('width')), height: Number(document.querySelector('#preview svg').getAttribute('height')) }));
  await create();
  const png = await save();
  assert.equal(png.name, 'q3-review-01.png');
  assert.deepEqual(pngSize(png.bytes), { width: size.width * 2, height: size.height * 2 }, 'the PNG has the size the dialog promised');
  await writeFile(path.join(outputDirectory, 'slide-1.png'), png.bytes);
  await page.locator('#download-scale').selectOption('1');
  await choose('download-slides', 'all');
  await page.locator('#download-hidden').uncheck();
  await create();
  const pngZip = await save();
  assert.equal(pngZip.name, 'q3-review-png.zip');
  const pngFiles = await JSZip.loadAsync(pngZip.bytes);
  assert.deepEqual(Object.keys(pngFiles.files).sort(), ['q3-review-01.png', 'q3-review-03.png']);
  for (const file of Object.values(pngFiles.files)) assert.deepEqual(pngSize(await file.async('uint8array')), size);
  await button('Close download dialog').click();

  // ---- SVG: one slide, then all slides ------------------------------------------------------------------------------------------------------------------
  await openDialog();
  await choose('download-format', 'svg');
  await choose('download-slides', 'current');
  await create();
  const svg = await save();
  assert.equal(svg.name, 'q3-review-01.svg');
  const svgText = svg.bytes.toString('utf8');
  assert.equal(await wellFormed(svgText), 'svg', 'the SVG is well-formed XML');
  assert.match(svgText, /Revenue grew in every region/);
  assert.match(svgText, /@font-face/);
  // Font license notices name URLs in comments; what must not appear is a reference that would be fetched.
  const external = svgText.replace(/data:[^"')]*/g, '').match(/(?:href\s*=\s*["']|url\(\s*["']?|@import\s+["']?)https?:\/\/(?!www\.w3\.org)[^\s"')<]*/g);
  assert.equal(external, null, `the SVG references nothing outside itself: ${external}`);
  await choose('download-slides', 'all');
  await create();
  const svgZip = await JSZip.loadAsync((await save()).bytes);
  assert.equal(Object.keys(svgZip.files).length, 2);
  for (const file of Object.values(svgZip.files)) assert.equal(await wellFormed(await file.async('string')), 'svg');
  await button('Close download dialog').click();

  // ---- A long export can be cancelled; the dialog recovers --------------------------------------------------------------------------------------------
  const long = { name: 'Long deck', design: { fontScheme: 'roboto' }, slides: Array.from({ length: 60 }, (_, index) => ({ id: `s${index}`, title: `Slide ${index + 1}`, text: 'A paragraph of text that has to be laid out and written. '.repeat(6) })) };
  await button('Source').click();
  await page.locator('#json').fill(JSON.stringify(long));
  await page.waitForFunction(() => !document.querySelector('#apply-json').disabled && document.querySelector('#source-preview').textContent.includes('Slide 1'));
  await button('Apply changes').click();
  await page.locator('#preview svg').waitFor();
  await openDialog();
  await choose('download-slides', 'all');
  await choose('download-format', 'pdf');
  await choose('download-pdf-mode', 'vector');
  await page.locator('#download-create').click();
  await page.locator('#download-progress-row').waitFor({ state: 'visible' });
  await page.waitForFunction(() => /Page \d+ of 60/.test(document.querySelector('#download-progress-label').textContent), undefined, { timeout: 60000 });
  assert.ok(Number(await page.locator('#download-progress').getAttribute('value')) >= 1, 'progress advances page by page');
  await page.locator('#download-cancel').click();
  await page.waitForFunction(() => /cancelled/.test(document.querySelector('#download-summary').textContent));
  assert.equal(await page.locator('#download-save').isDisabled(), true, 'a cancelled export offers no file');
  assert.equal(await page.locator('#download-create').isEnabled(), true);
  await button('Close download dialog').click();

  // ---- Notes the converter reports are shown, not hidden ------------------------------------------------------------------------------------------------
  const picture = 'data:image/svg+xml;base64,' + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80" viewBox="0 0 120 80"><rect width="120" height="80" fill="#3355cc"/></svg>').toString('base64');
  const notes = { name: 'Notes deck', design: { fontScheme: 'roboto' }, slides: [{ id: 'n', title: 'A picture and a sentence', image: { src: picture, alt: 'Blue panel' } }] };
  await button('Source').click();
  await page.locator('#json').fill(JSON.stringify(notes));
  await page.waitForFunction(() => !document.querySelector('#apply-json').disabled && document.querySelector('#source-preview').textContent.includes('A picture and a sentence'), undefined, { timeout: 60000 });
  await button('Apply changes').click();
  await page.locator('#preview svg').waitFor();
  await openDialog();
  await create();
  const shown = await page.locator('#download-diagnostics li').allInnerTexts();
  assert.ok(shown.some(text => /^Slide 1: .*rasterized/.test(text)), `the converter's note about the rasterized picture is shown: ${JSON.stringify(shown)}`);
  assert.match(await page.locator('#download-summary').innerText(), /1 note to review/);
  await button('Close download dialog').click();

  assert.deepEqual(errors, []);
  assert.deepEqual(networkWrites, []);
  await page.screenshot({ path: path.join(outputDirectory, 'download-dialog.png') });
  console.log(JSON.stringify({ passed: true, browser: browser.version(), offline: true, pdf: { pages: 2, selectableText: true }, png: pngSize(png.bytes), svg: 'well-formed', zip: true, cancel: true, keyboard: true }));
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
