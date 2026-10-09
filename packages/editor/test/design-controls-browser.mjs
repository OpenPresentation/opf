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
  language: 'en-US',
  narrative: 'problem-solution',
  tone: 'formal',
  audience: ['executive'],
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
    // RR-26: a group of metrics, an image block and two blocks that can be placed in regions.
    { id: 'kpis', title: 'KPIs', blocks: [{ metric: { value: 42, label: 'Retention' } }, { metric: { value: '$1.2M', label: 'Revenue' } }] },
    { id: 'media', title: 'Media', blocks: [{ image: { src: 'asset:photo', alt: 'A pixel' } }, { text: 'Caption' }] },
    { id: 'cols', title: 'Columns', blocks: [{ text: 'Left text' }, { items: ['Right'] }] },
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
  // Keyboard-only change of a focused, closed <select> to its next option. ArrowDown steps the value on Linux and
  // Windows; Chromium on macOS follows the platform convention and opens the popup instead (which headless cannot
  // drive), so there the next option's label is typed (type-ahead changes a closed select on every platform).
  const keyNextOption = async select => {
    await select.focus();
    if (process.platform !== 'darwin') return page.keyboard.press('ArrowDown');
    const next = await select.evaluate(node => [...node.options].slice(node.selectedIndex + 1).find(option => !option.disabled)?.textContent.trim());
    assert.ok(next, 'the select has a next option');
    await page.keyboard.type(next.split(/\s/)[0]);
  };

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

  // Keyboard-only change: the next option from the keyboard changes a focused select and commits one undoable change.
  {
    const before = await doc();
    await keyNextOption(field(design, 'Theme'));
    const after = await waitDoc(current => current.design.theme !== before.design.theme, 'keyboard theme change');
    assert.equal(after.design.theme, 'dark', 'the next theme in the list');
    await settle();
    await button('Undo').click();
    await waitDoc(current => JSON.stringify(current) === JSON.stringify(before), 'keyboard theme change undone');
    await settle();
    mark('a select changes the theme from the keyboard');
  }

  // The 14 gallery dimensions, each from its control.
  // OPF 0.15: a theme brings its own schemes, so the deck's font scheme override is removed rather than a copy being written.
  await step('themes', () => field(design, 'Theme').selectOption('dark'), current => current.design.theme === 'dark' && current.design.fontScheme === undefined && current.design.colorScheme === undefined, { preview: true });
  // The chart slide shows scheme colors; the cover only uses the theme.
  await slide(2);
  await step('color-schemes', () => field(design, 'Color scheme').selectOption('forest-green'), current => current.design.colorScheme === 'forest-green', { preview: true });
  await slide(0);
  await step('font-schemes', () => field(design, 'Font scheme').selectOption('georgia'), current => current.design.fontScheme === 'georgia', { preview: true });
  await step('languages', () => field(design, 'Language').selectOption('ja'), current => current.language === 'ja');
  const applyBackground = async fill => { await fill(); await design.getByRole('button', { name: 'Apply background' }).click(); };
  await step('backgrounds (theme slot)', () => applyBackground(async () => { await field(design, 'Background type').selectOption('theme'); await field(design, 'Theme slot').selectOption('dark1'); }), current => current.design.background === 'dark1', { preview: true });
  await step('backgrounds (hex)', () => applyBackground(async () => { await field(design, 'Background type').selectOption('solid'); await field(design, 'Color').fill('#1f2937'); }), current => current.design.background === '#1F2937', { preview: true });
  // FA-22: the flat image background with fit, focus, alt and overlay.
  await step('backgrounds (image)', () => applyBackground(async () => {
    await field(design, 'Background type').selectOption('image');
    await field(design, 'Fit').selectOption('stretch');
    await field(design, 'Background alt text').fill('A pixel backdrop');
    await field(design, 'Focus down (0 top to 1 bottom)').fill('0.7');
    await field(design, 'Overlay color').fill('dark1');
    await field(design, 'Overlay opacity (0 to 1)').fill('0.4');
    // The source last: leaving it applies the image with the settings above (Apply then has nothing left to change).
    await field(design, 'Background image source').fill('asset:photo');
  }), current => JSON.stringify(current.design.background) === JSON.stringify({ type: 'image', src: 'asset:photo', alt: 'A pixel backdrop', fit: 'stretch', focus: { x: 0.5, y: 0.7 }, overlay: { color: 'dark1', opacity: 0.4 } }), { preview: true });
  await step('layouts', () => field(design, 'Layout of this slide').selectOption('text-2x'), current => current.slides[0].layout === 'text-2x', { preview: true });
  await step('narratives', () => field(design, 'Narrative').selectOption('scqa'), current => current.narrative === 'scqa');
  await step('tones', () => field(design, 'Tone').selectOption('casual'), current => current.tone === 'casual');
  await step('audiences', () => field(design, 'Audience').selectOption(['executive', 'investor']), current => JSON.stringify(current.audience) === '["executive","investor"]');
  await step('socials', async () => { await field(design, 'Platform').selectOption('linkedin'); const input = field(design, 'Handle or address'); await input.fill('alice-chen'); await input.press('Enter'); }, current => current.speaker.socials?.linkedin === 'alice-chen');
  await step('headers-footers', async () => { const input = field(design, 'Text'); await input.fill('Confidential'); await input.press('Enter'); }, current => current.design.footer?.center?.text === 'Confidential');
  await step('image fit default', () => field(design, 'Image fit').selectOption('contain'), current => current.design.imageFit === 'contain');
  // RR-41: slide size and purpose. The size is one deck-level choice; the preview recomposes at it.
  const previewBox = () => page.locator('#preview svg').first().getAttribute('viewBox');
  assert.equal(await previewBox(), '0 0 1280 720', 'the classic theme composes at widescreen');
  assert.deepEqual(await field(design, 'Slide size').locator('option').evaluateAll(nodes => nodes.map(node => node.value)), ['16:9', '4:3', '16:10', '1:1', '4:5', '9:16', 'letter', 'a4', 'widescreen', 'standard'], 'the ten presets');
  assert.equal(await field(design, 'Slide size').inputValue(), 'widescreen', 'the control shows the theme size');
  await step('slide-sizes', async () => {
    await field(design, 'Slide size').selectOption('4:3');
    await page.waitForFunction(() => document.querySelector('#preview svg')?.getAttribute('viewBox') === '0 0 960 720', undefined, { timeout: 8000 });
    assert.equal(await field(design, 'Slide size').inputValue(), '4:3');
  }, current => current.design.dimensions === '4:3', { preview: true });
  assert.equal(await previewBox(), '0 0 1280 720', 'Undo restores the preview size');
  await step('slide-sizes (A4)', () => field(design, 'Slide size').selectOption('a4'), current => current.design.dimensions === 'a4', { preview: true });
  await step('purposes', () => field(design, 'Purpose').selectOption('decide'), current => current.purpose === 'decide');

  // Per-slide scope: the same controls write the slide, not the deck.
  await slide(1);
  await field(design, 'Applies to').selectOption('slide');
  await step('slide-scope font scheme', () => field(design, 'Font scheme').selectOption('georgia'), current => current.slides[1].design?.fontScheme === 'georgia' && current.design.fontScheme === 'roboto', { preview: true });
  await step('slide-scope title alignment', () => field(design, 'Title alignment').selectOption('center'), current => current.slides[1].design?.titleAlignment === 'center' && current.design.titleAlignment === undefined);
  // A slide's own footer replaces the deck's whole footer, so the first slide edit starts from a copy of it.
  await field(design, 'Applies to').selectOption('deck');
  const footerCenter = field(design, 'Text');
  await footerCenter.fill('Confidential');
  await footerCenter.press('Enter');
  await waitDoc(current => current.design.footer?.center?.text === 'Confidential', 'deck footer for the slide-scope checks');
  await settle();
  assert.equal(await design.getByLabel('Hide it').isVisible(), false, 'hiding is not offered at the deck while the footer shows');
  await field(design, 'Applies to').selectOption('slide');
  await field(design, 'Zone').selectOption('right');
  await step('slide-scope footer keeps the deck zones', () => field(design, 'Insert value').selectOption('slide.number'), current => current.slides[1].design?.footer?.center?.text === 'Confidential' && current.slides[1].design.footer.right?.text === '{{slide.number}}' && current.design.footer.right === undefined);
  await step('hide the footer on one slide', () => design.getByLabel('Hide it').check(), current => current.slides[1].design?.footer === false && current.design.footer.center.text === 'Confidential');
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
  await step('accent font', async () => { const input = field(design, 'Accent font'); await input.fill('Georgia'); await input.press('Enter'); }, current => current.design.fontScheme?.accent === 'Georgia');
  {
    const before = await doc();
    const accent = field(design, 'Accent font');
    await accent.fill('Georgia');
    await accent.press('Enter');
    await waitDoc(current => current.design.fontScheme?.accent === 'Georgia', 'accent font for the Typography check');
    await settle();
    assert.equal(await page.locator('#font').inputValue(), 'roboto', 'the Typography select shows the scheme id');
    await page.locator('#font').selectOption('calibri');
    await waitDoc(current => current.design.fontScheme?.id === 'calibri' && current.design.fontScheme.accent === 'Georgia', 'the Typography select keeps the accent font');
    await settle();
    await field(design, 'Font scheme').selectOption('georgia');
    await waitDoc(current => current.design.fontScheme?.id === 'georgia' && current.design.fontScheme.accent === 'Georgia', 'a font scheme switch keeps the accent font');
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
  await step('organization logo', async () => { const input = field(design, 'Organization logo (whole presentation) source'); await input.fill('asset:logo'); await input.press('Enter'); }, current => current.organization.logo === 'asset:logo');
  assert.equal(await field(design, 'Watermark opacity (0 to 1)').isDisabled(), true, 'the opacity waits for a watermark image');
  await step('watermark', async () => { const input = field(design, 'Watermark source'); await input.fill('asset:mark'); await input.press('Enter'); }, current => current.design.watermark === 'asset:mark', { preview: true });
  await field(design, 'Watermark source').fill('asset:mark');
  await field(design, 'Watermark source').press('Enter');
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
  await field(design, 'Edit').selectOption('header');
  await field(design, 'Zone').selectOption('left');
  await step('header logo zone', () => design.getByLabel('Show the logo').check(), current => current.design.header?.left?.logo === true);
  await field(design, 'Edit').selectOption('footer');
  await field(design, 'Zone').selectOption('right');
  await step('footer slide number', () => field(design, 'Insert value').selectOption('slide.number'), current => current.design.footer?.right?.text === '{{slide.number}}');

  // FA-23: the catalog section checks for catalog updates on request (nothing embedded here, so nothing to update).
  await design.getByRole('button', { name: 'Check for catalog updates', exact: true }).click();
  assert.match(await status(), /Every embedded record matches its catalog/);
  assert.equal(await design.locator('[data-role="reference-findings"] li').count(), 0, 'every reference resolves in the registered catalog');
  mark('the catalog section checks for updates and lists reference findings');
  // Bad input is explained and changes nothing.
  {
    const before = await doc();
    const input = field(design, 'Watermark opacity \(0 to 1\)');
    await field(design, 'Watermark source').fill('asset:mark');
    await field(design, 'Watermark source').press('Enter');
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
  assert.deepEqual(targets.map(entry => entry[0]), ['', 'list', 'quote', 'metric', 'code', 'timeline', 'table']);
  // A table needs structure the text does not have: it is listed, disabled, with the reason as its title.
  assert.deepEqual(targets.at(-1).slice(1), ['Table (unavailable)', true]);
  assert.match(await selection.getByLabel(label('Content type')).locator('option[value="table"]').getAttribute('title'), /no table structure/);
  await step('block conversion text to list', () => selection.getByLabel(label('Content type')).selectOption('list'), current => JSON.stringify(current.slides[1].blocks[0]) === '{"items":["First line","Second line"]}', { preview: true });
  // Keyboard-only conversion: the next option of the focused select (the first target is the list).
  {
    const before = await doc();
    await keyNextOption(selection.getByLabel(label('Content type')));
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
  assert.ok(chartTypes.includes('line') && chartTypes.includes('pie') && !chartTypes.includes('stacked-column') && !chartTypes.includes('world'), 'chart types follow the data');
  await step('charts', () => selection.getByLabel(label('Chart type')).selectOption('line'), current => current.slides[2].blocks[0].chart.type === 'line', { preview: true });
  await step('chart to table conversion', () => selection.getByLabel(label('Content type')).selectOption('table'), current => current.slides[2].blocks[0].table?.columns?.[0] === 'Quarter');

  // Table: select a cell (one click edits it; Escape keeps it selected), then style and merge.
  const cell = path => page.locator(`#preview [data-canvas-target][data-opf-path="slides.2.blocks.1.table.${path}"]`);
  await cell('rows.1.0').click();
  await page.keyboard.press('Escape');
  await selection.getByLabel(label('Header row')).waitFor();
  assert.match(await selection.locator('[data-role="cell-summary"]').textContent(), /Row 2, column 1/);
  await step('table header style', () => selection.getByLabel(label('Header row')).selectOption('plain'), current => current.slides[2].blocks[1].table.columns[0].style?.fill === 'surface', { preview: true });
  await step('table banded rows', () => selection.getByLabel('Banded rows').check(), current => current.slides[2].blocks[1].table.rows[1][0].style?.fill === 'surfaceAlt', { preview: true });
  await step('table borders', () => selection.getByLabel(label('Borders')).selectOption('none'), current => current.slides[2].blocks[1].table.rows[0][0].style?.borders?.top?.width === 0, { preview: true });
  await selection.getByLabel(label('Borders')).selectOption('grid');
  await waitDoc(current => current.slides[2].blocks[1].table.rows[0][0].style?.borders?.left?.width === 1, 'grid borders');
  await settle();
  await step('table style reset', () => selection.getByRole('button', { name: 'Reset table style' }).click(), current => !JSON.stringify(current.slides[2].blocks[1].table).includes('style'), { preview: true });
  await button('Undo').click();
  await waitDoc(current => !JSON.stringify(current.slides[2].blocks[1].table).includes('style'), 'grid undone');
  await settle();
  // FA-27: the table's text alternative, typed once (Enter applies) and marked decorative.
  const tableAlt = selection.getByLabel('Table alt text', { exact: true });
  await step('table alt text', async () => { await tableAlt.fill('d leads the first row.'); await tableAlt.press('Enter'); }, current => current.slides[2].blocks[1].table.alt === 'd leads the first row.', { preview: true });
  await step('table decorative', () => selection.getByLabel('Decorative (no alt text)').check(), current => current.slides[2].blocks[1].table.alt === '', { preview: true });
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

  // --- RR-26: more conversions and content actions in the Content tab ----------------------------------------
  await page.locator('#tab-content').click();
  await slide(1);
  // list to table; the option lists what the target keeps.
  await page.locator('#preview [data-canvas-target][data-opf-path^="slides.1.blocks.1"]').first().click({ position: { x: 4, y: 4 } });
  await page.keyboard.press('Escape');
  await selection.getByLabel(label('Content type')).waitFor();
  const listTargets = await selection.getByLabel(label('Content type')).locator('option').evaluateAll(options => options.map(option => option.value));
  assert.deepEqual(listTargets, ['', 'text', 'timeline', 'table']);
  await step('list to table conversion', () => selection.getByLabel(label('Content type')).selectOption('table'), current => JSON.stringify(current.slides[1].blocks[1]) === '{"table":{"rows":[["One"],["Two"]]}}', { preview: true });
  mark('a list converts to a table in one undo step');

  // List levels: select an item, indent it from the keyboard, outdent it; each is one undo step.
  const second = page.locator('#preview [data-canvas-target][data-opf-path="slides.1.blocks.1.items.1"]');
  await second.click();
  await page.keyboard.press('Escape');
  const indent = selection.getByRole('button', { name: 'Indent item', exact: true });
  const outdent = selection.getByRole('button', { name: 'Outdent item', exact: true });
  await indent.waitFor();
  assert.equal(await outdent.isDisabled(), true, 'a top level item cannot be outdented');
  assert.match(await selection.locator('[data-role="outdent-note"]').textContent(), /already at the top level/);
  assert.match(await selection.locator('[data-role="indent-note"]').textContent(), /Nothing is lost/);
  assert.equal(await indent.getAttribute('aria-describedby'), await selection.locator('[data-role="indent-note"]').getAttribute('id'), 'the report is the button description');
  await step('list indent from the keyboard', async () => { await indent.focus(); await page.keyboard.press('Enter'); }, current => JSON.stringify(current.slides[1].blocks[1].items) === '["One",{"text":"Two","level":1}]', { preview: true });
  await indent.click();
  await waitDoc(current => current.slides[1].blocks[1].items[1].level === 1, 'indented for the outdent step');
  await settle();
  await step('list outdent', () => outdent.click(), current => JSON.stringify(current.slides[1].blocks[1].items) === '["One","Two"]');
  await button('Undo').click();
  await waitDoc(current => JSON.stringify(current.slides[1].blocks[1].items) === '["One","Two"]', 'indent undone');
  await settle();
  await page.locator('#preview [data-canvas-target][data-opf-path="slides.1.blocks.1.items.0"]').click();
  await page.keyboard.press('Escape');
  assert.equal(await indent.isDisabled(), true, 'the first item cannot be nested');
  assert.match(await selection.locator('[data-role="indent-note"]').textContent(), /first item/);
  mark('list levels move in and out, with the reason when they cannot');

  // Group with the next block, then ungroup from inside the group.
  await slide(1);
  await page.locator('#preview [data-canvas-target][data-opf-path="slides.1.blocks.0.text"]').click();
  await page.keyboard.press('Escape');
  const groupNext = selection.getByRole('button', { name: 'Group with the next block', exact: true });
  await groupNext.waitFor();
  assert.match(await selection.locator('[data-role="group-next-note"]').textContent(), /Nothing is lost/);
  await step('group with the next block', () => groupNext.click(), current => current.slides[1].blocks.length === 2 && current.slides[1].blocks[0].blocks?.length === 2, { preview: true });
  await groupNext.click();
  await waitDoc(current => current.slides[1].blocks[0].blocks?.length === 2, 'grouped for the ungroup step');
  await settle();
  await page.locator('#preview [data-canvas-target][data-opf-path="slides.1.blocks.0.blocks.0.text"]').click();
  await page.keyboard.press('Escape');
  await step('ungroup', () => selection.getByRole('button', { name: 'Ungroup these blocks', exact: true }).click(), current => current.slides[1].blocks.length === 3 && current.slides[1].blocks[0].text !== undefined, { preview: true });
  await button('Undo').click();
  await waitDoc(current => current.slides[1].blocks.length === 3 && current.slides[1].blocks[0].text !== undefined, 'group undone');
  await settle();
  mark('blocks group and ungroup');

  // A group of metrics converts to a table as a whole.
  await slide(3);
  await page.locator('#preview [data-canvas-target][data-opf-path^="slides.3.blocks.0"]').first().click({ position: { x: 4, y: 4 } });
  await page.keyboard.press('Escape');
  const metricGroup = selection.getByLabel(label('Group of metrics'));
  await metricGroup.waitFor();
  assert.deepEqual(await metricGroup.locator('option').evaluateAll(options => options.map(option => option.value)), ['', 'table']);
  await step('metric group to table', () => metricGroup.selectOption('table'), current => JSON.stringify(current.slides[3].table) === '{"columns":["Label","Value"],"rows":[["Retention",42],["Revenue","$1.2M"]]}' && current.slides[3].blocks === undefined, { preview: true });
  mark('a group of metrics converts to a table');

  // An image block goes to the slide's design; the loss is on the option; Slide structure puts it back.
  await slide(4);
  await page.locator('#preview [data-canvas-target][data-opf-path^="slides.4.blocks.0"]').first().click({ position: { x: 4, y: 4 } });
  await page.keyboard.press('Escape');
  const imageUse = selection.getByLabel(label('Use this image as'));
  await imageUse.waitFor();
  const imageOptions = await imageUse.locator('option').evaluateAll(options => options.map(option => [option.value, option.textContent]));
  assert.deepEqual(imageOptions.map(entry => entry[0]), ['', 'background', 'watermark'], 'OPF 0.15: a background or a watermark; an edge band is the block placement');
  assert.doesNotMatch(imageOptions.find(entry => entry[0] === 'background')[1], /loses/, 'alt text travels with a background');
  assert.match(imageOptions.find(entry => entry[0] === 'watermark')[1], /loses image alt text/, 'what a destination loses is on the option');
  // FA-22: the selected image block's fit, focus, treatments and placement.
  await step('image block fit', () => field(selection, 'Fit').selectOption('contain'), current => current.slides[4].blocks[0].fit === 'contain', { preview: true });
  await step('image block placement', () => field(selection, 'Bleed to an edge').selectOption('left'), current => current.slides[4].blocks[0].placement?.edge === 'left', { preview: true });
  await step('image block shape', () => field(selection, 'Shape').selectOption('circle'), current => current.slides[4].blocks[0].shape === 'circle', { preview: true });
  mark('an image block sets its fit, shape and placement');
  await step('image to background', () => imageUse.selectOption('background'), current => current.slides[4].design?.background?.type === 'image' && current.slides[4].design.background.alt === 'A pixel' && current.slides[4].blocks.length === 1, { preview: true });
  // The change moved the selection to the slide, so select the image block again.
  await page.locator('#preview [data-canvas-target][data-opf-path^="slides.4.blocks.0"]').first().click({ position: { x: 4, y: 4 } });
  await page.keyboard.press('Escape');
  await imageUse.selectOption('background');
  await waitDoc(current => current.slides[4].design?.background?.type === 'image', 'background image for the move back');
  await settle();
  const backImage = selection.getByRole('button', { name: 'Move the background image into the content', exact: true });
  await backImage.waitFor();
  await step('background image back into the content', () => backImage.click(), current => current.slides[4].design === undefined && current.slides[4].blocks.length === 2 && JSON.stringify(current.slides[4].blocks[1]) === '{"image":{"src":"asset:photo","alt":"A pixel"}}', { preview: true });
  await button('Undo').click();
  await waitDoc(current => current.slides[4].design === undefined, 'background image undone');
  await settle();
  mark('an image moves between the content and the slide background');

  // Blocks into regions and back: layouts are offered by block count, the loss comes before the change.
  await slide(5);
  const regionLayout = selection.getByLabel(label('Place the blocks in regions'));
  await regionLayout.waitFor();
  assert.deepEqual(await regionLayout.locator('option').evaluateAll(options => options.map(option => option.value)), ['', 'left-right', 'top-bottom']);
  await step('blocks to regions', () => regionLayout.selectOption('left-right'), current => current.slides[5].left?.text === 'Left text' && current.slides[5].right?.items?.[0] === 'Right' && current.slides[5].blocks === undefined, { preview: true });
  await regionLayout.selectOption('left-right');
  await waitDoc(current => current.slides[5].left !== undefined, 'regions for the move back');
  await settle();
  const toBlocks = selection.getByRole('button', { name: 'Turn regions into blocks', exact: true });
  await toBlocks.waitFor();
  assert.match(await selection.locator('[data-role="regions-to-blocks-note"]').textContent(), /region placement/);
  await step('regions to blocks', () => toBlocks.click(), current => current.slides[5].blocks?.length === 2 && current.slides[5].left === undefined, { preview: true });
  await button('Undo').click();
  await waitDoc(current => current.slides[5].blocks?.length === 2, 'regions undone');
  await settle();
  mark('blocks and regions convert both ways');

  // Every new control has a name; every action button's description is its report.
  const unnamed = await page.evaluate(() => [...document.querySelectorAll('#selection-controls select, #selection-controls input, #selection-controls button')].filter(node => !node.closest('[hidden]') && !(node.labels?.length || node.textContent.trim())).map(node => node.outerHTML.slice(0, 80)));
  assert.deepEqual(unnamed, [], 'every visible content control has a name');
  const described = await page.evaluate(() => [...document.querySelectorAll('#selection-controls .opf-dc-action > button')].filter(node => !node.closest('[hidden]')).map(node => !!document.getElementById(node.getAttribute('aria-describedby'))));
  assert.ok(described.every(Boolean), 'every action button points at its report');
  mark('the content controls are named and described');

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
