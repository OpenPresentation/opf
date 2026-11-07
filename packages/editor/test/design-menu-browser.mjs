import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { startWorkspacePage, deck } from './support/workspace-page.mjs';

// CE-29 in a real browser: the Design quick menu (src/design-menu.js) mounted on a bare page with the package stylesheet and the gallery catalog.
// Covers the structure and ARIA (dialog, menu, groups, menuitemradio), the current choice marked, keyboard and focus, applying a theme, color scheme,
// font scheme and layout (one undoable edit with source "design-menu", the menu stays open), following external changes and `refresh()`, read-only
// and disabled, `onOpenPanel`, the popover's placement (shift and flip), the bottom sheet at 390px, touch sizes, swatches and loaded fonts, an
// axe pass, `menuItems()` from a hidden button, and destroy without leaks.
const axeSource = readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');
const checks = [];
const mark = (name) => checks.push(name);
const entry = `import { createDesignMenu } from './src/design-menu.js'; window.opfDm = { createDesignMenu };`;
const BODY = '<div id="other" style="padding:8px"><button id="outside" type="button">Outside</button></div><div id="bar" style="display:flex;gap:8px;padding:8px"></div>';
const source = (extra = {}) => deck(3, { ...extra, slides: [{ id: 's1', title: 'One', text: 'Words', layout: 'text' }, { id: 's2', title: 'Two', text: 'Words' }, { id: 's3', title: 'Three', text: 'Words' }] });

const app = await startWorkspacePage({ bundle: { extraEntry: entry }, body: BODY });
const { page, errors } = app;
const ev = (fn, arg) => page.evaluate(fn, arg);

// Mount a fresh menu on a fresh session; `window.t` holds the page-side state the checks read.
const mount = (config = {}) => ev((cfg) => {
  window.t?.menu.destroy();
  document.querySelector('#bar').replaceChildren();
  const { opfWs, opfDm } = window;
  const session = opfWs.createEditorSession(cfg.deck, { catalogs: [opfWs.gallery] });
  const t = (window.t = { session, slide: 0, cats: [opfWs.gallery], status: [], panel: 0, sources: [] });
  session.subscribe((event) => { if (event.patches?.length) t.sources.push(event.meta?.source); });
  t.menu = opfDm.createDesignMenu(document.querySelector('#bar'), {
    editor: session,
    catalogs: () => t.cats,
    getSlideIndex: () => t.slide,
    onStatus: (message) => t.status.push(message),
    ...(cfg.panel === false ? {} : { onOpenPanel: () => { t.panel++; } }),
    ...(cfg.options ?? {}),
    ...(cfg.options?.labels && cfg.applied ? { labels: { ...cfg.options.labels, applied: (kind, name) => `${kind}=${name}` } } : {}),
  });
}, { deck: source(), ...config });

const trigger = () => page.getByRole('button', { name: 'Design', exact: true });
const dialog = () => page.getByRole('dialog', { name: 'Design' });
const group = (name) => page.getByRole('group', { name, exact: true });
const radio = (section, name) => group(section).getByRole('menuitemradio', { name, exact: true });
const doc = () => ev(() => window.t.session.presentation);
const checkedIn = (section) => ev((name) => [...document.querySelectorAll(`.opf-design-menu-group[aria-labelledby$="-${name}"] [aria-checked="true"]`)].map((node) => node.dataset.value), section);
const focusedValue = () => ev(() => document.activeElement?.dataset?.value ?? document.activeElement?.textContent?.trim() ?? document.activeElement?.tagName);
const box = (selector) => ev((s) => { const r = document.querySelector(s).getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height }; }, selector);

