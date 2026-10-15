import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {mkdir} from 'node:fs/promises';
import path from 'node:path';
import {build} from 'esbuild';
import {chromium} from 'playwright';
import { loadFonts } from '@openpresentation/opf-render/fonts-node';

// Real-browser check that the canvas selection outline uses the placeholder's allocated bounds
// (composeSlide item box), not the glyph ink returned by getBBox().
const faces = (await loadFonts({ pack: 'office' })).registry.embeddedFonts.filter((face) => ['Roboto'].includes(face.family) && [400, 700].includes(face.weight) && !face.italic);
const bundled = await build({stdin: {resolveDir: fileURLToPath(new URL('../', import.meta.url)), contents: `
  import {createEditorSession} from './dist/index.js';
  import {createCanvasEditor} from './dist/canvas.js';
  import { loadFonts } from '@openpresentation/opf-render/fonts-browser';
  import { gallery as defaultCatalog } from '@openpresentation/gallery';
  window.mountSelection = async ({deck, faces, options = {}}) => {
    window.selectionCanvas?.destroy(); window.fonts?.dispose();
    window.fonts = await loadFonts({ faces: faces.map((face) => ({...face, data: Uint8Array.from(atob(face.dataUrl.split(',')[1]), (c) => c.charCodeAt(0))})), substitutionPolicy: 'visual', fallbackFamily: 'Roboto' });
    window.editor = createEditorSession(deck, {rejectInvalid: true, catalogs: [defaultCatalog]});
    window.selectionCanvas = createCanvasEditor(document.querySelector('#canvas'), {editor, fonts, ...options});
    await selectionCanvas.ready;
    window.accepted = (index) => editor.composeSlide(index, {fonts});
  };`}, bundle: true, platform: 'browser', format: 'iife', write: false, minify: true});
