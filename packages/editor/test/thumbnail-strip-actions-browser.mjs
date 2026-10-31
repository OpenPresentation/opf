import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { loadFonts } from '@openpresentation/opf-render/fonts-node';
import { buildStyles } from '../scripts/build-styles.mjs';

// CE-29 in a real browser: slide management on the thumbnail strip (`actions: true`): the "+" button (direct and through a layout menu), the
// context menu (right-click, Shift+F10, the ContextMenu key), Alt+Arrow and Delete on a focused thumbnail, undo after each, selection and
// focus after each, the last-slide guard, read-only, right-to-left and vertical strips, the status lines, a coarse pointer, and that a strip
// without `actions` renders and behaves as before.
const axeSource = readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');
const checks = [];
const mark = (name) => checks.push(name);

const faces = (await loadFonts({ pack: 'office' })).registry.embeddedFonts.filter((face) => face.family === 'Roboto' && [400, 700].includes(face.weight) && !face.italic);
const root = fileURLToPath(new URL('../', import.meta.url));
const bundled = await build({ stdin: { resolveDir: root, contents: `
  import { createEditorSession } from './src/index.js';
  import { createThumbnailStrip } from './src/thumbnail-strip.js';
  import { listSwitchOptions } from './src/switches.js';
  import { loadFonts } from '@openpresentation/opf-render/fonts-browser';
  import { gallery } from '@openpresentation/gallery';
  window.opfStrip = { createEditorSession, createThumbnailStrip, listSwitchOptions, gallery, loadFonts };
` }, bundle: true, platform: 'browser', format: 'iife', write: false, minify: true });
const css = (await buildStyles(new URL('../src/styles/', import.meta.url))).css;
const chrome = { channel: process.platform === 'win32' && !process.env.CI ? 'msedge' : undefined };

async function openPage(contextOptions = {}) {
  const browser = await chromium.launch(chrome);
  const context = await browser.newContext({ viewport: { width: 900, height: 700 }, ...contextOptions });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.stack ?? error.message));
  page.on('console', (message) => { if (message.type() === 'error' && !/Failed to load resource/.test(message.text())) errors.push(message.text()); });
  await page.setContent('<!doctype html><meta charset="utf-8"><body class="opf-ui" style="margin:0;padding:40px 0 0"></body>');
  await page.addStyleTag({ content: css });
  await page.addScriptTag({ content: bundled.outputFiles[0].text });
  await page.evaluate(async (fontFaces) => {
    const { createEditorSession, createThumbnailStrip, listSwitchOptions, gallery, loadFonts: load } = window.opfStrip;
    window.fonts = await load({ faces: fontFaces.map((face) => ({ ...face, data: Uint8Array.from(atob(face.dataUrl.split(',')[1]), (c) => c.charCodeAt(0)) })), substitutionPolicy: 'visual', fallbackFamily: 'Roboto' });
    window.rigs = {};
    // One editor and one strip in a container of its own. `strip` adds options; `dir` and `style` shape the container.
    window.rig = (name, { count = 4, current = 0, strip = {}, dir, style = 'width:640px', layouts = false } = {}) => {
      const host = document.createElement('div');
      host.id = name;
      host.style.cssText = style;
      if (dir) host.dir = dir;
      document.body.append(host);
      const deck = { name, design: { theme: 'classic', fontScheme: 'roboto' }, slides: Array.from({ length: count }, (_, index) => ({ id: `s${index + 1}`, title: `Slide ${index + 1}`, text: `Words ${index + 1}` })) };
      const editor = createEditorSession(deck, { rejectInvalid: true, catalogs: [gallery] });
      const state = { editor, selected: [], status: [], host };
      state.strip = createThumbnailStrip(host, {
        editor, fonts: window.fonts, slideIndex: current,
        onSelect: (index) => { state.selected.push(index); },
        ...(layouts === 'empty' ? { layoutOptions: () => [] } : layouts ? { layoutOptions: (presentation) => listSwitchOptions(presentation, 'layouts', { catalogs: editor.catalogs }) } : {}),
        ...strip,
        ...(strip.onStatus === 'record' ? { onStatus: (message) => state.status.push(message) } : {}),
      });
      window.rigs[name] = state;
      return true;
    };
    window.undo = (name) => window.rigs[name].editor.undo();
  }, faces);
  return { page, browser, errors };
}

