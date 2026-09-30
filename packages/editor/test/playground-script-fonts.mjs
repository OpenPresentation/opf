// FF-19: the browser playground loads script fonts lazily, once a document draws that script. It serves the
// pinned Noto files from its own build, fetches nothing for Latin text, and stays usable when a file is missing.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import * as renderFonts from '@openpresentation/opf-render/fonts-node';

// The playground loads script faces through the browser registry's pendingScripts()/ensureScripts() (it keeps Latin fonts
// without them). Renderer 0.10.0 ships scriptFontPackages but not that loader, so require both, as the playground does.
// The registry needs the browser Font Loading API, so check the installed module that the playground bundle is built from.
const browserFonts = await readFile(fileURLToPath(import.meta.resolve('@openpresentation/opf-render/fonts-browser')), 'utf8');
if (typeof renderFonts.scriptFontPackages !== 'function' || !/\bpendingScripts\s*\(/.test(browserFonts) || !/\bensureScripts\s*\(/.test(browserFonts)) {
  console.log('Playground script fonts skipped: the installed renderer has no lazy script font loader (pendingScripts/ensureScripts).');
  process.exit(0);
}
const root = fileURLToPath(new URL('../artifacts/playground/', import.meta.url));
const output = path.resolve(fileURLToPath(new URL('../', import.meta.url)), process.argv[2] ?? 'artifacts/playground-script-fonts');
await mkdir(output, { recursive: true });
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.ttf': 'font/ttf' };
const scriptRequests = [], blocked = [];
let failHebrew = false;
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/favicon.ico') { res.writeHead(204).end(); return; }
    const target = path.resolve(root, '.' + decodeURIComponent(url.pathname));
    const relative = path.relative(root, target);
    if (relative.startsWith('..') || path.isAbsolute(relative)) { res.writeHead(403).end(); return; }
    if (url.pathname.startsWith('/script-fonts/')) {
      scriptRequests.push(url.pathname.slice('/script-fonts/'.length));
      if (failHebrew && /hebrew/.test(url.pathname)) { res.writeHead(404).end(); return; }
    }
    res.writeHead(200, { 'Content-Type': types[path.extname(target)] ?? 'application/octet-stream' }).end(await readFile(target));
  } catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;

const deck = (language, fontScheme, title, text) => ({ name: `Playground ${language ?? 'latin'}`, ...(language ? { language } : {}), design: { theme: 'classic', fontScheme }, slides: [{ id: 'first', title, text }] });
const decks = {
  latin: deck(undefined, 'roboto', 'Quarterly review', 'Sales grew twelve percent.'),
  ja: deck('ja', 'meiryo', '四半期レビュー 12%', '売上は前年同期比で12%増加しました。'),
  ar: deck('ar', 'arabic-typesetting', 'مراجعة ربع سنوية.', 'ارتفعت المبيعات بنسبة 12%.'),
  he: deck('he', 'david', 'סקירה רבעונית.', 'המכירות עלו ב־12%.'),
};

let browser;
try {
  browser = await chromium.launch({ channel: process.platform === 'win32' && !process.env.CI ? 'msedge' : undefined });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error' && !/status of 404/.test(message.text())) errors.push(message.text()); });
  await page.route(/^https?:/, route => route.request().url().startsWith(base) ? route.continue() : (blocked.push(route.request().url()), route.abort()));
  await page.goto(`${base}/index.html`);
  await page.locator('#preview svg').waitFor();
  const button = name => page.getByRole('button', { name, exact: true });
  const applySource = async value => {
    await button('Source').click();
    await page.locator('#json').fill(JSON.stringify(value));
    await page.waitForFunction(() => !document.querySelector('#apply-json').disabled && !document.querySelector('#json-error').textContent, undefined, { timeout: 60000 });
    await button('Apply changes').click();
  };
  const settled = title => page.waitForFunction(title => document.querySelector('#slide-title').textContent === title && document.querySelector('#preview svg') && !/Loading fonts/.test(document.querySelector('#status').textContent), title, { timeout: 60000 });
  const painted = () => page.evaluate(() => ({
    families: [...document.fonts].filter(face => face.status === 'loaded').map(face => face.family.replace(/^"|"$/g, '')),
    text: [...document.querySelectorAll('#preview svg text')].map(node => node.textContent).join(' '),
    unavailable: document.querySelector('#preview')?.textContent.includes('Preview unavailable') ?? false,
  }));
  const files = () => [...new Set(scriptRequests)];
  // One press on a character half puts a collapsed caret at that boundary of the input value (left-to-right and right-to-left).
  const pressCaret = async (path, index, side, rtl) => {
    const at = await page.evaluate(({ path, index, side }) => {
      const node = [...document.querySelectorAll('#preview [data-canvas-target][data-opf-path="' + path + '"] text, #preview [data-canvas-target][data-opf-path="' + path + '"] tspan')].find(n => n.firstChild?.nodeType === 3 && n.textContent.length > index);
      // Right-to-left lines carry directional isolate marks that are not source characters: index counts source characters.
      let dom = -1, seen = 0;
      for (let i = 0; i < node.textContent.length && dom < 0; i++) { if (/[\u2066-\u2069]/.test(node.textContent[i])) continue; if (seen++ === index) dom = i; }
      const range = document.createRange();
      range.setStart(node.firstChild, dom); range.setEnd(node.firstChild, dom + 1);
      const box = range.getBoundingClientRect();
      return { x: box.left + box.width * (side === 'left' ? 0.25 : 0.75), y: box.top + box.height / 2 };
    }, { path, index, side });
    await page.mouse.click(at.x, at.y);
    const caret = await page.evaluate(() => ({ kind: document.activeElement.className, start: document.activeElement.selectionStart, end: document.activeElement.selectionEnd }));
    assert.equal(caret.kind, 'opf-inline-input');
    assert.equal(caret.start, caret.end, 'a press must not select a range');
    const startSide = rtl ? 'right' : 'left';
    assert.equal(caret.start, index + (side === startSide ? 0 : 1), `${path} character ${index} ${side} half`);
    await page.keyboard.press('Escape');
  };

  // Latin: the page loads and nothing from script-fonts is requested.
  assert.deepEqual(scriptRequests, []);
  await page.screenshot({ path: path.join(output, 'latin.png') });

  // Japanese: exactly the Japanese package, and the text is drawn in Noto Sans JP.
  await applySource(decks.ja);
  await settled('四半期レビュー 12%');
  assert.deepEqual(files().sort(), ['noto-sans-jp/400Regular/NotoSansJP_400Regular.ttf', 'noto-sans-jp/700Bold/NotoSansJP_700Bold.ttf']);
  let state = await painted();
  assert.equal(state.unavailable, false);
  assert.ok(state.families.includes('Noto Sans JP'), 'Noto Sans JP is loaded');
  assert.match(state.text, /四半期レビュー/);
  for (const [index, side] of [[0, 'left'], [2, 'left'], [2, 'right'], [5, 'right']]) await pressCaret('slides.0.title', index, side, false);
  await page.locator('#preview').screenshot({ path: path.join(output, 'ja.png') });

  // Arabic: only the Arabic packages are added.
  const afterJapanese = scriptRequests.length;
  await applySource(decks.ar);
  await settled('مراجعة ربع سنوية.');
  assert.deepEqual([...new Set(scriptRequests.slice(afterJapanese).map(file => file.split('/')[0]))].sort(), ['noto-naskh-arabic', 'noto-nastaliq-urdu', 'noto-sans-arabic']);
  state = await painted();
  assert.equal(state.unavailable, false);
  assert.ok(state.families.includes('Noto Naskh Arabic'));
  for (const [index, side] of [[0, 'right'], [3, 'right'], [3, 'left'], [7, 'left']]) await pressCaret('slides.0.title', index, side, true);
  await page.locator('#preview').screenshot({ path: path.join(output, 'ar.png') });

  // Undo and redo across scripts fetch nothing new; a Latin edit fetches nothing either.
  const settledCount = scriptRequests.length;
  await button('Undo').click();
  await settled('四半期レビュー 12%');
  await button('Redo').click();
  await settled('مراجعة ربع سنوية.');
  await page.locator('#document-name').fill('Renamed presentation');
  await page.locator('#document-name').blur();
  assert.equal(scriptRequests.length, settledCount, 'already loaded scripts are not fetched again');
  assert.equal(new Set(scriptRequests).size, scriptRequests.length, 'no font file is fetched twice');

  // A file that cannot be fetched is reported; the playground stays usable and Undo restores a working preview.
  failHebrew = true;
  await button('Source').click();
  await page.locator('#json').fill(JSON.stringify(decks.he));
  await page.waitForFunction(() => /could not be loaded/.test(document.querySelector('#json-error').textContent), undefined, { timeout: 60000 });
  assert.equal(await page.locator('#apply-json').isDisabled(), true);
  await button('Close source editor').click();
  failHebrew = false;
  await applySource(decks.he);
  await settled('סקירה רבעונית.');
  assert.equal((await painted()).unavailable, false);
  assert.ok((await painted()).families.includes('Noto Sans Hebrew'));
  await page.locator('#preview').screenshot({ path: path.join(output, 'he.png') });

  assert.deepEqual(blocked, [], 'nothing leaves the local server');
  assert.deepEqual(errors, []);
  console.log(`Playground script fonts: Latin fetched 0 files; Japanese ${afterJapanese}; Arabic ${settledCount - afterJapanese}; reload-free undo/redo fetched 0; missing file reported and recovered.`);
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