try {
  // ---- structure and ARIA --------------------------------------------------------------------------------------------------------------
  await mount();
  assert.equal(await trigger().getAttribute('aria-haspopup'), 'dialog');
  assert.equal(await trigger().getAttribute('aria-expanded'), 'false');
  assert.equal(await trigger().locator('svg[aria-hidden="true"]').count(), 1, 'the icon is decorative; the visible text names the button');
  assert.equal(await trigger().getAttribute('aria-label'), null, 'no aria-label where there is visible text');
  assert.equal(await dialog().count(), 0, 'closed: the popover is hidden');
  await trigger().click();
  assert.equal(await trigger().getAttribute('aria-expanded'), 'true');
  assert.equal(await dialog().isVisible(), true);
  assert.equal(await page.getByRole('menu', { name: 'Design' }).isVisible(), true);
  for (const name of ['Theme', 'Colors', 'Fonts', 'This slide: Layout']) assert.equal(await group(name).count(), 1, `section ${name}`);
  assert.deepEqual(await page.getByRole('group').evaluateAll((nodes) => nodes.map((node) => node.dataset.section)), ['theme', 'colors', 'fonts', 'layout']);
  assert.equal(await group('Theme').getByRole('menuitemradio').count(), 3, 'the three gallery themes');
  assert.equal(await group('Colors').getByRole('menuitemradio').count(), 14);
  assert.equal(await group('This slide: Layout').getByRole('menuitemradio').count(), 33, 'the 33 gallery layouts (SH-09 added pyramid and matrix, SH-18 cycle)');
  assert.equal(await page.getByRole('menuitem', { name: 'More design options…' }).count(), 1);
  mark('structure and ARIA');

  // ---- the current choice is marked ---------------------------------------------------------------------------------------------------
  assert.deepEqual(await checkedIn('theme'), ['classic']);
  assert.deepEqual(await checkedIn('colors'), ['cool-horizon'], 'an unset color scheme is the one the theme brings');
  assert.deepEqual(await checkedIn('fonts'), ['roboto']);
  assert.deepEqual(await checkedIn('layout'), ['text'], 'the layout of the current slide');
  assert.equal(await radio('Theme', 'Classic').getAttribute('aria-checked'), 'true');
  assert.equal(await radio('Theme', 'Bold').getAttribute('aria-checked'), 'false');
  assert.equal(await focusedValue(), 'classic', 'opening focuses the current theme');
  mark('current choice marked');

  // ---- keyboard and focus ----------------------------------------------------------------------------------------------------------------
  await page.keyboard.press('ArrowDown');
  assert.equal(await ev(() => document.activeElement.dataset.section + ':' + document.activeElement.dataset.value), 'theme:bold');
  await page.keyboard.press('ArrowDown');
  assert.equal(await ev(() => document.activeElement.dataset.section), 'colors', 'arrows continue into the next section');
  await page.keyboard.press('ArrowUp');
  assert.equal(await focusedValue(), 'bold');
  await page.keyboard.press('Home');
  assert.equal(await focusedValue(), 'minimal');
  await page.keyboard.press('End');
  assert.equal(await focusedValue(), 'More design options…');
  await page.keyboard.press('Home');
  await page.keyboard.press('c');
  assert.equal(await focusedValue(), 'classic', 'typeahead moves to the next row that starts with the letter');
  await page.keyboard.press('Escape');
  assert.equal(await dialog().count(), 0, 'Escape closes');
  assert.equal(await ev(() => document.activeElement.className), 'opf-design-menu-trigger', 'and returns focus to the button');
  assert.equal(await trigger().getAttribute('aria-expanded'), 'false');
  await page.keyboard.press('ArrowDown');
  assert.equal(await dialog().isVisible(), true, 'ArrowDown on the button opens');
  await page.keyboard.press('Tab');
  assert.equal(await dialog().count(), 0, 'Tab leaves and closes');
  await trigger().click();
  assert.equal(await dialog().isVisible(), true);
  await trigger().click();
  assert.equal(await dialog().count(), 0, 'the button toggles');
  await trigger().click();
  await page.locator('#outside').click();
  assert.equal(await dialog().count(), 0, 'a click outside closes');
  assert.equal(await ev(() => document.activeElement.id), 'outside', 'and does not steal focus back');
  await trigger().focus();
  await page.keyboard.press('Enter');
  assert.equal(await dialog().isVisible(), true, 'Enter opens');
  await page.keyboard.press('Escape');
  mark('keyboard, Escape, outside click');

  // ---- applying a theme: one undoable edit, the menu stays open ----------------------------------------------------------------------------
  await trigger().click();
  await radio('Theme', 'Bold').click();
  assert.equal(await dialog().isVisible(), true, 'the popover stays open to try more');
  let d = await doc();
  assert.equal(d.design.theme, 'bold');
  assert.deepEqual(await ev(() => window.t.sources), ['design-menu'], 'one edit, source design-menu');
  assert.deepEqual(await checkedIn('theme'), ['bold']);
  assert.deepEqual(await checkedIn('colors'), ['burnt-orange'], 'the colors follow the theme');
  assert.deepEqual(await checkedIn('fonts'), ['impact']);
  assert.match((await ev(() => window.t.status)).at(-1), /^Theme set to Bold\./);
  assert.match(await page.locator('.opf-design-menu-live').innerText(), /^Theme set to Bold\./);
  assert.equal(await focusedValue(), 'bold', 'the clicked row keeps the focus');
  await ev(() => window.t.session.undo());
  assert.equal((await doc()).design.theme, 'classic', 'one undo restores the theme');
  assert.equal((await doc()).design.fontScheme, 'roboto', 'and its bundled font scheme');
  assert.deepEqual(await checkedIn('theme'), ['classic'], 'the open menu follows the undo');
  assert.deepEqual(await checkedIn('fonts'), ['roboto']);
  mark('theme applies, undoes in one step');

  // ---- color scheme, font scheme, layout -----------------------------------------------------------------------------------------------------
  await radio('Colors', 'Black & White').click();
  assert.equal((await doc()).design.colorScheme, 'black-and-white');
  assert.deepEqual(await checkedIn('colors'), ['black-and-white']);
  assert.match((await ev(() => window.t.status)).at(-1), /^Colors set to Black & White\./);
  await ev(() => window.t.session.undo());
  assert.equal((await doc()).design.colorScheme, undefined, 'undo');
  assert.deepEqual(await checkedIn('colors'), ['cool-horizon']);
  await radio('Fonts', 'Consolas').click();
  assert.equal((await doc()).design.fontScheme, 'consolas');
  assert.deepEqual(await checkedIn('fonts'), ['consolas']);
  assert.match((await ev(() => window.t.status)).at(-1), /^Fonts set to Consolas\./);
  await ev(() => window.t.session.undo());
  assert.equal((await doc()).design.fontScheme, 'roboto');
  await radio('This slide: Layout', 'Cover').click();
  d = await doc();
  assert.deepEqual(d.slides.map((slide) => slide.layout), ['cover', undefined, undefined], 'only the current slide changes');
  assert.deepEqual(await checkedIn('layout'), ['cover']);
  assert.match((await ev(() => window.t.status)).at(-1), /^Layout set to Cover\./);
  await ev(() => window.t.session.undo());
  assert.equal((await doc()).slides[0].layout, 'text');
  assert.equal((await ev(() => window.t.sources)).filter((name) => name === 'design-menu').length, 4, 'one design-menu edit per choice');
  // The layout section follows the slide the host shows.
  await ev(() => { window.t.slide = 1; window.t.menu.refresh(); });
  assert.deepEqual(await checkedIn('layout'), [], 'slide 2 has no layout of its own');
  await radio('This slide: Layout', 'Quote').click();
  assert.deepEqual((await doc()).slides.map((slide) => slide.layout), ['text', 'quote', undefined]);
  assert.deepEqual(await checkedIn('layout'), ['quote']);
  await ev(() => { window.t.slide = 0; window.t.menu.refresh(); });
  assert.deepEqual(await checkedIn('layout'), ['text']);
  // Choosing what is set changes nothing.
  const before = await ev(() => window.t.sources.length);
  await radio('Theme', 'Classic').click();
  assert.equal(await ev(() => window.t.sources.length), before, 'no edit');
  assert.match((await ev(() => window.t.status)).at(-1), /already set/);
  // A deck-level choice that slides override says so.
  await ev(() => window.t.session.applyPatch([{ op: 'add', path: '/slides/2/design', value: { colorScheme: 'black-and-white' } }], { source: 'test' }));
  await radio('Colors', 'Burnt Orange').click();
  assert.match((await ev(() => window.t.status)).at(-1), /^Colors set to Burnt Orange\. 1 slide keeps its own\.$/);
  await page.keyboard.press('Escape');
  mark('color, font, layout apply; slide follows; no-op; undo');

  // ---- external changes and refresh ------------------------------------------------------------------------------------------------------------
  await mount();
  await trigger().click();
  await ev(() => window.t.session.applyPatch([{ op: 'replace', path: '/design/theme', value: 'bold' }], { source: 'host' }));
  assert.deepEqual(await checkedIn('theme'), ['bold'], 'an open menu follows an external edit');
  await page.keyboard.press('Escape');
  await ev(() => window.t.session.applyPatch([{ op: 'replace', path: '/design/theme', value: 'minimal' }], { source: 'host' }));
  await trigger().click();
  assert.deepEqual(await checkedIn('theme'), ['minimal'], 'a closed menu is current when it opens');
  // The catalogs() function is read again by refresh().
  await ev(() => { window.t.cats = []; window.t.menu.refresh(); });
  assert.equal(await group('Theme').count(), 0, 'a section with no choices is hidden');
  assert.equal(await ev(() => document.querySelector('.opf-design-menu-empty').hidden), false, 'with no catalog the menu says there is nothing to offer');
  assert.match(await page.locator('.opf-design-menu-empty').innerText(), /No design choices/);
  await ev(() => { window.t.cats = [window.opfWs.gallery]; window.t.menu.refresh(); });
  assert.equal(await group('Theme').getByRole('menuitemradio').count(), 3, 'the choices come back with the catalog');
  assert.equal(await ev(() => document.querySelector('.opf-design-menu-empty').hidden), true);
  await page.keyboard.press('Escape');
  mark('external change and refresh');

  // ---- failure is reported, not thrown -----------------------------------------------------------------------------------------------------------
  await mount();
  await trigger().click();
  await ev(() => { window.t.session.applyPatch = () => { throw new Error('The source is not valid.'); }; });
  await radio('Theme', 'Bold').click();
  assert.equal((await ev(() => window.t.status)).at(-1), 'The source is not valid.');
  assert.equal(await dialog().isVisible(), true);
  await page.keyboard.press('Escape');
  mark('a failed edit is reported');

  // ---- read-only and disabled ------------------------------------------------------------------------------------------------------------------
  await mount({ options: { readOnly: true } });
  assert.equal(await trigger().isDisabled(), true, 'read-only disables the button');
  assert.equal((await ev(() => window.t.menu.menuItems()))[0].disabled, true);
  await ev(() => window.t.menu.open());
  assert.equal(await dialog().count(), 0, 'open() does nothing');
  await ev(() => window.t.menu.setReadOnly(false));
  assert.equal(await trigger().isDisabled(), false);
  await trigger().click();
  assert.equal(await dialog().isVisible(), true);
  await ev(() => window.t.menu.setReadOnly(true));
  assert.equal(await dialog().count(), 0, 'read-only closes an open menu');
  await ev(() => window.t.menu.setReadOnly(false));
  await ev(() => window.t.menu.setDisabled(true));
  assert.equal(await trigger().isDisabled(), true);
  assert.equal((await ev(() => window.t.menu.menuItems()))[0].disabled, true);
  await ev(() => window.t.menu.setDisabled(false));
  assert.equal(await trigger().isDisabled(), false);
  assert.equal((await ev(() => window.t.menu.menuItems()))[0].disabled, false);
  mark('read-only and disabled');

  // ---- onOpenPanel -----------------------------------------------------------------------------------------------------------------------------------
  await mount();
  await trigger().click();
  await page.getByRole('menuitem', { name: 'More design options…' }).click();
  assert.equal(await ev(() => window.t.panel), 1);
  assert.equal(await dialog().count(), 0, 'the menu closes');
  await mount({ panel: false });
  await trigger().click();
  assert.equal(await page.getByRole('menuitem', { name: 'More design options…' }).count(), 0, 'no row without onOpenPanel');
  await page.keyboard.press('End');
  assert.equal(await ev(() => document.activeElement.dataset.section), 'layout', 'End is the last choice');
  await page.keyboard.press('Escape');
  mark('onOpenPanel');

  // ---- placement: shift and flip --------------------------------------------------------------------------------------------------------------
  await mount();
  await ev(() => { document.querySelector('#bar').style.cssText = 'position:fixed;right:4px;top:4px;display:flex'; });
  await trigger().click();
  let pop = await box('.opf-design-menu-popover');
  assert.ok(pop.right <= 1280 - 8 + 0.5 && pop.left >= 8 - 0.5, `shifted into the viewport (${JSON.stringify(pop)})`);
  assert.ok(pop.top >= (await box('.opf-design-menu-trigger')).bottom, 'below the button');
  await page.keyboard.press('Escape');
  await ev(() => { document.querySelector('#bar').style.cssText = 'position:fixed;left:40px;bottom:8px;display:flex'; });
  await trigger().click();
  pop = await box('.opf-design-menu-popover');
  const button = await box('.opf-design-menu-trigger');
  assert.ok(pop.bottom <= button.top, `flipped above the button (${JSON.stringify({ pop, button })})`);
  assert.ok(pop.top >= 0, 'and stays inside the viewport');
  await page.setViewportSize({ width: 1280, height: 300 });
  await ev(() => window.dispatchEvent(new Event('resize')));
  pop = await box('.opf-design-menu-popover');
  assert.ok(pop.top >= 0 && pop.bottom <= 300, `a short viewport caps the height (${JSON.stringify(pop)})`);
  assert.equal(await ev(() => { const menu = document.querySelector('.opf-design-menu-menu'); return menu.scrollHeight > menu.clientHeight; }), true, 'and the menu scrolls');
  await page.setViewportSize({ width: 1280, height: 860 });
  await page.keyboard.press('Escape');
  await ev(() => { document.querySelector('#bar').style.cssText = 'display:flex;gap:8px;padding:8px'; });
  mark('placement shifts and flips');

  // ---- swatches, fonts, density ----------------------------------------------------------------------------------------------------------------
  await trigger().click();
  const swatches = await radio('Colors', 'Black & White').locator('.opf-design-menu-swatch').evaluateAll((nodes) => nodes.map((node) => getComputedStyle(node).backgroundColor));
  assert.equal(swatches.length, 4, 'four accent swatches');
  assert.ok(swatches.every((color) => /^rgb/.test(color)));
  assert.equal(await radio('Theme', 'Bold').locator('.opf-design-menu-swatch').count(), 3, 'a theme shows the colors it brings');
  assert.equal(await radio('Fonts', 'Consolas').locator('.opf-design-menu-swatch').count(), 0);
  const face = (name) => radio('Fonts', name).locator('.opf-design-menu-label').evaluate((node) => node.style.fontFamily);
  assert.match(await face('Roboto'), /Roboto/, 'a face loaded in the document (the fonts handle added Roboto) is used for its name');
  assert.equal(await face('Consolas'), '', 'a face that is not loaded stays plain');
  // A face that loads while the menu is open updates its row.
  await ev(async (url) => { document.fonts.add(new FontFace('Consolas', `url(${url})`)); await document.fonts.load('16px Consolas'); }, app.faces[0].dataUrl);
    await page.waitForFunction(() => /Consolas/.test(document.querySelector('[data-section=fonts][data-value=consolas] .opf-design-menu-label').style.fontFamily));
  await page.keyboard.press('Escape');
  assert.equal(await box('.opf-design-menu-trigger').then((b) => b.height), 32, 'comfortable density');
  await ev(() => window.t.menu.setDensity('touch'));
  assert.equal(await ev(() => document.querySelector('.opf-design-menu').dataset.density), 'touch');
  assert.equal(await box('.opf-design-menu-trigger').then((b) => b.height), 40);
  await trigger().click();
  assert.equal((await box('.opf-design-menu-item')).height, 40, 'touch density rows are 40px');
  await page.keyboard.press('Escape');
  await ev(() => window.t.menu.setDensity('comfortable'));
  mark('swatches, loaded font faces, density');

  // ---- labels ------------------------------------------------------------------------------------------------------------------------------------------
  await mount({ options: { labels: { trigger: 'Aspect', title: 'Look', theme: 'Skin', colors: 'Palette', fonts: 'Type', layout: 'Slide layout', more: 'All options' } }, applied: true });
  await page.getByRole('button', { name: 'Aspect', exact: true }).click();
  assert.equal(await page.getByRole('dialog', { name: 'Look' }).isVisible(), true);
  for (const name of ['Skin', 'Palette', 'Type', 'Slide layout']) assert.equal(await group(name).count(), 1);
  assert.equal(await page.getByRole('menuitem', { name: 'All options' }).count(), 1);
  await radio('Skin', 'Bold').click();
  assert.equal((await ev(() => window.t.status)).at(-1), 'theme=Bold');
  await page.keyboard.press('Escape');
  mark('labels override every string');

  // ---- menuItems() from a button that is not on screen ------------------------------------------------------------------------------------------
  await mount();
  const items = await ev(() => window.t.menu.menuItems().map(({ id, label, disabled }) => ({ id, label, disabled })));
  assert.deepEqual(items, [{ id: 'design', label: 'Design…', disabled: false }]);
  await ev(() => { document.querySelector('#bar').style.display = 'none'; document.querySelector('#outside').focus(); });
  await ev(() => window.t.menu.menuItems()[0].run());
  assert.equal(await ev(() => document.querySelector('.opf-design-menu').dataset.mode), 'sheet', 'with no button to anchor to it opens as a sheet');
  assert.equal(await ev(() => document.querySelector('.opf-design-menu-popover').hidden), false);
  assert.equal(await focusedValue(), 'classic');
  await radio('Theme', 'Bold').click();
  assert.equal((await doc()).design.theme, 'bold');
  await page.keyboard.press('Escape');
  assert.equal(await ev(() => document.activeElement.id), 'outside', 'focus returns to what had it');
  await ev(() => { document.querySelector('#bar').style.display = 'flex'; });
  mark('menuItems and an anchorless sheet');

  // ---- accessibility ------------------------------------------------------------------------------------------------------------------------------------
  await mount();
  await trigger().click();
  await page.addScriptTag({ content: axeSource });
  const axe = await ev(async () => { const result = await window.axe.run('.opf-design-menu', { rules: { 'color-contrast': { enabled: false } } }); return result.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`); });
  assert.deepEqual(axe, [], 'no axe violations in the open menu');
  await page.keyboard.press('Escape');
  mark('axe');

  // ---- the bottom sheet at 390px ----------------------------------------------------------------------------------------------------------------------
  await page.setViewportSize({ width: 390, height: 844 });
  await mount();
  await trigger().click();
  assert.equal(await ev(() => document.querySelector('.opf-design-menu').dataset.mode), 'sheet');
  assert.equal(await page.getByRole('dialog', { name: 'Design' }).getAttribute('aria-modal'), 'true');
  const sheet = await box('.opf-design-menu-popover');
  assert.ok(Math.abs(sheet.bottom - 844) < 1 && sheet.left === 0 && sheet.width === 390, `a full-width sheet at the bottom (${JSON.stringify(sheet)})`);
  assert.ok(sheet.height <= 844 * 0.85 + 1, 'at most 85% of the screen');
  assert.equal(await page.locator('.opf-design-menu-scrim').isVisible(), true);
  assert.equal(await page.locator('.opf-design-menu-head').isVisible(), true);
  assert.equal(await page.locator('.opf-design-menu-title').innerText(), 'Design');
  assert.equal(await ev(() => document.documentElement.scrollWidth <= innerWidth), true, 'no sideways scroll');
  await radio('Theme', 'Bold').click();
  assert.equal((await doc()).design.theme, 'bold', 'choosing works in the sheet and keeps it open');
  assert.equal(await page.getByRole('dialog', { name: 'Design' }).isVisible(), true);
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  assert.equal(await dialog().count(), 0, 'the close button closes');
  assert.equal(await ev(() => document.activeElement.className), 'opf-design-menu-trigger');
  await trigger().click();
  await page.mouse.click(195, 40);
  assert.equal(await dialog().count(), 0, 'the scrim closes');
  await trigger().click();
  await page.setViewportSize({ width: 1000, height: 800 });
  await ev(() => window.dispatchEvent(new Event('resize')));
  assert.equal(await ev(() => document.querySelector('.opf-design-menu').dataset.mode), 'popover', 'a wider window brings the popover back');
  assert.equal(await page.locator('.opf-design-menu-scrim').isHidden(), true);
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 1280, height: 860 });
  mark('bottom sheet at 390px');

  // ---- destroy ----------------------------------------------------------------------------------------------------------------------------------------------
  await mount();
  await ev(() => {
    const live = new Map();
    for (const target of [document, window]) {
      const name = target === document ? 'document' : 'window';
      const add = target.addEventListener.bind(target), remove = target.removeEventListener.bind(target);
      target.addEventListener = (type, listener, options) => { const key = `${name}:${type}`; live.set(key, (live.get(key) ?? new Set()).add(listener)); return add(type, listener, options); };
      target.removeEventListener = (type, listener, options) => { live.get(`${name}:${type}`)?.delete(listener); return remove(type, listener, options); };
    }
    window.liveListeners = () => Object.fromEntries([...live].map(([key, set]) => [key, set.size]).filter(([, count]) => count));
    window.t.menu.destroy();
    window.t.menu = window.opfDm.createDesignMenu(document.querySelector('#bar'), { editor: window.t.session, catalogs: () => window.t.cats });
  });
  const idle = await ev(() => window.liveListeners());
  await trigger().click();
  assert.notDeepEqual(await ev(() => window.liveListeners()), idle, 'an open menu listens to the page');
  await ev(() => window.t.menu.destroy());
  assert.equal(await page.locator('.opf-design-menu').count(), 0, 'destroy removes the element');
  assert.deepEqual(await ev(() => window.liveListeners()), {}, 'and every page listener (open or closed)');
  await ev(() => window.t.menu.destroy());
  await ev(() => window.t.menu.open());
  assert.equal(await page.locator('.opf-design-menu').count(), 0, 'safe twice; nothing comes back');
  await ev(() => window.t.session.applyPatch([{ op: 'replace', path: '/design/theme', value: 'bold' }], { source: 'host' }));
  mark('destroy');

  assert.deepEqual(errors, []);
} finally {
  await app.close();
}

// ---- touch: a coarse pointer gets 44px --------------------------------------------------------------------------------------------------------------
const touch = await startWorkspacePage({ viewport: { width: 390, height: 844 }, bundle: { extraEntry: entry }, body: BODY, context: { hasTouch: true, isMobile: true } });
try {
  const tev = (fn, arg) => touch.page.evaluate(fn, arg);
  await tev((cfg) => {
    const { opfWs, opfDm } = window;
    const session = opfWs.createEditorSession(cfg, { catalogs: [opfWs.gallery] });
    window.t = { session, menu: opfDm.createDesignMenu(document.querySelector('#bar'), { editor: session, catalogs: () => [opfWs.gallery], onOpenPanel() {} }) };
  }, source());
  assert.equal(await tev(() => matchMedia('(pointer: coarse)').matches), true, 'the page has a coarse pointer');
  const trigger = touch.page.getByRole('button', { name: 'Design', exact: true });
  const tb = await trigger.boundingBox(); assert.ok(tb.height >= 43.5 && tb.width >= 43.5, `the button is 44px (${JSON.stringify(tb)})`);
  await trigger.tap();
  const sizes = await tev(() => [...document.querySelectorAll('.opf-design-menu-item, .opf-design-menu-close')].filter((node) => node.getClientRects().length).map((node) => ({ name: node.textContent.trim() || node.getAttribute('aria-label'), h: node.getBoundingClientRect().height, w: node.getBoundingClientRect().width })));
  assert.ok(sizes.length > 100, 'rows are measured');
  assert.deepEqual(sizes.filter((size) => size.h < 44 - 0.5 || (size.name === 'Close' && size.w < 44)), [], 'every row and the close button are at least 44px');
  await touch.page.getByRole('menuitemradio', { name: 'Bold', exact: true }).first().tap();
  assert.equal((await tev(() => window.t.session.presentation)).design.theme, 'bold', 'tapping a row applies it');
  assert.equal(await tev(() => document.documentElement.scrollWidth <= innerWidth), true);
  mark('touch sizes');
  assert.deepEqual(touch.errors, []);
} finally {
  await touch.close();
}

console.log(JSON.stringify({ passed: true, checks }, null, 2));
