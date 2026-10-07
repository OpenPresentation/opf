import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

// RR-35 in a real browser, on the built playground (npm run build:playground). Selecting a chart shows the chart options panel;
// axis titles, the legend position and data labels each commit one undoable change that redraws the preview; the panel offers only
// what the chart type can show; and it hides when something that is not a chart is selected.
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

const data = { columns: ['Quarter', 'North', 'South'], rows: [['Q1', 10, 5], ['Q2', 20, 8], ['Q3', 15, 12]] };
const source = {
  name: 'Chart options',
  language: 'english',
  design: { theme: 'classic', fontScheme: 'roboto' },
  slides: [
    { id: 'column', title: 'Column', blocks: [{ chart: { type: 'column', data } }, { text: 'Notes' }] },
    { id: 'pie', title: 'Pie', blocks: [{ chart: { type: 'pie', data } }] },
    { id: 'combo', title: 'Combo', blocks: [{ chart: { type: 'combo', data: { columns: ['Quarter', 'Revenue', { name: 'Margin', format: '0%' }], rows: [['Q1', 10, 0.3], ['Q2', 20, 0.34], ['Q3', 15, 0.29]] } } }] },
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
  const panel = page.locator('#chart-controls .opf-chart-options');
  const doc = async () => JSON.parse(await page.locator('#json').inputValue());
  const settle = () => page.waitForFunction(() => !/Loading fonts/.test(document.querySelector('#status').textContent) && !document.querySelector('#preview')?.textContent.includes('Loading fonts'), undefined, { timeout: 60000 }).catch(() => {});
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

  await page.goto(`http://127.0.0.1:${server.address().port}/index.html`);
  await page.locator('#preview svg').waitFor();
  await button('Source').click();
  await page.locator('#json').fill(JSON.stringify(source));
  await page.waitForFunction(() => !document.querySelector('#apply-json').disabled && !document.querySelector('#json-error').textContent);
  await button('Apply changes').click();
  await page.locator('#preview [data-canvas-target][data-opf-path="slides.0.title"]').waitFor();
  await settle();

  // Not selected: hidden.
  assert.equal(await panel.isHidden(), true, 'the panel is hidden while a title is selected');
  mark('hidden until a chart is selected');

  await page.locator('#preview [data-canvas-target][data-opf-path="slides.0.blocks.0.chart"]').click();
  await panel.waitFor({ state: 'visible' });
  const field = text => panel.getByLabel(text, { exact: true });
  assert.deepEqual(await panel.locator('[data-opf-chart-option="legend"] option').evaluateAll(options => options.map(option => option.value)), ['default', 'none', 'top', 'bottom', 'left', 'right']);
  assert.equal(await field('Data labels').isChecked(), false);
  mark('shown for a selected chart');

  // One step in, one step out.
  async function step(name, action, predicate, { preview = true } = {}) {
    const before = await doc();
    const beforeSvg = await page.locator('#preview svg').first().evaluate(node => node.outerHTML);
    await action();
    const after = await waitDoc(predicate, name);
    await settle();
    assert.notDeepEqual(after, before, `${name} changed the document`);
    if (preview) await page.waitForFunction(previous => document.querySelector('#preview svg')?.outerHTML !== previous, beforeSvg, { timeout: 8000 }).catch(() => assert.fail(`${name}: the preview did not change`));
    await button('Undo').click();
    await waitDoc(current => JSON.stringify(current) === JSON.stringify(before), `${name}: one Undo restores the document`);
    await settle();
    await button('Redo').click();
    await waitDoc(current => JSON.stringify(current) === JSON.stringify(after), `${name}: Redo returns the change`);
    await settle();
    await button('Undo').click();
    await waitDoc(current => JSON.stringify(current) === JSON.stringify(before), `${name}: reset`);
    await settle();
    mark(name);
  }
  const chartOf = current => current.slides[0].blocks[0].chart;

  await step('category axis title', async () => { await field('Category axis title').fill('Quarter'); await field('Category axis title').press('Enter'); }, current => chartOf(current).axisTitles?.category === 'Quarter');
  await step('value axis title', async () => { await field('Value axis title').fill('Revenue ($M)'); await field('Value axis title').blur(); }, current => chartOf(current).axisTitles?.value === 'Revenue ($M)');
  await step('legend position', () => field('Legend').selectOption('bottom'), current => chartOf(current).legend === 'bottom');
  await step('legend off', () => field('Legend').selectOption('none'), current => chartOf(current).legend === 'none');
  await step('data labels on', () => field('Data labels').check(), current => chartOf(current).dataLabels === true);

  // With labels on: content, position and separator.
  await field('Data labels').check();
  await waitDoc(current => chartOf(current).dataLabels === true, 'labels on for the follow-up steps');
  await settle();
  assert.deepEqual(await panel.locator('[data-opf-chart-option="dataLabels.position"] option').evaluateAll(options => options.map(option => option.value)), ['auto', 'center', 'inside-end', 'inside-base', 'outside-end']);
  assert.equal(await panel.locator('[data-opf-chart-option="dataLabels.content.percent"]').evaluate(input => input.closest('label').hidden), true, 'percent is not offered on a column chart');
  await step('label position', () => field('Label position').selectOption('inside-end'), current => chartOf(current).dataLabels?.position === 'inside-end');
  await step('label content', () => panel.locator('[data-opf-chart-option="dataLabels.content.category"]').check(), current => JSON.stringify(chartOf(current).dataLabels?.content) === '["category","value"]');
  mark('only supported label positions and contents are offered');

  // FA-14: the highlight lists one checkbox per series and per category; each commits one undoable change and the preview redraws.
  assert.deepEqual(await panel.locator('[data-choices="series"] input').evaluateAll(inputs => inputs.map(input => input.value)), ['North', 'South']);
  assert.deepEqual(await panel.locator('[data-choices="categories"] input').evaluateAll(inputs => inputs.map(input => input.value)), ['Q1', 'Q2', 'Q3']);
  await step('highlight a series', () => field('Highlight series North').check(), current => JSON.stringify(chartOf(current).highlight) === '{"series":["North"]}');
  await step('highlight a category', () => field('Highlight category Q2').check(), current => JSON.stringify(chartOf(current).highlight) === '{"categories":["Q2"]}');
  await field('Highlight series South').check();
  await waitDoc(current => JSON.stringify(chartOf(current).highlight) === '{"series":["South"]}', 'highlight for the follow-up step');
  await field('Highlight category Q3').check();
  await waitDoc(current => JSON.stringify(chartOf(current).highlight) === '{"series":["South"],"categories":["Q3"]}', 'both parts together');
  await field('Highlight series South').uncheck();
  await field('Highlight category Q3').uncheck();
  await waitDoc(current => chartOf(current).highlight === undefined, 'clearing both lists removes the field');
  await settle();
  mark('the highlight lists series and categories');

  // A pie offers percent and a different position set, and no axis titles.
  await page.locator('#preview [data-canvas-target][data-opf-path="slides.1.blocks.0.chart"]').waitFor().catch(() => {});
  await page.locator('#slide-list button').nth(1).click();
  await page.locator('#preview [data-canvas-target][data-opf-path="slides.1.blocks.0.chart"]').click();
  await panel.waitFor({ state: 'visible' });
  assert.equal(await panel.locator('[data-group="axisTitles"]').isHidden(), true, 'a pie has no axis titles');
  assert.equal(await panel.locator('[data-opf-chart-option="dataLabels.content.percent"]').evaluate(input => input.closest('label').hidden), false, 'a pie offers percent');
  assert.equal(await panel.locator('[data-part="series"]').isHidden(), true, 'a pie highlights slices, not series');
  assert.equal(await panel.locator('[data-part="categories"]').isVisible(), true, 'a pie highlights categories');
  mark('the panel follows the chart type');

  // The panel follows Undo done elsewhere.
  await page.locator('#slide-list button').nth(0).click();
  await page.locator('#preview [data-canvas-target][data-opf-path="slides.0.blocks.0.chart"]').click();
  await panel.waitFor({ state: 'visible' });
  await field('Legend').selectOption('top');
  await waitDoc(current => chartOf(current).legend === 'top', 'legend for the follow check');
  await button('Undo').click();
  await waitDoc(current => chartOf(current).legend === undefined, 'legend undone');
  assert.equal(await field('Legend').inputValue(), 'default', 'the control follows Undo');
  mark('the panel follows Undo');

  // FA-15: a combo chart lists its series; a line can move to the secondary axis, which brings the secondary axis title.
  await page.locator('#slide-list button').nth(2).click();
  await page.locator('#preview [data-canvas-target][data-opf-path="slides.2.blocks.0.chart"]').click();
  await panel.waitFor({ state: 'visible' });
  assert.equal(await panel.locator('[data-group="combo"]').isHidden(), false, 'a combo chart shows its series');
  assert.deepEqual(await panel.locator('[data-opf-chart-option="line"]').evaluateAll(inputs => inputs.map(input => [input.value, input.checked])), [['Revenue', false], ['Margin', true]], 'the last series is the line');
  assert.equal(await panel.locator('[data-axis="secondary"]').isHidden(), true, 'no secondary axis title without a secondary axis');
  const comboOf = current => current.slides[2].blocks[0].chart;
  const before = await doc();
  await step('secondary axis', () => panel.getByLabel('Margin on the secondary axis', { exact: true }).check(), current => JSON.stringify(comboOf(current).secondaryAxis) === '["Margin"]');
  await panel.getByLabel('Margin on the secondary axis', { exact: true }).check();
  await waitDoc(current => JSON.stringify(comboOf(current).secondaryAxis) === '["Margin"]', 'secondary axis for the title step');
  await settle();
  assert.equal(await panel.locator('[data-axis="secondary"]').isHidden(), false, 'the secondary axis title is offered');
  await step('secondary axis title', async () => { await field('Secondary axis title').fill('Margin'); await field('Secondary axis title').press('Enter'); }, current => comboOf(current).axisTitles?.secondary === 'Margin');
  await button('Undo').click();
  await waitDoc(current => JSON.stringify(current) === JSON.stringify(before), 'combo reset');
  await settle();
  assert.equal(await panel.locator('[data-group="combo"]').isHidden(), false);
  mark('combo series lines and the secondary axis');
  await page.locator('#slide-list button').nth(0).click();
  await page.locator('#preview [data-canvas-target][data-opf-path="slides.0.blocks.0.chart"]').click();
  await panel.waitFor({ state: 'visible' });
  assert.equal(await panel.locator('[data-group="combo"]').isHidden(), true, 'a column chart has no combo series');

  // Selecting something that is not a chart hides the panel again.
  await page.locator('#preview [data-canvas-target][data-opf-path="slides.0.title"]').click();
  await panel.waitFor({ state: 'hidden' });
  mark('hidden again for non-charts');

  assert.deepEqual(errors, []);
  console.log(`Chart options (browser): ${checks.length} checks. ${checks.join('; ')}.`);
} finally {
  await browser?.close();
  server.close();
}
