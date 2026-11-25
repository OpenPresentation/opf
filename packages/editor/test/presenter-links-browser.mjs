import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { startPresenterPage } from './support/presenter-page.mjs';

// A link in a slide (a text run, a shape, a table cell) is followed when it is activated in the presenter, and the slide does not change with it:
// the click zones, Enter and Space move the slide only where nothing was activated. Plain slide area, keys and taps elsewhere behave as before.
// `node test/presenter-links-browser.mjs [screenshot-dir]` also saves a picture of the slide after each link press.
const shots = process.argv[2];
if (shots) mkdirSync(shots, { recursive: true });
const checks = [];
const mark = (name) => checks.push(name);
const app = await startPresenterPage({ hasTouch: true });
const { page, context, errors } = app;
try {
  const deck = {
    name: 'Links', design: { theme: 'classic', fontScheme: 'roboto' },
    slides: [
      { id: 'one', title: 'One', text: 'First' },
      { id: 'text-shape', title: 'Text and shape links', blocks: [{ text: ['See ', { text: 'the site', link: 'https://example.test/text' }, ' now'] }, { text: 'Go', shape: 'roundRect', link: 'https://example.test/shape' }] },
      { id: 'table', title: 'Table link', blocks: [{ table: { columns: ['A', 'B'], rows: [[[{ text: 'cell link', link: 'https://example.test/cell' }], 'plain'], ['x', 'y']] } }] },
      { id: 'four', title: 'Four', text: 'Last' },
    ],
  };
  // No link leaves the page: a click that reaches the window is recorded with whether anything had already prevented it (so a presenter that
  // swallowed the activation shows as `followed: false`), then stopped here so the page itself stays.
  await context.route(/^https?:\/\/example\.test/, (route) => route.abort());
  await page.evaluate((d) => {
    window.editor = window.opfPresent.createEditorSession(d, { rejectInvalid: true, catalogs: [window.opfPresent.gallery] });
    window.presenter = window.opfPresent.createPresenter(document.getElementById('host'), { editor: window.editor, fonts: window.fonts });
    window.followed = [];
    window.addEventListener('click', (event) => {
      const anchor = event.target.closest?.('a[href]');
      if (!anchor) return;
      window.followed.push(anchor.getAttribute('href'));
      event.preventDefault();
    });
  }, deck);
  const shown = () => page.evaluate(() => window.presenter.getSlide());
  const followed = () => page.evaluate(() => window.followed.splice(0));
  const open = async (index) => {
    await page.waitForFunction(() => !document.fullscreenElement);
    await page.evaluate((i) => window.presenter.start(i), index);
    await page.waitForFunction((i) => window.presenter.getSlide() === i && document.querySelector('.opf-presenter-slide svg'), index);
  };
  // Back on slide `index` with its links drawn, whatever an earlier step did.
  const at = async (index, name) => {
    await page.evaluate((i) => window.presenter.goTo(i), index);
    await page.waitForFunction(([i, href]) => window.presenter.getSlide() === i && document.querySelector(`.opf-presenter a[href$="/${href}"]`), [index, name]);
    await followed();
  };
  const link = (name) => page.locator(`.opf-presenter a[href$="/${name}"]`).first();
  const center = async (locator) => { const box = await locator.boundingBox(); return { x: box.x + box.width / 2, y: box.y + box.height / 2 }; };
  const save = (name) => (shots ? page.screenshot({ path: `${shots}/${name}.png` }) : undefined);
  const settle = () => page.waitForTimeout(250);

  // ---- a mouse click ------------------------------------------------------------------------------------------------------------------
  await open(1);
  await at(1, 'text');
  const text = await center(link('text'));
  assert.ok(text.x < 333, `the text link is in the back zone (x ${text.x})`);
  await page.mouse.click(text.x, text.y);
  await settle();
  assert.deepEqual(await followed(), ['https://example.test/text'], 'the text link is followed');
  await save('text-link-click');
  assert.equal(await shown(), 1, 'a click on a text link in the back zone does not go back');
  mark('a click on a text link follows it and keeps the slide');

  await at(1, 'shape');
  const shape = await center(link('shape'));
  assert.ok(shape.x > 333, `the shape link is in the forward zone (x ${shape.x})`);
  await page.mouse.click(shape.x, shape.y);
  await settle();
  assert.deepEqual(await followed(), ['https://example.test/shape'], 'the shape link is followed');
  await save('shape-link-click');
  assert.equal(await shown(), 1, 'a click on a shape link in the forward zone does not advance');
  mark('a click on a shape link follows it and keeps the slide');

  await at(2, 'cell');
  const cell = await center(link('cell'));
  assert.ok(cell.x < 333, `the cell link is in the back zone (x ${cell.x})`);
  await page.mouse.click(cell.x, cell.y);
  await settle();
  assert.deepEqual(await followed(), ['https://example.test/cell'], 'the cell link is followed');
  await save('table-link-click');
  assert.equal(await shown(), 2, 'a click on a table cell link does not go back');
  mark('a click on a link in a table cell follows it and keeps the slide');

  // ---- the keyboard -------------------------------------------------------------------------------------------------------------------
  await at(2, 'cell');
  await page.locator('.opf-presenter a[href$="/cell"]').first().evaluate((node) => node.focus());
  await page.keyboard.press('Enter');
  await settle();
  assert.deepEqual(await followed(), ['https://example.test/cell'], 'Enter on a focused link activates it');
  await save('link-enter');
  assert.equal(await shown(), 2, 'Enter on a focused link does not advance');
  mark('Enter on a focused link follows it and keeps the slide');

  await page.locator('.opf-presenter').focus();
  await page.keyboard.press('Enter');
  assert.equal(await shown(), 3, 'Enter with nothing focused in a link still advances');
  await page.keyboard.press('Backspace');
  assert.equal(await shown(), 2, 'Backspace still goes back');
  mark('Enter and Backspace elsewhere still move');

  // ---- plain area and touch -----------------------------------------------------------------------------------------------------------
  await page.mouse.click(900, 580);
  await settle();
  assert.equal(await shown(), 3, 'a click on plain slide area in the forward zone advances');
  await page.mouse.click(40, 580);
  await settle();
  assert.equal(await shown(), 2, 'a click on plain slide area in the back zone goes back');
  assert.deepEqual(await followed(), [], 'plain clicks follow no link');
  mark('a click on plain slide area still moves by zone');

  await at(1, 'text');
  const tap = await center(link('text'));
  await page.touchscreen.tap(tap.x, tap.y);
  await settle();
  assert.deepEqual(await followed(), ['https://example.test/text'], 'a tap on a link follows it');
  assert.equal(await shown(), 1, 'a tap on a link does not move the slide');
  await page.touchscreen.tap(900, 580);
  await settle();
  assert.equal(await shown(), 2, 'a tap on plain slide area still moves by zone');
  mark('a tap on a link follows it and keeps the slide; a tap elsewhere still moves');

  assert.deepEqual(errors, [], 'no page errors or console errors');
  console.log(`presenter links: ${checks.length} checks passed\n- ${checks.join('\n- ')}`);
} catch (error) {
  console.error('presenter links checks so far:\n- ' + checks.join('\n- '));
  console.error({ errors });
  throw error;
} finally {
  await app.close();
}
