import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

// RR-06 gaps in a real browser, on the built playground: image upload (file to asset, one undo step, alt text, refusals)
// for the logo (all 12 variants), organization logo, watermark, background and zone images; every background
// form (gradient with scheme-slot stops, image, all 54 patterns); and every header/footer part per zone with the scope rules.
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
  organization: { id: 'acme', name: 'Acme Corp' },
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
  await openAll();

  // Files: a real PNG, JPEG-looking bytes and SVG; the files that must be refused come later.
  const png = Buffer.from(PIXEL.split(',')[1], 'base64');
  const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16]), Buffer.from('JFIF\0\x01\x01\0\0\x01\0\x01\0\0'), Buffer.from([0xff, 0xd9])]);
  const svgFile = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"><rect width="4" height="4" fill="#369"/></svg>');
  const upload = (scope, labelText, name, buffer, mimeType) => field(scope, labelText).setInputFiles({ name, mimeType, buffer });
  const assetsOf = current => Object.keys(current.assets ?? {});
  const typeInto = async (scope, labelText, value) => { const input = field(scope, labelText); await input.fill(value); await input.press('Enter'); };

  // --- uploads: every place an image can go, each one undo step and one asset ----------------------------
  {
    const before = await doc();
    const after = await step('upload: logo', () => upload(design, 'Upload logo file', 'Company Logo.png', png, 'image/png'), current => current.design.logo === 'asset:company-logo');
    const id = assetsOf(after).find(name => !assetsOf(before).includes(name));
    assert.equal(id, 'company-logo');
    assert.match(after.assets[id].src, /^data:image\/png;base64,/);
    assert.equal(after.assets[id].mediaType, 'image/png');
    assert.equal(after.assets[id].title, 'Company Logo.png');
  }
  // All 12 logo variants take an upload (PNG, JPEG and SVG among them).
  for (const variant of ['default', 'light', 'dark', 'stacked', 'stackedLight', 'stackedDark', 'icon', 'iconLight', 'iconDark', 'wordmark', 'wordmarkLight', 'wordmarkDark']) {
    await field(design, 'Logo variant').selectOption(variant);
    const file = variant === 'icon' ? ['x.svg', svgFile, 'image/svg+xml'] : variant === 'iconLight' ? ['x.jpg', jpeg, 'image/jpeg'] : ['x.png', png, 'image/png'];
    await step(`upload: logo variant ${variant}`, () => upload(design, 'Upload logo file', ...file), current => (variant === 'default' ? current.design.logo === 'asset:x' : current.design.logo?.[variant] === 'asset:x'));
  }
  await field(design, 'Logo variant').selectOption('default');
  await step('upload: organization logo', () => upload(design, 'Upload organization logo (whole presentation) file', 'org.png', png, 'image/png'), current => current.organization.logo === 'asset:org');
  await step('upload: watermark', () => upload(design, 'Upload watermark file', 'wm.png', png, 'image/png'), current => current.design.watermark === 'asset:wm');
  await step('upload: footer image', () => upload(design, 'Upload image file', 'badge.svg', svgFile, 'image/svg+xml'), current => current.design.footer?.center?.image === 'asset:badge');

  // Alt text: typed before the upload it lands on the new asset; afterwards it edits that asset.
  {
    await typeInto(design, 'Logo alt text', 'Acme logo, blue mark');
    assert.deepEqual(await doc(), source, 'alt text typed with no image only waits for the upload');
    await upload(design, 'Upload logo file', 'alt-test.png', png, 'image/png');
    const uploaded = await waitDoc(current => current.assets['alt-test']?.alt === 'Acme logo, blue mark', 'alt text on the new asset');
    assert.equal(uploaded.design.logo, 'asset:alt-test');
    await settle();
    assert.equal(await field(design, 'Logo alt text').inputValue(), 'Acme logo, blue mark');
    await typeInto(design, 'Logo alt text', 'New description');
    await waitDoc(current => current.assets['alt-test'].alt === 'New description', 'alt text edit');
    await button('Undo').click();
    await waitDoc(current => current.assets['alt-test'].alt === 'Acme logo, blue mark', 'alt edit is one undo step');
    await button('Undo').click();
    await waitDoc(current => JSON.stringify(current) === JSON.stringify(source), 'the upload is one undo step');
    await settle();
    mark('alt text: typed before an upload, edited after, each one undo step');
  }

  // Alt text and a background draft belong to one target: another variant or slide never inherits them.
  {
    await typeInto(design, 'Logo alt text', 'Only for the default logo');
    await field(design, 'Logo variant').selectOption('light');
    assert.equal(await field(design, 'Logo alt text').inputValue(), '', 'a different variant starts with no alt text');
    await field(design, 'Logo variant').selectOption('default');
    // A deck-wide draft survives moving between slides; a slide's draft belongs to that slide.
    await field(design, 'Background type').selectOption('gradient');
    await field(design, 'Angle in degrees').fill('77');
    await slide(1);
    assert.equal(await field(design, 'Angle in degrees').inputValue(), '77', 'a draft for the whole presentation stays while you move between slides');
    await field(design, 'Applies to').selectOption('slide');
    assert.equal(await field(design, 'Angle in degrees').inputValue(), '', 'changing what the form applies to drops the draft');
    await field(design, 'Background type').selectOption('gradient');
    await field(design, 'Angle in degrees').fill('78');
    await slide(0);
    assert.equal(await field(design, 'Angle in degrees').inputValue(), '', 'moving to another slide drops the draft of the slide you left');
    await field(design, 'Applies to').selectOption('deck');
    await slide(0);
    assert.deepEqual(await doc(), source);
    mark('alt text and background drafts do not leak across targets');
  }

  // Refusals: a clear message, no change, no leftover asset.
  {
    const refuse = async (name, buffer, mimeType, pattern) => {
      const before = await doc();
      await upload(design, 'Upload logo file', name, buffer, mimeType);
      await page.waitForFunction(() => document.querySelector('#design-controls .opf-dc-error').textContent.length > 0);
      assert.match(await error(), pattern, name);
      assert.deepEqual(await doc(), before, `${name}: nothing changed`);
    };
    await refuse('notes.png', Buffer.from('this is text, not an image'), 'image/png', /not a PNG, JPEG, GIF, WebP or SVG image/);
    await refuse('photo.jpg', png, 'image/jpeg', /says it is JPEG but its contents are PNG/);
    await refuse('evil.svg', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'), 'image/svg+xml', /script or embedded content/);
    await refuse('empty.png', Buffer.alloc(0), 'image/png', /is empty/);
    await refuse('huge.png', Buffer.concat([png, Buffer.alloc(2 * 1024 * 1024 + 10)]), 'image/png', /"huge.png" is 2048.1 KB; the limit is 2048 KB. Resize or compress it, or host it and use a web address instead./);
    assert.deepEqual((await doc()).assets, source.assets, 'no asset was added');
    mark('uploads of the wrong type, mismatched contents, script, empty and oversized files are refused with an explanation');
  }

  // --- backgrounds ------------------------------------------------------------------------------------
  const bgType = field(design, 'Background type');
  const applyBackground = () => design.getByRole('button', { name: 'Apply background' }).click();
  await bgType.selectOption('gradient');
  assert.deepEqual(await doc(), source, 'choosing a type changes nothing until Apply');
  await step('background: linear gradient with scheme slots', async () => {
    await bgType.selectOption('gradient');
    await field(design, 'Angle in degrees').fill('45');
    await field(design, 'Stop 1 color').fill('accent1');
    await field(design, 'Stop 1 position (0 to 1)').fill('0');
    await field(design, 'Stop 2 color').fill('#FFFFFF');
    await field(design, 'Stop 2 position (0 to 1)').fill('1');
    await applyBackground();
  }, current => JSON.stringify(current.design.background) === '{"type":"gradient","gradient":{"angle":45,"stops":[{"color":"accent1","position":0},{"color":"#FFFFFF","position":1}]}}', { preview: true });
  await step('background: three stops, added and removed from the keyboard', async () => {
    await bgType.selectOption('gradient');
    await field(design, 'Stop 1 color').fill('accent1');
    await field(design, 'Stop 1 position (0 to 1)').fill('0');
    await field(design, 'Stop 2 color').fill('surface');
    await field(design, 'Stop 2 position (0 to 1)').fill('1');
    await design.getByRole('button', { name: 'Add stop' }).focus();
    await page.keyboard.press('Enter');
    await field(design, 'Stop 3 color').fill('#102030');
    await field(design, 'Stop 3 position (0 to 1)').fill('0.5');
    await design.getByRole('button', { name: 'Remove stop 2' }).focus();
    await page.keyboard.press('Space');
    await applyBackground();
  }, current => JSON.stringify(current.design.background.gradient.stops) === '[{"color":"accent1","position":0},{"color":"#102030","position":0.5}]');
  // Invalid stops are explained and the draft is kept.
  {
    await bgType.selectOption('gradient');
    await field(design, 'Stop 1 color').fill('teal');
    await applyBackground();
    await page.waitForFunction(() => /Stop 1: the color must be a hex color/.test(document.querySelector('#design-controls .opf-dc-error').textContent));
    assert.equal(await field(design, 'Stop 1 color').inputValue(), 'teal', 'the draft is kept so it can be fixed');
    assert.deepEqual(await doc(), source);
    await field(design, 'Stop 1 color').fill('accent1');
    await field(design, 'Stop 2 position (0 to 1)').fill('3');
    await applyBackground();
    await page.waitForFunction(() => /Stop 2: the position is a number from 0/.test(document.querySelector('#design-controls .opf-dc-error').textContent));
    mark('invalid gradient stops are explained and the draft is kept');
  }
  // Another change reloads the draft from the document.
  await field(design, 'Tone').selectOption('casual');
  await waitDoc(current => current.tone === 'casual', 'tone change');
  await button('Undo').click();
  await waitDoc(current => current.tone === 'formal', 'tone undone');
  await settle();
  await step('background: solid scheme color with opacity', async () => { await bgType.selectOption('solid'); await field(design, 'Color').fill('accent2'); await field(design, 'Opacity (0 to 1, optional)').fill('0.5'); await applyBackground(); }, current => JSON.stringify(current.design.background) === '{"type":"solid","color":"accent2","opacity":0.5}', { preview: true });
  await step('background: image with fit tile', async () => { await bgType.selectOption('image'); await field(design, 'Background image source').fill('asset:photo'); await field(design, 'Fit').first().selectOption('tile'); await applyBackground(); }, current => JSON.stringify(current.design.background) === '{"type":"image","src":"asset:photo","fit":"tile"}');
  await step('background: image from an uploaded file', async () => { await bgType.selectOption('image'); await field(design, 'Fit').first().selectOption('contain'); await upload(design, 'Upload background image file', 'bg.png', png, 'image/png'); }, current => JSON.stringify(current.design.background) === '{"type":"image","src":"asset:bg","fit":"contain"}' && Boolean(current.assets.bg));
  // Patterns: all 54 presets, grouped; any of them applies.
  {
    await bgType.selectOption('pattern');
    const presetSelect = field(design, 'Pattern').first();
    const options = await presetSelect.locator('option').evaluateAll(nodes => nodes.map(node => node.value));
    assert.equal(options.length, 54, 'all 54 pattern presets are listed');
    assert.equal(new Set(options).size, 54);
    assert.deepEqual(await presetSelect.locator('optgroup').evaluateAll(nodes => nodes.map(node => [node.label, node.children.length])), [['Percent', 12], ['Horizontal and vertical', 11], ['Diagonal', 11], ['Checks, grids and bricks', 9], ['Shapes and textures', 11]]);
    mark('the pattern list has all 54 presets in five labelled groups');
  }
  for (const preset of ['pct5', 'zigZag', 'wdUpDiag']) {
    await step(`background: pattern ${preset}`, async () => { await bgType.selectOption('pattern'); await field(design, 'Pattern').first().selectOption(preset); await field(design, 'Pattern color').fill('accent1'); await field(design, 'Behind the pattern').fill('#EEEEEE'); await applyBackground(); }, current => JSON.stringify(current.design.background) === JSON.stringify({ type: 'pattern', pattern: { preset, foregroundColor: 'accent1', backgroundColor: '#EEEEEE' } }), { preview: preset === 'pct5' });
  }
  await step('background: theme slot', async () => { await bgType.selectOption('theme'); await field(design, 'Theme slot').selectOption('dark2'); await applyBackground(); }, current => current.design.background === 'dark2');
  {
    await bgType.selectOption('theme');
    await field(design, 'Theme slot').selectOption('dark2');
    await applyBackground();
    await waitDoc(current => current.design.background === 'dark2', 'deck background for removal');
    await settle();
    await design.getByRole('button', { name: 'Remove background' }).click();
    await waitDoc(current => current.design.background === undefined, 'background removed');
    await button('Undo').click();
    await waitDoc(current => current.design.background === 'dark2', 'removal is one undo step');
    await slide(1);
    await field(design, 'Applies to').selectOption('slide');
    await settle();
    await step('background: this slide only', async () => { await bgType.selectOption('pattern'); await field(design, 'Pattern').first().selectOption('plaid'); await applyBackground(); }, current => current.slides[1].design?.background?.pattern?.preset === 'plaid' && current.design.background === 'dark2');
    await field(design, 'Applies to').selectOption('deck');
    await slide(0);
    await button('Undo').click();
    await waitDoc(current => current.design.background === undefined, 'reset deck background');
    await settle();
    mark('background removal and slide scope');
  }

  // --- header and footer: every part, per zone -----------------------------------------------------------
  {
    const toggle = (name, predicate, labelText) => step(`footer: ${name}`, () => design.getByLabel(labelText).check(), predicate);
    const write = (name, predicate, labelText, value) => step(`footer: ${name}`, () => typeInto(design, labelText, value), predicate);
    await field(design, 'Edit').selectOption('footer');
    await field(design, 'Zone').selectOption('left');
    await write('text', current => current.design.footer?.left?.text === 'Acme Corp', 'Text', 'Acme Corp');
    await toggle('logo', current => current.design.footer?.left?.logo === true, 'Show the logo');
    await toggle('organization', current => current.design.footer?.left?.organization === true, 'Show the organization name');
    await toggle('speaker', current => current.design.footer?.left?.speaker === true, 'Show the speaker name and title');
    await toggle('section', current => current.design.footer?.left?.section === true, 'Show the section label');
    await write('image by address', current => current.design.footer?.left?.image === 'https://example.com/badge.png', 'Image source', 'https://example.com/badge.png');
    await field(design, 'Zone').selectOption('right');
    await toggle('slide number', current => current.design.footer?.right?.slideNumber === true, 'Show the slide number');
    await write('slide number format', current => current.design.footer?.right?.slideNumberFormat === 'Page {current} of {total}', 'Slide number format', 'Page {current} of {total}');
    await toggle('current date', current => current.design.footer?.right?.date === true, 'Show the current date');
    await write('fixed date', current => current.design.footer?.right?.date === '2026-10-01', 'Fixed date', '2026-10-01');
    await write('date format', current => current.design.footer?.right?.dateFormat === 'MMMM d, yyyy', 'Date format', 'MMMM d, yyyy');
    mark('every header and footer part (text, logo, image, organization, speaker, section, slide number and format, date and format) in its zone');
    // Parts that need something say so, and bad values are refused.
    await design.getByLabel('Show the slide number').check();
    await waitDoc(current => current.design.footer?.right?.slideNumber === true, 'slide number for the format check');
    const format = field(design, 'Slide number format');
    await format.fill('Page');
    await format.press('Enter');
    await page.waitForFunction(() => /must contain \{current\}/.test(document.querySelector('#design-controls .opf-dc-error').textContent));
    assert.equal(await format.inputValue(), '', 'the field returns to the document value');
    await button('Undo').click();
    await waitDoc(current => current.design.footer === undefined, 'format check reset');
    await settle();
    await field(design, 'Zone').selectOption('left');
    await design.getByLabel("Show the organization's social profiles").check();
    await waitDoc(current => current.design.footer?.left?.socials === true, 'socials without any');
    assert.match(await page.locator('#design-controls .opf-dc-warnings').evaluateAll(nodes => nodes.map(node => node.textContent).join(' ')), /social profiles, but the organization has none/);
    await button('Undo').click();
    await waitDoc(current => current.design.footer === undefined, 'socials reset');
    await settle();
    mark('parts with nothing to show are explained');
    // The zone summary lists the parts in use for the chosen furniture.
    await field(design, 'Zone').selectOption('center');
    await typeInto(design, 'Text', 'Draft');
    await waitDoc(current => current.design.footer?.center?.text === 'Draft', 'center text');
    const summary = await design.getByRole('list', { name: 'Zones in use' }).textContent();
    assert.match(summary, /Center: text “Draft”/);
    assert.match(summary, /Left: empty/);
    await button('Undo').click();
    await waitDoc(current => current.design.footer === undefined, 'summary reset');
    await settle();
    // Same scope rules: a slide edit keeps the deck's zones, and hiding is per slide.
    await field(design, 'Zone').selectOption('left');
    await typeInto(design, 'Text', 'Acme');
    await waitDoc(current => current.design.footer?.left?.text === 'Acme', 'deck footer');
    await settle();
    await slide(1);
    await field(design, 'Applies to').selectOption('slide');
    await settle();
    await field(design, 'Zone').selectOption('right');
    await step('slide scope: a date part keeps the deck zones', () => design.getByLabel('Show the current date').check(), current => current.slides[1].design?.footer?.left?.text === 'Acme' && current.slides[1].design.footer.right?.date === true && current.design.footer.right === undefined);
    await field(design, 'Edit').selectOption('header');
    await step('slide scope: hide the header on this slide', () => design.getByLabel('Hide it').check(), current => current.slides[1].design?.header === false);
    await field(design, 'Applies to').selectOption('deck');
    await slide(0);
    await button('Undo').click();
    await waitDoc(current => current.design.footer === undefined, 'footer removed');
    await settle();
    mark('header and footer parts follow the scope rules');
  }

  // --- accessibility ------------------------------------------------------------------------------------
  const unlabeled = await page.evaluate(() => [...document.querySelectorAll('#design-controls select, #design-controls input')].filter(node => !node.labels?.length).map(node => node.id || node.outerHTML.slice(0, 80)));
  assert.deepEqual(unlabeled, [], 'every control, including every file input, is labelled');
  assert.ok(await page.locator('#design-controls input[type=file]').count() >= 5, 'file inputs exist for logo, organization logo, watermark, background and zone image');
  await page.locator('#design-controls input[type=file]:visible').first().focus();
  assert.equal(await page.evaluate(() => document.activeElement.type), 'file');
  mark('every control and file input is labelled; file inputs take keyboard focus');

  assert.deepEqual(errors, []);
  console.log(`Design gaps (browser): ${checks.length} checks. ${checks.join('; ')}.`);
} finally {
  await browser?.close();
  server.close();
}
