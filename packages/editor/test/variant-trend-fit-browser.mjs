import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

// LH-97, LH-123 and LH-126 in a real browser, on the built playground (npm run build:playground):
// - the color variant picker offers accent1 to accent6 and selects the variant a slide's layout decides (surface, brand, an accent);
// - a metric's trend is a field of the selection panel, and the arrow drawn for it is a target on the canvas that opens the same choices;
// - the image fit select says what `auto` resolved to ("Auto (cover)").
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
  name: 'Variant, trend and fit',
  language: 'en-US',
  assets: { photo: PIXEL },
  design: { theme: 'classic', fontScheme: 'roboto' },
  slides: [
    { id: 'plain', title: 'Plain' },
    { id: 'part', title: 'Part two', layout: 'section' },
    { id: 'statement', title: 'The statement', layout: 'statement' },
    { id: 'thanks', title: 'Thank you', layout: 'closing' },
    { id: 'own', title: 'Its own', layout: 'section', design: { variant: 'dark1' } },
    { id: 'kpi', title: 'Numbers', blocks: [{ metric: { value: '42%', label: 'Retention', delta: '+4 pts', trend: 'up' } }, { metric: { value: '7', label: 'Churn' } }] },
    { id: 'pictures', title: 'Pictures', blocks: [{ image: { src: 'asset:photo', alt: 'Square' }, fit: 'auto', aspectRatio: 1 }, { image: { src: 'asset:photo', alt: 'Wide' }, fit: 'auto', aspectRatio: 3 }, { image: { src: 'asset:photo', alt: 'Cover' }, fit: 'cover' }] },
  ],
};

