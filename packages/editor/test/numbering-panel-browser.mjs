import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

// RR-33 in a real browser, on the built playground (npm run build:playground): the List numbering dialog numbers a list,
// changes its style, start and suffix, sets them per level, restarts the count at an entry and turns numbering off; every
// change is one undoable edit and the canvas draws the same numbers.
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
  design: { theme: 'classic', fontScheme: 'roboto' },
  slides: [
    { id: 'steps', title: 'Rollout', items: ['Freeze the schema', { text: 'Migrate the data', level: 1 }, { text: 'Verify the counts', level: 1 }, 'Switch traffic', 'Retire the old service'] },
    { id: 'two', title: 'Two lists', left: { bullets: ['Alpha', 'Beta'] }, right: { items: ['Gamma', 'Delta'] } },
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
  // The markers the canvas draws for the current slide, in order (the preview's marker text elements).
  const drawn = () => page.locator('#preview svg').first().evaluate(svg => [...svg.querySelectorAll('text[aria-hidden="true"]')].map(node => node.textContent));
  const waitDrawn = async (expected, message) => {
    const started = Date.now();
    for (;;) {
      const now = await drawn();
      if (JSON.stringify(now) === JSON.stringify(expected)) return;
      if (Date.now() - started > 15000) assert.fail(`${message}: drawn ${JSON.stringify(now)}, expected ${JSON.stringify(expected)}`);
      await page.waitForTimeout(50);
    }
  };

  await page.goto(`http://127.0.0.1:${server.address().port}/index.html`);
  await page.locator('#preview svg').waitFor();
  await button('Source').click();
  await page.locator('#json').fill(JSON.stringify(source));
  await page.waitForFunction(() => !document.querySelector('#apply-json').disabled && !document.querySelector('#json-error').textContent);
  await button('Apply changes').click();
  await page.locator('#preview [data-canvas-target][data-opf-path="slides.0.title"]').waitFor();
  await settle();
  await waitDrawn(['•', '◦', '◦', '•', '•'], 'bullets before numbering');
  mark('bulleted list before numbering');

  // Open the dialog: the slide's list, not numbered yet.
  await button('List numbering').click();
  const dialog = page.locator('#numbering-dialog');
  await dialog.waitFor();
  const enabled = dialog.getByLabel('Number this list');
  assert.equal(await enabled.isChecked(), false);
  assert.equal(await dialog.locator('.opf-numbering-level select').first().isDisabled(), true, 'the pickers wait for numbering to be on');
  mark('dialog opens on the slide list, unnumbered');

  // Number it: one edit, the canvas draws numbers.
  await enabled.check();
  const numbered = await waitDoc(current => current.slides[0].numbering !== undefined, 'numbering is written');
  assert.equal(numbered.slides[0].numbering, 'arabic');
  assert.deepEqual(numbered.slides[0].items, source.slides[0].items);
  await settle();
  await waitDrawn(['1.', '1.', '2.', '2.', '3.'], 'numbers on the canvas');
  assert.match(await dialog.locator('.opf-numbering-preview').textContent(), /1\.\s+1\.\s+2\.\s+2\.\s+3\./);
  mark('numbering the list writes numbering and the canvas draws numbers');

  // Style, start and suffix: each change is an edit; the shortest form is written.
  await dialog.locator('.opf-numbering-level').first().getByLabel('Style').selectOption('roman-lower');
  await waitDoc(current => current.slides[0].numbering === 'roman-lower', 'style');
  await dialog.locator('.opf-numbering-level').first().getByLabel('Start at').fill('4');
  await page.keyboard.press('Tab');
  await waitDoc(current => JSON.stringify(current.slides[0].numbering) === '{"style":"roman-lower","start":4}', 'start');
  await dialog.locator('.opf-numbering-level').first().getByLabel('After the number').selectOption('paren-both');
  const styled = await waitDoc(current => current.slides[0].numbering?.suffix === 'paren-both', 'suffix');
  assert.deepEqual(styled.slides[0].numbering, { style: 'roman-lower', start: 4, suffix: 'paren-both' });
  await settle();
  await waitDrawn(['(iv)', '(iv)', '(v)', '(v)', '(vi)'], 'styled numbers on the canvas (one setting for every level)');
  mark('style, start and suffix');

  // A bad start is refused in place and the document stays as it was.
  const start = dialog.locator('.opf-numbering-level').first().getByLabel('Start at');
  await start.fill('0');
  await page.keyboard.press('Tab');
  await page.waitForFunction(() => /start must be a whole number/.test(document.querySelector('.opf-numbering-live')?.textContent ?? ''));
  assert.deepEqual((await doc()).slides[0].numbering, { style: 'roman-lower', start: 4, suffix: 'paren-both' });
  mark('a bad start is refused in place');

  // Per level: an outline.
  await dialog.getByLabel('Different numbering for each level').check();
  const outline = await waitDoc(current => Array.isArray(current.slides[0].numbering), 'per-level numbering');
  assert.equal(outline.slides[0].numbering.length, 2);
  assert.equal(outline.slides[0].numbering[0].style, 'roman-lower');
  assert.notEqual(outline.slides[0].numbering[1].style, 'roman-lower');
  assert.equal(await dialog.locator('.opf-numbering-level').count(), 2);
  await dialog.locator('.opf-numbering-level').nth(1).getByLabel('Style').selectOption('alpha-upper');
  await waitDoc(current => current.slides[0].numbering[1].style === 'alpha-upper', 'level 2 style');
  await settle();
  await waitDrawn(['(iv)', '(A)', '(B)', '(v)', '(vi)'], 'per-level numbers on the canvas');
  mark('numbering per level');

  // Restart at the selected entry: select an entry, then the dialog offers its own start.
  await dialog.locator('#numbering-close').click();
  await page.locator('#preview [data-canvas-target][data-opf-path="slides.0.items.3"]').click();
  await button('List numbering').click();
  const entry = dialog.getByLabel(/^Entry 4 starts at/);
  await entry.waitFor();
  await entry.fill('9');
  await page.keyboard.press('Tab');
  const restarted = await waitDoc(current => current.slides[0].items[3]?.start === 9, 'entry start');
  assert.deepEqual(restarted.slides[0].items[3], { text: 'Switch traffic', start: 9 });
  await entry.fill('');
  await page.keyboard.press('Tab');
  await waitDoc(current => current.slides[0].items[3]?.start === undefined, 'entry start removed');
  mark('restart at an entry');

  // The second slide has two lists: the dialog offers both.
  await dialog.locator('#numbering-close').click();
  await page.locator('#slide-list > *').nth(1).click();
  await settle();
  await button('List numbering').click();
  const choices = dialog.getByLabel('List', { exact: true });
  assert.equal(await choices.locator('option').count(), 2);
  await choices.selectOption({ index: 1 });
  await dialog.getByLabel('Number this list').check();
  const two = await waitDoc(current => current.slides[1].right?.numbering !== undefined, 'second list numbered');
  assert.equal(two.slides[1].right.numbering, 'arabic');
  assert.equal(two.slides[1].left.numbering, undefined);
  mark('several lists on a slide');

  // Turn off numbering on the first slide: one edit removes numbering and entry starts; one Undo brings it all back.
  await dialog.locator('#numbering-close').click();
  await page.locator('#slide-list > *').first().click();
  await settle();
  await button('List numbering').click();
  await dialog.getByLabel('Number this list').uncheck();
  await waitDoc(current => current.slides[0].numbering === undefined, 'numbering off');
  await settle();
  await waitDrawn(['•', '◦', '◦', '•', '•'], 'bullets again');
  await dialog.locator('#numbering-close').click();
  await button('Undo').click();
  await waitDoc(current => Array.isArray(current.slides[0].numbering), 'one Undo restores the numbering');
  mark('turning numbering off is one undoable edit');

  assert.deepEqual(errors, []);
  console.log(`List numbering panel passed ${checks.length} browser checks: ${checks.join('; ')}.`);
} finally {
  await browser?.close();
  server.close();
}
