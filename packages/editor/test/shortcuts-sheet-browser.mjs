import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { startPartPage } from './support/part-page.mjs';

// CE-29 in a real browser: the help item (src/shortcuts-sheet.js) on a bare page with the package stylesheet. Covers the button, the modal sheet
// (grouped rows, keys per platform, filtering by typing, the status line, Escape / backdrop / close, focus in and back, the Tab trap), the "?" key (and
// where it must stay quiet), setDisabled, menuItems, labels, an iframe document, listeners on destroy, axe in light and dark, and a coarse pointer.
const axeSource = readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');
const checks = [];
const mark = (name) => checks.push(name);

const SHORTCUTS = [
  { label: 'Undo', keys: ['Mod-z'], group: 'Edit' },
  { label: 'Redo', keys: ['Shift-Mod-z', 'Ctrl-y'], group: 'Edit' },
  { label: 'Find', keys: ['Mod-f'], group: 'Search' },
  { label: 'Keyboard shortcuts', keys: ['?', 'Shift-?'], group: 'Help' },
  { label: 'Zoom in', keys: ['Mod-='] },
];

const app = await startPartPage({ entry: './src/shortcuts-sheet.js', body: '<div id="host" class="opf-ui" style="padding:12px"><input id="field" aria-label="A field"><div id="edit" contenteditable="true" role="textbox" aria-label="An editor" tabindex="0">text</div><button id="before">Before</button><div id="bar"></div><div id="over"></div></div>' });
const { page, errors } = app;
const ev = (fn, arg) => page.evaluate(fn, arg);
await page.addStyleTag({ content: '*, *::before, *::after { transition: none !important; }' });
const rows = () => ev(() => [...document.querySelectorAll('.opf-help-sheet .opf-shortcuts-row')].map((row) => ({ name: row.querySelector('.opf-shortcuts-name').textContent, keys: [...row.querySelectorAll('.opf-shortcuts-key')].map((k) => k.textContent) })));
const isOpen = () => ev(() => !!document.querySelector('.opf-help-sheet'));
const active = () => ev(() => document.activeElement?.id || document.activeElement?.className || document.activeElement?.tagName);

