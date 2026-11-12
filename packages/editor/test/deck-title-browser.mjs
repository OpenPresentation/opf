import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { buildStyles } from '../scripts/build-styles.mjs';

// CE-28: the deck title in a real browser, on a bare page (no workspace): the package stylesheet, the module and an editor session, bundled the way a
// host's bundler would. Focusing the name opens an edit that takes the whole row, with Save and Cancel; Enter or Save renames as one undoable edit,
// Escape or Cancel restores, and leaving the field does neither (the draft stays open); an empty name removes the key; the field follows undo and
// outside changes unless an edit is open; beforeCommit can stop a rename; a refused patch reports and restores; read-only and disabled show text
// without buttons; IME Enter does not commit; the row returns to its normal layout; destroy cleans up; under a coarse pointer the field and the
// buttons are 44px high, the text 16px, and nothing overflows at 320, 390, 820 and 1024 px.
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
  await page.setContent('<!doctype html><meta charset="utf-8"><body style="margin:0"><div id="row" data-opf-title-row style="display:flex;align-items:center;gap:12px;height:56px;padding:0 16px;box-sizing:border-box;border-bottom:1px solid #ccc"><div id="host" style="width:340px;flex:0 1 340px;min-width:0"></div><button id="other">Other</button><button id="tools" style="margin-left:auto">Tools</button></div><div id="below" style="height:40px">Below the row</div></body>');
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

  // At rest the width follows the content, down to 6ch and up to the container; while editing the field takes the whole row.
  await mount({ name: 'Hi' }, { placeholder: 'x' });
  const widthOf = () => input.evaluate((node) => node.getBoundingClientRect().width);
  const setName = (value) => page.evaluate((text) => window.session.applyPatch(text === '' ? [{ op: 'remove', path: '/name' }] : [{ op: 'add', path: '/name', value: text }], { source: 'host' }), value);
  const short = await widthOf();
  await setName('A considerably longer presentation name');
  const long = await widthOf();
  assert.ok(long > short + 100, `the field grows with its text (${short} -> ${long})`);
  await setName('W'.repeat(300));
  assert.ok((await widthOf()) <= 340 + 0.5, 'the field never outgrows its container');
  assert.equal(await input.evaluate((node) => getComputedStyle(node).textOverflow), 'ellipsis', 'a long name truncates with an ellipsis');
  assert.ok(await input.evaluate((node) => node.scrollWidth > node.clientWidth), 'the long name is cut, not wrapped');
  await setName('');
  const empty = await input.evaluate((node) => ({ width: node.getBoundingClientRect().width, ch: parseFloat(getComputedStyle(node).fontSize) * 0.5 * 6, size: node.size }));
  assert.ok(empty.width >= empty.ch, `at least about 6ch wide when empty (${empty.width}px)`);
  assert.ok(empty.size >= 6, 'the size attribute fallback is at least 6');
  mark('at rest the width follows the content, caps at the container, truncates and keeps a minimum');

  // --- editing takes the whole row -------------------------------------------------------------------------------------------
  const rowBox = () => page.evaluate(() => {
    const row = document.getElementById('row');
    const rect = (node) => { const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; };
    const visibility = (node) => getComputedStyle(node).visibility;
    return {
      row: rect(row), below: rect(document.getElementById('below')), host: rect(document.getElementById('host')), other: rect(document.getElementById('other')), tools: rect(document.getElementById('tools')),
      input: rect(window.title.input), save: rect(window.title.saveButton), cancel: rect(window.title.cancelButton), title: rect(window.title.element),
      otherVisibility: visibility(document.getElementById('other')), toolsVisibility: visibility(document.getElementById('tools')), inputVisibility: visibility(window.title.input),
      editing: row.hasAttribute('data-opf-title-editing'), position: getComputedStyle(row).position, actionsHidden: window.title.element.querySelector('.opf-title-actions').hidden,
    };
  });
  await mount({ name: 'A long presentation name that goes on and on' });
  const restBox = await rowBox();
  assert.equal(restBox.editing, false);
  assert.equal(restBox.actionsHidden, true, 'Save and Cancel are not shown at rest');
  assert.equal(await page.locator('.opf-title-button:visible').count(), 0, 'no visible buttons at rest');
  assert.equal(await page.evaluate(() => window.title.editing), false);
  await input.click();
  assert.equal(await page.evaluate(() => window.title.editing), true, 'focusing the name opens an edit');
  const editing = await rowBox();
  assert.equal(editing.editing, true, 'the row is marked');
  assert.equal(editing.position, 'relative', "a static row becomes the overlay's containing block");
  assert.equal(editing.row.h, restBox.row.h, 'the row keeps its height');
  assert.equal(editing.below.y, restBox.below.y, 'nothing below the row moves');
  assert.ok(Math.abs(editing.title.w - editing.row.w) < 1, `the editor spans the row (${editing.title.w} of ${editing.row.w})`);
  assert.ok(editing.input.w > 340 + 100, `the field is far wider than the 340px it had (${editing.input.w})`);
  assert.ok(editing.input.x >= editing.row.x + 16 - 0.5 && editing.cancel.x + editing.cancel.w <= editing.row.x + editing.row.w - 16 + 0.5, 'the row padding is kept at both ends');
  assert.ok(editing.save.x > editing.input.x + editing.input.w - 1 && editing.cancel.x > editing.save.x, 'the field, Save and Cancel sit in that order, Cancel last');
  assert.equal(editing.otherVisibility, 'hidden', "the row's other controls give way");
  assert.equal(editing.toolsVisibility, 'hidden');
  assert.equal(editing.inputVisibility, 'visible');
  assert.equal(editing.host.w, restBox.host.w, 'the slot keeps its room');
  assert.equal(editing.other.x, restBox.other.x, 'so nothing beside it moves');
  assert.equal(editing.tools.x, restBox.tools.x);
  assert.equal(await page.getByRole('button', { name: 'Save', exact: true }).isVisible(), true);
  assert.equal(await page.getByRole('button', { name: 'Cancel', exact: true }).isVisible(), true);
  assert.equal(await page.getByRole('textbox', { name: 'Presentation name' }).count(), 1, 'the field keeps its accessible name');
  assert.equal(await page.evaluate(() => document.activeElement === window.title.input), true, 'the field has the focus');
  await page.keyboard.press('Escape');
  const afterBox = await rowBox();
  assert.equal(afterBox.editing, false);
  assert.equal(afterBox.position, 'static', "the row's own positioning is restored");
  const plain = (box) => ({ ...box, input: null, save: null, cancel: null, title: null, actionsHidden: null });
  assert.deepEqual(plain(afterBox), plain(restBox), 'the row is exactly as before');
  assert.equal(afterBox.input.w, restBox.input.w, 'the field has its resting width again');
  assert.equal(await page.evaluate(() => window.title.element.getAttribute('style') ?? ''), '', 'no inline style is left on the part');
  // A row that is already positioned keeps its own position.
  await page.evaluate(() => { document.getElementById('row').style.position = 'sticky'; });
  await input.click();
  assert.equal((await rowBox()).position, 'sticky', 'a positioned row is left alone');
  await page.keyboard.press('Escape');
  await page.evaluate(() => { document.getElementById('row').style.position = ''; });
  // The row can be given as an option.
  await page.evaluate(() => window.mount({ name: 'Own row' }, { row: () => document.body }));
  await input.click();
  assert.ok(Math.abs(await page.evaluate(() => window.title.element.getBoundingClientRect().width - document.body.getBoundingClientRect().width)) < 1, 'the row option names the element the editor spans');
  await page.keyboard.press('Escape');
  mark('editing spans the whole row with Save and Cancel at its end; the row keeps its height and returns exactly');

  // --- rename by Enter -------------------------------------------------------------------------------------------------------
  await mount({ name: 'Old name' });
  await input.focus();
  await page.keyboard.press('Control+A');
  await page.keyboard.type('  New name  ');
  assert.equal(await name(), 'Old name', 'nothing is committed while typing');
  await page.keyboard.press('Enter');
  assert.equal(await name(), 'New name', 'Enter commits the trimmed name');
  assert.equal(await field(), 'New name', 'the field shows the trimmed name');
  assert.equal(await page.evaluate(() => window.title.editing), false, 'Enter closes the edit');
  assert.equal(await page.locator('.opf-title-button:visible').count(), 0, 'and the buttons');
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
  assert.equal(await page.evaluate(() => document.activeElement === window.title.input), true, 'and the focus returns to the field');
  assert.equal(await page.evaluate(() => window.title.editing), false, 'the edit is closed');
  assert.equal((await events()).length, 0, 'Escape commits nothing');
  assert.equal(await page.locator('.opf-title-button:visible').count(), 0, 'the buttons are gone');
  await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(() => document.activeElement === window.title.input), false, 'Escape with no edit open leaves the field');
  mark('Escape restores the name, keeps the focus in the field and commits nothing; a second Escape leaves it');

  // --- Save, Cancel and leaving the field ------------------------------------------------------------------------------------
  const save = page.getByRole('button', { name: 'Save', exact: true });
  const cancel = page.getByRole('button', { name: 'Cancel', exact: true });
  const focusedIsInput = () => page.evaluate(() => document.activeElement === window.title.input);
  await mount({ name: 'Before save' });
  await input.focus();
  await page.keyboard.press('Control+A');
  await page.keyboard.type('After save');
  await save.click();
  assert.equal(await name(), 'After save', 'Save commits');
  seen = await events();
  assert.equal(seen.length, 1, 'Save commits once');
  assert.equal(seen[0].source, 'deck-name');
  assert.deepEqual(seen[0].patches, [{ op: 'add', path: '/name', value: 'After save' }]);
  assert.deepEqual(await page.evaluate(() => window.log.rename), [{ name: 'After save', previous: 'Before save' }]);
  assert.equal(await page.evaluate(() => window.title.editing), false, 'Save closes the edit');
  assert.equal(await save.isVisible(), false, 'and hides the buttons');
  assert.equal(await focusedIsInput(), true, 'the focus returns to the title field');
  await page.keyboard.press('Enter');
  assert.equal((await events()).length, 1, 'Enter with no edit open commits nothing more');
  await page.evaluate(() => window.session.undo());
  assert.equal(await name(), 'Before save', 'undo restores the old name');
  assert.equal(await field(), 'Before save');
  mark('Save commits once as a deck-name edit, closes the edit, returns the focus to the field, and undo restores');

  await mount({ name: 'Keep this' });
  await input.focus();
  await page.keyboard.press('Control+A');
  await page.keyboard.type('Throw this away');
  await cancel.click();
  assert.equal(await name(), 'Keep this', 'Cancel keeps the document as it was');
  assert.equal(await field(), 'Keep this', 'and shows the name again');
  assert.equal((await events()).length, 0, 'Cancel commits nothing');
  assert.equal(await page.evaluate(() => window.title.editing), false);
  assert.equal(await focusedIsInput(), true, 'the focus returns to the title field after Cancel');
  assert.deepEqual(await page.evaluate(() => window.log.rename), []);
  // Escape from a button is Cancel too.
  await input.focus();
  await page.keyboard.type('x');
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement === window.title.saveButton), true);
  await page.keyboard.press('Escape');
  assert.equal(await field(), 'Keep this', 'Escape on Save cancels');
  assert.equal(await focusedIsInput(), true);
  mark('Cancel and Escape revert without a commit and return the focus to the field');

  // Leaving the field neither commits nor closes the edit.
  await mount({ name: 'Before blur' });
  await input.focus();
  await page.keyboard.press('Control+A');
  await page.keyboard.type('Draft name');
  await page.evaluate(() => document.getElementById('other').focus());
  assert.equal(await name(), 'Before blur', 'blur does not commit');
  assert.equal(await field(), 'Draft name', 'the draft stays');
  assert.equal(await page.evaluate(() => window.title.editing), true, 'the edit stays open');
  assert.equal(await save.isVisible() && await cancel.isVisible(), true, 'with Save and Cancel still there');
  assert.equal((await events()).length, 0);
  // A click elsewhere on the page and a click on the field again are no more a commit.
  await page.mouse.click(450, 200);
  assert.equal(await name(), 'Before blur');
  assert.equal(await field(), 'Draft name');
  await page.keyboard.press('Tab');
  await input.focus();
  assert.equal(await field(), 'Draft name', 'refocusing keeps the draft');
  assert.equal((await events()).length, 0);
  await page.keyboard.press('Enter');
  assert.equal(await name(), 'Draft name', 'only Enter commits it');
  assert.equal((await events()).length, 1);
  assert.equal((await events())[0].source, 'deck-name');
  // Moving the focus to Save and Cancel with the keyboard: Tab reaches Save, then Cancel; Space and Enter activate them.
  await mount({ name: 'Tab order' });
  await input.focus();
  await page.keyboard.press('Control+A');
  await page.keyboard.type('Tabbed');
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement === window.title.saveButton), true, 'Tab reaches Save');
  assert.equal(await name(), 'Tab order', 'moving to Save does not commit');
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement === window.title.cancelButton), true, 'then Cancel');
  assert.equal(await page.evaluate(() => window.title.editing), true);
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Space');
  assert.equal(await name(), 'Tabbed', 'Space on Save commits');
  assert.equal((await events()).length, 1);
  await page.keyboard.type('Again');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  assert.equal(await field(), 'Tabbed', 'Enter on Cancel cancels');
  assert.equal(await name(), 'Tabbed');
  assert.equal((await events()).length, 1);
  // The hidden controls of the row are not in the Tab order while editing.
  await input.focus();
  await page.keyboard.type('!');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => ['other', 'tools'].includes(document.activeElement.id)), false, "Tab never lands on the row's hidden controls");
  mark('blur neither commits nor closes; Tab reaches Save then Cancel; Space and Enter activate them; the hidden controls leave the Tab order');

  // An unchanged or empty name from Save: nothing for the document to do.
  await mount({ name: 'Same' });
  await input.focus();
  await page.keyboard.press('End');
  await page.keyboard.type('  ');
  await save.click();
  assert.equal((await events()).length, 0, 'an unchanged name makes no edit from Save');
  await mount({});
  await input.focus();
  await page.keyboard.type('   ');
  await save.click();
  assert.equal((await events()).length, 0, 'a name of only spaces on a deck with no name makes no edit');
  assert.equal(await page.evaluate(() => 'name' in window.session.snapshot().presentation), false);
  mark('Save with an unchanged name, or spaces on an unnamed deck, makes no edit');

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
  // The same from Save, and without an onError.
  await input.focus();
  await page.keyboard.press('Control+A');
  await page.keyboard.type('Refused again');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
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
  assert.equal(await page.evaluate(() => window.title.editing), false, 'a read-only title opens no edit');
  assert.equal(await page.locator('.opf-title-button:visible').count(), 0, 'and shows no Save or Cancel');
  assert.equal(await page.evaluate(() => document.getElementById('row').hasAttribute('data-opf-title-editing')), false, 'and does not take the row');
  assert.equal(await page.evaluate(() => getComputedStyle(document.getElementById('other')).visibility), 'visible', "the row's controls stay");
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
  await mount({ name: 'Named' }, { labels: { save: 'Speichern', cancel: 'Abbrechen' } });
  assert.deepEqual(await page.evaluate(() => [window.title.saveButton.textContent, window.title.cancelButton.textContent]), ['Speichern', 'Abbrechen'], 'the button texts are labels');
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
  // Edit by touch at each width: the editor fits the row, nothing overflows sideways, and Save and Cancel are at least 44px.
  for (const width of [320, 390, 820, 1024]) {
    await touch.page.setViewportSize({ width, height: 700 });
    await touch.page.evaluate(() => { window.mount({ name: 'N'.repeat(200) }); });
    await tInput.tap();
    const metrics = await touch.page.evaluate(() => {
      const rect = (node) => { const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, right: r.right }; };
      const row = document.getElementById('row');
      return {
        row: rect(row), title: rect(window.title.element), input: rect(window.title.input), save: rect(window.title.saveButton), cancel: rect(window.title.cancelButton),
        rowOverflow: row.scrollWidth - row.clientWidth, docOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        editing: window.title.editing, font: parseFloat(getComputedStyle(window.title.input).fontSize),
      };
    });
    assert.equal(metrics.editing, true, `a tap opens the edit at ${width}px`);
    assert.ok(metrics.rowOverflow <= 0 && metrics.docOverflow <= 0, `no sideways overflow at ${width}px (${metrics.rowOverflow}, ${metrics.docOverflow})`);
    assert.ok(Math.abs(metrics.title.w - metrics.row.w) < 1, `the editor spans the row at ${width}px (${metrics.title.w} of ${metrics.row.w})`);
    assert.ok(metrics.cancel.right <= metrics.row.w + 0.5 && metrics.save.x >= 0, `Save and Cancel are inside the row at ${width}px`);
    assert.ok(metrics.save.h >= 44 && metrics.save.w >= 44, `Save is at least 44 by 44 at ${width}px (${metrics.save.w} x ${metrics.save.h})`);
    assert.ok(metrics.cancel.h >= 44 && metrics.cancel.w >= 44, `Cancel is at least 44 by 44 at ${width}px (${metrics.cancel.w} x ${metrics.cancel.h})`);
    assert.ok(metrics.input.h >= 44 && metrics.input.w >= 100, `the field is at least 44px high and usable at ${width}px (${metrics.input.w} x ${metrics.input.h})`);
    assert.ok(metrics.font >= 16, `the text is at least 16px at ${width}px`);
    assert.ok(metrics.row.h === 56, 'the row keeps its height');
    // A tap on Cancel closes it; a tap on Save commits.
    await touch.page.getByRole('button', { name: 'Cancel', exact: true }).tap();
    assert.equal(await touch.page.evaluate(() => window.title.editing), false, `a tap on Cancel closes the edit at ${width}px`);
    await tInput.tap();
    await touch.page.keyboard.press('Control+A');
    await touch.page.keyboard.type(`Tapped ${width}`);
    await touch.page.getByRole('button', { name: 'Save', exact: true }).tap();
    assert.equal(await touch.page.evaluate(() => window.docName()), `Tapped ${width}`, `a tap on Save commits at ${width}px`);
    assert.equal(await touch.page.evaluate(() => window.title.editing), false);
  }
  assert.deepEqual(touch.errors, []);
  await touch.context.close();
  mark('under a coarse pointer the field is at least 44px high and 16px; at 320, 390, 820 and 1024 px the editor fits the row, Save and Cancel are at least 44px and tap through');
} finally {
  await browser.close();
}
console.log(`deck-title-browser: ${checks.length} checks passed\n- ${checks.join('\n- ')}`);
