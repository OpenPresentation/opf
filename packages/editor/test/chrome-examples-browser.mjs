import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

// CE-30: the runnable chrome examples (examples/chrome, built by `pnpm run build:chrome-examples` into artifacts/chrome-examples) in a real
// browser. Each page mounts, its signature feature works, and nothing logs an error: the embed's outside label follows a rename; the viewer is
// read-only and downloads a real PPTX from the host's action; Ctrl+S in the full layout fires `save`, the host stores it and `markSaved()` clears
// `dirty`; the own-header page holds the toolbar items in its header and expands over it; the headless page's buttons drive the handle; the React
// hooks follow the deck name and `dirty`; the element dispatches `opf-deck-name`; the styled page's tokens, CSS and icons change what is drawn.
const root = path.resolve(process.env.OPF_CHROME_EXAMPLES_OUT ?? fileURLToPath(new URL('../artifacts/chrome-examples/', import.meta.url)));
assert.ok(existsSync(path.join(root, 'index.html')), `${root} is not built. Run \`pnpm run build:chrome-examples\` first.`);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.ttf': 'font/ttf', '.otf': 'font/otf', '.woff2': 'font/woff2' };
const server = createServer(async (req, res) => {
  try {
    const target = path.resolve(root, `.${decodeURIComponent(new URL(req.url, 'http://localhost').pathname)}`);
    const relative = path.relative(root, target);
    if (relative.startsWith('..') || path.isAbsolute(relative)) { res.writeHead(403).end(); return; }
    const body = await readFile(target);
    res.writeHead(200, { 'Content-Type': types[path.extname(target)] ?? 'application/octet-stream' }).end(body);
  } catch { res.writeHead(404).end(); }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ channel: process.platform === 'win32' && !process.env.CI ? 'msedge' : undefined });

const checks = [];
const mark = (name) => checks.push(name);
const allErrors = [];

// A fresh context per page (its own localStorage), the page's errors collected, and the editor waited for.
async function open(name, { viewport = { width: 1100, height: 900 }, wait = 'editor', ...context } = {}) {
  const browserContext = await browser.newContext({ viewport, acceptDownloads: true, ...context });
  const page = await browserContext.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(`${name}: ${error.stack ?? error.message}`));
  page.on('console', (message) => { if (message.type() === 'error' && !/Failed to load resource/.test(message.text())) errors.push(`${name}: ${message.text()}`); });
  page.on('response', (response) => { if (response.status() >= 400 && !/favicon/.test(response.url())) errors.push(`${name}: ${response.status()} ${response.url()}`); });
  await page.goto(`${origin}/${name}.html`);
  if (wait === 'editor') await page.evaluate(() => window.editor.ready);
  else if (wait === 'element') await page.waitForFunction(() => document.querySelector('#hero')?.dataset.opfState === 'ready', undefined, { timeout: 30000 });
  else if (wait === 'react') await page.waitForFunction(() => document.querySelector('.opf-workspace .opf-canvas svg'), undefined, { timeout: 30000 });
  if (wait !== 'none') await page.locator('.opf-canvas svg').first().waitFor({ timeout: 30000 });
  return { page, errors, async close() { allErrors.push(...errors); await browserContext.close(); } };
}
const visibleItems = (page, scope = '') => page.evaluate((selector) => [...document.querySelector(`${selector} .opf-tb`.trim()).children].filter((node) => !node.hidden && node.getBoundingClientRect().width > 0).map((node) => node.dataset.opfToolbarItem), scope);

