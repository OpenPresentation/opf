import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';
import { fromPptx, toPptx } from '@openpresentation/opf-pptx';
import { validatePresentation } from '@openpresentation/opf';
const JSZip = createRequire(import.meta.resolve('@openpresentation/opf-pptx'))('jszip');

const root = fileURLToPath(new URL('../artifacts/playground/', import.meta.url));
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
let browser;
try {
  browser = await chromium.launch({ channel: process.platform === 'win32' && !process.env.CI ? 'msedge' : undefined });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
  const errors = [], networkWrites = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('request', request => { if (!['GET', 'HEAD'].includes(request.method())) networkWrites.push(request.url()); });
  const button = name => page.getByRole('button', { name, exact: true });
  const source = async () => {
    await button('Source').click();
    const document = JSON.parse(await page.locator('#json').inputValue());
    await button('Close source editor').click();
    return document;
  };
  const deck = {
    name: 'Local browser PowerPoint', design: { theme: 'classic', fontScheme: 'roboto' },
    slides: [{ id: 'decision', title: 'An editable decision', composition: { mode: 'row', weights: [2, 1] }, blocks: [
      { text: 'Keep the evidence editable.' },
      { table: { columns: ['Decision', 'Owner'], rows: [[{ value: 'Shared ownership', colSpan: 2, style: { fill: '#E9E3FF', align: 'center' } }, null], ['Review', 'Team']] } },
    ] }],
  };
  await page.goto(`http://127.0.0.1:${server.address().port}/index.html`);
  await page.locator('#preview svg').waitFor();
  await page.waitForFunction(() => !!document.querySelector('#export-pptx').onclick);
  await page.context().setOffline(true);
  await button('Source').click();
  await page.locator('#json').fill(JSON.stringify(deck));
  await page.waitForFunction(() => !document.querySelector('#apply-json').disabled && document.querySelector('#source-preview').textContent.includes('An editable decision'));
  await button('Apply changes').click();
  assert.deepEqual(await source(), deck);
  await page.locator('#preview [data-canvas-target][data-opf-path="slides.0.title"]').dblclick();
  await page.getByRole('textbox', { name: 'Edit title inline', exact: true }).fill('Edited before export');
  // Opening export commits the active canvas draft.
  await button('PowerPoint').click();
  await page.waitForFunction(() => !document.querySelector('#download-pptx').disabled || document.querySelector('#export-error').textContent);
  assert.equal(await page.locator('#export-error').innerText(), '');
  const downloadEvent = page.waitForEvent('download');
  await button('Download PowerPoint').click();
  const download = await downloadEvent;
  assert.equal(await download.failure(), null);
  assert.equal(download.suggestedFilename(), 'Local-browser-PowerPoint.pptx');
  const bytes = await readFile(await download.path());
  assert.ok(bytes.length > 1000);
  const zip = await JSZip.loadAsync(bytes);
  const xml = await zip.file('ppt/slides/slide1.xml').async('string');
  assert.match(xml, /Edited before export/);
  assert.match(xml, /<a:tbl>/); // Actual native table, not a slide screenshot.
  assert.match(xml, /gridSpan="2"/);
  const expectedImport = await fromPptx(bytes);
  assert.equal(validatePresentation(expectedImport).valid, true);
  await button('Close PowerPoint export').click();
  const edited = await source();
  assert.equal(edited.slides[0].title, 'Edited before export');
  await button('Undo').click();
  assert.deepEqual(await source(), deck);
  await button('Redo').click();
  assert.deepEqual(await source(), edited);
  await button('Import').click();
  await page.getByRole('tab', { name: 'File', exact: true }).click();
  await page.locator('#opf-file').setInputFiles({ name: download.suggestedFilename(), mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', buffer: bytes });
  await page.getByLabel('Import as', { exact: true }).selectOption('replace');
  await page.waitForFunction(() => !document.querySelector('#import-apply').disabled || document.querySelector('#import-error').textContent);
  assert.equal(await page.locator('#import-error').innerText(), '');
  assert.equal(await page.locator('#import-conversion').isVisible(), true);
  assert.match(await page.locator('#import-preview').innerText(), /Edited before export/);
  await page.locator('#import-apply').click();
  const imported = await source();
  assert.deepEqual(imported, expectedImport);
  await button('Undo').click();
  assert.deepEqual(await source(), edited);
  await button('Redo').click();
  assert.deepEqual(await source(), imported);
  const opfEvent = page.waitForEvent('download');
  await button('Save OPF').click();
  assert.deepEqual(JSON.parse(await readFile(await (await opfEvent).path(), 'utf8')), imported);

  // Failed conversion cannot replace the current document or leave Apply enabled.
  await button('Import').click();
  await page.getByRole('tab', { name: 'File', exact: true }).click();
  await page.locator('#opf-file').setInputFiles({ name: 'broken.pptx', mimeType: 'application/octet-stream', buffer: Buffer.from('not a zip archive') });
  await page.waitForFunction(() => !!document.querySelector('#import-error').textContent);
  assert.equal(await page.locator('#import-apply').isDisabled(), true);
  await button('Close import dialog').click();
  assert.deepEqual(await source(), imported);

  // A valid PNG with a large ancillary text chunk compresses inside PPTX but
  // expands beyond 20 MB when represented as embedded OPF base64. Its pixels
  // remain a tiny image; this catches accidental reuse of the paste-size cap.
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aB3sAAAAASUVORK5CYII=', 'base64');
  const ancillary = Buffer.concat([Buffer.from('tEXtComment\0'), Buffer.alloc(16 * 1024 * 1024, 65)]);
  let crc = 0xffffffff;
  for (const byte of ancillary) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  const length = Buffer.alloc(4), checksum = Buffer.alloc(4);
  length.writeUInt32BE(ancillary.length - 4); checksum.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
  const image = Buffer.concat([png.subarray(0, -12), length, ancillary, checksum, png.subarray(-12)]);
  const imageDeck = { name: 'Expanded image import', slides: [{ title: 'Large embedded image', image: { src: 'data:image/png;base64,' + image.toString('base64') } }] };
  const imagePptx = await toPptx(imageDeck);
  assert.ok(imagePptx.length < 20 * 1024 * 1024);
  const imageOpf = await fromPptx(imagePptx);
  assert.ok(Buffer.byteLength(JSON.stringify(imageOpf)) > 20 * 1024 * 1024);
  await button('Import').click();
  await page.getByRole('tab', { name: 'File', exact: true }).click();
  await page.locator('#opf-file').setInputFiles({ name: 'image-heavy.pptx', mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', buffer: Buffer.from(imagePptx) });
  await page.getByLabel('Import as', { exact: true }).selectOption('replace');
  await page.waitForFunction(() => !document.querySelector('#import-apply').disabled || document.querySelector('#import-error').textContent, undefined, { timeout: 60000 });
  assert.equal(await page.locator('#import-error').innerText(), '');
  await page.locator('#import-apply').click();
  assert.deepEqual(await source(), imageOpf);
  await button('Undo').click();
  assert.deepEqual(await source(), imported);
  assert.deepEqual(errors, []);
  assert.deepEqual(networkWrites, []);
  await mkdir(new URL('../artifacts/browser-evidence/', import.meta.url), { recursive: true });
  await writeFile(new URL('../artifacts/browser-evidence/export.pptx', import.meta.url), bytes);
  await page.screenshot({ path: fileURLToPath(new URL('../artifacts/browser-evidence/editor.png', import.meta.url)), fullPage: true });
  console.log(JSON.stringify({ passed: true, browser: browser.version(), offlineAfterLoad: true, pptxBytes: bytes.length, nativeTable: true, mergedCells: true, exportCommitsDraft: true, importUndoRedo: true, expandedImageImport: true, malformedInputPreservesDocument: true, networkWrites: networkWrites.length }, null, 2));
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
