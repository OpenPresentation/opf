// A selection in a code surface stays readable (WCAG 1.4.3, 4.5:1) in the light and the dark scheme. The bug this guards: in a dark surface the
// selection of a focused CodeMirror view was CodeMirror's own light default (`#d7d4f0`, behind light text, about 1.2:1) because the view was not
// flagged dark and the base theme's focused rule out-specified ours. Every surface below is real: the source pane (JSON, YAML, Markdown), the standalone
// JSON editor, the agent handoff prompt and the other native text surfaces. Each is selected by keyboard and by mouse, focused and not, in both
// schemes. The test reads the computed selection background (composited over what it is drawn on) and the computed color of every piece of text under
// it, and asserts 4.5:1 for each; the native `::selection` of a text area is read the same way. The other occurrences of a selected word (CodeMirror's
// selection matches) are measured too, for a word in a string and for a key, whose color is the lightest in the dark scheme.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { buildStyles } from '../scripts/build-styles.mjs';

const root = new URL('../', import.meta.url);
const entry = `
  import { createEditorSession } from './src/index.js';
  import { createSourcePane } from './src/source-pane.js';
  import { mountJsonCodeEditor } from './src/json-editor.js';
  import { createAgentHandoffDialog } from './src/agent-handoff-dialog.js';
  const deck = { name: 'Selection deck', slides: [
    { id: 'one', title: 'Revenue grew 34% in every region', text: 'The enterprise segment led the quarter.', notes: 'Say it slowly.' },
    { id: 'two', title: 'Next steps', items: ['Hire two engineers', 'Ship the beta', 'Revenue review'], hidden: false },
  ] };
  window.deck = deck;
  window.mountPane = (format) => {
    window.pane?.destroy(); document.getElementById('host').replaceChildren();
    window.session = createEditorSession(deck);
    window.pane = createSourcePane(document.getElementById('host'), { editor: window.session, name: 'deck', format, worker: false, completions: false });
    return window.pane;
  };
  window.mountJson = () => {
    window.pane?.destroy(); window.json?.destroy(); document.getElementById('host').replaceChildren();
    const surface = document.createElement('div'); surface.className = 'opf-json'; surface.style.cssText = 'height:340px;width:640px';
    document.getElementById('host').append(surface);
    window.json = mountJsonCodeEditor(surface, { code: JSON.stringify(deck, null, 2), label: 'OPF JSON', lineNumbers: true, onChange() {} });
    return window.json;
  };
  window.openHandoff = () => { window.dialog = createAgentHandoffDialog(document.body, { document: deck, onClose() {} }); return window.dialog; };
`;
const bundle = await build({ stdin: { contents: entry, resolveDir: fileURLToPath(root), loader: 'js' }, bundle: true, write: false, platform: 'browser', format: 'esm', logLevel: 'silent' });
const css = (await buildStyles(new URL('src/styles/', root))).css;
const files = {
  '/': ['text/html', `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Selection contrast</title><link rel="stylesheet" href="/styles.css"><style>body{margin:0;background:var(--opf-ui-bg);color:var(--opf-ui-fg)}#host{width:760px;height:420px}</style></head><body>
    <div id="host" class="opf-ui"></div>
    <div class="opf-ui" id="native"><p class="opf-numbering-preview" id="numbering">Slide 3 of 12 in 1.2.3</p><div class="opf-grid"><details open><textarea id="grid-text" rows="3">a,b,c\n1,2,3</textarea></details></div></div>
    <script type="module" src="/fixture.js"></script></body></html>`],
  '/fixture.js': ['text/javascript', bundle.outputFiles[0].text],
  '/styles.css': ['text/css', css],
};
const server = createServer((req, res) => {
  const found = files[new URL(req.url, 'http://localhost').pathname];
  if (!found) { res.writeHead(404).end(); return; }
  res.writeHead(200, { 'Content-Type': found[0] }).end(found[1]);
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;

// Page side: color parsing, compositing, WCAG contrast, and the measurement of one CodeMirror view.
const helpers = () => {
  const parse = (value) => {
    const rgb = value.match(/^rgba?\(([^)]+)\)$/);
    if (rgb) { const [r, g, b, a = 1] = rgb[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r, g, b, a }; }
    const srgb = value.match(/^color\(srgb ([^)]+)\)$/);
    if (srgb) { const [r, g, b, a = 1] = srgb[1].split(/[ /]+/).filter(Boolean).map(Number); return { r: r * 255, g: g * 255, b: b * 255, a }; }
    throw new Error(`Unparsed color: ${value}`);
  };
  const over = (top, bottom) => { const a = top.a + bottom.a * (1 - top.a); const mix = (k) => (top[k] * top.a + bottom[k] * bottom.a * (1 - top.a)) / a; return { r: mix('r'), g: mix('g'), b: mix('b'), a }; };
  const lum = ({ r, g, b }) => { const v = [r, g, b].map((c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
  const ratio = (a, b) => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };
  // What is behind `element`: its ancestors' backgrounds (not its own), composited down to the first opaque one (the page canvas is white when none is).
  const backdrop = (element) => {
    const stack = [];
    for (let node = element.parentElement; node; node = node.parentElement) { const color = parse(getComputedStyle(node).backgroundColor); if (color.a > 0) stack.push(color); if (color.a === 1) break; }
    return stack.reduceRight((below, color) => over(color, below), { r: 255, g: 255, b: 255, a: 1 });
  };
  const hex = ({ r, g, b }) => `#${[r, g, b].map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')}`;
  const overlaps = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
  // One CodeMirror view: the selection layer's boxes, and every text node that one of them covers.
  window.measureView = (editor) => {
    const boxes = [...editor.querySelectorAll('.cm-selectionLayer .cm-selectionBackground')].map((node) => ({ rect: node.getBoundingClientRect(), color: parse(getComputedStyle(node).backgroundColor), node })).filter((box) => box.rect.width > 0 && box.rect.height > 0);
    const out = { boxes: boxes.length, cssBackground: boxes[0] && getComputedStyle(boxes[0].node).backgroundColor, items: [], editorClass: editor.className.split(' ').filter((name) => /^ͼ/.test(name)).join(' ') };
    const walker = document.createTreeWalker(editor.querySelector('.cm-content'), NodeFilter.SHOW_TEXT);
    for (let text = walker.nextNode(); text; text = walker.nextNode()) {
      if (!text.data.trim() || !text.parentElement.closest('.cm-line')) continue;
      const range = document.createRange(); range.selectNodeContents(text);
      for (const rect of range.getClientRects()) {
        const box = boxes.find((candidate) => overlaps(rect, candidate.rect));
        if (!box) continue;
        const under = over(box.color, backdrop(box.node));
        const color = parse(getComputedStyle(text.parentElement).color);
        out.items.push({ text: text.data.trim().slice(0, 24), foreground: hex(color), background: hex(under), ratio: ratio(over(color, under), under) });
        break;
      }
    }
    return out;
  };
  // The other occurrences of the selected word (`.cm-selectionMatch`, not the selection itself): each run of text inside a mark against the mark's
  // tint over what it is drawn on.
  window.measureMatches = (editor) => {
    const marks = [...editor.querySelectorAll('.cm-selectionMatch:not(.cm-selectionMatch-main)')];
    const out = { marks: marks.length, cssBackground: marks[0] && getComputedStyle(marks[0]).backgroundColor, items: [] };
    for (const mark of marks) {
      const under = over(parse(getComputedStyle(mark).backgroundColor), backdrop(mark));
      const walker = document.createTreeWalker(mark, NodeFilter.SHOW_TEXT);
      for (let text = walker.nextNode(); text; text = walker.nextNode()) {
        if (!text.data.trim()) continue;
        const color = parse(getComputedStyle(text.parentElement).color);
        out.items.push({ text: text.data.trim().slice(0, 24), foreground: hex(color), background: hex(under), ratio: ratio(over(color, under), under) });
      }
    }
    return out;
  };
  // A native `::selection`: its background (over what it is on) against its text color.
  window.measureNative = (element) => {
    const style = getComputedStyle(element, '::selection');
    const background = over(parse(style.backgroundColor), backdrop(element));
    return { background: hex(background), foreground: hex(parse(style.color)), ratio: ratio(parse(style.color), background), raw: `${style.backgroundColor} / ${style.color}` };
  };
};

const browser = await chromium.launch({ channel: process.platform === 'win32' && !process.env.CI ? 'msedge' : undefined });
const errors = [];
const rows = [];
let worst = { ratio: Infinity };
const setScheme = (page, scheme) => page.evaluate((value) => { const html = document.documentElement; html.dataset.theme = value; html.classList.toggle('dark', value === 'dark'); html.classList.toggle('light', value === 'light'); }, scheme);
globalThis.__debug = async () => { await globalThis.__page.screenshot({ path: '/tmp/sel-debug.png' }); };
const record = async (surface, scheme, how, measured) => {
  if (!measured.boxes) { console.log(JSON.stringify(measured)); await globalThis.__debug?.(); }
  assert.ok(measured.boxes > 0, `${surface} ${scheme} ${how}: the selection is drawn`);
  assert.ok(measured.items.length > 0, `${surface} ${scheme} ${how}: the selection covers text`);
  for (const item of measured.items) {
    if (item.ratio < worst.ratio) worst = { ...item, surface, scheme, how };
    assert.ok(item.ratio >= 4.5, `${surface} (${scheme}, ${how}): "${item.text}" ${item.foreground} on selection ${item.background} is ${item.ratio.toFixed(2)}:1, below 4.5:1 (selection CSS ${measured.cssBackground})`);
  }
  rows.push(`${surface.padEnd(18)} ${scheme.padEnd(5)} ${how.padEnd(18)} selection ${measured.items[0].background}, ${measured.items.length} runs, min ${Math.min(...measured.items.map((item) => item.ratio)).toFixed(2)}:1`);
};
try {
  const context = await browser.newContext({ viewport: { width: 1000, height: 800 }, acceptDownloads: true });
  const page = await context.newPage();
  globalThis.__page = page;
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto(`${origin}/`);
  await page.waitForFunction(() => typeof window.mountPane === 'function');
  await page.evaluate(`(${helpers})()`);

  const viewOf = (selector) => page.locator(`${selector} .cm-content`);
  const keyboardSelect = async (content) => {
    await content.locator('.cm-line').nth(3).click({ position: { x: 6, y: 4 } });
    await page.keyboard.press('Control+Home');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    for (let line = 0; line < 6; line++) await page.keyboard.press('Shift+ArrowDown');
    await page.keyboard.press('Shift+End');
  };
  const mouseSelect = async (content) => {
    const lines = content.locator('.cm-line');
    const first = await lines.nth(2).boundingBox();
    const last = await lines.nth(9).boundingBox();
    await page.mouse.move(first.x + 10, first.y + first.height / 2);
    await page.mouse.down();
    await page.mouse.move(last.x + Math.min(last.width - 4, 260), last.y + last.height / 2, { steps: 8 });
    await page.mouse.up();
  };
  const surfaces = [
    ['source pane JSON', async () => { await page.evaluate(() => window.mountPane('json')); await page.locator('#host .opf-source-code .cm-content').waitFor(); }, '#host .opf-source-code'],
    ['source pane YAML', async () => { await page.evaluate(() => window.mountPane('yaml')); await page.locator('#host .opf-source-code .cm-content').waitFor(); }, '#host .opf-source-code'],
    ['source pane Markdown', async () => { await page.evaluate(() => window.mountPane('md')); await page.locator('#host .opf-source-code .cm-content').waitFor(); }, '#host .opf-source-code'],
    ['JSON editor', async () => { await page.evaluate(() => window.mountJson()); await page.locator('#host .opf-json .cm-content').waitFor(); }, '#host .opf-json'],
  ];
  let classes = {};
  for (const scheme of ['dark', 'light']) {
    for (const [name, mount, selector] of surfaces) {
      await setScheme(page, scheme);
      await mount();
      const content = viewOf(selector);
      for (const [how, select] of [['keyboard', keyboardSelect], ['mouse', mouseSelect]]) {
        await page.mouse.click(900, 700);
        await select(content);
        for (const focused of [true, false]) {
          if (!focused) await page.evaluate(() => document.activeElement?.blur());
          await content.evaluate((node, expected) => new Promise((resolve, reject) => {
            const started = performance.now();
            const check = () => node.closest('.cm-editor').classList.contains('cm-focused') === expected ? resolve() : performance.now() - started > 3000 ? reject(new Error(`the view is ${expected ? 'not ' : ''}focused`)) : setTimeout(check, 20);
            check();
          }), focused);
          await page.waitForTimeout(60);
          const measured = await page.evaluate((target) => window.measureView(document.querySelector(target).closest('.cm-editor') ?? document.querySelector(target).querySelector('.cm-editor')), `${selector} .cm-content`);
          await record(name, scheme, `${how} ${focused ? 'focused' : 'blurred'}`, measured);
          if (focused) classes[`${name}/${scheme}`] = measured.editorClass;
        }
      }
    }
  }
  // The other occurrences of a selected word are tinted (highlightSelectionMatches): their text keeps 4.5:1 on the tint, in both schemes and every
  // code surface, for a word in a string ("Revenue": a title and a list item) and for a key ("title", where the key color is the lightest text
  // in the dark scheme: 4.2:1 there before the tint was lowered).
  for (const scheme of ['dark', 'light']) {
    for (const [name, mount, selector] of surfaces) {
      for (const word of name.includes('Markdown') ? ['Revenue'] : ['Revenue', 'title']) {
        await setScheme(page, scheme);
        await mount();
        await page.evaluate(([target, text]) => {
          const view = document.querySelector(target);
          const api = window.json && view.closest('.opf-json') ? window.json.api : window.pane.editor.api;
          const at = api.getValue().indexOf(text);
          api.focus();
          api.setSelection(at, at + text.length);
        }, [`${selector} .cm-content`, word]);
        await page.waitForFunction((target) => document.querySelector(target).closest('.cm-editor').querySelector('.cm-selectionMatch:not(.cm-selectionMatch-main)'), `${selector} .cm-content`);
        const measured = await page.evaluate((target) => window.measureMatches(document.querySelector(target).closest('.cm-editor')), `${selector} .cm-content`);
        assert.ok(measured.marks > 0 && measured.items.length > 0, `${name} ${scheme}: the other occurrence of "${word}" is marked`);
        for (const item of measured.items) {
          if (item.ratio < worst.ratio) worst = { ...item, surface: name, scheme, how: `word match "${word}"` };
          assert.ok(item.ratio >= 4.5, `${name} (${scheme}, word match "${word}"): "${item.text}" ${item.foreground} on match ${item.background} is ${item.ratio.toFixed(2)}:1, below 4.5:1 (match CSS ${measured.cssBackground})`);
        }
        rows.push(`${name.padEnd(18)} ${scheme.padEnd(5)} match ${word.padEnd(12)} tint ${measured.items[0].background}, ${measured.items.length} runs, min ${Math.min(...measured.items.map((item) => item.ratio)).toFixed(2)}:1`);
      }
    }
  }
  // The dark flag follows the scheme without a reload: switching the page changes CodeMirror's theme class, and switching back restores it.
  await page.evaluate(() => window.mountPane('json'));
  await page.locator('#host .opf-source-code .cm-content').waitFor();
  const themeClass = () => page.evaluate(() => [...document.querySelector('#host .cm-editor').classList].filter((name) => /^ͼ/.test(name)).join(' '));
  await setScheme(page, 'light');
  await page.waitForFunction(() => !document.querySelector('#host .cm-editor').dataset.nope);
  const light = await (async () => { await page.waitForTimeout(80); return themeClass(); })();
  await setScheme(page, 'dark');
  await page.waitForFunction((was) => [...document.querySelector('#host .cm-editor').classList].filter((name) => /^ͼ/.test(name)).join(' ') !== was, light);
  const dark = await themeClass();
  assert.notEqual(dark, light, 'a dark page flags the view dark');
  await setScheme(page, 'light');
  await page.waitForFunction((was) => [...document.querySelector('#host .cm-editor').classList].filter((name) => /^ͼ/.test(name)).join(' ') === was, light);
  // A surface that forces light inside a dark page is light: the flag follows the surface, not the page.
  await setScheme(page, 'dark');
  await page.evaluate(() => document.getElementById('host').setAttribute('data-theme', 'light'));
  await page.waitForFunction((was) => [...document.querySelector('#host .cm-editor').classList].filter((name) => /^ͼ/.test(name)).join(' ') === was, light);
  await page.evaluate(() => document.getElementById('host').removeAttribute('data-theme'));

  // Native selections: the agent handoff prompt (a text area), the numbering preview and the data grid's text area.
  for (const scheme of ['dark', 'light']) {
    await setScheme(page, scheme);
    await page.evaluate(() => window.openHandoff());
    const prompt = page.getByRole('textbox', { name: 'Prompt for a coding agent' });
    await prompt.waitFor();
    await prompt.focus();
    await page.keyboard.press('Control+A');
    const handoff = await prompt.evaluate((node) => window.measureNative(node));
    assert.ok(handoff.ratio >= 4.5, `handoff prompt (${scheme}) selection ${handoff.raw} is ${handoff.ratio.toFixed(2)}:1`);
    rows.push(`handoff prompt     ${scheme.padEnd(5)} native ::selection ${handoff.foreground} on ${handoff.background} ${handoff.ratio.toFixed(2)}:1`);
    await page.keyboard.press('Escape');
    for (const id of ['numbering', 'grid-text']) {
      const native = await page.locator(`#${id}`).evaluate((node) => window.measureNative(node));
      assert.ok(native.ratio >= 4.5, `${id} (${scheme}) selection ${native.raw} is ${native.ratio.toFixed(2)}:1`);
      rows.push(`${id.padEnd(18)} ${scheme.padEnd(5)} native ::selection ${native.foreground} on ${native.background} ${native.ratio.toFixed(2)}:1`);
    }
  }
  assert.deepEqual(errors, [], 'no page error or console error');
  console.log(rows.join('\n'));
  console.log(`selection contrast: ${rows.length} measurements pass; lowest ${worst.ratio.toFixed(2)}:1 ("${worst.text}" ${worst.foreground} on ${worst.background}, ${worst.surface}, ${worst.scheme}, ${worst.how}).`);
} finally {
  await browser.close();
  server.close();
}
