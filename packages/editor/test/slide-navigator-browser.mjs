import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { loadFonts } from '@openpresentation/opf-render/fonts-node';
import { startPlayground } from './support/playground-harness.mjs';
import { buildStyles } from '../scripts/build-styles.mjs';

// RR-98 in a real browser: the slide navigator (previous and next buttons with a "01 / 03" counter) and the thumbnail strip.
// Part 1 runs them inside the built playground (npm run build:playground): navigation and counter, page-level and focused keys, real
// thumbnails that follow an edit and an undo, the active item, and the shape of the strip. Part 2 mounts both on a bare page with the
// renderer's browser fonts handle: touch density, the vertical strip, a long deck (wide counter, lazy drawing, scrolling to the active
// item), the no-observer path, and destroy.
const axeSource = readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');
const checks = [];
const mark = (name) => checks.push(name);
const source = {
  name: 'Navigator fixture',
  language: 'en-US',
  design: { theme: 'classic', fontScheme: 'roboto' },
  slides: [
    { id: 'a', title: 'Alpha', text: 'First words' },
    { id: 'b', title: 'Beta', text: 'Second words' },
    { id: 'c', text: 'Third words, no title' },
  ],
};

// --- part 1: inside the playground --------------------------------------------------------------------------------------------
const app = await startPlayground({ source });
try {
  const { page, errors, settle, load } = app;
  const counter = page.locator('#slide-nav .opf-nav-counter');
  const prev = page.locator('#slide-nav [data-action="previous"]');
  const next = page.locator('#slide-nav [data-action="next"]');
  const items = page.locator('#thumb-strip .opf-thumbs-item');
  const frames = page.locator('#thumb-strip .opf-thumbs-frame');
  const slideTitle = () => page.locator('#slide-title').textContent();
  const settleStrip = (count = 3) => page.waitForFunction((expected) => document.querySelectorAll('#thumb-strip .opf-thumbs-frame[data-state="ready"]').length === expected, count, { timeout: 30000 });

  // Navigation and the counter.
  await settleStrip();
  assert.equal(await counter.textContent(), '01 / 03');
  assert.equal(await prev.isDisabled(), true, 'previous is disabled on the first slide');
  assert.equal(await next.isEnabled(), true);
  assert.equal(await prev.getAttribute('aria-label'), 'Previous slide');
  assert.equal(await next.getAttribute('aria-label'), 'Next slide');
  mark('the counter starts at 01 / 03 with previous disabled');
  await next.click();
  await settle();
  assert.equal(await counter.textContent(), '02 / 03');
  assert.equal(await slideTitle(), 'Beta', 'next shows the second slide on the canvas');
  assert.equal(await page.locator('#page-position').textContent(), 'Slide 2 of 3');
  await next.click();
  await settle();
  assert.equal(await counter.textContent(), '03 / 03');
  assert.equal(await next.isDisabled(), true, 'next is disabled on the last slide');
  assert.equal(await prev.isEnabled(), true);
  assert.equal(await page.evaluate(() => document.activeElement?.dataset.action), 'previous', 'focus moves to the other button when the pressed one disables');
  await prev.click();
  await settle();
  assert.equal(await counter.textContent(), '02 / 03');
  assert.equal(await slideTitle(), 'Beta');
  mark('previous and next move the canvas and the counter, and disable at the ends');

  // Keyboard: arrows with the navigator focused.
  await next.focus();
  await page.keyboard.press('End');
  await settle();
  assert.equal(await counter.textContent(), '03 / 03');
  await page.keyboard.press('ArrowLeft');
  await settle();
  assert.equal(await counter.textContent(), '02 / 03');
  await page.keyboard.press('Home');
  await settle();
  assert.equal(await counter.textContent(), '01 / 03');
  await page.keyboard.press('ArrowRight');
  await settle();
  assert.equal(await counter.textContent(), '02 / 03', 'one press of an arrow moves one slide (the page-level binding does not repeat it)');
  mark('arrow keys, Home and End work while the navigator has focus');

  // Keyboard: page-level arrows, and typing is left alone.
  await page.evaluate(() => document.activeElement?.blur());
  await page.keyboard.press('ArrowRight');
  await settle();
  assert.equal(await counter.textContent(), '03 / 03', 'a page-level ArrowRight goes to the next slide');
  await page.keyboard.press('ArrowLeft');
  await settle();
  assert.equal(await counter.textContent(), '02 / 03');
  await page.locator('#document-name').focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowLeft');
  await page.locator('#notes').focus();
  await page.keyboard.press('ArrowRight');
  assert.equal(await counter.textContent(), '02 / 03', 'arrows in an input or a textarea do not change the slide');
  await page.evaluate(() => document.activeElement?.blur());
  await page.keyboard.press('Control+ArrowRight');
  assert.equal(await counter.textContent(), '02 / 03', 'a modified arrow is left to the page');
  mark('page-level arrows navigate and ignore typing in inputs and editors');

  // Thumbnails: real renders, an index and a title each.
  await settleStrip();
  assert.equal(await items.count(), 3);
  assert.deepEqual(await page.locator('#thumb-strip .opf-thumbs-index').allTextContents(), ['01', '02', '03']);
  assert.deepEqual(await page.locator('#thumb-strip .opf-thumbs-title').allTextContents(), ['Alpha', 'Beta', 'Untitled']);
  assert.equal(await page.locator('#thumb-strip .opf-thumbs-frame > svg').count(), 3, 'every thumbnail is an SVG render');
  assert.match(await frames.nth(0).textContent(), /Alpha/, 'the thumbnail is the slide drawn, not a placeholder');
  assert.match(await frames.nth(1).textContent(), /Beta/);
  assert.match(await frames.nth(2).textContent(), /Third words/);
  assert.equal(await page.locator('nav.opf-thumbs').getAttribute('aria-label'), 'Slide thumbnails');
  assert.equal(await page.locator('nav.opf-thumbs').getAttribute('data-orientation'), 'horizontal', 'horizontal is the default');
  assert.equal(await items.nth(0).getAttribute('aria-label'), null, 'an item is named by its own text (number and title)');
  mark('the strip shows a real render, a mono index and the title (Untitled when there is none) for each slide');

  // The active item: aria-current and the accent ring, following the navigator and a click.
  const current = () => page.locator('#thumb-strip .opf-thumbs-item[aria-current="true"] .opf-thumbs-index').allTextContents();
  assert.deepEqual(await current(), ['02'], 'the slide on the canvas is the active item');
  const ring = await items.nth(1).locator('.opf-thumbs-frame').evaluate((node) => getComputedStyle(node).outlineStyle + ' ' + getComputedStyle(node).outlineWidth);
  assert.equal(ring, 'solid 2px', 'the active thumbnail has a 2px ring');
  const quiet = await items.nth(0).locator('.opf-thumbs-frame').evaluate((node) => getComputedStyle(node).outlineColor);
  const accent = await items.nth(1).locator('.opf-thumbs-frame').evaluate((node) => getComputedStyle(node).outlineColor);
  assert.notEqual(quiet, accent, 'only the active thumbnail has the accent ring');
  await next.click();
  await settle();
  assert.deepEqual(await current(), ['03'], 'the navigator moves the active item');
  await items.nth(0).click();
  await settle();
  assert.equal(await slideTitle(), 'Alpha', 'clicking a thumbnail shows that slide');
  assert.deepEqual(await current(), ['01']);
  assert.equal(await counter.textContent(), '01 / 03', 'and the counter follows');
  await items.nth(2).focus();
  await page.keyboard.press('Enter');
  await settle();
  assert.equal(await slideTitle(), 'Untitled slide', 'Enter on a focused thumbnail chooses it');
  assert.deepEqual(await current(), ['03']);
  // Roving focus: arrows move along the strip, one tab stop.
  assert.equal(await page.locator('#thumb-strip .opf-thumbs-item[tabindex="0"]').count(), 1, 'the strip is one tab stop');
  await items.nth(2).focus();
  await page.keyboard.press('ArrowLeft');
  assert.equal(await page.evaluate(() => document.activeElement?.querySelector('.opf-thumbs-index')?.textContent), '02', 'ArrowLeft moves focus to the previous thumbnail');
  assert.deepEqual(await current(), ['03'], 'moving focus does not change the slide');
  assert.equal(await counter.textContent(), '03 / 03');
  await page.keyboard.press('Home');
  assert.equal(await page.evaluate(() => document.activeElement?.querySelector('.opf-thumbs-index')?.textContent), '01');
  mark('the active thumbnail has aria-current and the accent ring, and clicks, Enter and the navigator keep them in step');

  // Editing re-renders only the slide that changed.
  await items.nth(0).click();
  await settle();
  await page.evaluate(() => { document.querySelectorAll('#thumb-strip .opf-thumbs-frame > svg').forEach((svg, index) => { svg.dataset.keep = String(index); }); });
  await page.locator('#value').fill('Alpha edited');
  await page.getByRole('button', { name: 'Apply edit' }).click();
  await page.waitForFunction(() => document.querySelector('#thumb-strip .opf-thumbs-title')?.textContent === 'Alpha edited', undefined, { timeout: 15000 });
  await page.waitForFunction(() => /Alpha edited/.test(document.querySelector('#thumb-strip .opf-thumbs-frame')?.textContent ?? ''), undefined, { timeout: 15000 });
  const kept = await page.evaluate(() => [...document.querySelectorAll('#thumb-strip .opf-thumbs-frame > svg')].map((svg) => svg.dataset.keep ?? 'new'));
  assert.deepEqual(kept, ['new', '1', '2'], 'only the edited slide\'s thumbnail was replaced');
  assert.equal(await items.count(), 3);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('#thumb-strip .opf-thumbs-title')?.textContent === 'Alpha' && /Alpha(?! edited)/.test(document.querySelector('#thumb-strip .opf-thumbs-frame')?.textContent ?? ''), undefined, { timeout: 15000 });
  mark('an edit re-renders only the edited slide\'s thumbnail, and Undo restores it');

  // The deck changing shape: add a slide, then load a one-slide deck.
  await page.locator('#add').click();
  await page.waitForFunction(() => document.querySelectorAll('#thumb-strip .opf-thumbs-item').length === 4, undefined, { timeout: 15000 });
  await settleStrip(4);
  await page.waitForFunction(() => document.querySelector('#thumb-strip .opf-thumbs-item[aria-current="true"] .opf-thumbs-index')?.textContent === '04', undefined, { timeout: 15000 });
  assert.equal(await counter.textContent(), '04 / 04', 'the count follows the session and the new slide is current');
  await load({ name: 'Single', design: { theme: 'classic', fontScheme: 'roboto' }, slides: [{ id: 'only', title: 'Only', text: 'One slide' }] });
  await page.waitForFunction(() => document.querySelectorAll('#thumb-strip .opf-thumbs-item').length === 1, undefined, { timeout: 15000 });
  assert.equal(await counter.textContent(), '01 / 01');
  assert.equal(await prev.isDisabled() && await next.isDisabled(), true, 'both buttons are disabled with one slide');
  mark('the count, counter and strip follow slides added or replaced in the session');

  // axe-core on the new controls: no WCAG 2.x A/AA or best-practice violation (names, roles, contrast).
  await load(source);
  await settleStrip();
  await page.addScriptTag({ content: axeSource }).catch(() => {});
  const result = await page.evaluate(() => window.axe.run({ include: [['.slide-dock']] }, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] } }));
  assert.deepEqual(result.violations.map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(' ')).join(' | ')}`), [], 'axe: the navigator and the strip');
  mark('axe finds no violation in the navigator and the strip');

  // The existing slide list is still there beside them.
  assert.equal(await page.locator('#slide-list .slide-card').count(), 3);
  assert.deepEqual(errors, []);
} finally {
  await app.close();
}

// --- part 2: bare page with the renderer's browser fonts handle ----------------------------------------------------------------
const faces = (await loadFonts({ pack: 'office' })).registry.embeddedFonts.filter((face) => face.family === 'Roboto' && [400, 700].includes(face.weight) && !face.italic);
const root = fileURLToPath(new URL('../', import.meta.url));
const bundled = await build({ stdin: { resolveDir: root, contents: `
  import { createEditorSession } from './src/index.js';
  import { createSlideNavigator, formatSlideCounter } from './src/slide-navigator.js';
  import { createThumbnailStrip } from './src/thumbnail-strip.js';
  import { loadFonts } from '@openpresentation/opf-render/fonts-browser';
  import { gallery } from '@openpresentation/gallery';
  window.opfNav = { createEditorSession, createSlideNavigator, createThumbnailStrip, formatSlideCounter, gallery, loadFonts };
