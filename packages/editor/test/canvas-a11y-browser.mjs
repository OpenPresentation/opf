import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {chromium} from 'playwright';
import { loadFonts } from '@openpresentation/opf-render/fonts-node';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const axeSource = readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');

// FA-30: the canvas draws the renderer's SVG, which now hides decorative drawing (background, card frames, a picture or chart with an
// empty alt) with aria-hidden and labels its root a "slide" group. Real-browser check that the canvas stays operable by assistive
// technology: the root is the "Editable slide" group (no second "slide" description), every editing target (including a picture and a
// chart whose alt is empty) is a focusable button that is not hidden nor inside a hidden group, the decoration stays hidden, and
// nothing in the canvas is an unnamed image.
const faces = (await loadFonts({ pack: 'office' })).registry.embeddedFonts.filter((face) => face.family === 'Roboto' && [400, 700].includes(face.weight) && !face.italic);
const bundled = await build({stdin: {resolveDir: fileURLToPath(new URL('../', import.meta.url)), contents: `
  import {createEditorSession} from './dist/index.js';
  import {createCanvasEditor} from './dist/canvas.js';
  import { loadFonts } from '@openpresentation/opf-render/fonts-browser';
  import { defaultCatalog } from '@openpresentation/opf/catalog';
  window.mountCanvas = async ({deck, faces}) => {
    const fonts = await loadFonts({ faces: faces.map((face) => ({...face, data: Uint8Array.from(atob(face.dataUrl.split(',')[1]), (c) => c.charCodeAt(0))})), substitutionPolicy: 'visual', fallbackFamily: 'Roboto' });
    const editor = createEditorSession(deck, {rejectInvalid: true, catalogs: [defaultCatalog]});
    window.cv = createCanvasEditor(document.querySelector('#canvas'), {editor, fonts});
    await cv.ready;
  };`}, bundle: true, platform: 'browser', format: 'iife', write: false, minify: true});

const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jP0cAAAAASUVORK5CYII=';
const columns = ['Quarter', 'Revenue'], rows = [['Q1', 12], ['Q2', 18]];
const deck = {design: {fontScheme: 'roboto'}, slides: [
  {title: 'Media slide', composition: {mode: 'grid', columns: 2}, blocks: [
    {image: {src: png, alt: 'Named picture'}},
    {image: {src: png, alt: ''}},
    {chart: {type: 'column', alt: '', data: {columns, rows}}},
    {chart: {type: 'column', alt: 'Revenue by quarter', data: {columns, rows}}},
  ]},
  // Targets that draw text of every kind (a long paragraph, a list, a quote, a table, code, a metric, a timeline): WCAG 2.5.3, below.
  {title: 'Text slide', blocks: [
    {text: 'A long paragraph of text that goes on and on well past the eighty character mark, so a name cut at eighty characters would no longer contain it.'},
    {items: ['One', 'Two', {text: 'Two point one', level: 1}, 'Three']},
    {quote: {text: 'Quote text here', attribution: 'Someone'}},
    {table: {columns, rows}},
  ]},
  {title: 'More text', blocks: [
    {code: {source: 'const a = 1;', language: 'ts'}},
    {metric: {value: 42, label: 'Answer', unit: '%'}},
    {timeline: [{when: 'Now', what: 'Prototype'}, {what: 'Review'}]},
  ]},
]};

