// FF-41: a playground built with split eager fonts (OPF_PLAYGROUND_SPLIT_FONTS=1, what the gallery editor ships) starts with Roboto Regular
// only and loads the rest of the renderer's eager faces (Roboto's other weights, Roboto Mono, the Office substitutes) on demand, face by
// face, hash-verified, as the registry's own extra lazy faces (extraLazyFonts, renderer 0.11.7) asked through the font gate:
//   - fonts.json holds Roboto Regular alone, base-fonts.json lists every other eager face with its SHA-256 and each is a separate file,
//   - the default Roboto deck fetches only the Roboto faces it draws (no Office face, none for the faces of other decks),
//   - choosing Calibri fetches Carlito Regular and Bold (the faces the deck draws, not Carlito's italics) and the preview paints Carlito at
//     the measured advance; loaded faces are not fetched again,
//   - a host that hands a document over the moment the page is ready (the gallery does: it opens the source dialog, fills it and clicks Apply)
//     while the starting deck's faces are still loading gets that document applied, with slow font responses too,
//   - nothing leaves the local server, no page errors.
// Skipped with a renderer older than 0.11.7 (no extraLazyFonts).
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import * as browserFonts from '@openpresentation/opf-render/fonts-browser';

if (typeof browserFonts.splitStartupFaces !== 'function') {
  console.log('Playground base fonts skipped: the installed renderer predates extraLazyFonts (0.11.7).');
  process.exit(0);
}
const repo = fileURLToPath(new URL('../', import.meta.url));
const root = path.join(repo, 'artifacts/playground-split');
const output = path.resolve(repo, process.argv[2] ?? 'artifacts/playground-base-fonts');
await mkdir(output, { recursive: true });
const built = spawnSync(process.execPath, ['scripts/build-playground.mjs', '--split-fonts'], { cwd: repo, env: { ...process.env, OPF_PLAYGROUND_OUT: root }, stdio: 'inherit' });
assert.equal(built.status, 0, 'the split playground builds');

const startup = JSON.parse(await readFile(path.join(root, 'fonts.json'), 'utf8'));
const baseList = JSON.parse(await readFile(path.join(root, 'base-fonts.json'), 'utf8'));
assert.deepEqual(startup.map(face => `${face.family} ${face.weight}${face.italic ? 'i' : ''}`), ['Roboto 400'], 'fonts.json starts with Roboto Regular only');
assert.ok(baseList.length >= 30, `base-fonts.json lists the other eager faces (${baseList.length})`);
for (const face of baseList) {
  assert.match(face.file, /^[A-Za-z0-9.-]+\.ttf$/);
  assert.equal(createHash('sha256').update(await readFile(path.join(root, face.file))).digest('hex'), face.sha256, `${face.file} matches its SHA-256`);
}
const startupBytes = (await stat(path.join(root, 'fonts.json'))).size;
assert.ok(startupBytes < 400_000, `fonts.json is small: ${startupBytes}`);

const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.ttf': 'font/ttf' };
const served = [], blocked = [];
let delayFonts = false;
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/favicon.ico') { res.writeHead(204).end(); return; }
    const target = path.resolve(root, '.' + decodeURIComponent(url.pathname));
    const relative = path.relative(root, target);
    if (relative.startsWith('..') || path.isAbsolute(relative)) { res.writeHead(403).end(); return; }
    const body = await readFile(target);
    // Slow font files make the starting deck's faces still load when a host hands a document over.
    if (delayFonts && url.pathname.endsWith('.ttf')) await new Promise(resolve => setTimeout(resolve, 350));
    if (/\.(ttf|json)$/.test(url.pathname) && !url.pathname.includes('script-fonts')) served.push({ file: url.pathname.slice(1), bytes: body.length });
    res.writeHead(200, { 'Content-Type': types[path.extname(target)] ?? 'application/octet-stream' }).end(body);
  } catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const baseFiles = () => served.filter(item => item.file.endsWith('.ttf') && !item.file.startsWith('fonts/')).map(item => item.file.replace(/-[0-9a-f]{12}\.ttf$/, ''));
