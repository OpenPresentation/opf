import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

// RR-29 in a real browser, on the built playground (npm run build:playground): the Review tab lists core's validate
// findings with severity words (never colour alone), goes to the content a finding is about, applies safe quick
// fixes (the readable text colour; alt text typed in the panel; marking a picture decorative) as undoable edits,
// updates live as the document changes (an edit, an undo), is operable from the keyboard and keeps focus.
const root = fileURLToPath(new URL('../artifacts/playground/', import.meta.url));
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.ttf': 'font/ttf' };
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/favicon.ico') { res.writeHead(204).end(); return; }
    const target = path.resolve(root, '.' + decodeURIComponent(url.pathname));
    const relative = path.relative(root, target);
    if (relative.startsWith('..') || path.isAbsolute(relative)) { res.writeHead(403).end(); return; }
    const body = await readFile(target);
    res.writeHead(200, { 'Content-Type': types[path.extname(target)] ?? 'application/octet-stream' }).end(body);
  } catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));

const PIXEL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jP0cAAAAASUVORK5CYII=';
const source = {
  name: 'Review panel',
  design: { theme: 'classic', fontScheme: 'roboto', background: { type: 'solid', color: '#FFFFFF' } },
  assets: { hero: { src: PIXEL } },
  slides: [
    { id: 'contrast', title: 'Revenue grew', text: [{ text: 'Faint note', color: '#CCCCCC' }, ' and a normal ending.'] },
    { id: 'pictures', title: 'Pictures', blocks: [{ image: { src: PIXEL } }, { image: 'asset:hero' }] },
    { id: 'untitled', text: 'This slide has no title.' },
    { id: 'fine', title: 'Everything is fine', text: 'Nothing to report here.' },
  ],
};

