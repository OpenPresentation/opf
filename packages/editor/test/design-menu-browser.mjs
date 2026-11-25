import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { startWorkspacePage, deck } from './support/workspace-page.mjs';

// CE-29 in a real browser: the Design quick menu (src/design-menu.js) mounted on a bare page with the package stylesheet and the gallery catalog.
// It opens the editor's one panel (src/panel.js): a dialog with a header and Close, a segmented switch of four tabs (Theme, Colors, Fonts, Layout;
// a tablist driven by the arrow keys), one section at a time whose choices are a menu of menuitemradio rows, and a foot that says what the last
// choice did with Undo. Covers the structure and ARIA, the current choice marked, the tabs and the rows by keyboard, applying a theme, color scheme,
// font scheme and layout (one undoable edit with source "design-menu", the panel stays open, the foot's Undo), following external changes and
// `refresh()`, read-only and disabled, `onOpenPanel`, the placement (under the button or an `anchor`, end-aligned, shifted, flipped, never taller
// than the room below, nothing over its scrolling list), the fonts for the deck's language grouped by type with a filter, the theme thumbnails,
// swatches and layout schematics, loaded faces, density, labels, the bottom sheet at 390px, touch sizes, an axe pass, `menuItems()` from a
// hidden button, and destroy without leaks.
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
    ...(cfg.anchor ? { anchor: () => document.querySelector(cfg.anchor) } : {}),
    ...(cfg.options ?? {}),
    ...(cfg.options?.labels && cfg.applied ? { labels: { ...cfg.options.labels, applied: (kind, name) => `${kind}=${name}` } } : {}),
  });
}, { deck: source(), ...config });

const trigger = () => page.getByRole('button', { name: 'Design', exact: true });
const dialog = () => page.getByRole('dialog', { name: 'Design' });
// A tab's name is its section and the current choice ("Theme Classic").
const tabName = (name) => new RegExp(`^${name}( |$)`);
const tab = (name) => page.getByRole('tab', { name: tabName(name) });
const tabLabels = () => page.locator('[role=tab]:visible .opf-design-menu-tab-label').allInnerTexts();
const menu = (name) => page.getByRole('menu', { name, exact: true });
const radio = (section, name) => menu(section).getByRole('menuitemradio', { name, exact: true });
// The section's tab, then its row: one section shows at a time.
const pick = async (tabName, section, name) => { await tab(tabName).click(); await radio(section, name).click(); };
const doc = () => ev(() => window.t.session.presentation);
const checkedIn = (section) => ev((name) => [...document.querySelectorAll(`.opf-design-menu-group[data-section="${name}"] [aria-checked="true"]`)].map((node) => node.dataset.value), section);
const focusedValue = () => ev(() => document.activeElement?.dataset?.value ?? document.activeElement?.textContent?.trim() ?? document.activeElement?.tagName);
const box = (selector) => ev((s) => { const r = document.querySelector(s).getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height }; }, selector);
const foot = () => page.locator('.opf-design-menu-popover .opf-panel-foot');

