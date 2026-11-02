import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { buildStyles } from '../scripts/build-styles.mjs';

// CE-28: the expand-editor part (src/editor-expand.js) in a real browser, on a bare page with the real stylesheet: expanding and collapsing with
// the button (mouse and keyboard), the overlay's geometry, that the element keeps its place, the page scroll lock and its exact restore, focus in
// and back, onChange, every Escape rule (typing fields, CodeMirror, menus, dialogs, the presenter, an event already handled), the full screen
// option and its silent fallback when the browser refuses, two controllers, destroy while expanded, an iframe, the menu entry, disabled, labels,
// sizes (fine and coarse pointers) and axe. No request leaves the page.
const axeSource = readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');
const root = fileURLToPath(new URL('../', import.meta.url));
const checks = [];
const mark = (name) => checks.push(name);

const bundled = await build({
  stdin: { resolveDir: root, loader: 'js', contents: "import * as expand from './src/editor-expand.js'; window.opfExpand = expand;" },
  bundle: true, platform: 'browser', format: 'iife', write: false, minify: true, logLevel: 'error',
});
const bundle = bundled.outputFiles[0].text;
const css = (await buildStyles(new URL('../src/styles/', import.meta.url))).css;

const body = `
<div id="top" style="height:40px">top of the page</div>
<div id="ed" class="opf-ui" style="width:400px;height:300px;margin:0 40px;overflow:auto">
  <div id="bar"></div>
  <input id="field" aria-label="Field"><textarea id="area" aria-label="Area"></textarea>
  <div id="editable" contenteditable="true">editable</div>
  <div class="cm-editor"><div id="cmline" tabindex="0">code</div></div>
  <div role="menu" aria-label="Fake menu"><button id="menuitem" role="menuitem">item</button></div>
  <dialog id="dlg" open><button id="dlgbutton">in a dialog</button></dialog>
  <select id="sel" aria-label="Select"><option>a</option><option>b</option></select>
  <input id="check" type="checkbox" aria-label="Check">
  <button id="plain">plain</button>
</div>
<div role="dialog" id="wrapper" aria-label="Modal around the second editor"><div id="ed2" class="opf-ui" style="width:300px;height:200px;margin:12px 40px"><div id="bar2"></div><button id="plain2">plain two</button></div></div>
<button id="opener">Opener</button>
<div style="height:2600px"></div>`;

async function start({ viewport = { width: 1000, height: 700 }, touch = false, preScript } = {}) {
  const browser = await chromium.launch({ channel: process.platform === 'win32' && !process.env.CI ? 'msedge' : undefined });
  const context = await browser.newContext({ viewport, ...(touch ? { hasTouch: true, isMobile: true } : {}) });
  const page = await context.newPage();
  const errors = [], requests = [];
  page.on('pageerror', (error) => errors.push(error.stack ?? error.message));
  page.on('console', (message) => { if (message.type() === 'error' && !/Failed to load resource/.test(message.text())) errors.push(message.text()); });
  await page.route(/^https?:/, (route) => { requests.push(route.request().url()); route.abort(); });
  await page.setContent(`<!doctype html><html lang="en"><meta charset="utf-8"><title>Expand fixture</title><body style="margin:0">${body}</body></html>`);
  await page.addStyleTag({ content: css });
  await page.addScriptTag({ content: bundle });
  if (preScript) await page.evaluate(preScript);
  return { browser, page, errors, requests };
}

const expandedState = (page, selector = '#ed') => page.evaluate((sel) => {
  const node = document.querySelector(sel);
  const rect = node.getBoundingClientRect();
  return { attr: node.getAttribute('data-opf-expanded'), position: getComputedStyle(node).position, z: getComputedStyle(node).zIndex, rect: [rect.left, rect.top, rect.width, rect.height], viewport: [document.documentElement.clientWidth, window.innerHeight] };
}, selector);
const activeId = (page) => page.evaluate(() => document.activeElement?.id || document.activeElement?.tagName);