let browser;
const checks = [];
try {
  browser = await chromium.launch({ channel: process.platform === 'win32' && !process.env.CI ? 'msedge' : undefined });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.stack ?? error.message));
  page.on('console', message => { if (message.type() === 'error' && !/Failed to load resource/.test(message.text())) errors.push(message.text()); });
  const button = name => page.getByRole('button', { name, exact: true });
  const design = page.locator('#design-controls');
  const selection = page.locator('#selection-controls');
  const doc = async () => JSON.parse(await page.locator('#json').inputValue());
  const settle = () => page.waitForFunction(() => !/Loading fonts/.test(document.querySelector('#status').textContent) && !document.querySelector('#preview')?.textContent.includes('Loading fonts'), undefined, { timeout: 60000 });
  const waitDoc = async (predicate, message) => {
    const started = Date.now();
    for (;;) {
      const current = await doc();
      if (predicate(current)) return current;
      if (Date.now() - started > 8000) assert.fail(`${message}: ${JSON.stringify(current).slice(0, 300)}`);
      await page.waitForTimeout(40);
    }
  };
  const mark = name => checks.push(name);
  const slide = async index => { await page.locator('#slide-list button').nth(index).click(); await page.waitForFunction(i => document.querySelector('#slide-list').children[i].getAttribute('aria-current') === 'true', index); await settle(); };
  const radios = () => design.locator('[data-variant]').evaluateAll(nodes => nodes.map(node => ({ slot: node.dataset.variant, checked: node.getAttribute('aria-checked') === 'true', source: node.dataset.variantSource ?? null, label: node.getAttribute('aria-label') })));
  const checked = async () => (await radios()).filter(entry => entry.checked);
  const select = async blockPath => {
    await page.locator(`#preview [data-canvas-target][data-opf-path^="${blockPath}"]`).first().click({ position: { x: 4, y: 4 } });
    await page.keyboard.press('Escape');
  };

  await page.goto(`http://127.0.0.1:${server.address().port}/index.html`);
  await page.locator('#preview svg').waitFor();
  await button('Source').click();
  await page.locator('#json').fill(JSON.stringify(source));
  await page.waitForFunction(() => !document.querySelector('#apply-json').disabled && !document.querySelector('#json-error').textContent);
  await button('Apply changes').click();
  await page.locator('#preview [data-canvas-target][data-opf-path="slides.0.title"]').waitFor();
  await settle();
  await page.locator('#tab-design').click();
  await page.evaluate(() => document.querySelectorAll('.opf-dc-group').forEach(details => { details.open = true; }));

  // --- LH-97: the variant picker ---------------------------------------------------------------------------------
  assert.deepEqual((await radios()).map(entry => entry.slot), ['light1', 'light2', 'dark1', 'dark2', 'accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6'], 'the four backgrounds, then the six accents');
  assert.deepEqual((await radios()).slice(4).map(entry => entry.label.split(':')[0]), ['Accent 1', 'Accent 2', 'Accent 3', 'Accent 4', 'Accent 5', 'Accent 6'], 'the accent swatches are named');
  assert.deepEqual((await checked()).map(entry => entry.slot), ['light1'], 'the deck is light1');
  // Every swatch is as tall as a control and no two overlap (the picker is two rows).
  const boxes = await design.locator('[data-variant]').evaluateAll(nodes => nodes.map(node => { const box = node.getBoundingClientRect(); return { x: box.x, y: box.y, w: box.width, h: box.height }; }));
  assert.ok(boxes.every(box => box.w > 20 && box.h >= 40), 'each swatch has room');
  assert.ok(boxes.slice(0, 4).every(box => box.y === boxes[0].y) && boxes.slice(4).every(box => box.y === boxes[4].y) && boxes[4].y > boxes[0].y + boxes[0].h - 1, 'the backgrounds are one row and the accents the next');
  mark('the picker lists the four backgrounds and accent1 to accent6');

  await design.getByLabel(/^Applies to/).selectOption('slide');
  // The deck scope shows the deck; the slide scope shows what each slide's layout decides.
  const expectations = [
    [0, 'light1', null, 'a plain slide follows the deck'],
    [1, 'accent1', 'layout', 'a section is on accent1 by its layout'],
    [2, 'light2', 'layout', 'a statement is on surface, light2 on a light deck'],
    [3, 'dark2', 'layout', 'a closing is on brand, dark2'],
    [4, 'dark1', null, "the slide's own variant wins over its layout"],
  ];
  for (const [index, slot, from, why] of expectations) {
    await slide(index);
    const now = await checked();
    assert.deepEqual(now.map(entry => entry.slot), [slot], why);
    assert.equal(now[0].source, from, `${why}: the source is marked`);
    if (from) assert.match(now[0].label, /\(from the layout/, `${why}: the swatch says where it comes from`);
  }
  await slide(2);
  assert.match((await checked())[0].label, /from the layout's surface variant/);
  await slide(3);
  assert.match((await checked())[0].label, /from the layout's brand variant/);
  mark('the picker selects the variant a layout decides (accent, surface, brand) and not when the slide sets its own');

  await slide(1);
  assert.equal(await design.locator('.opf-dc-variants').getAttribute('aria-description'), "from the layout", 'the group is described by its source');
  await design.getByRole('radio', { name: /^Accent 3:/ }).click();
  const chosen = await waitDoc(current => current.slides[1].design?.variant === 'accent3', 'an accent swatch writes the slot name');
  assert.equal(chosen.design.variant, undefined, 'only the slide changed');
  await settle();
  const own = await checked();
  assert.deepEqual([own.map(entry => entry.slot), own[0].source], [['accent3'], null], 'now the slide sets it itself');
  await button('Undo').click();
  await waitDoc(current => current.slides[1].design === undefined, 'one Undo returns the slide to its layout');
  await settle();
  assert.deepEqual((await checked()).map(entry => entry.slot), ['accent1']);
  await design.getByLabel(/^Applies to/).selectOption('deck');
  await slide(1);
  assert.deepEqual((await checked()).map(entry => entry.slot), ['light1'], 'the deck scope is the deck, whatever the slide shows');
  await design.getByRole('radio', { name: /^Accent 2:/ }).click();
  await waitDoc(current => current.design.variant === 'accent2', 'a deck accent');
  await button('Undo').click();
  await waitDoc(current => current.design.variant === undefined, 'deck accent undone');
  await settle();
  mark('an accent swatch writes the slot at the slide or the deck, in one undo step');

  // --- LH-123: the trend --------------------------------------------------------------------------------------------
  await slide(5);
  await select('slides.5.blocks.0');
  const trend = selection.getByLabel(/^Trend/);
  await trend.waitFor();
  assert.deepEqual(await trend.locator('option').evaluateAll(options => options.map(option => [option.value, option.textContent])), [['', 'None'], ['up', 'Up'], ['down', 'Down'], ['flat', 'Flat']]);
  assert.equal(await trend.inputValue(), 'up', 'the metric inspector shows the trend');
  const arrow = page.locator('#preview [data-opf-trend-arrow][data-opf-path="slides.5.blocks.0.metric.trend"]');
  assert.equal(await arrow.count(), 1, 'the arrow is a target on the canvas');
  assert.equal(await arrow.getAttribute('role'), 'button');
  assert.equal(await arrow.getAttribute('aria-label'), 'Edit trend: up');
  await trend.selectOption('down');
  await waitDoc(current => current.slides[5].blocks[0].metric.trend === 'down', 'the inspector sets the trend');
  await settle();
  assert.equal(await page.locator('#preview [data-opf-trend-arrow]').getAttribute('aria-label'), 'Edit trend: down', 'the canvas follows');
  await trend.selectOption('');
  await waitDoc(current => current.slides[5].blocks[0].metric.trend === undefined, 'None removes the trend');
  await settle();
  assert.equal(await page.locator('#preview [data-opf-trend-arrow]').count(), 0, 'no trend, no arrow');
  await button('Undo').click();
  await button('Undo').click();
  await waitDoc(current => current.slides[5].blocks[0].metric.trend === 'up', 'two Undo steps restore the trend');
  await settle();
  mark('the metric inspector reads and sets the trend');

  // A press on the arrow opens the trend field: the choices up, down and flat.
  await page.locator('#preview [data-opf-trend-arrow]').click();
  const form = page.getByRole('form', { name: 'Content properties' });
  await form.waitFor();
  const field = form.getByLabel('trend');
  assert.deepEqual(await field.locator('option').evaluateAll(options => options.map(option => option.value)), ['up', 'down', 'flat'], 'the arrow opens a menu of the trends');
  assert.equal(await field.inputValue(), 'up');
  await field.selectOption('flat');
  await form.getByRole('button', { name: 'Apply', exact: true }).click();
  await waitDoc(current => current.slides[5].blocks[0].metric.trend === 'flat', 'the canvas field sets the trend');
  await settle();
  assert.equal(await page.locator('#preview [data-opf-trend-arrow]').getAttribute('aria-label'), 'Edit trend: flat');
  assert.equal(await selection.getByLabel(/^Trend/).inputValue(), 'flat', 'the inspector follows the canvas');
  await button('Undo').click();
  await waitDoc(current => current.slides[5].blocks[0].metric.trend === 'up', 'Undo restores the trend');
  await settle();
  // The keyboard reaches it too: the arrow is a button in the tab order and Enter opens the field.
  await page.locator('#preview [data-opf-trend-arrow]').focus();
  await page.keyboard.press('Enter');
  await form.waitFor();
  await page.keyboard.press('Escape');
  await form.waitFor({ state: 'detached' });
  assert.equal((await doc()).slides[5].blocks[0].metric.trend, 'up', 'Escape leaves it as it was');
  // A metric without a trend draws no arrow; the inspector adds one (a bare value becomes an object).
  await settle();
  await select('slides.5.blocks.1');
  await selection.getByLabel(/^Trend/).selectOption('down');
  await waitDoc(current => current.slides[5].blocks[1].metric.trend === 'down', 'the inspector adds a trend to a metric without one');
  await settle();
  assert.equal(await page.locator('#preview [data-opf-trend-arrow]').count(), 2, 'it now draws an arrow');
  await button('Undo').click();
  await waitDoc(current => current.slides[5].blocks[1].metric.trend === undefined, 'trend added undone');
  mark('the arrow on the canvas opens the trend field, by pointer and keyboard');

  // --- LH-126: the fit auto resolved to ------------------------------------------------------------------------------
  await slide(6);
  const fit = () => selection.getByLabel(/^Fit/);
  const fitState = async () => ({ value: await fit().inputValue(), labels: await fit().locator('option').evaluateAll(options => options.map(option => [option.value, option.textContent])) });
  await select('slides.6.blocks.0');
  await fit().waitFor();
  let state = await fitState();
  assert.equal(state.value, 'auto');
  assert.deepEqual(state.labels, [['', 'Presentation default'], ['cover', 'Cover'], ['contain', 'Contain'], ['stretch', 'Stretch'], ['auto', 'Auto (cover)']], 'a square picture in a square frame covers it');
  await select('slides.6.blocks.1');
  await page.waitForFunction(() => /Auto \(contain\)/.test(document.querySelector('#selection-controls [id^="opf-dc-"][id*="img-fit"]')?.textContent ?? ''), undefined, { timeout: 8000 });
  state = await fitState();
  assert.equal(state.value, 'auto');
  assert.equal(state.labels.at(-1)[1], 'Auto (contain)', 'a wide frame shows the whole picture');
  await select('slides.6.blocks.2');
  await page.waitForFunction(() => document.querySelector('#selection-controls [id*="img-fit"]')?.value === 'cover', undefined, { timeout: 8000 });
  state = await fitState();
  assert.equal(state.labels.at(-1)[1], 'Auto', 'a fit that is not auto says no more');
  // The choice still writes the value.
  await fit().selectOption('auto');
  await waitDoc(current => current.slides[6].blocks[2].fit === 'auto', 'Auto is chosen');
  await settle();
  assert.match((await fitState()).labels.at(-1)[1], /^Auto \((cover|contain)\)$/, 'chosen, it says what it came to');
  await button('Undo').click();
  await waitDoc(current => current.slides[6].blocks[2].fit === 'cover', 'Auto undone');
  mark('the image fit select reads "Auto (cover)" and "Auto (contain)"');

  assert.deepEqual(errors, []);
  console.log(`Variant, trend and fit (browser): ${checks.length} checks. ${checks.join('; ')}.`);
} finally {
  await browser?.close();
  server.close();
}
