import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

// RR-24 in a real browser, on the built playground (npm run build:playground). The data grid docks under the slide when a chart or table is
// selected: cells edit from the keyboard, paste TSV and CSV, copy as TSV, rows and columns insert, delete and move, sort and transpose, merged
// table cells draw with their spans, every edit is one undo step that redraws the preview, and the grid is operable and labelled for
// keyboard and screen reader users.
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

const source = {
  name: 'Data grid',
  language: 'en-US',
  narrative: 'problem-solution',
  tone: 'formal',
  audience: ['executive'],
  speaker: { id: 'alice', name: 'Alice Chen' },
  organization: { id: 'acme', name: 'Acme' },
  design: { theme: 'classic', fontScheme: 'roboto' },
  slides: [
    { id: 'cover', title: 'Data grid', subtitle: 'Edit the numbers behind the story' },
    { id: 'data', title: 'Data', composition: { mode: 'column' }, blocks: [
      { chart: { type: 'column', data: { columns: ['Quarter', 'Revenue', 'Costs'], rows: [['Q1', 12, 5], ['Q2', 18, null], ['Q3', 24, 9]] } } },
      { table: { columns: ['Region', 'Q1', 'Q2'], rows: [['North', 10, 2], ['South', 3, 4], ['East', 5, 6], ['West', 7, 8]] } },
    ] },
    { id: 'merged', title: 'Merged', blocks: [
      { table: { columns: ['Region', { value: 'Quarters', colSpan: 2 }, null], rows: [
        [{ value: 'North', rowSpan: 2 }, 1, 2],
        [null, 3, 4],
        [['East ', { text: 'coast', bold: true }], { value: 'block', rowSpan: 2, colSpan: 2 }, null],
        ['West', null, null],
      ] } },
    ] },
  ],
};