// ---------------------------------------------------------------------------------------------------------------------------------------
// Part 1: controller and button, mouse and keyboard.
let app = await start();
try {
  const { page, errors, requests } = app;
  await page.evaluate(() => {
    const { createExpandController, createExpandButton } = window.opfExpand;
    window.changes = [];
    window.statuses = [];
    window.ctl = createExpandController(document.getElementById('ed'), { onChange: (change) => window.changes.push(change.expanded), onStatus: (message) => window.statuses.push(message) });
    window.btn = createExpandButton(document.getElementById('bar'), { controller: window.ctl });
    window.parentOf = document.getElementById('ed').parentNode;
    window.indexOf = [...window.parentOf.children].indexOf(document.getElementById('ed'));
  });
  const button = page.locator('#bar .opf-expand-button');

  // The button.
  assert.equal(await button.evaluate((node) => node.tagName), 'BUTTON');
  assert.equal(await button.getAttribute('type'), 'button');
  assert.equal(await button.getAttribute('aria-pressed'), 'false');
  assert.equal(await button.getAttribute('aria-label'), 'Expand editor');
  assert.equal(await button.getAttribute('title'), 'Expand editor');
  assert.equal(await button.innerText(), '', 'icon-only');
  assert.deepEqual(await button.locator('svg[aria-hidden="true"] path').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('d'))), ['M15 3h6v6', 'm21 3-7 7', 'm3 21 7-7', 'M9 21H3v-6'], 'Lucide Maximize2');
  assert.deepEqual(await button.evaluate((node) => { const box = node.getBoundingClientRect(); return [box.width, box.height]; }), [32, 32], 'comfortable density is 32px');
  assert.equal(await expandedState(page).then((state) => state.attr), null, 'not expanded at first');
  mark('the button: a real icon button named "Expand editor", aria-pressed false, Lucide Maximize2, 32px');

  // Expand by mouse. Scroll the page first: the scroll position must survive.
  await page.evaluate(() => window.scrollTo(0, 200));
  assert.equal(await page.evaluate(() => window.scrollY), 200);
  await button.evaluate((node) => node.click()); // a script click: Playwright's own click would scroll the button into view first
  let state = await expandedState(page);
  assert.equal(state.attr, 'true');
  assert.equal(state.position, 'fixed');
  assert.deepEqual(state.rect, [0, 0, ...state.viewport], 'the overlay covers the viewport exactly');
  assert.equal(state.z, '1000', 'the default z-index');
  assert.equal(await page.evaluate(() => window.ctl.expanded), true);
  assert.deepEqual(await page.evaluate(() => window.changes), [true]);
  assert.deepEqual(await page.evaluate(() => window.statuses), ['Editor expanded. Press Escape to exit.']);
  assert.equal(await button.getAttribute('aria-pressed'), 'true');
  assert.equal(await button.getAttribute('aria-label'), 'Exit expanded editor');
  assert.equal(await button.getAttribute('title'), 'Exit expanded editor (Esc)', 'the tooltip names Escape');
  assert.deepEqual(await button.locator('svg path').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('d'))), ['m14 10 7-7', 'M20 10h-6V4', 'm3 21 7-7', 'M4 14h6v6'], 'Lucide Minimize2');
  assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).overflow), 'hidden', 'page scroll is locked');
  assert.equal(await page.evaluate(() => window.scrollY), 200, 'the page scroll position is untouched');
  assert.equal(await page.evaluate(() => { const node = document.getElementById('ed'); return node.parentNode === window.parentOf && [...window.parentOf.children].indexOf(node) === window.indexOf; }), true, 'the element keeps its place in the DOM');
  assert.equal(await page.evaluate(() => document.getElementById('ed').contains(document.activeElement)), true, 'the focus is inside the editor');
  assert.equal(await activeId(page), await button.evaluate((node) => node.id || node.tagName), 'the button that expanded keeps the focus (it is the exit control)');
  mark('click expands: fixed overlay over the viewport, z-index 1000, scroll locked, position and DOM place kept, focus inside, onChange/status, label and title');

  // The editor's content did not restart: a value typed before survives (it is the same node).
  await page.fill('#field', 'kept');
  await page.locator('#plain').focus();
  await page.keyboard.press('Escape');
  state = await expandedState(page);
  assert.equal(state.attr, null, 'Escape collapses');
  assert.deepEqual(state.rect, await page.evaluate(() => { const rect = document.getElementById('ed').getBoundingClientRect(); return [rect.left, rect.top, rect.width, rect.height]; }));
  assert.equal(state.rect[2], 400, 'the original size is back');
  assert.equal(await page.evaluate(() => document.documentElement.getAttribute('style')), null, 'the page had no inline style: none is left');
  assert.equal(await page.evaluate(() => window.scrollY), 200, 'the scroll position survived the whole trip');
  assert.equal(await page.inputValue('#field'), 'kept', 'the editor keeps its state');
  assert.deepEqual(await page.evaluate(() => window.changes), [true, false]);
  assert.equal(await activeId(page), await button.evaluate((node) => node.id || node.tagName), 'the focus returned to the control that expanded');
  assert.equal(await button.getAttribute('aria-pressed'), 'false');
  assert.equal(await button.getAttribute('aria-label'), 'Expand editor');
  assert.equal(await page.evaluate(() => document.getElementById('ed').hasAttribute('tabindex')), false, 'no tabindex is left behind');
  mark('Escape collapses: size, scroll, inline style and state restored, focus back on the button, onChange false');

  // Keyboard: Enter and Space on the focused button.
  await button.focus();
  await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(() => window.ctl.expanded), true, 'Enter expands');
  assert.equal(await activeId(page), await button.evaluate((node) => node.id || node.tagName));
  await page.keyboard.press('Space');
  assert.equal(await page.evaluate(() => window.ctl.expanded), false, 'Space collapses');
  assert.equal(await page.evaluate(() => document.activeElement === document.querySelector('#bar .opf-expand-button')), true, 'the focus stays on the button');
  mark('keyboard: Enter expands, Space collapses, the focus stays on the button');

  // Escape rules.
  await button.click();
  const stays = async (selector, why) => {
    await page.locator(selector).focus();
    await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(() => window.ctl.expanded), true, `Escape does not collapse ${why}`);
  };
  await stays('#field', 'inside a text input');
  await stays('#area', 'inside a textarea');
  await stays('#editable', 'inside a contenteditable');
  await stays('#cmline', 'inside a CodeMirror editor (.cm-editor)');
  await stays('#menuitem', 'inside a menu');
  await stays('#dlgbutton', 'inside an open dialog');
  await stays('#sel', 'on a select');
  mark('Escape does not collapse in an input, textarea, contenteditable, .cm-editor, menu, open dialog or select');
  // A checkbox is not a typing field.
  await page.locator('#check').focus();
  await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(() => window.ctl.expanded), false, 'Escape on a checkbox collapses');
  mark('Escape on a checkbox (not a typing field) collapses');

  // An event something already handled.
  await button.click();
  await page.evaluate(() => { window.handler = (event) => { if (event.key === 'Escape') event.preventDefault(); }; document.getElementById('plain').addEventListener('keydown', window.handler); });
  await page.locator('#plain').focus();
  await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(() => window.ctl.expanded), true, 'a defaultPrevented Escape is left alone');
  await page.evaluate(() => document.getElementById('plain').removeEventListener('keydown', window.handler));
  // A handler that stops it from reaching the document leaves it alone too.
  await page.evaluate(() => { window.stopper = (event) => event.stopPropagation(); document.getElementById('plain').addEventListener('keydown', window.stopper); });
  await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(() => window.ctl.expanded), true, 'a stopped Escape is left alone');
  await page.evaluate(() => document.getElementById('plain').removeEventListener('keydown', window.stopper));
  mark('Escape already handled (defaultPrevented or stopped) is left alone');

  // The presenter running: its element is a visible .opf-presenter. A hidden one does not count.
  await page.evaluate(() => { const node = document.createElement('div'); node.className = 'opf-presenter'; node.id = 'fake-presenter'; document.body.append(node); });
  await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(() => window.ctl.expanded), true, 'Escape belongs to the presenter while it runs');
  await page.evaluate(() => { document.getElementById('fake-presenter').hidden = true; });
  await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(() => window.ctl.expanded), false, 'a hidden presenter does not hold Escape');
  await page.evaluate(() => document.getElementById('fake-presenter').remove());
  mark('Escape belongs to a running presenter (.opf-presenter:not([hidden])); a hidden one does not hold it');

  // Escape with a modifier, or one that is not Escape, does nothing.
  await button.click();
  await page.locator('#plain').focus();
  await page.keyboard.press('Shift+Escape');
  await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(() => window.ctl.expanded), true);
  await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(() => window.ctl.expanded), false);
  mark('only a plain Escape collapses');

  // The return values.
  assert.deepEqual(await page.evaluate(() => [window.ctl.expand(), window.ctl.expand(true), window.ctl.toggle(), window.ctl.toggle(), window.ctl.expand(false), window.ctl.collapse()]), [true, true, false, true, false, false]);
  assert.deepEqual(await page.evaluate(() => window.changes.slice(-4)), [true, false, true, false], 'onChange fires once per change, not for a repeated call');
  mark('expand/collapse/toggle return the resulting state; onChange once per change');

  // Focus return from a control outside the editor, programmatically.
  await page.locator('#opener').focus();
  await page.evaluate(() => window.ctl.expand());
  assert.equal(await page.evaluate(() => document.getElementById('ed').contains(document.activeElement)), true, 'the focus moved into the editor');
  assert.equal(await activeId(page), 'ed', 'the editor itself takes it when no control inside does');
  assert.equal(await page.evaluate(() => document.getElementById('ed').getAttribute('tabindex')), '-1');
  await page.evaluate(() => window.ctl.collapse());
  assert.equal(await activeId(page), 'opener', 'the focus returned to the control outside the editor that expanded');
  mark('programmatic expand from an outside control: the focus goes in (the editor takes it) and comes back to that control');

  // A host that moved the focus in onChange keeps it.
  await page.evaluate(() => { window.ctl2 = window.opfExpand.createExpandController(document.getElementById('ed2'), { onChange: ({ expanded }) => { if (!expanded) document.getElementById('field').focus(); } }); });
  await page.locator('#opener').focus();
  await page.evaluate(() => { window.ctl2.expand(); window.ctl2.collapse(); });
  assert.equal(await activeId(page), 'field', 'a focus the host set is not taken back');
  await page.evaluate(() => window.ctl2.destroy());
  mark('a focus the host moved in onChange is not taken back');

  // The editor inside a dialog wrapper: the wrapper is its surroundings, not an open popup.
  await page.evaluate(() => { window.ctl2 = window.opfExpand.createExpandController(document.getElementById('ed2')); window.ctl2.expand(); });
  await page.locator('#plain2').focus();
  await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(() => window.ctl2.expanded), false, 'an editor inside a role=dialog wrapper still collapses on Escape');
  await page.evaluate(() => window.ctl2.destroy());
  mark('a dialog that contains the editor does not hold Escape');

  // Scroll lock restore, three starting points.
  for (const [setup, expectStyle] of [['scroll', 'overflow: scroll;'], ['y', 'overflow-y: scroll;'], ['important', 'overflow: auto !important;']]) {
    const before = await page.evaluate((kind) => {
      const style = document.documentElement.style;
      if (kind === 'scroll') style.overflow = 'scroll';
      else if (kind === 'y') style.overflowY = 'scroll';
      else style.setProperty('overflow', 'auto', 'important');
      return document.documentElement.getAttribute('style');
    }, setup);
    assert.equal(before, expectStyle);
    await page.evaluate(() => window.ctl.expand());
    assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).overflow), 'hidden', `${setup}: locked`);
    await page.evaluate(() => window.ctl.collapse());
    assert.equal(await page.evaluate(() => document.documentElement.getAttribute('style')), before, `${setup}: the inline style is exactly what it was`);
    await page.evaluate(() => document.documentElement.removeAttribute('style'));
  }
  mark('scroll lock restores the previous inline overflow exactly (shorthand, longhand, !important, none)');

  // axe on the button, expanded and not.
  await page.addScriptTag({ content: axeSource });
  for (const on of [false, true]) {
    await page.evaluate((flag) => window.ctl.expand(flag), on);
    const result = await page.evaluate(() => window.axe.run(document.getElementById('bar')));
    assert.deepEqual(result.violations.map((violation) => violation.id), [], `axe, expanded=${on}`);
  }
  await page.evaluate(() => window.ctl.collapse());
  mark('axe: no violations on the button, expanded or not');

  assert.deepEqual(errors, [], 'no page errors');
  assert.deepEqual(requests, [], 'no request left the page');
} finally {
  await app.browser.close();
}

