import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {chromium} from 'playwright';
import {loadFonts} from '@openpresentation/opf-render/fonts-node';

// LH-76: a "Topic: qualifier" title that would wrap is drawn as two items that share the title's path: the topic as the title
// and the qualifier as a subtitle. In-place editing works on the whole authored title: a press on either part starts from the
// whole title, and a commit writes the whole edited string, the qualifier included.
const faces = (await loadFonts({pack: 'office'})).registry.embeddedFonts.filter((face) => face.family === 'Roboto' && [400, 700].includes(face.weight) && !face.italic);
const bundled = await build({stdin: {resolveDir: fileURLToPath(new URL('../', import.meta.url)), contents: `
  import {createEditorSession} from './dist/index.js';
  import {createCanvasEditor} from './dist/canvas.js';
  import {loadFonts} from '@openpresentation/opf-render/fonts-browser';
  import {gallery as defaultCatalog} from '@openpresentation/gallery';
  window.mount = async ({deck, faces}) => {
    window.cv?.destroy(); window.fonts?.dispose();
    window.events = {errors: [], commits: []};
    window.fonts = await loadFonts({faces: faces.map((face) => ({...face, data: Uint8Array.from(atob(face.dataUrl.split(',')[1]), (c) => c.charCodeAt(0))})), substitutionPolicy: 'visual', fallbackFamily: 'Roboto'});
    window.editor = createEditorSession(deck, {rejectInvalid: true, catalogs: [defaultCatalog]});
    window.cv = createCanvasEditor(document.querySelector('#canvas'), {editor, fonts,
      onError: (error) => events.errors.push(error.message), onCommit: (event) => events.commits.push(event.path)});
    await cv.ready;
  };
  // Client point of a rendered word in any node drawn for a path (the qualifier node is not a canvas target).
  window.wordPoint = (path, needle) => {
    const nodes = [...document.querySelectorAll('[data-opf-path="' + path + '"] text, [data-opf-path="' + path + '"] tspan')];
    const node = nodes.find((n) => n.firstChild?.nodeType === 3 && n.textContent.includes(needle));
    if (!node) throw Error('No rendered line contains ' + JSON.stringify(needle));
    const index = node.textContent.indexOf(needle), range = document.createRange();
    range.setStart(node.firstChild, index); range.setEnd(node.firstChild, index + 1);
    const box = range.getBoundingClientRect();
    return {x: box.left + box.width * 0.25, y: box.top + box.height / 2};
  };
  window.drawnParts = (path) => [...document.querySelectorAll('svg [data-opf-path="' + path + '"]')].filter((node) => !node.parentElement.closest('[data-opf-path="' + path + '"]')).map((node) => node.textContent.trim());
  window.inputState = () => {
    const input = document.activeElement;
    return input?.className === 'opf-inline-input' ? {value: input.value, start: input.selectionStart, end: input.selectionEnd, editing: cv.editingPath} : null;
  };`}, bundle: true, platform: 'browser', format: 'iife', write: false, minify: true});

const title = 'Market sizing: a bottom-up estimate across every region we serve today and the three we enter next year';
const deck = {design: {fontScheme: 'roboto'}, slides: [{layout: 'text', title, text: 'Body text below the heading.'}]};

const browser = await chromium.launch({channel: process.platform === 'win32' ? 'msedge' : undefined});
const errors = [], checks = [];
try {
  const page = await browser.newPage({viewport: {width: 1440, height: 1000}});
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setContent('<div id="canvas" style="width:1000px;margin:20px"></div>');
  await page.addScriptTag({content: bundled.outputFiles[0].text});
  const mount = () => page.evaluate((args) => mount(args), {deck, faces});
  const paint = () => page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const state = () => page.evaluate(() => inputState());
  const value = () => page.evaluate(() => editor.get('slides.0.title'));
  const point = (needle) => page.evaluate((n) => wordPoint('slides.0.title', n), needle);

  await mount();
  await paint();
  const parts = await page.evaluate(() => drawnParts('slides.0.title'));
  assert.equal(parts.length, 2, `the fixture title is drawn split (saw ${JSON.stringify(parts)})`);
  assert.ok(parts[0].startsWith('Market sizing') && !parts[0].includes(':'), parts[0]);
  checks.push('the title is drawn as the topic and the qualifier');

  // 1. Edit one word of the topic and commit: the whole edited title is written, ": qualifier" intact.
  const at = await point('sizing');
  await page.mouse.click(at.x, at.y);
  let got = await state();
  assert.ok(got, 'a press on the topic opens the inline input');
  assert.equal(got.editing, 'slides.0.title');
  assert.equal(got.value, title, 'the input starts from the whole authored title');
  assert.equal(got.start, title.indexOf('sizing'), 'the caret lands at the pressed topic character');
  // The input shows the whole title, stepped down to fit, over both parts, which are hidden while it is edited; the target is named by both parts.
  const look = await page.evaluate(() => {
    const input = document.activeElement, parts = [...document.querySelectorAll('svg g[data-opf-path="slides.0.title"]')].filter((node) => !node.parentElement.closest('[data-opf-path="slides.0.title"]'));
    return {color: getComputedStyle(input).color, bottom: input.getBoundingClientRect().bottom, partsBottom: Math.max(...parts.map((part) => part.getBoundingClientRect().bottom)),
      hidden: parts.map((part) => getComputedStyle(part).opacity), label: document.querySelector('[data-canvas-target][data-opf-path="slides.0.title"]').getAttribute('aria-label')};
  });
  assert.notEqual(look.color, 'rgba(0, 0, 0, 0)', 'the whole title is visible in the input');
  assert.ok(look.bottom >= look.partsBottom - 3, `the input covers both parts (${look.bottom} < ${look.partsBottom})`);
  assert.deepEqual(look.hidden, ['0', '0']);
  assert.ok(look.label.includes('Market sizing') && look.label.includes('bottom-up'), look.label);
  // Select the word "sizing" from the caret and type over it.
  for (let k = 0; k < 'sizing'.length; k++) await page.keyboard.press('Shift+ArrowRight');
  await page.keyboard.type('size');
  assert.equal((await state()).value, title.replace('sizing', 'size'));
  assert.equal(await page.evaluate(() => cv.commit()), true);
  await paint();
  assert.equal(await value(), title.replace('sizing', 'size'), 'the commit writes the whole title, the qualifier included');
  checks.push('editing a topic word and committing writes the whole title with ": qualifier" intact');

  // 2. A press on the qualifier also edits the whole title, with the caret at the pressed qualifier character.
  const edited = await value();
  const q = await point('bottom-up');
  await page.mouse.click(q.x, q.y);
  got = await state();
  assert.ok(got, 'a press on the qualifier opens the inline input');
  assert.equal(got.editing, 'slides.0.title');
  assert.equal(got.value, edited);
  assert.equal(got.start, edited.indexOf('bottom-up'), 'the caret lands at the pressed qualifier character');
  await page.keyboard.press('Control+End');
  await page.keyboard.type(' now');
  assert.equal(await page.evaluate(() => cv.commit()), true);
  await paint();
  assert.equal(await value(), `${edited} now`);
  checks.push('a press on the qualifier edits the whole title at the pressed character');
  assert.deepEqual(await page.evaluate(() => events.errors), []);
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
}
console.log(`Title split editing passed:\n - ${checks.join('\n - ')}`);
