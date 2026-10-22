// RR-98 (RR-23, RR-27): the playground's Export menu in a real browser, offline, with the real fonts and the injected PowerPoint exporter.
// Every format is downloaded through the menu and then read back independently: the PDF opens in pdf.js and its text is the slide text, a PNG has
// the size the renderer drew, an SVG parses as XML and carries its subset fonts, a ZIP holds one file per slide, the PPTX opens and holds the
// slides, and the OPF source formats read back with core. Also: the keyboard, a long export that is cancelled, the converter's notes, the
// agent handoff with the session's exact deck, the phone's bottom sheet, the deck's filename naming the file, and nothing sent anywhere.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { embed } from '@openpresentation/opf';
import { fromMarkdown } from '@openpresentation/opf/markdown';
import { fromYaml } from '@openpresentation/opf/yaml';
import { gallery as defaultCatalog } from '@openpresentation/gallery';
// RR-17: jszip is a test dependency of its own (opf-pptx 0.13 no longer installs it).
import JSZip from 'jszip';
import { buildAgentHandoff } from '../src/agent-handoff.js';

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
const jsonOf = markdown => markdown.match(/^(`{3,})json\n([\s\S]*)\n\1$/m)[2];
const checks = [];
const mark = name => checks.push(name);
let browser;
try {
  browser = await chromium.launch({ channel: process.platform === 'win32' && !process.env.CI ? 'msedge' : undefined });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true, permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await context.newPage();
  const errors = [], networkWrites = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  const wasmRequests = [];
  page.on('request', request => { if (!['GET', 'HEAD'].includes(request.method())) networkWrites.push(request.url()); });
  page.on('request', request => { if (request.url().endsWith('.wasm')) wasmRequests.push(new URL(request.url()).pathname); });
  const button = name => page.getByRole('button', { name, exact: true });
  const trigger = button('Export');
  const item = name => page.getByRole('menuitem', { name });
  const status = page.locator('.opf-export-status');
  const loadDeck = async (deck, expect) => {
    await button('Source').click();
    await page.locator('#json').fill(JSON.stringify(deck));
    await page.waitForFunction(text => !document.querySelector('#apply-json').disabled && document.querySelector('#source-preview').textContent.includes(text), expect, { timeout: 60000 });
    await button('Apply changes').click();
    await page.locator('#preview svg').waitFor();
  };
  const session = async () => {
    await button('Source').click();
    const deck = JSON.parse(await page.locator('#json').inputValue());
    await button('Close source editor').click();
    return deck;
  };
  // Choose a format in the menu and take the file the browser downloads; a failure shows in the status line, so look at it before waiting for ever.
  const exportAs = async (name, { timeout = 120000 } = {}) => {
    const event = page.waitForEvent('download', { timeout });
    const failure = page.waitForFunction(() => document.querySelector('.opf-export-status')?.dataset.state === 'error', undefined, { timeout }).then(() => 'failed');
    event.catch(() => {}); failure.catch(() => {});
    await trigger.click();
    await item(name).click();
    const winner = await Promise.race([event, failure]);
    if (winner === 'failed') throw new Error(`Export failed: ${await status.innerText()}`);
    assert.equal(await winner.failure(), null);
    return { name: winner.suggestedFilename(), bytes: await readFile(await winner.path()) };
  };
  const wellFormed = text => page.evaluate(source => { const doc = new DOMParser().parseFromString(source, 'image/svg+xml'); return doc.querySelector('parsererror') ? doc.querySelector('parsererror').textContent : doc.documentElement.localName; }, text);
  await page.goto(`http://127.0.0.1:${server.address().port}/index.html`);
  await page.locator('#preview svg').waitFor();
  await trigger.waitFor();
  await page.context().setOffline(true);

  // ---- The Export menu replaces the PowerPoint and PDF / PNG / SVG dialogs ---------------------------------------------------------------------
  assert.equal(await page.locator('#export-pptx, #export-files, #export-dialog, #download-dialog').count(), 0);
  assert.equal(await trigger.locator('svg').count(), 2, 'the Download and ChevronDown icons');

  // ---- The deck: its own filename, a hidden slide, text that must come back out of the PDF -------------------------------------------------------
  const deck = {
    name: 'Download deck', filename: 'q3-review.pptx', design: { theme: 'classic', fontScheme: 'roboto' },
    slides: [
      { id: 'one', title: 'Revenue grew in every region', text: 'The enterprise segment led the quarter.' },
      { id: 'two', title: 'Hidden backup slide', text: 'Not for the room.', hidden: true },
      { id: 'three', title: 'Next steps', items: ['Hire two engineers', 'Ship the beta'] },
    ],
  };
  await loadDeck(deck, 'Revenue grew');

  // ---- Keyboard: Enter opens the menu, focus lands on the first item, Escape closes and returns --------------------------------------------------
  await trigger.focus();
  await page.keyboard.press('Enter');
  await page.getByRole('menu', { name: 'Export formats' }).waitFor({ state: 'visible' });
  assert.match(await page.evaluate(() => document.activeElement.textContent), /^PowerPoint/, 'focus starts on the first item');
  assert.equal(await item(/^SVG slides/).locator('.opf-export-item-meta').innerText(), 'ZIP');
  await page.keyboard.press('Escape');
  await page.getByRole('menu').waitFor({ state: 'hidden' });
  assert.equal(await page.evaluate(() => document.activeElement.textContent.trim()), 'Export', 'focus returns to the trigger');
  mark('keyboard');

  // ---- PDF: every slide but the hidden one, text selectable, fonts embedded -------------------------------------------------------------------------
  const pdf = await exportAs(/^PDF/);
  assert.equal(pdf.name, 'q3-review.pdf', 'the deck\'s filename names the file');
  assert.equal(Buffer.from(pdf.bytes.subarray(0, 5)).toString(), '%PDF-');
  await writeFile(path.join(outputDirectory, 'vector.pdf'), pdf.bytes);
  assert.equal(await pdfText(pdf.bytes), 2, 'the hidden slide is left out');
  assert.match(await pdfText(pdf.bytes, 1), /Revenue grew in every region.*The enterprise segment led the quarter/, 'the PDF text is the slide text (selectable)');
  assert.match(await pdfText(pdf.bytes, 2), /Next steps.*Hire two engineers.*Ship the beta/);
  const embedded = Buffer.from(pdf.bytes).toString('latin1');
  assert.match(embedded, /\/FontFile2/, 'font subsets are embedded');
  assert.doesNotMatch(embedded, /Hidden backup/);
  assert.match(await status.innerText(), /^q3-review\.pdf · 2 slides · \d+ KB/, 'the status line reports the file');
  assert.match(await page.locator('.opf-export-live').innerText(), /q3-review\.pdf · 2 slides/, 'and announces it');
  mark('pdf');

  // ---- PNG: all slides arrive as a ZIP; one slide as itself -------------------------------------------------------------------------------------------
  const size = await page.evaluate(() => ({ width: Number(document.querySelector('#preview svg').getAttribute('width')), height: Number(document.querySelector('#preview svg').getAttribute('height')) }));
  const pngZip = await exportAs(/^PNG images/);
  assert.equal(pngZip.name, 'q3-review.zip');
  const pngFiles = await JSZip.loadAsync(pngZip.bytes);
  assert.deepEqual(Object.keys(pngFiles.files).sort(), ['q3-review-001.png', 'q3-review-003.png']);
  for (const file of Object.values(pngFiles.files)) assert.deepEqual(pngSize(await file.async('uint8array')), { width: size.width * 2, height: size.height * 2 }, 'a PNG is drawn at twice the slide size');
  // ---- SVG: all slides as a ZIP, each well-formed ------------------------------------------------------------------------------------------------------
  const svgZip = await JSZip.loadAsync((await exportAs(/^SVG slides/)).bytes);
  assert.equal(Object.keys(svgZip.files).length, 2);
  for (const file of Object.values(svgZip.files)) assert.equal(await wellFormed(await file.async('string')), 'svg');

  // A one-slide deck gives each picture as itself, not in a ZIP.
  const single = { name: 'Single', slides: [{ id: 'a', title: 'Revenue grew in every region', text: 'The enterprise segment led the quarter.' }], design: { fontScheme: 'roboto' } };
  await loadDeck(single, 'Revenue grew');
  assert.equal(await item(/^SVG slides/).count(), 0, 'closed');
  await trigger.click();
  assert.equal(await item(/^SVG slides/).locator('.opf-export-item-meta').innerText(), '.svg', 'the hint follows the deck');
  await page.keyboard.press('Escape');
  const png = await exportAs(/^PNG images/);
  assert.equal(png.name, 'Single-001.png');
  assert.deepEqual(pngSize(png.bytes), { width: size.width * 2, height: size.height * 2 });
  await writeFile(path.join(outputDirectory, 'slide-1.png'), png.bytes);
  const svg = await exportAs(/^SVG slides/);
  assert.equal(svg.name, 'Single-001.svg');
  const svgText = svg.bytes.toString('utf8');
  assert.equal(await wellFormed(svgText), 'svg', 'the SVG is well-formed XML');
  assert.match(svgText, /Revenue grew in every region/);
  assert.match(svgText, /@font-face/);
  // opf-editor#141: the playground's fonts handle has the subset engine (harfbuzz-subset.wasm served next to the page), so the SVG embeds each face cut
  // to the slide's glyphs. Roboto Regular alone is about 159 KB whole; the two Roboto faces of this slide are about 15 KB each.
  const faceSizes = [...svgText.matchAll(/base64,([A-Za-z0-9+/=]+)/g)].map(match => Buffer.from(match[1], 'base64').length);
  assert.ok(faceSizes.length >= 1, 'the SVG embeds its faces');
  assert.ok(faceSizes.every(size => size < 40000), `each embedded face is cut to the slide's glyphs: ${faceSizes}`);
  assert.ok(svg.bytes.length < 100000, `the single-slide SVG is small: ${svg.bytes.length} bytes`);
  assert.ok(wasmRequests.includes('/harfbuzz-subset.wasm') && wasmRequests.includes('/harfbuzz.wasm'), `the page loads both HarfBuzz modules: ${wasmRequests}`);
  // Font license notices name URLs in comments; what must not appear is a reference that would be fetched.
  const external = svgText.replace(/data:[^"')]*/g, '').match(/(?:href\s*=\s*["']|url\(\s*["']?|@import\s+["']?)https?:\/\/(?!www\.w3\.org)[^\s"')<]*/g);
  assert.equal(external, null, `the SVG references nothing outside itself: ${external}`);
  mark('png and svg');

  // ---- PowerPoint: the host's injected exporter ----------------------------------------------------------------------------------------------------
  await loadDeck(deck, 'Revenue grew');
  const pptx = await exportAs(/^PowerPoint/);
  assert.equal(pptx.name, 'q3-review.pptx');
  const slideXml = await (await JSZip.loadAsync(pptx.bytes)).file('ppt/slides/slide1.xml').async('string');
  assert.match(slideXml, /Revenue grew in every region/);
  assert.match(await status.innerText(), /^q3-review\.pptx · 3 slides · \d+ KB/);
  mark('pptx');

  // ---- OPF source: JSON as "Save OPF" writes it; YAML and Markdown read back with core -------------------------------------------------------------
  const current = await session();
  const json = await exportAs(/^JSON/);
  assert.equal(json.name, 'q3-review.opf.json');
  assert.deepEqual(JSON.parse(json.bytes.toString('utf8')), embed(current, { catalogs: [defaultCatalog] }).document, 'catalog records are embedded, as in Save OPF');
  const yaml = await exportAs(/^YAML/);
  assert.equal(yaml.name, 'q3-review.opf.yaml');
  const readYaml = fromYaml(yaml.bytes.toString('utf8'));
  assert.equal(readYaml.valid, true);
  assert.deepEqual(readYaml.presentation, current);
  const markdown = await exportAs(/^Markdown/);
  assert.equal(markdown.name, 'q3-review.opf.md');
  const readMarkdown = fromMarkdown(markdown.bytes.toString('utf8'));
  assert.equal(readMarkdown.valid, true);
  assert.deepEqual(readMarkdown.presentation, current);
  mark('opf source');

  // ---- The agent handoff: the session's exact deck -----------------------------------------------------------------------------------------------------
  await trigger.click();
  await item(/^Agent handoff/).click();
  const dialog = page.getByRole('dialog', { name: 'Agent handoff' });
  await dialog.waitFor();
  const prompt = page.getByRole('textbox', { name: 'Prompt for a coding agent' });
  for (const [label, target] of [['PowerPoint (.pptx)', 'pptx'], ['PDF', 'pdf'], ['SVG slides', 'svg']]) {
    await page.getByRole('radio', { name: label }).click();
    const expected = buildAgentHandoff(current, { target });
    assert.equal(await prompt.inputValue(), expected.markdown, `${target}: the prompt for the session's deck`);
    assert.equal(jsonOf(await prompt.inputValue()), JSON.stringify(current, null, 2));
    assert.equal(await page.locator('.opf-handoff-count').innerText(), `${expected.lines} lines`);
  }
  await page.getByRole('radio', { name: 'PDF' }).click();
  await page.getByRole('button', { name: 'Copy prompt' }).click();
  await page.waitForFunction(() => document.querySelector('.opf-handoff-copy span').textContent === 'Copied');
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), buildAgentHandoff(current, { target: 'pdf' }).markdown);
  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'hidden' });
  assert.equal(await page.evaluate(() => document.activeElement.textContent.trim()), 'Export', 'focus returns to the Export button');
  mark('agent handoff');

  // ---- A long export can be cancelled; the menu recovers ----------------------------------------------------------------------------------------------
  const long = { name: 'Long deck', design: { fontScheme: 'roboto' }, slides: Array.from({ length: 60 }, (_, index) => ({ id: `s${index}`, title: `Slide ${index + 1}`, text: 'A paragraph of text that has to be laid out and written. '.repeat(6) })) };
  await loadDeck(long, 'Slide 1');
  let downloaded = false;
  page.once('download', () => { downloaded = true; });
  await trigger.click();
  await item(/^PDF/).click();
  await status.locator('progress').waitFor({ state: 'visible' });
  await page.waitForFunction(() => /Page \d+ of 60/.test(document.querySelector('.opf-export-status-text').textContent), undefined, { timeout: 60000 });
  assert.ok(Number(await status.locator('progress').getAttribute('value')) > 0, 'progress advances page by page');
  await status.getByRole('button', { name: 'Cancel export' }).click();
  await page.waitForFunction(() => document.querySelector('.opf-export-status')?.dataset.state === 'cancelled');
  assert.match(await status.innerText(), /Export cancelled\./);
  assert.equal(downloaded, false, 'a cancelled export offers no file');
  await trigger.click();
  assert.equal(await item(/^PDF/).getAttribute('aria-disabled'), null, 'the menu is usable again');
  await page.keyboard.press('Escape');
  mark('cancel');

  // ---- Notes the converter reports are shown, not hidden ------------------------------------------------------------------------------------------------
  const picture = 'data:image/svg+xml;base64,' + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80" viewBox="0 0 120 80"><rect width="120" height="80" fill="#3355cc"/></svg>').toString('base64');
  const notes = { name: 'Notes deck', design: { fontScheme: 'roboto' }, slides: [{ id: 'n', title: 'A picture and a sentence', image: { src: picture, alt: 'Blue panel' } }] };
  await loadDeck(notes, 'A picture and a sentence');
  await exportAs(/^PDF/);
  await page.locator('.opf-export-notes li').first().waitFor();
  const shown = await status.locator('.opf-export-notes li').allInnerTexts();
  assert.ok(shown.some(text => /^Slide 1: .*rasterized/.test(text)), `the converter's note about the rasterized picture is shown: ${JSON.stringify(shown)}`);
  assert.match(await status.innerText(), /1 note to review/);
  mark('notes');

  // ---- On a phone the header buttons sit behind More and Export is a bottom sheet -------------------------------------------------------------------
  await page.setViewportSize({ width: 390, height: 780 });
  await page.locator('#more-actions').click();
  await trigger.click();
  const sheet = page.getByRole('dialog', { name: 'Export' });
  await sheet.waitFor();
  assert.equal(await sheet.getByRole('menuitem').count(), 8);
  const box = await sheet.boundingBox();
  assert.ok(Math.abs(box.y + box.height - 780) < 1 && box.width === 390, `the sheet sits at the bottom edge: ${JSON.stringify(box)}`);
  assert.ok((await item(/^PDF/).boundingBox()).height >= 44, 'rows are 44px');
  await page.screenshot({ path: path.join(outputDirectory, 'export-sheet.png') });
  await page.keyboard.press('Escape');
  const phone = await exportAs(/^JSON/);
  assert.equal(phone.name, 'Notes-deck.opf.json');
  assert.equal(await sheet.isHidden(), true, 'choosing a format closes the sheet');
  await page.setViewportSize({ width: 1440, height: 1000 });
  mark('phone sheet');

  assert.deepEqual(errors, []);
  assert.deepEqual(networkWrites, []);
  await page.screenshot({ path: path.join(outputDirectory, 'export-menu.png') });
  console.log(JSON.stringify({ passed: true, browser: browser.version(), offline: true, checks, pdf: { pages: 2, selectableText: true }, png: pngSize(png.bytes), svg: 'well-formed', zip: true, cancel: true, keyboard: true }));
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