const browser = await chromium.launch({channel: process.platform === 'win32' ? 'msedge' : undefined});
const errors = [], results = [];
const near = (actual, expected, message, tolerance = 0.51) => assert.ok(Math.abs(actual - expected) <= tolerance, `${message}: expected ${expected}, saw ${actual}`);
try {
  const page = await browser.newPage({viewport: {width: 1440, height: 1200}});
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setContent('<div id="canvas" style="width:1000px"></div>');
  await page.addScriptTag({content: bundled.outputFiles[0].text});
  for (const dimensions of [{width: 1280, height: 720}, {width: 540, height: 960}]) {
    const design = {fontScheme: 'roboto', dimensions: {widthInches: dimensions.width / 96, heightInches: dimensions.height / 96}};
    for (const [name, deck] of [
      ['cover', {design, slides: [{title: 'Hi', subtitle: 'Short'}]}],
      ['content', {design, slides: [{title: 'Hi', text: 'Body text is short.'}]}],
    ]) {
      await page.evaluate((args) => mountSelection(args), {deck, faces});
      for (const field of ['title', name === 'cover' ? 'subtitle' : 'text']) {
        const path = `slides.0.${field}`;
        const measured = await page.evaluate((path) => {
          const node = document.querySelector(`[data-canvas-target][data-opf-path="${path}"]`);
          const rect = node.querySelector(':scope > rect.opf-selection');
          const box = accepted(0).items.find((item) => item.path === path).box;
          const ink = (() => { const clone = [...node.children].filter((child) => child !== rect); const bounds = clone.map((child) => child.getBBox()); const left = Math.min(...bounds.map((b) => b.x)), right = Math.max(...bounds.map((b) => b.x + b.width)); return {x: left, width: right - left}; })();
          return {box, ink, rect: Object.fromEntries(['x', 'y', 'width', 'height'].map((key) => [key, Number(rect.getAttribute(key))])), traced: ['x', 'y', 'width', 'height'].map((key) => Number(node.dataset[`opfBox${key[0].toUpperCase()}${key.slice(1)}`]))};
        }, path);
        near(measured.rect.x, measured.box.x - 4, `${name} ${field} outline x`);
        near(measured.rect.y, measured.box.y - 4, `${name} ${field} outline y`);
        near(measured.rect.width, measured.box.width + 8, `${name} ${field} outline width`);
        near(measured.rect.height, measured.box.height + 8, `${name} ${field} outline height`);
        if (measured.traced.every(Number.isFinite)) {
          near(measured.rect.width, measured.traced[2] + 8, `${name} ${field} outline matches data-opf-box-width`, 4);
        }
        assert.ok(measured.ink.width < measured.box.width - 40, `${name} ${field} glyph ink (${measured.ink.width}) must be narrower than the allocated box (${measured.box.width}) for this check to discriminate`);
        results.push({dimensions, slide: name, field, box: measured.box, outline: measured.rect, glyphInkWidth: measured.ink.width});
      }
    }
  }
  // A scalar textarea paints its own editing boundary. The selected SVG hit rectangle must stay
  // interactive without painting a second box, including after a draft replaces the SVG.
  const title = 'Crossed $4M ARR in nine months';
  const deck = {design: {theme: 'dark', fontScheme: 'roboto'}, slides: [{layout: 'cover', title, subtitle: 'Adoption keeps accelerating.'}]};
  const target = () => page.locator('[data-canvas-target][data-opf-path="slides.0.title"]');
  const input = () => page.getByRole('textbox', {name: 'Edit title inline', exact: true});
  const paint = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const outline = () => target().locator(':scope > rect.opf-selection').evaluate(node => ({stroke: getComputedStyle(node).stroke, pointerEvents: getComputedStyle(node).pointerEvents}));
  const visibleStroke = stroke => !['none', 'transparent', 'rgba(0, 0, 0, 0)'].includes(stroke);
  const singleBoundary = async () => {
    const svg = await outline();
    assert.equal(visibleStroke(svg.stroke), false, 'active plain text must not paint the SVG selection stroke as well as the textarea outline');
    assert.equal(svg.pointerEvents, 'all', 'keep the allocated rectangle as a pointer hit target');
    const field = await input().evaluate(node => {const css = getComputedStyle(node); return {outline: css.outlineStyle, width: parseFloat(css.outlineWidth), caret: css.caretColor, focused: document.activeElement === node};});
    assert.equal(field.focused, true);
    assert.equal(field.outline, 'solid'); assert.ok(field.width > 0);
    assert.notEqual(field.caret, 'transparent');
  };
  for (const [width, key] of [[570, 'Enter'], [856, 'Space'], [1000, 'F2']]) {
    await page.locator('#canvas').evaluate((node, width) => {node.style.width = `${width}px`;}, width);
    await page.evaluate(args => mountSelection(args), {deck, faces});
    await target().focus();
    assert.ok(visibleStroke((await outline()).stroke), 'keyboard focus must visibly identify the target');
    await page.keyboard.press(key);
    await paint();
    assert.deepEqual(await input().evaluate(node => [node.selectionStart, node.selectionEnd]), [0, title.length]);
    await input().press('End');
    if (process.env.OPF_SELECTION_SCREENSHOTS) {
      await mkdir(process.env.OPF_SELECTION_SCREENSHOTS, {recursive: true});
      await page.locator('#canvas').screenshot({path: path.join(process.env.OPF_SELECTION_SCREENSHOTS, `editing-${width}.png`)});
    }
    await singleBoundary();
    await input().pressSequentially('!'); await paint(); await singleBoundary();
    await input().press('Escape'); await paint();
    assert.equal(await page.evaluate(() => editor.get('slides.0.title')), title);
    assert.ok(visibleStroke((await outline()).stroke), 'Escape restores the selected SVG boundary');
    await target().press('Enter'); await input().fill(`${title}!`);
    await input().press('Control+Enter'); await paint();
    assert.equal(await page.evaluate(() => editor.get('slides.0.title')), `${title}!`);
    assert.ok(visibleStroke((await outline()).stroke), 'commit restores the selected SVG boundary');
    await page.evaluate(() => editor.undo());
    assert.equal(await page.evaluate(() => editor.get('slides.0.title')), title);
  }
  for (const textEntry of ['click', 'dblclick']) {
    await page.evaluate(args => mountSelection(args), {deck, faces, options: {textEntry}});
    if (textEntry === 'click') await target().click(); else await target().dblclick();
    await singleBoundary(); await input().press('Escape');
  }
  // The native rich input is invisible: its visible SVG boundary must remain.
  await page.evaluate(args => mountSelection(args), {deck: {...deck, slides: [{title: ['Crossed ', {text: '$4M ARR', bold: true}, ' in nine months']}]}, faces});
  await target().press('Enter'); await paint();
  assert.ok(visibleStroke((await outline()).stroke), 'rich text retains its SVG boundary');
  assert.ok(await page.locator('.opf-rich-range').count(), 'rich range selection remains visible');
  await page.getByRole('textbox', {name: 'Edit rich text inline', exact: true}).press('End');
  await paint(); assert.equal(await page.locator('.opf-rich-caret').count(), 1);
  await page.getByRole('textbox', {name: 'Edit rich text inline', exact: true}).press('Escape');
  const mediaDeck = {design: {fontScheme: 'roboto'}, slides: [{chart: {type: 'column', data: {columns: ['Quarter', 'Revenue'], rows: [['Q1', 12], ['Q2', 18]]}}}]};
  await page.evaluate(args => mountSelection(args), {deck: mediaDeck, faces});
  const chart = page.locator('[data-canvas-target][data-opf-path="slides.0.chart"]');
  await chart.click();
  assert.ok(visibleStroke(await chart.locator(':scope > rect.opf-selection').evaluate(node => getComputedStyle(node).stroke)), 'non-text selection retains its boundary');
  assert.deepEqual(errors, []);
  console.log(`Selection outlines: ${results.length} placeholders across wide/portrait cover and content slides use allocated box bounds, not glyph ink.`);
  console.log('Inline boundaries: one scalar editing outline at three scales, keyboard/pointer entry, draft rerender, cancel, commit and undo; rich text and non-text selection stay visible.');
} finally {
  await browser.close();
}
