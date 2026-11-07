// Integration check (not committed): in the built playground, a slide with a Mermaid diagram takes an overlay shape from the gallery
// ("On the slide"), the overlay is moved on the canvas and a connector is drawn from it to the diagram block with the Connect tool;
// the PowerPoint export from the Export menu writes the diagram as its native group beside the overlay and the connector.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createRequire } from 'node:module';
const { strFromU8, unzipSync } = createRequire('C:/opf-work/sh-phase-2/packages/pptx/package.json')('fflate');

const out = 'C:/opf-work/shapes/integration/editor';
await mkdir(out, { recursive: true });
const root = fileURLToPath(new URL('./artifacts/playground/', import.meta.url));
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.ttf': 'font/ttf', '.wasm': 'application/wasm' };
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const target = path.resolve(root, '.' + decodeURIComponent(url.pathname));
    if (path.relative(root, target).startsWith('..')) { res.writeHead(403).end(); return; }
    const body = await readFile(target);
    res.writeHead(200, { 'Content-Type': types[path.extname(target)] ?? 'application/octet-stream' }).end(body);
  } catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const deck = {
  name: 'Diagram with overlays', filename: 'diagram-overlays.pptx', design: { theme: 'classic', fontScheme: 'roboto' },
  slides: [{ id: 'flow', title: 'Every request is reviewed', blocks: [
    { id: 'note', text: 'Reviewed every week by the release team.' },
    { id: 'chart', diagram: { source: 'flowchart LR\n  A[Request] --- B[Review]\n  B --> C[Ship]', alt: 'A request is reviewed, then shipped.' } }
  ] }]
};
const browser = await chromium.launch({ channel: 'msedge' });
const steps = [];
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, acceptDownloads: true });
  const errors = [];
  page.on('pageerror', error => errors.push(error.stack ?? error.message));
  page.on('console', message => { if (message.type() === 'error' && !/Failed to load resource/.test(message.text())) errors.push(message.text()); });
  await page.addInitScript(() => { globalThis.OPF_EDITOR_HOST = { persistence: false, onReady: host => { globalThis.host = host; } }; });
  const button = name => page.getByRole('button', { name, exact: true });
  const doc = async () => JSON.parse(await page.locator('#json').inputValue());
  const settle = () => page.waitForFunction(() => !/Loading fonts/.test(document.querySelector('#status').textContent), undefined, { timeout: 60000 });
  const waitDoc = async (predicate, message) => { const started = Date.now(); for (;;) { const current = await doc(); if (predicate(current)) return current; if (Date.now() - started > 15000) assert.fail(`${message}: ${JSON.stringify(current).slice(0, 600)}`); await page.waitForTimeout(50); } };
  await page.goto(`http://127.0.0.1:${server.address().port}/index.html`);
  await page.locator('#preview svg').waitFor();
  await page.waitForFunction(() => globalThis.host?.editor);
  await button('Source').click();
  await page.locator('#json').fill(JSON.stringify(deck));
  await page.waitForFunction(() => !document.querySelector('#apply-json').disabled && !document.querySelector('#json-error').textContent);
  await button('Apply changes').click();
  await page.locator('#preview [data-opf-path="slides.0.title"]').first().waitFor();
  await settle();
  await page.locator('#tab-content').click();
  await page.screenshot({ path: `${out}/diagram-1-loaded.png` });
  steps.push('a slide with a diagram loads');

  // Insert a star on the slide from the gallery.
  await page.locator('#insert-shape').click();
  const menu = page.locator('.opf-shape-menu');
  await menu.waitFor();
  await menu.locator('[data-role="shape-placement"]').getByLabel('On the slide').check();
  await menu.getByLabel('Search shapes', { exact: true }).fill('star 5');
  await page.waitForFunction(() => document.querySelector('.opf-shape-menu .opf-sp-tile')?.getAttribute('data-shape') === 'star5');
  await menu.locator('.opf-sp-tile').first().click();
  let current = await waitDoc(d => d.slides[0].shapes?.length === 1, 'the overlay is inserted');
  assert.ok(current.slides[0].blocks.some(block => block.diagram), 'the diagram stays a block');
  await settle();
  steps.push('an overlay star inserted from the gallery on the diagram slide');

  // Move it with the keyboard on its frame (one undoable change), through the editor's API for the frame values.
  const before = current.slides[0].shapes[0];
  await page.evaluate(() => globalThis.host.editor.canvas.reveal('slides.0.shapes.0'));
  await page.locator('#preview [data-canvas-selected][data-opf-path="slides.0.shapes.0"]').waitFor();
  const frame = page.locator('[data-overlay-frame], .opf-overlay-frame').first();
  if (await frame.count()) { await frame.focus(); await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight'); }
  else {
    const box = await page.locator('#preview [data-opf-path="slides.0.shapes.0"]').first().boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down(); await page.mouse.move(box.x + box.width / 2 - 120, box.y + box.height / 2 + 60, { steps: 8 }); await page.mouse.up();
  }
  current = await waitDoc(d => d.slides[0].shapes?.[0] && (d.slides[0].shapes[0].x !== before.x || d.slides[0].shapes[0].y !== before.y), 'the overlay moved');
  await settle();
  await page.screenshot({ path: `${out}/diagram-2-overlay-moved.png` });
  steps.push(`the overlay moved (${before.x.toFixed(3)},${before.y.toFixed(3)} to ${current.slides[0].shapes[0].x.toFixed(3)},${current.slides[0].shapes[0].y.toFixed(3)})`);

  // Connect the star to the note text block.
  await page.keyboard.press('Escape');
  await page.locator('#connector-route').selectOption('elbow');
  const starBox = await page.locator('#preview [data-opf-path="slides.0.shapes.0"]').first().boundingBox();
  const noteBox = await page.locator('#preview [data-opf-path="slides.0.blocks.0.text"]').first().boundingBox();
  await page.locator('#connect-shapes').click();
  await page.locator('[data-connect-cover]').waitFor();
  await page.mouse.move(starBox.x + starBox.width / 2, starBox.y + starBox.height / 2);
  await page.mouse.click(starBox.x + starBox.width / 2, starBox.y + starBox.height / 2);
  await page.locator('[data-connect-start]').waitFor({ state: 'visible' });
  await page.mouse.click(noteBox.x + 10, noteBox.y + 10);
  await page.locator('[data-connect-cover]').waitFor({ state: 'detached' });
  current = await waitDoc(d => d.slides[0].shapes?.some(entry => entry.connector), 'a connector is added');
  await settle();
  await page.screenshot({ path: `${out}/diagram-3-connector.png` });
  steps.push(`a connector from the overlay to the note (${JSON.stringify(current.slides[0].shapes.find(entry => entry.connector).connector)})`);

  // Export to PowerPoint through the Export menu.
  const event = page.waitForEvent('download', { timeout: 180000 });
  await button('Export').click();
  await page.getByRole('menuitem', { name: /^PowerPoint/ }).click();
  const download = await event;
  assert.equal(await download.failure(), null);
  const bytes = await readFile(await download.path());
  await writeFile(`${out}/diagram-overlays.pptx`, bytes);
  await writeFile(`${out}/diagram-overlays.opf.json`, JSON.stringify(current, null, 1));
  const xml = strFromU8(unzipSync(new Uint8Array(bytes))['ppt/slides/slide1.xml']);
  assert.match(xml, /<p:grpSp><p:nvGrpSpPr><p:cNvPr id="\d+" name="OPF diagram 1"/, 'the diagram is its native group');
  assert.ok(!/<p:pic>[\s\S]*?name="OPF diagram 1"/.test(xml), 'not a picture');
  assert.match(xml, /name="OPF shape slides\.0\.shapes\.0"/, 'the overlay star');
  assert.match(xml, /<p:cxnSp><p:nvCxnSpPr><p:cNvPr id="\d+" name="OPF connector slides\.0\.shapes\.1"/, 'the overlay connector');
  const diagramConnectors = (/<p:grpSp><p:nvGrpSpPr><p:cNvPr id="\d+" name="OPF diagram 1"[\s\S]*?<\/p:grpSp>/.exec(xml)[0].match(/<p:cxnSp>/g) ?? []).length;
  steps.push(`the Export menu's PowerPoint file holds the diagram as a native group (${diagramConnectors} glued connector inside), the overlay star and its connector`);
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
  server.close();
  console.log(steps.map(step => `- ${step}`).join('\n'));
}