try {
  // ---- structure and ARIA --------------------------------------------------------------------------------------------------------------
  await mount();
  assert.equal(await trigger().getAttribute('aria-haspopup'), 'dialog');
  assert.equal(await trigger().getAttribute('aria-expanded'), 'false');
  assert.equal(await trigger().locator('svg[aria-hidden="true"]').count(), 1, 'the icon is decorative; the visible text names the button');
  assert.equal(await trigger().getAttribute('aria-label'), null, 'no aria-label where there is visible text');
  assert.equal(await dialog().count(), 0, 'closed: the panel is hidden');
  assert.equal(await page.getByRole('tab').count(), 0, 'and so are its tabs');
  await trigger().click();
  assert.equal(await trigger().getAttribute('aria-expanded'), 'true');
  assert.equal(await dialog().isVisible(), true);
  assert.equal(await ev(() => document.querySelector('.opf-design-menu-popover').classList.contains('opf-panel')), true, 'the one panel of the editor');
  assert.equal(await page.getByRole('tablist', { name: 'Design' }).isVisible(), true);
  assert.deepEqual(await tabLabels(), ['Theme', 'Colors', 'Fonts', 'Layout']);
  assert.equal(await tab('Theme').getAttribute('aria-selected'), 'true');
  assert.equal(await page.getByRole('tab', { name: 'Theme Classic', exact: true }).count(), 1, 'a tab\'s name also says the current choice');
  assert.equal(await tab('Theme').getAttribute('aria-selected'), 'true', 'the panel opens on Theme');
  assert.equal(await page.getByRole('tabpanel', { name: 'Theme' }).isVisible(), true, 'the tabpanel is named by its tab');
  assert.deepEqual(await ev(() => [...document.querySelectorAll('.opf-design-menu-group')].filter((group) => group.getClientRects().length).map((group) => group.dataset.section)), ['theme'], 'one section at a time');
  assert.equal(await menu('Theme').getByRole('menuitemradio').count(), 3, 'the three gallery themes');
  assert.match(await page.locator('.opf-design-menu-group[data-active] .opf-design-menu-group-label').innerText(), /^THEME · 3$/i, 'a small label over the choices');
  await tab('Colors').click();
  assert.equal(await menu('Colors').getByRole('menuitemradio').count(), 14);
  await tab('Layout').click();
  const layoutIds = await ev(() => Object.keys(window.opfWs.gallery.layouts));
  const layoutChoices = await menu('This slide: Layout').getByRole('menuitemradio').evaluateAll(nodes => nodes.map(node => node.dataset.value));
  assert.deepEqual(layoutChoices, layoutIds, 'every matching-source gallery layout appears in catalog order');
  assert.equal(new Set(layoutChoices).size, layoutChoices.length, 'no duplicate layout choices');
  assert.equal(await page.getByRole('button', { name: 'More design options…' }).count(), 1);
  assert.equal(await page.getByRole('button', { name: 'Close', exact: true }).isVisible(), true, 'the header has Close');
  mark('structure and ARIA');

  // ---- the current choice is marked ---------------------------------------------------------------------------------------------------
  assert.deepEqual(await checkedIn('theme'), ['classic']);
  assert.deepEqual(await checkedIn('colors'), ['cool-horizon'], 'an unset color scheme is the one the theme brings');
  assert.deepEqual(await checkedIn('fonts'), ['roboto']);
  assert.deepEqual(await checkedIn('layout'), ['text'], 'the layout of the current slide');
  const marked = await ev(() => { const row = document.querySelector('[data-section=layout][aria-checked=true]'); const s = getComputedStyle(row); return { weight: s.fontWeight, ground: s.backgroundColor, check: getComputedStyle(row.querySelector('.opf-design-menu-check')).visibility }; });
  assert.equal(marked.weight, '600', 'the current choice is heavier');
  assert.notEqual(marked.ground, 'rgba(0, 0, 0, 0)', 'on the accent tint');
  assert.equal(marked.check, 'visible', 'with its check');
  await page.keyboard.press('Escape');
  await trigger().click();
  assert.equal(await tab('Layout').getAttribute('aria-selected'), 'true', 'the panel opens on the section shown last');
  await tab('Theme').click();
  await page.keyboard.press('Escape');
  await trigger().click();
  assert.equal(await radio('Theme', 'Classic').getAttribute('aria-checked'), 'true');
  assert.equal(await radio('Theme', 'Bold').getAttribute('aria-checked'), 'false');
  assert.equal(await focusedValue(), 'classic', 'opening focuses the current choice');
  mark('current choice marked');

  // ---- keyboard: the rows ---------------------------------------------------------------------------------------------------------------
  await page.keyboard.press('ArrowDown');
  assert.equal(await ev(() => document.activeElement.dataset.section + ':' + document.activeElement.dataset.value), 'theme:bold');
  await page.keyboard.press('ArrowDown');
  assert.equal(await focusedValue(), 'More design options…', 'past the last row is the More row');
  await page.keyboard.press('ArrowUp');
  assert.equal(await focusedValue(), 'bold');
  await page.keyboard.press('Home');
  assert.equal(await focusedValue(), 'minimal');
  await page.keyboard.press('ArrowUp');
  assert.equal(await ev(() => [document.activeElement.getAttribute('role'), document.activeElement.dataset.section]).then((v) => v.join(':')), 'tab:theme', 'up from the first row is the tab');
  await page.keyboard.press('ArrowDown');
  assert.equal(await focusedValue(), 'classic', 'down from the tab is the current choice');
  await page.keyboard.press('End');
  assert.equal(await focusedValue(), 'More design options…');
  await page.keyboard.press('Home');
  await page.keyboard.press('c');
  assert.equal(await focusedValue(), 'classic', 'typeahead moves to the next row that starts with the letter');
  assert.deepEqual(await ev(() => [...document.querySelectorAll('.opf-design-menu-item')].filter((n) => n.tabIndex === 0).map((n) => n.dataset.value)), ['classic'], 'one row is in the Tab order (roving)');
  // A grid: Colors has two columns, so Down moves by two and Right by one.
  await tab('Colors').click();
  await page.keyboard.press('ArrowDown');
  const colorStart = await focusedValue();
  await page.keyboard.press('ArrowRight');
  const colorNext = await focusedValue();
  const order = await ev(() => [...document.querySelectorAll('[data-section=colors].opf-design-menu-item')].map((n) => n.dataset.value));
  assert.equal(order.indexOf(colorNext), order.indexOf(colorStart) + 1, 'Right moves by one in the grid');
  await page.keyboard.press('ArrowDown');
  assert.equal(order.indexOf(await focusedValue()), order.indexOf(colorNext) + 2, 'Down moves by a row of two');
  mark('rows by keyboard');

  // ---- keyboard: the tabs ------------------------------------------------------------------------------------------------------------------
  await tab('Theme').focus();
  await page.keyboard.press('ArrowRight');
  assert.deepEqual(await ev(() => [document.activeElement.getAttribute('role'), document.activeElement.dataset.section, document.activeElement.getAttribute('aria-selected')]), ['tab', 'colors', 'true'], 'Right moves to the next tab and shows it');
  assert.equal(await page.getByRole('tabpanel', { name: 'Colors' }).isVisible(), true);
  await page.keyboard.press('End');
  assert.equal(await ev(() => document.activeElement.dataset.section), 'layout');
  await page.keyboard.press('ArrowRight');
  assert.equal(await ev(() => document.activeElement.dataset.section), 'theme', 'and wraps');
  await page.keyboard.press('ArrowLeft');
  assert.equal(await ev(() => document.activeElement.dataset.section), 'layout');
  await page.keyboard.press('Home');
  assert.equal(await ev(() => document.activeElement.dataset.section), 'theme');
  const tablist = await ev(() => {
    const list = document.querySelector('[role=tablist]');
    const tabs = [...list.querySelectorAll('[role=tab]')];
    return { label: list.getAttribute('aria-label'), selected: tabs.filter((t) => t.getAttribute('aria-selected') === 'true').map((t) => t.tabIndex), others: tabs.filter((t) => t.getAttribute('aria-selected') !== 'true').map((t) => t.tabIndex), controls: tabs.every((t) => document.getElementById(document.getElementById(t.getAttribute('aria-controls'))?.getAttribute('aria-labelledby'))?.closest('[role=tab]') === t) };
  });
  assert.deepEqual(tablist, { label: 'Design', selected: [0], others: [-1, -1, -1], controls: true }, 'one tab in the Tab order; each tab controls its labelled tabpanel');
  // Tab and Shift+Tab move through the panel; past the last control the focus leaves and the popover closes.
  await page.keyboard.press('Shift+Tab');
  assert.equal(await ev(() => document.activeElement.getAttribute('aria-label')), 'Close', 'Shift+Tab from the tab reaches Close');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  assert.equal(await focusedValue(), 'classic', 'Tab from the tab reaches the section');
  await page.keyboard.press('Escape');
  assert.equal(await dialog().count(), 0, 'Escape closes');
  assert.equal(await ev(() => document.activeElement.className), 'opf-design-menu-trigger', 'and returns focus to the button');
  assert.equal(await trigger().getAttribute('aria-expanded'), 'false');
  await page.keyboard.press('ArrowDown');
  assert.equal(await dialog().isVisible(), true, 'ArrowDown on the button opens');
  await page.keyboard.press('Tab');
  assert.equal(await dialog().count(), 0, 'Tab from the last control leaves and closes');
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
  mark('tabs by keyboard, Escape, outside click');

  // ---- applying a theme: one undoable edit, the panel stays open, the foot says it with Undo ------------------------------------------------------
  await trigger().click();
  assert.match(await foot().innerText(), /A theme sets colors, fonts and backgrounds together/, 'the Theme section has a hint in its foot');
  await radio('Theme', 'Bold').click();
  assert.equal(await dialog().isVisible(), true, 'the panel stays open to try more');
  let d = await doc();
  assert.equal(d.design.theme, 'bold');
  assert.deepEqual(await ev(() => window.t.sources), ['design-menu'], 'one edit, source design-menu');
  assert.deepEqual(await checkedIn('theme'), ['bold']);
  assert.deepEqual(await checkedIn('colors'), ['burnt-orange'], 'the colors follow the theme');
  assert.deepEqual(await checkedIn('fonts'), ['impact']);
  assert.match((await ev(() => window.t.status)).at(-1), /^Theme set to Bold\./);
  assert.match(await page.locator('.opf-design-menu-live').innerText(), /^Theme set to Bold\./);
  assert.match(await foot().innerText(), /Theme set to Bold\.[\s\S]*Undo/, 'the foot says what happened, with Undo');
  assert.equal(await focusedValue(), 'bold', 'the clicked row keeps the focus');
  await foot().getByRole('button', { name: 'Undo' }).click();
  assert.equal((await doc()).design.theme, 'classic', 'the foot\'s Undo restores the theme in one step');
  assert.equal((await doc()).design.fontScheme, 'roboto', 'and its bundled font scheme');
  assert.deepEqual(await checkedIn('theme'), ['classic'], 'the open panel follows the undo');
  assert.match(await foot().innerText(), /^Undone\.$/);
  assert.equal(await foot().getByRole('button', { name: 'Undo' }).count(), 0, 'Undo is spent');
  await radio('Theme', 'Bold').click();
  await ev(() => window.t.session.applyPatch([{ op: 'replace', path: '/name', value: 'Renamed' }], { source: 'host' }));
  assert.equal(await foot().getByRole('button', { name: 'Undo' }).count(), 0, 'another edit takes Undo away: it would undo that one');
  await ev(() => { window.t.session.undo(); window.t.session.undo(); });
  assert.equal((await doc()).design.theme, 'classic');
  mark('theme applies, the foot undoes in one step');

  // ---- color scheme, font scheme, layout -----------------------------------------------------------------------------------------------------
  await pick('Colors', 'Colors', 'Black & White');
  assert.equal((await doc()).design.colorScheme, 'black-and-white');
  assert.deepEqual(await checkedIn('colors'), ['black-and-white']);
  assert.match((await ev(() => window.t.status)).at(-1), /^Colors set to Black & White\./);
  await ev(() => window.t.session.undo());
  assert.equal((await doc()).design.colorScheme, undefined, 'undo');
  assert.deepEqual(await checkedIn('colors'), ['cool-horizon']);
  await pick('Fonts', 'Fonts', 'Consolas');
  assert.equal((await doc()).design.fontScheme, 'consolas');
  assert.deepEqual(await checkedIn('fonts'), ['consolas']);
  assert.match((await ev(() => window.t.status)).at(-1), /^Fonts set to Consolas\./);
  await ev(() => window.t.session.undo());
  assert.equal((await doc()).design.fontScheme, 'roboto');
  await pick('Layout', 'This slide: Layout', 'Cover');
  d = await doc();
  assert.deepEqual(d.slides.map((slide) => slide.layout), ['cover', undefined, undefined], 'only the current slide changes');
  assert.deepEqual(await checkedIn('layout'), ['cover']);
  assert.match((await ev(() => window.t.status)).at(-1), /^Layout set to Cover\./);
  await ev(() => window.t.session.undo());
  assert.equal((await doc()).slides[0].layout, 'text');
  assert.equal((await ev(() => window.t.sources)).filter((name) => name === 'design-menu').length, 5, 'one design-menu edit per choice');
  // The layout section follows the slide the host shows.
  await ev(() => { window.t.slide = 1; window.t.menu.refresh(); });
  assert.deepEqual(await checkedIn('layout'), [], 'slide 2 has no layout of its own');
  assert.match(await page.locator('.opf-design-menu-group[data-active] .opf-design-menu-group-label').innerText(), /^SLIDE 02 · \d+ LAYOUTS$/i, 'the label names the slide');
  await radio('This slide: Layout', 'Quote').click();
  assert.deepEqual((await doc()).slides.map((slide) => slide.layout), ['text', 'quote', undefined]);
  assert.deepEqual(await checkedIn('layout'), ['quote']);
  await ev(() => { window.t.slide = 0; window.t.menu.refresh(); });
  assert.deepEqual(await checkedIn('layout'), ['text']);
  // Choosing what is set changes nothing.
  const before = await ev(() => window.t.sources.length);
  await pick('Theme', 'Theme', 'Classic');
  assert.equal(await ev(() => window.t.sources.length), before, 'no edit');
  assert.match((await ev(() => window.t.status)).at(-1), /already set/);
  // A deck-level choice that slides override says so.
  await ev(() => window.t.session.applyPatch([{ op: 'add', path: '/slides/2/design', value: { colorScheme: 'black-and-white' } }], { source: 'test' }));
  await pick('Colors', 'Colors', 'Burnt Orange');
  assert.match((await ev(() => window.t.status)).at(-1), /^Colors set to Burnt Orange\. 1 slide keeps its own\.$/);
  await page.keyboard.press('Escape');
  mark('color, font, layout apply; slide follows; no-op; undo');

  // ---- fonts: the deck's language, grouped by type, a filter --------------------------------------------------------------------------------
  await mount();
  await trigger().click();
  await tab('Fonts').click();
  const fonts = await ev(() => [...document.querySelectorAll('.opf-design-menu-font-group')].map((group) => [group.querySelector('.opf-panel-label').textContent, group.querySelectorAll('[role=menuitemradio]').length]));
  assert.deepEqual(fonts.map(([label]) => label), ['In use', 'Sans serif', 'Serif', 'Monospace'], 'the scheme in use first, then by type');
  assert.deepEqual(fonts[0], ['In use', 1]);
  assert.equal(fonts.reduce((sum, [, count]) => sum + count, 0), 29, 'an English deck lists the 29 Latin schemes, not every one in the catalog');
  assert.equal(await page.getByRole('textbox', { name: 'Filter fonts' }).getAttribute('placeholder'), 'Filter 29 fonts');
  assert.match(await foot().innerText(), /^Fonts for English/, 'the foot names the language');
  assert.equal(await menu('Fonts').getByRole('group', { name: 'Monospace' }).getByRole('menuitemradio').count(), 2);
  await page.getByRole('textbox', { name: 'Filter fonts' }).fill('consol');
  assert.deepEqual(await menu('Fonts').getByRole('menuitemradio').evaluateAll((nodes) => nodes.map((n) => n.dataset.value)), ['consolas'], 'the filter narrows by name');
  assert.deepEqual(await menu('Fonts').getByRole('group').evaluateAll((nodes) => nodes.map((n) => n.dataset.type)), ['monospace'], 'and hides the groups it empties');
  await page.keyboard.press('ArrowDown');
  assert.equal(await focusedValue(), 'consolas', 'Down from the filter is the first row');
  await page.getByRole('textbox', { name: 'Filter fonts' }).fill('zzz');
  assert.match(await page.locator('.opf-design-menu-group[data-active] .opf-panel-empty').innerText(), /No font matches “zzz”/);
  await page.keyboard.press('Escape');
  assert.equal(await dialog().isVisible(), true, 'Escape in the filter clears it, the panel stays');
  assert.equal(await page.getByRole('textbox', { name: 'Filter fonts' }).inputValue(), '');
  assert.equal(await menu('Fonts').getByRole('menuitemradio').count(), 29);
  await page.keyboard.press('Escape');
  // A Japanese deck lists the schemes for Japanese (and keeps the one in use).
  await mount({ deck: { ...source(), language: 'ja' } });
  await trigger().click();
  await tab('Fonts').click();
  const japanese = await menu('Fonts').getByRole('menuitemradio').evaluateAll((nodes) => nodes.map((n) => n.dataset.value));
  assert.ok(japanese.includes('meiryo') && japanese.includes('yu-gothic'), `Japanese schemes: ${japanese}`);
  assert.ok(!japanese.includes('arial') && !japanese.includes('noto-sans-kr'), 'no Latin or Korean schemes');
  assert.ok(japanese.length < 12);
  await page.keyboard.press('Escape');
  mark('fonts for the language, grouped, filtered');

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
  assert.equal(await tab('Theme').count(), 0, 'a section with no choices has no tab');
  assert.equal(await ev(() => document.querySelector('.opf-design-menu-empty').hidden), false, 'with no catalog the menu says there is nothing to offer');
  assert.match(await page.locator('.opf-design-menu-empty').innerText(), /No design choices/);
  await ev(() => { window.t.cats = [window.opfWs.gallery]; window.t.menu.refresh(); });
  assert.equal(await menu('Theme').getByRole('menuitemradio').count(), 3, 'the choices come back with the catalog');
  assert.equal(await ev(() => document.querySelector('.opf-design-menu-empty').hidden), true);
  await page.keyboard.press('Escape');
  mark('external change and refresh');

  // ---- failure is reported, not thrown -----------------------------------------------------------------------------------------------------------
  await mount();
  await trigger().click();
  await ev(() => { window.t.session.applyPatch = () => { throw new Error('The source is not valid.'); }; });
  await radio('Theme', 'Bold').click();
  assert.equal((await ev(() => window.t.status)).at(-1), 'The source is not valid.');
  assert.match(await foot().innerText(), /^The source is not valid\.$/, 'the foot says it, with no Undo');
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
  await page.getByRole('button', { name: 'More design options…' }).click();
  assert.equal(await ev(() => window.t.panel), 1);
  assert.equal(await dialog().count(), 0, 'the menu closes');
  await mount({ panel: false });
  await trigger().click();
  assert.equal(await page.getByRole('button', { name: 'More design options…' }).count(), 0, 'no row without onOpenPanel');
  await page.keyboard.press('End');
  assert.equal(await focusedValue(), 'bold', 'End is the last choice');
  await page.keyboard.press('Escape');
  mark('onOpenPanel');

  // ---- placement: under the button, end-aligned, shifted, flipped, capped; under an anchor; nothing over the list -----------------------------
  await mount();
  await trigger().click();
  let pop = await box('.opf-design-menu-popover');
  assert.equal(pop.width, 360, 'the panel is 360px wide');
  assert.equal(await ev(() => getComputedStyle(document.querySelector('.opf-design-menu-popover')).borderTopLeftRadius), '12px');
  await page.keyboard.press('Escape');
  await ev(() => { document.querySelector('#bar').style.cssText = 'position:fixed;right:4px;top:4px;display:flex'; });
  await trigger().click();
  pop = await box('.opf-design-menu-popover');
  const right = await box('.opf-design-menu-trigger');
  assert.ok(Math.abs(pop.right - Math.min(right.right, 1280 - 8)) < 1, `its end edge is the button's, inside the 8px margin (${JSON.stringify({ pop, right })})`);
  assert.ok(pop.right <= 1280 - 8 + 0.5 && pop.left >= 8 - 0.5, `inside the viewport (${JSON.stringify(pop)})`);
  assert.ok(pop.top >= right.bottom, 'below the button');
  await page.keyboard.press('Escape');
  await ev(() => { document.querySelector('#bar').style.cssText = 'position:fixed;left:40px;bottom:8px;display:flex'; });
  await trigger().click();
  pop = await box('.opf-design-menu-popover');
  const button = await box('.opf-design-menu-trigger');
  assert.ok(pop.left >= 8 - 0.5, 'shifted into the viewport');
  assert.ok(pop.bottom <= button.top, `flipped above the button (${JSON.stringify({ pop, button })})`);
  assert.ok(pop.top >= 0, 'and stays inside the viewport');
  await page.setViewportSize({ width: 1280, height: 300 });
  await ev(() => window.dispatchEvent(new Event('resize')));
  pop = await box('.opf-design-menu-popover');
  assert.ok(pop.top >= 0 && pop.bottom <= 300, `a short viewport caps the height (${JSON.stringify(pop)})`);
  assert.equal(await ev(() => { const body = document.querySelector('.opf-design-menu-menu'); return body.scrollHeight > body.clientHeight; }), true, 'and the body scrolls');
  await page.setViewportSize({ width: 1280, height: 860 });
  await page.keyboard.press('Escape');
  // Under a bar given as `anchor`: 8px under it, its end edge on the bar's content edge, never taller than the room below.
  await ev(() => {
    document.querySelector('#bar').style.cssText = 'display:flex;gap:8px;padding:8px';
    document.querySelector('#other').style.cssText = 'height:48px;padding:0 12px;display:flex;align-items:center;border-bottom:1px solid';
  });
  await mount({ anchor: '#other' });
  await page.setViewportSize({ width: 900, height: 420 });
  await trigger().click();
  await tab('Layout').click();
  const placed = await ev(() => {
    const bar = document.querySelector('#other').getBoundingClientRect();
    const panel = document.querySelector('.opf-design-menu-popover');
    const body = panel.querySelector('.opf-panel-body');
    const r = panel.getBoundingClientRect(), b = body.getBoundingClientRect();
    // Each row shown in the body's visible part is what is drawn at its middle: nothing (a label, the tabs, the foot) covers the list.
    const covered = [...body.querySelectorAll('.opf-design-menu-item')].filter((row) => !row.closest('[hidden]')).filter((row) => {
      const q = row.getBoundingClientRect(); const y = (q.top + q.bottom) / 2;
      if (y < b.top + 2 || y > b.bottom - 2) return false;
      return !row.contains(document.elementFromPoint((q.left + q.right) / 2, y));
    }).map((row) => row.dataset.value);
    const tabs = panel.querySelector('[role=tablist]').getBoundingClientRect();
    return { gap: r.top - bar.bottom, end: Math.round(bar.right - 12 - r.right), bottom: r.bottom, room: innerHeight - 8, scrolls: body.scrollHeight > body.clientHeight, covered, belowTabs: b.top >= tabs.bottom };
  });
  assert.equal(Math.round(placed.gap), 8, '8px under the bar');
  assert.equal(placed.end, 0, 'its end edge on the bar\'s content edge');
  assert.ok(placed.bottom <= placed.room + 0.5, `never taller than the room under the bar (${JSON.stringify(placed)})`);
  assert.equal(placed.scrolls, true, 'the body scrolls');
  assert.equal(placed.belowTabs, true, 'the scrolling list starts under the tabs');
  assert.deepEqual(placed.covered, [], 'nothing overlaps the scrolling list');
  await ev(() => { document.querySelector('.opf-design-menu-menu').scrollTop = 400; });
  assert.deepEqual(await ev(() => { const body = document.querySelector('.opf-design-menu-menu'); const b = body.getBoundingClientRect(); return [...body.querySelectorAll('.opf-design-menu-item')].filter((row) => !row.closest('[hidden]')).filter((row) => { const q = row.getBoundingClientRect(); const y = (q.top + q.bottom) / 2; return y > b.top + 2 && y < b.bottom - 2 && !row.contains(document.elementFromPoint((q.left + q.right) / 2, y)); }).length; }), 0, 'nor when it is scrolled');
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 1280, height: 860 });
  await ev(() => { document.querySelector('#other').style.cssText = 'padding:8px'; });
  mark('placement: end-aligned, shifted, flipped, capped, under an anchor, nothing over the list');

  // ---- thumbnails, swatches, fonts, density ----------------------------------------------------------------------------------------------------
  await mount();
  await trigger().click();
  const thumb = await radio('Theme', 'Bold').locator('.opf-design-menu-thumb').evaluate((node) => ({ ground: node.style.backgroundColor, accent: node.querySelector('.opf-design-menu-thumb-accent').style.backgroundColor, w: node.getBoundingClientRect().width, h: node.getBoundingClientRect().height }));
  assert.equal(thumb.accent, 'rgb(233, 114, 0)', 'a theme shows its own colors: Burnt Orange\'s first accent');
  assert.equal(thumb.ground, 'rgb(255, 255, 255)', 'on its background');
  assert.deepEqual([thumb.w, thumb.h], [96, 54], 'a 16:9 thumbnail');
  assert.match(await radio('Theme', 'Bold').getAttribute('aria-describedby').then((id) => ev((i) => document.getElementById(i).textContent, id)), /^Burnt Orange · Impact$/, 'its second line names its schemes');
  await tab('Colors').click();
  const swatches = await radio('Colors', 'Black & White').locator('.opf-design-menu-swatch').evaluateAll((nodes) => nodes.map((node) => getComputedStyle(node).backgroundColor));
  assert.equal(swatches.length, 4, 'four accent swatches, joined in one chip');
  assert.ok(swatches.every((color) => /^rgb/.test(color)));
  assert.equal(await ev(() => getComputedStyle(document.querySelector('[data-section=colors] .opf-design-menu-list')).gridTemplateColumns.split(' ').length), 2, 'two columns');
  const cut = await ev(() => { const names = [...document.querySelectorAll('[data-section=colors].opf-design-menu-item .opf-design-menu-label')]; return { count: names.length, width: document.querySelector('.opf-design-menu-popover').getBoundingClientRect().width, cut: names.filter((name) => name.scrollWidth > name.clientWidth).map((name) => name.textContent) }; });
  assert.deepEqual(cut, { count: 14, width: 360, cut: [] }, 'none of the 14 color scheme names is truncated at 360px');
  await tab('Layout').click();
  assert.equal(await ev(() => getComputedStyle(document.querySelector('[data-section=layout] .opf-design-menu-list')).gridTemplateColumns.split(' ').length), 3, 'three columns of layouts');
  assert.ok(await radio('This slide: Layout', 'Metrics').locator('.opf-design-menu-thumb-block[data-shape="metrics"]').count() >= 1, 'a schematic drawn from the layout\'s regions');
  await tab('Fonts').click();
  // Every row asks for its own face (the browser draws it where this computer has it or the editor loaded it), the UI font after it.
  const faces = await ev(() => [...document.querySelectorAll('[data-section=fonts].opf-design-menu-item')].map((row) => ({ major: row.dataset.major, name: getComputedStyle(row.querySelector('.opf-design-menu-label')).fontFamily, sample: getComputedStyle(row.querySelector('.opf-design-menu-sample')).fontFamily })));
  assert.equal(faces.length, 29);
  const unquote = (value) => value.split(',')[0].trim().replace(/^["']|["']$/g, '');
  assert.deepEqual(faces.filter((row) => unquote(row.name) !== row.major || unquote(row.sample) !== row.major), [], 'each row names its own family first in its computed font-family, the name and the "Ag"');
  assert.ok(faces.every((row) => /Inter|system-ui|sans-serif/.test(row.name.split(',').slice(1).join(','))), 'then the UI font');
  assert.match(await radio('Fonts', 'Consolas').locator('.opf-design-menu-label').evaluate((node) => node.style.fontFamily), /^"Consolas", var\(--opf-ui-font\)$/, 'whether or not a face of that family is loaded in the document');
  assert.match(await foot().innerText(), /A name is drawn in its own face where that face is available here\.$/);
  await page.keyboard.press('Escape');
  assert.equal(await box('.opf-design-menu-trigger').then((b) => b.height), 32, 'comfortable density');
  await trigger().click();
  await tab('Colors').click();
  assert.equal((await box('[data-section=colors].opf-design-menu-item')).height, 36, 'rows are 36px');
  await page.keyboard.press('Escape');
  await ev(() => window.t.menu.setDensity('touch'));
  assert.equal(await ev(() => document.querySelector('.opf-design-menu').dataset.density), 'touch');
  assert.equal(await box('.opf-design-menu-trigger').then((b) => b.height), 40);
  await trigger().click();
  assert.equal((await box('[data-section=colors].opf-design-menu-item')).height, 40, 'touch density rows are 40px');
  await page.keyboard.press('Escape');
  await ev(() => window.t.menu.setDensity('comfortable'));
  mark('theme thumbnails, swatches, layout schematics, loaded font faces, density');

  // ---- labels ------------------------------------------------------------------------------------------------------------------------------------------
  await mount({ options: { labels: { trigger: 'Aspect', title: 'Look', theme: 'Skin', colors: 'Palette', fonts: 'Type', layout: 'Slide layout', layoutTab: 'Slide', more: 'All options' } }, applied: true });
  await page.getByRole('button', { name: 'Aspect', exact: true }).click();
  assert.equal(await page.getByRole('dialog', { name: 'Look' }).isVisible(), true);
  assert.deepEqual(await tabLabels(), ['Skin', 'Palette', 'Type', 'Slide']);
  await tab('Slide').click();
  assert.equal(await menu('Slide layout').count(), 1);
  await tab('Skin').click();
  assert.equal(await page.getByRole('button', { name: 'All options' }).count(), 1);
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
  for (const name of ['Theme', 'Colors', 'Fonts', 'Layout']) {
    await tab(name).click();
    const axe = await ev(async () => { const result = await window.axe.run('.opf-design-menu'); return result.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`); });
    assert.deepEqual(axe, [], `no axe violations (contrast included) on ${name}`);
  }
  const ring = await ev(() => { document.querySelector('[role=tab][aria-selected=true]').focus(); return null; });
  await page.keyboard.press('ArrowLeft');
  const outline = await ev(() => { const s = getComputedStyle(document.activeElement); return [s.outlineStyle, s.outlineWidth]; });
  assert.deepEqual(outline, ['solid', '2px'], 'a visible focus ring from the tokens');
  assert.equal(ring, null);
  await page.keyboard.press('Escape');
  mark('axe in light');
  await page.emulateMedia({ colorScheme: 'dark' });
  await ev(() => document.documentElement.classList.add('dark'));
  await trigger().click();
  for (const name of ['Theme', 'Colors', 'Fonts', 'Layout']) {
    await tab(name).click();
    const axe = await ev(async () => { const result = await window.axe.run('.opf-design-menu-popover'); return result.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`); });
    assert.deepEqual(axe, [], `no axe violations in dark (contrast included) on ${name}`);
  }
  await page.keyboard.press('Escape');
  await ev(() => document.documentElement.classList.remove('dark'));
  await page.emulateMedia({ colorScheme: 'light' });
  mark('axe in dark');

  // ---- the bottom sheet at 390px ----------------------------------------------------------------------------------------------------------------------
  await page.setViewportSize({ width: 390, height: 844 });
  await mount();
  await trigger().click();
  assert.equal(await ev(() => document.querySelector('.opf-design-menu').dataset.mode), 'sheet');
  assert.equal(await page.getByRole('dialog', { name: 'Design' }).getAttribute('aria-modal'), 'true');
  const sheet = await box('.opf-design-menu-popover');
  assert.ok(Math.abs(sheet.bottom - 844) < 1 && sheet.left === 0 && sheet.width === 390, `a full-width sheet at the bottom (${JSON.stringify(sheet)})`);
  assert.ok(sheet.height <= 844 * 0.55 + 1, 'about half the screen, so the slide above stays in view');
  assert.equal(await page.locator('.opf-panel-grab').isVisible(), true, 'with a grabber');
  assert.equal(await page.locator('.opf-design-menu-head').isVisible(), true, 'the same header');
  assert.equal(await page.locator('.opf-design-menu-title').innerText(), 'Design');
  // The same tabs, one section at a time, in the panel's one scroll container (no list scrolls on its own).
  const sections = await ev(() => {
    const popover = document.querySelector('.opf-design-menu-popover');
    const shown = [...popover.querySelectorAll('.opf-design-menu-group')].filter((group) => group.getClientRects().length).map((group) => group.dataset.section);
    const row = popover.querySelector('.opf-design-menu-group[data-active] .opf-design-menu-item');
    let scrollers = 0;
    for (let node = row; node && node !== popover; node = node.parentElement) if (/(auto|scroll)/.test(getComputedStyle(node).overflowY)) scrollers += 1;
    return { shown, scrollers, tabs: [...popover.querySelectorAll('[role=tab]')].filter((tab) => !tab.hidden).map((tab) => tab.dataset.section) };
  });
  assert.deepEqual(sections, { shown: ['theme'], scrollers: 1, tabs: ['theme', 'colors', 'fonts', 'layout'] });
  await tab('Colors').click();
  assert.deepEqual(await ev(() => [...document.querySelectorAll('.opf-design-menu-group')].filter((group) => group.getClientRects().length).map((group) => group.dataset.section)), ['colors']);
  assert.ok((await box('[role=tab][data-section=colors]')).height >= 44 - 0.5, 'tabs are 44px in the sheet');
  assert.ok((await box('[data-section=colors].opf-design-menu-item')).height >= 44 - 0.5, 'rows are 44px in the sheet');
  // A scroll or a resize lays the open sheet out again, and that must leave the focus on the tab.
  await ev(() => new Promise((resolve) => {
    window.dispatchEvent(new Event('resize'));
    document.querySelector('.opf-design-menu-menu').dispatchEvent(new Event('scroll'));
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  }));
  assert.deepEqual(await ev(() => [document.activeElement.getAttribute('role'), document.activeElement.dataset.section]), ['tab', 'colors'], 'a relayout of the open sheet keeps the focus on the tab');
  await page.keyboard.press('ArrowRight');
  assert.equal(await ev(() => document.activeElement.dataset.section), 'fonts', 'the arrow keys move along the switch');
  const sheetAxe = await ev(async () => { const result = await window.axe.run('.opf-design-menu-popover'); return result.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`); });
  assert.deepEqual(sheetAxe, [], 'no axe violations in the sheet');
  // The sheet keeps the focus: Tab goes round.
  const stops = [];
  for (let i = 0; i < 12; i++) { await page.keyboard.press('Tab'); stops.push(await ev(() => Boolean(document.activeElement.closest('.opf-design-menu-popover')))); }
  assert.ok(stops.every(Boolean), 'Tab stays in the sheet');
  await tab('Theme').click();
  assert.equal(await page.locator('.opf-design-menu-scrim').isVisible(), true);
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

  // Added intents are ordinary owned choices: only the current layout changes.
  for (const id of ['inverted-pyramid', 'org-chart', 'hierarchy', 'venn']) {
    const value = source();
    Object.assign(value.slides[0], { subtitle: 'Keep subtitle', notes: 'Keep notes' });
    await mount({ deck: value });
    const before = await doc();
    await trigger().click();
    await tab('Layout').click();
    await menu('This slide: Layout').locator('[data-value="' + id + '"]').click();
    assert.deepEqual(await doc(), { ...before, slides: before.slides.map((slide, index) => index === 0 ? { ...slide, layout: id } : slide) }, id + ': only the current layout changes');
    assert.deepEqual(await ev(() => window.t.sources), ['design-menu'], id + ': one owned edit');
    assert.deepEqual(await checkedIn('layout'), [id], id + ': current menu choice');
    await ev(() => window.t.session.undo());
    assert.deepEqual(await doc(), before, id + ': one undo restores every authored field');
    await tab('Theme').click();
  }
  mark('new catalog layouts preserve content and owned undo');

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
  const sizes = [];
  for (const name of ['Theme', 'Colors', 'Fonts', 'Layout']) {
    await touch.page.getByRole('tab', { name: new RegExp(`^${name}( |$)`) }).tap();
    sizes.push(...await tev(() => [...document.querySelectorAll('.opf-design-menu-item, .opf-panel-close, [role=tab], .opf-design-menu-filter')].filter((node) => node.getClientRects().length).map((node) => ({ name: node.textContent.trim() || node.getAttribute('aria-label') || node.className, h: node.getBoundingClientRect().height, w: node.getBoundingClientRect().width }))));
  }
  assert.ok(sizes.length > 100, 'rows are measured');
  assert.deepEqual(sizes.filter((size) => size.h < 44 - 0.5 || (size.name === 'Close' && size.w < 44)), [], 'every row, tab, the filter and the close button are at least 44px');
  await touch.page.getByRole('tab', { name: /^Theme( |$)/ }).tap();
  await touch.page.getByRole('menuitemradio', { name: 'Bold', exact: true }).first().tap();
  assert.equal((await tev(() => window.t.session.presentation)).design.theme, 'bold', 'tapping a row applies it');
  assert.equal(await tev(() => document.documentElement.scrollWidth <= innerWidth), true);
  mark('touch sizes');
  assert.deepEqual(touch.errors, []);
} finally {
  await touch.close();
}

console.log(JSON.stringify({ passed: true, checks }, null, 2));