let browser;
try {
  browser = await chromium.launch({ channel: process.platform === 'win32' && !process.env.CI ? 'msedge' : undefined });
  const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.route(/^https?:/, route => route.request().url().startsWith(base) ? route.continue() : (blocked.push(route.request().url()), route.abort()));
  await page.goto(`${base}/index.html`);
  await page.locator('#preview svg').waitFor({ timeout: 60000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(500);
  const firstLoad = served.filter(item => /\.ttf$|fonts\.json$/.test(item.file)).reduce((sum, item) => sum + item.bytes, 0);
  const first = baseFiles();
  assert.ok(first.length > 0 && first.every(name => /^Roboto(-|Mono-)/.test(name)), `the Roboto deck fetches only Roboto faces: ${first}`);
  assert.ok(!first.some(name => /Arimo|Tinos|Cousine|Carlito|Caladea|Gelasio/.test(name)), 'no Office face is fetched for a Roboto deck');
  assert.ok(firstLoad < 1_500_000, `first load font bytes: ${firstLoad}`);
  // RR-18: the status bar leaves "Loading fonts…" once the faces are in (RR-06 fixed that on main), and the Review panel never reports a font as its own substitute
  // (a weight the registry does not hold is described as that weight, e.g. "Roboto 800: that weight is not available ...").
  await page.waitForFunction(() => !/Loading fonts/.test(document.querySelector('#status').textContent), undefined, { timeout: 60000 });
  const review = await page.evaluate(() => [...document.querySelectorAll('#diagnostics li')].map(item => item.textContent));
  for (const line of review) assert.ok(!/^(.+?) → \1 ·/.test(line), `Review reports a font as its own substitute: ${line}`);
  // RR-18: at phone width the editor reflows instead of scrolling sideways.
  const phone = await browser.newPage({ viewport: { width: 375, height: 812 } });
  phone.on('pageerror', error => errors.push(error.message));
  await phone.goto(`${base}/index.html`);
  await phone.locator('#preview svg').waitFor({ timeout: 60000 });
  const phoneWidths = await phone.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  assert.ok(phoneWidths.scroll <= phoneWidths.client, `the editor scrolls sideways at 375px: ${JSON.stringify(phoneWidths)}`);
  await phone.close();
  const choose = value => page.evaluate(value => { const select = document.querySelector('#font'); select.value = value; select.dispatchEvent(new Event('change', { bubbles: true })); }, value);
  const before = baseFiles().length;
  await choose('calibri');
  await page.waitForFunction(() => [...document.fonts].some(face => face.family.replace(/"/g, '') === 'Carlito' && face.status === 'loaded'), undefined, { timeout: 60000 });
  await page.waitForFunction(() => !/Loading fonts/.test(document.querySelector('#status').textContent), undefined, { timeout: 60000 });
  await page.waitForTimeout(400);
  const carlito = baseFiles().slice(before);
  assert.deepEqual(carlito.sort(), ['Carlito-400-normal', 'Carlito-700-normal'], `Calibri fetched the Carlito faces the deck draws: ${carlito}`);
  const painted = await page.evaluate(async () => {
    await document.fonts.ready;
    return [...document.querySelectorAll('#preview svg text[textLength], #preview svg tspan[textLength]')].map(element => {
      const family = (element.getAttribute('font-family') ?? element.closest('text').getAttribute('font-family')).split(',')[0].trim().replace(/^"|"$/g, '');
      return { family, accepted: Number(element.getAttribute('textLength')), natural: element.getComputedTextLength(), loaded: [...document.fonts].some(face => face.family.replace(/"/g, '') === family && face.status === 'loaded') };
    });
  });
  assert.ok(painted.length > 0);
  for (const run of painted) {
    assert.match(run.family, /^Carlito/, `the Calibri preview paints ${run.family}`);
    assert.ok(run.loaded && Math.abs(run.natural - run.accepted) < 0.1, `${run.family}: drawn ${run.natural} differs from measured ${run.accepted}`);
  }
  const count = baseFiles().length;
  await choose('roboto'); await page.waitForTimeout(300);
  await choose('calibri'); await page.waitForTimeout(500);
  assert.equal(baseFiles().length, count, 'loaded faces are not fetched again');
  // The gallery's handoff (components/editor-frame.tsx): wait for Apply's handler, open the source dialog, fill it, click Apply.
  delayFonts = true;
  const handoff = await browser.newPage({ viewport: { width: 1500, height: 900 } });
  handoff.on('pageerror', error => errors.push(error.message));
  await handoff.goto(`${base}/index.html`);
  await handoff.waitForFunction(() => !!document.querySelector('#apply-json')?.onclick);
  await handoff.evaluate(() => {
    const deck = { name: 'Handed over', design: { fontScheme: 'aptos' }, slides: [{ id: 'a', title: 'Handed-over deck', text: 'Applies the aptos pairing.' }] };
    document.querySelector('#open-json').click();
    const json = document.querySelector('#json');
    json.value = JSON.stringify(deck);
    json.dispatchEvent(new Event('input', { bubbles: true }));
    document.querySelector('#apply-json').click();
  });
  await handoff.waitForFunction(() => /Handed-over deck/.test(document.querySelector('#preview')?.textContent ?? ''), undefined, { timeout: 30000 });
  await handoff.waitForFunction(() => document.querySelector('#status').textContent === 'Presentation source updated', undefined, { timeout: 30000 });
  assert.ok(served.some(item => item.file === 'fonts/intos/Intos-Regular.ttf'), 'the handed-over Aptos deck loaded Intos before it rendered');
  delayFonts = false;
  assert.deepEqual(blocked, [], 'no request leaves the local server');
  assert.deepEqual(errors, []);
  await writeFile(path.join(output, 'report.json'), JSON.stringify({ browser: browser.version(), fontsJsonBytes: startupBytes, baseFaces: baseList.length, firstLoadFontBytes: firstLoad, firstLoadBaseFiles: first, calibriFiles: carlito }, null, 2) + '\n');
  console.log(`Playground base fonts: fonts.json ${startupBytes} bytes, ${baseList.length} base faces on demand; the Roboto deck's first load fetched ${firstLoad} font bytes (${first.length} base files); Calibri fetched ${carlito.join(', ')}.`);
} finally { await browser?.close(); server.close(); }
