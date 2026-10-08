// FF-41: the canvas (createCanvasEditor with the renderer's fonts handle) never renders a document whose faces are still loading, whatever
// changed the document: dimension switches (language, font scheme), undo and redo, slide changes and in-progress edits.
// Real Chromium, the built playground's font files served locally, the real browser font registry.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { chromium } from 'playwright';

const repo = fileURLToPath(new URL('../', import.meta.url));
const playground = path.join(repo, 'artifacts/playground');
const output = path.resolve(repo, process.argv[2] ?? 'artifacts/canvas-fonts');
await mkdir(output, { recursive: true });
const source = `
import { createEditorSession } from ${JSON.stringify(path.join(repo, 'src/index.js').replace(/\\/g, '/'))};
import { createCanvasEditor } from ${JSON.stringify(path.join(repo, 'src/canvas.js').replace(/\\/g, '/'))};
import { switchDimension } from ${JSON.stringify(path.join(repo, 'src/switches.js').replace(/\\/g, '/'))};
import { loadFonts } from '@openpresentation/opf-render/fonts-browser';
import { defaultCatalog } from '@openpresentation/opf/catalog';
const faces = await fetch('./fonts.json').then(response => response.json());
const fonts = await loadFonts({ faces: faces.map(face => ({ family: face.family, weight: face.weight, italic: face.italic, license: face.license, data: Uint8Array.from(atob(face.dataUrl.split(',')[1]), character => character.charCodeAt(0)) })), substitutionPolicy: 'visual', fallbackFamily: 'Roboto', scriptBaseUrl: './script-fonts/', lazyFontsBaseUrl: new URL('./', document.baseURI).href });
const editor = createEditorSession({ name: 'Canvas fonts', design: { theme: 'classic', fontScheme: 'roboto' }, slides: [
  { id: 'one', title: 'Quarterly review', text: 'Sales grew twelve percent.' },
  { id: 'two', title: 'Second slide', text: 'More detail follows.' },
] }, { rejectInvalid: true, catalogs: [defaultCatalog] });
const events = [], errors = [];
// FF-41: a layout only a host catalog knows, passed to the canvas as renderOptions.catalogs; the canvas merges it after the
// session's registered catalogs and hands that one list to the gate (OPF 0.15: decks name it as host:host-bullets).
const host = { source: 'pkg:host', layouts: { 'host-bullets': { ...defaultCatalog.layouts['list-1x'], name: 'Host bullets' } } };
const renderOptions = { catalogs: [host] };
const pending = document => fonts.pending(document, { catalogs: [defaultCatalog, host] });
const canvas = createCanvasEditor(document.getElementById('canvas'), { editor, fonts, renderOptions,
  onFonts: event => events.push(event.state), onError: error => errors.push(error.message) });
window.harness = { editor, canvas, switchDimension, fonts, pending, events, errors };
`;
await build({ stdin: { contents: source, resolveDir: repo, loader: 'js' }, outfile: path.join(output, 'harness.js'), bundle: true, platform: 'browser', format: 'esm', minify: false, logLevel: 'error' });
const page = (script) => `<!doctype html><meta charset="utf-8"><title>Canvas fonts</title><div id="canvas" style="width:960px"></div><script type="module" src="./harness.js"></script>`;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.ttf': 'font/ttf' };
const faceRequests = [], requests = [];
let failFaces = false;
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/favicon.ico') { res.writeHead(204).end(); return; }
    if (url.pathname === '/' || url.pathname === '/index.html') { res.writeHead(200, { 'Content-Type': 'text/html' }).end(page()); return; }
    const root = url.pathname === '/harness.js' ? output : playground;
    const target = path.resolve(root, '.' + decodeURIComponent(url.pathname));
    if (path.relative(root, target).startsWith('..')) { res.writeHead(403).end(); return; }
    if (/^\/(script-fonts|fonts)\//.test(url.pathname)) {
      faceRequests.push(url.pathname);
      // A slow face makes the loading state observable: the canvas must not draw during this wait.
      await new Promise(resolve => setTimeout(resolve, 350));
      if (failFaces) { res.writeHead(503).end(); return; }
    }
    const body = await readFile(target);
    res.writeHead(200, { 'Content-Type': types[path.extname(target)] ?? 'application/octet-stream' }).end(body);
  } catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser = await chromium.launch({ channel: process.platform === 'win32' && !process.env.CI ? 'msedge' : undefined });
  const tab = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  const problems = [];
  tab.on('pageerror', error => problems.push(`pageerror: ${error.message}`));
  tab.on('console', message => { if (message.type() === 'error' && !/status of 503/.test(message.text())) problems.push(`console: ${message.text()}`); });
  tab.on('request', request => { if (/^https?:/.test(request.url())) requests.push(request.url()); });
  await tab.route(/^https?:/, route => route.request().url().startsWith(base) ? route.continue() : (problems.push(`blocked: ${route.request().url()}`), route.abort()));
  await tab.addInitScript(() => {
    window.__seen = { bad: [], loading: 0, drawn: [] };
    const watch = () => {
      const canvas = document.getElementById('canvas');
      if (!canvas) { requestAnimationFrame(watch); return; }
      new MutationObserver(() => {
        const text = canvas.textContent;
        if (/cannot display|Preview unavailable|missing-glyph/.test(text)) window.__seen.bad.push(text.slice(0, 200));
        if (/Loading fonts/.test(text)) window.__seen.loading++;
      }).observe(canvas, { childList: true, subtree: true, characterData: true });
    };
    watch();
  });
  await tab.goto(`${base}/index.html`);
  await tab.locator('#canvas svg').waitFor();
  const run = (fn, arg) => tab.evaluate(fn, arg);
  const settle = () => tab.waitForFunction(() => document.querySelector('#canvas svg') && !document.querySelector('.opf-canvas-fonts') && window.harness.pending(window.harness.editor.presentation).length === 0, undefined, { timeout: 60000 });
  const state = () => run(() => ({
    runs: [...document.querySelectorAll('#canvas svg text')].map(node => ({ text: node.textContent, family: (node.getAttribute('font-family') ?? node.closest('[font-family]')?.getAttribute('font-family') ?? '').split(',').map(part => part.trim().replace(/^"|"$/g, '')) })),
    loaded: [...document.fonts].filter(face => face.status === 'loaded').map(face => face.family.replace(/^"|"$/g, '')),
    seen: window.__seen, events: [...window.harness.events], errors: [...window.harness.errors],
  }));
  let now0;
  const clean = async (name) => {
    const now = await state();
    assert.deepEqual(now.seen.bad, [], `${name}: the canvas never showed an unavailable or cannot-display state`);
    assert.deepEqual(now.errors, [], `${name}: the canvas reported no error`);
    return now;
  };
  assert.deepEqual(await run(() => window.harness.pending(window.harness.editor.presentation)), [], 'a Roboto document has nothing pending');

  // FF-41: a deck whose layout exists only in the host's catalogs (the canvas's renderOptions) loads exactly the faces it draws:
  // Raleway Regular for the body and Raleway Bold for the title, not the four Raleway files, and nothing is drawn before they load.
  const catalogBefore = faceRequests.length;
  const catalogPending = await run(() => { window.harness.editor.applyPatch([{ op: 'replace', path: '', value: { name: 'Host layout', catalogs: { host: { source: 'pkg:host' } }, design: { theme: 'classic', fontScheme: 'raleway' }, slides: [{ id: 'a', layout: 'host:host-bullets', title: 'Quarterly review', items: ['Sales grew twelve percent.'] }] } }]); return window.harness.pending(window.harness.editor.presentation); });
  assert.deepEqual(catalogPending.map(file => file.split('/').pop()).sort(), ['Raleway-Bold.ttf', 'Raleway-Regular.ttf'], `the catalog-only layout resolves and needs two Raleway faces: ${catalogPending}`);
  assert.equal(await tab.locator('#canvas svg').count(), 0, 'the host-layout deck is not drawn before its faces load');
  await settle();
  now0 = await clean('catalog-only layout');
  assert.deepEqual(faceRequests.slice(catalogBefore).map(url => url.split('/').pop()).sort(), ['Raleway-Bold.ttf', 'Raleway-Regular.ttf'], 'face level: only the drawn Raleway faces are fetched');
  assert.ok(now0.runs.length > 0 && now0.runs.every(run => run.family[0] === 'Raleway'), JSON.stringify(now0.runs.map(run => run.family[0])));
  // An italic run added by an edit fetches just the italic face.
  const italicBefore = faceRequests.length;
  await run(() => { window.harness.editor.applyPatch([{ op: 'replace', path: '', value: { name: 'Host layout', catalogs: { host: { source: 'pkg:host' } }, design: { theme: 'classic', fontScheme: 'raleway' }, slides: [{ id: 'a', layout: 'host:host-bullets', title: 'Quarterly review', text: ['Sales grew ', { text: 'twelve', italic: true }, ' percent.'] }] } }]); });
  await settle();
  await clean('italic edit');
  assert.deepEqual(faceRequests.slice(italicBefore).map(url => url.split('/').pop()), ['Raleway-Italic.ttf'], 'the italic edit fetched just the italic face');

  // Han-only text draws with the face of the deck's language (Korean here). A language switch (a dimension switch) to Japanese
  // then needs another face: it loads before the canvas draws.
  await run(() => window.harness.editor.applyPatch([{ op: 'replace', path: '', value: { name: 'Han', language: 'ko', design: { theme: 'classic', fontScheme: 'roboto' }, slides: [{ id: 'a', title: '漢字', text: '漢字' }] } }]));
  await settle();
  assert.ok((await state()).loaded.includes('Noto Sans KR'), 'Han text in a Korean deck loads Noto Sans KR');
  const before = faceRequests.length;
  const pendingAfterSwitch = await run(() => { window.harness.switchDimension(window.harness.editor, 'languages', 'ja'); return window.harness.pending(window.harness.editor.presentation); });
  assert.ok(pendingAfterSwitch.length > 0, 'the language switch left script faces pending');
  assert.equal(await tab.locator('#canvas svg').count(), 0, 'the canvas did not draw the document while its faces were pending');
  assert.match(await tab.locator('.opf-canvas-fonts').innerText(), /Loading fonts/);
  await settle();
  let now = await clean('language switch');
  assert.ok(now.loaded.includes('Noto Sans JP'), `Noto Sans JP loaded: ${now.loaded}`);
  assert.ok(faceRequests.slice(before).some(url => /noto-sans-jp/.test(url)));
  assert.ok(now.seen.loading > 0 && now.events.includes('loading') && now.events.at(-1) === 'ready');

  // Aptos with Japanese text, applied as one patch (the reported case): vendored Intos and the script face both load first.
  await run(() => window.harness.editor.applyPatch([{ op: 'replace', path: '', value: { name: 'Aptos ja', language: 'ja', design: { theme: 'classic', fontScheme: 'aptos' }, slides: [{ id: 'a', title: '四半期レビュー 12%', text: '売上は前年同期比で12%増加しました。' }, { id: 'b', title: '第二のスライド', text: '日本語の本文です。' }] } }]));
  assert.equal(await tab.locator('#canvas svg').count(), 0, 'no slide is drawn before Intos and the Japanese face are loaded');
  await settle();
  now = await clean('Aptos with Japanese');
  assert.ok(now.loaded.includes('Intos') && now.loaded.includes('Noto Sans JP'));
  assert.match(now.runs.map(run => run.text).join(' '), /四半期レビュー/);
  // Slide navigation on the loaded document draws at once.
  assert.equal(await run(() => { window.harness.canvas.setSlide(1); return document.querySelectorAll('#canvas svg text').length > 0; }), true);
  assert.match((await state()).runs.map(run => run.text).join(' '), /第二のスライド/);

  // Font scheme switches to lazy families: Open Sans (catalog id) and Barlow (a record carried with the switch).
  await run(() => window.harness.editor.applyPatch([{ op: 'replace', path: '', value: { name: 'Latin', design: { theme: 'classic', fontScheme: 'roboto' }, slides: [{ id: 'a', title: 'Quarterly review', text: 'Sales grew twelve percent.' }] } }]));
  await settle();
  const pendingOpenSans = await run(() => { window.harness.switchDimension(window.harness.editor, 'font-schemes', 'open-sans'); return window.harness.pending(window.harness.editor.presentation); });
  assert.ok(pendingOpenSans.some(file => /open-sans/.test(file)), `Open Sans is pending: ${pendingOpenSans}`);
  await settle();
  now = await clean('font scheme Open Sans');
  assert.ok(now.runs.length > 0 && now.runs.every(run => run.family[0] === 'Open Sans'), JSON.stringify(now.runs.map(run => run.family[0])));
  const pendingBarlow = await run(() => { window.harness.switchDimension(window.harness.editor, 'font-schemes', 'barlow-preview', { record: { id: 'barlow-preview', name: 'Barlow', major: 'Barlow', minor: 'Barlow' } }); return window.harness.pending(window.harness.editor.presentation); });
  assert.ok(pendingBarlow.some(file => /barlow/.test(file)), `Barlow is pending: ${pendingBarlow}`);
  await settle();
  now = await clean('font scheme Barlow');
  assert.ok(now.runs.length > 0 && now.runs.every(run => run.family[0] === 'Barlow'), JSON.stringify(now.runs.map(run => run.family[0])));

  // Undo and redo to states whose faces are pending. Files fail while the deck switches to Poppins: nothing draws, the failure
  // is reported once and not retried; a switch back draws; Undo returns to the Poppins state (still pending) and loads it.
  failFaces = true;
  const failedAt = faceRequests.length;
  await run(() => window.harness.switchDimension(window.harness.editor, 'font-schemes', 'poppins'));
  await tab.waitForFunction(() => document.querySelector('.opf-canvas-fonts button'), undefined, { timeout: 60000 });
  assert.match(await tab.locator('.opf-canvas-fonts').innerText(), /could not be loaded/);
  assert.equal(await tab.locator('#canvas svg').count(), 0, 'a document whose faces failed to load is not drawn');
  await tab.waitForTimeout(500);
  const attempts = faceRequests.length - failedAt;
  await tab.waitForTimeout(700);
  assert.equal(faceRequests.length - failedAt, attempts, 'a failed load is not retried by itself');
  failFaces = false;
  await run(() => window.harness.switchDimension(window.harness.editor, 'font-schemes', 'roboto'));
  await settle();
  assert.ok((await state()).runs.every(run => run.family[0] === 'Roboto'));
  await run(() => window.harness.editor.undo());
  assert.equal(await tab.locator('#canvas svg').count(), 0, 'Undo to a pending document does not draw it early');
  await settle();
  now = await state();
  assert.ok(now.runs.length > 0 && now.runs.every(run => run.family[0] === 'Poppins'), `Undo loaded and drew Poppins: ${JSON.stringify(now.runs.map(run => run.family[0]))}`);
  await run(() => window.harness.editor.redo());
  await settle();
  assert.ok((await state()).runs.every(run => run.family[0] === 'Roboto'));
  assert.deepEqual((await state()).seen.bad, []);
  // The retry button: fail once more, then retry with the files back.
  failFaces = true;
  await run(() => window.harness.switchDimension(window.harness.editor, 'font-schemes', 'montserrat'));
  await tab.waitForFunction(() => document.querySelector('.opf-canvas-fonts button'), undefined, { timeout: 60000 });
  failFaces = false;
  await tab.locator('.opf-canvas-fonts button').click();
  await settle();
  now = await state();
  assert.ok(now.runs.length > 0 && now.runs.every(run => run.family[0] === 'Montserrat'), 'Retry loads Montserrat and draws it');
  assert.equal(now.events.at(-1), 'ready');

  // An in-progress edit that needs a script face waits for it, draws, and commits.
  await run(() => window.harness.switchDimension(window.harness.editor, 'font-schemes', 'roboto'));
  await settle();
  await run(() => window.harness.editor.applyPatch([{ op: 'replace', path: '', value: { name: 'Draft', design: { theme: 'classic', fontScheme: 'roboto' }, slides: [{ id: 'a', title: 'Quarterly review', text: 'Sales grew twelve percent.' }] } }]));
  await settle();
  await tab.locator('#canvas [data-canvas-target][data-opf-path="slides.0.title"]').dblclick();
  const input = tab.getByRole('textbox', { name: 'Edit title inline', exact: true });
  const draftBefore = faceRequests.length;
  await input.fill('สวัสดีชาวโลก');
  await tab.waitForFunction(() => [...document.fonts].some(face => face.family.replace(/"/g, '') === 'Noto Sans Thai' && face.status === 'loaded') && [...document.querySelectorAll('#canvas svg text')].some(node => node.textContent.includes('สวัสดี')), undefined, { timeout: 60000 });
  assert.ok(faceRequests.slice(draftBefore).some(url => /noto-sans-thai/.test(url)), 'the draft fetched the Thai face');
  assert.equal(await run(() => window.harness.canvas.commit()), true, 'the draft commits once its faces are loaded');
  await tab.waitForFunction(() => window.harness.editor.presentation.slides[0].title === 'สวัสดีชาวโลก', undefined, { timeout: 60000 });
  now = await state();
  assert.deepEqual(now.seen.bad, [], 'in-progress edit: the canvas never showed a cannot-display state');
  assert.equal(now.errors.length, 2, 'only the two deliberate load failures were reported');
  assert.ok(now.errors.every(message => /could not be loaded/.test(message)));

  assert.deepEqual(problems, [], 'no page errors, console errors or blocked requests');
  assert.ok(requests.length > 0 && requests.every(url => url.startsWith(base)), 'every request stayed on the local server');
  console.log(`Canvas fonts: language and font-scheme switches, Aptos with Japanese, undo/redo to pending faces, retry and drafts all load faces before the canvas draws; ${requests.length} requests, all local.`);
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