try {
  // ---- instrument the page so a leak shows -------------------------------------------------------------------------------------------
  await ev(() => {
    const live = new Map();
    const add = document.addEventListener.bind(document), remove = document.removeEventListener.bind(document);
    document.addEventListener = (type, listener, options) => { live.set(type, (live.get(type) ?? new Set()).add(listener)); return add(type, listener, options); };
    document.removeEventListener = (type, listener, options) => { live.get(type)?.delete(listener); return remove(type, listener, options); };
    window.documentListeners = () => Object.fromEntries([...live].map(([type, set]) => [type, set.size]).filter(([, count]) => count));
    window.shortcutCalls = 0;
    window.getShortcuts = () => { window.shortcutCalls += 1; return window.SHORTCUTS; };
  });
  await ev((list) => { window.SHORTCUTS = list; }, SHORTCUTS);
  await ev(() => {
    window.help = window.part.createHelpButton(document.querySelector('#bar'), { overlay: document.querySelector('#over'), getShortcuts: window.getShortcuts });
  });

  // ---- the button --------------------------------------------------------------------------------------------------------------------
  const button = page.locator('.opf-help-button');
  assert.equal(await button.getAttribute('aria-label'), 'Keyboard shortcuts');
  assert.equal(await button.getAttribute('aria-haspopup'), 'dialog');
  assert.equal(await button.getAttribute('aria-expanded'), 'false');
  assert.equal(await button.getAttribute('title'), 'Keyboard shortcuts (?)');
  assert.equal(await ev(() => window.help.element.tagName), 'BUTTON');
  assert.equal(await ev(() => window.help.element.getBoundingClientRect().height), 32);
  assert.equal(await ev(() => window.shortcutCalls), 0, 'the list is read when the sheet opens, not before');
  mark('the help button is a real button named Keyboard shortcuts');

  // ---- opening, platforms, grouping ---------------------------------------------------------------------------------------------------
  await button.click();
  assert.equal(await isOpen(), true);
  assert.equal(await ev(() => window.shortcutCalls), 1);
  assert.equal(await ev(() => document.querySelector('#over .opf-help-sheet') !== null), true, 'the sheet is added to the overlay element');
  const dialog = page.locator('.opf-help-sheet [role=dialog]');
  assert.equal(await dialog.getAttribute('aria-modal'), 'true');
  assert.equal(await ev(() => document.getElementById(document.querySelector('.opf-help-sheet [role=dialog]').getAttribute('aria-labelledby')).textContent), 'Keyboard shortcuts');
  assert.equal(await button.getAttribute('aria-expanded'), 'true');
  assert.equal(await ev(() => document.activeElement.className), 'opf-shortcuts-search', 'focus moves to the filter field');
  assert.deepEqual(await ev(() => [...document.querySelectorAll('.opf-help-sheet .opf-shortcuts-group-title')].map((h) => h.textContent)), ['Edit', 'Search', 'Help', 'General'], 'rows are grouped in the order given; a row without a group goes under General');
  const platform = await ev(() => navigator.platform);
  const mod = /Mac/.test(platform) ? '⌘' : 'Ctrl+';
  assert.deepEqual((await rows())[0], { name: 'Undo', keys: [`${mod}Z`] }, 'Mod is shown for this platform');
  assert.equal((await rows())[1].keys.length, 2, 'alternatives are separate keys');
  assert.equal(await ev(() => document.querySelectorAll('.opf-help-sheet .opf-shortcuts-or').length), 2, 'with "or" between them (Redo, and ? / Shift-?)');
  assert.match(await ev(() => document.querySelector('.opf-help-sheet .opf-shortcuts-help').textContent), /Type to filter; Escape closes/);
  assert.equal(await ev(() => document.querySelector('.opf-help-sheet .opf-shortcuts-status').textContent), '5 shortcuts');
  mark('it opens a modal sheet in the overlay with the shortcuts grouped, focus in the filter');

  // The same classes as the source pane's sheet, so the same look.
  const look = await ev(() => {
    const root = document.querySelector('.opf-help-sheet'), css = getComputedStyle(root), dlg = getComputedStyle(root.querySelector('.opf-shortcuts-dialog'));
    const key = getComputedStyle(root.querySelector('.opf-shortcuts-key'));
    return { classes: root.className, position: css.position, z: css.zIndex, radius: dlg.borderTopLeftRadius, shadow: dlg.boxShadow !== 'none', keyFont: key.fontFamily, keyBorder: key.borderBottomWidth };
  });
  assert.match(look.classes, /\bopf-shortcuts\b/);
  assert.equal(look.position, 'fixed');
  assert.equal(look.radius, '12px');
  assert.equal(look.shadow, true);
  assert.equal(look.keyBorder, '2px');
  assert.match(look.keyFont, /Geist Mono|monospace/);
  mark('the sheet reuses the shortcuts dialog classes and look');

  // ---- filtering ---------------------------------------------------------------------------------------------------------------------
  await page.keyboard.type('redo');
  assert.deepEqual((await rows()).map((r) => r.name), ['Redo']);
  assert.equal(await ev(() => document.querySelector('.opf-help-sheet .opf-shortcuts-status').textContent), '1 of 5 shortcuts match');
  assert.deepEqual(await ev(() => [...document.querySelectorAll('.opf-help-sheet .opf-shortcuts-group-title')].map((h) => h.textContent)), ['Edit'], 'empty groups disappear');
  await page.locator('.opf-shortcuts-search').fill('ctrl+y');
  assert.deepEqual((await rows()).map((r) => r.name), /Mac/.test(platform) ? [] : ['Redo'], 'keys are searchable');
  await page.locator('.opf-shortcuts-search').fill('edit');
  assert.deepEqual((await rows()).map((r) => r.name), ['Undo', 'Redo'], 'so are groups');
  await page.locator('.opf-shortcuts-search').fill('nothing like this');
  assert.deepEqual(await rows(), []);
  assert.equal(await ev(() => document.querySelector('.opf-help-sheet .opf-shortcuts-none').textContent), 'No shortcut matches.');
  assert.equal(await ev(() => document.querySelector('.opf-help-sheet .opf-shortcuts-status').textContent), '0 of 5 shortcuts match');
  await page.locator('.opf-shortcuts-search').fill('');
  assert.equal((await rows()).length, 5);
  mark('typing filters by name, key and group, and the status line says how many match');

  // ---- closing and focus ---------------------------------------------------------------------------------------------------------------
  await page.keyboard.press('Escape');
  assert.equal(await isOpen(), false, 'Escape closes');
  assert.equal(await ev(() => document.activeElement === window.help.element), true, 'focus returns to the button');
  assert.equal(await button.getAttribute('aria-expanded'), 'false');
  await page.locator('#before').focus();
  await ev(() => window.help.open());
  assert.equal(await isOpen(), true);
  await page.keyboard.press('Escape');
  assert.equal(await active(), 'before', 'focus returns to the element that had it');
  await button.click();
  await page.locator('.opf-shortcuts-close').click();
  assert.equal(await isOpen(), false, 'the close button closes');
  await button.click();
  await page.mouse.click(5, 5);
  assert.equal(await isOpen(), false, 'a press on the backdrop closes');
  await ev(() => { window.help.open(); window.help.open(); });
  assert.equal(await ev(() => document.querySelectorAll('.opf-help-sheet').length), 1, 'opening twice shows one sheet');
  await ev(() => window.help.close());
  assert.equal(await isOpen(), false);
  await ev(() => window.help.close());
  mark('Escape, the close button, the backdrop and close() close it and return the focus');

  // ---- the Tab trap ------------------------------------------------------------------------------------------------------------------
  await button.click();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  const trapped = await ev(() => document.querySelector('.opf-help-sheet').contains(document.activeElement));
  assert.equal(trapped, true, 'Tab stays inside the sheet');
  for (let i = 0; i < 6; i++) await page.keyboard.press('Tab');
  assert.equal(await ev(() => document.querySelector('.opf-help-sheet').contains(document.activeElement)), true);
  await page.keyboard.press('Shift+Tab');
  assert.equal(await ev(() => document.querySelector('.opf-help-sheet').contains(document.activeElement)), true);
  await ev(() => document.querySelector('#before').focus());
  assert.equal(await ev(() => document.querySelector('.opf-help-sheet').contains(document.activeElement)), true, 'focus cannot leave while the sheet is open');
  await page.keyboard.press('Escape');
  mark('focus is trapped in the open sheet');

  // ---- the ? key ---------------------------------------------------------------------------------------------------------------------
  await page.locator('#before').focus();
  await page.keyboard.press('Shift+?');
  assert.equal(await isOpen(), true, '? opens the sheet from a button');
  await page.keyboard.press('Escape');
  assert.equal(await active(), 'before');
  await page.mouse.click(600, 500);
  await ev(() => document.activeElement?.blur());
  await page.keyboard.press('Shift+?');
  assert.equal(await isOpen(), true, '? opens it with nothing focused');
  await page.keyboard.press('Escape');

  await page.locator('#field').focus();
  await page.keyboard.press('Shift+?');
  assert.equal(await isOpen(), false, '? is typed into a field');
  assert.equal(await ev(() => document.querySelector('#field').value), '?');
  await page.locator('#edit').focus();
  await page.keyboard.press('Shift+?');
  assert.equal(await isOpen(), false, '? is typed into an editor');
  assert.match(await ev(() => document.querySelector('#edit').textContent), /\?/);
  await page.locator('#before').focus();
  await page.keyboard.press('Control+Shift+?');
  assert.equal(await isOpen(), false, 'Ctrl+? is not the key');
  await page.keyboard.press('/');
  assert.equal(await isOpen(), false, 'a bare / is not the key');
  await ev(() => {
    const second = new KeyboardEvent('keydown', { key: '?', shiftKey: true, bubbles: true, cancelable: true });
    document.querySelector('#before').addEventListener('keydown', (e) => e.preventDefault(), { once: true });
    document.querySelector('#before').dispatchEvent(second);
  });
  assert.equal(await isOpen(), false, 'a key another handler already took is left alone');
  mark('? opens the sheet except while typing, with a modifier, or when another handler took it');

  // ---- disabled, menuItems, bindKey: false ---------------------------------------------------------------------------------------------
  assert.deepEqual(await ev(() => window.help.menuItems().map(({ id, label, disabled }) => ({ id, label, disabled }))), [{ id: 'help', label: 'Keyboard shortcuts', disabled: false }]);
  await ev(() => window.help.menuItems()[0].run());
  assert.equal(await isOpen(), true, 'the menu item opens the sheet');
  await ev(() => window.help.setDisabled(true));
  assert.equal(await isOpen(), false, 'disabling closes an open sheet');
  assert.equal(await button.isDisabled(), true);
  assert.equal(await ev(() => window.help.open()), false);
  await page.locator('#before').focus();
  await page.keyboard.press('Shift+?');
  assert.equal(await isOpen(), false, 'a disabled help does not take the key');
  assert.equal(await ev(() => window.help.menuItems()[0].disabled), true);
  await ev(() => window.help.setDisabled(false));
  assert.equal(await button.isDisabled(), false);
  await ev(() => window.help.setDensity('touch'));
  assert.equal(await ev(() => window.help.element.getBoundingClientRect().height), 40);
  await ev(() => window.help.setDensity('comfortable'));

  const unbound = await ev(() => {
    const other = window.part.createHelpButton(document.querySelector('#bar'), { overlay: document.querySelector('#over'), getShortcuts: window.getShortcuts, bindKey: false });
    const title = other.element.title;
    other.destroy();
    return title;
  });
  assert.equal(unbound, 'Keyboard shortcuts', 'without the key the tooltip does not mention it');
  mark('setDisabled, menuItems and setDensity work');

  // ---- labels, platforms, an empty list ------------------------------------------------------------------------------------------------
  const labelled = await ev(() => {
    const other = window.part.createHelpButton(document.querySelector('#bar'), { overlay: document.querySelector('#over'), bindKey: false, getShortcuts: () => [], labels: { button: 'Tastenkürzel', heading: 'Tastenkürzel', close: 'Schließen', search: 'Kürzel filtern', searchPlaceholder: 'Filtern', empty: 'Keine Kürzel.' } });
    other.open();
    const sheet = document.querySelector('.opf-help-sheet');
    const out = { name: other.element.getAttribute('aria-label'), heading: sheet.querySelector('.opf-shortcuts-title').textContent, close: sheet.querySelector('.opf-shortcuts-close').getAttribute('aria-label'), search: sheet.querySelector('input').getAttribute('aria-label'), placeholder: sheet.querySelector('input').placeholder, empty: sheet.querySelector('.opf-shortcuts-none').textContent };
    other.destroy();
    return out;
  });
  assert.deepEqual(labelled, { name: 'Tastenkürzel', heading: 'Tastenkürzel', close: 'Schließen', search: 'Kürzel filtern', placeholder: 'Filtern', empty: 'Keine Kürzel.' });
  const macKeys = await ev(() => {
    Object.defineProperty(navigator, 'platform', { get: () => 'MacIntel', configurable: true });
    const other = window.part.createHelpButton(document.querySelector('#bar'), { overlay: document.querySelector('#over'), bindKey: false, getShortcuts: () => [{ label: 'Redo', keys: ['Shift-Mod-z'] }] });
    other.open();
    const out = { keys: [...document.querySelectorAll('.opf-help-sheet .opf-shortcuts-key')].map((k) => k.textContent), help: document.querySelector('.opf-help-sheet .opf-shortcuts-help').textContent };
    other.destroy();
    delete navigator.platform;
    return out;
  });
  assert.deepEqual(macKeys.keys, ['⇧⌘Z'], 'a Mac shows ⌘');
  assert.match(macKeys.help, /macOS/);
  mark('labels are overridable; keys are shown for the platform');

  // ---- a host that gives no overlay: the document body, with the surface class ------------------------------------------------------------
  const fallback = await ev(() => {
    const solo = document.createElement('div');
    document.body.append(solo);
    const other = window.part.createHelpButton(solo, { bindKey: false, getShortcuts: () => [{ label: 'X', keys: ['x'] }] });
    other.open();
    const sheet = document.querySelector('.opf-help-sheet');
    const out = { parent: sheet.parentElement.tagName, surface: sheet.classList.contains('opf-ui') };
    other.destroy();
    solo.remove();
    return out;
  });
  assert.deepEqual(fallback, { parent: 'BODY', surface: true });

  // ---- an iframe document -------------------------------------------------------------------------------------------------------------
  const framed = await ev(async () => {
    const frame = document.createElement('iframe');
    frame.style.cssText = 'width:600px;height:400px';
    document.body.append(frame);
    const inner = frame.contentDocument.createElement('div');
    frame.contentDocument.body.append(inner);
    const made = window.part.createHelpButton(inner, { getShortcuts: () => [{ label: 'Undo', keys: ['Mod-z'] }] });
    frame.contentDocument.body.dispatchEvent(new frame.contentWindow.KeyboardEvent('keydown', { key: '?', shiftKey: true, bubbles: true, cancelable: true }));
    const sheet = frame.contentDocument.querySelector('.opf-help-sheet');
    const out = { inFrame: !!sheet, notInParent: !document.querySelector('.opf-help-sheet'), owner: sheet?.ownerDocument === frame.contentDocument, kbd: sheet?.querySelector('kbd')?.textContent };
    made.destroy();
    out.removed = !frame.contentDocument.querySelector('.opf-help-sheet');
    frame.remove();
    return out;
  });
  assert.equal(framed.inFrame, true, '? on the frame\'s document opens the sheet in the frame');
  assert.equal(framed.notInParent, true);
  assert.equal(framed.owner, true);
  assert.match(framed.kbd, /^(Ctrl\+Z|⌘Z)$/);
  assert.equal(framed.removed, true);
  mark('it works in the container\'s own document (an iframe)');

  // ---- axe on the open sheet, light and dark -----------------------------------------------------------------------------------------------
  await page.addScriptTag({ content: axeSource });
  const axe = () => ev(async () => (await window.axe.run(document, { rules: Object.fromEntries(['region', 'document-title', 'html-has-lang', 'landmark-one-main', 'page-has-heading-one'].map((id) => [id, { enabled: false }])) })).violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`));
  assert.deepEqual(await axe(), [], 'axe is clean with the sheet closed');
  await button.click();
  assert.deepEqual(await axe(), [], 'axe is clean with the sheet open');
  await page.keyboard.press('Escape');
  await ev(() => { document.querySelector('#host').dataset.theme = 'dark'; document.body.style.background = 'hsl(220 24% 9%)'; });
  await button.click();
  assert.deepEqual(await axe(), [], 'axe is clean in dark');
  await page.keyboard.press('Escape');
  await ev(() => { delete document.querySelector('#host').dataset.theme; });
  mark('axe finds nothing, closed or open, in light and dark');

  // ---- destroy -----------------------------------------------------------------------------------------------------------------------
  const during = await ev(() => window.documentListeners());
  assert.equal(during.keydown, 1, 'one keydown listener while mounted');
  await button.click();
  assert.equal((await ev(() => window.documentListeners())).focusin, 1, 'one focusin listener while open');
  await ev(() => { window.help.destroy(); window.help.destroy(); window.help.open(); });
  assert.equal(await ev(() => document.querySelectorAll('.opf-help-button, .opf-help-sheet').length), 0, 'destroy removes the button and an open sheet');
  assert.deepEqual(await ev(() => window.documentListeners()), {}, 'no document listener is left');
  await page.locator('#before').focus();
  await page.keyboard.press('Shift+?');
  assert.equal(await isOpen(), false, 'a destroyed help no longer takes the key');
  mark('destroy removes the button, an open sheet and every document listener, and is safe twice');

  assert.deepEqual(errors, []);
} finally {
  await app.close();
}

// ---- a coarse pointer: 44px -------------------------------------------------------------------------------------------------------------
const touch = await startPartPage({ entry: './src/shortcuts-sheet.js', viewport: { width: 390, height: 800 }, context: { hasTouch: true, isMobile: true } });
try {
  assert.equal(await touch.page.evaluate(() => matchMedia('(pointer: coarse)').matches), true);
  const sizes = await touch.page.evaluate(() => {
    const help = window.part.createHelpButton(document.querySelector('#host'), { getShortcuts: () => [{ label: 'Undo', keys: ['Mod-z'], group: 'Edit' }] });
    const box = (el) => { const r = el.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; };
    const out = { button: box(help.element) };
    help.open();
    const sheet = document.querySelector('.opf-help-sheet');
    out.close = box(sheet.querySelector('.opf-shortcuts-close'));
    out.search = box(sheet.querySelector('input'));
    out.searchFont = getComputedStyle(sheet.querySelector('input')).fontSize;
    out.overflowX = document.documentElement.scrollWidth - document.documentElement.clientWidth;
    return out;
  });
  for (const name of ['button', 'close', 'search']) assert.ok(sizes[name][0] >= 44 && sizes[name][1] >= 44, `the ${name} control is at least 44px: ${sizes[name]}`);
  assert.equal(sizes.searchFont, '16px', 'the filter field is 16px so iOS does not zoom');
  assert.equal(sizes.overflowX, 0, 'no sideways scroll on a phone');
  mark('under a coarse pointer the button, the close button and the filter are at least 44px');
  assert.deepEqual(touch.errors, []);
} finally {
  await touch.close();
}

console.log(`shortcuts sheet browser: ${checks.length} checks passed`);
for (const name of checks) console.log(`  - ${name}`);
