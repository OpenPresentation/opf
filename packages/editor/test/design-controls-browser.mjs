import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

// RR-06 in a real browser, on the built playground (npm run build:playground). Every gallery
// dimension, every design option, content-type conversion, chart type and table style/merge has a
// control; each commits one undoable change that redraws the preview; the controls work from the
// keyboard and carry accessible names; and one click on text still starts text editing.
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
  name: 'Design controls',
  language: 'english',
  narrative: 'problem-solution',
  tone: 'formal',
  audience: ['executives'],
  speaker: { id: 'alice', name: 'Alice Chen' },
  organization: { id: 'acme', name: 'Acme' },
  assets: { logo: PIXEL, mark: PIXEL, photo: PIXEL },
  design: { theme: 'classic', fontScheme: 'roboto' },
  slides: [
    { id: 'cover', title: 'Quarterly review', subtitle: 'Design controls' },
    { id: 'body', title: 'Body', blocks: [{ text: 'First line\nSecond line' }, { items: ['One', 'Two'] }, { metric: { value: 42, label: 'Retention' } }] },
    { id: 'data', title: 'Data', blocks: [
      { chart: { type: 'column', data: { columns: ['Quarter', 'Revenue'], rows: [['Q1', 12], ['Q2', 18]] } } },
      { table: { columns: ['Region', 'Q1', 'Q2'], rows: [['north', 'b', 'c'], ['d', '', '']] } },
    ] },
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
  const settle = () => page.waitForFunction(() => !/Loading fonts/.test(document.querySelector('#status').textContent) && !document.querySelector('#preview')?.textContent.includes('Loading fonts'), undefined, { timeout: 60000 }).catch(async timeout => { throw new Error(`Fonts never settled: ${await page.locator('#status').textContent()} | ${errors.join(' | ')}`, { cause: timeout }); });
  const preview = () => page.locator('#preview svg').first().evaluate(node => node.outerHTML);
  const waitDoc = async (predicate, message) => {
    const started = Date.now();
    for (;;) {
      const current = await doc();
      if (predicate(current)) return current;
      if (Date.now() - started > 8000) assert.fail(`${message}: ${JSON.stringify(current).slice(0, 300)}`);
      await page.waitForTimeout(40);
    }
  };
  // A label, optionally followed by the panel's note such as " (set on this slide)".
  const escapeRegExp = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const label = text => new RegExp('^' + escapeRegExp(text) + '(?: \\(|$)');
  const field = (scope, text) => scope.getByLabel(label(text));
  const openAll = () => page.evaluate(() => document.querySelectorAll('.opf-dc-group').forEach(details => { details.open = true; }));
  const slide = async index => { await page.locator('#slide-list button').nth(index).click(); await page.waitForFunction(i => document.querySelector('#slide-list').children[i].getAttribute('aria-current') === 'true', index); await settle(); };
  const status = () => page.locator('.opf-dc-status').evaluateAll(nodes => nodes.map(node => node.textContent).join(' '));
  const error = () => page.locator('.opf-dc-error').evaluateAll(nodes => nodes.map(node => node.textContent).join(' '));
  const mark = name => checks.push(name);

  await page.goto(`http://127.0.0.1:${server.address().port}/index.html`);
  await page.locator('#preview svg').waitFor();
  await button('Source').click();
  await page.locator('#json').fill(JSON.stringify(source));
  await page.waitForFunction(() => !document.querySelector('#apply-json').disabled && !document.querySelector('#json-error').textContent);
  await button('Apply changes').click();
  await page.locator('#preview [data-canvas-target][data-opf-path="slides.0.title"]').waitFor();
  await settle();
  assert.deepEqual(await doc(), source);

  // One step in, one step out: perform, check the document, then Undo restores the whole document and Redo returns it.
  async function step(name, action, predicate, { preview: expectPreview = false } = {}) {
    const before = await doc();
    const beforeSvg = await preview();
    await action();
    const after = await waitDoc(predicate, name);
    await settle();
    assert.notDeepEqual(after, before, `${name} changed the document`);
    if (expectPreview) await page.waitForFunction(previous => document.querySelector('#preview svg')?.outerHTML !== previous, beforeSvg, { timeout: 8000 }).catch(() => assert.fail(`${name}: the preview did not change`));
    await button('Undo').click();
    await waitDoc(current => JSON.stringify(current) === JSON.stringify(before), `${name}: one Undo restores the document`);
    await settle();
    await button('Redo').click();
    await waitDoc(current => JSON.stringify(current) === JSON.stringify(after), `${name}: Redo returns the change`);
    await settle();
    // Leave the document as it was so steps stay independent.
    await button('Undo').click();
    await waitDoc(current => JSON.stringify(current) === JSON.stringify(before), `${name}: reset`);
    await settle();
    mark(name);
    return after;
  }

  // --- the Design tab ---------------------------------------------------------------------------------
  await page.locator('#tab-design').click();
  assert.ok(await design.locator('details.opf-dc-group').count() >= 6, 'the design groups render');

  // Keyboard: a group's summary opens and closes with Enter and Space; controls follow in Tab order.
  const lookGroup = design.locator('details[data-section="look"]');
  const lookSummary = lookGroup.locator('summary');
  await lookSummary.focus();
  await page.keyboard.press('Enter');
  assert.equal(await lookGroup.evaluate(node => node.open), false, 'Enter closes an open group');
  await page.keyboard.press('Space');
  assert.equal(await lookGroup.evaluate(node => node.open), true, 'Space opens it again');
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement.id && document.activeElement.labels?.[0]?.textContent), 'Theme', 'Tab from the summary reaches the first control');
  mark('group summary and Tab order work from the keyboard');
  await openAll();

  // Every form control has an accessible name.
  const unlabeled = await page.evaluate(() => [...document.querySelectorAll('#design-controls select, #design-controls input, #selection-controls select, #selection-controls input')].filter(node => !node.labels?.length).map(node => node.id || node.outerHTML.slice(0, 80)));
  assert.deepEqual(unlabeled, [], 'every control is labelled');
  mark('every design control is labelled');

  // Keyboard-only change: ArrowDown on a focused select changes it and commits one undoable change.
  {
    const themeSelect = field(design, 'Theme');
    await themeSelect.focus();
    const before = await doc();
    await page.keyboard.press('ArrowDown');
    const after = await waitDoc(current => current.design.theme !== before.design.theme, 'keyboard theme change');
    assert.equal(after.design.theme, 'dark', 'the next theme in the list');
    await settle();
    await button('Undo').click();
    await waitDoc(current => JSON.stringify(current) === JSON.stringify(before), 'keyboard theme change undone');
    await settle();
    mark('a select changes the theme from the keyboard');
  }

  // The 14 gallery dimensions, each from its control.
  await step('themes', () => field(design, 'Theme').selectOption('dark'), current => current.design.theme === 'dark' && current.design.colorScheme !== undefined, { preview: true });
  // The chart slide shows scheme colors; the cover only uses the theme.
  await slide(2);
  await step('color-schemes', () => field(design, 'Color scheme').selectOption('forest-green'), current => current.design.colorScheme === 'forest-green', { preview: true });
  await slide(0);
  await step('font-schemes', () => field(design, 'Font scheme').selectOption('georgia'), current => current.design.fontScheme === 'georgia', { preview: true });
  await step('languages', () => field(design, 'Language').selectOption('japanese'), current => current.language === 'japanese');
  await step('backgrounds (theme slot)', () => field(design, 'Background').selectOption('dark1'), current => current.design.background === 'dark1', { preview: true });
  await step('backgrounds (hex)', async () => { const input = field(design, 'Background color \(hex\)'); await input.fill('#1f2937'); await input.press('Enter'); }, current => current.design.background === '#1F2937', { preview: true });
  await step('layouts', () => field(design, 'Layout of this slide').selectOption('text-2x'), current => current.slides[0].layout === 'text-2x', { preview: true });
  await step('narratives', () => field(design, 'Narrative').selectOption('scqa'), current => current.narrative === 'scqa');
  await step('tones', () => field(design, 'Tone').selectOption('casual'), current => current.tone === 'casual');
  await step('audiences', () => field(design, 'Audience').selectOption(['executives', 'investors']), current => JSON.stringify(current.audience) === '["executives","investors"]');
  await step('socials', async () => { await field(design, 'Platform').selectOption('linkedin'); const input = field(design, 'Handle or address'); await input.fill('alice-chen'); await input.press('Enter'); }, current => current.speaker.socials?.linkedin === 'alice-chen');
  await step('headers-footers', async () => { const input = field(design, 'Center text').first(); await input.fill('Confidential'); await input.press('Enter'); }, current => JSON.stringify(current.design.footer ?? current.design.header ?? {}).includes('Confidential'));
  await step('image-treatments (slide image)', () => field(design, 'Position').selectOption('right'), current => current.design.slideImage?.position === 'right');
  await step('picture placeholder fill', () => field(design, 'Picture placeholders').selectOption('fit'), current => current.design.imageFill === 'fit');

  // Per-slide scope: the same controls write the slide, not the deck.
  await slide(1);
  await field(design, 'Applies to').selectOption('slide');
  await step('slide-scope font scheme', () => field(design, 'Font scheme').selectOption('georgia'), current => current.slides[1].design?.fontScheme === 'georgia' && current.design.fontScheme === 'roboto', { preview: true });
  await step('slide-scope title alignment', () => field(design, 'Title alignment').selectOption('center'), current => current.slides[1].design?.titleAlignment === 'center' && current.design.titleAlignment === undefined);
  // A slide's own footer replaces the deck's whole footer, so the first slide edit starts from a copy of it.
  await field(design, 'Applies to').selectOption('deck');
  const footerCenter = design.getByLabel(label('Center text')).nth(1);
  await footerCenter.fill('Confidential');
  await footerCenter.press('Enter');
  await waitDoc(current => current.design.footer?.center?.text === 'Confidential', 'deck footer for the slide-scope checks');
  await settle();
  assert.equal(await design.getByLabel('Hide the footer').isVisible(), false, 'hiding is not offered at the deck while the footer shows');
  await field(design, 'Applies to').selectOption('slide');
  await step('slide-scope footer keeps the deck zones', () => design.getByLabel('Right: show the slide number').nth(1).check(), current => current.slides[1].design?.footer?.center?.text === 'Confidential' && current.slides[1].design.footer.right?.slideNumber === true && current.design.footer.right === undefined);
  await step('hide the footer on one slide', () => design.getByLabel('Hide the footer').check(), current => current.slides[1].design?.footer === false && current.design.footer.center.text === 'Confidential');
  await field(design, 'Applies to').selectOption('deck');
  await button('Undo').click();
  await waitDoc(current => current.design.footer === undefined, 'deck footer removed again');
  await settle();
  await field(design, 'Applies to').selectOption('slide');
  assert.match(await field(design, 'Applies to').evaluate(node => node.selectedOptions[0].textContent), /slide 2/);
  await field(design, 'Applies to').selectOption('deck');
  await slide(0);

  // Design options.
  await step('title alignment', () => field(design, 'Title alignment').selectOption('right'), current => current.design.titleAlignment === 'right', { preview: true });
  await step('content alignment', () => field(design, 'Content alignment').selectOption('center'), current => current.design.contentAlignment === 'center');
  await step('content direction', () => field(design, 'Content direction').selectOption('vertical'), current => current.design.contentDirection === 'vertical');
  await step('primary chart position', () => field(design, 'Primary chart position').selectOption('left'), current => current.design.chartPrimary === 'left');
  await step('content box', () => field(design, 'Content box').selectOption('yes'), current => current.design.contentBox === true);
  await step('accent font', async () => { const input = field(design, 'Accent font'); await input.fill('Georgia'); await input.press('Enter'); }, current => current.design.fontScheme?.accent?.family === 'Georgia');
  {
    const before = await doc();
    const accent = field(design, 'Accent font');
    await accent.fill('Georgia');
    await accent.press('Enter');
    await waitDoc(current => current.design.fontScheme?.accent?.family === 'Georgia', 'accent font for the Typography check');
    await settle();
    assert.equal(await page.locator('#font').inputValue(), 'roboto', 'the Typography select shows the scheme id');
    await page.locator('#font').selectOption('calibri');
    await waitDoc(current => current.design.fontScheme?.id === 'calibri' && current.design.fontScheme.accent?.family === 'Georgia', 'the Typography select keeps the accent font');
    await settle();
    await field(design, 'Font scheme').selectOption('georgia');
    await waitDoc(current => current.design.fontScheme?.id === 'georgia' && current.design.fontScheme.accent?.family === 'Georgia', 'a font scheme switch keeps the accent font');
    await settle();
    await button('Undo').click();
    await button('Undo').click();
    await button('Undo').click();
    await waitDoc(current => JSON.stringify(current) === JSON.stringify(before), 'accent checks undone');
    await settle();
    mark('an accent font survives font scheme changes');
  }
  await step('logo', async () => { const input = field(design, 'Logo source'); await input.fill('asset:logo'); await input.press('Enter'); }, current => current.design.logo === 'asset:logo');
  await step('logo variant', async () => { await field(design, 'Logo variant').selectOption('light'); const input = field(design, 'Logo source'); await input.fill('asset:mark'); await input.press('Enter'); }, current => current.design.logo?.light === 'asset:mark');
  await field(design, 'Logo variant').selectOption('default');
  await step('organization logo', async () => { const input = field(design, 'Organization logo \(whole presentation\)'); await input.fill('asset:logo'); await input.press('Enter'); }, current => current.organization.logo === 'asset:logo');
  assert.equal(await field(design, 'Watermark opacity (0 to 1)').isDisabled(), true, 'the opacity waits for a watermark image');
  await step('watermark', async () => { const input = field(design, 'Watermark image'); await input.fill('asset:mark'); await input.press('Enter'); }, current => current.design.watermark === 'asset:mark', { preview: true });
  await field(design, 'Watermark image').fill('asset:mark');
  await field(design, 'Watermark image').press('Enter');
  await waitDoc(current => current.design.watermark === 'asset:mark', 'watermark source');
  await step('watermark opacity', async () => { const opacity = field(design, 'Watermark opacity (0 to 1)'); await opacity.fill('0.3'); await opacity.press('Enter'); }, current => current.design.watermark?.opacity === 0.3);
  await button('Undo').click();
  await waitDoc(current => current.design.watermark === undefined, 'watermark removed again');
  await settle();
  // Picture bullets need a logo: without one the panel says so before export.
  await step('picture bullets', () => field(design, 'List bullets').selectOption('image'), current => current.design.listBullet === 'image');
  assert.match(await error() + await status(), /Picture bullets use the logo/, 'picture bullets without a logo are explained');
  await page.locator('#design-controls .opf-dc-warnings').first().waitFor({ state: 'attached' });
  mark('picture bullets warn when no logo is set');
  // Header and footer zones, with the logo warning.
  await step('footer logo zone', async () => { await design.getByLabel('Left: show the logo').first().check(); }, current => JSON.stringify(current.design.header ?? {}).includes('"logo":true') || JSON.stringify(current.design.footer ?? {}).includes('"logo":true'));
  await step('footer slide number', async () => { await design.getByLabel('Right: show the slide number').nth(1).check(); }, current => current.design.footer?.right?.slideNumber === true);

  // Slide image fields appear once a position is set and write the same object.
  await field(design, 'Position').selectOption('left');
  await waitDoc(current => current.design.slideImage?.position === 'left', 'slide image position');
  await step('slide image source', async () => { const input = field(design, 'Image source'); await input.fill('asset:photo'); await input.press('Enter'); }, current => current.design.slideImage?.src === 'asset:photo');
  await step('slide image size', async () => { const input = field(design, 'Size \(share of the slide, 0.1 to 0.9\)'); await input.fill('0.4'); await input.press('Enter'); }, current => current.design.slideImage?.size === 0.4);
  await step('slide image shape', () => field(design, 'Shape').selectOption('circle'), current => current.design.slideImage?.shape === 'circle');
  await step('slide image removed', () => field(design, 'Position').selectOption(''), current => current.design.slideImage === undefined);
  // Bad input is explained and changes nothing.
  {
    const before = await doc();
    const input = field(design, 'Watermark opacity \(0 to 1\)');
    await field(design, 'Watermark image').fill('asset:mark');
    await field(design, 'Watermark image').press('Enter');
    await waitDoc(current => current.design.watermark === 'asset:mark', 'watermark for the opacity check');
    await input.fill('5');
    await input.press('Enter');
    await page.waitForFunction(() => /opacity/i.test(document.querySelector('#design-controls .opf-dc-error').textContent));
    assert.equal((await doc()).design.watermark, 'asset:mark', 'an invalid opacity is not applied');
    assert.equal(await input.inputValue(), '', 'the field returns to the document value');
    await button('Undo').click();
    await waitDoc(current => JSON.stringify(current) === JSON.stringify(before), 'reset after bad input');
    await settle();
    mark('invalid input is explained and not applied');
  }

  // --- the Content tab -------------------------------------------------------------------------------
  await slide(1);
  await page.locator('#tab-content').click();
  // One click on text still starts text editing with the caret where you clicked (the textEntry default).
  const firstText = page.locator('#preview [data-canvas-target][data-opf-path="slides.1.blocks.0.text"]');
  await firstText.click();
  const inline = page.getByRole('textbox', { name: /^Edit .* inline$/ });
  await inline.waitFor();
  assert.equal(await page.evaluate(() => document.activeElement.className), 'opf-inline-input', 'one click enters text editing');
  mark('one click on text still enters editing');
  await page.keyboard.press('Escape');
  await selection.getByLabel(label('Content type')).waitFor();
  assert.match(await selection.locator('[data-role="selection-summary"]').textContent(), /Text block \(slides\.1\.blocks\.0\)/);

  // Conversion: options say what is lost; unavailable ones are explained; the change keeps the text.
  const targets = await selection.getByLabel(label('Content type')).locator('option').evaluateAll(options => options.map(option => [option.value, option.textContent, option.disabled]));
  assert.deepEqual(targets.map(entry => entry[0]), ['', 'list', 'quote', 'metric', 'code', 'timeline']);
  await step('block conversion text to list', () => selection.getByLabel(label('Content type')).selectOption('list'), current => JSON.stringify(current.slides[1].blocks[0]) === '{"items":["First line","Second line"]}', { preview: true });
  // Keyboard-only conversion: focus the select and press ArrowDown (the first target is the list).
  {
    const before = await doc();
    const type = selection.getByLabel(label('Content type'));
    await type.focus();
    await page.keyboard.press('ArrowDown');
    await waitDoc(current => current.slides[1].blocks[0].items !== undefined, 'keyboard conversion');
    await settle();
    await button('Undo').click();
    await waitDoc(current => JSON.stringify(current) === JSON.stringify(before), 'keyboard conversion undone');
    await settle();
    mark('block conversion works from the keyboard');
  }
  // A list converted to a timeline is announced with what it keeps.
  await slide(1);
  const itemsBlock = page.locator('#preview [data-canvas-target][data-opf-path^="slides.1.blocks.1"]').first();
  await itemsBlock.click({ position: { x: 4, y: 4 } });
  await page.keyboard.press('Escape');
  await selection.getByLabel(label('Content type')).selectOption('timeline');
  await waitDoc(current => Array.isArray(current.slides[1].blocks[1].timeline), 'list to timeline');
  assert.match(await status(), /Converted to timeline\. Nothing was lost\./);
  await button('Undo').click();
  await settle();
  // Replacement is separate and says the old content is discarded.
  await step('block replacement', () => selection.getByLabel(label('Replace with new content')).selectOption('quote'), current => current.slides[1].blocks[1].quote?.text === 'Add a quotation');
  // A metric cannot become a list: it is not offered, and the panel says why only where a pair exists.
  const metric = page.locator('#preview [data-canvas-target][data-opf-path^="slides.1.blocks.2"]').first();
  await metric.click({ position: { x: 4, y: 4 } });
  await page.keyboard.press('Escape');
  assert.deepEqual(await selection.getByLabel(label('Content type')).locator('option').evaluateAll(options => options.map(option => option.value)), ['', 'text']);
  mark('only meaningful conversions are offered');

  // Chart type: only types the data can use; then a table style and merge.
  await slide(2);
  await page.locator('#preview [data-canvas-target][data-opf-path="slides.2.blocks.0.chart"]').click();
  await selection.getByLabel(label('Chart type')).waitFor();
  const chartTypes = await selection.getByLabel(label('Chart type')).locator('option').evaluateAll(options => options.map(option => option.value));
  assert.ok(chartTypes.includes('line') && chartTypes.includes('pie') && !chartTypes.includes('stacked-column-3x') && !chartTypes.includes('world'), 'chart types follow the data');
  await step('charts', () => selection.getByLabel(label('Chart type')).selectOption('line'), current => current.slides[2].blocks[0].chart.type === 'line', { preview: true });
  await step('chart to table conversion', () => selection.getByLabel(label('Content type')).selectOption('table'), current => current.slides[2].blocks[0].table?.columns?.[0] === 'Quarter');

  // Table: select a cell (one click edits it; Escape keeps it selected), then style and merge.
  const cell = path => page.locator(`#preview [data-canvas-target][data-opf-path="slides.2.blocks.1.table.${path}"]`);
  await cell('rows.1.0').click();
  await page.keyboard.press('Escape');
  await selection.getByLabel(label('Header row')).waitFor();
  assert.match(await selection.locator('[data-role="cell-summary"]').textContent(), /Row 2, column 1/);
  await step('table header style', () => selection.getByLabel(label('Header row')).selectOption('plain'), current => current.slides[2].blocks[1].table.columns[0].style?.fill === 'surface', { preview: true });
  await step('table banded rows', () => selection.getByLabel('Banded rows').check(), current => current.slides[2].blocks[1].table.rows[1][0].style?.fill === 'background', { preview: true });
  await step('table borders', () => selection.getByLabel(label('Borders')).selectOption('none'), current => current.slides[2].blocks[1].table.rows[0][0].style?.borders?.top?.width === 0, { preview: true });
  await selection.getByLabel(label('Borders')).selectOption('grid');
  await waitDoc(current => current.slides[2].blocks[1].table.rows[0][0].style?.borders?.left?.width === 1, 'grid borders');
  await settle();
  await step('table style reset', () => selection.getByRole('button', { name: 'Reset table style' }).click(), current => !JSON.stringify(current.slides[2].blocks[1].table).includes('style'), { preview: true });
  await button('Undo').click();
  await waitDoc(current => !JSON.stringify(current.slides[2].blocks[1].table).includes('style'), 'grid undone');
  await settle();
  // Merge the empty cells next to "d" (the cell stays selected); Split puts them back.
  await selection.getByLabel(label('Columns to merge')).fill('3');
  await step('table merge', () => selection.getByRole('button', { name: 'Merge cells' }).click(), current => JSON.stringify(current.slides[2].blocks[1].table.rows[1]) === '[{"value":"d","colSpan":3},null,null]', { preview: true });
  await selection.getByLabel(label('Columns to merge')).fill('3');
  await selection.getByRole('button', { name: 'Merge cells' }).click();
  await waitDoc(current => current.slides[2].blocks[1].table.rows[1][0].colSpan === 3, 'merged for the split step');
  await settle();
  assert.match(await selection.locator('[data-role="cell-summary"]').textContent(), /merged 3 by 1/);
  await step('table split', () => selection.getByRole('button', { name: 'Split cell' }).click(), current => JSON.stringify(current.slides[2].blocks[1].table.rows[1]) === '["d","",""]', { preview: true });
  await button('Undo').click();
  await waitDoc(current => JSON.stringify(current.slides[2].blocks[1].table.rows[1]) === '["d","",""]', 'merge undone');
  await settle();
  // Merging cells that hold text is refused with an explanation; keeping the text is an explicit choice.
  await cell('rows.0.0').click();
  await page.keyboard.press('Escape');
  await selection.getByLabel(label('Columns to merge')).fill('2');
  const beforeRefusal = await doc();
  await selection.getByRole('button', { name: 'Merge cells' }).click();
  await page.waitForFunction(() => /hide text/.test(document.querySelector('#selection-controls .opf-dc-error').textContent));
  assert.deepEqual(await doc(), beforeRefusal, 'a merge that would hide text changes nothing');
  await step('table merge keeping text', async () => { await selection.getByLabel('Keep text from the merged cells').check(); await selection.getByRole('button', { name: 'Merge cells' }).click(); }, current => JSON.stringify(current.slides[2].blocks[1].table.rows[0][0]) === '{"value":"north b","colSpan":2}');
  mark('a merge never hides text unless asked to keep it');

  // The controls follow Undo and Redo done elsewhere: the theme select shows the document, not its last click.
  await page.locator('#tab-design').click();
  await field(design, 'Theme').selectOption('bold');
  await waitDoc(current => current.design.theme === 'bold', 'theme for the follow check');
  await button('Undo').click();
  await waitDoc(current => current.design.theme === 'classic', 'theme undone');
  assert.equal(await field(design, 'Theme').inputValue(), 'classic', 'the control follows Undo');
  mark('controls follow Undo and Redo');

  assert.deepEqual(errors, []);
  console.log(`Design controls (browser): ${checks.length} checks. ${checks.join('; ')}.`);
} finally {
  await browser?.close();
  server.close();
}
