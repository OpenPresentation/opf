import assert from 'node:assert/strict';
import { startPlayground } from './support/playground-harness.mjs';

// RR-25 in a real browser, on the built playground: deck-wide find and replace. Keyboard (Ctrl+F, Ctrl+H, Enter, Shift+Enter,
// F3, Ctrl+Alt+Enter, Esc), the match case / whole word / regex options, the results list going to the match on the canvas
// (another slide, a list item, a table cell, speaker notes), replace one and replace all as one undo step each, rich-text
// formatting kept, an invalid pattern reported without breaking the page, and the accessible names the panel exposes.
const source = {
  name: 'Acme review',
  design: { theme: 'classic', fontScheme: 'roboto' },
  slides: [
    { id: 'one', title: 'Acme grows', subtitle: 'The Acme story', notes: 'Mention Acme first.', text: [{ text: 'Acme ', bold: true }, { text: 'is the best', italic: true }, ' place to work'] },
    { id: 'two', title: 'Numbers', items: ['Acme revenue', 'Cost of acme', 'Profit'] },
    { id: 'three', title: 'Table', blocks: [{ table: { columns: ['Region', 'Acme units'], rows: [['north', 'a'], ['Acme south', 'b']] } }, { quote: { text: 'Acme is great', attribution: 'A fan' } }] },
    { id: 'four', title: 'Words', text: 'cat concatenate cat. Q1 and Q22.' },
  ],
};

