import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {chromium} from 'playwright';
import {loadOfficeFontRegistry} from '@openpresentation/opf-render/fonts-node';

// Real-browser check of the text entry gestures: a single press on editable text enters editing with the caret at the
// pressed character (PowerPoint / Google Slides), a press-drag selects a range, keyboard entry selects all, and
// `textEntry: "dblclick"` keeps the older gesture but still places the caret at the pointer.
const faces = (await loadOfficeFontRegistry()).embeddedFonts.filter((face) => face.family === 'Roboto' && [400, 700].includes(face.weight) && !face.italic);
const bundled = await build({stdin: {resolveDir: fileURLToPath(new URL('../', import.meta.url)), contents: `
  import {createEditorSession} from './dist/index.js';
  import {createCanvasEditor} from './dist/canvas.js';
  import {loadBrowserFontRegistry} from '@openpresentation/opf-render/fonts-browser';
  window.mountClickEntry = async ({deck, faces, options = {}}) => {
    window.cv?.destroy(); window.fonts?.dispose();
    window.events = {selects: [], errors: [], commits: [], cancels: []};
    window.fonts = await loadBrowserFontRegistry(faces.map((face) => ({...face, data: Uint8Array.from(atob(face.dataUrl.split(',')[1]), (c) => c.charCodeAt(0))})), {substitutionPolicy: 'visual', fallbackFamily: 'Roboto'});
    window.editor = createEditorSession(deck, {rejectInvalid: true});
    window.cv = createCanvasEditor(document.querySelector('#canvas'), {editor, renderOptions: {textMeasurement: fonts.textMeasurement}, ...options,
      onSelect: (event) => events.selects.push(event.path), onError: (error) => events.errors.push(error.message),
      onCommit: (event) => events.commits.push(event.path), onCancel: (event) => events.cancels.push(event.path)});
    await cv.ready;
  };
  // Client point of one rendered character of a traced text target: 'left' and 'right' click its two halves.
  window.charPoint = (path, needle, k = 0, side = 'left') => {
    const target = document.querySelector('[data-canvas-target][data-opf-path="' + path + '"]');
    const node = [...target.querySelectorAll('text,tspan')].find((n) => n.firstChild?.nodeType === 3 && n.textContent.includes(needle));
    if (!node) throw Error('No rendered line contains ' + JSON.stringify(needle));
    const index = node.textContent.indexOf(needle) + k, range = document.createRange();
    range.setStart(node.firstChild, index); range.setEnd(node.firstChild, index + 1);
    const box = range.getBoundingClientRect();
    return {x: box.left + box.width * (side === 'left' ? 0.25 : 0.75), y: box.top + box.height / 2, width: box.width, left: box.left, right: box.right, top: box.top, bottom: box.bottom};
  };
  window.inputState = () => {
    const input = document.activeElement;
    if (!input || !/^(opf-inline-input|opf-rich-input)$/.test(input.className)) return null;
    return {kind: input.className, start: input.selectionStart, end: input.selectionEnd, direction: input.selectionDirection, value: input.value, editing: cv.editingPath};
  };`}, bundle: true, platform: 'browser', format: 'iife', write: false, minify: true});

const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jP0cAAAAASUVORK5CYII=';
const wrapped = 'Wrapped subtitle  with double spaces and a tab\tinside and a long tail that must wrap over several lines of the subtitle placeholder because it is long, really long, so very long indeed';
const bullet = 'This is a fairly long bullet that will need to wrap across several lines of the placeholder because it is long, indeed and more words follow to reach a third line';
const design = {fontScheme: 'roboto', footer: {center: {text: 'Confidential footer'}}};
const deck = {design, slides: [
  {title: 'Quarterly review of everything', subtitle: wrapped},
  {title: 'Centered heading here', subtitle: 'Short', design: {titleAlignment: 'center'}},
  {title: 'Right aligned heading', design: {titleAlignment: 'right'}},
  {title: 'Bullets', items: [bullet, 'Second bullet']},
  {title: 'Rich', text: [{text: 'Hello ', bold: true}, {text: 'world again', underline: true}]},
  {title: 'CRLF', text: 'line one\r\nline two\r\n\r\nline four  spaced'},
  {title: 'Media', composition: {mode: 'grid', columns: 2}, blocks: [
    {image: {src: png, alt: 'Sample image'}},
    {chart: {type: 'column', data: {columns: ['Quarter', 'Revenue'], rows: [['Q1', 12], ['Q2', 18]]}}},
    {text: 'Left placeholder text'},
    {text: 'Right placeholder text'},
  ]},
  {title: 'Numbers', blocks: [{table: {columns: ['Name', 'Amount'], rows: [['alpha', 12], ['beta', 18]]}}]},
]};

