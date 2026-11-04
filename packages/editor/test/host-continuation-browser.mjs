import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startWorkspacePage } from './support/workspace-page.mjs';

// LH-99 in a real browser: the editor shows the export's continuation (LH-90) of an overfull slide without shifting a source slide index. The
// thumbnails draw the slide as a stack with its page count, the canvas edits the slide as written and previews each export page read only,
// and the presenter shows the pages as steps after the slide. `continuation: false` draws every slide as written (the editor before LH-99).
// `node test/host-continuation-browser.mjs <dir>` also saves screenshots there.
const shots = process.argv[2] ? path.resolve(process.argv[2]) : undefined;
if (shots) await mkdir(shots, { recursive: true });
const checks = [];
const mark = (name) => checks.push(name);
const app = await startWorkspacePage({ viewport: { width: 1280, height: 860 } });
const { page, errors } = app;
const ev = (fn, arg) => page.evaluate(fn, arg);
const shot = async (name) => { if (shots) await writeFile(path.join(shots, name), await page.screenshot()); };

const timeline = (index) => ({ timeline: { name: `Workstream ${index + 1} execution path`, description: `Major milestones for workstream ${index + 1}.`, events: [
  { when: 'May', what: 'Baseline', description: 'Confirm current state, owners, and constraints.' },
  { when: 'Jun', what: 'Pilot', description: 'Run a narrow pilot with visible success criteria.' },
  { when: 'Jul', what: 'Scale', description: 'Expand the approach after risk review.' },
  { when: 'Aug', what: 'Embed', description: 'Move reporting and routines into steady-state operations.' },
] } });
const deck = { name: 'Plan', language: 'en-US', design: { theme: 'classic', fontScheme: 'roboto' }, slides: [
  { id: 'intro', title: 'Plan for the next cycle' },
  { id: 'plan', title: 'Execution paths for the next cycle', notes: 'Walk through each path.', blocks: Array.from({ length: 8 }, (_, index) => timeline(index)) },
  { id: 'backup', title: 'Backup', hidden: true },
  { id: 'close', title: 'Next steps' },
] };

const mount = (options) => ev(async ({ opf, options }) => {
  window.ed?.destroy();
  const host = document.querySelector('#host') ?? Object.assign(document.body.appendChild(document.createElement('div')), { id: 'host' });
  window.ed = window.opfWs.createOpfEditor(host, { document: opf, fonts: window.fonts, catalogs: [window.opfWs.gallery], slideIndex: 1, ...options });
  await window.ed.ready;
}, { opf: deck, options });
// The page indicator is measured after the draw (a timer), so wait for the canvas to settle on it.
const indicator = () => page.locator('.opf-canvas-pages');
const drawnWorkstreams = (selector) => ev((selector) => [...document.querySelectorAll(`${selector} text`)].map((node) => node.textContent).join(' ').match(/Workstream \d/g)?.map((text) => Number(text.slice(-1))) ?? [], selector);