const browser = await chromium.launch({channel: process.platform === 'win32' ? 'msedge' : undefined});
const errors = [];
try {
  const page = await browser.newPage({viewport: {width: 1440, height: 1200}});
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setContent('<div id="canvas" style="width:1000px;margin:20px"></div>');
  await page.addScriptTag({content: bundled.outputFiles[0].text});
  await page.evaluate((args) => mountCanvas(args), {deck, faces});

  const facts = await page.evaluate(() => {
    const svg = document.querySelector('#canvas svg');
    const targets = [...svg.querySelectorAll('[data-canvas-target]')].map((node) => ({
      path: node.getAttribute('data-opf-path'), role: node.getAttribute('role'), tabindex: node.getAttribute('tabindex'),
      label: node.getAttribute('aria-label'), hiddenSelf: node.getAttribute('aria-hidden'), hiddenAncestor: Boolean(node.parentElement.closest('[aria-hidden="true"]')),
    }));
    return {
      role: svg.getAttribute('role'), label: svg.getAttribute('aria-label'), roledescription: svg.getAttribute('aria-roledescription'),
      background: svg.querySelector(':scope > rect')?.getAttribute('aria-hidden'), targets,
      unnamedImages: [...svg.querySelectorAll('[role="img"]')].filter((node) => !node.getAttribute('aria-label')).length,
    };
  });
  assert.deepEqual([facts.role, facts.label, facts.roledescription], ['group', 'Editable slide', null], 'the canvas is the "Editable slide" group, with no second "slide" description');
  assert.equal(facts.background, 'true', 'the background stays hidden');
  assert.equal(facts.unnamedImages, 0, 'no unnamed image');
  const paths = facts.targets.map((target) => target.path);
  for (const path of ['slides.0.title', 'slides.0.blocks.0.image', 'slides.0.blocks.1.image', 'slides.0.blocks.2.chart', 'slides.0.blocks.3.chart']) assert.ok(paths.includes(path), `${path} is an editing target (${paths})`);
  for (const target of facts.targets) {
    assert.deepEqual([target.role, target.tabindex, target.hiddenSelf, target.hiddenAncestor], ['button', '0', null, false], `${target.path} is a focusable button outside any hidden group`);
    assert.ok(target.label?.startsWith('Edit '), `${target.path} has a name: ${target.label}`);
  }
  // The browser exposes them: a button per target (the empty-alt picture and chart included), found by role and name.
  const snapshot = await page.locator('#canvas').ariaSnapshot();
  assert.match(snapshot, /group "Editable slide"/, snapshot);
  assert.equal((snapshot.match(/- 'button /g) ?? []).length, facts.targets.length, snapshot);
  assert.match(snapshot, /group "Revenue by quarter"/, 'the chart keeps its alt as a group name around its editing targets');
  assert.doesNotMatch(snapshot, /img /, 'no image role is left above an editing target');
  assert.equal(await page.getByRole('button', {name: /^Edit image/}).count(), 2, 'both pictures are reachable as buttons');
  assert.equal(await page.getByRole('button', {name: /^Edit chart/}).count(), 2, 'both charts are reachable as buttons');
  // WCAG 2.5.3 Label in Name (axe-core 4.14 label-content-name-mismatch): every editing target's accessible name contains the text it draws.
  await page.addScriptTag({content: axeSource});
  for (const [index, title] of [[0, 'Media slide'], [1, 'Text slide'], [2, 'More text']]) {
    await page.evaluate((slide) => cv.setSlide(slide), index);
    const mismatches = await page.evaluate(() => window.axe.run(document.querySelector('#canvas'), {runOnly: {type: 'rule', values: ['label-content-name-mismatch']}}).then((result) => result.violations.flatMap((violation) => violation.nodes.map((node) => node.target.join(' ') + ' ' + node.html.slice(0, 160)))));
    assert.deepEqual(mismatches, [], `${title}: every editing target's name contains its visible text`);
    const names = await page.evaluate(() => [...document.querySelectorAll('#canvas [data-canvas-target]')].map((node) => node.getAttribute('aria-label')));
    assert.ok(names.length > 0 && names.every((name) => name.startsWith('Edit ')), `${title}: targets are named "Edit <field>: ..." (${names})`);
    if (index === 1) assert.ok(names.some((name) => name.includes('would no longer contain it.')), 'a long paragraph is named in full, not cut off');
  }
  assert.deepEqual(errors, []);
  console.log(`canvas a11y: ${facts.targets.length} editing targets are focusable buttons outside hidden groups; the root is the Editable slide group.`);
} finally {
  await browser.close();
}
