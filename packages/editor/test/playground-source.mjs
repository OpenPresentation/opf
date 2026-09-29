import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

// The playground source view keeps the exact bytes of applied source. Slide edits rewrite only
// the edited token, and Escape, Undo and Redo restore exact prior bytes: JSON escapes
// (\/, é, \n) and irregular whitespace included.
const root = fileURLToPath(new URL('../artifacts/playground/', import.meta.url));
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/favicon.ico') { res.writeHead(204).end(); return; }
    const target = path.resolve(root, '.' + decodeURIComponent(url.pathname));
    const relative = path.relative(root, target);
    if (relative.startsWith('..') || path.isAbsolute(relative)) { res.writeHead(403).end(); return; }
    res.writeHead(200, { 'Content-Type': types[path.extname(target)] ?? 'application/octet-stream' }).end(await readFile(target));
  } catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
  browser = await chromium.launch({ channel: process.platform === 'win32' && !process.env.CI ? 'msedge' : undefined });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  const button = name => page.getByRole('button', { name, exact: true });
  // The hidden source textarea always mirrors the current view, including live drafts.
  const view = () => page.locator('#json').inputValue();
  const expectView = async (expected, message) => {
    await page.waitForFunction(text => document.querySelector('#json').value === text, expected, { timeout: 5000 })
      .catch(async () => assert.equal(await view(), expected, message));
    assert.equal(await view(), expected, message);
  };

  const original = [
    '{ "name"  :   "Caf\\u00e9 \\/ Deck",',
    '\t"slides" : [',
    '\t\t{"title":   "Caf\\u00e9 \\/ Q1" ,  "text":"Line one\\nLine two \\/ \\u00e9" },',
    '    { "title" :"Caf\\u00e9 items",',
    '      "items": [ "Onboard caf\\u00e9s \\/ partners"  ,',
    '\t"Second\\u00e9 \\/ item" ] }',
    '  ]',
    '}',
    '',
  ].join('\n');
  const swap = (from, to) => original.replace(from, to);
  const TITLE = '"Caf\\u00e9 \\/ Q1"', TEXT = '"Line one\\nLine two \\/ \\u00e9"';

  await page.goto(`http://127.0.0.1:${server.address().port}/index.html`);
  await page.locator('#preview svg').waitFor();
  await button('Source').click();
  await page.locator('#json').fill(original);
  await page.waitForFunction(() => !document.querySelector('#apply-json').disabled);
  await button('Apply changes').click();
  await page.locator('#preview [data-canvas-target][data-opf-path="slides.0.title"]').waitFor();

  // Applied source is kept byte for byte, not normalized to JSON.stringify output.
  await expectView(original, 'applied source keeps its exact bytes');
  await button('Source').click();
  assert.equal(await page.locator('#json').inputValue(), original, 'reopening the source view shows the applied bytes');
  await button('Close source editor').click();

  const title = page.locator('#preview [data-canvas-target][data-opf-path="slides.0.title"]');
  const text = page.locator('#preview [data-canvas-target][data-opf-path="slides.0.text"]');
  const inline = label => page.getByRole('textbox', { name: `Edit ${label} inline`, exact: true });

  // Inline edit, then Escape: only the draft token differs while typing, and nothing afterwards.
  await title.dblclick();
  await inline('title').fill('Draft title');
  await expectView(swap(TITLE, '"Draft title"'), 'a draft rewrites only the edited token');
  await inline('title').press('Escape');
  await expectView(original, 'Escape restores the exact prior bytes');
  await text.dblclick();
  await inline('text').fill('Only this');
  await expectView(swap(TEXT, '"Only this"'), 'a text draft rewrites only its token');
  await inline('text').press('Escape');
  await expectView(original, 'Escape restores a text value spelled with \\n and \\/');

  // Ctrl+Enter, Undo, Redo: exact prior bytes, then exact edited bytes.
  const edited = swap(TITLE, '"Committed title"');
  await title.dblclick();
  await inline('title').fill('Committed title');
  await inline('title').press('Control+Enter');
  await expectView(edited, 'commit keeps every other byte');
  await button('Undo').click();
  await expectView(original, 'Undo restores the exact prior bytes');
  await button('Redo').click();
  await expectView(edited, 'Redo restores the exact edited bytes');
  await button('Undo').click();
  await expectView(original, 'Undo again restores the exact prior bytes');

  // The text value spelled with escapes, then a two-edit chain undone and redone in order.
  const textEdited = swap(TEXT, '"Replaced"');
  await text.dblclick();
  await inline('text').fill('Replaced');
  await inline('text').press('Control+Enter');
  await expectView(textEdited, 'text commit keeps every other byte');
  await button('Undo').click();
  await expectView(original, 'Undo restores the text spelling');
  await title.dblclick();
  await inline('title').fill('Committed title');
  await inline('title').press('Control+Enter');
  await text.dblclick();
  await inline('text').fill('Replaced');
  await inline('text').press('Control+Enter');
  const both = edited.replace(TEXT, '"Replaced"');
  await expectView(both, 'two commits rewrite only their two tokens');
  await button('Undo').click();
  await expectView(edited, 'first Undo of a chain');
  await button('Undo').click();
  await expectView(original, 'second Undo of a chain');
  await button('Redo').click();
  await expectView(edited, 'first Redo of a chain');
  await button('Redo').click();
  await expectView(both, 'second Redo of a chain');

  // Undoing the applied source returns to the exact normalized view that preceded it.
  await button('Undo').click();
  await button('Undo').click();
  await expectView(original, 'chain is fully undone');
  // Adding a slide is a structural array edit: untouched slides keep their exact tokens.
  await page.locator('#add').click();
  await page.waitForFunction(() => JSON.parse(document.querySelector('#json').value).slides.length === 3);
  const withSlide = await view();
  assert.equal(JSON.parse(withSlide).slides[2].title, 'New slide');
  for (const token of ['{"title":   "Caf\\u00e9 \\/ Q1" ,  "text":"Line one\\nLine two \\/ \\u00e9" }', '"items": [ "Onboard caf\\u00e9s \\/ partners"  ,\n\t"Second\\u00e9 \\/ item" ] }'])
    assert.ok(withSlide.includes(token), 'adding a slide keeps sibling tokens byte for byte');
  assert.ok(withSlide.startsWith('{ "name"  :   "Caf\\u00e9 \\/ Deck",\n\t"slides" : [\n'), 'the rest of the document is untouched');
  await button('Undo').click();
  await expectView(original, 'Undo of an added slide restores the exact bytes');
  await button('Redo').click();
  await expectView(withSlide, 'Redo of an added slide restores the exact bytes');
  await button('Undo').click();
  await expectView(original, 'Undo of an added slide again');

  await button('Undo').click();
  assert.notEqual(await view(), original, 'undoing the source apply leaves the previous document');
  // Repeated object keys are rejected on Apply (JSON.parse would keep only the last one).
  await button('Source').click();
  await page.locator('#json').fill('{"name":"first","name":"second","slides":[{"title":"T"}]}');
  await page.waitForFunction(() => document.querySelector('#json-error').textContent.includes('Duplicate key "name"'));
  assert.equal(await page.locator('#apply-json').isDisabled(), true, 'Apply stays disabled for duplicate keys');
  await page.locator('#json').fill('{"name":"ok","slides":[{"title":{"a":1,"a":2}}]}');
  await page.waitForFunction(() => document.querySelector('#json-error').textContent.includes('Duplicate key "a"'));
  await button('Close source editor').click();
  assert.deepEqual(errors, []);
  console.log('Playground source: escaped tokens and irregular whitespace survive Escape, Undo and Redo byte for byte.');
} finally {
  await browser?.close();
  server.close();
}