// ---------------------------------------------------------------------------------------------------------------------------------------
// Part 2: full screen option, two controllers, destroy, menu entry, disabled, labels, density.
app = await start();
try {
  const { page, errors } = app;
  await page.evaluate(() => {
    window.helpers = () => window.opfExpand;
    window.make = (name, selector, barSelector, options = {}) => {
      const { createExpandController, createExpandButton } = window.opfExpand;
      const log = (window[`${name}Log`] = []);
      const controller = (window[name] = createExpandController(document.querySelector(selector), { ...options, onChange: ({ expanded }) => log.push(expanded) }));
      window[`${name}Button`] = createExpandButton(document.querySelector(barSelector), { controller, ...(options.button ?? {}) });
      return controller;
    };
  });

  // Full screen: a refusal falls back to the overlay silently.
  await page.evaluate(() => {
    window.make('a', '#ed', '#bar', { fullscreen: true });
    document.getElementById('ed').requestFullscreen = () => Promise.reject(new TypeError('Fullscreen request denied'));
  });
  await page.locator('#bar .opf-expand-button').click();
  await page.waitForTimeout(100);
  assert.equal(await page.evaluate(() => window.a.expanded), true, 'a refused full screen request still expands the overlay');
  assert.equal(await page.evaluate(() => document.fullscreenElement), null);
  assert.equal((await expandedState(page)).attr, 'true');
  await page.evaluate(() => window.a.collapse());
  // Missing API, and a document that says it is not enabled (an iframe without allow="fullscreen", iPhone Safari).
  await page.evaluate(() => { document.getElementById('ed').requestFullscreen = undefined; document.getElementById('ed').webkitRequestFullscreen = undefined; });
  await page.evaluate(() => window.a.expand());
  assert.equal(await page.evaluate(() => window.a.expanded), true, 'no Fullscreen API: the overlay');
  await page.evaluate(() => window.a.collapse());
  await page.evaluate(() => { delete document.getElementById('ed').requestFullscreen; delete document.getElementById('ed').webkitRequestFullscreen; Object.defineProperty(document, 'fullscreenEnabled', { configurable: true, get: () => false }); });
  await page.evaluate(() => window.a.expand());
  assert.equal(await page.evaluate(() => window.a.expanded), true, 'fullscreenEnabled false: the overlay');
  await page.evaluate(() => { window.a.collapse(); delete document.fullscreenEnabled; });
  // A request that throws synchronously.
  await page.evaluate(() => { document.getElementById('ed').requestFullscreen = () => { throw new Error('sync'); }; });
  await page.evaluate(() => window.a.expand());
  assert.equal(await page.evaluate(() => window.a.expanded), true, 'a synchronous throw falls back too');
  await page.evaluate(() => { window.a.collapse(); delete document.getElementById('ed').requestFullscreen; });
  assert.deepEqual(errors, [], 'the fallbacks are silent: no page errors, no unhandled rejections');
  mark('fullscreen option: a refused, missing, disabled or throwing Fullscreen API falls back to the overlay silently');

  // Full screen for real (the click is the user gesture).
  await page.locator('#bar .opf-expand-button').click();
  const gotFullscreen = await page.waitForFunction(() => document.fullscreenElement === document.getElementById('ed'), null, { timeout: 4000 }).then(() => true, () => false);
  if (gotFullscreen) {
    assert.equal(await page.evaluate(() => window.a.expanded), true);
    // The browser leaves full screen by itself: the editor collapses with it.
    await page.evaluate(() => document.exitFullscreen());
    await page.waitForFunction(() => !window.a.expanded, null, { timeout: 4000 });
    assert.equal((await expandedState(page)).attr, null);
    assert.equal(await page.evaluate(() => document.documentElement.getAttribute('style')), null, 'scroll lock released');
    assert.deepEqual(await page.evaluate(() => window.aLog.slice(-2)), [true, false]);
    mark('fullscreen: the browser leaving full screen on its own collapses the editor');
    // Another element takes the screen (the presenter does): the editor stays expanded as the overlay, and stays when that element leaves.
    await page.evaluate(() => {
      const other = document.createElement('div');
      other.id = 'other';
      other.textContent = 'another full screen element';
      document.body.append(other);
      document.addEventListener('keydown', window.takeOver = (event) => { if (event.key === 'F7') other.requestFullscreen(); });
    });
    await page.locator('#bar .opf-expand-button').click();
    await page.waitForFunction(() => document.fullscreenElement === document.getElementById('ed'), null, { timeout: 4000 });
    await page.keyboard.press('F7');
    await page.waitForFunction(() => document.fullscreenElement === document.getElementById('other'), null, { timeout: 4000 });
    await page.waitForTimeout(100);
    assert.equal(await page.evaluate(() => window.a.expanded), true, 'another element taking full screen leaves the editor expanded');
    await page.evaluate(() => document.exitFullscreen());
    await page.waitForTimeout(300);
    assert.equal(await page.evaluate(() => window.a.expanded), true, 'and it stays expanded when that element leaves');
    // Chromium keeps a stack: leaving the other element can return the screen to the editor, whose own exit then ends the expanded editor.
    if (await page.evaluate(() => document.fullscreenElement === document.getElementById('ed'))) {
      await page.evaluate(() => document.exitFullscreen());
      await page.waitForFunction(() => !window.a.expanded, null, { timeout: 4000 });
    }
    await page.evaluate(() => { document.removeEventListener('keydown', window.takeOver); document.getElementById('other').remove(); window.a.collapse(); });
    mark('fullscreen: another element (the presenter) taking and leaving full screen does not collapse the editor');
    // collapse() gives the screen back, and its own exit is not read as the browser leaving (one change).
    await page.locator('#bar .opf-expand-button').click();
    await page.waitForFunction(() => document.fullscreenElement === document.getElementById('ed'), null, { timeout: 4000 });
    const before = await page.evaluate(() => window.aLog.length);
    await page.evaluate(() => window.a.collapse());
    await page.waitForFunction(() => document.fullscreenElement === null, null, { timeout: 4000 });
    await page.waitForTimeout(100);
    assert.equal(await page.evaluate(() => window.aLog.length), before + 1, 'collapse() reports one change');
    assert.equal(await activeId(page), await page.locator('#bar .opf-expand-button').evaluate((node) => node.id || node.tagName), 'the focus is back on the button after the exit');
    // Collapse while the request is pending gives the screen back.
    await page.evaluate(() => { const real = document.getElementById('ed').requestFullscreen; document.getElementById('ed').requestFullscreen = function (...args) { return new Promise((resolve) => setTimeout(() => resolve(real.apply(this, args)), 150)); }; });
    await page.locator('#bar .opf-expand-button').click();
    await page.evaluate(() => window.a.collapse());
    await page.waitForTimeout(500);
    assert.equal(await page.evaluate(() => document.fullscreenElement), null, 'a request answered after the editor collapsed does not leave the page full screen');
    await page.evaluate(() => { delete document.getElementById('ed').requestFullscreen; });
    // Destroy while in full screen.
    await page.locator('#bar .opf-expand-button').click();
    await page.waitForFunction(() => document.fullscreenElement === document.getElementById('ed'), null, { timeout: 4000 });
    await page.evaluate(() => window.a.destroy());
    await page.waitForFunction(() => document.fullscreenElement === null, null, { timeout: 4000 });
    mark('fullscreen: collapse() and destroy() give the screen back, a late answer after collapsing does too, one change each');
  } else {
    mark('fullscreen: this browser build did not grant full screen under automation; only the fallbacks were exercised (NOT RUN: the real full screen paths)');
    await page.evaluate(() => window.a.destroy());
  }
  assert.deepEqual(errors, [], 'no page errors');
  await page.evaluate(() => { window.aButton.destroy(); });

  // Two controllers on one page, independent.
  await page.evaluate(() => {
    window.make('p', '#ed', '#bar');
    window.make('q', '#ed2', '#bar2');
    document.documentElement.style.overflow = 'scroll';
  });
  await page.locator('#bar .opf-expand-button').click();
  assert.equal(await page.evaluate(() => [window.p.expanded, window.q.expanded]).then(String), 'true,false');
  await page.locator('#bar2 .opf-expand-button').evaluate((node) => node.click()); // the first overlay covers it: a script click stands for the host's own shortcut
  assert.equal(await page.evaluate(() => [window.p.expanded, window.q.expanded]).then(String), 'false,true', 'expanding the second collapses the first');
  assert.equal((await expandedState(page, '#ed')).attr, null);
  assert.equal((await expandedState(page, '#ed2')).attr, 'true');
  assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).overflow), 'hidden', 'the page stays locked through the hand-over');
  assert.deepEqual(await page.evaluate(() => [window.pLog, window.qLog]), [[true, false], [true]]);
  assert.equal(await page.locator('#bar .opf-expand-button').getAttribute('aria-pressed'), 'false', 'the first button followed');
  assert.equal(await page.locator('#bar2 .opf-expand-button').getAttribute('aria-pressed'), 'true');
  // The first one's Escape listener is gone: one Escape collapses the second only.
  await page.locator('#plain2').focus();
  await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(() => [window.p.expanded, window.q.expanded]).then(String), 'false,false');
  assert.equal(await page.evaluate(() => document.documentElement.getAttribute('style')), 'overflow: scroll;', 'restored to what the page had before the first lock');
  assert.deepEqual(await page.evaluate(() => [window.pLog, window.qLog]), [[true, false], [true, false]]);
  // Collapsing the one that is not expanded does not touch the other.
  await page.evaluate(() => { window.q.expand(); window.p.collapse(); });
  assert.equal(await page.evaluate(() => window.q.expanded), true, 'collapsing an editor that is not expanded leaves the other alone');
  await page.evaluate(() => { window.q.collapse(); document.documentElement.removeAttribute('style'); });
  mark('two controllers: independent, the second hands over from the first, the page lock survives the hand-over and is restored once');

  // Destroy while expanded restores everything and stops listening.
  await page.evaluate(() => { document.documentElement.style.overflowX = 'scroll'; });
  const preStyle = await page.evaluate(() => document.documentElement.getAttribute('style'));
  await page.locator('#opener').focus();
  await page.evaluate(() => window.p.expand());
  await page.evaluate(() => { window.pBefore = window.pLog.length; window.p.destroy(); window.p.destroy(); });
  assert.equal((await expandedState(page)).attr, null, 'destroy removes the attribute');
  assert.equal(await page.evaluate(() => document.documentElement.getAttribute('style')), preStyle, 'destroy restores the page scroll');
  assert.equal(await activeId(page), 'opener', 'destroy returns the focus');
  assert.equal(await page.evaluate(() => document.getElementById('ed').hasAttribute('tabindex')), false);
  assert.equal(await page.evaluate(() => window.pLog.length === window.pBefore), true, 'destroy does not call onChange');
  assert.equal(await page.evaluate(() => [window.p.expand(), window.p.toggle(), window.p.collapse(), window.p.expanded]).then(String), 'false,false,false,false', 'a destroyed controller does nothing');
  assert.equal((await expandedState(page)).attr, null);
  await page.evaluate(() => { window.pButton.destroy(); window.pButton.destroy(); });
  assert.equal(await page.locator('#bar .opf-expand-button').count(), 0, 'button.destroy() removes the element');
  await page.evaluate(() => { document.documentElement.removeAttribute('style'); });
  // A destroyed controller no longer listens for Escape: expand another one on the same document and check nothing throws.
  await page.evaluate(() => { window.q.expand(); });
  await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(() => window.q.expanded), false);
  mark('destroy while expanded: attribute, scroll, tabindex and focus restored, no onChange, safe twice, inert afterwards, button removed');

  // The menu entry.
  await page.evaluate(() => { window.make('m', '#ed', '#bar'); window.items = () => window.mButton.menuItems(); });
  let items = await page.evaluate(() => window.items().map(({ id, label, pressed, disabled }) => ({ id, label, pressed, disabled })));
  assert.deepEqual(items, [{ id: 'expand', label: 'Expand editor', pressed: false, disabled: undefined }]);
  await page.evaluate(() => window.items()[0].run());
  assert.equal(await page.evaluate(() => window.m.expanded), true, 'run() toggles');
  items = await page.evaluate(() => window.items().map(({ id, label, pressed }) => ({ id, label, pressed })));
  assert.deepEqual(items, [{ id: 'expand', label: 'Exit expanded editor', pressed: true }]);
  mark('menuItems(): one { id: "expand", label, pressed, run } entry that follows the state');

  // Disabled: cannot expand, can always exit.
  await page.evaluate(() => window.m.collapse());
  await page.evaluate(() => window.mButton.setDisabled(true));
  const mbutton = page.locator('#bar .opf-expand-button');
  assert.equal(await mbutton.getAttribute('aria-disabled'), 'true');
  await mbutton.click({ force: true }); // Playwright reads aria-disabled as not enabled
  assert.equal(await page.evaluate(() => window.m.expanded), false, 'a disabled button does not expand');
  assert.equal(await page.evaluate(() => window.mButton.menuItems()[0].disabled), true);
  await page.evaluate(() => window.m.expand());
  assert.equal(await mbutton.getAttribute('aria-disabled'), null, 'no disabled look while expanded: the exit must stay usable');
  await mbutton.click();
  assert.equal(await page.evaluate(() => window.m.expanded), false, 'a disabled button still exits an expanded editor');
  await page.evaluate(() => window.mButton.setDisabled(false));
  assert.equal(await mbutton.getAttribute('aria-disabled'), null);
  mark('setDisabled: no expanding while disabled, but an expanded editor can always exit');

  // Density.
  const size = () => mbutton.evaluate((node) => { const box = node.getBoundingClientRect(); return [box.width, box.height]; });
  await page.evaluate(() => window.mButton.setDensity('touch'));
  assert.deepEqual(await size(), [40, 40], 'touch density is 40px on a fine pointer');
  await page.evaluate(() => window.mButton.setDensity('comfortable'));
  assert.deepEqual(await size(), [32, 32]);
  await page.evaluate(() => { window.m.destroy(); window.mButton.destroy(); });

  // Labels.
  await page.evaluate(() => {
    const { createExpandController, createExpandButton } = window.opfExpand;
    window.q.destroy(); window.qButton.destroy();
    window.l = createExpandController(document.getElementById('ed'), { labels: { expand: 'Agrandir', collapse: 'Reduire', escape: 'Echap', expanded: 'Agrandi', collapsed: 'Reduit' }, onStatus: (message) => (window.lastStatus = message) });
    window.lButton = createExpandButton(document.getElementById('bar'), { controller: window.l });
    window.lButton2 = createExpandButton(document.getElementById('bar2'), { controller: window.l, labels: { expand: 'Plein ecran' } });
  });
  assert.equal(await page.locator('#bar .opf-expand-button').getAttribute('aria-label'), 'Agrandir');
  assert.equal(await page.locator('#bar2 .opf-expand-button').getAttribute('aria-label'), 'Plein ecran', 'the button labels override the controller labels');
  await page.evaluate(() => window.l.expand());
  assert.equal(await page.locator('#bar .opf-expand-button').getAttribute('aria-label'), 'Reduire');
  assert.equal(await page.locator('#bar .opf-expand-button').getAttribute('title'), 'Reduire (Echap)');
  assert.equal(await page.evaluate(() => window.lastStatus), 'Agrandi');
  await page.evaluate(() => window.l.collapse());
  assert.equal(await page.evaluate(() => window.lastStatus), 'Reduit');
  await page.evaluate(() => { window.l.destroy(); window.lButton.destroy(); window.lButton2.destroy(); });
  mark('labels: the controller\'s apply to its buttons, a button can override them, statuses use them');

  // Argument errors.
  const thrown = await page.evaluate(() => {
    const { createExpandController, createExpandButton } = window.opfExpand;
    const out = [];
    for (const call of [() => createExpandController(null), () => createExpandButton(document.body, {}), () => createExpandButton(document.body, { controller: {} }), () => createExpandButton(null, { controller: window.l })]) {
      try { call(); out.push('no throw'); } catch (error) { out.push(error.constructor.name); }
    }
    return out;
  });
  assert.deepEqual(thrown, ['TypeError', 'TypeError', 'TypeError', 'TypeError']);
  mark('bad arguments throw a TypeError');

  assert.deepEqual(errors, [], 'no page errors');
} finally {
  await app.browser.close();
}