let browser;
const checks = [];
const mark = name => checks.push(name);
try {
  browser = await chromium.launch({ channel: process.platform === 'win32' && !process.env.CI ? 'msedge' : undefined });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.stack ?? error.message));
  page.on('console', message => { if (message.type() === 'error' && !/Failed to load resource/.test(message.text())) errors.push(message.text()); });
  const button = name => page.getByRole('button', { name, exact: true });
  const doc = async () => JSON.parse(await page.locator('#json').inputValue());
  const settle = () => page.waitForFunction(() => !/Loading fonts/.test(document.querySelector('#status').textContent) && !document.querySelector('#preview')?.textContent.includes('Loading fonts'), undefined, { timeout: 60000 }).catch(async () => assert.fail(`fonts did not settle: ${await page.locator('#status').textContent()}`));
  const waitDoc = async (predicate, message) => {
    const started = Date.now();
    for (;;) {
      const current = await doc();
      if (predicate(current)) return current;
      if (Date.now() - started > 8000) assert.fail(`${message}: ${JSON.stringify(current).slice(0, 300)}`);
      await page.waitForTimeout(40);
    }
  };
  const review = page.locator('#review-controls');
  const item = rule => review.locator(`.opf-review-item[data-rule="opf/${rule}"]`);
  const findingCount = () => review.locator('.opf-review-item').count();
  // The panel re-checks a moment after a change (the playground redraw checks at once): wait for the list to show what we expect.
  const waitItems = async (rule, count, message) => {
    const started = Date.now();
    for (;;) {
      const now = await item(rule).count();
      if (now === count) return;
      if (Date.now() - started > 8000) assert.fail(`${message}: ${rule} has ${now} findings, expected ${count}`);
      await page.waitForTimeout(40);
    }
  };
  const activeInfo = () => page.evaluate(() => ({ id: document.activeElement?.id, cls: document.activeElement?.className, tag: document.activeElement?.tagName, name: document.activeElement?.getAttribute('aria-label') ?? document.activeElement?.textContent?.trim().slice(0, 60) }));

  await page.goto(`http://127.0.0.1:${server.address().port}/index.html`);
  await page.locator('#preview svg').waitFor();
  await button('Source').click();
  await page.locator('#json').fill(JSON.stringify(source));
  await page.waitForFunction(() => !document.querySelector('#apply-json').disabled && !document.querySelector('#json-error').textContent);
  await button('Apply changes').click();
  await page.locator('#preview [data-canvas-target][data-opf-path="slides.0.title"]').waitFor();
  await settle();
  assert.deepEqual(await doc(), source);

  // --- the tab ---------------------------------------------------------------------------------------
  const tab = page.locator('#tab-review');
  await tab.click();
  assert.equal(await tab.getAttribute('aria-selected'), 'true');
  assert.equal(await page.locator('#panel-review').isVisible(), true, 'the Review panel shows');
  assert.equal(await page.locator('#panel-content').isHidden(), true);
  await page.waitForFunction(() => document.querySelectorAll('#review-controls .opf-review-item').length > 0);
  assert.match(await tab.textContent(), /^Review \(\d+\)$/, 'the tab carries the number of findings');
  assert.match(await tab.getAttribute('aria-label'), /^Review, \d+ findings?$/);
  // The panel checks the applied document a moment after the redraw (it never checks per keystroke), so the list first shows the deck the page had.
  await waitItems('text-contrast', 1, 'the applied source is checked');
  mark('the Review tab lists findings and shows their number');

  // Keyboard: the tablist cycles Content, Design, Review with the arrow keys.
  await tab.focus();
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.locator('#tab-content').getAttribute('aria-selected'), 'true', 'ArrowRight from the last tab wraps to the first');
  await page.keyboard.press('ArrowLeft');
  assert.equal(await tab.getAttribute('aria-selected'), 'true', 'ArrowLeft returns to Review');
  mark('the three tabs cycle with the arrow keys');

  // Every finding is announced with a severity word, its slide and the rule; nothing relies on colour.
  const contrast = item('text-contrast');
  assert.equal(await contrast.count(), 1);
  assert.equal(await contrast.getAttribute('data-severity'), 'warning');
  assert.match(await contrast.locator('.opf-review-sev').textContent(), /^Warning$/);
  assert.match(await contrast.locator('.opf-review-msg').textContent(), /contrast ratio of 1\.\d+:1; 3:1 is needed/);
  assert.match(await contrast.locator('.opf-review-meta').textContent(), /^Slide 1 · opf\/text-contrast$/);
  assert.match(await contrast.locator('.opf-review-goto').getAttribute('aria-label'), /^Warning, Slide 1: .*Go to it\.$/);
  assert.equal(await item('missing-alt-text').count(), 2, 'both pictures lack alt text');
  assert.equal(await item('missing-slide-title').count(), 1);
  assert.match(await page.locator('.opf-review-counts').textContent(), /^\d+ findings: \d+ warnings?(, \d+ notes?)?\.$/);
  mark('findings carry severity words, slide numbers and rule ids');

  // Every control is named: buttons by their text or aria-label, inputs by a label.
  const unnamed = await page.evaluate(() => [...document.querySelectorAll('#review-controls button, #review-controls select, #review-controls input')].filter(node => !(node.getAttribute('aria-label') || node.textContent.trim() || node.labels?.length)).map(node => node.outerHTML.slice(0, 80)));
  assert.deepEqual(unnamed, [], 'every Review control has an accessible name');
  mark('every Review control is named');

  // --- keyboard navigation of the list -----------------------------------------------------------------
  const gotos = review.locator('.opf-review-goto');
  await gotos.first().focus();
  await page.keyboard.press('ArrowDown');
  assert.equal((await activeInfo()).cls, 'opf-review-goto');
  const second = await page.evaluate(() => document.activeElement.dataset.findingId);
  assert.notEqual(second, await gotos.first().getAttribute('data-finding-id'), 'ArrowDown moves to the next finding');
  await page.keyboard.press('End');
  assert.equal(await page.evaluate(() => document.activeElement.dataset.findingId), await gotos.last().getAttribute('data-finding-id'));
  await page.keyboard.press('Home');
  assert.equal(await page.evaluate(() => document.activeElement.dataset.findingId), await gotos.first().getAttribute('data-finding-id'));
  mark('Up, Down, Home and End move between findings');

  // --- go to ----------------------------------------------------------------------------------------------
  await contrast.locator('.opf-review-goto').click();
  await settle();
  await page.waitForFunction(() => document.querySelector('#path').textContent === 'slides.0.text.0.color');
  assert.equal(await contrast.getAttribute('aria-current'), 'true', 'the visited finding is marked');
  assert.equal(await tab.getAttribute('aria-selected'), 'true', 'go to keeps the Review list on screen');
  // a finding on another slide selects that slide
  await item('missing-slide-title').locator('.opf-review-goto').click();
  await page.waitForFunction(() => document.querySelector('#slide-list').children[2].getAttribute('aria-current') === 'true');
  await settle();
  assert.equal(await page.locator('#page-position').textContent(), 'Slide 3 of 4');
  mark('go to selects the slide and the content');

  // --- quick fix: the readable text colour ----------------------------------------------------------------
  const before = await doc();
  const readable = contrast.locator('button[data-fix="use-readable-color"]');
  assert.equal(await readable.textContent(), 'Use the slide text colour');
  assert.equal(await readable.getAttribute('title'), null, 'a safe fix has no warning');
  await readable.click();
  const fixed = await waitDoc(current => current.slides[0].text[0].color === 'text', 'the fix switches the run to the text colour');
  assert.deepEqual({ ...fixed, slides: fixed.slides.map((slide, index) => index ? slide : { ...slide, text: [{ ...slide.text[0], color: '#CCCCCC' }, slide.text[1]] }) }, before, 'only the colour changed');
  await waitItems('text-contrast', 0, 'the finding disappears after the fix');
  assert.match(await page.locator('#status').textContent(), /Undo restores/);
  assert.equal(await page.evaluate(() => document.activeElement?.classList.contains('opf-review-goto')), true, 'focus lands on a finding, not the page');
  await button('Undo').click();
  await waitDoc(current => JSON.stringify(current) === JSON.stringify(before), 'one Undo restores the document');
  await waitItems('text-contrast', 1, 'the finding returns after Undo (live update)');
  mark('the contrast fix is one undoable edit and the list follows Undo');

  // --- alt text typed in the panel ----------------------------------------------------------------------
  const pictures = item('missing-alt-text');
  const first = pictures.nth(0);
  await first.locator('button[data-fix="focus-alt"]').click();
  const altInput = first.locator('.opf-review-alt input');
  await altInput.waitFor();
  assert.equal(await page.evaluate(() => document.activeElement?.closest('.opf-review-alt') !== null && document.activeElement.tagName), 'INPUT', 'the alt-text field is focused');
  assert.equal(await altInput.evaluate(node => node.labels[0].textContent), 'Alt text');
  // Escape cancels and puts focus back on the finding
  await page.keyboard.press('Escape');
  assert.equal(await review.locator('.opf-review-alt').count(), 0, 'Escape closes the field');
  assert.equal(await page.evaluate(() => document.activeElement?.classList.contains('opf-review-goto')), true);
  await first.locator('button[data-fix="focus-alt"]').click();
  // empty text is refused with a reason
  await page.keyboard.press('Enter');
  assert.match(await first.locator('.opf-review-alt .opf-review-error').textContent(), /Write what the picture shows/);
  assert.deepEqual(await doc(), before, 'nothing changed');
  await first.locator('.opf-review-alt input').fill('A one-pixel placeholder chart');
  await page.keyboard.press('Enter');
  const withAlt = await waitDoc(current => current.slides[1].blocks[0].image.alt === 'A one-pixel placeholder chart', 'Enter saves the alt text');
  assert.equal(withAlt.slides[1].blocks[0].image.src, PIXEL);
  await waitItems('missing-alt-text', 1, 'the finding is gone');
  assert.match(await page.locator('#status').textContent(), /Alt text saved/);
  await button('Undo').click();
  await waitDoc(current => current.slides[1].blocks[0].image.alt === undefined, 'Undo removes the alt text');
  await waitItems('missing-alt-text', 2, 'the finding returns');
  mark('alt text is typed in the panel, saved as one undoable edit, and cancelled with Escape');

  // an asset reference gets its alt text on the registry entry
  const registry = pictures.nth(1);
  await registry.locator('button[data-fix="focus-alt"]').click();
  await registry.locator('.opf-review-alt input').fill('The hero image');
  await page.keyboard.press('Enter');
  await waitDoc(current => current.assets.hero.alt === 'The hero image' && current.slides[1].blocks[1].image === 'asset:hero', 'registry alt text');
  await button('Undo').click();
  await waitItems('missing-alt-text', 2, 'the registry finding returns');
  mark('alt text for an asset reference is stored on the asset');

  // --- decorative is explicit and flagged as careful -----------------------------------------------------
  const decorative = pictures.nth(0).locator('button[data-fix="mark-decorative"]');
  assert.match(await decorative.getAttribute('title'), /changes how the slide looks or what it says/);
  await decorative.click();
  await waitDoc(current => current.slides[1].blocks[0].image.alt === '', 'decorative is an empty alt');
  await waitItems('missing-alt-text', 1, 'a decorative picture is not a finding');
  await button('Undo').click();
  await waitItems('missing-alt-text', 2, 'Undo returns the finding');
  mark('marking a picture decorative is an explicit, undoable choice');

  // --- live updates from an edit elsewhere --------------------------------------------------------------
  assert.equal(await item('placeholder-text').count(), 0);
  await page.locator('#tab-content').click();
  await page.locator('#preview [data-canvas-target][data-opf-path="slides.3.title"]').waitFor().catch(() => {});
  await page.locator('#slide-list button').nth(3).click();
  await page.waitForFunction(() => document.querySelector('#slide-list').children[3].getAttribute('aria-current') === 'true');
  await settle();
  await page.locator('#value').fill('Click to add title');
  await button('Apply edit').click();
  await tab.click();
  await waitItems('placeholder-text', 1, 'a typed placeholder shows up live');
  assert.match(await item('placeholder-text').locator('.opf-review-msg').textContent(), /template prompt/);
  await button('Undo').click();
  await waitItems('placeholder-text', 0, 'Undo removes it');
  mark('the list updates live after an edit and after Undo');

  // --- filters and hidden checks -------------------------------------------------------------------------
  const total = await findingCount();
  assert.ok(total >= 4);
  await review.locator('.opf-review-filters select').selectOption('errors');
  await page.waitForFunction(() => document.querySelectorAll('#review-controls .opf-review-item').length === 0);
  assert.match(await review.locator('.opf-review-empty').textContent(), /Nothing to show with these filters/);
  await review.locator('.opf-review-filters select').selectOption('all');
  await review.locator('.opf-review-filters input[type=checkbox]').check();
  await page.waitForFunction(() => [...document.querySelectorAll('#review-controls .opf-review-meta')].every(node => /Slide 4/.test(node.textContent)) || document.querySelectorAll('#review-controls .opf-review-item').length === 0);
  assert.match(await page.locator('.opf-review-counts').textContent(), /on slide 4/);
  await review.locator('.opf-review-filters input[type=checkbox]').uncheck();
  await waitItems('missing-slide-title', 1, 'the whole deck is listed again');
  await item('missing-slide-title').locator('button[data-action="ignore-rule"]').click();
  await waitItems('missing-slide-title', 0, 'a hidden check disappears');
  assert.match(await review.locator('.opf-review-ignored summary').textContent(), /Hidden checks \(1\)/);
  assert.match(await page.locator('.opf-review-counts').textContent(), /1 finding hidden/);
  await review.locator('.opf-review-ignored summary').click();
  await review.getByRole('button', { name: 'Show opf/missing-slide-title findings again' }).click();
  await waitItems('missing-slide-title', 1, 'Show again restores it');
  mark('filters narrow the list and a check can be hidden and shown again');

  // --- a clean deck -------------------------------------------------------------------------------------------
  await page.evaluate(() => document.querySelector('#open-json').click());
  await page.locator('#json').fill(JSON.stringify({ name: 'Clean', language: 'en-US', design: { theme: 'classic', fontScheme: 'roboto' }, slides: [{ id: 'one', title: 'Clear title', text: 'A readable slide.' }] }));
  await page.waitForFunction(() => !document.querySelector('#apply-json').disabled && !document.querySelector('#json-error').textContent);
  await button('Apply changes').click();
  await settle();
  await page.waitForFunction(() => document.querySelectorAll('#review-controls .opf-review-item').length === 0);
  assert.match(await page.locator('.opf-review-counts').textContent(), /^No findings/);
  assert.equal(await tab.textContent(), 'Review', 'no count when clean');
  mark('a clean deck shows no findings');

  assert.deepEqual(errors, [], 'no page errors');
  console.log(JSON.stringify({ passed: true, checks }));
} finally {
  await browser?.close();
  server.close();
}
