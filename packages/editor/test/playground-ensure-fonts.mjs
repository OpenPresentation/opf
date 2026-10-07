// FF-41: the editor loads the fonts a document needs BEFORE it renders that document, on every path that sets a new document
// or draws a slide. Published 0.10.0 re-rendered the main canvas first (the canvas subscribes to the session itself), so an
// Aptos deck with Japanese text showed "Preview unavailable ... Intos Display cannot display U+65E5" after Source Apply.
//
// Each scenario runs in a fresh page (nothing preloaded) against the built playground, served locally, and asserts that:
//  - "Preview unavailable" / "cannot display" never appears in the preview at any point (a MutationObserver records it),
//  - "Loading fonts…" shows while the faces load (the gate engaged) and the slide then draws with the right faces,
//  - every request stays on the local server.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { toPptx } from '@openpresentation/opf-pptx';

const root = fileURLToPath(new URL('../artifacts/playground/', import.meta.url));
const output = path.resolve(fileURLToPath(new URL('../', import.meta.url)), process.argv[2] ?? 'artifacts/playground-ensure-fonts');
await mkdir(output, { recursive: true });
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.ttf': 'font/ttf' };
const requests = [], faceRequests = [];
let failFaces = false;
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/favicon.ico') { res.writeHead(204).end(); return; }
    const target = path.resolve(root, '.' + decodeURIComponent(url.pathname));
    const relative = path.relative(root, target);
    if (relative.startsWith('..') || path.isAbsolute(relative)) { res.writeHead(403).end(); return; }
    if (/^\/(script-fonts|fonts)\//.test(url.pathname)) {
      faceRequests.push(url.pathname);
      if (failFaces) { res.writeHead(503).end(); return; }
    }
    res.writeHead(200, { 'Content-Type': types[path.extname(target)] ?? 'application/octet-stream' }).end(await readFile(target));
  } catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;

const deck = (fields, title, text) => ({ name: 'Fonts before render', ...fields, slides: [{ id: 'first', title, text }] });
const aptosJa = { ...deck({ language: 'ja', design: { theme: 'classic', fontScheme: 'aptos' } }, '四半期レビュー 12%', '売上は前年同期比で12%増加しました。'), name: 'Aptos Japanese' };
const twoSlides = { ...aptosJa, name: 'Aptos two slides', slides: [aptosJa.slides[0], { id: 'second', title: 'ギャラリーから開く', text: '第二のスライドも日本語です。' }] };
const latin = deck({ design: { theme: 'classic', fontScheme: 'roboto' } }, 'Quarterly review', 'Sales grew twelve percent.');
// A font scheme record carried in the document's own catalog (what a gallery item does), naming a vendored lazy family.
const barlow = { ...deck({ catalogs: { fontSchemes: { records: [{ $schema: 'https://openpresentation.org/schema/opf-font-scheme/v1', id: 'barlow-preview', name: 'Barlow', major: 'Barlow', minor: 'Barlow' }] } }, design: { theme: 'classic', fontScheme: 'barlow-preview' } }, 'Barlow headline', 'Body text in Barlow.'), name: 'Barlow' };
const arabic = deck({ language: 'ar', design: { theme: 'classic', fontScheme: 'arabic-typesetting' } }, 'مراجعة ربع سنوية.', 'ارتفعت المبيعات بنسبة 12%.');
const arabicPptx = await toPptx({ ...arabic, name: 'Arabic import' });

