import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const axeSource = readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');

// RR-22 in a real browser, on the built playground (npm run build:playground): autosave to IndexedDB, the restore prompt after a reload
// (with the undo history), discard, an ignored prompt followed by edits, the unsaved-changes warning, a host that loads a document, the
// unavailable and full storage notes, and the accessibility contract of the prompt. Nothing leaves the browser: the test also fails if the
// page makes a request to anything but the local server.
const root = fileURLToPath(new URL('../artifacts/playground/', import.meta.url));
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.ttf': 'font/ttf' };
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/favicon.ico') { res.writeHead(204).end(); return; }
    const target = path.resolve(root, '.' + decodeURIComponent(url.pathname));
    const relative = path.relative(root, target);
    if (relative.startsWith('..') || path.isAbsolute(relative)) { res.writeHead(403).end(); return; }
    const body = await readFile(target);
    res.writeHead(200, { 'Content-Type': types[path.extname(target)] ?? 'application/octet-stream' }).end(body);
  } catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;

const edited = title => ({
  name: 'Autosaved deck',
  language: 'english',
  design: { theme: 'classic', fontScheme: 'roboto' },
  slides: [{ id: 'one', title, text: 'First' }, { id: 'two', title: 'Second', text: 'Second words' }],
});

let browser;
const checks = [];
const requests = [];
try {
  browser = await chromium.launch({ channel: process.platform === 'win32' && !process.env.CI ? 'msedge' : undefined });
  const mark = name => checks.push(name);
  const settle = page => page.waitForFunction(() => !/Loading fonts/.test(document.querySelector('#status').textContent) && !document.querySelector('#preview')?.textContent.includes('Loading fonts'), undefined, { timeout: 60000 });
  const doc = async page => JSON.parse(await page.locator('#json').inputValue());
  const titles = async page => (await doc(page)).slides.map(slide => slide.title);
  const errorsOf = page => { const errors = []; page.on('pageerror', error => errors.push(error.stack ?? error.message)); page.on('console', message => { if (message.type() === 'error' && !/Failed to load resource/.test(message.text())) errors.push(message.text()); }); return errors; };
  const watchRequests = page => page.on('request', request => { if (!request.url().startsWith(origin) && !request.url().startsWith('data:') && !request.url().startsWith('blob:')) requests.push(request.url()); });
  const open = async (context, query = '') => {
    const page = await context.newPage();
    watchRequests(page);
    const errors = errorsOf(page);
    await page.goto(`${origin}/index.html${query}`);
    await page.locator('#preview svg').waitFor();
    await settle(page);
    return { page, errors };
  };
  // Replace the document through the Source dialog, the way a person would (a real click, so the change is the user's).
  const applySource = async (page, deck) => {
    await page.getByRole('button', { name: 'Source', exact: true }).click();
    await page.locator('#json').fill(JSON.stringify(deck));
    await page.waitForFunction(() => !document.querySelector('#apply-json').disabled && !document.querySelector('#json-error').textContent);
    await page.getByRole('button', { name: 'Apply changes', exact: true }).click();
    await page.waitForFunction(() => !document.querySelector('#source-dialog').open);
    await settle(page);
  };
  const saved = page => page.waitForFunction(() => /Saved on this device at/.test(document.querySelector('#autosave-status').textContent), undefined, { timeout: 10000 });
  const stored = page => page.evaluate(() => new Promise((resolve, reject) => {
    const request = indexedDB.open('opf-editor', 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const transaction = request.result.transaction('documents', 'readonly');
      const keys = transaction.objectStore('documents').getAllKeys();
      const values = transaction.objectStore('documents').getAll();
      transaction.oncomplete = () => { request.result.close(); resolve(keys.result.map((key, index) => ({ key, record: values.result[index] }))); };
    };
  }));
  const unload = async page => page.evaluate(() => { const event = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(event); return event.defaultPrevented; });
  const banner = page => page.locator('#restore-banner');
  // axe-core on one part of the page: no WCAG 2.x A/AA or best-practice violation (contrast included).
  const axe = async (page, include, name) => {
    await page.addScriptTag({ content: axeSource }).catch(() => {});
    const result = await page.evaluate(selectors => window.axe.run({ include: selectors.map(selector => [selector]) }, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] } }), include);
    const found = result.violations.map(violation => `${violation.id} (${violation.nodes.length}): ${violation.nodes.slice(0, 3).map(node => node.target.join(' ')).join(' | ')}`);
    assert.deepEqual(found, [], `${name}: axe violations`);
    mark(`axe: ${name}`);
  };

  // --- autosave and restore across a reload ------------------------------------------------------------------------
  const context = await browser.newContext();
  let { page, errors } = await open(context);
  const defaultTitles = await titles(page);
  assert.equal(await page.locator('#autosave-status').textContent(), 'Changes stay in this session.Save an OPF file to keep your work.', 'before anything is stored the footer keeps its original text');
  assert.equal(await banner(page).isHidden(), true, 'no prompt without a stored copy');
  assert.equal((await stored(page)).length, 0, 'opening the editor writes nothing');
  await applySource(page, edited('Edited once'));
  await page.locator('#preview [data-opf-path="slides.0.title"]').first().click();
  await saved(page);
  const afterSave = await stored(page);
  assert.equal(afterSave.length, 1);
  assert.equal(afterSave[0].key, 'opf-editor/v1/opf-editor-playground');
  assert.equal(afterSave[0].record.document.slides[0].title, 'Edited once');
  assert.equal(afterSave[0].record.dirty, true);
  assert.ok(afterSave[0].record.undo.length >= 1, 'the undo history is stored too');
  assert.match(await page.locator('#autosave-status').textContent(), /Save an OPF file to keep a copy\.$/);
  mark('autosave writes the document and its history, debounced, after a change');
  assert.equal(await unload(page), true, 'unsaved changes warn before the page closes');
  mark('unsaved changes set the beforeunload warning');
  await page.close();

  ({ page, errors } = await open(context));
  assert.deepEqual(await titles(page), defaultTitles, 'a reload starts from the default document, the copy is only offered');
  await banner(page).waitFor();
  assert.equal(await banner(page).getAttribute('role'), 'region');
  assert.equal(await banner(page).getAttribute('aria-label'), 'Restore your work');
  assert.match(await banner(page).locator('.restore-text').textContent(), /You have unsaved work from .* \(2 slides\), kept in this browser\. Restore it\?/);
  assert.equal(await page.evaluate(() => document.activeElement === document.body || document.activeElement.tagName === 'BODY'), true, 'the prompt does not take focus');
  assert.equal(await unload(page), false, 'an offered copy is not the page\'s own unsaved change');
  // Keyboard: Tab reaches Restore, Enter restores.
  await page.locator('#restore-banner .restore-yes').focus();
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.querySelector('#restore-banner').hidden);
  await settle(page);
  assert.deepEqual(await titles(page), ['Edited once', 'Second'], 'Restore puts the stored copy back');
  assert.equal(await page.getByRole('button', { name: 'Undo', exact: true }).isEnabled(), true, 'and its undo history');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await settle(page);
  assert.deepEqual(await titles(page), defaultTitles, 'one Undo goes back to the document before the Source Apply');
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await settle(page);
  assert.equal(await unload(page), true, 'restored unsaved work is still unsaved');
  mark('Restore brings back the copy with its undo history, from the keyboard');
  assert.deepEqual(errors, []);
  await page.close();

  // The stored copy equals the restored document: nothing to offer.
  ({ page, errors } = await open(context));
  await page.waitForTimeout(400);
  assert.equal(await banner(page).isHidden(), false, 'a copy that differs from the default is still offered');
  await page.close();

  // --- save as a file clears the warning; a saved copy is offered with its own wording --------------------------------
  ({ page, errors } = await open(context));
  await banner(page).waitFor();
  await page.getByRole('button', { name: 'Restore', exact: true }).click();
  await settle(page);
  assert.equal(await unload(page), true);
  const downloaded = page.waitForEvent('download');
  await page.locator('#download').click();
  await downloaded;
  assert.equal(await unload(page), false, 'Save OPF clears the unsaved-changes warning');
  await page.waitForFunction(async () => { const request = indexedDB.open('opf-editor', 1); return await new Promise(resolve => { request.onsuccess = () => { const get = request.result.transaction('documents').objectStore('documents').getAll(); get.onsuccess = () => { request.result.close(); resolve(get.result.every(record => record.dirty === false)); }; }; }); }, undefined, { timeout: 10000 });
  await page.getByRole('button', { name: 'Source', exact: true }).click();
  await page.locator('#json').fill(JSON.stringify(edited('After saving')));
  await page.waitForFunction(() => !document.querySelector('#apply-json').disabled);
  await page.getByRole('button', { name: 'Apply changes', exact: true }).click();
  await page.waitForFunction(() => !document.querySelector('#source-dialog').open);
  assert.equal(await unload(page), true, 'a change after saving is unsaved again');
  mark('Save OPF is a save: the warning clears and the stored copy says so');
  await page.close();

  // --- discard ----------------------------------------------------------------------------------------------------
  ({ page, errors } = await open(context));
  await banner(page).waitFor();
  await page.getByRole('button', { name: 'Discard copy', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('#restore-banner').hidden);
  assert.deepEqual(await titles(page), defaultTitles);
  assert.equal((await stored(page)).length, 0, 'Discard deletes the stored copy');
  await page.close();
  ({ page, errors } = await open(context));
  await page.waitForTimeout(400);
  assert.equal(await banner(page).isHidden(), true, 'nothing is offered after a discard');
  mark('Discard deletes the stored copy');

  // --- ignoring the prompt and editing keeps the stored copy ---------------------------------------------------------
  await applySource(page, edited('First session'));
  await saved(page);
  await page.close();
  ({ page, errors } = await open(context));
  await banner(page).waitFor();
  await applySource(page, edited('Typed while the prompt was open'));
  await page.waitForFunction(async () => { const request = indexedDB.open('opf-editor', 1); return await new Promise(resolve => { request.onsuccess = () => { const keys = request.result.transaction('documents').objectStore('documents').getAllKeys(); keys.onsuccess = () => { request.result.close(); resolve(keys.result.some(key => String(key).endsWith('#earlier'))); }; }; }); }, undefined, { timeout: 10000 });
  assert.equal(await banner(page).isHidden(), false, 'the prompt stays until the person decides');
  // The offered copy is restored on request, as one undo step.
  await page.getByRole('button', { name: 'Restore', exact: true }).click();
  await settle(page);
  assert.deepEqual(await titles(page), ['First session', 'Second']);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await settle(page);
  assert.deepEqual(await titles(page), ['Typed while the prompt was open', 'Second'], 'Undo returns to what was typed while the prompt was open');
  await page.close();
  mark('an ignored prompt followed by edits never loses the stored copy');

  // --- a host that loads a document is not the user's work -------------------------------------------------------
  const hostContext = await browser.newContext();
  ({ page, errors } = await open(hostContext));
  await applySource(page, edited('Real work'));
  await saved(page);
  await page.close();
  ({ page, errors } = await open(hostContext));
  await banner(page).waitFor();
  // The gallery clicks #apply-json from script after filling #json.
  await page.evaluate(deck => { document.querySelector('#json').value = JSON.stringify(deck); document.querySelector('#apply-json').click(); }, edited('Gallery layout'));
  await page.waitForFunction(() => document.querySelector('#slide-title').textContent === 'Gallery layout');
  await settle(page);
  assert.equal(await unload(page), false, 'a document loaded by the host is not unsaved work');
  await page.waitForTimeout(1500);
  const afterHandoff = await stored(page);
  assert.equal(afterHandoff[0].record.document.slides[0].title, 'Real work', 'and it does not overwrite the stored copy');
  await page.close();
  mark('a document loaded by the host (the gallery handoff) is neither autosaved nor warned about');

  // --- opting out and separate keys ---------------------------------------------------------------------------------
  ({ page, errors } = await open(hostContext, '?persist=0'));
  await applySource(page, edited('Not stored'));
  await page.waitForTimeout(1200);
  assert.equal(await unload(page), false, 'persistence is off with ?persist=0');
  assert.match(await page.locator('#autosave-status').textContent(), /Changes stay in this session/);
  await page.close();
  ({ page, errors } = await open(hostContext, '?persist=another-document'));
  await page.waitForTimeout(400);
  assert.equal(await banner(page).isHidden(), true, 'another key has its own copy');
  await page.close();
  mark('?persist=0 turns it off and ?persist=<key> separates documents');
  await hostContext.close();

  // --- the real beforeunload dialog -----------------------------------------------------------------------------------
  const dialogContext = await browser.newContext();
  ({ page, errors } = await open(dialogContext));
  const kinds = [];
  page.on('dialog', async dialog => { kinds.push(dialog.type()); await dialog.accept(); });
  await page.locator('#preview [data-opf-path]').first().click();
  await applySource(page, edited('Leaving'));
  const closed = page.waitForEvent('close', { timeout: 10000 });
  await page.close({ runBeforeUnload: true });
  await closed;
  assert.deepEqual([...kinds], ['beforeunload'], 'closing a page with unsaved changes asks first');
  // A page with nothing unsaved closes without asking.
  const quiet = await dialogContext.newPage();
  const quietKinds = [];
  quiet.on('dialog', async dialog => { quietKinds.push(dialog.type()); await dialog.accept(); });
  await quiet.goto(`${origin}/index.html?persist=quiet`);
  await quiet.locator('#preview svg').waitFor();
  await quiet.locator('#preview [data-opf-path]').first().click();
  const quietClosed = quiet.waitForEvent('close', { timeout: 10000 });
  await quiet.close({ runBeforeUnload: true });
  await quietClosed;
  assert.deepEqual([...quietKinds], [], 'closing an unchanged page does not ask');
  mark('the browser\'s own leave-page prompt appears for unsaved changes');
  await dialogContext.close();

  // --- storage that is unavailable ------------------------------------------------------------------------------------
  const blockedContext = await browser.newContext();
  await blockedContext.addInitScript(() => {
    for (const name of ['indexedDB', 'localStorage']) Object.defineProperty(window, name, { get() { throw new DOMException('The operation is insecure.', 'SecurityError'); }, configurable: true });
  });
  ({ page, errors } = await open(blockedContext));
  await page.waitForFunction(() => /Autosave is off|not available/.test(document.querySelector('#autosave-status').textContent), undefined, { timeout: 10000 });
  const note = await page.locator('#autosave-status').textContent();
  assert.match(note, /download it to keep it/, 'the note says how to keep the work');
  assert.match(note, /Save an OPF file to keep a copy\.$/);
  assert.equal(await page.locator('#autosave-status').getAttribute('data-state'), 'unavailable');
  await applySource(page, edited('Works without storage'));
  assert.deepEqual(await titles(page), ['Works without storage', 'Second'], 'the editor works');
  assert.equal(await unload(page), true, 'and still warns before leaving with unsaved changes');
  assert.deepEqual(errors, [], 'blocked storage raises no errors');
  await page.close();
  mark('private mode or blocked storage degrades with a visible note');
  await blockedContext.close();

  // --- storage that is full ----------------------------------------------------------------------------------------------
  const fullContext = await browser.newContext();
  await fullContext.addInitScript(() => {
    window.OPF_EDITOR_HOST = { persistence: { key: 'full', storage: { get: async () => undefined, delete: async () => {}, set: async () => { throw Object.assign(new Error('The quota has been exceeded.'), { name: 'QuotaExceededError' }); } } } };
  });
  ({ page, errors } = await open(fullContext));
  await applySource(page, edited('Too big'));
  await page.waitForFunction(() => /storage is full/.test(document.querySelector('#autosave-status').textContent), undefined, { timeout: 10000 });
  assert.equal(await page.locator('#autosave-status').getAttribute('data-state'), 'error');
  assert.deepEqual(errors, []);
  await page.close();
  mark('a full store reports it and the editor keeps working');
  await fullContext.close();

  // --- accessibility of the prompt ------------------------------------------------------------------------------------------
  const a11y = await browser.newContext();
  ({ page, errors } = await open(a11y));
  await applySource(page, edited('For the prompt'));
  await saved(page);
  await page.close();
  ({ page, errors } = await open(a11y));
  await banner(page).waitFor();
  const unnamed = await page.evaluate(() => [...document.querySelectorAll('#restore-banner button')].filter(button => !button.textContent.trim() && !button.getAttribute('aria-label')).length);
  assert.equal(unnamed, 0, 'the prompt buttons have names');
  const snapshot = await banner(page).ariaSnapshot();
  assert.match(snapshot, /region "Restore your work"/);
  assert.match(snapshot, /button "Restore"/);
  assert.match(snapshot, /button "Discard copy"/);
  await axe(page, ['#restore-banner', '#autosave-status'], 'restore prompt and autosave status');
  assert.equal(await page.locator('#restore-banner ~ .sr-only[role="status"], .restore-banner + .sr-only[role="status"]').count() >= 1, true, 'the offer is announced in a polite live region');
  mark('the restore prompt is a labelled region with named buttons and a live announcement');
  await page.close();
  await a11y.close();
  await context.close();

  assert.deepEqual(requests, [], 'autosave and restore make no network requests');
  mark('nothing leaves the browser');
} finally {
  await browser?.close();
  server.close();
}
console.log(`RR-22 browser: ${checks.length} checks ok`);
