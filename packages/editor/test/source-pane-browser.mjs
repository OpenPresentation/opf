import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { gallery } from '@openpresentation/gallery';
import { fromYaml, toYaml } from '@openpresentation/opf/yaml';
import { toMarkdown } from '@openpresentation/opf/markdown';
import { prepareSave } from '../dist/index.js';

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

  // RR-98: the editor inside the pane frame has no border or radius of its own, and no stray focus outline.
  const frame = await open();
  assert.deepEqual(await frame.evaluate(() => { const style = getComputedStyle(document.querySelector('.opf-source-code > .cm-editor')); return [style.borderTopWidth, style.borderRightWidth, style.borderBottomWidth, style.borderLeftWidth, style.borderTopLeftRadius, style.borderBottomRightRadius]; }), ['0px', '0px', '0px', '0px', '0px', '0px'], 'the pane editor is borderless');
  // aria-invalid follows the findings: set for a syntax error and a refused draft, cleared when they go.
  const invalid = () => frame.locator('.opf-source-code .cm-content').getAttribute('aria-invalid');
  assert.equal(await invalid(), 'false', 'a valid document is not invalid');
  await selectIn(frame, '"What This Shows",');
  await frame.keyboard.type('"What This Shows" "x",');
  await frame.locator('.opf-source-findings').waitFor();
  assert.equal(await invalid(), 'true', 'a syntax error sets aria-invalid');
  await selectIn(frame, '"What This Shows" "x",');
  await frame.keyboard.type('"What This Shows",');
  await frame.locator('.opf-source-findings').waitFor({ state: 'hidden' });
  assert.equal(await invalid(), 'false', 'fixing the text clears aria-invalid');
  const strict = await frame.evaluate(async () => {
    const host = document.createElement('div');
    host.style.height = '400px';
    document.body.append(host);
    const session = demo.createEditorSession({ name: 'Strict', slides: [{ title: 'T' }] }, { rejectInvalid: true });
    const pane = demo.createSourcePane(host, { editor: session, applyDelay: 0 });
    const api = pane.editor.api, content = host.querySelector('.cm-content');
    const result = { initial: content.getAttribute('aria-invalid') };
    // Three problems in one draft: the session refuses it, and every one is listed with its path and line.
    api.replace(0, api.getValue().length, JSON.stringify({ name: 'Strict', slides: [{ title: 42 }, { title: 'Agenda', items: 'One string, not an array' }, { title: 'Third', unknown: true }] }, null, 2));
    result.refusedInvalid = content.getAttribute('aria-invalid');
    result.count = host.querySelector('.opf-source-findings-count').textContent;
    result.paths = [...host.querySelectorAll('.opf-source-finding-path')].map(node => node.textContent);
    result.messages = [...host.querySelectorAll('.opf-source-finding-message')].map(node => node.textContent);
    result.lines = [...host.querySelectorAll('.opf-source-finding-line')].map(node => node.textContent);
    result.kinds = [...host.querySelectorAll('.opf-source-finding')].map(node => node.dataset.kind);
    result.text = api.getValue();
    result.title = session.presentation.slides[0].title;
    api.replace(0, api.getValue().length, JSON.stringify({ name: 'Strict', slides: [{ title: 'Fine' }] }, null, 2));
    result.fixedInvalid = content.getAttribute('aria-invalid');
    result.fixedHidden = host.querySelector('.opf-source-findings').hidden;
    // A session whose own document has errors is invalid too.
    const broken = demo.createEditorSession({ name: 'Broken', slides: [{ title: 42 }] });
    const brokenHost = document.createElement('div');
    document.body.append(brokenHost);
    const brokenPane = demo.createSourcePane(brokenHost, { editor: broken, applyDelay: 0 });
    result.sessionInvalid = brokenHost.querySelector('.cm-content').getAttribute('aria-invalid');
    brokenPane.setFindings([]);
    result.hostClearedInvalid = brokenHost.querySelector('.cm-content').getAttribute('aria-invalid');
    brokenPane.destroy();
    pane.destroy();
    return result;
  });
  assert.equal(strict.initial, 'false');
  assert.equal(strict.title, 'T', 'the refused draft never reaches the session');
  assert.equal(strict.refusedInvalid, 'true', 'a refused draft sets aria-invalid');
  assert.equal(strict.count, '3 errors', 'the pane counts every issue of the rejection, as the validator does');
  assert.deepEqual(strict.paths, ['/slides/0/title', '/slides/1/items', '/slides/2/unknown'], 'each issue has its JSON pointer');
  assert.equal(strict.messages.length, 3);
  assert.ok(strict.messages.every(message => message.length > 0));
  assert.deepEqual(strict.kinds, ['rejected', 'rejected', 'rejected']);
  const strictLines = path => strict.text.slice(0, strict.text.indexOf(path)).split('\n').length;
  assert.deepEqual(strict.lines, [`Ln ${strictLines('"title": 42')}`, `Ln ${strictLines('"items":')}`, `Ln ${strictLines('"unknown"')}`], 'each issue has its line');
  assert.equal(strict.fixedInvalid, 'false', 'accepting the next draft clears aria-invalid');
  assert.equal(strict.fixedHidden, true);
  assert.equal(strict.sessionInvalid, 'true', 'errors in the session document set aria-invalid');
  assert.equal(strict.hostClearedInvalid, 'false', 'host findings without errors clear it');
  await frame.close();

  // RR-98: live completions while typing JSON, from the same data as the field menu.
  const typing = await open();
  const popup = typing.locator('.cm-tooltip-autocomplete');
  const options = () => popup.locator('[role="option"]');
  const cursorAfter = async needle => typing.evaluate(needle => {
    const source = demo.pane.getText(), at = source.indexOf(needle);
    if (at < 0) throw new Error(`"${needle}" is not in the source`);
    demo.pane.editor.api.setSelection(at + needle.length);
    demo.pane.editor.api.focus();
  }, needle);
  // CodeMirror ignores Enter while the popup is stale (a query for the last keystroke is pending: `cm-tooltip-autocomplete-disabled`) and
  // for its 75 ms interaction delay after the popup opens, and inserts a newline instead. A key press at that moment is the user's
  // race, not the test's subject, so wait on the popup's state: a settled, selected option, on a popup that has been open that long.
  const acceptable = (label, minAge = 150) => typing.waitForFunction(({ label, minAge }) => {
    const node = document.querySelector('.cm-tooltip-autocomplete');
    if (!node || node.classList.contains('cm-tooltip-autocomplete-disabled')) return false;
    if (node.querySelector('[aria-selected="true"] .cm-completionLabel')?.textContent !== label) return false;
    node.dataset.openedAt ??= String(performance.now());
    return performance.now() - Number(node.dataset.openedAt) >= minAge;
  }, { label, minAge }, { timeout: 5000 });
  assert.equal(await typing.locator('.opf-source-code .cm-content').getAttribute('aria-autocomplete'), 'list', 'the editor announces its completion list');
  await cursorAfter('"OWAA Rocks!"');
  await typing.keyboard.type(', "lay');
  await popup.waitFor();
  assert.deepEqual(await options().locator('.cm-completionLabel').allInnerTexts(), ['layout'], 'typing a key offers the matching property names');
  // CodeMirror places a tooltip after it measures the editor, so the first box can still be at its unplaced position: wait for the placed one.
  const inside = await popup.evaluate(node => new Promise(resolve => {
    const started = performance.now();
    const check = () => {
      const box = node.getBoundingClientRect();
      const ok = box.width > 0 && box.x >= 0 && box.y >= 0 && box.x + box.width <= 1200 && box.y + box.height <= 800;
      if (ok || performance.now() - started > 3000) resolve({ ok, box: [box.x, box.y, box.width, box.height] });
      else requestAnimationFrame(check);
    };
    check();
  }));
  assert.ok(inside.ok, `the popup is inside the page (${inside.box})`);
  assert.notEqual(await popup.locator('[aria-selected="true"]').evaluate(node => getComputedStyle(node).backgroundColor), 'rgb(17, 119, 204)', 'the selected option uses the token color, not the default blue');
  await acceptable('layout');
  await typing.keyboard.press('Enter');
  assert.ok((await text(typing)).includes('{ "title": "OWAA Rocks!", "layout":  }'), `a key is completed with its colon: ${await text(typing)}`);
  // The values of that key are offered right away.
  await popup.waitFor();
  const layouts = await options().locator('.cm-completionLabel').allInnerTexts();
  assert.ok(layouts.includes('text') && layouts.includes('cover') && layouts.length > 10, `a catalog field offers its records: ${layouts}`);
  await typing.keyboard.type('"tex');
  await typing.waitForFunction(() => document.querySelector('.cm-tooltip-autocomplete [aria-selected="true"] .cm-completionLabel')?.textContent === 'text' && document.querySelectorAll('.cm-tooltip-autocomplete [role="option"]').length < 5, null, { timeout: 5000 });
  assert.ok((await options().locator('.cm-completionLabel').allInnerTexts()).includes('text'), 'typing narrows the list');
  await acceptable('text');
  await typing.keyboard.press('Enter');
  assert.ok((await text(typing)).includes('"layout": "text" }'), `a value replaces the whole token, quotes included: ${await text(typing)}`);
  await popup.waitFor({ state: 'hidden' });
  await waitDeck(typing, (d) => d.slides[0].layout === 'text');
  assert.equal(await typing.locator('.opf-source-findings').isHidden(), true, 'the completed draft is valid');
  // Escape closes the popup and keeps the typed text; Ctrl+Space still opens the field menu, not the popup.
  await typing.keyboard.press('Backspace');
  await typing.keyboard.press('Backspace');
  await typing.keyboard.type('"');
  await typing.keyboard.press('Escape');
  await popup.waitFor({ state: 'hidden' });
  await typing.keyboard.press('Control+Space');
  await typing.locator('.json-field-menu').waitFor();
  assert.equal(await popup.count(), 0, 'Ctrl+Space opens the field menu, not the completion popup');
  await typing.keyboard.press('Escape');
  // An enum value, bare, in a field of the schema: a tone is offered inside quotes.
  await typing.evaluate(() => { demo.pane.editor.api.setSelection(1); demo.pane.editor.api.focus(); });
  await typing.keyboard.type('"tone": "cas');
  await popup.waitFor();
  assert.ok((await options().locator('.cm-completionLabel').allInnerTexts()).includes('casual'), 'tone values come from the registered catalog');
  await typing.keyboard.press('Escape');
  // A free text field offers nothing.
  await typing.evaluate(() => { const source = demo.pane.getText(), at = source.indexOf('"Minimal OPF Deck"') + 'Minimal OPF Deck"'.length; demo.pane.editor.api.setSelection(at - 1); demo.pane.editor.api.focus(); });
  await typing.keyboard.type('x');
  await typing.waitForTimeout(300);
  assert.equal(await popup.count(), 0, 'a free text field has no completions');
  // YAML keeps the menu only.
  await chooseFormat(typing, 'YAML');
  await typing.evaluate(() => { demo.pane.editor.api.setSelection(demo.pane.getText().length); demo.pane.editor.api.focus(); });
  await typing.keyboard.type('\n  - lay');
  await typing.waitForTimeout(300);
  assert.equal(await popup.count(), 0, 'YAML has no live completions');
  await typing.close();
  // completions: false turns the popup off in JSON too.
  const off = await open('?completions=off');
  await off.evaluate(() => { const source = demo.pane.getText(), at = source.indexOf('"OWAA Rocks!"') + 13; demo.pane.editor.api.setSelection(at); demo.pane.editor.api.focus(); });
  await off.keyboard.type(', "lay');
  await off.waitForTimeout(400);
  assert.equal(await off.locator('.cm-tooltip-autocomplete').count(), 0, '`completions: false` keeps the field menu only');
  assert.equal(await off.locator('.opf-source-code .cm-content').getAttribute('aria-autocomplete'), null);
  await off.close();

  // RR-98: opening an example over another replaces the whole document: no catalog record is forked, Undo restores the previous
  // document and its source text byte for byte, and Redo brings the opened one back.
  {
    const embedded = (document) => prepareSave(document, { catalogs: [gallery] }).document;
    const conference = embedded({ name: 'Conference talk', slides: [{ id: 'a1', title: 'Opening', layout: 'cover' }, { id: 'a2', title: 'Body', text: 'Alpha', layout: 'text' }] });
    const tour = embedded({ name: 'Full feature tour', slides: [{ id: 'b1', title: 'Tour', layout: 'cover' }, { id: 'b2', title: 'More', text: 'Beta' }] });
    // Two examples published at different times: the same record id with other content.
    tour.catalogs.default.layouts.cover.name = 'Cover, newer catalog build';
    const conferenceText = JSON.stringify(conference, null, '\t') + '\n';
    const tourText = JSON.stringify(tour, null, 4);
    const customIds = (document) => Object.values(document.catalogs?.custom ?? {}).flatMap(records => Object.keys(records));
    const replaced = await open();
    const original = await text(replaced);
    await replaced.evaluate(([document, source]) => { window.replaceResult = demo.pane.replaceDocument(document, { source, name: 'conference-talk' }); }, [conference, conferenceText]);
    assert.deepEqual(await deck(replaced), conference, 'the first example is exactly the document');
    assert.equal(await text(replaced), conferenceText, 'the pane shows the example as written');
    assert.equal(await replaced.evaluate(() => demo.pane.getName()), 'conference-talk');
    await replaced.evaluate(([document, source]) => demo.pane.replaceDocument(document, { source }), [tour, tourText]);
    await replaced.waitForTimeout(400);
    const opened = await deck(replaced);
    assert.deepEqual(opened, tour, 'the second example is exactly the document');
    assert.deepEqual(customIds(opened), [], 'no catalog record is forked');
    assert.ok(!/-custom/.test(JSON.stringify(opened)) && !/-custom/.test(await text(replaced)), 'no *-custom id in the document or the source');
    assert.equal(await text(replaced), tourText, 'the pane shows the second example as written');
    assert.equal(await replaced.evaluate(() => demo.editor.snapshot().undoDepth), 2, 'each load is one undoable change');
    await replaced.getByRole('button', { name: 'Undo', exact: true }).click();
    assert.deepEqual(await deck(replaced), conference, 'Undo restores the previous document');
    assert.equal(await text(replaced), conferenceText, 'Undo restores its source text exactly');
    await replaced.getByRole('button', { name: 'Undo', exact: true }).click();
    assert.equal(await text(replaced), original, 'a second Undo restores the starting source exactly');
    assert.equal((await deck(replaced)).name, 'Minimal OPF Deck');
    await replaced.getByRole('button', { name: 'Redo', exact: true }).click();
    assert.equal(await text(replaced), conferenceText, 'Redo opens the first example with its text');
    await replaced.getByRole('button', { name: 'Redo', exact: true }).click();
    assert.deepEqual(await deck(replaced), tour, 'Redo opens the second example');
    assert.equal(await text(replaced), tourText, 'with its text exactly');
    assert.deepEqual(customIds(await deck(replaced)), []);
    // A typed edit after opening still forks the record it edits, and Undo takes it back.
    await selectIn(replaced, 'Cover, newer catalog build');
    await replaced.keyboard.type('Mine');
    await replaced.keyboard.press('Escape');
    await waitDeck(replaced, (d) => d.catalogs.custom?.layouts?.['cover-custom']);
    await replaced.evaluate(() => demo.editor.undo());
    await waitDeck(replaced, (d) => !d.catalogs.custom);
    assert.equal(await text(replaced), tourText, 'Undo of a typed edit restores the opened text');
    // The same load in YAML: the document is exact, Undo restores the YAML that was shown.
    await chooseFormat(replaced, 'YAML');
    const yamlBefore = await text(replaced);
    await replaced.evaluate(([document]) => demo.pane.replaceDocument(document), [conference]);
    assert.deepEqual(await deck(replaced), conference);
    assert.deepEqual(customIds(await deck(replaced)), []);
    await replaced.evaluate(() => demo.editor.undo());
    assert.deepEqual(await deck(replaced), tour);
    assert.equal(await text(replaced), yamlBefore, 'Undo restores the YAML text');
    // A document the session refuses throws and changes nothing.
    const refused = await replaced.evaluate(() => { try { demo.pane.replaceDocument({ slides: [{ title: 42 }] }, { meta: { rejectInvalid: true } }); return 'opened'; } catch (error) { return error.code; } });
    assert.equal(refused, 'invalid-opf-edit');
    assert.deepEqual(await deck(replaced), tour);
    await replaced.close();
  }

  // RR-98: keyboard Undo and Redo in the pane agree with the session for a whole-document replace, and YAML and Markdown sources keep
  // their original text (comments included).
  {
    const embedded = (document) => prepareSave(document, { catalogs: [gallery] }).document;
    const docA = embedded({ name: 'Conference talk', slides: [{ id: 'a1', title: 'Opening', layout: 'cover' }, { id: 'a2', title: 'Body', text: 'Alpha', layout: 'text' }] });
    const docB = embedded({ name: 'Full feature tour', slides: [{ id: 'b1', title: 'Tour', layout: 'cover' }, { id: 'b2', title: 'More', text: 'Beta' }] });
    const jsonA = JSON.stringify(docA, null, '\t') + '\n';
    const jsonB = JSON.stringify(docB, null, 4);
    const undoKey = 'ControlOrMeta+z', redoKey = 'ControlOrMeta+Shift+z';
    const focusPane = (page) => page.evaluate(() => demo.pane.editor.api.focus());
    const depth = (page) => page.evaluate(() => demo.editor.snapshot().undoDepth);
    const load = (page, document, options) => page.evaluate(([document, options]) => { demo.pane.replaceDocument(document, options); }, [document, options]);

    // JSON: load A, load B; Mod-z restores A's text exactly, Mod-Shift-z restores B's.
    const keys = await open();
    const start = await text(keys);
    await load(keys, docA, { source: jsonA });
    await load(keys, docB, { source: jsonB });
    await focusPane(keys);
    await keys.keyboard.press(undoKey);
    assert.deepEqual(await deck(keys), docA, 'Mod-z undoes the second load');
    assert.equal(await text(keys), jsonA, 'and brings the first document back byte for byte');
    await keys.keyboard.press(redoKey);
    assert.deepEqual(await deck(keys), docB, 'Mod-Shift-z redoes it');
    assert.equal(await text(keys), jsonB, 'with its text byte for byte');
    await keys.keyboard.press(undoKey);
    await keys.keyboard.press(undoKey);
    assert.equal(await text(keys), start, 'a second Mod-z reaches the starting source');
    await keys.keyboard.press(undoKey);
    assert.equal(await text(keys), start, 'nothing is left to undo: the key does nothing');
    assert.equal(await depth(keys), 0);
    await keys.keyboard.press(redoKey);
    assert.equal(await text(keys), jsonA, 'Mod-Shift-z redoes the first load');
    await keys.keyboard.press(redoKey);
    assert.equal(await text(keys), jsonB);
    await keys.keyboard.press(redoKey);
    assert.equal(await text(keys), jsonB, 'nothing is left to redo');
    if (process.platform !== 'darwin') {
      await keys.keyboard.press('Control+z');
      await keys.keyboard.press('Control+y');
      assert.equal(await text(keys), jsonB, 'Ctrl+Y is redo');
    }
    assert.deepEqual(await keys.evaluate(() => demo.pane.editor.undoDepth()), 0, 'the load left no typed history behind');

    // Typing after a load: Mod-z undoes the typing first (CodeMirror's history), the next Mod-z the load, Mod-Shift-z the load again.
    await selectIn(keys, 'Beta');
    await keys.keyboard.type('Gamma');
    await waitDeck(keys, (d) => d.slides[1].text === 'GammaBeta' || d.slides[1].text?.includes('Gamma'));
    const typedDepth = await depth(keys);
    await keys.keyboard.press(undoKey);
    await keys.waitForTimeout(300);
    assert.equal(await text(keys), jsonB, 'Mod-z undoes the typing first and leaves the loaded text as it was');
    assert.deepEqual(await deck(keys), docB);
    assert.ok(await depth(keys) >= typedDepth, 'the load itself was not undone by that key');
    await keys.keyboard.press(undoKey);
    assert.equal(await text(keys), jsonA, 'the next Mod-z undoes the load');
    assert.deepEqual(await deck(keys), docA);
    await keys.keyboard.press(redoKey);
    assert.equal(await text(keys), jsonB, 'and Mod-Shift-z brings the loaded document back');
    // The typing, undone by keyboard, redoes with CodeMirror's history before anything else.
    await keys.keyboard.press(undoKey);
    await keys.keyboard.press(redoKey);
    assert.equal(await text(keys), jsonB, 'redo with nothing typed to redo returns to the loaded document');

    // Typed text not yet applied is undone by CodeMirror alone.
    await selectIn(keys, 'Beta');
    await keys.keyboard.type('Delta');
    await keys.keyboard.press(undoKey);
    await keys.waitForTimeout(300);
    assert.equal(await text(keys), jsonB, 'typing undone straight away leaves the loaded document');
    assert.deepEqual(await deck(keys), docB);

    // An edit made elsewhere stops the key: it does not reach back over the canvas edit.
    await keys.evaluate(() => demo.editor.set('slides.0.title', 'Retitled elsewhere'));
    const elsewhere = await text(keys);
    await focusPane(keys);
    await keys.keyboard.press(undoKey);
    assert.equal(await text(keys), elsewhere, 'Mod-z in the pane leaves an edit made elsewhere to the session\'s Undo');
    assert.equal((await deck(keys)).slides[0].title, 'Retitled elsewhere');
    // The session's own Undo and the key then agree.
    await keys.evaluate(() => demo.editor.undo());
    await focusPane(keys);
    await keys.keyboard.press(undoKey);
    assert.equal(await text(keys), jsonA, 'after the session undid that edit the key undoes the load');
    await keys.close();

    // A host that replaces the document on the session itself (not through the pane): the typed history no longer fits and is dropped.
    const direct = await open();
    await selectIn(direct, 'Next Steps');
    await direct.keyboard.type('Typed ');
    await direct.waitForTimeout(300);
    await direct.evaluate((document) => demo.editor.replaceDocument(document), docB);
    await focusPane(direct);
    assert.equal(await direct.evaluate(() => demo.pane.editor.undoDepth()), 0, 'the typing belongs to the document that was replaced');
    await direct.keyboard.press(undoKey);
    await direct.waitForTimeout(100);
    assert.ok((await deck(direct)).slides.some((slide) => slide.title === 'Typed '), 'Mod-z steps the session back over the host\'s replace');
    await direct.close();

    // A read-only pane takes no edit keys.
    const locked = await open();
    await load(locked, docA, { source: jsonA });
    await locked.evaluate(() => demo.pane.setReadOnly(true));
    await focusPane(locked);
    await locked.keyboard.press(undoKey);
    assert.equal(await text(locked), jsonA, 'a read-only pane does not step the session back');
    await locked.close();

    // YAML: the original text, comments included, is shown and comes back on Undo, Redo and the keys.
    const withComments = (document, note) => {
      const lines = toYaml(document).yaml.split('\n');
      return `# ${note}: kept by the pane\n${lines.map((line) => (line.startsWith('slides:') ? `# the slides\n${line}` : line)).join('\n')}`;
    };
    const yamlA = withComments(docA, 'Conference talk'), yamlB = withComments(docB, 'Full tour');
    assert.deepEqual(fromYaml(yamlA).presentation, docA, 'the fixture YAML reads as the document');
    const yaml = await open('?format=yaml');
    const yamlStart = await text(yaml);
    await load(yaml, docA, { source: yamlA });
    assert.equal(await text(yaml), yamlA, 'the pane shows the YAML as written, comments included');
    await load(yaml, docB, { source: yamlB, format: 'yaml' });
    assert.equal(await text(yaml), yamlB, 'an explicit format works the same');
    assert.deepEqual(await deck(yaml), docB);
    assert.equal(await depth(yaml), 2, 'each load is one undoable change');
    await focusPane(yaml);
    await yaml.keyboard.press(undoKey);
    assert.equal(await text(yaml), yamlA, 'Mod-z restores the first YAML byte for byte');
    assert.deepEqual(await deck(yaml), docA);
    await yaml.keyboard.press(redoKey);
    assert.equal(await text(yaml), yamlB, 'Mod-Shift-z restores the second');
    await yaml.getByRole('button', { name: 'Undo', exact: true }).click();
    assert.equal(await text(yaml), yamlA, 'the Undo button agrees');
    await yaml.getByRole('button', { name: 'Redo', exact: true }).click();
    assert.equal(await text(yaml), yamlB, 'and so does Redo');
    await focusPane(yaml);
    await yaml.keyboard.press(undoKey);
    await yaml.keyboard.press(undoKey);
    assert.equal(await text(yaml), yamlStart, 'the YAML the pane started with comes back');
    // Typing in the YAML is undone first, and the comments stay.
    await yaml.keyboard.press(redoKey);
    await selectIn(yaml, 'Opening');
    await yaml.keyboard.type('Intro');
    await waitDeck(yaml, (d) => d.slides[0].title.includes('Intro'));
    await yaml.keyboard.press(undoKey);
    await yaml.waitForTimeout(300);
    assert.equal(await text(yaml), yamlA, 'Mod-z undoes the typed YAML and keeps the comments');
    assert.deepEqual(await deck(yaml), docA);
    await yaml.keyboard.press(undoKey);
    assert.equal(await text(yaml), yamlStart, 'the next Mod-z undoes the load');
    // A source that is not this document is not shown.
    const docC = embedded({ name: 'Third', slides: [{ title: 'C' }] });
    await load(yaml, docC, { source: yamlA });
    assert.equal(await text(yaml), toYaml(docC).yaml, 'a source for another document is ignored');
    // JSON text still opens in a YAML pane as the document written in YAML (here the YAML the pane last showed for that very document),
    // and the JSON comes back with the format.
    const docD = embedded({ name: 'Fourth', slides: [{ title: 'D' }] });
    const jsonD = JSON.stringify(docD, null, '\t');
    await load(yaml, docD, { source: jsonD });
    assert.equal(await text(yaml), toYaml(docD).yaml);
    await chooseFormat(yaml, 'JSON');
    assert.equal(await text(yaml), jsonD, 'the JSON spelling is kept for the JSON format');
    // A bad format is refused before anything changes.
    const before = await depth(yaml);
    assert.equal(await yaml.evaluate(() => { try { demo.pane.replaceDocument({ slides: [] }, { format: 'toml' }); return 'opened'; } catch (error) { return error.name; } }), 'TypeError');
    assert.equal(await depth(yaml), before);
    await yaml.close();

    // YAML text given in a JSON pane is kept for the YAML format.
    const json = await open();
    await load(json, docA, { source: yamlA });
    assert.deepEqual(JSON.parse(await text(json)), docA, 'the JSON pane shows the document as JSON');
    await chooseFormat(json, 'YAML');
    assert.equal(await text(json), yamlA, 'switching to YAML shows the original YAML with its comments');
    await json.close();

    // Markdown: the same, with its own prose layout.
    const markdownA = toMarkdown(docA).markdown.replace(/\n(# |## )/, '\n\n$1');
    const markdownB = toMarkdown(docB).markdown + '\n';
    const md = await open('?format=md');
    const mdStart = await text(md);
    await load(md, docA, { source: markdownA });
    await load(md, docB, { source: markdownB });
    assert.equal(await text(md), markdownB, 'the pane shows the Markdown as written');
    await focusPane(md);
    await md.keyboard.press(undoKey);
    assert.equal(await text(md), markdownA, 'Mod-z restores the first Markdown byte for byte');
    await md.keyboard.press(redoKey);
    assert.equal(await text(md), markdownB, 'Mod-Shift-z restores the second');
    await md.keyboard.press(undoKey);
    await md.keyboard.press(undoKey);
    assert.equal(await text(md), mdStart);
    await md.close();
  }

  assert.deepEqual(requests, [], 'the pane makes no network requests');
  assert.deepEqual(errors, []);
  console.log('Source pane: JSON, YAML and Markdown edit the session; findings, rename, menu, copy and download work.');
} finally {
  await browser?.close();
  server.close();
}