// ---------------------------------------------------------------------------------------------------------------------------------------
// Part 3: an iframe (the part uses target.ownerDocument).
app = await start();
try {
  const { page, errors } = app;
  await page.evaluate(() => {
    const frame = document.createElement('iframe');
    frame.id = 'frame';
    frame.style.cssText = 'width:600px;height:400px;border:0';
    frame.srcdoc = '<!doctype html><body style="margin:0;height:1500px"><div id="fed" class="opf-ui" style="width:300px;height:200px"><div id="fbar"></div><input id="finput" aria-label="Field"><button id="fplain">plain</button></div><button id="fout">out</button>';
    document.body.append(frame);
    window.frameReady = new Promise((resolve) => frame.addEventListener('load', resolve));
  });
  await page.evaluate(() => window.frameReady);
  const frame = page.frames().find((candidate) => candidate !== page.mainFrame());
  await frame.evaluate((styles) => { const style = document.createElement('style'); style.textContent = styles; document.head.append(style); }, css);
  await page.evaluate(() => {
    const doc = document.getElementById('frame').contentDocument;
    window.fctl = window.opfExpand.createExpandController(doc.getElementById('fed'));
    window.fbtn = window.opfExpand.createExpandButton(doc.getElementById('fbar'), { controller: window.fctl });
  });
  await frame.locator('#fbar .opf-expand-button').click();
  const inner = await frame.evaluate(() => { const rect = document.getElementById('fed').getBoundingClientRect(); return { rect: [rect.left, rect.top, rect.width, rect.height], viewport: [document.documentElement.clientWidth, window.innerHeight], overflow: getComputedStyle(document.documentElement).overflow, active: document.activeElement.className }; });
  assert.deepEqual(inner.rect, [0, 0, ...inner.viewport], 'inside the iframe the overlay fills the iframe');
  assert.equal(inner.overflow, 'hidden', 'the iframe document is locked');
  assert.equal(await frame.evaluate(() => document.getElementById('fout').hasAttribute('inert')), true, 'inside the iframe the page outside the editor is inert');
  assert.equal(await page.evaluate(() => document.querySelectorAll('[inert]').length), 0, 'the outer page has no inert');
  assert.equal(inner.active, 'opf-expand-button opf-ui', 'the focus is in the iframe');
  assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).overflow), 'visible', 'the outer page is not locked');
  assert.equal(await page.evaluate(() => document.documentElement.hasAttribute('style')), false);
  await frame.locator('#finput').focus();
  await frame.page().keyboard.press('Escape');
  assert.equal(await page.evaluate(() => window.fctl.expanded), true, 'Escape in an iframe input is left alone');
  await frame.locator('#fplain').focus();
  await frame.page().keyboard.press('Escape');
  assert.equal(await page.evaluate(() => window.fctl.expanded), false, 'Escape in the iframe collapses');
  assert.equal(await frame.evaluate(() => document.documentElement.getAttribute('style')), null);
  assert.equal(await frame.evaluate(() => document.querySelectorAll('[inert]').length), 0, 'the iframe marks are gone');
  assert.equal(await frame.evaluate(() => document.activeElement.className), 'opf-expand-button opf-ui', 'the focus returned to the button inside the iframe');
  assert.deepEqual(errors, []);
  mark('iframe: the overlay, scroll lock, Escape and focus use the iframe document; the outer page is untouched');
} finally {
  await app.browser.close();
}

