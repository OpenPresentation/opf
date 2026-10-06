import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

// RR-54 in a real browser: the data grid on a chart and a table that show a shared dataset (the status line, edits that reach the dataset
// through `fields`), a column's number format (inline error for an invalid pattern, set and clear), the chart columns panel (category, X and
// series) and "Use a copy of the data". The grid is bundled straight from src/ with the page it needs (no playground, no renderer), so this runs
// without the font gates. OPF_CORE_DIST names a built core `dist` directory to bundle instead of the installed @openpresentation/opf.
const root = fileURLToPath(new URL('../', import.meta.url));
const out = path.join(root, 'artifacts', 'data-grid-datasets');
await mkdir(out, { recursive: true });
const coreDist = process.env.OPF_CORE_DIST ? path.resolve(process.env.OPF_CORE_DIST) : undefined;
await build({
  stdin: { contents: `import { createEditorSession } from './src/index.js';\nimport { createDataGrid } from './src/data-grid.js';\nwindow.opfTest = { createEditorSession, createDataGrid };\n`, resolveDir: root, sourcefile: 'entry.js' },
  outfile: path.join(out, 'bundle.js'),
  bundle: true,
  format: 'iife',
  platform: 'browser',
  logLevel: 'error',
  plugins: coreDist ? [{
    name: 'local-core',
    setup(b) {
      b.onResolve({ filter: /^@openpresentation\/opf(\/.*)?$/ }, (args) => {
        const sub = args.path.slice('@openpresentation/opf'.length).replace(/^\//, '');
        return { path: path.join(coreDist, sub ? `${sub}.js` : 'index.js') };
      });
    },
  }] : [],
});
await writeFile(path.join(out, 'index.html'), '<!doctype html><html lang="en"><meta charset="utf-8"><title>Data grid datasets</title><div id="host"></div><script src="bundle.js"></script></html>');

const deck = {
  name: 'Grid',
  design: { theme: 'minimal', fontScheme: 'aptos' },
  datasets: { revenue: { columns: ['Quarter', { name: 'Revenue', format: '$#,##0.0' }, 'Costs', 'Notes'], rows: [['Q1', 12.4, 5, 'a'], ['Q2', 18.1, 8, 'b'], ['Q3', 24, 9, 'c']] } },
  slides: [{ id: 's', title: 'Data', blocks: [
    { chart: { type: 'column', data: { dataset: 'revenue', fields: ['Quarter', 'Revenue', 'Costs'] } } },
    { chart: { type: 'column', data: { columns: ['Quarter', { name: 'Revenue', format: '$#,##0.0' }, 'Costs'], rows: [['Q1', 12.4, 5], ['Q2', 18.1, 8]] } } },
    { table: { dataset: 'revenue' } },
  ] }],
};

let browser;
try {
  browser = await chromium.launch({ channel: process.platform === 'win32' && !process.env.CI ? 'msedge' : undefined });
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.stack ?? error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto(pathToFileURL(path.join(out, 'index.html')).href);
  await page.evaluate((source) => {
    const editor = window.opfTest.createEditorSession(source, { rejectInvalid: true });
    window.editor = editor;
    window.selected = 'slides.0.blocks.0.chart';
    window.gridApi = window.opfTest.createDataGrid(document.getElementById('host'), { editor, getSelectedPath: () => window.selected, numberFormat: '.' });
  }, deck);
  const text = (selector) => page.locator(selector).first().innerText();
  const datasetOf = () => page.evaluate(() => window.editor.document.datasets.revenue);
  const undoDepth = () => page.evaluate(() => window.editor.snapshot().undoDepth);
  const refresh = (selected) => page.evaluate((path) => { window.selected = path; window.gridApi.refresh(); }, selected);

  // The status line says which dataset and how many items use it.
  assert.match(await text('[data-role="dataset-note"]'), /Shared dataset .revenue. . used by 2 items/);
  assert.deepEqual(await page.locator('tbody tr').first().locator('td').allInnerTexts(), ['Quarter', 'Revenue', 'Costs'], 'fields select the columns the grid shows');
  assert.equal(await page.locator('[data-action="transpose"]').isHidden(), true, 'swapping rows and columns is not offered on a shared dataset');

  // The number format of the selected column.
  await page.locator('td[data-line="0"][data-column="1"]').click();
  assert.equal(await page.locator('[data-role="column-format"]').inputValue(), '$#,##0.0');
  assert.match(await text('.opf-grid-format label'), /column B \(Revenue\)/);
  await page.locator('[data-role="column-format"]').fill('abc');
  assert.ok((await text('[data-role="format-error"]')).length > 0, 'an invalid format is explained inline');
  assert.equal(await page.locator('[data-role="column-format"]').getAttribute('aria-invalid'), 'true');
  await page.locator('[data-role="column-format"]').press('Enter');
  assert.deepEqual((await datasetOf()).columns[1], { name: 'Revenue', format: '$#,##0.0' }, 'an invalid format changes nothing');
  assert.equal(await undoDepth(), 0);
  await page.locator('[data-role="column-format"]').fill('0.0%');
  await page.locator('[data-role="column-format"]').press('Enter');
  assert.deepEqual((await datasetOf()).columns[1], { name: 'Revenue', format: '0.0%' });
  await page.getByRole('button', { name: 'Clear', exact: true }).click();
  assert.equal((await datasetOf()).columns[1], 'Revenue', 'clearing the format returns the column to a plain name');
  assert.equal(await undoDepth(), 2, 'each format change is one undo step');

  // A cell edit reaches the dataset's own column.
  await page.locator('td[data-line="2"][data-column="2"]').dblclick();
  await page.keyboard.press('Control+a');
  await page.keyboard.type('80');
  await page.keyboard.press('Enter');
  assert.equal((await datasetOf()).rows[1][2], 80);
  assert.equal(await undoDepth(), 3);

  // The chart columns panel.
  await page.locator('.opf-grid-mapping summary').click();
  await page.locator('.opf-grid-mapping fieldset input[value="Revenue"]').uncheck();
  assert.deepEqual(await page.evaluate(() => window.editor.document.slides[0].blocks[0].chart.mapping), { series: ['Costs'] });
  assert.equal(await undoDepth(), 4, 'one change of the mapping is one undo step');
  await page.locator('.opf-grid-mapping fieldset input[value="Revenue"]').check();
  assert.equal(await page.evaluate(() => window.editor.document.slides[0].blocks[0].chart.mapping), undefined, 'the default mapping is removed');
  await page.evaluate(() => { while (window.editor.snapshot().undoDepth) window.editor.undo(); });

  // A table that shows the dataset has no chart columns panel, and "Use a copy" gives it its own rows.
  await refresh('slides.0.blocks.2.table');
  assert.match(await text('[data-role="dataset-note"]'), /Shared dataset .revenue./);
  assert.equal(await page.locator('.opf-grid-mapping').isHidden(), true);
  await page.getByRole('button', { name: 'Use a copy of the data' }).click();
  assert.equal(await page.locator('.opf-grid-dataset').isHidden(), true);
  assert.ok(await page.evaluate(() => Array.isArray(window.editor.document.slides[0].blocks[2].table.rows)));

  // An inline chart with DataColumn headers shows names and the format in the ruler.
  await refresh('slides.0.blocks.1.chart');
  assert.equal(await page.locator('.opf-grid-dataset').isHidden(), true);
  assert.deepEqual(await page.locator('tbody tr').first().locator('td').allInnerTexts(), ['Quarter', 'Revenue', 'Costs']);
  assert.match((await page.locator('th[data-ruler="column"]').allInnerTexts())[1], /format \$#,##0\.0/);
  // A format typed for one column goes to that column, also when the click that leaves the field selects another one.
  await page.evaluate(() => { while (window.editor.snapshot().undoDepth) window.editor.undo(); });
  await refresh('slides.0.blocks.1.chart');
  await page.locator('td[data-line="0"][data-column="2"]').click();
  await page.locator('[data-role="column-format"]').fill('0.00');
  await page.locator('td[data-line="1"][data-column="1"]').click();
  assert.deepEqual(await page.evaluate(() => window.editor.document.slides[0].blocks[1].chart.data.columns), ['Quarter', { name: 'Revenue', format: '$#,##0.0' }, { name: 'Costs', format: '0.00' }], 'the format went to the column it was typed for, not the one that was clicked');
  // A formatted column shows its numbers as the slide draws them; editing and copying use the raw value.
  await page.evaluate(() => { while (window.editor.snapshot().undoDepth) window.editor.undo(); });
  await refresh('slides.0.blocks.1.chart');
  const cell = (u, c) => page.locator(`td[data-line="${u}"][data-column="${c}"]`);
  assert.equal(await cell(1, 1).innerText(), '$12.4', 'a formatted number shows its format');
  assert.equal(await cell(1, 2).innerText(), '5', 'a column without a format shows the value');
  await cell(1, 1).dblclick();
  assert.equal(await page.locator('textarea[data-role="cell-editor"]').inputValue(), '12.4', 'editing shows the raw value');
  await page.keyboard.press('Escape');
  assert.equal(await cell(1, 1).innerText(), '$12.4', 'the format is back after the edit');
  assert.equal(await undoDepth(), 0, 'looking at a cell changes nothing');
  await cell(0, 1).click();
  await page.locator('[data-role="column-format"]').fill('0.0%');
  await page.locator('[data-role="column-format"]').press('Enter');
  assert.equal(await cell(1, 1).innerText(), '1240.0%', 'a new format shows at once');
  assert.equal(await cell(1, 1).getAttribute('title'), 'Stored as 12.4');
  assert.deepEqual(errors, []);
  console.log('Data grid (RR-54): shared dataset status, edits through fields, column format, chart columns and use-a-copy, in a real browser.');
} finally {
  await browser?.close();
}