let browser;
const checks = [];
try {
  browser = await chromium.launch({ channel: process.platform === 'win32' && !process.env.CI ? 'msedge' : undefined });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.stack ?? error.message));
  page.on('console', message => { if (message.type() === 'error' && !/Failed to load resource/.test(message.text())) errors.push(message.text()); });
  const button = name => page.getByRole('button', { name, exact: true });
  const dock = page.locator('#data-grid-dock');
  const grid = dock.getByRole('grid');
  const doc = async () => JSON.parse(await page.locator('#json').inputValue());
  const settle = () => page.waitForFunction(() => !/Loading fonts/.test(document.querySelector('#status').textContent) && !document.querySelector('#preview')?.textContent.includes('Loading fonts'), undefined, { timeout: 60000 });
  const preview = () => page.locator('#preview svg').first().evaluate(node => node.outerHTML);
  const waitDoc = async (predicate, message) => {
    const started = Date.now();
    for (;;) {
      const current = await doc();
      if (predicate(current)) return current;
      if (Date.now() - started > 8000) assert.fail(`${message}: ${JSON.stringify(current).slice(0, 400)}`);
      await page.waitForTimeout(40);
    }
  };
  const mark = name => checks.push(name);
  const slide = async index => { await page.locator('#slide-list button').nth(index).click(); await page.waitForFunction(i => document.querySelector('#slide-list').children[i].getAttribute('aria-current') === 'true', index); await settle(); };
  const cell = (line, column) => dock.locator(`td[data-line="${line}"][data-column="${column}"]`);
  const chartData = current => current.slides[1].blocks[0].chart.data;
  const tableData = current => current.slides[1].blocks[1].table;
  const status = () => dock.locator('.opf-grid-status').textContent();
  const alert = () => dock.locator('.opf-grid-error').textContent();
  const active = () => dock.evaluate(node => { const td = node.querySelector('td.opf-grid-active'); return td ? [Number(td.dataset.line), Number(td.dataset.column)] : null; });
  const texts = () => dock.locator('tbody tr').evaluateAll(rows => rows.map(row => [...row.querySelectorAll('td')].map(td => td.textContent)));
  // "Edit data" opens the grid over the bottom of the canvas; it is closed again before the slide is clicked so it never covers a target.
  const edit = page.locator('#edit-data');
  const closeGrid = async () => { if (!(await dock.isHidden())) await page.getByRole('button', { name: 'Close data grid', exact: true }).click(); };
  const openGrid = async () => { if ((await edit.getAttribute('aria-expanded')) !== 'true') await edit.click(); await grid.waitFor(); };
  const selectChart = async () => { await closeGrid(); await page.locator('#preview [data-canvas-target][data-opf-path="slides.1.blocks.0.chart"]').click(); await openGrid(); };
  const selectTable = async () => { await closeGrid(); await page.locator('#preview [data-canvas-target][data-opf-path^="slides.1.blocks.1.table"]').first().click(); await openGrid(); };
  const paste = (text, selector = '#data-grid-dock table') => page.evaluate(({ text, selector }) => {
    const data = new DataTransfer();
    data.setData('text/plain', text);
    document.querySelector(selector).dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
  }, { text, selector });

  // One step in, one step out: act, check, then Undo restores the document in one step and Redo returns it.
  async function step(name, action, predicate, { preview: expectPreview = true } = {}) {
    const before = await doc();
    const beforeSvg = await preview();
    await action();
    const after = await waitDoc(predicate, name);
    await settle();
    assert.notDeepEqual(after, before, `${name} changed the document`);
    if (expectPreview) await page.waitForFunction(previous => document.querySelector('#preview svg')?.outerHTML !== previous, beforeSvg, { timeout: 8000 }).catch(() => assert.fail(`${name}: the preview did not redraw`));
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
    return after;
  }

  await page.goto(`http://127.0.0.1:${server.address().port}/index.html`);
  await page.locator('#preview svg').waitFor();
  await button('Source').click();
  await page.locator('#json').fill(JSON.stringify(source));
  await page.waitForFunction(() => !document.querySelector('#apply-json').disabled && !document.querySelector('#json-error').textContent);
  await button('Apply changes').click();
  await page.waitForFunction(() => document.querySelector('#document-name').value === 'Data grid' && !document.querySelector('#source-dialog').open, undefined, { timeout: 20000 });
  await page.locator('#preview [data-canvas-target][data-opf-path="slides.0.title"]').waitFor();
  await settle();
  assert.deepEqual(await doc(), source);

  // --- the grid follows the selection ------------------------------------------------------------------
  assert.equal(await dock.isHidden(), true, 'no chart or table is selected, so no grid shows');
  assert.equal(await edit.isHidden(), true, 'and no Edit data button');
  await slide(1);
  await page.locator('#preview [data-canvas-target][data-opf-path="slides.1.blocks.0.chart"]').click();
  assert.equal(await edit.isVisible(), true, 'selecting a chart offers Edit data');
  assert.equal(await edit.getAttribute('aria-expanded'), 'false');
  assert.equal(await dock.isHidden(), true, 'the grid opens when asked, so a click on the slide never moves it');
  await edit.click();
  await grid.waitFor();
  assert.equal(await edit.getAttribute('aria-expanded'), 'true');
  assert.equal(await edit.textContent(), 'Hide data');
  assert.equal(await dock.getAttribute('hidden'), null, 'Edit data shows the chart data');
  assert.equal(await dock.locator('.opf-grid-title strong').textContent(), 'Chart data');
  assert.deepEqual(await texts(), [['Quarter', 'Revenue', 'Costs'], ['Q1', '12', '5'], ['Q2', '18', ''], ['Q3', '24', '9']], 'the grid shows the chart data, a gap as empty');
  assert.equal(await cell(2, 2).evaluate(node => node.classList.contains('opf-grid-gap')), true, 'a gap is marked as a gap, never as 0');
  assert.equal(await cell(2, 2).getAttribute('aria-label'), 'Empty, a gap in the chart');
  mark('selecting a chart shows its data, with the gap as a gap');

  // --- semantics --------------------------------------------------------------------------------------------
  assert.equal(await grid.getAttribute('aria-multiselectable'), 'true');
  assert.equal(await grid.getAttribute('aria-label'), 'Chart data');
  assert.equal(await grid.getAttribute('aria-rowcount'), '5');
  assert.equal(await grid.getAttribute('aria-colcount'), '4');
  assert.deepEqual(await dock.locator('thead th').evaluateAll(nodes => nodes.map(node => node.getAttribute('aria-label'))), ['Select all cells', 'Column A, categories', 'Column B, series', 'Column C, series']);
  assert.equal(await dock.locator('tbody th').first().textContent(), 'Header');
  assert.equal(await dock.locator('tbody th').nth(1).textContent(), '1');
  assert.deepEqual(await dock.locator('tbody td').first().evaluate(node => [node.getAttribute('role'), node.getAttribute('aria-colindex'), node.parentElement.getAttribute('aria-rowindex'), node.getAttribute('aria-selected'), node.getAttribute('aria-readonly')]), ['gridcell', '2', '2', 'true', 'false']);
  assert.deepEqual(await dock.locator('td[tabindex="0"]').count(), 1, 'one cell is in the tab order');
  const aria = await grid.ariaSnapshot();
  for (const expected of ['grid "Chart data"', 'columnheader "Column A, categories"', 'rowheader "Header"', 'gridcell "Quarter"', 'gridcell "Empty, a gap in the chart"']) assert.ok(aria.includes(expected), `the accessibility tree has ${expected}:\n${aria}`);
  assert.equal(await dock.getByRole('toolbar', { name: 'Data grid actions' }).count(), 1);
  assert.equal(await dock.locator('.opf-grid-status').getAttribute('role'), 'status');
  assert.equal(await dock.locator('.opf-grid-error').getAttribute('role'), 'alert');
  assert.equal(await grid.getAttribute('aria-describedby') !== null, true, 'the keyboard help describes the grid');
  mark('the grid exposes grid, row, columnheader, rowheader and gridcell semantics with indexes and a status and alert region');

  // --- keyboard navigation and editing -----------------------------------------------------------------------
  await cell(1, 1).click();
  assert.deepEqual(await active(), [1, 1]);
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowDown');
  assert.deepEqual(await active(), [2, 2], 'arrows move the active cell');
  await page.keyboard.press('Home');
  assert.deepEqual(await active(), [2, 0]);
  await page.keyboard.press('End');
  assert.deepEqual(await active(), [2, 2]);
  await page.keyboard.press('Control+Home');
  assert.deepEqual(await active(), [0, 0]);
  await page.keyboard.press('Control+End');
  assert.deepEqual(await active(), [3, 2]);
  await page.keyboard.press('PageUp');
  assert.deepEqual(await active(), [0, 2], 'PageUp goes up ten rows, to the first');
  await page.keyboard.press('ArrowUp');
  assert.deepEqual(await active(), [0, 2], 'the edge holds');
  await page.keyboard.press('Shift+ArrowDown');
  await page.keyboard.press('Shift+ArrowLeft');
  assert.deepEqual(await dock.locator('td[aria-selected="true"]').count(), 4, 'Shift+arrows extend a rectangular selection');
  await page.keyboard.press('Control+a');
  assert.equal(await dock.locator('td[aria-selected="true"]').count(), 12, 'Ctrl+A selects every cell');
  await cell(1, 1).click();
  mark('arrows, Home, End, Ctrl+Home, Ctrl+End, PageUp and Shift+arrows move and select');

  // F2 edits; Enter commits and moves down; the edit is one undo step and the preview redraws.
  await step('F2 edit then Enter', async () => {
    await cell(1, 1).focus();
    await page.keyboard.press('F2');
    const editor = dock.getByRole('textbox', { name: 'Edit Row 1, column B' });
    await editor.waitFor();
    assert.equal(await editor.inputValue(), '12', 'F2 edits the current text');
    await page.keyboard.press('Control+a');
    await page.keyboard.type('33');
    await page.keyboard.press('Enter');
  }, current => chartData(current).rows[0][1] === 33);
  // The edit above was undone by step(); redo it to check where the cursor went.
  await cell(1, 1).focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Control+a');
  await page.keyboard.type('33');
  await page.keyboard.press('Enter');
  await waitDoc(current => chartData(current).rows[0][1] === 33, 'Enter commits');
  assert.deepEqual(await active(), [2, 1], 'Enter commits and moves down');
  assert.equal(await page.evaluate(() => document.activeElement.matches('td.opf-grid-active')), true, 'the focus stays in the grid');
  assert.match(await status(), /Row 1, column B changed/);
  await button('Undo').click();
  await waitDoc(current => chartData(current).rows[0][1] === 12, 'Undo restores');
  await settle();

  // Typing replaces the cell; Tab commits and moves right; Shift+Tab and Shift+Enter move back and up; Escape cancels.
  await cell(1, 1).click();
  await page.keyboard.type('7.5');
  assert.equal(await dock.getByRole('textbox').inputValue(), '7.5', 'typing starts an edit that replaces the text');
  await page.keyboard.press('Tab');
  await waitDoc(current => chartData(current).rows[0][1] === 7.5, 'Tab commits');
  assert.deepEqual(await active(), [1, 2], 'Tab commits and moves right');
  await page.keyboard.press('F2');
  await page.keyboard.press('Escape');
  assert.equal(await dock.getByRole('textbox').count(), 0, 'Escape closes the editor');
  assert.equal((await doc()).slides[1].blocks[0].chart.data.rows[0][2], 5, 'Escape changes nothing');
  assert.match(await status(), /Edit cancelled/);
  await page.keyboard.press('F2');
  await page.keyboard.press('Control+a');
  await page.keyboard.type('6');
  await page.keyboard.press('Shift+Tab');
  await waitDoc(current => chartData(current).rows[0][2] === 6, 'Shift+Tab commits');
  assert.deepEqual(await active(), [1, 1], 'Shift+Tab moves left');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('F2');
  await page.keyboard.press('Shift+Enter');
  assert.deepEqual(await active(), [1, 1], 'Shift+Enter moves up');
  // Several undo steps back to the start.
  while (JSON.stringify(await doc()) !== JSON.stringify(source)) { await button('Undo').click(); await settle(); }
  assert.deepEqual(await doc(), source);
  mark('typing, F2, Enter, Shift+Enter, Tab, Shift+Tab and Escape edit and move');

  // A blank cell is a gap, never 0; Delete clears the selection in one step.
  await step('Delete clears a cell to a gap', async () => { await cell(1, 2).click(); await page.keyboard.press('Delete'); }, current => chartData(current).rows[0][2] === null);
  await step('Delete clears a selection in one step', async () => {
    await cell(1, 1).click();
    await page.keyboard.press('Shift+ArrowRight');
    await page.keyboard.press('Shift+ArrowDown');
    await page.keyboard.press('Backspace');
  }, current => JSON.stringify(chartData(current).rows.slice(0, 2).map(row => row.slice(1))) === '[[null,null],[null,null]]');
  assert.deepEqual((await doc()).slides[1].blocks[0].chart.data.rows[1], ['Q2', 18, null], 'the gap stayed a gap and no 0 was written');

  // Validation: text in a series cell is refused inline, nothing is written.
  await cell(1, 1).click();
  await page.keyboard.press('F2');
  await page.keyboard.press('Control+a');
  await page.keyboard.type('twelve');
  const editor = dock.getByRole('textbox');
  assert.equal(await editor.getAttribute('aria-invalid'), 'true', 'the editor is marked invalid as you type');
  assert.match(await alert(), /"twelve" is not a number in the 1,234\.56 format/);
  await page.keyboard.press('Enter');
  assert.equal(await dock.getByRole('textbox').count(), 1, 'Enter keeps the editor open while the text is invalid');
  assert.deepEqual(await doc(), source, 'nothing was written');
  await page.keyboard.press('Control+a');
  await page.keyboard.type('1,5');
  assert.match(await alert(), /1\.234,56 format/, 'the message names the format that reads it');
  await page.keyboard.press('Control+a');
  await page.keyboard.type('45%');
  assert.match(await alert(), /percent/i);
  await page.keyboard.press('Control+a');
  await page.keyboard.type('12');
  assert.equal(await editor.getAttribute('aria-invalid'), null, 'a valid number clears the mark');
  assert.equal(await alert(), '');
  await page.keyboard.press('Escape');
  mark('invalid numbers are refused inline with the reason, never written as 0');

  // Headers and categories are text.
  await step('rename a series', async () => { await cell(0, 1).click(); await page.keyboard.press('F2'); await page.keyboard.press('Control+a'); await page.keyboard.type('Sales'); await page.keyboard.press('Enter'); }, current => chartData(current).columns[1] === 'Sales');
  await step('rename a category', async () => { await cell(2, 0).click(); await page.keyboard.press('F2'); await page.keyboard.press('Control+a'); await page.keyboard.type('Second quarter'); await page.keyboard.press('Enter'); }, current => chartData(current).rows[1][0] === 'Second quarter');

  // Ctrl+Z in the grid undoes the last edit, Ctrl+Y redoes it.
  await cell(1, 1).click();
  await page.keyboard.type('50');
  await page.keyboard.press('Enter');
  await waitDoc(current => chartData(current).rows[0][1] === 50, 'edit for Ctrl+Z');
  await cell(1, 1).focus();
  await page.keyboard.press('Control+z');
  await waitDoc(current => chartData(current).rows[0][1] === 12, 'Ctrl+Z undoes');
  await page.keyboard.press('Control+y');
  await waitDoc(current => chartData(current).rows[0][1] === 50, 'Ctrl+Y redoes');
  await page.keyboard.press('Control+z');
  await waitDoc(current => chartData(current).rows[0][1] === 12, 'back');
  await settle();
  mark('Ctrl+Z and Ctrl+Y undo and redo from the grid');

  // --- paste ----------------------------------------------------------------------------------------------------
  await step('paste TSV into a chart', async () => { await cell(1, 1).click(); await paste('20\t6\n30\t7\n40\t8\n50\t9\n'); }, current => JSON.stringify(chartData(current).rows) === '[["Q1",20,6],["Q2",30,7],["Q3",40,8],[null,50,9]]');
  assert.equal(await status(), 'Pasted 4 rows by 2 columns. Undo restores the previous data.', 'the status says what was pasted');
  await step('paste Excel quoting and a header', async () => { await cell(0, 0).click(); await paste('Period\tSales\tSpend\n"Q1 (""a"")"\t1\t2\n'); }, current => chartData(current).columns.join('|') === 'Period|Sales|Spend' && chartData(current).rows[0][0] === 'Q1 ("a")');
  await step('paste decimal commas', async () => { await cell(1, 1).click(); await paste('1,5\t2,5\n3,25\t4,75'); }, current => JSON.stringify(chartData(current).rows.slice(0, 2)) === '[["Q1",1.5,2.5],["Q2",3.25,4.75]]');
  assert.match(await status(), /Numbers were read as 1.234,56/);
  // A paste with text in a series is refused whole; every offending cell is marked.
  await cell(1, 1).click();
  const beforeRefused = await doc();
  await paste('1\tabc\n2\tdef');
  assert.deepEqual(await doc(), beforeRefused, 'a refused paste changes nothing');
  assert.match(await alert(), /"abc" is not a number/);
  assert.equal(await dock.locator('td[aria-invalid="true"]').count(), 2, 'both bad cells are marked');
  // One value pasted over a selection fills it.
  await step('one value fills a selection', async () => { await cell(1, 1).click(); await page.keyboard.press('Shift+ArrowDown'); await page.keyboard.press('Shift+ArrowRight'); await paste('9'); }, current => JSON.stringify(chartData(current).rows.slice(0, 2).map(row => row.slice(1))) === '[[9,9],[9,9]]');
  // The paste box does the same for hosts and people without a clipboard.
  await step('the paste box', async () => {
    await dock.locator('summary', { hasText: 'Paste text' }).click();
    await dock.getByLabel('Text from a spreadsheet or CSV file').fill('Q1,100,50');
    await cell(1, 0).click();
    await dock.getByRole('button', { name: 'Paste at selected cell' }).click();
  }, current => JSON.stringify(chartData(current).rows[0]) === '["Q1",100,50]');
  await dock.locator('summary', { hasText: 'Paste text' }).click();
  mark('paste: TSV grows the grid, Excel quoting, decimal commas, refusal, fill, paste box');

  // --- copy --------------------------------------------------------------------------------------------------------
  await cell(1, 0).click();
  await page.keyboard.press('Shift+ArrowDown');
  await page.keyboard.press('Shift+ArrowRight');
  await page.keyboard.press('Shift+ArrowRight');
  const copied = await page.evaluate(() => {
    const data = new DataTransfer();
    const event = new ClipboardEvent('copy', { clipboardData: data, bubbles: true, cancelable: true });
    document.activeElement.dispatchEvent(event);
    return { text: data.getData('text/plain'), prevented: event.defaultPrevented };
  });
  assert.equal(copied.text, 'Q1\t12\t5\nQ2\t18\t', 'copy writes the selection as TSV, a gap as an empty cell');
  assert.equal(copied.prevented, true);
  assert.match(await status(), /Copied 2 rows by 3 columns/);
  // The real keys use the real clipboard: Ctrl+C writes TSV, Ctrl+V reads it.
  await page.evaluate(() => navigator.clipboard.writeText('stale'));
  await page.keyboard.press('Control+c');
  await page.waitForFunction(() => /Copied 2 rows/.test(document.querySelector('#data-grid-dock .opf-grid-status').textContent));
  assert.equal((await page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, '\n'), 'Q1\t12\t5\nQ2\t18\t', 'Ctrl+C puts the selection on the clipboard as TSV');
  await step('Ctrl+V pastes the clipboard', async () => {
    await cell(1, 1).click();
    await page.evaluate(() => navigator.clipboard.writeText('77\t88\n99\t\n'));
    await page.keyboard.press('Control+v');
  }, current => JSON.stringify(chartData(current).rows.slice(0, 2).map(row => row.slice(1))) === '[[77,88],[99,null]]');
  assert.equal(await dock.locator('.opf-grid-error').textContent(), '');
  // Cut copies and clears in one step.
  await step('cut clears the selection', async () => {
    await cell(1, 1).click();
    await page.keyboard.press('Shift+ArrowRight');
    const cut = await page.evaluate(() => { const data = new DataTransfer(); document.activeElement.dispatchEvent(new ClipboardEvent('cut', { clipboardData: data, bubbles: true, cancelable: true })); return data.getData('text/plain'); });
    assert.equal(cut, '12\t5');
  }, current => chartData(current).rows[0][1] === null && chartData(current).rows[0][2] === null);
  mark('copy writes TSV and cut clears in one step');

  // --- rows and columns through the toolbar ---------------------------------------------------------------------------
  const toolbarButton = name => dock.getByRole('button', { name, exact: true });
  await step('insert a chart row', async () => { await cell(2, 0).click(); await toolbarButton('Insert row above').click(); }, current => chartData(current).rows.length === 4 && chartData(current).rows[1].every(value => value === null) && chartData(current).rows[2][0] === 'Q2');
  await step('insert a row below', async () => { await cell(2, 0).click(); await toolbarButton('Insert row below').click(); }, current => chartData(current).rows[2].every(value => value === null) && chartData(current).rows[1][0] === 'Q2');
  await step('delete rows', async () => { await cell(2, 0).click(); await page.keyboard.press('Shift+ArrowDown'); await toolbarButton('Delete 2 rows').click(); }, current => chartData(current).rows.length === 1);
  await step('move a row down', async () => { await cell(1, 0).click(); await toolbarButton('Move row down').click(); }, current => chartData(current).rows.map(row => row[0]).join() === 'Q2,Q1,Q3');
  await step('move a row up', async () => { await cell(3, 0).click(); await toolbarButton('Move row up').click(); }, current => chartData(current).rows.map(row => row[0]).join() === 'Q1,Q3,Q2');
  assert.equal(await cell(1, 0).evaluate(node => node.parentElement.querySelector('th').textContent), '1');
  await cell(1, 0).click();
  assert.equal(await toolbarButton('Move row up').getAttribute('aria-disabled'), 'true', 'the first row cannot move up');
  assert.equal(await toolbarButton('Insert row above').getAttribute('aria-disabled'), 'false');
  await cell(0, 1).click();
  assert.equal(await toolbarButton('Insert row above').getAttribute('aria-disabled'), 'true', 'nothing is inserted above the header');
  await step('insert a series', async () => {
    await cell(1, 2).click();
    await toolbarButton('Insert column right').click();
    await dock.getByRole('textbox', { name: 'Edit Header, column D' }).waitFor();
    await page.keyboard.press('Escape');
  }, current => chartData(current).columns.join() === 'Quarter,Revenue,Costs,' && chartData(current).rows[0].length === 4 && chartData(current).rows[0][3] === null);
  // A new series starts unnamed with the name cell open, so it is named at once (a second undo step).
  await cell(1, 2).click();
  await toolbarButton('Insert column right').click();
  await page.keyboard.type('Margin');
  await page.keyboard.press('Enter');
  await waitDoc(current => chartData(current).columns.join() === 'Quarter,Revenue,Costs,Margin', 'the new series is named');
  assert.equal(await dock.getByRole('textbox').count(), 0);
  await button('Undo').click();
  await button('Undo').click();
  await waitDoc(current => JSON.stringify(chartData(current)) === JSON.stringify(source.slides[1].blocks[0].chart.data), 'both steps undone');
  await settle();
  await step('delete a column', async () => { await cell(1, 2).click(); await toolbarButton('Delete columns').click(); }, current => chartData(current).columns.join() === 'Quarter,Revenue');
  await step('move a column left', async () => { await cell(1, 2).click(); await toolbarButton('Move column left').click(); }, current => chartData(current).columns.join() === 'Quarter,Costs,Revenue' && chartData(current).rows[0].join() === 'Q1,5,12');
  await step('transpose', async () => { await toolbarButton('Swap rows and columns').click(); }, current => JSON.stringify(chartData(current)) === '{"columns":["Quarter","Q1","Q2","Q3"],"rows":[["Revenue",12,18,24],["Costs",5,null,9]]}');
  await step('sort descending', async () => { await cell(1, 1).click(); await toolbarButton('Sort Z to A').click(); }, current => chartData(current).rows.map(row => row[0]).join() === 'Q3,Q2,Q1');
  await step('sort ascending by a series with a gap', async () => { await cell(1, 2).click(); await toolbarButton('Sort A to Z').click(); }, current => chartData(current).rows.map(row => row[0]).join() === 'Q1,Q3,Q2');
  mark('rows, columns, transpose and sort through the toolbar');

  // Row and column headers select; a header click then an operation acts on the whole row.
  await dock.locator('tbody th', { hasText: /^2$/ }).click();
  assert.equal(await dock.locator('td[aria-selected="true"]').count(), 3, 'a row header selects the row');
  await dock.locator('thead th[data-column="1"]').click();
  assert.equal(await dock.locator('td[aria-selected="true"]').count(), 4, 'a column header selects the column');
  await dock.locator('thead th[data-ruler="corner"]').click();
  assert.equal(await dock.locator('td[aria-selected="true"]').count(), 12);
  await cell(1, 0).click();
  await cell(2, 1).click({ modifiers: ['Shift'] });
  assert.equal(await dock.locator('td[aria-selected="true"]').count(), 4, 'Shift+click extends');
  const box = await cell(1, 2).boundingBox();
  const box2 = await cell(3, 2).boundingBox();
  await page.mouse.move(box.x + 5, box.y + 5);
  await page.mouse.down();
  await page.mouse.move(box2.x + 5, box2.y + 5, { steps: 4 });
  await page.mouse.up();
  assert.equal(await dock.locator('td[aria-selected="true"]').count(), 3, 'dragging selects');
  mark('row and column headers, Shift+click and dragging select');

  // Number format: the same data reads and shows in either format.
  await dock.getByLabel('Number format').selectOption(',');
  await cell(1, 1).click();
  await page.keyboard.type('2,5');
  await page.keyboard.press('Enter');
  await waitDoc(current => chartData(current).rows[0][1] === 2.5, 'a decimal comma in the comma format');
  assert.equal(await cell(1, 1).textContent(), '2,5', 'the grid shows numbers in the chosen format');
  await dock.getByLabel('Number format').selectOption('.');
  assert.equal(await cell(1, 1).textContent(), '2.5');
  await button('Undo').click();
  await settle();
  mark('the number format decides how numbers are read and shown');

  // --- tables ---------------------------------------------------------------------------------------------------------------
  await selectTable();
  assert.equal(await dock.locator('.opf-grid-title strong').textContent(), 'Table data');
  assert.equal(await grid.getAttribute('aria-label'), 'Table data');
  assert.deepEqual(await dock.locator('thead th').evaluateAll(nodes => nodes.map(node => node.getAttribute('aria-label'))), ['Select all cells', 'Column A', 'Column B', 'Column C'], 'a table column has no chart role');
  assert.equal(await dock.getByLabel('Header row').isChecked(), true);
  await step('edit a table cell', async () => { await cell(1, 0).click(); await page.keyboard.type('Northwest'); await page.keyboard.press('Enter'); }, current => tableData(current).rows[0][0] === 'Northwest');
  await step('a canonical number becomes a number', async () => { await cell(1, 1).click(); await page.keyboard.type('11'); await page.keyboard.press('Enter'); }, current => tableData(current).rows[0][1] === 11);
  await step('table text stays text', async () => { await cell(1, 1).click(); await page.keyboard.type('011'); await page.keyboard.press('Enter'); }, current => tableData(current).rows[0][1] === '011');
  await step('insert a table row', async () => { await cell(2, 0).click(); await toolbarButton('Insert row below').click(); }, current => tableData(current).rows.length === 5 && tableData(current).rows[2].every(value => value === ''));
  await step('delete a table row', async () => { await cell(2, 0).click(); await toolbarButton('Delete rows').click(); }, current => tableData(current).rows.length === 3);
  await step('move a table row', async () => { await cell(1, 0).click(); await toolbarButton('Move row down').click(); }, current => tableData(current).rows.map(row => row[0]).join() === 'South,North,East,West');
  await step('insert a table column', async () => { await cell(1, 1).click(); await toolbarButton('Insert column left').click(); }, current => tableData(current).columns.length === 4 && tableData(current).columns[1] === '' && tableData(current).rows[0].length === 4);
  await step('move a table column', async () => { await cell(1, 0).click(); await toolbarButton('Move column right').click(); }, current => tableData(current).columns.join() === 'Q1,Region,Q2');
  await step('delete a table column', async () => { await cell(1, 2).click(); await toolbarButton('Delete columns').click(); }, current => tableData(current).columns.join() === 'Region,Q1');
  await step('sort a table by a number column', async () => { await cell(1, 2).click(); await toolbarButton('Sort Z to A').click(); }, current => tableData(current).rows.map(row => row[0]).join() === 'West,East,South,North' && tableData(current).rows.map(row => row[2]).join() === '8,6,4,2');
  await step('the header row off and on', async () => { await dock.getByLabel('Header row').uncheck(); }, current => tableData(current).columns === undefined && tableData(current).rows[0].join() === 'Region,Q1,Q2');
  await dock.getByLabel('Header row').uncheck();
  await waitDoc(current => tableData(current).columns === undefined, 'header off');
  assert.equal(await dock.locator('tbody th').first().textContent(), '1', 'with no header row, rows are numbered from the first');
  assert.equal(await dock.getByLabel('Header row').isChecked(), false);
  await dock.getByLabel('Header row').check();
  await waitDoc(current => tableData(current).columns?.join() === 'Region,Q1,Q2', 'header back on');
  await settle();
  assert.deepEqual((await doc()).slides[1].blocks[1].table, source.slides[1].blocks[1].table, 'off and on again restores the table');
  mark('table cells, rows, columns, sort and the header row');

  // --- merged cells ----------------------------------------------------------------------------------------------------------
  await slide(2);
  await closeGrid();
  await page.locator('#preview [data-canvas-target][data-opf-path^="slides.2.blocks.0.table"]').first().click();
  await openGrid();
  assert.equal(await dock.locator('td[rowspan="2"]').count(), 2, 'vertical merges draw with a row span');
  assert.equal(await dock.locator('td[colspan="2"]').count(), 2, 'column merges draw with a column span');
  assert.equal(await dock.locator('td[aria-rowspan="2"]').count(), 2, 'and expose aria-rowspan');
  assert.equal(await dock.locator('td[aria-colspan="2"]').count(), 2, 'and aria-colspan');
  assert.equal(await dock.locator('tbody tr').nth(2).locator('td').count(), 2, 'a covered cell is not drawn: the second row has the merge and two cells');
  assert.deepEqual(await texts(), [['Region', 'Quarters'], ['North', '1', '2'], ['3', '4'], ['East coast', 'block'], ['West']].map(row => row), 'covered positions have no cell');
  assert.equal(await cell(3, 0).locator('span').first().evaluate(node => getComputedStyle(node).fontWeight), '700', 'rich cells show their formatting');
  assert.equal(await cell(1, 0).evaluate(node => node.classList.contains('opf-grid-merged')), true);
  // Arrow keys step over a merge as one cell.
  await cell(1, 0).click();
  await page.keyboard.press('ArrowDown');
  assert.deepEqual(await active(), [3, 0], 'ArrowDown from a merged cell goes past it');
  await page.keyboard.press('ArrowUp');
  assert.deepEqual(await active(), [1, 0], 'and ArrowUp lands on the merge itself');
  await cell(1, 0).click();
  await page.keyboard.press('Shift+ArrowRight');
  assert.equal(await dock.locator('td[aria-selected="true"]').count(), 3, 'a selection that touches a merge takes the whole merge (the merged cell and the two cells beside it)');
  // Editing a rich cell keeps its runs.
  await step('editing a rich cell keeps its formatting', async () => { await cell(3, 0).click(); await page.keyboard.press('F2'); await page.keyboard.press('Control+a'); await page.keyboard.type('East shore'); await page.keyboard.press('Enter'); }, current => JSON.stringify(current.slides[2].blocks[0].table.rows[2][0]) === '["East ",{"text":"shore","bold":true}]');
  // Operations keep merges whole.
  await step('a row inserted inside a merge grows it', async () => { await cell(1, 1).click(); await toolbarButton('Insert row below').click(); }, current => current.slides[2].blocks[0].table.rows[0][0].rowSpan === 3);
  await step('a row deleted from a merge shrinks it', async () => { await cell(2, 1).click(); await toolbarButton('Delete rows').click(); }, current => current.slides[2].blocks[0].table.rows[0][0] === 'North' && current.slides[2].blocks[0].table.rows.length === 3);
  const mergeBefore = await doc();
  await cell(1, 0).click();
  await toolbarButton('Move row down').click();
  assert.match(await alert(), /Split the merged cells first/, 'a move that would break a merge says why');
  assert.deepEqual(await doc(), mergeBefore, 'and changes nothing');
  await cell(1, 0).click();
  await paste('a\nb');
  assert.match(await alert(), /covered by a merged cell/, 'a paste across covered cells is refused');
  assert.deepEqual(await doc(), mergeBefore);
  mark('merged cells draw with spans, keyboard steps over them, and operations keep them whole or say why not');

  // A chart whose shared dataset is missing is an invalid document (FA-07), so it cannot be loaded here; test/data-grid.mjs covers its explanation.

  // --- accessibility -------------------------------------------------------------------------------------------------------------------
  await slide(1);
  await selectChart();
  // Every control is reachable and named; the toolbar is one tab stop with arrow keys; Tab leaves the grid (no trap).
  const names = await dock.locator('.opf-grid-toolbar button').evaluateAll(nodes => nodes.map(node => node.getAttribute('aria-label') || node.textContent.trim()).filter(Boolean));
  assert.ok(names.length >= 12 && names.every(name => name.length > 2), `every toolbar button has a name: ${names}`);
  assert.equal(await dock.locator('.opf-grid-toolbar button[tabindex="0"]').count(), 1, 'the toolbar is a single tab stop');
  await dock.locator('.opf-grid-toolbar button[tabindex="0"]').focus();
  await page.keyboard.press('Home');
  assert.equal(await page.evaluate(() => document.activeElement.dataset.action), 'insert-row-above', 'Home goes to the first button');
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.evaluate(() => document.activeElement.dataset.action), 'insert-row-below', 'arrow keys move along the toolbar');
  await page.keyboard.press('End');
  assert.equal(await page.evaluate(() => document.activeElement.dataset.action), 'copy');
  await page.keyboard.press('Home');
  assert.equal(await page.evaluate(() => document.activeElement.dataset.action), 'insert-row-above');
  // A toolbar button works from the keyboard: Enter on "Insert row below" with a cell selected.
  await cell(1, 0).click();
  await toolbarButton('Insert row below').focus();
  await page.keyboard.press('Enter');
  await waitDoc(current => chartData(current).rows.length === 4, 'Enter on a toolbar button inserts');
  assert.equal(await page.evaluate(() => document.activeElement.dataset.action), 'insert-row-below', 'the focus stays on the button');
  assert.match(await status(), /Inserted 1 row below/);
  await page.keyboard.press('Control+z');
  await waitDoc(current => chartData(current).rows.length === 3, 'undone');
  await settle();
  await cell(1, 1).focus();
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement.closest('table') === null), true, 'Tab leaves the grid: no keyboard trap');
  await page.keyboard.press('Shift+Tab');
  assert.equal(await page.evaluate(() => document.activeElement.matches('td.opf-grid-active')), true, 'Shift+Tab returns to the active cell');
  // Focus is visible: the active cell and the editor have an outline; selected cells differ from unselected ones without relying on colour alone.
  const outline = await cell(1, 1).evaluate(node => { const style = getComputedStyle(node); return [style.outlineStyle, parseFloat(style.outlineWidth)]; });
  assert.deepEqual([outline[0], outline[1] >= 2], ['solid', true], 'the active cell has a visible focus outline');
  // Contrast of the text against its background is at least 4.5:1 for cells, headers and notes.
  const contrast = await page.evaluate(() => {
    const luminance = ([r, g, b]) => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
    const parse = color => color.match(/[\d.]+/g).map(Number);
    const ratio = (a, b) => { const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
    const results = {};
    for (const [name, selector] of [['cell', 'td[data-line="1"][data-column="0"]'], ['header cell', 'td[data-line="0"][data-column="0"]'], ['column ruler', 'thead th[data-column="0"]'], ['row ruler', 'tbody th'], ['button', '.opf-grid-toolbar button']]) {
      const node = document.querySelector(`#data-grid-dock ${selector}`);
      const style = getComputedStyle(node);
      let background = parse(style.backgroundColor);
      if (background.length === 4 && background[3] === 0) background = [255, 255, 255];
      results[name] = ratio(parse(style.color).slice(0, 3), background.slice(0, 3));
    }
    const selected = document.querySelector('#data-grid-dock td[aria-selected="true"]');
    results.selected = ratio(parse(getComputedStyle(selected).color).slice(0, 3), parse(getComputedStyle(selected).backgroundColor).slice(0, 3));
    return results;
  });
  for (const [name, value] of Object.entries(contrast)) assert.ok(value >= 4.5, `${name} text has contrast ${value.toFixed(2)}:1, at least 4.5:1`);
  // Forced colors: selection and focus keep an outline of their own.
  await page.emulateMedia({ forcedColors: 'active' });
  const forced = await cell(1, 1).evaluate(node => getComputedStyle(node).outlineStyle);
  assert.notEqual(forced, 'none', 'the active cell keeps an outline in forced colors');
  await page.emulateMedia({ forcedColors: 'none' });
  // Reflow at a phone width: the page does not scroll sideways; the grid scrolls inside its own area.
  await page.setViewportSize({ width: 360, height: 800 });
  await page.waitForTimeout(100);
  const overflow = await page.evaluate(() => ({ page: document.documentElement.scrollWidth - document.documentElement.clientWidth, grid: document.querySelector('#data-grid-dock .opf-grid-scroll').scrollWidth - document.querySelector('#data-grid-dock .opf-grid-scroll').clientWidth }));
  assert.ok(overflow.page <= 1, `the page has no horizontal overflow at 360 px (${overflow.page})`);
  assert.equal(await dock.locator('.opf-grid-scroll').evaluate(node => getComputedStyle(node).overflowX), 'auto', 'the grid scrolls inside its own area');
  await page.setViewportSize({ width: 1440, height: 1100 });
  mark('accessibility: names, one tab stop per toolbar, no keyboard trap, visible focus, contrast, forced colors, reflow');

  assert.deepEqual(errors, []);
  console.log(`Data grid (browser): ${checks.length} checks. ${checks.join('; ')}.`);
} finally {
  await browser?.close();
  server.close();
}