// ---------------------------------------------------------------------------------------------------------------------------------------
// Part 4: sizes under a coarse pointer.
app = await start({ touch: true, viewport: { width: 390, height: 780 } });
try {
  const { page, errors } = app;
  assert.equal(await page.evaluate(() => matchMedia('(pointer: coarse)').matches), true, 'the page sees a coarse pointer');
  await page.evaluate(() => {
    const { createExpandController, createExpandButton } = window.opfExpand;
    window.tctl = createExpandController(document.getElementById('ed'));
    window.t1 = createExpandButton(document.getElementById('bar'), { controller: window.tctl });
    window.t2 = createExpandButton(document.getElementById('bar2'), { controller: window.tctl, density: 'touch' });
  });
  for (const selector of ['#bar .opf-expand-button', '#bar2 .opf-expand-button']) {
    const box = await page.locator(selector).evaluate((node) => { const rect = node.getBoundingClientRect(); return [rect.width, rect.height]; });
    assert.ok(box[0] >= 44 && box[1] >= 44, `${selector} is at least 44px under a coarse pointer (${box})`);
  }
  await page.locator('#bar .opf-expand-button').tap();
  const state = await expandedState(page);
  assert.deepEqual(state.rect, [0, 0, ...state.viewport], 'tap expands to the phone viewport');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), true, 'no sideways scroll');
  await page.locator('#bar .opf-expand-button').tap();
  assert.equal(await page.evaluate(() => window.tctl.expanded), false, 'tap collapses');
  assert.deepEqual(errors, []);
  mark('touch: 44px under a coarse pointer for both densities; tap expands and collapses at phone size');
} finally {
  await app.browser.close();
}

