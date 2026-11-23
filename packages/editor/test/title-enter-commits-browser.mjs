import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { loadFonts } from '@openpresentation/opf-render/fonts-node';

// Real-browser check of `canvas: { titleEnterCommits: true }`: Enter commits an inline slide title, Shift+Enter keeps a line break, Enter during
// IME composition does not commit, the hint is on screen while the title is edited and gone after a commit and after a cancel, only slide titles
// are affected, and `labels.titleEnterHint` replaces the hint's words.
const faces = (await loadFonts({ pack: 'office' })).registry.embeddedFonts.filter((face) => face.family === 'Roboto' && [400, 700].includes(face.weight) && !face.italic);
const bundled = await build({ stdin: { resolveDir: fileURLToPath(new URL('../', import.meta.url)), contents: `
  import { createEditorSession } from './dist/index.js';
  import { createCanvasEditor } from './dist/canvas.js';
  import { loadFonts } from '@openpresentation/opf-render/fonts-browser';
  import { gallery as defaultCatalog } from '@openpresentation/gallery';
  window.mountTitleEnter = async ({ deck, faces, options = {} }) => {
    window.cv?.destroy(); window.fonts?.dispose();
    window.events = { commits: [], cancels: [], errors: [] };
    window.fonts = await loadFonts({ faces: faces.map((face) => ({ ...face, data: Uint8Array.from(atob(face.dataUrl.split(',')[1]), (c) => c.charCodeAt(0)) })), substitutionPolicy: 'visual', fallbackFamily: 'Roboto' });
    window.editor = createEditorSession(deck, { rejectInvalid: true, catalogs: [defaultCatalog] });
    window.cv = createCanvasEditor(document.querySelector('#canvas'), { editor, fonts, ...options,
      onError: (error) => events.errors.push(error.message),
      onCommit: (event) => events.commits.push(event.path), onCancel: (event) => events.cancels.push(event.path) });
    await cv.ready;
  };` }, bundle: true, platform: 'browser', format: 'iife', write: false, minify: true });