const app = await startPlayground({ source });
const { page, errors } = app;
const checks = [];
const mark = (name) => checks.push(name);
try {
  const panel = page.locator('.opf-find');
  const find = panel.getByLabel('Find', { exact: true });
  const replacement = panel.getByLabel('Replace with');
  const count = page.locator('.opf-find-count');
  const results = page.locator('.opf-find-result');
  const selectedPath = () => page.evaluate(() => document.querySelector('#preview [data-canvas-selected]')?.getAttribute('data-opf-path') ?? null);

  // Ctrl+F opens the panel with the find field focused; Esc closes it and gives focus back.
  assert.equal(await panel.isHidden(), true);
  await page.locator('#preview [data-canvas-target]').first().focus();
  await page.keyboard.press('Control+f');
  await panel.waitFor({ state: 'visible' });
  assert.equal(await page.evaluate(() => document.activeElement.id.endsWith('-find')), true, 'the find field has the focus');
  assert.equal(await panel.getAttribute('role'), 'dialog');
  assert.equal(await panel.getAttribute('aria-label'), 'Find and replace');
  assert.equal(await panel.getByLabel('Replace with').isHidden(), true, 'Ctrl+F shows find only');
  await page.keyboard.press('Escape');
  await panel.waitFor({ state: 'hidden' });
  assert.equal(await page.evaluate(() => document.activeElement?.hasAttribute('data-canvas-target')), true, 'focus returns to where it was');
  mark('Ctrl+F opens and Esc closes with focus restored');

  // Ctrl+H opens find and replace.
  await page.keyboard.press('Control+h');
  await replacement.waitFor({ state: 'visible' });
  assert.equal(await page.locator('.opf-find strong').textContent(), 'Find and replace');
  mark('Ctrl+H opens find and replace');

  // Search the whole deck. Matches in titles, subtitle, notes, rich text, list, table, quote.
  await find.fill('acme');
  await page.waitForFunction(() => /matches in/.test(document.querySelector('.opf-find-count').textContent));
  const total = await results.count();
  assert.ok(total >= 9, `found matches across the deck: ${total}`);
  assert.match(await count.textContent(), /^\d+ of \d+ matches in 3 slides? and the presentation settings|^\d+ of \d+ matches in 3 slides?$/);
  const whereLabels = await page.locator('.opf-find-where').allTextContents();
  assert.ok(whereLabels.includes('Slide 1 · Speaker notes'), `notes are searched: ${whereLabels}`);
  assert.ok(whereLabels.some((label) => /^Slide 2 · List item 2$/.test(label)), 'list items are searched');
  assert.ok(whereLabels.some((label) => /^Slide 3 · Block 1 · Table header 2$/.test(label)), 'table cells are searched');
  assert.ok(whereLabels.some((label) => /^Presentation · Presentation name$/.test(label)), 'the presentation name is searched');
  assert.equal(await page.locator('.opf-find-result mark').first().evaluate((node) => node.tagName), 'MARK');
  mark(`finds text in titles, notes, rich text, lists, tables and the presentation name (${total} matches)`);

  // Match case / whole word / regex change the result.
  await panel.getByLabel('Match case').check();
  await page.waitForFunction((before) => document.querySelectorAll('.opf-find-result').length < before, total);
  const sensitive = await results.count();
  assert.ok(sensitive < total && sensitive > 0);
  await panel.getByLabel('Match case').uncheck();
  await find.fill('cat');
  assert.equal(await results.count(), 3, 'cat matches inside concatenate too');
  await panel.getByLabel('Whole word').check();
  assert.equal(await results.count(), 2, 'whole word skips concatenate');
  await panel.getByLabel('Whole word').uncheck();
  await panel.getByLabel('Regex').check();
  await find.fill('Q\\d+');
  assert.deepEqual(await page.locator('.opf-find-result mark').allTextContents(), ['Q1', 'Q22']);
  await find.fill('(');
  await page.waitForFunction(() => document.querySelector('.opf-find-error').textContent.length > 0);
  assert.match(await page.locator('.opf-find-error').textContent(), /Not a valid regular expression/);
  assert.equal(await find.getAttribute('aria-invalid'), 'true');
  assert.equal(await panel.getByRole('button', { name: 'Replace all' }).isDisabled(), true);
  await find.fill('Q(\\d)');
  assert.equal(await find.getAttribute('aria-invalid'), 'false');
  await panel.getByLabel('Regex').uncheck();
  mark('match case, whole word and regex options; an invalid pattern is reported and disables replacing');

  // Go to: a result on another slide selects that slide and the canvas target (a list item selects its list).
  await find.fill('acme');
  await page.waitForFunction(() => document.querySelectorAll('.opf-find-result').length > 5);
  await results.filter({ hasText: 'Slide 2 · List item 2' }).click();
  await page.waitForFunction(() => [...document.querySelector('#slide-list').children].findIndex((node) => node.getAttribute('aria-current') === 'true') === 1);
  await app.settle();
  await page.waitForFunction(() => document.querySelector('#preview [data-canvas-selected]'));
  assert.match(await selectedPath(), /^slides\.1\.items(\.1)?$/, `the list is selected on the canvas: ${await selectedPath()}`);
  assert.equal(await results.filter({ hasText: 'Slide 2 · List item 2' }).getAttribute('aria-current'), 'true');
  // A table cell on slide 3.
  await results.filter({ hasText: 'Slide 3 · Block 1 · Table header 2' }).click();
  await page.waitForFunction(() => [...document.querySelector('#slide-list').children].findIndex((node) => node.getAttribute('aria-current') === 'true') === 2);
  await app.settle();
  await page.waitForFunction(() => /^slides\.2\.blocks\.0/.test(document.querySelector('#preview [data-canvas-selected]')?.getAttribute('data-opf-path') ?? ''));
  // Speaker notes: the notes box gets the focus with the match selected.
  await results.filter({ hasText: 'Slide 1 · Speaker notes' }).click();
  await page.waitForFunction(() => document.activeElement?.id === 'notes');
  assert.equal(await page.evaluate(() => { const n = document.querySelector('#notes'); return n.value.slice(n.selectionStart, n.selectionEnd); }), 'Acme');
  mark('go to selects the slide and the canvas content, or focuses notes with the match selected');

  // Enter / Shift+Enter / F3 move between matches.
  await find.focus();
  const first = await count.textContent();
  await page.keyboard.press('Enter');
  await page.waitForFunction((was) => document.querySelector('.opf-find-count').textContent !== was, first);
  const second = await count.textContent();
  await page.keyboard.press('Shift+Enter');
  await page.waitForFunction((was) => document.querySelector('.opf-find-count').textContent !== was, second);
  assert.equal(await count.textContent(), first);
  await page.keyboard.press('F3');
  await page.waitForFunction((was) => document.querySelector('.opf-find-count').textContent !== was, first);
  mark('Enter, Shift+Enter and F3 step through matches');

  // Replace one: one undo step, the next match is current, formatting stays.
  await panel.getByLabel('Match case').check();
  await find.fill('Acme');
  await replacement.fill('Globex');
  await page.waitForFunction(() => document.querySelectorAll('.opf-find-result').length > 0);
  const before = await app.doc();
  const startCount = await results.count();
  await results.filter({ hasText: 'Slide 1 · Text' }).click();
  await panel.getByRole('button', { name: 'Replace', exact: true }).click();
  await app.waitDoc((deck) => JSON.stringify(deck.slides[0].text) === JSON.stringify([{ text: 'Globex ', bold: true }, { text: 'is the best', italic: true }, ' place to work']), 'rich text replaced in place');
  await page.waitForFunction((n) => document.querySelectorAll('.opf-find-result').length === n - 1, startCount);
  await page.locator('#undo').click();
  await app.waitDoc((deck) => JSON.stringify(deck) === JSON.stringify(before), 'one undo restores one replacement');
  mark('replace one: formatting kept, one undo step');

  // Replace all: one undo step.
  await panel.getByRole('button', { name: 'Replace all' }).click();
  const replaced = await app.waitDoc((deck) => deck.name === 'Globex review', 'replaced everywhere');
  assert.equal(replaced.slides[0].title, 'Globex grows');
  assert.equal(replaced.slides[0].notes, 'Mention Globex first.');
  assert.equal(replaced.slides[1].items[0], 'Globex revenue');
  assert.equal(replaced.slides[1].items[1], 'Cost of acme', 'match case left lower case alone');
  assert.equal(replaced.slides[2].blocks[0].table.columns[1], 'Globex units');
  assert.equal(replaced.slides[2].blocks[0].table.rows[1][0], 'Globex south');
  assert.equal(replaced.slides[2].blocks[1].quote.text, 'Globex is great');
  assert.deepEqual(replaced.slides[0].text[0], { text: 'Globex ', bold: true });
  await page.waitForFunction(() => /^Replaced \d+ matches? in \d+ text fields?\. One undo restores them\./.test(document.querySelector('.opf-find-count').textContent));
  await page.getByRole('button', { name: 'Undo', exact: true }).filter({ hasText: 'Undo' }).last().click();
  await app.waitDoc((deck) => JSON.stringify(deck) === JSON.stringify(before), 'one undo restores everything');
  mark('replace all: one undo step restores every field');

  // Keyboard replace all with Ctrl+Alt+Enter, then the toolbar Undo.
  await replacement.focus();
  await page.keyboard.press('Control+Alt+Enter');
  await app.waitDoc((deck) => deck.name === 'Globex review', 'Ctrl+Alt+Enter replaces all');
  await page.locator('#undo').click();
  await app.waitDoc((deck) => deck.name === 'Acme review', 'toolbar undo');
  mark('Ctrl+Alt+Enter replaces all');

  // Regex replacement with groups.
  await panel.getByLabel('Match case').uncheck();
  await panel.getByLabel('Regex').check();
  await find.fill('Q(\\d+) and Q(\\d+)');
  await replacement.fill('Q$2 and Q$1');
  await page.waitForFunction(() => document.querySelectorAll('.opf-find-result').length === 1);
  await panel.getByRole('button', { name: 'Replace all' }).click();
  await app.waitDoc((deck) => deck.slides[3].text === 'cat concatenate cat. Q22 and Q1.', 'regex groups');
  await page.locator('#undo').click();
  await panel.getByLabel('Regex').uncheck();
  mark('regex replacement with capture groups');

  // This slide only.
  await find.fill('Acme');
  await replacement.fill('Zed');
  await panel.getByLabel('This slide only').check();
  await page.waitForFunction(() => document.querySelectorAll('.opf-find-result').length >= 1);
  const slideOnly = await results.count();
  assert.ok(slideOnly < total);
  await panel.getByLabel('This slide only').uncheck();

  // Inline editing: Ctrl+F while a text edit is open commits it first, and a draft is never lost.
  await page.keyboard.press('Escape');
  await page.locator('#slide-list button').nth(0).click();
  await app.settle();
  await page.locator('#preview [data-canvas-target][data-opf-path="slides.0.title"]').click();
  await page.waitForSelector('.opf-inline-input');
  await page.keyboard.type('X');
  await page.keyboard.press('Control+f');
  await panel.waitFor({ state: 'visible' });
  await find.fill('Acme');
  await panel.getByLabel('Match case').uncheck();
  const typed = await app.doc();
  assert.ok(/X/.test(typed.slides[0].title), `the open edit was committed, not lost: ${typed.slides[0].title}`);
  await page.waitForFunction(() => document.querySelectorAll('.opf-find-result').length > 0);
  mark('Ctrl+F while editing text commits the edit and searches');

  // Accessibility: every control has an accessible name; the count is a live region; the panel is a labelled dialog.
  const unlabeled = await page.evaluate(() => [...document.querySelectorAll('.opf-find input, .opf-find button')].filter((node) => !(node.labels?.length || node.getAttribute('aria-label') || node.textContent.trim())).map((node) => node.outerHTML.slice(0, 80)));
  assert.deepEqual(unlabeled, []);
  assert.equal(await count.getAttribute('aria-live'), 'polite');
  assert.equal(await page.locator('.opf-find-error').getAttribute('role'), 'alert');
  assert.ok((await page.locator('.opf-find-results').getAttribute('aria-label')) === 'Matches');
  for (const key of ['Control+F', 'Control+H']) assert.ok((await page.locator('#find-open').getAttribute('aria-keyshortcuts')).includes(key));
  mark('panel controls are labelled; count is a polite live region; errors are alerts');

  // The panel stays out of a modal dialog (the source editor keeps its own find).
  await page.keyboard.press('Escape');
  await page.locator('#open-json').click();
  await page.locator('#source-dialog[open]').waitFor();
  await page.keyboard.press('Control+f');
  assert.equal(await panel.isHidden(), true, 'Ctrl+F belongs to the open dialog');
  await page.locator('#close-json').click();
  mark('a modal dialog keeps its own Ctrl+F');

  assert.deepEqual(errors, []);
  console.log(`Find and replace (browser): ${checks.length} checks. ${checks.join('; ')}.`);
} catch (error) {
  console.error('Page errors:', errors, 'status:', await page.locator('#status').textContent().catch(() => '?'));
  throw error;
} finally {
  await app.close();
}