const browser = await chromium.launch({channel: process.platform === 'win32' ? 'msedge' : undefined});
const errors = [], checks = [];
const done = (name) => checks.push(name);
try {
  const page = await browser.newPage({viewport: {width: 1440, height: 1200}});
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setContent('<div id="canvas" style="width:1000px;margin:20px"></div>');
  await page.addScriptTag({content: bundled.outputFiles[0].text});
  const mount = async (options, value = deck) => { await page.evaluate((args) => mountClickEntry(args), {deck: value, faces, options}); };
  const slide = async (index) => { await page.evaluate((i) => cv.setSlide(i), index); };
  const paint = () => page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const point = (path, needle, k, side) => page.evaluate((args) => charPoint(...args), [path, needle, k, side]);
  const state = () => page.evaluate(() => inputState());
  const value = (path) => page.evaluate((p) => editor.get(p), path);
  const flat = (text) => (typeof text === 'string' ? text : text.map((run) => run.text).join('')).replace(/\r\n|\r/g, '\n');
  const target = (path) => page.locator(`[data-canvas-target][data-opf-path="${path}"]`);
  const discard = async () => { await page.evaluate(() => cv.cancel()); await paint(); };
  // One press on a character half must leave a collapsed caret at that boundary of the input value.
  async function pressAt(path, needle, k, side, expectedIn) {
    const source = flat(await value(path)), expected = source.indexOf(needle) + k + (side === 'right' ? 1 : 0);
    assert.equal(source.indexOf(needle), source.lastIndexOf(needle), `fixture needle ${needle} must be unique`);
    const at = await point(path, needle, k, side);
    await page.mouse.click(at.x, at.y);
    const got = await state();
    assert.ok(got, `${path}: a press must focus the inline input`);
    assert.equal(got.editing, path);
    assert.equal(got.start, got.end, `${path} ${JSON.stringify(needle)}+${k} ${side}: pointer entry must not select a range (saw ${got.start}-${got.end} of ${got.value.length})`);
    assert.equal(got.start, expectedIn ?? expected, `${path} ${JSON.stringify(needle)}+${k} ${side}`);
    return got;
  }

  // 1. Single click: caret at the clicked character, box selected, onSelect fired, hover outline kept.
  await mount();
  await slide(0);
  {
    const hover = await point('slides.0.title', 'Quarterly', 2);
    await page.mouse.move(hover.x, hover.y);
    const stroke = await target('slides.0.title').locator(':scope > rect.opf-selection').evaluate((node) => getComputedStyle(node).stroke);
    assert.notEqual(stroke, 'rgba(0, 0, 0, 0)', 'hover keeps the outline highlight');
    assert.notEqual(stroke, 'none');
    for (const side of ['left', 'right']) {
      for (const [needle, k] of [['Quarterly', 0], ['review', 3], ['everything', 9]]) {
        await pressAt('slides.0.title', needle, k, side);
        await discard();
      }
    }
    await pressAt('slides.0.title', 'Quarterly', 0, 'left');
    assert.ok(await target('slides.0.title').evaluate((node) => node.hasAttribute('data-canvas-selected')), 'the box is selected while editing');
    assert.deepEqual(await page.evaluate(() => events.selects.slice(-1)), ['slides.0.title']);
    assert.equal(await page.evaluate(() => cv.editingPath), 'slides.0.title');
    await discard();
    done('title: one click puts a collapsed caret at the clicked glyph half (left and right halves, start, middle, end)');
  }

  // 2. Wrapped subtitle with double spaces and a tab: every line, both halves.
  await slide(0);
  for (const [needle, k] of [['Wrapped', 0], ['double', 2], ['spaces', 5], ['inside', 0], ['tail', 1], ['placeholder', 4], ['very long', 3], ['indeed', 5]]) {
    for (const side of ['left', 'right']) {
      await pressAt('slides.0.subtitle', needle, k, side);
      await discard();
    }
  }
  {
    // Glyphs after collapsed/double spaces and after the tab keep their exact source offset.
    const spaced = flat(wrapped);
    const at = await point('slides.0.subtitle', 'with double', 0, 'left');
    await page.mouse.click(at.x, at.y);
    assert.equal((await state()).start, spaced.indexOf('with double'));
    await discard();
    // Past the right end of a wrapped line and below the last line: the nearest line end / end of text.
    const line = await point('slides.0.subtitle', 'Wrapped', 0);
    const frame = await target('slides.0.subtitle').boundingBox();
    await page.mouse.click(frame.x + frame.width - 3, line.y);
    const first = await state();
    assert.equal(first.start, first.end);
    assert.ok(first.start >= spaced.indexOf('lines ') + 5 && first.start <= spaced.indexOf('lines ') + 6, 'a click right of a wrapped line lands at that line end');
    await discard();
    const last = await point('slides.0.subtitle', 'indeed', 5, 'right');
    await page.mouse.click(frame.x + frame.width - 3, frame.y + frame.height - 2);
    assert.equal((await state()).start, spaced.length, 'a click below the last line lands at the end');
    await discard();
    done('wrapped subtitle: double spaces, tab, wrapped lines and clicks outside the glyphs map to exact source offsets');
  }

  // 3. Wrapped bullet, third line.
  await slide(3);
  for (const [needle, k] of [['This', 1], ['across', 2], ['reach', 0], ['third', 2]]) {
    for (const side of ['left', 'right']) {
      await pressAt('slides.3.items.0', needle, k, side);
      await discard();
    }
  }
  done('bullets: a wrapped list item maps line by line');

  // 4. Centered and right-aligned text.
  await slide(1);
  for (const side of ['left', 'right']) { await pressAt('slides.1.title', 'Centered', 3, side); await discard(); await pressAt('slides.1.title', 'here', 3, side); await discard(); }
  await slide(2);
  for (const side of ['left', 'right']) { await pressAt('slides.2.title', 'Right', 0, side); await discard(); await pressAt('slides.2.title', 'heading', 6, side); await discard(); }
  done('centered and right-aligned titles');

  // 5. Footer furniture.
  await slide(0);
  for (const side of ['left', 'right']) { await pressAt('design.footer.center.text', 'Confidential', 5, side); await discard(); }
  done('footer furniture text');

  // 6. CRLF source: offsets are input (LF) offsets and typing keeps the source line endings.
  await slide(5);
  for (const [needle, k] of [['line two', 0], ['line four', 5], ['spaced', 2]]) {
    for (const side of ['left', 'right']) { await pressAt('slides.5.text', needle, k, side); await discard(); }
  }
  {
    const at = await point('slides.5.text', 'line two', 5, 'left');
    await page.mouse.click(at.x, at.y);
    await page.keyboard.type('X');
    await page.evaluate(() => cv.commit());
    assert.equal(await value('slides.5.text'), 'line one\r\nline Xtwo\r\n\r\nline four  spaced');
    await page.evaluate(() => editor.undo());
    done('CRLF source: LF input offsets, typing after a click keeps the original line endings');
  }

  // 7. Rich text: same single-click caret through the rich input's own pointer mapping.
  await slide(4);
  for (const [needle, k] of [['Hello', 1], ['world', 2], ['again', 4]]) {
    for (const side of ['left', 'right']) {
      const source = flat(await value('slides.4.text')), expected = source.indexOf(needle) + k + (side === 'right' ? 1 : 0);
      const at = await point('slides.4.text', needle, k, side);
      await page.mouse.click(at.x, at.y);
      const got = await state();
      assert.equal(got.kind, 'opf-rich-input');
      assert.equal(got.start, got.end, 'rich text pointer entry must not select all');
      assert.equal(got.start, expected, `rich ${needle}+${k} ${side}`);
      assert.equal(await page.locator('.opf-rich-caret').count(), 1);
      await discard();
    }
  }
  {
    const at = await point('slides.4.text', 'world', 2);
    await page.mouse.click(at.x, at.y);
    await page.mouse.click(at.x, at.y);
    const word = await state();
    assert.equal(word.value.slice(word.start, word.end), 'world', 'a double click in rich text selects the word');
    await page.mouse.click(at.x, at.y);
    const paragraph = await state();
    assert.equal(paragraph.value.slice(paragraph.start, paragraph.end), 'Hello world again', 'a triple click selects the paragraph');
    await discard();
    done('rich text: caret at the click, no select-all, double-click selects a word');
  }

  // 8. Press-drag selects from the press point to the release point; nothing moves.
  await slide(0);
  {
    const before = JSON.stringify(await page.evaluate(() => editor.document));
    const a = await point('slides.0.subtitle', 'Wrapped', 0, 'left'), b = await point('slides.0.subtitle', 'double', 2, 'right');
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, {steps: 4});
    await page.mouse.move(b.x, b.y, {steps: 4});
    await page.mouse.up();
    const forward = await state();
    const source = flat(wrapped);
    assert.deepEqual([forward.start, forward.end, forward.direction], [source.indexOf('Wrapped'), source.indexOf('double') + 3, 'forward']);
    assert.equal(await page.evaluate(() => document.activeElement.className), 'opf-inline-input', 'the input keeps focus after the drag');
    await page.keyboard.type('Z');
    await page.evaluate(() => cv.commit());
    assert.equal(await value('slides.0.subtitle'), `Z${wrapped.slice(source.indexOf('double') + 3)}`);
    await page.evaluate(() => editor.undo());
    // Reverse drag across lines is backward; the second press also works from inside an editing input.
    const c = await point('slides.0.subtitle', 'very long', 3, 'right'), d = await point('slides.0.subtitle', 'tail', 1, 'left');
    await page.mouse.move(c.x, c.y);
    await page.mouse.down();
    await page.mouse.move(d.x, d.y, {steps: 12});
    await page.mouse.up();
    const backward = await state();
    assert.deepEqual([backward.start, backward.end, backward.direction], [source.indexOf('tail') + 1, source.indexOf('very long') + 4, 'backward']);
    await discard();
    assert.equal(JSON.stringify(await page.evaluate(() => editor.document)), before, 'a text drag never changes or moves the document');
    done('press-drag selects a forward, backward and multi-line range without moving anything');
  }

  // 9. While editing: native double-click selects a word, triple-click a paragraph, clicks move the caret.
  await slide(5);
  {
    const first = await point('slides.5.text', 'line two', 1, 'left');
    await page.mouse.click(first.x, first.y);
    const inside = await point('slides.5.text', 'line four', 6, 'left');
    await page.mouse.click(inside.x, inside.y);
    assert.equal((await state()).start, flat(await value('slides.5.text')).indexOf('line four') + 6, 'a click inside the editing text moves the caret');
    await page.mouse.dblclick(inside.x, inside.y);
    const word = await state();
    assert.equal(word.value.slice(word.start, word.end).trim(), 'four', 'a double click selects the word');
    await page.mouse.click(inside.x, inside.y, {clickCount: 3});
    const paragraph = await state();
    assert.equal(paragraph.value.slice(paragraph.start, paragraph.end).replace(/\n$/, ''), 'line four  spaced', 'a triple click selects the paragraph');
    await discard();
    done('while editing: double-click selects a word, triple-click a paragraph, clicks move the caret');
  }

  // 10. Another text target commits the edit and enters with the caret in one click; invalid edits refuse.
  await slide(0);
  {
    await pressAt('slides.0.title', 'Quarterly', 0, 'left');
    await page.keyboard.type('New ');
    const at = await point('slides.0.subtitle', 'tail', 2, 'right');
    await page.mouse.click(at.x, at.y);
    assert.equal(await value('slides.0.title'), 'New Quarterly review of everything', 'the first edit commits');
    const got = await state();
    assert.equal(got.editing, 'slides.0.subtitle');
    assert.equal(got.start, got.end);
    assert.equal(got.start, flat(wrapped).indexOf('tail') + 3);
    await discard();
    await page.evaluate(() => editor.undo());
    await slide(7);
    const cell = 'slides.7.blocks.0.table.rows.0.1';
    const at1 = await point(cell, '12', 0, 'left');
    await page.mouse.click(at1.x, at1.y);
    await page.keyboard.press('Control+a');
    await page.keyboard.press('Delete');
    await paint();
    const other = await point('slides.7.blocks.0.table.rows.1.0', 'beta', 1, 'left');
    await page.mouse.click(other.x, other.y);
    assert.equal(await page.evaluate(() => cv.editingPath), cell, 'an invalid number edit refuses to commit and stays');
    assert.equal(await value(cell), 12);
    assert.ok((await page.evaluate(() => events.errors)).length > 0, 'the refusal is reported');
    await discard();
    done('clicking another text target commits then enters at the click; an invalid edit refuses');
  }

  // 11. Keyboard entry selects everything; Escape leaves editing with the box still selected.
  await slide(0);
  for (const key of ['Enter', ' ', 'F2']) {
    await target('slides.0.title').focus();
    await page.keyboard.press(key);
    const got = await state();
    assert.equal(got.editing, 'slides.0.title');
    assert.deepEqual([got.start, got.end], [0, got.value.length], `${JSON.stringify(key)} selects all text`);
    await page.keyboard.press('Escape');
    await paint();
    assert.equal(await page.evaluate(() => cv.editingPath), null);
    assert.ok(await target('slides.0.title').evaluate((node) => node.hasAttribute('data-canvas-selected')), 'Escape keeps the box selected');
    assert.equal(await page.evaluate(() => document.activeElement.getAttribute('data-opf-path')), 'slides.0.title', 'focus returns to the box');
  }
  await slide(4);
  await target('slides.4.text').focus();
  await page.keyboard.press('F2');
  {
    const got = await state();
    assert.deepEqual([got.kind, got.start, got.end], ['opf-rich-input', 0, got.value.length], 'keyboard entry selects all rich text');
    await page.keyboard.press('Escape');
  }
  done('Enter, Space and F2 select all; Escape keeps the box selected');

  // 12. Non-text targets keep select / double-click behaviour.
  await slide(6);
  for (const path of ['slides.6.blocks.0.image', 'slides.6.blocks.1.chart']) {
    const node = target(path);
    await node.click();
    assert.equal(await page.evaluate(() => cv.editingPath), null, `${path}: a single click only selects`);
    assert.equal(await page.evaluate(() => events.selects.at(-1)), path);
    assert.ok(await node.evaluate((n) => n.hasAttribute('data-canvas-selected')));
    assert.equal(await page.locator('form[aria-label="Content properties"]').count(), 0);
    await node.dblclick();
    assert.equal(await page.locator('form[aria-label="Content properties"]').count(), 1, `${path}: a double click opens properties`);
    await page.evaluate(() => cv.cancel());
  }
  done('images and charts: click selects, double-click opens properties');

  // 13. Layout handles keep working (and text presses beside them still edit).
  await mount({layoutEditing: true});
  await slide(6);
  {
    const handle = page.locator('[role="separator"]').first();
    const box = await handle.boundingBox();
    assert.ok(box, 'a layout handle is present');
    const start = await page.evaluate(() => JSON.stringify(editor.get('slides.6.composition')));
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 60, box.y + box.height / 2, {steps: 6});
    await page.mouse.up();
    await paint();
    assert.notEqual(await page.evaluate(() => JSON.stringify(editor.get('slides.6.composition'))), start, 'dragging a layout handle resizes the tracks');
    assert.equal(await page.evaluate(() => cv.editingPath), null, 'a handle drag does not enter text editing');
    const left = await point('slides.6.blocks.2.text', 'Left', 1, 'left');
    await page.mouse.click(left.x, left.y);
    assert.equal((await state()).editing, 'slides.6.blocks.2.text');
    await discard();
    done('layout handles still drag and text beside them still edits');
  }

  // 14. textEntry: "dblclick" keeps the old gesture, but places the caret at the point.
  await mount({textEntry: 'dblclick'});
  await slide(0);
  {
    const at = await point('slides.0.title', 'review', 3, 'right');
    await page.mouse.click(at.x, at.y);
    assert.equal(await state(), null, 'a single click only selects in dblclick mode');
    assert.equal(await page.evaluate(() => events.selects.at(-1)), 'slides.0.title');
    await page.mouse.dblclick(at.x, at.y);
    const got = await state();
    assert.equal(got.editing, 'slides.0.title');
    assert.equal(got.start, got.end, 'dblclick mode does not select all');
    assert.equal(got.start, flat(await value('slides.0.title')).indexOf('review') + 4);
    await page.keyboard.press('Escape');
    await target('slides.0.title').focus();
    await page.keyboard.press('Enter');
    const all = await state();
    assert.deepEqual([all.start, all.end], [0, all.value.length]);
    await discard();
    assert.equal(await page.evaluate(async () => { try { document.body.append(Object.assign(document.createElement('div'), {id: 'x'})); const {createCanvasEditor} = window; return typeof createCanvasEditor; } catch (error) { return error.message; } }), 'undefined');
    done('textEntry "dblclick": click selects, double-click places the caret, Enter selects all');
  }

  // 15. Irregular output falls back to the textarea layout instead of guessing from glyph indexes.
  await mount();
  await slide(0);
  {
    await page.evaluate(() => {
      for (const node of document.querySelectorAll('[data-opf-path="slides.0.subtitle"] text')) for (const name of ['data-opf-source-start', 'data-opf-source-end', 'data-opf-source-next-start']) node.removeAttribute(name);
    });
    for (const [needle, k, side] of [['Wrapped', 3, 'left'], ['tail', 1, 'right'], ['placeholder', 4, 'left']]) {
      const got = await pressAt('slides.0.subtitle', needle, k, side);
      assert.equal(got.start, flat(wrapped).indexOf(needle) + k + (side === 'right' ? 1 : 0));
      await discard();
    }
    done('untraced text falls back to the positioned textarea layout');
  }

  // 16. Other buttons never enter editing.
  await slide(0);
  {
    const at = await point('slides.0.title', 'Quarterly', 1);
    await page.mouse.click(at.x, at.y, {button: 'right'});
    assert.equal(await state(), null);
    assert.equal(await page.evaluate(() => cv.editingPath), null);
    done('a secondary button does not enter editing');
  }

  // RR-25: reveal(path) shows the slide the path is on and selects the nearest content the canvas can select.
  await mount();
  await slide(0);
  {
    const selected = await page.evaluate(() => cv.reveal('slides.3.items.1'));
    assert.match(selected, /^slides.3.items/, 'a list item selects its list');
    assert.equal(await page.evaluate(() => cv.slideIndex), 3, 'reveal shows the slide');
    assert.ok(await target(selected).evaluate((node) => node.hasAttribute('data-canvas-selected')));
    assert.equal(await page.evaluate(() => cv.reveal('slides.0.notes')), null, 'notes are not on the canvas');
    assert.equal(await page.evaluate(() => cv.slideIndex), 0);
    done('reveal shows the slide and selects the nearest target');
  }

  // 17. Touch: a tap enters at the tapped character; a touch drag (scroll) does not.
  const touch = await browser.newContext({hasTouch: true, viewport: {width: 1440, height: 1200}});
  {
    const tap = await touch.newPage();
    tap.on('pageerror', (error) => errors.push(error.message));
    await tap.setContent('<div id="canvas" style="width:1000px;margin:20px"></div>');
    await tap.addScriptTag({content: bundled.outputFiles[0].text});
    await tap.evaluate((args) => mountClickEntry(args), {deck, faces, options: {}});
    const at = await tap.evaluate(() => charPoint('slides.0.title', 'review', 3, 'right'));
    await tap.touchscreen.tap(at.x, at.y);
    const got = await tap.evaluate(() => inputState());
    assert.ok(got);
    assert.equal(got.start, got.end);
    assert.equal(got.start, 'Quarterly review of everything'.indexOf('review') + 4, 'a tap places the caret at the tapped character');
    await tap.close();
    done('touch: a tap enters at the tapped character');
  }
  await touch.close();

  assert.deepEqual(errors, []);
  console.log(`Click entry: ${checks.length} browser workflows passed.\n - ${checks.join('\n - ')}`);
} finally {
  await browser.close();
}
