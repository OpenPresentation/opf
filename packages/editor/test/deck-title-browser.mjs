import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { buildStyles } from '../scripts/build-styles.mjs';

// CE-28: the deck title in a real browser, on a bare page (no workspace): the package stylesheet, the module and an editor session, bundled the way a
// host's bundler would. Rename through Enter and blur lands in the document as one undoable edit; an empty name removes the key; Escape restores;
// the field follows undo and outside changes unless the person is typing; beforeCommit can stop a rename; a refused patch reports and restores;
// read-only and disabled show text; destroy cleans up; under a coarse pointer the field is 44px high and 16px.
const root = fileURLToPath(new URL('../', import.meta.url));
const checks = [];
const mark = (name) => checks.push(name);

const bundle = (await build({ stdin: { resolveDir: root, contents: `
  import { createDeckTitle, deckNamePatch } from './src/deck-title.js';
  import { createEditorSession } from './src/index.js';
  import { gallery } from '@openpresentation/gallery';
  window.opfTitle = { createDeckTitle, deckNamePatch, createEditorSession, gallery };
` }, bundle: true, platform: 'browser', format: 'iife', write: false, minify: !process.env.OPF_TEST_UNMINIFIED, conditions: ['browser'], logLevel: 'error' })).outputFiles[0].text;
const css = (await buildStyles(new URL('../src/styles/', import.meta.url))).css;
const channel = process.platform === 'win32' && !process.env.CI ? 'msedge' : undefined;
const browser = await chromium.launch({ channel });

async function openPage(contextOptions = {}) {
  const context = await browser.newContext({ viewport: { width: 900, height: 500 }, ...contextOptions });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.stack ?? error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.setContent('<!doctype html><meta charset="utf-8"><body style="margin:0;padding:16px"><div id="host" style="width:600px"></div><button id="other">Other</button></body>');
  await page.addStyleTag({ content: css });
  await page.addScriptTag({ content: bundle });
  // `mount(deckExtras, titleOptions)`: a fresh session and title. The log collects what the callbacks and the session report.
  await page.evaluate(() => {
    window.log = { rename: [], error: [], events: [], before: 0 };
    window.hooks = {
      gate: () => { window.log.before += 1; return window.allow !== false; },
      canvas: () => { window.session.applyPatch([{ op: 'add', path: '/name', value: 'Canvas edit' }], { source: 'canvas' }); return true; },
    };
    window.mount = (extra = {}, options = {}, hook) => {
      window.title?.destroy();
      const { createEditorSession, createDeckTitle, gallery } = window.opfTitle;
      const deck = { language: 'en-US', design: { theme: 'classic', fontScheme: 'roboto' }, slides: [{ id: 'a', title: 'Alpha' }], ...extra };
      window.session = createEditorSession(deck, { rejectInvalid: true, catalogs: [gallery] });
      window.session.subscribe((event) => window.log.events.push({ type: event.type, source: event.meta?.source, patches: event.patches }));
      window.log = { rename: [], error: [], events: [], before: 0 };
      window.title = createDeckTitle(document.getElementById('host'), {
        editor: window.session,
        onRename: (value) => window.log.rename.push(value),
        onError: (error) => window.log.error.push({ code: error?.code, message: String(error?.message) }),
        ...(hook ? { beforeCommit: window.hooks[hook] } : {}),
        ...options,
      });
      return true;
    };
    window.docName = () => window.session.snapshot().presentation.name;
  });
  return { page, context, errors };
}

