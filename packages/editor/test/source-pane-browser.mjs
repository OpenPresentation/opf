import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

// RR-98: the source pane (JSON, YAML and Markdown, inline findings) in the example harness, examples/source-pane.html.
const root = fileURLToPath(new URL('../artifacts/playground/', import.meta.url));
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const target = path.resolve(root, '.' + decodeURIComponent(url.pathname));
    const relative = path.relative(root, target);
    if (relative.startsWith('..') || path.isAbsolute(relative)) { res.writeHead(403).end(); return; }
    res.writeHead(200, { 'Content-Type': types[path.extname(target)] ?? 'application/octet-stream' }).end(await readFile(target));
  } catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser = await chromium.launch({ channel: process.platform === 'win32' && !process.env.CI ? 'msedge' : undefined });
  const context = await browser.newContext({ viewport: { width: 1200, height: 800 }, acceptDownloads: true });
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin });
  const errors = [], requests = [];
  const open = async (query = '') => {
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('request', request => { if (/^https?:/.test(request.url()) && !request.url().startsWith(origin)) requests.push(request.url()); });
    await page.goto(`${origin}/source-pane.html${query}`);
    await page.locator('.opf-source-code .cm-content').waitFor();
    return page;
  };
  const text = page => page.evaluate(() => demo.pane.getText());
  const deck = page => page.evaluate(() => demo.editor.presentation);
  const waitDeck = (page, check, arg) => page.waitForFunction(`(${check})(demo.editor.presentation, ${JSON.stringify(arg ?? null)})`, null, { timeout: 5000 });
  const selectIn = async (page, needle) => {
    await page.evaluate(needle => {
      const source = demo.pane.getText(), at = source.indexOf(needle);
      if (at < 0) throw new Error(`"${needle}" is not in the source`);
      demo.pane.editor.api.setSelection(at, at + needle.length);
      demo.pane.editor.api.focus();
    }, needle);
  };
  const line = page => page.evaluate(() => { const { state } = demo.pane.editor.view; return state.doc.lineAt(state.selection.main.head).number; });
  const menuButton = page => page.getByRole('button', { name: 'Source format', exact: true });
  const chooseFormat = async (page, label) => {
    await menuButton(page).click();
    await page.getByRole('menuitemradio', { name: new RegExp(`^${label}`) }).click();
  };

  const page = await open();
  const original = await text(page);
  assert.ok(original.startsWith('{\n  "name": "Minimal OPF Deck"'), 'the pane starts with the JSON the host gave it');
  assert.ok(original.includes('{ "title": "OWAA Rocks!" }'), 'authored formatting is shown');
  assert.equal(await page.locator('.opf-source-code .cm-lineNumbers .cm-gutterElement').count() > 5, true, 'line numbers are shown');
  assert.equal(await page.locator('.opf-source-findings').isHidden(), true, 'a valid deck has no findings list');

  // 1. JSON edit -> session, formatting kept, Undo restores the exact bytes.
  await selectIn(page, 'OWAA Rocks!');
  await page.keyboard.type('Typed title');
  await waitDeck(page, (d) => d.slides[0].title === 'Typed title');
  const typed = original.replace('OWAA Rocks!', 'Typed title');
  assert.equal(await text(page), typed, 'typing keeps every other byte');
  await page.evaluate(() => demo.editor.undo());
  await waitDeck(page, (d) => d.slides[0].title === 'OWAA Rocks!');
  assert.equal(await text(page), original, 'Undo restores the exact authored bytes');
  await page.evaluate(() => demo.editor.redo());
  assert.equal(await text(page), typed, 'Redo restores the typed bytes');
  await page.evaluate(() => demo.editor.undo());
  // An outside edit reaches the source, with the rest untouched.
  await page.getByRole('button', { name: 'Retitle slide 1 outside' }).click();
  assert.equal(await text(page), original.replace('OWAA Rocks!', 'Retitled outside the source'));
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  assert.equal(await text(page), original);
  // Broken JSON: a finding with its line, and the session keeps the last valid document.
  await selectIn(page, '"What This Shows",');
  await page.keyboard.type('"What This Shows" "x",');
  const findings = page.locator('.opf-source-findings');
  await findings.waitFor();
  assert.match(await findings.locator('.opf-source-findings-count').innerText(), /1 error/);
  assert.match(await findings.locator('.opf-source-finding-line').first().innerText(), /^Ln \d+$/);
  assert.equal((await deck(page)).slides[1].title, 'What This Shows', 'invalid JSON never reaches the session');
  // Deleting everything is an error too; an outside change then replaces the draft.
  await page.evaluate(() => demo.pane.editor.api.focus());
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
  await page.keyboard.press('Delete');
  await page.waitForFunction(() => document.querySelector('.opf-source-findings-count')?.textContent === '1 error');
  await page.getByRole('button', { name: 'Retitle slide 1 outside' }).click();
  await findings.waitFor({ state: 'hidden' });
  assert.equal(await text(page), original.replace('OWAA Rocks!', 'Retitled outside the source'), 'an outside change replaces the draft and keeps the spelling');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  assert.equal(await text(page), original);

  // 2. YAML round trip.
  await chooseFormat(page, 'YAML');
  const yaml = await text(page);
  assert.ok(yaml.startsWith('name: Minimal OPF Deck\nslides:\n  - title: OWAA Rocks!'), `YAML text: ${yaml}`);
  assert.equal(await menuButton(page).innerText(), '.opf.yaml');
  await selectIn(page, 'What This Shows');
  await page.keyboard.type('Plain YAML title');
  await waitDeck(page, (d) => d.slides[1].title === 'Plain YAML title');
  assert.equal(await text(page), yaml.replace('What This Shows', 'Plain YAML title'), 'YAML stays as typed');
  await selectIn(page, 'title: Plain YAML title');
  await page.keyboard.type('title: a: b');
  await findings.waitFor();
  assert.match(await findings.innerText(), /Ln \d+/);
  assert.equal((await deck(page)).slides[1].title, 'Plain YAML title', 'a YAML syntax error never reaches the session');
  await selectIn(page, 'title: a: b');
  await page.keyboard.type('title: Back to plain');
  await waitDeck(page, (d) => d.slides[1].title === 'Back to plain');
  await findings.waitFor({ state: 'hidden' });
  await chooseFormat(page, 'JSON');
  assert.equal(await text(page), original.replace('What This Shows', 'Back to plain'), 'back in JSON only the edited token changed');
  await page.evaluate(() => demo.editor.undo());
  await page.evaluate(() => demo.editor.undo());
  await page.evaluate(() => demo.editor.undo());
  assert.equal(await text(page), original, 'Undo through the YAML edits restores the authored JSON');

  // 3. Markdown round trip and its lossy warning.
  await chooseFormat(page, 'Markdown');
  const markdown = await text(page);
  assert.ok(markdown.startsWith('---\nname: Minimal OPF Deck\n---\n\n# OWAA Rocks!'), `Markdown text: ${markdown}`);
  assert.equal(await findings.isHidden(), true, 'plain slides are fully expressed in Markdown');
  await selectIn(page, '# OWAA Rocks!');
  await page.keyboard.type('# Markdown title');
  await waitDeck(page, (d) => d.slides[0].title === 'Markdown title');
  await page.evaluate(() => demo.editor.set('slides.0.design', { layout: 'title' }));
  await findings.waitFor();
  assert.match(await findings.locator('.opf-source-findings-count').innerText(), /1 warning/);
  const warning = findings.locator('.opf-source-finding');
  assert.equal(await warning.count(), 1);
  assert.equal(await warning.locator('.opf-source-finding-path').innerText(), '/slides/0/design');
  assert.match(await warning.locator('.opf-source-finding-message').innerText(), /no syntax for this/);
  assert.match(await text(page), /```opf-slide\ndesign:\n {2}layout: title\n```/, 'the part Markdown cannot express is kept as an embedded fence');
  await warning.click();
  const focused = await line(page);
  assert.equal(await page.evaluate(n => demo.pane.editor.view.state.doc.line(n).text, focused), '```opf-slide', 'the row moves the cursor to the fence');
  assert.equal(await warning.locator('.opf-source-finding-line').innerText(), `Ln ${focused}`);
  assert.equal(await page.evaluate(() => demo.log.at(-1).select), '/slides/0/design');
  await selectIn(page, 'layout: title');
  await page.keyboard.type('layout: title-center');
  await page.waitForFunction(() => demo.editor.presentation.slides[0].design.layout === 'title-center');
  await chooseFormat(page, 'JSON');
  assert.equal(JSON.parse(await text(page)).slides[0].design.layout, 'title-center');
  await findings.waitFor({ state: 'hidden' });
  await page.evaluate(() => { demo.editor.undo(); demo.editor.undo(); demo.editor.undo(); });
  assert.equal(await text(page), original);

  // 4. Rename.
  const rename = page.getByRole('button', { name: 'Rename deck' });
  await rename.click();
  const input = page.getByRole('textbox', { name: 'File name' });
  await input.fill('');
  await input.pressSequentially('my deck/v2 final');
  assert.equal(await input.inputValue(), 'my-deck-v2-final', 'spaces and slashes become hyphens as you type');
  await input.press('Enter');
  assert.equal(await page.getByRole('button', { name: 'Rename my-deck-v2-final' }).innerText(), 'my-deck-v2-final');
  assert.equal(await input.isHidden(), true);
  assert.deepEqual(await page.evaluate(() => demo.log.filter(entry => entry.rename)), [{ rename: 'my-deck-v2-final' }]);
  await page.getByRole('button', { name: 'Rename my-deck-v2-final' }).click();
  await input.fill('esc name');
  await input.press('Escape');
  assert.equal(await page.evaluate(() => demo.pane.getName()), 'esc-name', 'Escape commits like Enter');
  await page.getByRole('button', { name: 'Rename esc-name' }).click();
  await input.fill('');
  await input.press('Enter');
  assert.equal(await page.evaluate(() => demo.pane.getName()), 'deck', 'an empty name falls back to deck');
  assert.equal(await page.evaluate(() => document.activeElement.className), 'opf-source-name', 'focus returns to the name');

  // 5. Format menu: a real menu with arrow keys, Home, End, Escape and Enter.
  const trigger = menuButton(page);
  assert.equal(await trigger.getAttribute('aria-haspopup'), 'menu');
  assert.equal(await trigger.getAttribute('aria-expanded'), 'false');
  await trigger.focus();
  await page.keyboard.press('ArrowDown');
  const menu = page.getByRole('menu', { name: 'Source format' });
  await menu.waitFor();
  assert.equal(await trigger.getAttribute('aria-expanded'), 'true');
  const items = menu.getByRole('menuitemradio');
  assert.deepEqual(await items.allInnerTexts().then(all => all.map(entry => entry.split('\n')[0])), ['JSON', 'YAML', 'Markdown']);
  assert.match(await menu.innerText(), /The canonical OPF document\.[\s\S]*Same fields, less punctuation\.[\s\S]*Settings up top, one heading per slide\./);
  const focusedLabel = () => page.evaluate(() => document.activeElement.dataset.format);
  assert.equal(await focusedLabel(), 'json', 'opening focuses the current format');
  await page.keyboard.press('ArrowDown'); assert.equal(await focusedLabel(), 'yaml');
  await page.keyboard.press('End'); assert.equal(await focusedLabel(), 'md');
  await page.keyboard.press('ArrowDown'); assert.equal(await focusedLabel(), 'json', 'the arrow keys wrap');
  await page.keyboard.press('ArrowUp'); assert.equal(await focusedLabel(), 'md');
  await page.keyboard.press('Home'); assert.equal(await focusedLabel(), 'json');
  await page.keyboard.press('Escape');
  await menu.waitFor({ state: 'hidden' });
  assert.equal(await page.evaluate(() => document.activeElement.getAttribute('aria-label')), 'Source format', 'Escape returns focus to the button');
  await page.keyboard.press('ArrowUp');
  assert.equal(await focusedLabel(), 'md', 'ArrowUp on the button opens at the last item');
  await page.keyboard.press('Enter');
  await menu.waitFor({ state: 'hidden' });
  assert.equal(await menuButton(page).innerText(), '.opf.md');
  assert.deepEqual(await page.evaluate(() => demo.log.filter(entry => entry.format).at(-1)), { format: 'md', previous: 'json' });
  await trigger.click();
  assert.equal(await menu.getByRole('menuitemradio', { checked: true }).getAttribute('data-format'), 'md');
  await page.mouse.click(900, 600);
  await menu.waitFor({ state: 'hidden' });
  await page.evaluate(() => demo.pane.setFormat('json'));
  assert.equal(await menuButton(page).innerText(), '.opf.json');

  // 7. Copy and Download (default behavior).
  await page.getByRole('button', { name: 'Copy source' }).click();
  await page.getByRole('status').filter({ hasText: 'Copied' }).waitFor();
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), original);
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download source' }).click()]);
  assert.equal(download.suggestedFilename(), 'deck.opf.json');
  assert.equal(await readFile(await download.path(), 'utf8'), original);
  await chooseFormat(page, 'YAML');
  const [yamlDownload] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download source' }).click()]);
  assert.equal(yamlDownload.suggestedFilename(), 'deck.opf.yaml');
  await page.getByRole('button', { name: 'Copy source' }).click();
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), await text(page));
  // Format (fix indentation) rewrites YAML from the document and reports what it dropped.
  await selectIn(page, 'name: Minimal OPF Deck');
  await page.keyboard.type('# a comment\nname:   Minimal OPF Deck');
  await page.getByRole('button', { name: 'Format (fix indentation)' }).click();
  await findings.waitFor();
  assert.match(await findings.locator('.opf-source-finding-message').first().innerText(), /1 comment in the YAML was dropped/);
  assert.equal((await text(page)).startsWith('name: Minimal OPF Deck\n'), true);
  await chooseFormat(page, 'JSON');

  // Hooks replace the defaults.
  const hooks = await page.evaluate(async () => {
    const host = document.createElement('div');
    document.body.append(host);
    const calls = [];
    const pane = demo.createSourcePane(host, {
      editor: demo.createEditorSession({ name: 'Hooked', slides: [{ title: 'T' }] }), name: 'my deck', format: 'md', applyDelay: 0,
      onCopy: file => { calls.push(['copy', file.filename, file.format, file.text.length > 0]); },
      onDownload: file => { calls.push(['download', file.filename, file.mime]); },
    });
    host.querySelector('[aria-label="Copy source"]').click();
    host.querySelector('[aria-label="Download source"]').click();
    await new Promise(resolve => setTimeout(resolve, 50));
    pane.destroy();
    return { calls, left: host.children.length };
  });
  assert.deepEqual(hooks.calls, [['copy', 'my-deck.opf.md', 'md', true], ['download', 'my-deck.opf.md', 'text/markdown']]);
  assert.equal(hooks.left, 0, 'destroy removes the pane');

  // A session that refuses invalid documents: the pane lists why and the document stays as it was.
  const refused = await page.evaluate(async () => {
    const host = document.createElement('div');
    document.body.append(host);
    const session = demo.createEditorSession({ name: 'Strict', slides: [{ title: 'T' }] }, { rejectInvalid: true });
    const pane = demo.createSourcePane(host, { editor: session, format: 'yaml', applyDelay: 0 });
    const api = pane.editor.api;
    api.replace(0, api.getValue().length, 'name: Strict\nslides:\n  - title: 42\n');
    const result = { title: session.presentation.slides[0].title, text: host.querySelector('.opf-source-findings')?.innerText, kinds: [...host.querySelectorAll('.opf-source-finding')].map(row => row.dataset.kind) };
    api.replace(0, api.getValue().length, 'name: Strict\nslides:\n  - title: Fine\n');
    result.after = session.presentation.slides[0].title;
    result.hidden = host.querySelector('.opf-source-findings').hidden;
    pane.destroy();
    return result;
  });
  assert.equal(refused.title, 'T', 'a refused edit never reaches the document');
  assert.match(refused.text, /must be string/);
  assert.deepEqual(refused.kinds, ['rejected']);
  assert.equal(refused.after, 'Fine');
  assert.equal(refused.hidden, true);

  // Density and read only.
  const buttonSize = () => page.getByRole('button', { name: 'Copy source' }).evaluate(node => node.getBoundingClientRect().width);
  assert.equal(await buttonSize(), 32);
  await page.getByRole('button', { name: 'Touch density' }).click();
  assert.equal(await buttonSize(), 40);
  await page.getByRole('button', { name: 'Toggle read only' }).click();
  assert.equal(await page.locator('.opf-source-code .cm-content').getAttribute('contenteditable'), 'false');
  assert.equal(await page.getByRole('button', { name: 'Rename deck' }).isDisabled(), true);
  await page.close();

  // 6. Findings: the design's broken-deck state; rows go to their line; the list collapses.
  const broken = await open('?deck=broken');
  const list = broken.locator('.opf-source-findings');
  await list.waitFor();
  assert.equal(await list.locator('.opf-source-findings-count').innerText(), '2 schema errors');
  const rows = list.locator('.opf-source-finding');
  assert.equal(await rows.count(), 2);
  assert.deepEqual(await rows.locator('.opf-source-finding-path').allInnerTexts(), ['/slides/0/title', '/slides/1/items']);
  const shown = await rows.locator('.opf-source-finding-line').allInnerTexts();
  const brokenText = await text(broken);
  const expected = path => brokenText.slice(0, brokenText.indexOf(path)).split('\n').length;
  assert.deepEqual(shown, [`Ln ${expected('"title": 42')}`, `Ln ${expected('"items":')}`]);
  await rows.nth(1).click();
  assert.equal(await line(broken), expected('"items":'), 'a row moves the cursor to its line');
  await rows.nth(0).click();
  assert.equal(await line(broken), expected('"title": 42'));
  assert.deepEqual(await broken.evaluate(() => demo.log.map(entry => entry.select)), ['/slides/1/items', '/slides/0/title']);
  assert.equal(await broken.evaluate(() => demo.pane.focusPath('/slides/1/title')), expected('"title": "Agenda"'));
  const header = list.getByRole('button', { name: /2 schema errors/ });
  assert.equal(await header.getAttribute('aria-expanded'), 'true');
  await header.click();
  assert.equal(await header.getAttribute('aria-expanded'), 'false');
  assert.equal(await rows.first().isHidden(), true);
  await header.click();
  assert.equal(await rows.first().isVisible(), true);
  // setFindings: the host passes core validator output, with its own line.
  await broken.evaluate(() => demo.pane.setFindings([{ ruleId: 'opf/schema', severity: 'warning', path: '/name', message: 'Host note', line: 2 }]));
  assert.equal(await list.locator('.opf-source-findings-count').innerText(), '1 warning');
  assert.equal(await rows.locator('.opf-source-finding-line').innerText(), 'Ln 2');
  await broken.evaluate(() => demo.pane.setFindings([]));
  await list.waitFor({ state: 'hidden' });
  await broken.evaluate(() => demo.pane.setFindings(null));
  await list.waitFor();
  // A document that is not valid OPF cannot be written as YAML: the pane says so and stays in JSON.
  assert.equal(await broken.evaluate(() => demo.pane.setFormat('yaml')), false);
  assert.equal(await broken.evaluate(() => demo.pane.getFormat()), 'json');
  assert.match(await list.innerText(), /cannot be written as YAML/);
  await broken.close();

  assert.deepEqual(requests, [], 'the pane makes no network requests');
  assert.deepEqual(errors, []);
  console.log('Source pane: JSON, YAML and Markdown edit the session; findings, rename, menu, copy and download work.');
} finally {
  await browser?.close();
  server.close();
}
