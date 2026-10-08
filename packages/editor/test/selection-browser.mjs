import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
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
  import { defaultCatalog } from '@openpresentation/opf/catalog';
  window.mountSelection = async ({deck, faces}) => {
    window.selectionCanvas?.destroy(); window.fonts?.dispose();
    window.fonts = await loadFonts({ faces: faces.map((face) => ({...face, data: Uint8Array.from(atob(face.dataUrl.split(',')[1]), (c) => c.charCodeAt(0))})), substitutionPolicy: 'visual', fallbackFamily: 'Roboto' });
    window.editor = createEditorSession(deck, {rejectInvalid: true, catalogs: [defaultCatalog]});
    window.selectionCanvas = createCanvasEditor(document.querySelector('#canvas'), {editor, fonts});
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
  assert.deepEqual(errors, []);
  console.log(`Selection outlines: ${results.length} placeholders across wide/portrait cover and content slides use allocated box bounds, not glyph ink.`);
} finally {
  await browser.close();
}