try {
  const { page, context, errors } = await openPage();
  const input = page.locator('.opf-title-input');
  const name = () => page.evaluate(() => window.docName());
  const events = () => page.evaluate(() => window.log.events.filter((event) => event.type === 'patch' || event.type === 'undo' || event.type === 'redo'));
  const field = () => input.inputValue();
  const mount = (extra, options, hook) => page.evaluate(({ extra, options, hook }) => window.mount(extra, options, hook), { extra, options, hook });

  // --- structure -------------------------------------------------------------------------------------------------------------
  await mount({ name: 'Quarterly review' });
  assert.equal(await input.count(), 1);
  assert.equal(await input.getAttribute('type'), 'text');
  assert.equal(await input.getAttribute('aria-label'), 'Presentation name');
  assert.equal(await input.getAttribute('autocomplete'), 'off');
  assert.equal(await input.evaluate((node) => node.spellcheck), false, 'spellcheck is off');
  assert.equal(await field(), 'Quarterly review', 'the field shows the deck name');
  assert.equal(await input.getAttribute('placeholder'), 'Untitled presentation');
  assert.equal(await page.evaluate(() => window.title.element === document.querySelector('.opf-title') && window.title.input === document.querySelector('.opf-title-input')), true);
  assert.equal(await page.evaluate(() => window.title.element.parentElement.id), 'host');
  mark('the field shows the name with its label, placeholder and attributes');

  // It reads as plain text until hovered or focused.
  const look = () => input.evaluate((node) => { const s = getComputedStyle(node); return { border: s.borderTopColor, width: s.borderTopWidth, bg: s.backgroundColor, outline: s.outlineStyle }; });
  await page.mouse.move(800, 400);
  const resting = await look();
  assert.equal(resting.bg, 'rgba(0, 0, 0, 0)', 'no background at rest');
  assert.equal(resting.border, 'rgba(0, 0, 0, 0)', 'the border is transparent at rest');
  await input.hover();
  await page.waitForTimeout(250);
  const hovered = await look();
  assert.notEqual(hovered.border, resting.border, 'a border appears on hover');
  await page.mouse.move(800, 400);
  await input.focus();
  const focused = await look();
  assert.notEqual(focused.outline, 'none', 'a focus ring on focus');
  assert.equal(await page.evaluate(() => document.activeElement === window.title.input), true);
  await page.keyboard.press('Escape');
  mark('plain text at rest, a border on hover, a ring on focus');

  // Width follows the content, down to 6ch and up to the container.
  await mount({ name: 'Hi' }, { placeholder: 'x' });
  const widthOf = () => input.evaluate((node) => node.getBoundingClientRect().width);
  const short = await widthOf();
  await page.evaluate(() => { window.title.input.value = 'A considerably longer presentation name'; window.title.input.dispatchEvent(new Event('input')); });
  const long = await widthOf();
  assert.ok(long > short + 100, `the field grows with its text (${short} -> ${long})`);
  await page.evaluate(() => { window.title.input.value = 'W'.repeat(300); window.title.input.dispatchEvent(new Event('input')); });
  assert.ok((await widthOf()) <= 600 + 0.5, 'the field never outgrows its container');
  assert.equal(await input.evaluate((node) => getComputedStyle(node).textOverflow), 'ellipsis', 'a long name truncates with an ellipsis');
  assert.ok(await input.evaluate((node) => node.scrollWidth > node.clientWidth), 'the long name is cut, not wrapped');
  await page.evaluate(() => { window.title.input.value = ''; window.title.input.dispatchEvent(new Event('input')); });
  const empty = await input.evaluate((node) => ({ width: node.getBoundingClientRect().width, ch: parseFloat(getComputedStyle(node).fontSize) * 0.5 * 6, size: node.size }));
  assert.ok(empty.width >= empty.ch, `at least about 6ch wide when empty (${empty.width}px)`);
  assert.ok(empty.size >= 6, 'the size attribute fallback is at least 6');
  mark('width follows the content, caps at the container, truncates and keeps a minimum');

  // --- rename by Enter -------------------------------------------------------------------------------------------------------
  await mount({ name: 'Old name' });
  await input.focus();
  await page.keyboard.press('Control+A');
  await page.keyboard.type('  New name  ');
  assert.equal(await name(), 'Old name', 'nothing is committed while typing');
  await page.keyboard.press('Enter');
  assert.equal(await name(), 'New name', 'Enter commits the trimmed name');
  assert.equal(await field(), 'New name', 'the field shows the trimmed name');
  assert.equal(await page.evaluate(() => document.activeElement === window.title.input && window.title.input.selectionStart === 0 && window.title.input.selectionEnd === window.title.input.value.length), true, 'Enter keeps the focus in the field, the name selected');
  let seen = await events();
  assert.equal(seen.length, 1, 'one edit');
  assert.equal(seen[0].source, 'deck-name', 'the edit carries source deck-name');
  assert.deepEqual(seen[0].patches, [{ op: 'add', path: '/name', value: 'New name' }]);
  assert.deepEqual(await page.evaluate(() => window.log.rename), [{ name: 'New name', previous: 'Old name' }], 'onRename reports the name and the previous one');
  assert.equal(await page.evaluate(() => window.session.canUndo), true);
  await page.evaluate(() => window.session.undo());
  assert.equal(await name(), 'Old name', 'undo restores the old name');
  assert.equal(await field(), 'Old name', 'the field follows the undo');
  await page.evaluate(() => window.session.redo());
  assert.equal(await field(), 'New name', 'and the redo');
  mark('Enter renames as one undoable deck-name edit; undo and redo move the field');

  // A deck without a name gets one.
  await mount({});
  assert.equal(await field(), '', 'no name: an empty field with the placeholder');
  assert.equal(await page.evaluate(() => 'name' in window.session.snapshot().presentation), false);
  await input.focus();
  await page.keyboard.type('Fresh');
  await page.keyboard.press('Enter');
  assert.equal(await name(), 'Fresh');
  assert.deepEqual(await page.evaluate(() => window.log.rename), [{ name: 'Fresh', previous: undefined }]);
  mark('a deck without a name gets one (the placeholder shows until then)');

  // The same text is no edit.
  await mount({ name: 'Same' });
  await input.focus();
  await page.keyboard.press('Control+A');
  await page.keyboard.type('  Same ');
  await page.keyboard.press('Enter');
  assert.equal((await events()).length, 0, 'an unchanged name makes no edit');
  assert.equal(await field(), 'Same', 'the field is tidied');
  assert.deepEqual(await page.evaluate(() => window.log.rename), []);
  await input.focus();
  await input.blur();
  assert.equal((await events()).length, 0, 'focus and blur alone make no edit');
  mark('an unchanged name and a plain focus/blur make no edit');

  // --- empty removes the name ------------------------------------------------------------------------------------------------
  await mount({ name: 'To remove' });
  await input.focus();
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Delete');
  await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(() => 'name' in window.session.snapshot().presentation), false, 'an empty name removes the key');
  assert.deepEqual((await events())[0].patches, [{ op: 'remove', path: '/name' }]);
  assert.deepEqual(await page.evaluate(() => window.log.rename), [{ name: '', previous: 'To remove' }]);
  assert.equal(await field(), '');
  await page.evaluate(() => window.session.undo());
  assert.equal(await field(), 'To remove', 'undo brings the name back');
  mark('an empty name removes the key and undo restores it');

  // --- Escape ----------------------------------------------------------------------------------------------------------------
  await mount({ name: 'Keep me' });
  await input.focus();
  await page.keyboard.press('Control+A');
  await page.keyboard.type('Discard me');
  await page.keyboard.press('Escape');
  assert.equal(await field(), 'Keep me', 'Escape restores the current name');
  assert.equal(await name(), 'Keep me');
  assert.equal(await page.evaluate(() => document.activeElement === window.title.input), false, 'and leaves the field');
  assert.equal((await events()).length, 0, 'Escape commits nothing');
  mark('Escape restores the name, blurs and commits nothing');

  // --- blur ------------------------------------------------------------------------------------------------------------------
  await mount({ name: 'Before blur' });
  await input.focus();
  await page.keyboard.press('Control+A');
  await page.keyboard.type('After blur');
  await page.locator('#other').focus();
  assert.equal(await name(), 'After blur', 'blur commits');
  assert.equal((await events()).length, 1);
  assert.equal((await events())[0].source, 'deck-name');
  mark('blur commits');

  // --- IME -------------------------------------------------------------------------------------------------------------------
  await mount({ name: 'Kana' });
  await input.focus();
  await page.keyboard.press('Control+A');
  await page.keyboard.type('にほん');
  await page.evaluate(() => {
    const target = window.title.input;
    target.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
    target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', isComposing: true, bubbles: true, cancelable: true }));
    target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 229, bubbles: true, cancelable: true }));
  });
  assert.equal(await name(), 'Kana', 'Enter during composition does not commit');
  assert.equal(await page.evaluate(() => document.activeElement === window.title.input), true, 'and the field keeps focus');
  await page.evaluate(() => window.title.input.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true })));
  await page.keyboard.press('Enter');
  assert.equal(await name(), 'にほん', 'Enter after the composition commits');
  mark('Enter during IME composition does not commit');

  // --- the document changes under the field ---------------------------------------------------------------------------------
  await mount({ name: 'First' });
  await page.evaluate(() => window.session.applyPatch([{ op: 'add', path: '/name', value: 'From source' }], { source: 'source' }));
  assert.equal(await field(), 'From source', 'the field follows a change from elsewhere');
  await page.evaluate(() => window.session.applyPatch([{ op: 'remove', path: '/name' }], { source: 'source' }));
  assert.equal(await field(), '', 'and a removal');
  await page.evaluate(() => window.session.applyPatch([{ op: 'add', path: '/name', value: 'Back' }], { source: 'source' }));
  // Mid-edit: the typed text is not clobbered, and it is committed on Enter.
  await input.focus();
  await page.keyboard.press('Control+A');
  await page.keyboard.type('Typing');
  await page.evaluate(() => window.session.applyPatch([{ op: 'add', path: '/name', value: 'Elsewhere' }], { source: 'host' }));
  assert.equal(await field(), 'Typing', 'an outside change does not clobber the text being typed');
  await page.evaluate(() => window.title.refresh());
  assert.equal(await field(), 'Typing', 'nor does refresh()');
  await page.keyboard.press('Enter');
  assert.equal(await name(), 'Typing', 'the typed name wins when committed');
  await page.evaluate(() => window.session.applyPatch([{ op: 'add', path: '/name', value: 'After' }], { source: 'host' }));
  assert.equal(await field(), 'After', 'the field follows again once the edit is done');
  // Escape mid-edit shows the latest document name, not the one from the start of the edit.
  await input.focus();
  await page.keyboard.type(' typed');
  await page.evaluate(() => window.session.applyPatch([{ op: 'add', path: '/name', value: 'Latest' }], { source: 'host' }));
  await page.keyboard.press('Escape');
  assert.equal(await field(), 'Latest', 'Escape shows the latest name');
  mark('the field follows undo/source/host changes but not while typing');

  // --- beforeCommit ----------------------------------------------------------------------------------------------------------
  await mount({ name: 'Gate' }, {}, 'gate');
  await page.evaluate(() => { window.allow = false; });
  await input.focus();
  await page.keyboard.press('Control+A');
  await page.keyboard.type('Blocked');
  await page.keyboard.press('Enter');
  assert.equal(await name(), 'Gate', 'beforeCommit returning false aborts the rename');
  assert.equal(await page.evaluate(() => window.log.before), 1);
  assert.equal(await field(), 'Blocked', 'the typed text stays');
  assert.equal(await page.evaluate(() => document.activeElement === window.title.input), true, 'and so does the focus');
  assert.deepEqual(await page.evaluate(() => window.log.rename), []);
  await page.evaluate(() => { window.allow = true; });
  await page.keyboard.press('Enter');
  assert.equal(await name(), 'Blocked', 'allowed the second time');
  assert.equal(await page.evaluate(() => window.log.before), 2);
  // The hook sees the committed canvas edit: it runs before the current name is read.
  await mount({ name: 'Hooked' }, {}, 'canvas');
  await input.focus();
  await page.keyboard.press('Control+A');
  await page.keyboard.type('Canvas edit');
  await page.keyboard.press('Enter');
  assert.equal(await name(), 'Canvas edit');
  assert.deepEqual((await events()).map((event) => event.source), ['canvas'], 'a rename that equals the hook\'s result adds no edit');
  mark('beforeCommit false aborts and keeps the text; it runs before the name is read');

  // --- refused patch ---------------------------------------------------------------------------------------------------------
  // A document with an error finding refuses every edit (rejectInvalid).
  await mount({ name: 'Locked', unknownKey: 1 });
  assert.equal(await page.evaluate(() => window.session.validation.valid), false, 'the fixture is invalid');
  await input.focus();
  await page.keyboard.press('Control+A');
  await page.keyboard.type('Refused');
  await page.keyboard.press('Enter');
  const failure = await page.evaluate(() => window.log.error);
  assert.equal(failure.length, 1, 'onError is called once');
  assert.equal(failure[0].code, 'invalid-opf-edit');
  assert.equal(await field(), 'Locked', 'the field shows the current name again');
  assert.equal(await name(), 'Locked');
  assert.deepEqual(await page.evaluate(() => window.log.rename), [], 'onRename is not called');
  // The same on blur, and without an onError.
  await input.focus();
  await page.keyboard.press('Control+A');
  await page.keyboard.type('Refused again');
  await page.locator('#other').focus();
  assert.equal(await field(), 'Locked');
  assert.equal((await page.evaluate(() => window.log.error)).length, 2);
  await mount({ name: 'Locked', unknownKey: 1 }, { onError: undefined });
  await input.focus();
  await page.keyboard.type('x');
  await page.keyboard.press('Enter');
  assert.equal(await field(), 'Locked', 'a refused rename without onError still restores the field');
  mark('a refused patch calls onError, restores the field and does not call onRename');

  // --- readOnly and disabled -------------------------------------------------------------------------------------------------
  await mount({ name: 'A rather long name for a tooltip' }, { readOnly: true });
  assert.equal(await input.evaluate((node) => node.readOnly), true);
  assert.equal(await input.getAttribute('title'), 'A rather long name for a tooltip', 'the title shows the full name');
  assert.equal(await field(), 'A rather long name for a tooltip');
  await input.focus();
  await page.keyboard.type('nope');
  await page.keyboard.press('Enter');
  assert.equal(await field(), 'A rather long name for a tooltip', 'a read-only field cannot be typed into');
  assert.equal((await events()).length, 0);
  assert.equal(await input.evaluate((node) => getComputedStyle(node).cursor), 'default');
  await input.evaluate((node) => { node.setSelectionRange(0, node.value.length); });
  assert.equal(await input.evaluate((node) => node.selectionEnd - node.selectionStart), 'A rather long name for a tooltip'.length, 'the text is selectable');
  await page.evaluate(() => window.title.setReadOnly(false));
  assert.equal(await input.evaluate((node) => node.readOnly), false);
  await input.focus();
  await page.keyboard.press('Control+A');
  await page.keyboard.type('Editable now');
  await page.keyboard.press('Enter');
  assert.equal(await name(), 'Editable now');
  // Disabled: text, and a pending edit is dropped.
  await input.focus();
  await page.keyboard.type(' plus');
  await page.evaluate(() => window.title.setDisabled(true));
  assert.equal(await field(), 'Editable now', 'disabling drops the pending text');
  assert.equal(await input.getAttribute('aria-disabled'), 'true');
  assert.equal(await input.evaluate((node) => node.readOnly), true, 'disabled is read-only text');
  assert.equal(await input.getAttribute('title'), 'Editable now');
  await page.evaluate(() => { window.title.input.focus(); });
  await page.keyboard.type('nope');
  await page.keyboard.press('Enter');
  assert.equal(await name(), 'Editable now');
  assert.equal(await page.evaluate(() => window.session.snapshot().presentation.name), 'Editable now');
  await page.evaluate(() => window.session.applyPatch([{ op: 'add', path: '/name', value: 'Still follows' }], { source: 'host' }));
  assert.equal(await field(), 'Still follows', 'a disabled field still follows the document');
  assert.equal(await input.getAttribute('title'), 'Still follows', 'with the title kept current');
  await page.evaluate(() => window.title.setDisabled(false));
  assert.equal(await input.getAttribute('aria-disabled'), null);
  assert.equal(await input.evaluate((node) => node.readOnly), false);
  mark('read-only and disabled show selectable text with a title; they re-enable');

  // --- density, focus(), labels ----------------------------------------------------------------------------------------------
  await mount({ name: 'Dense' });
  const heightOf = () => input.evaluate((node) => Math.round(node.getBoundingClientRect().height));
  assert.equal(await page.evaluate(() => window.title.element.dataset.density), 'comfortable');
  assert.equal(await heightOf(), 32, 'comfortable is 32px with a mouse');
  await page.evaluate(() => window.title.setDensity('touch'));
  assert.equal(await page.evaluate(() => window.title.element.dataset.density), 'touch');
  assert.equal(await heightOf(), 40, 'touch density is 40px');
  await page.evaluate(() => window.title.setDensity('comfortable'));
  assert.equal(await heightOf(), 32);
  await page.evaluate(() => window.title.focus());
  assert.equal(await page.evaluate(() => document.activeElement === window.title.input), true, 'focus() focuses the field');
  await page.keyboard.press('Escape');
  await mount({ name: 'Named' }, { density: 'touch', labels: { label: 'Titel', placeholder: 'Ohne Namen' } });
  assert.equal(await page.evaluate(() => window.title.element.dataset.density), 'touch', 'density is an option');
  assert.equal(await input.getAttribute('aria-label'), 'Titel');
  await mount({}, { labels: { placeholder: 'Ohne Namen' }, label: 'Own label', placeholder: 'Own placeholder' });
  assert.equal(await input.getAttribute('aria-label'), 'Own label', 'label wins over labels.label');
  assert.equal(await input.getAttribute('placeholder'), 'Own placeholder', 'placeholder wins over labels.placeholder');
  mark('density, focus(), label and placeholder options');

  // --- destroy ---------------------------------------------------------------------------------------------------------------
  await mount({ name: 'Gone soon' });
  await page.evaluate(() => {
    const title = window.title;
    window.stale = title.input;
    title.destroy();
    title.destroy();
  });
  assert.equal(await page.locator('.opf-title').count(), 0, 'destroy removes the element');
  await page.evaluate(() => window.session.applyPatch([{ op: 'add', path: '/name', value: 'After destroy' }], { source: 'host' }));
  assert.equal(await page.evaluate(() => window.stale.value), 'Gone soon', 'a destroyed title no longer follows the editor');
  await page.evaluate(() => { window.title.refresh(); window.title.focus(); });
  assert.equal(await page.locator('.opf-title').count(), 0, 'the handle is inert afterwards');
  mark('destroy removes the element and the editor subscription and is safe twice');

  assert.deepEqual(errors, [], `page errors: ${errors.join('\n')}`);
  await context.close();

  // --- touch: a coarse pointer -----------------------------------------------------------------------------------------------
  const touch = await openPage({ hasTouch: true, isMobile: false, viewport: { width: 390, height: 700 } });
  assert.equal(await touch.page.evaluate(() => matchMedia('(pointer: coarse)').matches), true, 'the page has a coarse pointer');
  const tInput = touch.page.locator('.opf-title-input');
  await touch.page.evaluate(() => window.mount({ name: 'Touch deck' }));
  for (const density of ['comfortable', 'touch']) {
    await touch.page.evaluate((value) => window.title.setDensity(value), density);
    const box = await tInput.evaluate((node) => ({ height: node.getBoundingClientRect().height, font: parseFloat(getComputedStyle(node).fontSize) }));
    assert.ok(box.height >= 44, `the field has a 44px hit area under a coarse pointer, ${density} (${box.height})`);
    assert.ok(box.font >= 16, `the text is at least 16px under a coarse pointer, ${density} (${box.font})`);
  }
  await touch.page.evaluate(() => { document.getElementById('host').style.width = '100%'; window.mount({ name: 'N'.repeat(200) }); });
  const narrow = await tInput.evaluate((node) => ({ width: node.getBoundingClientRect().width, doc: document.documentElement.scrollWidth, view: document.documentElement.clientWidth }));
  assert.ok(narrow.width <= 358.5 && narrow.doc <= narrow.view, 'a long name fits a phone without sideways scroll');
  assert.deepEqual(touch.errors, []);
  await touch.context.close();
  mark('under a coarse pointer the field is at least 44px high and 16px, and fits a phone');
} finally {
  await browser.close();
}
console.log(`deck-title-browser: ${checks.length} checks passed\n- ${checks.join('\n- ')}`);
