import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

// RR-32 in a real browser, on the built playground (npm run build:playground): the Fill template panel lists a
// template's variables with typed inputs, shows what is unfilled, previews the typed values live, fills the deck as
// one undoable edit, inserts a variable token into selected text, and the canvas keeps showing the template's tokens.
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

const PIXEL_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jP0cAAAAASUVORK5CYII=';
const source = {
  template: true,
  name: 'Quarterly review for {{client}}',
  design: { theme: 'classic', fontScheme: 'roboto' },
  speaker: { id: 'ada', name: 'Ada Lovelace', title: 'CTO' },
  variables: {
    client: { type: 'text', label: 'Client name', example: 'Acme Corp' },
    revenue: { type: 'number', format: '$#,##0', example: 1250000 },
    wins: { type: 'list', example: ['Faster onboarding', 'Lower churn'] },
    logo: { type: 'image', required: false },
  },
  slides: [
    { id: 'cover', title: 'Review for {{client}}', subtitle: 'Revenue {{revenue}}' },
    { id: 'wins', title: 'Wins', bullets: ['var:wins'], image: 'var:logo' },
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
  assert.deepEqual(await doc(), source);
  // The canvas edits the template as authored: its tokens stay visible.
  assert.match(await page.locator('#preview svg').first().textContent(), /Review for \{\{client\}\}/);
  mark('canvas shows the template tokens');

  // Open the panel.
  await button('Fill template').click();
  const dialog = page.locator('#template-dialog');
  await dialog.waitFor();
  const fields = dialog.locator('.opf-template-field');
  assert.deepEqual(await fields.evaluateAll(nodes => nodes.map(node => node.dataset.variable)), ['client', 'revenue', 'wins', 'logo']);
  assert.deepEqual(await fields.evaluateAll(nodes => nodes.map(node => node.dataset.status)), ['unfilled', 'unfilled', 'unfilled', 'optional']);
  assert.match(await dialog.locator('.opf-template-summary').textContent(), /0 of 3 required variables filled\. Still needed: client, revenue, wins/);
  assert.equal(await dialog.getByLabel(/^Client name/).getAttribute('placeholder'), 'Acme Corp');
  assert.equal(await dialog.getByRole('button', { name: 'Fill the presentation' }).isDisabled(), true);
  mark('typed fields with unfilled state');

  // FA-04: the document's built-in variables are listed read-only, with their source values.
  const builtins = dialog.locator('.opf-template-builtins');
  await builtins.locator('summary').click();
  assert.equal(await builtins.locator('li[data-builtin="speaker.name"]').textContent().then(text => text.includes('{{speaker.name}}') && text.includes('Ada Lovelace')), true);
  assert.equal(await builtins.locator('li[data-builtin="speaker.photo"]').getAttribute('data-available'), 'false');
  // FA-31: the three slide-scoped built-ins are listed read-only as "varies per slide".
  for (const name of ['slide.number', 'slide.section', 'deck.slideCount']) {
    const row = builtins.locator(`li[data-builtin="${name}"]`);
    assert.equal(await row.getAttribute('data-scope'), 'slide', `${name} is slide-scoped`);
    const rowText = await row.textContent();
    assert.ok(rowText.includes(`{{${name}}}`) && rowText.includes('varies per slide'), `${name} varies per slide: ${rowText}`);
    assert.ok(!rowText.includes('not set'), `${name} is not shown as unset`);
  }
  assert.equal(await builtins.locator('li[data-builtin="speaker.name"]').getAttribute('data-scope'), 'deck');
  assert.match(await builtins.locator('li[data-builtin="slide.section"]').textContent(), /no slide has one yet/);
  // RR-71: the organization logos are slide-scoped images, listed read-only after the text ones as whole-field var: references (no organization logo yet here).
  const logoNames = ['organization.logo', 'organization.logo.stacked', 'organization.logo.icon', 'organization.logo.wordmark'];
  assert.deepEqual(await builtins.locator('li').evaluateAll(nodes => nodes.slice(-7).map(node => node.getAttribute('data-builtin'))), ['slide.number', 'slide.section', 'deck.slideCount', ...logoNames], 'they come last, the logos after the slide-scoped text');
  for (const name of logoNames) {
    const row = builtins.locator(`li[data-builtin="${name}"]`);
    assert.deepEqual([await row.getAttribute('data-kind'), await row.getAttribute('data-scope'), await row.getAttribute('data-available')], ['image', 'slide', 'false'], name);
    const rowText = await row.textContent();
    assert.ok(rowText.includes(`var:${name}`) && !rowText.includes('{{') && rowText.includes('light or dark artwork per slide') && rowText.includes('no logo yet'), `${name} is a read-only image reference: ${rowText}`);
  }
  assert.match(await builtins.locator('.opf-template-help').textContent(), /var:organization\.logo\.icon/, 'the help says how to place a logo');
  assert.equal(await dialog.locator('.opf-template-insert-section option[value="organization.logo"]').count(), 0, 'a logo is not a text token to insert');
  assert.equal(await dialog.locator('.opf-template-insert-section option[value="slide.number"]').count(), 1, 'the slide-scoped text values still insert');
  assert.equal(await builtins.locator('input,textarea').count(), 0);
  mark('built-in variables listed read-only');

  // The preview shows examples until values are typed, then the values.
  const previewText = () => dialog.locator('.opf-template-preview svg').first().textContent();
  await page.waitForFunction(() => /Review for Acme Corp/.test(document.querySelector('#template-dialog .opf-template-preview')?.textContent ?? ''), undefined, { timeout: 30000 });
  await dialog.getByLabel(/^Client name/).fill('Globex');
  await page.waitForFunction(() => /Review for Globex/.test(document.querySelector('#template-dialog .opf-template-preview')?.textContent ?? ''), undefined, { timeout: 30000 });
  assert.match(await dialog.locator('.opf-template-preview-status').textContent(), /example values for: revenue, wins/);
  assert.match(await previewText(), /Revenue \$1,250,000/);
  mark('live preview: examples, then typed values');

  // A bad number is refused in place; nothing in the document changes while typing.
  const revenue = dialog.getByLabel(/^Revenue/);
  await revenue.fill('lots');
  assert.match(await dialog.locator('[data-variable=revenue] .opf-template-error').textContent(), /number/);
  assert.equal(await revenue.getAttribute('aria-invalid'), 'true');
  assert.deepEqual(await doc(), source);
  await revenue.fill('1234567');
  await page.waitForFunction(() => /Revenue \$1,234,567/.test(document.querySelector('#template-dialog .opf-template-preview')?.textContent ?? ''), undefined, { timeout: 30000 });
  assert.equal(await revenue.getAttribute('aria-invalid'), 'false');
  mark('bad values are refused in place');

  await dialog.getByLabel(/^Wins/).fill('Shipped v2\nWon renewal');
  await dialog.getByLabel(/upload an image/).setInputFiles({ name: 'logo.png', mimeType: 'image/png', buffer: Buffer.from(PIXEL_BASE64, 'base64') });
  await page.waitForFunction(() => document.querySelector('#template-dialog [data-variable=logo] input[type=text]').value.startsWith('data:image/png;base64,'));
  assert.match(await dialog.locator('.opf-template-summary').textContent(), /All 3 required variables have a value/);
  mark('list and image inputs');

  // Fill: one undoable edit.
  await dialog.getByRole('button', { name: 'Fill the presentation' }).click();
  const filled = await waitDoc(current => current.template === undefined, 'the fill removes the template marker');
  assert.equal(filled.name, 'Quarterly review for Globex');
  assert.equal(filled.slides[0].title, 'Review for Globex');
  assert.equal(filled.slides[0].subtitle, 'Revenue $1,234,567');
  assert.deepEqual(filled.slides[1].bullets, ['Shipped v2', 'Won renewal']);
  assert.equal(filled.slides[1].image, `data:image/png;base64,${PIXEL_BASE64}`);
  assert.equal(filled.variables, undefined);
  await page.locator('#template-close').click();
  await settle();
  await button('Undo').click();
  await waitDoc(current => JSON.stringify(current) === JSON.stringify(source), 'one Undo restores the template');
  await button('Redo').click();
  await waitDoc(current => JSON.stringify(current) === JSON.stringify(filled), 'Redo returns the filled deck');
  await button('Undo').click();
  await waitDoc(current => JSON.stringify(current) === JSON.stringify(source), 'back to the template');
  mark('one undoable fill');

  // Insert a token into the selected text: an existing variable, then a new one declared in the same edit.
  await settle();
  await button('Fill template').click();
  await dialog.locator('summary', { hasText: 'Insert a variable into text' }).click();
  await dialog.getByLabel('Variable', { exact: true }).selectOption('client');
  await page.locator('#value').fill('Hello ');
  await dialog.getByRole('button', { name: 'Insert into selected text' }).click();
  await waitDoc(current => current.slides[0].title === 'Review for {{client}}' || current.slides[0].title.endsWith('{{client}}'), 'the token is inserted');
  const withToken = await doc();
  assert.ok(withToken.slides[0].title.includes('{{client}}'));
  await dialog.getByLabel('Name', { exact: true }).fill('Deal size');
  await dialog.getByLabel('Kind', { exact: true }).selectOption('number');
  await dialog.getByLabel('Sample value', { exact: true }).fill('42');
  await dialog.getByRole('button', { name: 'Create and insert' }).click();
  const withNew = await waitDoc(current => current.variables?.['deal-size'], 'a new variable is declared with its token');
  assert.deepEqual(withNew.variables['deal-size'], { type: 'number', label: 'Deal size', example: 42 });
  assert.ok(withNew.slides[0].title.includes('{{deal-size}}'));
  await dialog.locator('#template-close').click().catch(() => page.locator('#template-close').click());
  await settle();
  await button('Undo').click();
  await waitDoc(current => !current.variables['deal-size'] && current.slides[0].title.includes('{{client}}'), 'Undo takes back the new variable and its token');
  mark('token insertion with a new variable');

  assert.deepEqual(errors, []);
  console.log(`Fill template panel passed ${checks.length} browser checks: ${checks.join('; ')}.`);
} finally {
  await browser?.close();
  server.close();
}