try {
  // ---- before: continuation off draws every slide as written ------------------------------------------------------------------------------
  await mount({ continuation: false });
  await page.waitForTimeout(200);
  assert.equal(await indicator().count(), 0, 'no indicator without continuation');
  assert.equal(await ev(() => document.querySelectorAll('[data-pages]').length), 0, 'no stacked thumbnail');
  await shot('editor-before.png');
  mark('continuation: false draws the editor as before');

  // ---- after ------------------------------------------------------------------------------------------------------------------------------
  await mount({});
  await page.waitForFunction(() => document.querySelector('.opf-canvas-pages') && !document.querySelector('.opf-canvas-pages').hidden, undefined, { timeout: 30000 });
  assert.equal(await indicator().getAttribute('aria-label'), 'Exports as 2 slides');
  assert.deepEqual(await ev(() => window.ed.canvas.pages), { count: 2, page: null }, 'the canvas reports the pages');
  // The canvas edits the slide as written: every timeline is drawn and editable, at the source slide's paths.
  assert.deepEqual(await drawnWorkstreams('.opf-canvas-preview'), [1, 2, 3, 4, 5, 6, 7, 8], 'the canvas draws the source slide as written');
  assert.ok(await ev(() => [...document.querySelectorAll('.opf-canvas-preview [data-opf-path]')].some((node) => node.getAttribute('data-opf-path').startsWith('slides.1.blocks.7'))), 'the eighth timeline is addressed by its source path');
  mark('the canvas edits the source slide and names its two export pages');

  // Thumbnails: one per source slide, the continued one a stack with its page count, at its own index.
  await page.waitForFunction(() => document.querySelector('[data-pages="2"]'), undefined, { timeout: 30000 });
  const thumbs = await ev(() => [...document.querySelectorAll('.slide-card, .opf-thumbs-item')].map((node) => [Number(node.dataset.index), node.closest('[data-pages]')?.dataset.pages ?? node.dataset.pages ?? '', node.textContent.replace(/\s+/g, ' ').trim()]));
  assert.ok(thumbs.length >= 4, `a thumbnail per source slide (${JSON.stringify(thumbs)})`);
  const continued = thumbs.filter(([, pages]) => pages === '2');
  assert.ok(continued.length >= 1 && continued.every(([index, , text]) => index === 1 && /2 pages/.test(text)), `only slide index 1 is stacked: ${JSON.stringify(thumbs)}`);
  assert.deepEqual([...new Set(thumbs.map(([index]) => index))].sort(), [0, 1, 2, 3], 'the indices are the source indices');
  await shot('editor-after.png');
  mark('the thumbnail of the continued slide is a stack with its page count; no index shifts');

  // Preview page 2: read only, over the canvas; back to editing.
  await indicator().locator('button').nth(1).click();
  assert.equal(await page.locator('.opf-canvas-page-preview').isVisible(), true);
  assert.equal(await page.locator('.opf-canvas-page-preview').getAttribute('aria-label'), 'Export page 2 of 2, read only');
  assert.deepEqual(await drawnWorkstreams('.opf-canvas-page-preview'), [5, 6, 7, 8], 'page 2 holds the last four timelines, as the export draws it');
  await shot('editor-preview-page-2.png');
  await indicator().locator('button').nth(0).click();
  assert.deepEqual(await drawnWorkstreams('.opf-canvas-page-preview'), [1, 2, 3, 4]);
  await page.locator('.opf-canvas-page-back').click();
  assert.equal(await page.locator('.opf-canvas-page-preview').isVisible(), false);
  assert.equal(await ev(() => window.ed.slideIndex), 1, 'the editor stays on source slide index 1');
  mark('the canvas previews each export page read only and goes back to editing');

  // A slide that fits has no indicator; going back to the continued slide shows it again.
  await ev(() => window.ed.setSlide(0));
  await page.waitForTimeout(150);
  assert.equal(await indicator().isVisible(), false, 'a slide that fits has no indicator');
  await ev(() => window.ed.setSlide(1));
  await page.waitForFunction(() => !document.querySelector('.opf-canvas-pages').hidden);
  mark('only a continued slide has the indicator');

  // ---- the presenter: the pages are steps after the slide ---------------------------------------------------------------------------------
  await ev(() => window.ed.present());
  await page.waitForFunction(() => document.querySelector('.opf-presenter') && !document.querySelector('.opf-presenter').hidden);
  const step = () => ev(() => [document.querySelector('.opf-presenter-counter').textContent, document.querySelector('.opf-presenter-live').textContent]);
  const shownStreams = () => drawnWorkstreams('.opf-presenter-slide');
  await page.waitForFunction(() => document.querySelector('.opf-presenter-slide svg'));
  assert.deepEqual(await shownStreams(), [1, 2, 3, 4], 'the presentation opens on page 1 of the slide the editor showed');
  assert.equal((await step())[0], '02 / 03 · 1/2');
  await shot('editor-presenter-page-1.png');
  await page.keyboard.press('ArrowRight');
  assert.deepEqual(await shownStreams(), [5, 6, 7, 8]);
  assert.equal((await step())[0], '02 / 03 · 2/2', 'a page step keeps the slide number');
  assert.match((await step())[1], /Slide 2 of 3, page 2 of 2/);
  await page.keyboard.press('ArrowRight');
  assert.equal((await step())[0], '03 / 03', 'the next slide is still slide 3 of 3 (the hidden slide is skipped)');
  await page.keyboard.press('ArrowLeft');
  assert.deepEqual(await shownStreams(), [5, 6, 7, 8], 'back lands on the last page');
  await page.keyboard.press('Escape');
  mark('the presenter steps through the pages of the continued slide; slide numbers stay source numbers');

  assert.deepEqual(errors, []);
  console.log(`LH-99 editor continuation browser checks passed: ${checks.length}\n  - ${checks.join('\n  - ')}`);
} finally {
  await ev(() => window.ed?.destroy()).catch(() => {});
  await app.close();
}