// ---------------------------------------------------------------------------------------------------------------------------------------
// Part 5: the page behind the overlay is inert (inertOutside, keep).
app = await start();
try {
  const { page, errors } = app;
  await page.evaluate(() => {
    document.body.insertAdjacentHTML('beforeend', `
      <div id="host-toolbar"><button id="tb">Host toolbar</button></div>
      <div id="pre" inert><button id="pre-btn">page inert</button></div>
      <div id="deep"><div id="deep-a"><button id="keepme">kept</button></div><button id="deep-b">deep b</button></div>
      <template id="tpl"></template><style id="st"></style><script id="sc"></script>`);
    const { createExpandController } = window.opfExpand;
    const name = (node) => node.id || node.tagName;
    window.ids = () => [...document.querySelectorAll('[inert]')].map(name).sort();
    // What a full mark would be: every other child of body that is content (the spacer has no id).
    window.otherChildren = () => [...document.body.children].filter((node) => node.id !== 'ed' && !['SCRIPT', 'STYLE', 'TEMPLATE'].includes(node.tagName)).map(name).sort();
    window.plain = createExpandController(document.getElementById('ed'));
    window.kept = createExpandController(document.getElementById('ed'), { keep: () => [document.getElementById('keepme')] });
    window.off = createExpandController(document.getElementById('ed'), { inertOutside: false });
    window.second = createExpandController(document.getElementById('ed2'));
  });
  const inertIds = () => page.evaluate(() => window.ids());
  const where = () => page.evaluate(() => { const active = document.activeElement; return active.closest('#ed') ? 'in-editor' : (active === document.body || active === document.documentElement ? 'body' : active.id || active.tagName); });
  assert.deepEqual(await inertIds(), ['pre'], 'only the page\'s own inert at first');

  // The default: everything outside the target is inert; the page's own inert is untouched; non-content elements are skipped.
  await page.evaluate(() => window.plain.expand());
  assert.deepEqual(await inertIds(), await page.evaluate(() => window.otherChildren()), 'every sibling of the target is inert');
  assert.equal(await page.evaluate(() => ['tpl', 'st', 'sc'].some((id) => document.getElementById(id).hasAttribute('inert'))), false, 'template, style and script are left alone');
  assert.equal(await page.evaluate(() => document.getElementById('ed').hasAttribute('inert') || document.body.hasAttribute('inert')), false, 'the target and body are not inert');
  // Tab cycles only inside the editor.
  await page.locator('#plain').evaluate((node) => node.focus());
  const seen = new Set();
  for (let step = 0; step < 24; step++) { await page.keyboard.press('Tab'); seen.add(await where()); }
  assert.deepEqual([...seen].filter((name) => name !== 'in-editor' && name !== 'body'), [], 'Tab never leaves the editor while expanded');
  assert.ok(seen.has('in-editor'));
  const seenBack = new Set();
  for (let step = 0; step < 24; step++) { await page.keyboard.press('Shift+Tab'); seenBack.add(await where()); }
  assert.deepEqual([...seenBack].filter((name) => name !== 'in-editor' && name !== 'body'), [], 'Shift+Tab never leaves the editor');
  mark('inert: every sibling of the target is inert, template/style/script and the page\'s own inert are left alone, Tab and Shift+Tab stay in the editor');
  await page.evaluate(() => window.plain.collapse());
  assert.deepEqual(await inertIds(), ['pre'], 'collapse restores exactly: the page\'s own inert stays, ours is gone');
  mark('inert: collapse removes only the marks it made; the page\'s own inert stays');

  // keep: an element outside stays reachable, with its containers; its siblings do not.
  await page.evaluate(() => window.kept.expand());
  assert.equal(await page.evaluate(() => ['keepme', 'deep', 'deep-a'].some((id) => document.getElementById(id).hasAttribute('inert'))), false, 'the kept element and its containers are not inert');
  assert.equal(await page.evaluate(() => document.getElementById('deep-b').hasAttribute('inert')), true, 'what is next to a kept element is');
  assert.equal(await page.evaluate(() => ['opener', 'host-toolbar', 'top', 'wrapper'].every((id) => document.getElementById(id).hasAttribute('inert'))), true);
  await page.locator('#plain').evaluate((node) => node.focus());
  const reached = new Set();
  for (let step = 0; step < 24; step++) { await page.keyboard.press('Tab'); reached.add(await where()); }
  assert.ok(reached.has('keepme'), 'Tab reaches the kept element');
  assert.deepEqual([...reached].filter((name) => !['in-editor', 'body', 'keepme'].includes(name)), [], 'and nothing else outside');
  await page.evaluate(() => window.kept.collapse());
  assert.deepEqual(await inertIds(), ['pre']);
  // An array, with a null and an element inside the target (nothing to keep there) in it.
  await page.evaluate(() => { window.arr = window.opfExpand.createExpandController(document.getElementById('ed'), { keep: [document.getElementById('tb'), document.getElementById('plain'), null] }); window.arr.expand(); });
  assert.deepEqual(await inertIds(), (await page.evaluate(() => window.otherChildren())).filter((id) => id !== 'host-toolbar'), 'keep as an array: the toolbar container is not inert');
  await page.evaluate(() => window.arr.destroy());
  assert.deepEqual(await inertIds(), ['pre'], 'destroy while expanded restores');
  mark('inert: keep (a function or an array) leaves a toolbar outside the target reachable by Tab, its containers un-inert and its siblings inert; destroy restores');

  // inertOutside: false.
  await page.evaluate(() => window.off.expand());
  assert.deepEqual(await inertIds(), ['pre'], 'inertOutside: false marks nothing');
  await page.evaluate(() => window.off.collapse());
  mark('inert: inertOutside false marks nothing');

  // Hand-over between two controllers.
  await page.evaluate(() => window.plain.expand());
  const first = await inertIds();
  assert.ok(first.includes('wrapper') && !first.includes('ed'));
  await page.evaluate(() => window.second.expand());
  assert.equal(await page.evaluate(() => window.plain.expanded), false);
  const handed = await inertIds();
  assert.ok(handed.includes('ed') && handed.includes('pre') && handed.includes('opener'), 'the incoming editor marks the page, including the outgoing editor\'s element');
  assert.ok(!handed.includes('wrapper') && !handed.includes('ed2'), 'and leaves its own ancestors alone: no mark of the outgoing editor remains');
  await page.evaluate(() => window.second.collapse());
  assert.deepEqual(await inertIds(), ['pre'], 'after the hand-over and a collapse only the page\'s own inert is left');
  mark('inert: hand-over between two editors leaves no stale mark and never touches the page\'s own inert');

  // An element added while expanded is not tracked (documented); a mounted presenter is left usable.
  await page.evaluate(() => window.plain.expand());
  await page.evaluate(() => { const late = document.createElement('button'); late.id = 'late'; document.body.append(late); });
  assert.equal(await page.evaluate(() => document.getElementById('late').hasAttribute('inert')), false, 'an element added while expanded is not inert (documented)');
  await page.evaluate(() => { window.plain.destroy(); document.getElementById('late').remove(); });
  assert.deepEqual(await inertIds(), ['pre']);
  await page.evaluate(() => { const node = document.createElement('div'); node.className = 'opf-presenter'; node.id = 'pres'; node.hidden = true; document.body.append(node); window.second.expand(); });
  assert.equal(await page.evaluate(() => document.getElementById('pres').hasAttribute('inert')), false, 'a mounted presenter is not made inert');
  await page.evaluate(() => window.second.collapse());
  assert.deepEqual(await inertIds(), ['pre']);
  mark('inert: an element added while expanded and a mounted presenter are not made inert');
  assert.deepEqual(errors, []);
} finally {
  await app.browser.close();
}

console.log(`editor expand checks passed (${checks.length}):\n- ${checks.join('\n- ')}`);