` }, bundle: true, platform: 'browser', format: 'iife', write: false, minify: true });
// The same stylesheet the package ships (tokens first, then every component file), on an `.opf-ui` body like the playground.
const css = (await buildStyles(new URL('../src/styles/', import.meta.url))).css;

let browser;
try {
  browser = await chromium.launch({ channel: process.platform === 'win32' && !process.env.CI ? 'msedge' : undefined });
  const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.stack ?? error.message));
  page.on('console', (message) => { if (message.type() === 'error' && !/Failed to load resource/.test(message.text())) errors.push(message.text()); });
  await page.setContent('<!doctype html><meta charset="utf-8"><body class="opf-ui" style="margin:0"><div id="nav-a"></div><div id="nav-b"></div><div id="nav-c"></div><div id="strip-a" style="width:600px"></div><div id="strip-b" style="width:600px"></div><div id="strip-c" style="width:600px"></div><div id="strip-v" style="width:200px;height:300px;display:flex;flex-direction:column"></div></body>');
  await page.addStyleTag({ content: css });
  await page.addScriptTag({ content: bundled.outputFiles[0].text });
  await page.evaluate(async (fontFaces) => {
    const { createEditorSession, gallery, loadFonts } = window.opfNav;
    window.fonts = await loadFonts({ faces: fontFaces.map((face) => ({ ...face, data: Uint8Array.from(atob(face.dataUrl.split(',')[1]), (c) => c.charCodeAt(0)) })), substitutionPolicy: 'visual', fallbackFamily: 'Roboto' });
    window.makeDeck = (count, name = 'Long deck') => ({ name, design: { theme: 'classic', fontScheme: 'roboto' }, slides: Array.from({ length: count }, (_, index) => ({ id: `s${index + 1}`, title: `Slide ${index + 1}`, text: `Words on slide ${index + 1}` })) });
    window.makeEditor = (count) => createEditorSession(window.makeDeck(count), { rejectInvalid: true, catalogs: [gallery] });
  }, faces);
  const ui = (fn, arg) => page.evaluate(fn, arg);

  // Counter format, touch density, presentation option, bindKeys unbinding, destroy.
  assert.deepEqual(await ui(() => [[0, 3], [2, 3], [4, 99], [98, 99], [99, 100], [0, 100], [11, 120], [0, 0], [4, 1000]].map(([index, count]) => window.opfNav.formatSlideCounter(index, count))),
    ['01 / 03', '03 / 03', '05 / 99', '99 / 99', '100 / 100', '001 / 100', '012 / 120', '00 / 00', '0005 / 1000'], 'two digits, wider from 100 slides');
  await ui(() => {
    const { createSlideNavigator } = window.opfNav;
    window.deckA = window.makeDeck(5);
    window.changesA = [];
    window.navA = createSlideNavigator(document.querySelector('#nav-a'), { presentation: () => window.deckA, slideIndex: 1, onChange: (index) => window.changesA.push(index) });
    window.navB = createSlideNavigator(document.querySelector('#nav-b'), { presentation: window.makeDeck(120), slideIndex: 118, density: 'touch' });
  });
  assert.equal(await page.locator('#nav-a .opf-nav-counter').textContent(), '02 / 05');
  assert.equal(await page.locator('#nav-b .opf-nav-counter').textContent(), '119 / 120', 'wider padding from 100 slides');
  const size = (selector) => page.locator(selector).evaluate((node) => { const box = node.getBoundingClientRect(); return [Math.round(box.width), Math.round(box.height)]; });
  assert.deepEqual(await size('#nav-a [data-action="next"]'), [32, 32], 'comfortable controls are 32px');
  assert.deepEqual(await size('#nav-b [data-action="next"]'), [40, 40], 'touch controls are 40px');
  assert.deepEqual(await size('#nav-b [data-action="previous"]'), [40, 40]);
  assert.equal(await page.locator('#nav-b .opf-nav').getAttribute('data-density'), 'touch');
  mark('touch density makes the navigator controls 40px (32px by default), and the counter widens from 100 slides');

  await ui(() => { window.deckA.slides.pop(); window.deckA.slides.pop(); window.navA.refresh(); });
  assert.equal(await page.locator('#nav-a .opf-nav-counter').textContent(), '02 / 03', 'refresh() reads the new slide count');
  await ui(() => { window.navA.setSlide(2); });
  assert.deepEqual(await ui(() => window.changesA), [], 'setSlide does not call onChange');
  await ui(() => { window.deckA.slides.pop(); window.navA.refresh(); });
  assert.equal(await page.locator('#nav-a .opf-nav-counter').textContent(), '02 / 02');
  assert.deepEqual(await ui(() => window.changesA), [1], 'a deck that shrinks under the current slide reports the clamped index');
  mark('refresh() follows the slide count, and setSlide() is silent');

  await ui(() => { window.unbind = window.navB.bindKeys(window); });
  await page.evaluate(() => document.activeElement?.blur());
  await page.keyboard.press('ArrowLeft');
  assert.equal(await page.locator('#nav-b .opf-nav-counter').textContent(), '118 / 120', 'bindKeys listens on the target given');
  await ui(() => window.unbind());
  await page.keyboard.press('ArrowLeft');
  assert.equal(await page.locator('#nav-b .opf-nav-counter').textContent(), '118 / 120', 'the returned function removes the listener');
  await ui(() => { window.navB.bindKeys(document); window.navB.destroy(); });
  await page.keyboard.press('ArrowLeft');
  assert.equal(await page.locator('#nav-b').innerHTML(), '', 'destroy removes the element');
  mark('bindKeys() returns an unbinder, and destroy() removes the element and its listeners');

  // Editor-driven navigator follows the session.
  await ui(() => {
    window.editorC = window.makeEditor(3);
    window.changesC = [];
    window.navC = window.opfNav.createSlideNavigator(document.querySelector('#nav-c'), { editor: window.editorC, slideIndex: 2, onChange: (index) => window.changesC.push(index) });
  });
  assert.equal(await page.locator('#nav-c .opf-nav-counter').textContent(), '03 / 03');
  await ui(() => window.editorC.applyPatch([{ op: 'add', path: '/slides/-', value: { id: 'extra', title: 'Extra', text: 'x' } }]));
  assert.equal(await page.locator('#nav-c .opf-nav-counter').textContent(), '03 / 04', 'adding a slide updates the count without a refresh call');
  await ui(() => window.editorC.applyPatch([{ op: 'remove', path: '/slides/3' }, { op: 'remove', path: '/slides/2' }]));
  assert.equal(await page.locator('#nav-c .opf-nav-counter').textContent(), '02 / 02');
  assert.deepEqual(await ui(() => window.changesC), [1]);
  mark('with an editor the count follows the session on its own');

  // The thumbnail strip on a long deck: wide index, lazy drawing, scroll to the active item.
  await ui(() => {
    window.editorL = window.makeEditor(120);
    window.selected = [];
    window.stripA = window.opfNav.createThumbnailStrip(document.querySelector('#strip-a'), { editor: window.editorL, fonts: window.fonts, slideIndex: 0, onSelect: (index) => window.selected.push(index) });
  });
  const ready = (selector) => page.locator(`${selector} .opf-thumbs-frame[data-state="ready"]`).count();
  await page.waitForFunction(() => document.querySelectorAll('#strip-a .opf-thumbs-frame[data-state="ready"]').length > 0, undefined, { timeout: 30000 });
  assert.equal(await page.locator('#strip-a .opf-thumbs-item').count(), 120);
  assert.equal(await page.locator('#strip-a .opf-thumbs-index').first().textContent(), '001', 'the index pads to the width of the slide count');
  await page.waitForTimeout(300);
  const readyAtStart = await ready('#strip-a');
  assert.ok(readyAtStart >= 4 && readyAtStart < 20, `only the items near the viewport are drawn at first (${readyAtStart} of 120)`);
  assert.equal(await page.locator('#strip-a .opf-thumbs-item[aria-current="true"]').count(), 1);
  await ui(() => window.stripA.setSlide(110));
  await page.waitForFunction(() => document.querySelector('#strip-a .opf-thumbs-item[data-index="110"] .opf-thumbs-frame[data-state="ready"]'), undefined, { timeout: 30000 });
  const inView = await page.evaluate(() => {
    const strip = document.querySelector('#strip-a nav').getBoundingClientRect(), item = document.querySelector('#strip-a .opf-thumbs-item[data-index="110"]').getBoundingClientRect();
    return { scrolled: document.querySelector('#strip-a nav').scrollLeft, inside: item.left >= strip.left && item.right <= strip.right, pageScroll: window.scrollX + window.scrollY };
  });
  assert.ok(inView.scrolled > 1000 && inView.inside, `the active item scrolls into view: ${JSON.stringify(inView)}`);
  assert.equal(inView.pageScroll, 0, 'scrolling the strip does not scroll the page');
  assert.equal(await page.locator('#strip-a .opf-thumbs-item[aria-current="true"] .opf-thumbs-index').textContent(), '111');
  assert.deepEqual(await ui(() => window.selected), [], 'setSlide does not call onSelect');
  assert.ok(await ready('#strip-a') < 40, 'scrolling draws more items but not the whole deck');
  await page.locator('#strip-a .opf-thumbs-item[data-index="111"]').click();
  assert.deepEqual(await ui(() => window.selected), [111], 'a click reports the chosen slide');
  assert.equal(await page.locator('#strip-a .opf-thumbs-item[aria-current="true"] .opf-thumbs-index').textContent(), '112');
  mark('the strip is lazy, pads a wide index, scrolls the active item into view and reports a click');

  // Touch density, size and the item hit area.
  await ui(() => {
    window.editorT = window.makeEditor(6);
    window.stripB = window.opfNav.createThumbnailStrip(document.querySelector('#strip-b'), { editor: window.editorT, fonts: window.fonts, slideIndex: 3, density: 'touch' });
  });
  await page.waitForFunction(() => document.querySelectorAll('#strip-b .opf-thumbs-frame[data-state="ready"]').length === 6, undefined, { timeout: 30000 });
  assert.equal(await page.locator('#strip-b nav').getAttribute('data-density'), 'touch');
  const frameWidth = await page.locator('#strip-b .opf-thumbs-frame').first().evaluate((node) => Math.round(node.getBoundingClientRect().width));
  assert.equal(frameWidth, 104, 'touch thumbnails default to 104px');
  const itemHeight = await page.locator('#strip-b .opf-thumbs-item').first().evaluate((node) => node.getBoundingClientRect().height);
  assert.ok(itemHeight >= 40, `touch items are at least 40px tall (${itemHeight})`);
  const comfortableWidth = await page.locator('#strip-a .opf-thumbs-frame').first().evaluate((node) => Math.round(node.getBoundingClientRect().width));
  assert.equal(comfortableWidth, 128, 'the default thumbnail is 128px');
  mark('touch density gives larger items and 104px thumbnails; comfortable is 128px');

  // Without IntersectionObserver or with lazy off, every thumbnail is drawn.
  await ui(() => {
    window.stripC = window.opfNav.createThumbnailStrip(document.querySelector('#strip-c'), { editor: window.makeEditor(30), fonts: window.fonts, lazy: false, size: 80 });
  });
  await page.waitForFunction(() => document.querySelectorAll('#strip-c .opf-thumbs-frame[data-state="ready"]').length === 30, undefined, { timeout: 30000 });
  assert.equal(await page.locator('#strip-c .opf-thumbs-frame').first().evaluate((node) => Math.round(node.getBoundingClientRect().width)), 80, 'size sets the thumbnail width');
  mark('lazy: false draws every thumbnail, and size sets the width');

  // Vertical orientation.
  await ui(() => {
    window.stripV = window.opfNav.createThumbnailStrip(document.querySelector('#strip-v'), { editor: window.makeEditor(40), fonts: window.fonts, orientation: 'vertical', size: 120, slideIndex: 0 });
  });
  await page.waitForFunction(() => document.querySelectorAll('#strip-v .opf-thumbs-frame[data-state="ready"]').length > 1, undefined, { timeout: 30000 });
  const layout = await page.evaluate(() => {
    const nav = document.querySelector('#strip-v nav'), boxes = [...document.querySelectorAll('#strip-v .opf-thumbs-item')].slice(0, 3).map((node) => node.getBoundingClientRect());
    return { orientation: nav.dataset.orientation, scrollsDown: nav.scrollHeight > nav.clientHeight + 100, noSideways: nav.scrollWidth <= nav.clientWidth, stacked: boxes[1].top > boxes[0].bottom - 1 && Math.abs(boxes[1].left - boxes[0].left) < 1 && boxes[2].top > boxes[1].bottom - 1 };
  });
  assert.deepEqual(layout, { orientation: 'vertical', scrollsDown: true, noSideways: true, stacked: true });
  await page.locator('#strip-v .opf-thumbs-item').first().focus();
  await page.keyboard.press('ArrowDown');
  assert.equal(await page.evaluate(() => document.activeElement?.querySelector('.opf-thumbs-index')?.textContent), '02', 'ArrowDown moves focus in a vertical strip');
  await ui(() => window.stripV.setSlide(35));
  await page.waitForFunction(() => document.querySelector('#strip-v nav').scrollTop > 500, undefined, { timeout: 15000 });
  const visibleV = await page.evaluate(() => {
    const strip = document.querySelector('#strip-v nav').getBoundingClientRect(), item = document.querySelector('#strip-v .opf-thumbs-item[data-index="35"]').getBoundingClientRect();
    return item.top >= strip.top && item.bottom <= strip.bottom;
  });
  assert.equal(visibleV, true, 'the active item scrolls into view in a vertical strip');
  mark('the vertical strip stacks, scrolls down, moves focus with Up and Down and scrolls the active item into view');

  // Shared session: an edit redraws a strip that has a cache of its own, and destroy detaches it.
  await ui(() => window.editorT.set('slides.0.title', 'Renamed first'));
  await page.waitForFunction(() => document.querySelector('#strip-b .opf-thumbs-title')?.textContent === 'Renamed first' && /Renamed first/.test(document.querySelector('#strip-b .opf-thumbs-frame')?.textContent ?? ''), undefined, { timeout: 15000 });
  await ui(() => window.stripB.destroy());
  assert.equal(await page.locator('#strip-b').innerHTML(), '', 'destroy removes the strip');
  await ui(() => window.editorT.set('slides.1.title', 'After destroy'));
  await page.waitForTimeout(100);
  assert.equal(await page.locator('#strip-b').innerHTML(), '', 'a destroyed strip no longer follows the session');
  mark('a session edit redraws the strip, and destroy() detaches it');

  assert.deepEqual(errors, []);
} finally {
  await browser?.close();
}
console.log(`RR-98 browser: ${checks.length} checks ok`);