let browser;
const problems = [];
try {
  browser = await chromium.launch({ channel: process.platform === 'win32' && !process.env.CI ? 'msedge' : undefined });
  const open = async () => {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.on('pageerror', error => problems.push(`pageerror: ${error.message}`));
    page.on('console', message => { if (message.type() === 'error' && !/status of 503/.test(message.text())) problems.push(`console: ${message.text()}`); });
    page.on('request', request => { if (/^https?:/.test(request.url())) requests.push(request.url()); });
    await page.route(/^https?:/, route => route.request().url().startsWith(base) ? route.continue() : (problems.push(`blocked: ${route.request().url()}`), route.abort()));
    await page.addInitScript(() => {
      // Records everything the main preview ever shows: an unavailable/cannot-display state, and the loading placeholder.
      window.__seen = { unavailable: [], loading: 0 };
      const watch = () => {
        const preview = document.getElementById('preview');
        if (!preview) { requestAnimationFrame(watch); return; }
        new MutationObserver(() => {
          const text = preview.textContent;
          if (/Preview unavailable|cannot display/.test(text)) window.__seen.unavailable.push(text.slice(0, 200));
          if (/Loading fonts/.test(text)) window.__seen.loading++;
        }).observe(preview, { childList: true, subtree: true, characterData: true });
      };
      watch();
    });
    await page.goto(`${base}/index.html`);
    await page.locator('#preview svg').waitFor();
    return page;
  };
  const button = (page, name) => page.getByRole('button', { name, exact: true });
  const settled = (page, title) => page.waitForFunction(title => document.querySelector('#slide-title').textContent === title && document.querySelector('#preview svg') && !/Loading fonts/.test(document.querySelector('#status').textContent) && !document.querySelector('.opf-canvas-fonts'), title, { timeout: 60000 });
  const painted = page => page.evaluate(() => {
    const runs = [...document.querySelectorAll('#preview svg text')].map(node => ({ text: node.textContent, family: (node.getAttribute('font-family') ?? node.closest('[font-family]')?.getAttribute('font-family') ?? '').split(',').map(part => part.trim().replace(/^"|"$/g, '')) }));
    return {
      runs, text: runs.map(run => run.text).join(' '),
      loaded: [...document.fonts].filter(face => face.status === 'loaded').map(face => face.family.replace(/^"|"$/g, '')),
      unavailable: document.querySelector('#preview').textContent.includes('Preview unavailable'),
      thumbnails: [...document.querySelectorAll('#slide-list .thumbnail')].map(node => ({ text: node.textContent, drawn: node.querySelectorAll('svg text').length })),
    };
  });
  const familyOf = (state, fragment) => state.runs.find(run => run.text.includes(fragment))?.family ?? [];
  const seen = page => page.evaluate(() => window.__seen);
  const noUnavailable = async (page, name) => {
    const record = await seen(page);
    assert.deepEqual(record.unavailable, [], `${name}: the preview never showed an unavailable or cannot-display state`);
    assert.equal((await painted(page)).unavailable, false, `${name}: no Preview unavailable after settling`);
    return record;
  };
  const applySource = async (page, value) => {
    await button(page, 'Source').click();
    await page.locator('#json').fill(JSON.stringify(value));
    await page.waitForFunction(() => !document.querySelector('#apply-json').disabled && !/Loading fonts/.test(document.querySelector('#json-error').textContent) && !document.querySelector('#json-error').textContent, undefined, { timeout: 60000 });
    await button(page, 'Apply changes').click();
  };
  const chooseFont = (page, value) => page.evaluate(value => {
    const select = document.querySelector('#font');
    if (![...select.options].some(option => option.value === value)) select.append(new Option(value, value));
    select.value = value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);

  // 1. Source Apply of an Aptos deck with Japanese text (the reported bug).
  let page = await open();
  await applySource(page, aptosJa);
  await settled(page, aptosJa.slides[0].title);
  let state = await painted(page);
  assert.ok(state.loaded.includes('Intos') && state.loaded.includes('Noto Sans JP'), `Intos and Noto Sans JP are loaded: ${state.loaded}`);
  assert.match(state.text, /四半期レビュー/);
  assert.ok(familyOf(state, '四半期').includes('Noto Sans JP') || familyOf(state, '四半期').some(name => /Intos/.test(name)), `Japanese runs use a loaded face: ${familyOf(state, '四半期')}`);
  assert.ok(state.thumbnails[0].drawn > 0, 'the thumbnail drew the slide');
  let record = await noUnavailable(page, 'Source Apply');

  await page.locator('#preview').screenshot({ path: path.join(output, 'apply-aptos-ja.png') });
  // Export measures the same text: the Japanese Aptos deck converts without a missing-glyph error.
  await button(page, 'PowerPoint').click();
  await page.waitForFunction(() => !document.querySelector('#download-pptx').disabled || document.querySelector('#export-error').textContent, undefined, { timeout: 60000 });
  assert.equal(await page.locator('#export-error').innerText(), '', 'PowerPoint export of the Aptos Japanese deck');
  await button(page, 'Close PowerPoint export').click();
  await page.close();

  // 2. Gallery handoff: pptx.gallery fills #json and clicks Apply in the same tick, without waiting for the source preview.
  page = await open();
  await page.evaluate(snippet => {
    document.getElementById('open-json').click();
    const json = document.getElementById('json');
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(json, snippet);
    json.dispatchEvent(new Event('input', { bubbles: true }));
    document.getElementById('apply-json').click();
  }, JSON.stringify(twoSlides));
  await settled(page, twoSlides.slides[0].title);
  state = await painted(page);
  assert.ok(state.loaded.includes('Intos') && state.loaded.includes('Noto Sans JP'));
  assert.match(state.text, /四半期レビュー/);
  await noUnavailable(page, 'gallery handoff');
  assert.equal(await page.locator('#source-dialog').evaluate(dialog => dialog.open), false, 'the handoff closed the source dialog');
  // 3. Slide navigation and thumbnails on the same document.
  state = await painted(page);
  assert.equal(state.thumbnails.length, 2);
  assert.ok(state.thumbnails.every(thumbnail => thumbnail.drawn > 0), 'both thumbnails drew');
  await page.locator('#slide-list .slide-card').nth(1).click();
  await settled(page, twoSlides.slides[1].title);
  assert.match((await painted(page)).text, /第二のスライド/);
  await page.locator('#slide-list .slide-card').nth(1).press('Home');
  await settled(page, twoSlides.slides[0].title);
  await noUnavailable(page, 'slide navigation');
  await page.close();

  // 4. Font scheme switch to a lazy family (Open Sans), then an inline scheme in another lazy family (Barlow).
  page = await open();
  const before = faceRequests.length;
  await chooseFont(page, 'open-sans');
  await page.waitForFunction(() => [...document.fonts].some(face => face.family.replace(/"/g, '') === 'Open Sans' && face.status === 'loaded') && !/Loading fonts/.test(document.querySelector('#status').textContent) && !document.querySelector('.opf-canvas-fonts'), undefined, { timeout: 60000 });
  assert.ok(faceRequests.slice(before).some(url => /^\/fonts\/open-sans\//.test(url)), 'Open Sans files were fetched');
  state = await painted(page);
  assert.ok(state.runs.length > 0 && state.runs.every(run => run.family[0] === 'Open Sans'), `every run is Open Sans: ${JSON.stringify(state.runs.map(run => run.family[0]))}`);
  record = await noUnavailable(page, 'font scheme Open Sans');
  assert.ok(record.loading > 0, 'font scheme switch showed Loading fonts');
  await applySource(page, barlow);
  await settled(page, 'Barlow headline');
  state = await painted(page);
  assert.ok(state.loaded.includes('Barlow'), 'Barlow loaded');
  assert.ok(familyOf(state, 'Barlow headline')[0] === 'Barlow', `the headline is Barlow: ${familyOf(state, 'Barlow headline')}`);
  await noUnavailable(page, 'font scheme Barlow');
  await page.close();

  // 5. Importing a .pptx whose text is Arabic: the preview and the applied document both wait for the Arabic faces.
  page = await open();
  await button(page, 'Import').click();
  await page.getByRole('tab', { name: 'File', exact: true }).click();
  await page.locator('#opf-file').setInputFiles({ name: 'arabic.pptx', mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', buffer: Buffer.from(arabicPptx) });
  await page.getByLabel('Import as', { exact: true }).selectOption('replace');
  await page.waitForFunction(() => !document.querySelector('#import-apply').disabled || document.querySelector('#import-error').textContent, undefined, { timeout: 60000 });
  assert.equal(await page.locator('#import-error').innerText(), '', 'the import preview drew without an error');
  assert.ok(await page.locator('#import-preview svg text').count() > 0, 'the import preview drew the Arabic slide');
  await page.locator('#import-apply').click();
  await settled(page, arabic.slides[0].title);
  state = await painted(page);
  assert.ok(state.loaded.includes('Noto Naskh Arabic'), `Arabic face loaded: ${state.loaded}`);
  assert.match(state.text, /مراجعة/);
  await noUnavailable(page, 'PPTX import');
  await page.close();

  // 6. Undo and redo across a document whose faces were unavailable, then Retry. Font files fail (503) while Open Sans is chosen:
  //    the document is not rendered (not even to an error), the failure is reported, nothing retries by itself, and Undo works.
  page = await open();
  failFaces = true;
  const failedBefore = faceRequests.length;
  await chooseFont(page, 'open-sans');
  await page.waitForFunction(() => document.querySelector('.opf-canvas-fonts button'), undefined, { timeout: 60000 });
  assert.match(await page.locator('#status').innerText(), /could not be loaded/);
  assert.equal(await page.locator('#preview svg').count(), 0, 'no slide is drawn for a document whose faces failed');
  await page.waitForTimeout(600);
  const attempts = faceRequests.length - failedBefore;
  await page.waitForTimeout(800);
  assert.equal(faceRequests.length - failedBefore, attempts, 'a failed load is not retried by itself');
  assert.equal(await page.locator('#undo').isDisabled(), false, 'Undo stays available');
  failFaces = false;
  await button(page, 'Undo').click();
  await settled(page, 'Start with a clear recommendation');
  state = await painted(page);
  assert.ok(state.runs.length > 0 && state.runs.every(run => run.family[0] === 'Roboto'), 'Undo redraws the Roboto slide');
  await button(page, 'Redo').click();
  await page.waitForFunction(() => [...document.fonts].some(face => face.family.replace(/"/g, '') === 'Open Sans' && face.status === 'loaded') && !document.querySelector('.opf-canvas-fonts'), undefined, { timeout: 60000 });
  state = await painted(page);
  assert.ok(state.runs.length > 0 && state.runs.every(run => run.family[0] === 'Open Sans'), 'Redo to the pending family loads it and draws it');
  // Retry button: fail again on a new family, then retry once the files are back.
  failFaces = true;
  await chooseFont(page, 'poppins');
  await page.waitForFunction(() => document.querySelector('.opf-canvas-fonts button'), undefined, { timeout: 60000 });
  failFaces = false;
  await page.locator('.opf-canvas-fonts button').click();
  await page.waitForFunction(() => [...document.fonts].some(face => face.family.replace(/"/g, '') === 'Poppins' && face.status === 'loaded') && !document.querySelector('.opf-canvas-fonts') && document.querySelector('#preview svg'), undefined, { timeout: 60000 });
  assert.match((await painted(page)).runs[0].family[0], /Poppins/);
  assert.equal(await page.locator('#font').evaluate(select => select.value), 'poppins');
  await noUnavailable(page, 'undo/redo and retry');
  await page.close();

  assert.deepEqual(problems, [], 'no page errors, console errors or blocked requests');
  assert.ok(requests.length > 0 && requests.every(url => url.startsWith(base)), 'every request stayed on the local server');
  console.log(`Playground ensure-fonts: Source Apply, gallery handoff, slide navigation, font scheme (Open Sans, Barlow), PPTX import (Arabic), undo/redo and retry all loaded their faces before rendering; ${requests.length} requests, all local.`);
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