try {
  // ---- index: links to every example, each of which exists -------------------------------------------------------------------------------
  {
    const index = await open('index', { wait: 'none' });
    const links = await index.page.evaluate(() => [...document.querySelectorAll('nav.index a')].map((link) => link.getAttribute('href')));
    assert.deepEqual(links, ['./embed.html', './viewer.html', './full.html', './own-header.html', './headless.html', './react.html', './element.html', './styled.html']);
    for (const link of links) assert.ok(existsSync(path.join(root, link)), `${link} is built`);
    await index.close();
    mark('the index links to the eight examples, all of them built');
  }

  // ---- A. embed: a 720x420 card, the deck name outside ---------------------------------------------------------------------------------------
  {
    const { page, close } = await open('embed');
    const size = await page.evaluate(() => { const card = document.querySelector('#card').getBoundingClientRect(); return { width: Math.round(card.width), height: Math.round(card.height) }; });
    assert.deepEqual(size, { width: 720, height: 420 });
    assert.deepEqual(await visibleItems(page), ['title', 'history', 'counter', 'spacer', 'design', 'expand', 'present']);
    assert.equal(await page.locator('#deck-name').textContent(), 'Quarterly review');
    await page.locator('#card .opf-title-input').fill('Hero deck');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.querySelector('#deck-name').textContent === 'Hero deck');
    assert.equal(await page.evaluate(() => window.editor.getDocument().name), 'Hero deck');
    // An undo from the host's side reaches the outside label too: the event comes from the document, not from the field.
    await page.evaluate(() => window.editor.undo());
    await page.waitForFunction(() => document.querySelector('#deck-name').textContent === 'Quarterly review');
    await close();
    mark('embed: a 720x420 card with the embed bar, and a rename (and an undo) reaches the label outside through the deckName event');
  }

  // ---- viewer: read-only, Present and Expand, a host action that downloads a PPTX ----------------------------------------------------------
  {
    const { page, close } = await open('viewer');
    assert.equal(await page.evaluate(() => window.editor.readOnly), true);
    assert.deepEqual(await visibleItems(page), ['title', 'counter', 'spacer', 'actions', 'present', 'expand']);
    assert.equal(await page.locator('#viewer .opf-title').getAttribute('data-state'), 'readonly');
    assert.equal(await page.locator('#viewer [data-opf-action=undo]').count(), 0, 'a viewer has no Undo');
    assert.equal(await page.locator('#viewer .opf-actions-button[data-action=download]').textContent().then((text) => text.trim()), 'Download PPTX');
    const before = await page.evaluate(() => JSON.stringify(window.editor.getDocument()));
    assert.equal(await page.evaluate(() => window.editor.setDeckName('Changed')), false, 'the viewer refuses a rename');
    assert.equal(await page.evaluate(() => JSON.stringify(window.editor.getDocument())), before);
    const [download] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), page.locator('#viewer .opf-actions-button[data-action=download]').click()]);
    assert.equal(download.suggestedFilename(), 'Quarterly review.pptx');
    const bytes = await readFile(await download.path());
    assert.equal(bytes.subarray(0, 2).toString('latin1'), 'PK', 'a PPTX is a zip');
    assert.ok(bytes.length > 10000, `a real file (${bytes.length} bytes)`);
    await page.locator('#viewer .opf-expand-button').click();
    await page.waitForFunction(() => window.editor.expanded === true);
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => window.editor.expanded === false);
    await close();
    mark('viewer: read-only, no Undo, Present and Expand work, and the host action downloads a real .pptx');
  }

  // ---- full: Save and Share actions, Ctrl+S, dirty indicator, guardUnload -------------------------------------------------------------------
  {
    const { page, close } = await open('full');
    const badge = () => page.locator('#dirty').textContent();
    assert.equal(await badge(), 'All changes saved');
    const saveButton = page.locator('.opf-actions-button[data-action=save]');
    assert.equal(await page.locator('.opf-actions-button[data-action=share]').textContent().then((text) => text.trim()), 'Share');
    assert.equal(await saveButton.isDisabled(), true, 'Save waits for a change');
    const unload = () => page.evaluate(() => { const event = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(event); return event.defaultPrevented; });
    assert.equal(await unload(), false, 'nothing to lose, no prompt');
    await page.locator('.opf-workspace .opf-title-input').fill('Edited in the full layout');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.querySelector('#dirty').textContent === 'Unsaved changes');
    assert.equal(await page.locator('#dirty').getAttribute('data-dirty'), 'true');
    assert.equal(await saveButton.isDisabled(), false);
    assert.equal(await unload(), true, 'guardUnload asks while the editor is dirty');
    // Ctrl/Cmd+S is heard while the focus is inside the editor (Enter in the title leaves the focus on the page, so put it back).
    await page.locator('.opf-workspace .opf-title-input').focus();
    await page.keyboard.press('Control+s');
    await page.waitForFunction(() => document.querySelector('#dirty').textContent === 'All changes saved');
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('opf-chrome-example-full')));
    assert.equal(stored.name, 'Edited in the full layout');
    assert.equal(await page.evaluate(() => window.editor.dirty), false);
    assert.equal(await unload(), false, 'saved, no prompt');
    assert.equal(await saveButton.isDisabled(), true, 'Save is disabled again once saved');
    await page.locator('.opf-actions-button[data-action=share]').click();
    assert.match(await page.locator('#status').textContent(), /Share clicked/);
    // A reload opens what was saved.
    await page.reload();
    await page.evaluate(() => window.editor.ready);
    assert.equal(await page.evaluate(() => window.editor.getDeckName()), 'Edited in the full layout');
    assert.equal(await page.evaluate(() => window.editor.dirty), false);
    await close();
    mark('full: Ctrl+S fires save, the host stores the deck and markSaved clears dirty (badge, Save button, beforeunload guard); a reload opens the saved deck');
  }

  // ---- B. own header: the toolbar items in the page's header, expand over the whole card -------------------------------------------------------
  {
    const { page, close } = await open('own-header');
    assert.equal(await page.locator('#app .opf-tb').count(), 0, 'no toolbar of the editor\'s own');
    assert.equal(await page.locator('#header-title .opf-title-input').count(), 1);
    assert.equal(await page.locator('#header-history [data-opf-action=undo]').count(), 1);
    assert.equal(await page.locator('#header-history [data-opf-action=redo]').count(), 1);
    assert.equal(await page.locator('#header-counter .opf-nav-counter').count(), 1);
    assert.equal(await page.locator('#header-design .opf-design-menu-trigger').count(), 1);
    assert.equal(await page.locator('#header-expand .opf-expand-button').count(), 1);
    assert.equal(await page.locator('#editor .opf-title, #editor .opf-expand-button').count(), 0, 'nothing of the items is left inside the editor element');
    await page.locator('#header-title .opf-title-input').fill('Renamed in the header');
    await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(() => window.editor.getDeckName()), 'Renamed in the header');
    await page.locator('#header-history [data-opf-action=undo]').click();
    assert.equal(await page.evaluate(() => window.editor.getDeckName()), 'Quarterly review');
    await page.locator('#header-counter [data-action=next]').click();
    assert.equal(await page.evaluate(() => window.editor.slideIndex), 1);
    // Expand: the wrapper fills the window and the header's own button still works to return.
    const normal = await page.evaluate(() => Math.round(document.querySelector('#app').getBoundingClientRect().width));
    await page.locator('#header-expand .opf-expand-button').click();
    await page.waitForFunction(() => window.editor.expanded === true);
    const expanded = await page.evaluate(() => ({ target: document.querySelector('#app').hasAttribute('data-opf-expanded'), width: Math.round(document.querySelector('#app').getBoundingClientRect().width), header: document.querySelector('#app header').getBoundingClientRect().top }));
    assert.equal(expanded.target, true, 'the wrapper is the expanded element');
    assert.ok(expanded.width > normal, `the wrapper grew from ${normal} to ${expanded.width}`);
    assert.ok(expanded.header >= 0 && expanded.header < 10, 'the header is inside the expanded box');
    await page.locator('#header-expand .opf-expand-button').click();
    await page.waitForFunction(() => window.editor.expanded === false);
    await close();
    mark('own header: the parts sit in the page header (no editor bar), rename, undo and next work from there, and expand covers the wrapper that contains the header');
  }

  // ---- C. headless: the host's controls and the handle ----------------------------------------------------------------------------------------
  {
    const { page, close } = await open('headless');
    assert.equal(await page.locator('#app .opf-tb, #app .opf-title').count(), 0, 'the editor draws no chrome');
    assert.equal(await page.locator('#title').inputValue(), 'Quarterly review');
    assert.equal(await page.locator('#counter').textContent(), '1 / 3');
    assert.equal(await page.locator('#undo').isDisabled(), true);
    await page.locator('#title').fill('Headless name');
    await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(() => window.editor.getDeckName()), 'Headless name');
    await page.waitForFunction(() => !document.querySelector('#undo').disabled);
    assert.equal(await page.locator('#dirty').getAttribute('data-dirty'), 'true');
    await page.locator('#next').click();
    await page.waitForFunction(() => document.querySelector('#counter').textContent === '2 / 3');
    await page.locator('#next').click();
    await page.waitForFunction(() => document.querySelector('#counter').textContent === '3 / 3');
    assert.equal(await page.locator('#next').isDisabled(), true);
    await page.locator('#previous').click();
    await page.waitForFunction(() => document.querySelector('#counter').textContent === '2 / 3');
    await page.locator('#undo').click();
    await page.waitForFunction(() => document.querySelector('#title').value === 'Quarterly review');
    assert.equal(await page.locator('#redo').isDisabled(), false);
    await page.locator('#redo').click();
    await page.waitForFunction(() => document.querySelector('#title').value === 'Headless name');
    await page.locator('#expand').click();
    await page.waitForFunction(() => document.querySelector('#expand').getAttribute('aria-pressed') === 'true');
    assert.equal(await page.evaluate(() => window.editor.expanded), true);
    await page.locator('#expand').click();
    await page.waitForFunction(() => document.querySelector('#expand').getAttribute('aria-pressed') === 'false');
    await close();
    mark('headless: the host title field, Undo, Redo, Previous, Next and Expand drive the handle, and deckName, slide, change, expand and dirty events update them');
  }

  // ---- React: the component and its hooks ---------------------------------------------------------------------------------------------------
  {
    const { page, close } = await open('react', { wait: 'react' });
    const input = page.locator('input[aria-label="Deck name"]');
    await page.waitForFunction(() => document.querySelector('input[aria-label="Deck name"]').value === 'Quarterly review');
    assert.deepEqual(await visibleItems(page, '#root'), ['title', 'history', 'counter', 'spacer', 'design', 'expand', 'present']);
    assert.equal(await page.locator('#dirty').textContent(), 'Saved');
    // The host's input renames through the hook; the editor's own title follows.
    await input.fill('From React');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.querySelector('#root .opf-title-input').value === 'From React');
    await page.waitForFunction(() => document.querySelector('#dirty').textContent === 'Unsaved changes');
    // The editor's title renames the hook's value.
    await page.locator('#root .opf-title-input').fill('From the bar');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.querySelector('input[aria-label="Deck name"]').value === 'From the bar');
    await page.locator('#root [data-opf-action=undo]').click();
    await page.locator('#root [data-opf-action=undo]').click();
    await page.waitForFunction(() => document.querySelector('input[aria-label="Deck name"]').value === 'Quarterly review');
    await page.waitForFunction(() => document.querySelector('#dirty').textContent === 'Saved');
    await close();
    mark('react: <OpfEditor> mounts, useOpfDeckName reads and sets the name both ways, and useOpfDirty follows edits and undo');
  }

  // ---- the element --------------------------------------------------------------------------------------------------------------------------
  {
    const { page, close } = await open('element', { wait: 'element' });
    assert.deepEqual(await visibleItems(page, '#hero'), ['title', 'history', 'counter', 'spacer', 'expand']);
    assert.equal(await page.locator('#hero .opf-canvas svg').count() > 0, true, 'the catalogs set in the module reached the element');
    await page.evaluate(() => { window.heard = []; document.querySelector('#hero').addEventListener('opf-deck-name', (event) => window.heard.push(event.detail)); });
    await page.locator('#hero .opf-title-input').fill('Renamed element');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.querySelector('#deck-name').textContent === 'Renamed element');
    assert.deepEqual(await page.evaluate(() => window.heard), [{ name: 'Renamed element', previous: 'Launch plan' }]);
    assert.equal(await page.evaluate(() => document.querySelector('#hero').editor.getDeckName()), 'Renamed element');
    await close();
    mark('element: <opf-editor toolbar="title,history,counter,spacer,expand"> mounts from the inline deck and dispatches opf-deck-name');
  }

  // ---- styled: tokens, CSS and icons change what is drawn ---------------------------------------------------------------------------------------
  {
    const { page, close } = await open('styled');
    await page.waitForFunction(() => ['valid', 'issues'].includes(document.querySelector('#card .opf-review-pill')?.dataset.state), undefined, { timeout: 30000 });
    const look = await page.evaluate(() => {
      const css = (selector, property) => getComputedStyle(document.querySelector(selector))[property];
      return {
        bar: css('#card .opf-ws-bar', 'backgroundColor'),
        barBorder: css('#card .opf-ws-bar', 'borderBottomColor'),
        titleFont: css('#card .opf-title-input', 'fontFamily'),
        titleSize: css('#card .opf-title-input', 'fontSize'),
        titleWeight: css('#card .opf-title-input', 'fontWeight'),
        titleColor: css('#card .opf-title-input', 'color'),
        pillRadius: css('#card .opf-review-pill', 'borderTopLeftRadius'),
        pillPadding: css('#card .opf-review-pill', 'paddingLeft'),
        valid: document.querySelector('#card .opf-review-pill [data-opf-icon="valid"] path')?.getAttribute('d'),
        expand: document.querySelector('#card .opf-expand-button [data-opf-icon="expand"] path')?.getAttribute('d'),
        layered: [...document.styleSheets].some((sheet) => [...sheet.cssRules].some((rule) => rule.constructor.name === 'CSSLayerBlockRule' && rule.name === 'opf')),
      };
    });
    assert.equal(look.bar, 'rgb(17, 24, 39)', 'the dark bar');
    assert.equal(look.barBorder, 'rgb(55, 65, 81)');
    assert.match(look.titleFont, /Georgia/);
    assert.equal(look.titleSize, '18px');
    assert.equal(look.titleWeight, '700');
    assert.equal(look.titleColor, 'rgb(249, 250, 251)', 'the title takes the bar\'s light text');
    assert.equal(look.pillRadius, '999px', 'the pill shape');
    assert.equal(look.pillPadding, '14px');
    assert.equal(look.valid, 'M5 13l4 4L19 7');
    assert.equal(look.expand, 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5');
    assert.equal(look.layered, true, 'the page loads the layered sheet');
    await close();
    mark('styled: the dark bar tokens, the serif title from theme.tokens, the pill-shaped review status and the custom icons are what the page draws');
  }

  assert.deepEqual(allErrors, [], 'no page errors, console errors or failed requests');
  mark('no page errors, console errors or failed requests in any example');
} finally {
  await browser.close();
  server.close();
}

console.log(`chrome examples browser checks passed (${checks.length}):\n- ${checks.join('\n- ')}`);