const { page, browser, errors } = await openPage();
try {
  const rig = (name, options) => page.evaluate(([n, o]) => window.rig(n, o), [name, options]);
  const ids = (name) => page.evaluate((n) => window.rigs[n].editor.presentation.slides.map((slide) => slide.id), name);
  const hiddenFlags = (name) => page.evaluate((n) => window.rigs[n].editor.presentation.slides.map((slide) => slide.hidden === true), name);
  const undo = (name) => page.evaluate((n) => { window.undo(n); }, name);
  const selected = (name) => page.evaluate((n) => window.rigs[n].selected, name);
  const clearSelected = (name) => page.evaluate((n) => { window.rigs[n].selected.length = 0; }, name);
  // The strip follows the session on the next frame: wait for the slot count, then read what is current and focused.
  const settled = async (name, count) => {
    await page.waitForFunction(([n, expected]) => document.querySelectorAll(`#${n} .opf-thumbs-item`).length === expected, [name, count], { timeout: 15000 });
  };
  const view = (name) => page.evaluate((n) => {
    const items = [...document.querySelectorAll(`#${n} .opf-thumbs-item`)];
    const rig = window.rigs[n];
    return {
      count: items.length,
      current: items.findIndex((item) => item.getAttribute('aria-current') === 'true'),
      focused: items.findIndex((item) => item === document.activeElement),
      tab0: items.map((item) => item.tabIndex).indexOf(0),
      stripCurrent: rig.strip.getSlide(),
      ids: rig.editor.presentation.slides.map((slide) => slide.id),
    };
  }, name);
  const thumb = (name, index) => page.locator(`#${name} .opf-thumbs-item[data-index="${index}"]`);
  const menu = () => page.getByRole('menu');
  const menuItem = (label) => page.getByRole('menuitem', { name: label, exact: true });

  // --- actions off: the strip is what it was --------------------------------------------------------------------------------------
  await rig('off', { count: 3 });
  await rig('off2', { count: 3, strip: { actions: false, readOnly: true } });
  for (const name of ['off', 'off2']) {
    const shape = await page.evaluate((n) => {
      const nav = document.querySelector(`#${n} nav`);
      return {
        children: [...nav.children].map((node) => node.tagName),
        listChildren: [...nav.querySelector('ol').children].map((node) => node.className),
        attributes: [...nav.attributes].map((attribute) => attribute.name).sort(),
        buttons: nav.querySelectorAll('button').length,
        add: nav.querySelectorAll('.opf-thumbs-add').length,
        status: nav.querySelectorAll('[role="status"]').length,
      };
    }, name);
    assert.deepEqual(shape, { children: ['OL'], listChildren: ['opf-thumbs-slot', 'opf-thumbs-slot', 'opf-thumbs-slot'], attributes: ['aria-label', 'class', 'data-density', 'data-orientation', 'style'], buttons: 3, add: 0, status: 0 }, `${name}: no extra element or attribute`);
  }
  await thumb('off', 1).click({ button: 'right' });
  await thumb('off', 1).focus();
  await page.keyboard.press('Alt+ArrowRight');
  await page.keyboard.press('Delete');
  await page.keyboard.press('Shift+F10');
  await page.keyboard.press('ContextMenu');
  assert.equal(await menu().count(), 0, 'no menu without actions');
  assert.deepEqual(await ids('off'), ['s1', 's2', 's3'], 'Alt+Arrow and Delete change nothing without actions');
  assert.equal((await view('off')).count, 3);
  assert.equal(await page.evaluate(() => typeof window.rigs.off.strip.setReadOnly), 'function');
  await page.evaluate(() => window.rigs.off.strip.setReadOnly(true));
  assert.equal(await page.locator('#off nav').getAttribute('data-readonly'), null, 'setReadOnly without actions adds no attribute');
  mark('without actions the strip has no extra element, attribute, menu or key');

  // --- the "+" button -------------------------------------------------------------------------------------------------------------
  await rig('add', { count: 3, strip: { actions: true, onStatus: 'record' } });
  const add = page.locator('#add').getByRole('button', { name: 'Add slide' });
  assert.equal(await add.count(), 1);
  assert.equal(await page.locator('#add ol > li:last-child > .opf-thumbs-add').count(), 1, 'the + button is the last slot');
  assert.equal(await add.getAttribute('aria-haspopup'), null, 'without layoutOptions the button opens no menu');
  assert.equal(await page.locator('#add nav').getAttribute('data-actions'), 'true');
  await add.click();
  await settled('add', 4);
  let state = await view('add');
  assert.deepEqual(state.ids, ['s1', 'slide-4', 's2', 's3'], 'a slide is added after the current one');
  assert.equal(state.current, 1, 'and becomes current');
  assert.equal(state.focused, 1, 'and takes the focus');
  assert.equal(state.stripCurrent, 1);
  assert.deepEqual(await selected('add'), [1], 'onSelect reports the new slide');
  assert.deepEqual(await page.evaluate(() => window.rigs.add.status), ['Slide added at position 2']);
  assert.equal(await page.locator('#add .opf-thumbs-item').nth(1).getAttribute('aria-current'), 'true');
  assert.equal(await page.locator('#add ol > li:last-child > .opf-thumbs-add').count(), 1, 'the + button stays last after the strip grew');
  await undo('add');
  await settled('add', 3);
  assert.deepEqual(await ids('add'), ['s1', 's2', 's3'], 'one undo removes the added slide');
  mark('+ adds a slide after the current one, selects and focuses it, reports it, and one undo removes it');

  // From the keyboard, and after the current slide moves.
  await page.evaluate(() => { window.rigs.add.strip.setSlide(2); });
  await clearSelected('add');
  await add.focus();
  await page.keyboard.press('Enter');
  await settled('add', 4);
  state = await view('add');
  assert.deepEqual(state.ids, ['s1', 's2', 's3', 'slide-4']);
  assert.equal(state.current, 3);
  assert.equal(state.focused, 3);
  assert.deepEqual(await selected('add'), [3]);
  await undo('add');
  await settled('add', 3);
  mark('+ works from the keyboard and adds after the last slide');

  // --- the layout menu --------------------------------------------------------------------------------------------------------------
  await rig('lay', { count: 3, layouts: true, current: 1, strip: { actions: true } });
  const layAdd = page.locator('#lay').getByRole('button', { name: 'Add slide' });
  assert.equal(await layAdd.getAttribute('aria-haspopup'), 'menu');
  assert.equal(await layAdd.getAttribute('aria-expanded'), 'false');
  await layAdd.click();
  await menu().waitFor();
  assert.equal(await layAdd.getAttribute('aria-expanded'), 'true');
  assert.equal(await menu().getAttribute('aria-label'), 'Layouts');
  const layoutLabels = await menu().getByRole('menuitem').allTextContents();
  assert.ok(layoutLabels.length > 5, `the menu lists the layouts (${layoutLabels.length})`);
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('role')), 'menuitem', 'focus moves into the menu');
  assert.equal(await page.evaluate(() => document.activeElement.textContent), layoutLabels[0]);
  await page.keyboard.press('ArrowDown');
  assert.equal(await page.evaluate(() => document.activeElement.textContent), layoutLabels[1], 'ArrowDown moves down the menu');
  await page.keyboard.press('End');
  assert.equal(await page.evaluate(() => document.activeElement.textContent), layoutLabels.at(-1));
  await page.keyboard.press('Home');
  assert.equal(await page.evaluate(() => document.activeElement.textContent), layoutLabels[0]);
  await page.keyboard.press('Escape');
  assert.equal(await menu().count(), 0, 'Escape closes the menu');
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('aria-label')), 'Add slide', 'and returns focus to +');
  assert.equal(await layAdd.getAttribute('aria-expanded'), 'false');
  assert.deepEqual(await ids('lay'), ['s1', 's2', 's3'], 'closing the menu adds nothing');
  await layAdd.click();
  await menu().waitFor();
  await layAdd.click();
  assert.equal(await menu().count(), 0, 'clicking + again closes its menu');
  await layAdd.click();
  await menu().waitFor();
  await page.mouse.click(5, 5);
  assert.equal(await menu().count(), 0, 'a press outside closes the menu');
  await layAdd.click();
  await menu().waitFor();
  const choice = await page.evaluate(() => window.opfStrip.listSwitchOptions(window.rigs.lay.editor.presentation, 'layouts', { catalogs: window.rigs.lay.editor.catalogs })[2]);
  await menu().getByRole('menuitem', { name: choice.label, exact: true }).first().click();
  await settled('lay', 4);
  state = await view('lay');
  assert.equal(state.current, 2, 'the slide with the layout goes after the current one and is current');
  assert.equal(state.focused, 2);
  const laid = await page.evaluate(() => window.rigs.lay.editor.presentation.slides[2]);
  assert.equal(laid.layout, choice.id, 'it uses the chosen layout');
  assert.equal(await menu().count(), 0);
  await undo('lay');
  await settled('lay', 3);
  assert.deepEqual(await ids('lay'), ['s1', 's2', 's3']);
  mark('with layoutOptions + opens a layout menu (keys, Escape, toggle, outside press) and adds the chosen layout, undoable');

  // layoutOptions that offers nothing falls back to a direct add.
  await rig('lay0', { count: 2, layouts: 'empty', strip: { actions: true } });
  await page.locator('#lay0').getByRole('button', { name: 'Add slide' }).click();
  await settled('lay0', 3);
  assert.equal(await menu().count(), 0);
  mark('empty layout options add directly');

  // --- the context menu: mouse -----------------------------------------------------------------------------------------------------
  await rig('ctx', { count: 4, strip: { actions: true, onStatus: 'record' } });
  await thumb('ctx', 2).click({ button: 'right' });
  await menu().waitFor();
  assert.equal(await menu().getAttribute('aria-label'), 'Slide actions');
  assert.deepEqual(await menu().getByRole('menuitem').allTextContents(), ['Duplicate slide', 'Delete slide', 'Hide in slide show', 'Move left', 'Move right'].map((label, at) => label + ['', 'Delete', '', 'Alt+←', 'Alt+→'][at]));
  assert.equal(await menuItem('Delete slide').getAttribute('aria-keyshortcuts'), 'Delete');
  assert.equal(await menuItem('Move left').getAttribute('aria-keyshortcuts'), 'Alt+ArrowLeft');
  state = await view('ctx');
  assert.equal(state.current, 2, 'a right-click selects the slide');
  assert.deepEqual(await selected('ctx'), [2]);
  await clearSelected('ctx');
  for (const label of ['Duplicate slide', 'Delete slide', 'Hide in slide show', 'Move left', 'Move right']) assert.equal(await menuItem(label).isEnabled(), true, `${label} is enabled`);

  // Duplicate.
  await menuItem('Duplicate slide').click();
  await settled('ctx', 5);
  state = await view('ctx');
  assert.deepEqual(state.ids, ['s1', 's2', 's3', 's3-2', 's4'], 'the copy follows the slide with a fresh id');
  assert.equal(state.current, 3, 'the copy is current');
  assert.equal(state.focused, 3, 'and focused');
  assert.equal(state.tab0, 3);
  assert.deepEqual(await selected('ctx'), [3]);
  assert.equal(await menu().count(), 0);
  await undo('ctx');
  await settled('ctx', 4);
  assert.deepEqual(await ids('ctx'), ['s1', 's2', 's3', 's4'], 'one undo removes the copy');
  mark('Duplicate from the context menu: the copy follows the slide, becomes current and focused, one undo');

  // Hide and show.
  await clearSelected('ctx');
  await thumb('ctx', 1).click({ button: 'right' });
  await menuItem('Hide in slide show').click();
  await page.waitForFunction(() => document.querySelector('#ctx .opf-thumbs-item[data-index="1"]').dataset.hidden === 'true', undefined, { timeout: 15000 });
  assert.deepEqual(await hiddenFlags('ctx'), [false, true, false, false]);
  assert.match(await page.locator('#ctx .opf-thumbs-item[data-index="1"] .opf-thumbs-note').textContent(), /hidden/);
  state = await view('ctx');
  assert.equal(state.current, 1);
  assert.equal(state.focused, 1, 'focus stays on the hidden slide');
  assert.deepEqual(await selected('ctx'), [1], 'only the right-click chose the slide');
  await thumb('ctx', 1).click({ button: 'right' });
  assert.equal(await menuItem('Show in slide show').count(), 1, 'the item reads Show for a hidden slide');
  await menuItem('Show in slide show').click();
  await page.waitForFunction(() => document.querySelector('#ctx .opf-thumbs-item[data-index="1"]').dataset.hidden === 'false', undefined, { timeout: 15000 });
  assert.deepEqual(await hiddenFlags('ctx'), [false, false, false, false]);
  assert.equal(await page.evaluate(() => 'hidden' in window.rigs.ctx.editor.presentation.slides[1]), false, 'showing removes the field');
  await undo('ctx');
  await page.waitForFunction(() => document.querySelector('#ctx .opf-thumbs-item[data-index="1"]').dataset.hidden === 'true', undefined, { timeout: 15000 });
  await undo('ctx');
  await page.waitForFunction(() => document.querySelector('#ctx .opf-thumbs-item[data-index="1"]').dataset.hidden === 'false', undefined, { timeout: 15000 });
  assert.deepEqual(await hiddenFlags('ctx'), [false, false, false, false]);
  mark('Hide and Show in slide show toggle the slide, each one undo');

  // Move left and right.
  await thumb('ctx', 1).click({ button: 'right' });
  await menuItem('Move right').click();
  await page.waitForFunction(() => window.rigs.ctx.editor.presentation.slides[2].id === 's2', undefined, { timeout: 15000 });
  state = await view('ctx');
  assert.deepEqual(state.ids, ['s1', 's3', 's2', 's4']);
  assert.equal(state.current, 2, 'the strip follows the moved slide');
  assert.equal(state.focused, 2);
  assert.equal(state.tab0, 2);
  await thumb('ctx', 2).click({ button: 'right' });
  await menuItem('Move left').click();
  await page.waitForFunction(() => window.rigs.ctx.editor.presentation.slides[1].id === 's2', undefined, { timeout: 15000 });
  state = await view('ctx');
  assert.deepEqual(state.ids, ['s1', 's2', 's3', 's4']);
  assert.equal(state.current, 1);
  assert.equal(state.focused, 1);
  await undo('ctx');
  await page.waitForFunction(() => window.rigs.ctx.editor.presentation.slides[2].id === 's2', undefined, { timeout: 15000 });
  await undo('ctx');
  await page.waitForFunction(() => window.rigs.ctx.editor.presentation.slides[1].id === 's2', undefined, { timeout: 15000 });
  assert.deepEqual(await ids('ctx'), ['s1', 's2', 's3', 's4']);
  assert.deepEqual((await page.evaluate(() => window.rigs.ctx.status)).filter((line) => line.startsWith('Slide moved')), ['Slide moved to position 3 of 4', 'Slide moved to position 2 of 4']);
  // The edges: nothing to move into, so the item is disabled.
  await thumb('ctx', 0).click({ button: 'right' });
  assert.equal(await menuItem('Move left').isDisabled(), true, 'Move left is disabled on the first slide');
  assert.equal(await menuItem('Move right').isEnabled(), true);
  await page.keyboard.press('Escape');
  await thumb('ctx', 3).click({ button: 'right' });
  assert.equal(await menuItem('Move right').isDisabled(), true, 'Move right is disabled on the last slide');
  await page.keyboard.press('Escape');
  mark('Move left and Move right follow the slide, disable at the edges and undo');

  // Delete: the neighbour takes over.
  await thumb('ctx', 1).click({ button: 'right' });
  await menuItem('Delete slide').click();
  await settled('ctx', 3);
  state = await view('ctx');
  assert.deepEqual(state.ids, ['s1', 's3', 's4']);
  assert.equal(state.current, 1, 'the slide that took the place is current');
  assert.equal(state.focused, 1);
  await undo('ctx');
  await settled('ctx', 4);
  assert.deepEqual(await ids('ctx'), ['s1', 's2', 's3', 's4']);
  await thumb('ctx', 3).click({ button: 'right' });
  await menuItem('Delete slide').click();
  await settled('ctx', 3);
  state = await view('ctx');
  assert.deepEqual(state.ids, ['s1', 's2', 's3']);
  assert.equal(state.current, 2, 'deleting the last slide selects the one before');
  assert.equal(state.focused, 2);
  await undo('ctx');
  await settled('ctx', 4);
  mark('Delete from the context menu selects and focuses the neighbour, one undo');

  // Escape closes the menu and returns focus to the thumbnail; a press outside closes it too.
  await thumb('ctx', 1).click({ button: 'right' });
  await menu().waitFor();
  await page.keyboard.press('Escape');
  assert.equal(await menu().count(), 0);
  assert.equal((await view('ctx')).focused, 1, 'Escape returns focus to the thumbnail');
  await thumb('ctx', 1).click({ button: 'right' });
  await menu().waitFor();
  await page.mouse.click(5, 5);
  assert.equal(await menu().count(), 0, 'a press outside closes the menu');
  assert.deepEqual(await ids('ctx'), ['s1', 's2', 's3', 's4']);
  mark('Escape and an outside press close the context menu without changing anything');

  // --- the keyboard ---------------------------------------------------------------------------------------------------------------
  await rig('key', { count: 4, strip: { actions: true } });
  await thumb('key', 1).focus();
  await page.keyboard.press('Shift+F10');
  await menu().waitFor();
  assert.equal(await page.evaluate(() => document.activeElement?.textContent), 'Duplicate slide', 'focus moves to the first item');
  let menuBox = await menu().evaluate((node) => { const box = node.getBoundingClientRect(); const item = document.querySelector('#key .opf-thumbs-item[data-index="1"]').getBoundingClientRect(); return { top: box.top, left: box.left, itemBottom: item.bottom, itemTop: item.top, itemLeft: item.left, height: box.height }; });
  assert.ok(Math.abs(menuBox.left - menuBox.itemLeft) < 2, 'the menu opens at the focused thumbnail');
  assert.ok(menuBox.top >= menuBox.itemBottom - 1 || menuBox.top + menuBox.height <= menuBox.itemTop + 1, 'and does not cover it');
  assert.equal((await view('key')).current, 0, 'opening the menu from the keyboard does not choose the slide');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  assert.equal(await page.evaluate(() => document.activeElement?.textContent), 'Hide in slide show');
  await page.keyboard.press('ArrowDown');
  assert.equal(await page.evaluate(() => document.activeElement?.textContent.startsWith('Move left')), true);
  await page.keyboard.press('Escape');
  assert.equal(await menu().count(), 0);
  assert.equal((await view('key')).focused, 1, 'Escape returns focus to the thumbnail');
  await page.keyboard.press('ContextMenu');
  await menu().waitFor();
  await page.keyboard.press('Enter');
  await settled('key', 5);
  state = await view('key');
  assert.deepEqual(state.ids, ['s1', 's2', 's2-2', 's3', 's4'], 'Enter on Duplicate duplicates the focused slide');
  assert.equal(state.current, 2);
  assert.equal(state.focused, 2);
  await undo('key');
  await settled('key', 4);
  mark('Shift+F10 and the ContextMenu key open the menu on the focused thumbnail; arrows, Enter and Escape work');

  // Alt+Arrow.
  await thumb('key', 1).focus();
  await page.keyboard.press('Alt+ArrowRight');
  await page.waitForFunction(() => window.rigs.key.editor.presentation.slides[2].id === 's2', undefined, { timeout: 15000 });
  state = await view('key');
  assert.deepEqual(state.ids, ['s1', 's3', 's2', 's4']);
  assert.equal(state.current, 2);
  assert.equal(state.focused, 2, 'focus follows the moved slide');
  await page.keyboard.press('Alt+ArrowRight');
  await page.waitForFunction(() => window.rigs.key.editor.presentation.slides[3].id === 's2', undefined, { timeout: 15000 });
  assert.equal((await view('key')).focused, 3);
  await page.keyboard.press('Alt+ArrowRight');
  assert.deepEqual(await ids('key'), ['s1', 's3', 's4', 's2'], 'nothing moves past the end');
  assert.equal((await view('key')).focused, 3);
  await page.keyboard.press('Alt+ArrowLeft');
  await page.waitForFunction(() => window.rigs.key.editor.presentation.slides[2].id === 's2', undefined, { timeout: 15000 });
  assert.deepEqual(await ids('key'), ['s1', 's3', 's2', 's4']);
  assert.equal((await view('key')).focused, 2);
  for (let turn = 0; turn < 3; turn += 1) await undo('key');
  await page.waitForFunction(() => window.rigs.key.editor.presentation.slides[1].id === 's2', undefined, { timeout: 15000 });
  assert.deepEqual(await ids('key'), ['s1', 's2', 's3', 's4'], 'each move is one undo');
  // Alt+Arrow acts on the focused thumbnail, not the current slide.
  await page.evaluate(() => { window.rigs.key.strip.setSlide(3); });
  await thumb('key', 0).focus();
  await page.keyboard.press('Alt+ArrowRight');
  await page.waitForFunction(() => window.rigs.key.editor.presentation.slides[1].id === 's1', undefined, { timeout: 15000 });
  assert.deepEqual(await ids('key'), ['s2', 's1', 's3', 's4']);
  assert.equal((await view('key')).current, 1, 'and the moved slide becomes current');
  await undo('key');
  await page.waitForFunction(() => window.rigs.key.editor.presentation.slides[0].id === 's1', undefined, { timeout: 15000 });
  // Plain arrows still only move focus, Alt+Up and Alt+Down do nothing in a horizontal strip.
  await thumb('key', 0).focus();
  await page.keyboard.press('Alt+ArrowDown');
  await page.keyboard.press('ArrowRight');
  assert.equal((await view('key')).focused, 1);
  assert.deepEqual(await ids('key'), ['s1', 's2', 's3', 's4']);
  mark('Alt+ArrowLeft and Alt+ArrowRight move the focused thumbnail (focus and selection follow, edges stop, each move one undo)');

  // Delete and Backspace.
  await thumb('key', 2).focus();
  await page.keyboard.press('Delete');
  await settled('key', 3);
  state = await view('key');
  assert.deepEqual(state.ids, ['s1', 's2', 's4']);
  assert.equal(state.current, 2, 'the neighbour is current');
  assert.equal(state.focused, 2);
  await page.keyboard.press('Delete');
  await settled('key', 2);
  state = await view('key');
  assert.deepEqual(state.ids, ['s1', 's2'], 'deleting the last slide');
  assert.equal(state.current, 1, 'selects the one before');
  assert.equal(state.focused, 1);
  await page.keyboard.press('Backspace');
  await settled('key', 1);
  assert.deepEqual(await ids('key'), ['s1']);
  assert.equal((await view('key')).focused, 0);
  for (let turn = 0; turn < 3; turn += 1) await undo('key');
  await settled('key', 4);
  assert.deepEqual(await ids('key'), ['s1', 's2', 's3', 's4'], 'each delete is one undo');
  mark('Delete and Backspace delete the focused slide; the neighbour is selected and focused; each one undo');

  // --- the last slide ---------------------------------------------------------------------------------------------------------------
  await rig('one', { count: 1, strip: { actions: true, onStatus: 'record' } });
  await thumb('one', 0).click({ button: 'right' });
  assert.equal(await menuItem('Delete slide').isDisabled(), true, 'Delete is disabled for the only slide');
  assert.equal(await menuItem('Duplicate slide').isEnabled(), true);
  assert.equal(await menuItem('Move left').isDisabled(), true);
  assert.equal(await menuItem('Move right').isDisabled(), true);
  await page.keyboard.press('Escape');
  await thumb('one', 0).focus();
  await page.keyboard.press('Delete');
  await page.waitForTimeout(100);
  assert.deepEqual(await ids('one'), ['s1'], 'the Delete key leaves the only slide');
  assert.equal(await page.evaluate(() => window.rigs.one.editor.canUndo), false, 'and records no edit');
  assert.deepEqual(await page.evaluate(() => window.rigs.one.status), ['A presentation needs at least one slide']);
  assert.equal((await view('one')).focused, 0);
  mark('the last remaining slide cannot be deleted (menu item disabled, key refused with a status line)');

  // --- read only --------------------------------------------------------------------------------------------------------------------
  await rig('ro', { count: 3, current: 1, strip: { actions: true, readOnly: true, onStatus: 'record' } });
  assert.equal(await page.locator('#ro .opf-thumbs-add').count(), 0, 'no + button when read-only');
  assert.equal(await page.locator('#ro nav').getAttribute('data-readonly'), 'true');
  await thumb('ro', 2).click({ button: 'right' });
  await menu().waitFor();
  assert.deepEqual(await menu().getByRole('menuitem').evaluateAll((nodes) => nodes.map((node) => node.disabled)), [true, true, true, true, true], 'every menu item is disabled');
  assert.equal((await view('ro')).current, 2, 'the right-click still chooses the slide');
  await page.keyboard.press('Escape');
  await thumb('ro', 2).focus();
  await page.keyboard.press('Delete');
  await page.keyboard.press('Alt+ArrowLeft');
  assert.deepEqual(await ids('ro'), ['s1', 's2', 's3'], 'the keys change nothing');
  assert.equal(await page.evaluate(() => window.rigs.ro.editor.canUndo), false);
  // Switch it on, then off with a menu open.
  await page.evaluate(() => window.rigs.ro.strip.setReadOnly(false));
  assert.equal(await page.locator('#ro nav').getAttribute('data-readonly'), null);
  assert.equal(await page.locator('#ro ol > li:last-child > .opf-thumbs-add').count(), 1, 'setReadOnly(false) brings the + button back, last');
  await thumb('ro', 2).click({ button: 'right' });
  assert.equal(await menuItem('Delete slide').isEnabled(), true);
  await page.evaluate(() => window.rigs.ro.strip.setReadOnly(true));
  assert.equal(await menu().count(), 0, 'turning read-only on closes an open menu');
  assert.equal(await page.locator('#ro .opf-thumbs-add').count(), 0);
  await page.evaluate(() => window.rigs.ro.strip.setReadOnly(false));
  await page.locator('#ro').getByRole('button', { name: 'Add slide' }).click();
  await settled('ro', 4);
  assert.deepEqual(await ids('ro'), ['s1', 's2', 's3', 'slide-4'], 'an editable strip adds again');
  mark('read-only: no + button, disabled menu items, keys inert; setReadOnly toggles it live and closes an open menu');

  // --- right-to-left ---------------------------------------------------------------------------------------------------------------
  await rig('rtl', { count: 4, dir: 'rtl', strip: { actions: true } });
  const order = await page.evaluate(() => [...document.querySelectorAll('#rtl .opf-thumbs-item')].map((item) => Math.round(item.getBoundingClientRect().left)));
  assert.ok(order[0] > order[1] && order[1] > order[2], `the strip runs right to left (${order})`);
  assert.equal(await page.evaluate(() => { const add = document.querySelector('#rtl .opf-thumbs-add').getBoundingClientRect(); return add.left < document.querySelector('#rtl .opf-thumbs-item[data-index="3"]').getBoundingClientRect().left; }), true, 'the + button ends the strip on the left');
  await thumb('rtl', 1).click({ button: 'right' });
  assert.equal(await menuItem('Move left').isEnabled(), true);
  await menuItem('Move left').click();
  await page.waitForFunction(() => window.rigs.rtl.editor.presentation.slides[2].id === 's2', undefined, { timeout: 15000 });
  assert.deepEqual(await ids('rtl'), ['s1', 's3', 's2', 's4'], 'in a right-to-left strip Move left moves toward the end');
  assert.equal((await view('rtl')).current, 2);
  await undo('rtl');
  await page.waitForFunction(() => window.rigs.rtl.editor.presentation.slides[1].id === 's2', undefined, { timeout: 15000 });
  await thumb('rtl', 0).click({ button: 'right' });
  assert.equal(await menuItem('Move right').isDisabled(), true, 'Move right is disabled on the first slide');
  assert.equal(await menuItem('Move left').isEnabled(), true);
  await page.keyboard.press('Escape');
  await thumb('rtl', 3).click({ button: 'right' });
  assert.equal(await menuItem('Move left').isDisabled(), true, 'Move left is disabled on the last slide');
  await page.keyboard.press('Escape');
  await thumb('rtl', 1).focus();
  await page.keyboard.press('Alt+ArrowLeft');
  await page.waitForFunction(() => window.rigs.rtl.editor.presentation.slides[2].id === 's2', undefined, { timeout: 15000 });
  assert.equal((await view('rtl')).focused, 2);
  await page.keyboard.press('Alt+ArrowRight');
  await page.waitForFunction(() => window.rigs.rtl.editor.presentation.slides[1].id === 's2', undefined, { timeout: 15000 });
  assert.deepEqual(await ids('rtl'), ['s1', 's2', 's3', 's4']);
  assert.equal((await view('rtl')).focused, 1);
  await undo('rtl');
  await undo('rtl');
  mark('right-to-left mirrors Move left and Move right and Alt+ArrowLeft and Alt+ArrowRight');

  // --- vertical --------------------------------------------------------------------------------------------------------------------
  await rig('vert', { count: 4, style: 'width:200px;height:400px;display:flex;flex-direction:column', strip: { actions: true, orientation: 'vertical', size: 100 } });
  assert.equal(await page.locator('#vert ol > li:last-child > .opf-thumbs-add').count(), 1);
  const vertAdd = await page.locator('#vert .opf-thumbs-add').evaluate((node) => { const box = node.getBoundingClientRect(); const last = document.querySelector('#vert .opf-thumbs-item[data-index="3"]').getBoundingClientRect(); return { below: box.top >= last.bottom, width: Math.round(box.width) }; });
  assert.equal(vertAdd.below, true, 'the + button is below the last thumbnail');
  await thumb('vert', 1).click({ button: 'right' });
  assert.deepEqual(await menu().getByRole('menuitem').evaluateAll((nodes) => nodes.map((node) => node.firstChild.textContent)), ['Duplicate slide', 'Delete slide', 'Hide in slide show', 'Move up', 'Move down']);
  await menuItem('Move down').click();
  await page.waitForFunction(() => window.rigs.vert.editor.presentation.slides[2].id === 's2', undefined, { timeout: 15000 });
  assert.equal((await view('vert')).focused, 2);
  await page.keyboard.press('Alt+ArrowUp');
  await page.waitForFunction(() => window.rigs.vert.editor.presentation.slides[1].id === 's2', undefined, { timeout: 15000 });
  await page.keyboard.press('Alt+ArrowLeft');
  assert.deepEqual(await ids('vert'), ['s1', 's2', 's3', 's4'], 'Alt+Left does nothing in a vertical strip');
  mark('a vertical strip offers Move up and Move down and Alt+ArrowUp and Alt+ArrowDown');

  // --- status lines ------------------------------------------------------------------------------------------------------------------
  await rig('live', { count: 3, strip: { actions: true } });
  assert.equal(await page.locator('#live [role="status"]').count(), 0, 'no live region until the first action');
  await thumb('live', 0).focus();
  await page.keyboard.press('Alt+ArrowRight');
  await settled('live', 3);
  assert.equal(await page.locator('#live [role="status"]').textContent(), 'Slide moved to position 2 of 3');
  await page.keyboard.press('Delete');
  await settled('live', 2);
  assert.equal(await page.locator('#live [role="status"]').textContent(), 'Slide deleted. 2 left');
  await thumb('live', 1).click({ button: 'right' });
  await menuItem('Hide in slide show').click();
  await page.waitForFunction(() => document.querySelector('#live [role="status"]').textContent === 'Slide hidden from the slide show', undefined, { timeout: 15000 });
  await page.keyboard.press('Alt+ArrowRight');
  assert.equal(await page.locator('#live [role="status"]').textContent(), 'Already the last slide');
  assert.equal(await page.locator('#live [role="status"]').getAttribute('aria-live'), 'polite');
  const statusBox = await page.locator('#live [role="status"]').evaluate((node) => { const box = node.getBoundingClientRect(); return [Math.round(box.width), Math.round(box.height)]; });
  assert.deepEqual(statusBox, [1, 1], 'the live region is visually hidden');
  mark('without onStatus the strip announces each action in a polite live region; with it, onStatus gets the lines');

  // --- labels ----------------------------------------------------------------------------------------------------------------------
  await rig('lbl', { count: 2, strip: { actions: true, labels: { add: 'Nueva diapositiva', slideActions: 'Acciones', duplicate: 'Duplicar', delete: 'Eliminar', hideSlide: 'Ocultar', moveLeft: 'Mover a la izquierda', moveRight: 'Mover a la derecha', statusDuplicated: 'Duplicada' } } });
  assert.equal(await page.locator('#lbl').getByRole('button', { name: 'Nueva diapositiva' }).count(), 1);
  await thumb('lbl', 0).click({ button: 'right' });
  assert.equal(await menu().getAttribute('aria-label'), 'Acciones');
  assert.deepEqual(await menu().getByRole('menuitem').evaluateAll((nodes) => nodes.map((node) => node.firstChild.textContent)), ['Duplicar', 'Eliminar', 'Ocultar', 'Mover a la izquierda', 'Mover a la derecha']);
  await menuItem('Duplicar').click();
  await settled('lbl', 3);
  assert.equal(await page.locator('#lbl [role="status"]').textContent(), 'Duplicada');
  mark('labels rename the button, the menu and the status lines');

  // --- destroy and edits from elsewhere ------------------------------------------------------------------------------------------------
  await rig('gone', { count: 3, strip: { actions: true } });
  await thumb('gone', 0).click({ button: 'right' });
  await menu().waitFor();
  await page.evaluate(() => window.rigs.gone.strip.destroy());
  assert.equal(await menu().count(), 0, 'destroy removes an open menu');
  assert.equal(await page.locator('#gone').innerHTML(), '', 'and the strip');
  await page.evaluate(() => window.rigs.gone.strip.destroy());
  await rig('ext', { count: 3, strip: { actions: true } });
  await page.evaluate(() => window.rigs.ext.editor.applyPatch([{ op: 'add', path: '/slides/-', value: { id: 'extra', title: 'Extra', text: 'x' } }]));
  await settled('ext', 4);
  assert.equal(await page.locator('#ext ol > li:last-child > .opf-thumbs-add').count(), 1, 'a slide added elsewhere lands before the + button');
  assert.equal(await page.locator('#ext ol > li').count(), 5);
  mark('destroy closes the menu; slides added elsewhere keep the + button last');

  // --- axe -------------------------------------------------------------------------------------------------------------------------
  await rig('axe', { count: 3, layouts: true, strip: { actions: true } });
  await page.addScriptTag({ content: axeSource }).catch(() => {});
  const axeRun = () => page.evaluate(() => window.axe.run({ include: [['#axe'], ['.opf-thumbs-menu']] }, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] } }));
  const report = (result) => result.violations.map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(' ')).join(' | ')}`);
  assert.deepEqual(report(await axeRun()), [], 'axe: the strip with the + button');
  await page.locator('#axe').getByRole('button', { name: 'Add slide' }).click();
  await menu().waitFor();
  assert.deepEqual(report(await axeRun()), [], 'axe: the layout menu');
  await page.keyboard.press('Escape');
  await thumb('axe', 1).click({ button: 'right' });
  await menu().waitFor();
  assert.deepEqual(report(await axeRun()), [], 'axe: the slide menu');
  await page.keyboard.press('Escape');
  mark('axe finds no violation in the strip, the layout menu and the slide menu');

  // Dark mode: the menu follows the tokens (no light surface on a dark page).
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.evaluate(() => { document.body.classList.add('dark'); });
  await thumb('axe', 1).click({ button: 'right' });
  await menu().waitFor();
  const dark = await menu().evaluate((node) => getComputedStyle(node).backgroundColor);
  assert.notEqual(dark, 'rgb(255, 255, 255)', `the menu is not the light surface in dark mode (${dark})`);
  await page.keyboard.press('Escape');
  await page.evaluate(() => { document.body.classList.remove('dark'); });
  await page.emulateMedia({ colorScheme: 'light' });
  mark('the menu follows the dark tokens');

  assert.deepEqual(errors, []);
} finally {
  await browser?.close();
}

// --- a coarse pointer: 44px controls ------------------------------------------------------------------------------------------------
{
  const touch = await openPage({ viewport: { width: 390, height: 760 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  try {
    const { page: phone } = touch;
    assert.equal(await phone.evaluate(() => matchMedia('(pointer: coarse)').matches), true, 'the page has a coarse pointer');
    await phone.evaluate(() => window.rig('t', { count: 3, layouts: true, strip: { actions: true, density: 'touch' }, style: 'width:360px' }));
    const addBox = await phone.locator('#t .opf-thumbs-add').evaluate((node) => { const box = node.getBoundingClientRect(); return [Math.round(box.width), Math.round(box.height)]; });
    assert.ok(addBox[0] >= 44 && addBox[1] >= 44, `the + button is at least 44px (${addBox})`);
    await phone.locator('#t .opf-thumbs-add').tap();
    await phone.getByRole('menu').waitFor();
    const heights = await phone.getByRole('menuitem').evaluateAll((nodes) => nodes.map((node) => Math.round(node.getBoundingClientRect().height)));
    assert.ok(heights.length > 3 && heights.every((height) => height >= 44), `layout menu items are at least 44px (${heights})`);
    await phone.keyboard.press('Escape');
    await phone.evaluate(() => { window.rig('tv', { count: 3, strip: { actions: true, orientation: 'vertical', density: 'touch' }, style: 'width:200px' }); });
    const vertical = await phone.locator('#tv .opf-thumbs-add').evaluate((node) => Math.round(node.getBoundingClientRect().height));
    assert.ok(vertical >= 44, `the vertical + button is at least 44px (${vertical})`);
    await phone.locator('#t .opf-thumbs-item').first().dispatchEvent('contextmenu', { clientX: 20, clientY: 80 });
    await phone.getByRole('menu').waitFor();
    const slideHeights = await phone.getByRole('menuitem').evaluateAll((nodes) => nodes.map((node) => Math.round(node.getBoundingClientRect().height)));
    assert.deepEqual(slideHeights.map((height) => height >= 44), [true, true, true, true, true], `slide menu items are at least 44px (${slideHeights})`);
    assert.deepEqual(touch.errors, []);
    mark('under a coarse pointer the + button and the menu items are at least 44px');
  } finally {
    await touch.browser.close();
  }
}

console.log(`CE-29 browser: ${checks.length} checks ok`);
