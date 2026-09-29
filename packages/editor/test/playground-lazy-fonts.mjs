// FF-31: the browser playground loads vendored preview fonts (Intos for the Aptos scheme) on demand, never through fonts.json.
// It serves the built playground locally: a Roboto document fetches no vendored font; choosing the Aptos font scheme fetches
// exactly the Intos and Intos Display files (hash-verified by the renderer's loader) while the preview keeps rendering with
// the same faces in the registry and the document; afterwards every measured text run is painted in Intos at the measured
// advance. Offline apart from the local server.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import * as renderFonts from '@openpresentation/opf-render/fonts-node';

if (!(await renderFonts.loadOfficeFontRegistry()).lazyFonts?.length) {
  console.log('Playground lazy fonts skipped: the installed renderer vendors no lazy fonts.');
  process.exit(0);
}
const root = fileURLToPath(new URL('../artifacts/playground/', import.meta.url));
const output = path.resolve(fileURLToPath(new URL('../', import.meta.url)), process.argv[2] ?? 'artifacts/playground-lazy-fonts');
await mkdir(output, { recursive: true });
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.ttf': 'font/ttf' };
const lazyRequests = [], blocked = [];
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/favicon.ico') { res.writeHead(204).end(); return; }
    const target = path.resolve(root, '.' + decodeURIComponent(url.pathname));
    const relative = path.relative(root, target);
    if (relative.startsWith('..') || path.isAbsolute(relative)) { res.writeHead(403).end(); return; }
    if (url.pathname.startsWith('/fonts/')) lazyRequests.push(url.pathname);
    res.writeHead(200, { 'Content-Type': types[path.extname(target)] ?? 'application/octet-stream' }).end(await readFile(target));
  } catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser = await chromium.launch({ channel: process.platform === 'win32' && !process.env.CI ? 'msedge' : undefined });
  const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.route(/^https?:/, route => route.request().url().startsWith(base) ? route.continue() : (blocked.push(route.request().url()), route.abort()));
  await page.goto(`${base}/index.html`);
  await page.locator('#preview svg').waitFor();
  await page.evaluate(() => document.fonts.ready);
  assert.deepEqual(lazyRequests, [], 'a Roboto document fetches no vendored font');
  const fontsJson = (await stat(path.join(root, 'fonts.json'))).size;
  const choose = value => page.evaluate(value => { const select = document.querySelector('#font'); select.value = value; select.dispatchEvent(new Event('change', { bubbles: true })); }, value);
  await choose('aptos');
  await page.waitForFunction(() => [...document.fonts].some(face => face.family.replace(/"/g, '') === 'Intos' && face.status === 'loaded'), undefined, { timeout: 60000 });
  await page.waitForFunction(() => !/Loading fonts/.test(document.querySelector('#status').textContent), undefined, { timeout: 60000 });
  await page.waitForTimeout(400);
  const fetched = lazyRequests.filter(url => url.endsWith('.ttf'));
  assert.equal(fetched.length, 8, `the Aptos scheme fetched ${fetched.join(', ')}`);
  assert.ok(fetched.every(url => /^\/fonts\/intos\/Intos(Display)?-/.test(url)));
  const painted = await page.evaluate(async () => {
    await document.fonts.ready;
    return [...document.querySelectorAll('#preview svg text[textLength], #preview svg tspan[textLength]')].map(element => {
      const family = (element.getAttribute('font-family') ?? element.closest('text').getAttribute('font-family')).split(',')[0].trim().replace(/^"|"$/g, '');
      return { family, accepted: Number(element.getAttribute('textLength')), natural: element.getComputedTextLength(), loaded: [...document.fonts].some(face => face.family.replace(/"/g, '') === family && face.status === 'loaded') };
    });
  });
  assert.ok(painted.length > 0, 'the preview has measured text runs');
  for (const run of painted) {
    assert.match(run.family, /^Intos/, `the Aptos preview paints ${run.family}`);
    assert.ok(run.loaded, `${run.family} is loaded`);
    assert.ok(Math.abs(run.natural - run.accepted) < 0.1, `${run.family}: drawn ${run.natural} differs from measured ${run.accepted}`);
  }
  const count = lazyRequests.length;
  await choose('roboto'); await page.waitForTimeout(300);
  await choose('aptos'); await page.waitForTimeout(500);
  assert.equal(lazyRequests.length, count, 'loaded faces are not fetched again');
  assert.deepEqual(blocked, [], 'no request leaves the local server');
  assert.deepEqual(errors, []);
  const bytes = (await Promise.all(fetched.map(async url => (await stat(path.join(root, url))).size))).reduce((a, b) => a + b, 0);
  await writeFile(path.join(output, 'report.json'), JSON.stringify({ browser: browser.version(), fontsJsonBytes: fontsJson, lazyFilesFetched: fetched, lazyBytesFetched: bytes, runs: painted.length }, null, 2) + '\n');
  console.log(`Playground lazy fonts: fonts.json ${fontsJson} bytes; the Aptos scheme fetched ${fetched.length} Intos files (${bytes} bytes); ${painted.length} runs painted in Intos at the measured advance.`);
} finally { await browser?.close(); server.close(); }