const deck = () => ({ design: { fontScheme: 'roboto' }, slides: [{ title: 'Opening title', text: 'Body words' }, { title: 'Second', items: ['One', 'Two'] }] });
const browser = await chromium.launch({ channel: process.platform === 'win32' ? 'msedge' : undefined });
const errors = [], checks = [];
const mark = (name) => checks.push(name);
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setContent('<div id="canvas" style="width:1000px;margin:20px"></div>');
  await page.addScriptTag({ content: bundled.outputFiles[0].text });
  const mount = (options = { titleEnterCommits: true }) => page.evaluate((args) => mountTitleEnter(args), { deck: deck(), faces, options });
  const paint = () => page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const begin = async (path) => { await page.evaluate((p) => cv.beginEdit(p), path); await paint(); };
  const editing = () => page.evaluate(() => cv.editingPath ?? null);
  const hints = () => page.locator('.opf-title-key-hint');
  const value = (path) => page.evaluate((p) => editor.get(p), path);
  const typeInto = async (text) => { await page.keyboard.press('Control+A'); await page.keyboard.type(text); };

  // Enter commits.
  await mount();
  await begin('slides.0.title');
  assert.equal(await editing(), 'slides.0.title');
  assert.equal(await hints().count(), 1, 'the hint shows while the title is edited');
  assert.equal(await hints().innerText(), 'Enter to finish · Shift+Enter for a new line');
  assert.equal(await page.evaluate(() => document.activeElement.getAttribute('aria-description')), 'Enter to finish · Shift+Enter for a new line');
  await typeInto('Renamed by Enter');
  await page.keyboard.press('Enter');
  await paint();
  assert.equal(await editing(), null, 'Enter ended the edit');
  assert.equal(await value('slides.0.title'), 'Renamed by Enter');
  assert.equal(await hints().count(), 0, 'the hint is gone after the commit');
  assert.deepEqual(await page.evaluate(() => events.commits), ['slides.0.title']);
  assert.equal(await page.evaluate(() => editor.canUndo), true);
  assert.equal(await value('slides.0.title').then((title) => (typeof title === 'string' ? title : title.map((run) => run.text).join('')).includes('\n')), false, 'no line break was inserted');
  mark('Enter commits an inline slide title and removes the hint');

  // Shift+Enter keeps a line break and does not commit.
  await begin('slides.0.title');
  await typeInto('First line');
  await page.keyboard.press('Shift+Enter');
  await page.keyboard.type('Second line');
  assert.equal(await editing(), 'slides.0.title', 'Shift+Enter did not end the edit');
  assert.equal(await page.evaluate(() => document.activeElement.value), 'First line\nSecond line');
  assert.equal(await hints().count(), 1);
  await page.keyboard.press('Enter');
  await paint();
  assert.equal(await editing(), null);
  const flat = (title) => (typeof title === 'string' ? title : title.map((run) => run.text).join(''));
  assert.equal(flat(await value('slides.0.title')), 'First line\nSecond line', 'the committed title keeps its line break');
  mark('Shift+Enter inserts a line break, Enter then commits it');

  // Enter during IME composition (the event reports isComposing, or the legacy keyCode 229) does not commit.
  await begin('slides.0.title');
  await typeInto('Composing');
  const committed = await page.evaluate(() => events.commits.length);
  for (const init of [{ key: 'Enter', isComposing: true }, { key: 'Enter', keyCode: 229 }]) {
    const prevented = await page.evaluate((eventInit) => {
      const event = new KeyboardEvent('keydown', { ...eventInit, bubbles: true, cancelable: true });
      document.activeElement.dispatchEvent(event);
      return event.defaultPrevented;
    }, init);
    assert.equal(prevented, false, `${JSON.stringify(init)} is left to the input method`);
    assert.equal(await editing(), 'slides.0.title', `${JSON.stringify(init)} did not commit`);
  }
  assert.equal(await page.evaluate(() => events.commits.length), committed, 'no commit came from the composition keys');
  mark('Enter during IME composition does not commit');

  // Cancel removes the hint and drops the draft.
  assert.equal(await hints().count(), 1);
  await page.keyboard.press('Escape');
  await paint();
  assert.equal(await editing(), null);
  assert.equal(await hints().count(), 0, 'the hint is gone after Escape');
  assert.equal(flat(await value('slides.0.title')), 'First line\nSecond line', 'Escape dropped the draft');
  await begin('slides.0.title');
  assert.equal(await hints().count(), 1, 'one hint again on the next edit, not two');
  await page.evaluate(() => cv.cancel());
  await paint();
  assert.equal(await hints().count(), 0, 'the hint is gone after cancel()');
  mark('the hint is removed after a cancel');

  // Only slide titles are affected: body text commits and shows nothing of the kind.
  await begin('slides.0.text');
  assert.equal(await editing(), 'slides.0.text');
  assert.equal(await hints().count(), 0, 'no hint for text');
  await page.keyboard.press('Control+A');
  await page.keyboard.type('Line A');
  await page.keyboard.press('Enter');
  assert.equal(await editing(), 'slides.0.text', 'Enter in body text does not commit');
  await page.evaluate(() => cv.cancel());
  await paint();
  mark('body text is not affected');

  // Without the option: no hint, and Enter does not commit.
  await mount({});
  await begin('slides.0.title');
  assert.equal(await hints().count(), 0, 'no hint without the option');
  await page.keyboard.press('Control+A');
  await page.keyboard.type('Stays open');
  await page.keyboard.press('Enter');
  assert.equal(await editing(), 'slides.0.title', 'Enter does not commit without the option');
  await page.evaluate(() => cv.cancel());
  mark('without titleEnterCommits nothing changes');

  // The hint's words are a label.
  await mount({ titleEnterCommits: true, labels: { titleEnterHint: 'Eingabe zum Beenden' } });
  await begin('slides.0.title');
  assert.equal(await hints().innerText(), 'Eingabe zum Beenden');
  assert.equal(await page.evaluate(() => document.activeElement.getAttribute('aria-description')), 'Eingabe zum Beenden');
  await page.evaluate(() => cv.cancel());
  mark('the hint comes from labels.titleEnterHint');

  assert.deepEqual(await page.evaluate(() => events.errors), []);
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
}
console.log(`title-enter-commits browser: ${checks.length} checks ok`);
