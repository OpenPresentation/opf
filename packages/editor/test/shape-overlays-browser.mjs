import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

// SH-06 part B in a real browser, on the built playground (npm run build:playground): an overlay shape inserted from the gallery ("On the slide"), moved and resized on
// the canvas (fractions of the slide; a shape attached to a block keeps its `at`), restacked and deleted, and a connector drawn between two blocks or shapes with the
// Connect tool and edited in the Selected shape section. Each is one undoable change. OPF_SHAPE_SHOTS=<dir> also writes screenshots.
const shots = process.env.OPF_SHAPE_SHOTS;
if (shots) await mkdir(shots, { recursive: true });
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
  name: 'Overlays',
  design: { theme: 'classic', fontScheme: 'roboto' },
  slides: [
    { id: 'plain', title: 'Free shapes', blocks: [{ id: 'left', text: 'Plan' }, { id: 'right', text: 'Build' }] },
    {
      id: 'anchored',
      title: 'Attached',
      blocks: [{ id: 'metric', metric: { value: 42, label: 'Score' } }],
      shapes: [
        { id: 'badge', shape: 'ellipse', text: '1', at: { block: 'metric', edge: 'top', offset: 8, width: 48, height: 48 } },
        { id: 'free', shape: 'rect', x: 0.1, y: 0.7, width: 0.2, height: 0.1 },
      ],
    },
  ],
};

let browser;
const checks = [];
const canon = value => JSON.stringify(value, (key, entry) => (entry && typeof entry === 'object' && !Array.isArray(entry) ? Object.fromEntries(Object.keys(entry).sort().map(name => [name, entry[name]])) : entry));
try {
  browser = await chromium.launch({ channel: process.platform === 'win32' && !process.env.CI ? 'msedge' : undefined });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.stack ?? error.message));
  page.on('console', message => { if (message.type() === 'error' && !/Failed to load resource/.test(message.text())) errors.push(message.text()); });
  await page.addInitScript(() => { globalThis.OPF_EDITOR_HOST = { persistence: false, onReady: host => { globalThis.host = host; } }; });
  const button = name => page.getByRole('button', { name, exact: true });
  const selection = page.locator('#selection-controls');
  const doc = async () => JSON.parse(await page.locator('#json').inputValue());
  const settle = () => page.waitForFunction(() => !/Loading fonts/.test(document.querySelector('#status').textContent) && !document.querySelector('#preview')?.textContent.includes('Loading fonts'), undefined, { timeout: 60000 });
  const waitDoc = async (predicate, message) => {
    const started = Date.now();
    for (;;) {
      const current = await doc();
      if (predicate(current)) return current;
      if (Date.now() - started > 8000) assert.fail(`${message}: ${JSON.stringify(current).slice(0, 700)}`);
      await page.waitForTimeout(40);
    }
  };
  const mark = name => checks.push(name);
  const shot = async name => { if (shots) await page.screenshot({ path: path.join(shots, `${name}.png`) }); };
  const slide = async index => { await page.locator('#slide-list button').nth(index).click(); await page.waitForFunction(i => document.querySelector('#slide-list').children[i].getAttribute('aria-current') === 'true', index); await settle(); };
  const select = async overlayPath => { await page.evaluate(p => globalThis.host.editor.canvas.reveal(p), overlayPath); await page.locator(`#preview [data-canvas-selected][data-opf-path="${overlayPath}"]`).waitFor(); };
  const shapes = async (index = 0) => (await doc()).slides[index].shapes;
  const field = (label, options = {}) => selection.locator('.opf-shape-controls').getByLabel(label, { exact: true, ...options });
  const setNumber = async (label, value) => { const input = field(label); await input.fill(String(value)); await input.blur(); };
  // Undo, and click again when the first click changed nothing (a click right after a drag only settles it).
  const undo = async () => {
    for (let tries = 0; tries < 6; tries += 1) {
      const prior = canon(await doc());
      await button('Undo').click();
      const started = Date.now();
      while (canon(await doc()) === prior && Date.now() - started < 1200) await page.waitForTimeout(40);
      if (canon(await doc()) !== prior) return;
    }
    assert.fail('Undo changed nothing');
  };
  async function step(name, action, predicate, { single = false } = {}) {
    const before = await doc();
    await action();
    const after = await waitDoc(predicate, name);
    let presses = 0;
    for (let tries = 0; tries < 10; tries += 1) {
      const prior = canon(await doc());
      await button('Undo').click();
      const started = Date.now();
      while (canon(await doc()) === prior && Date.now() - started < 1200) await page.waitForTimeout(40);
      // A click that changed nothing (the first one after a drag only settles it) is not an undo step.
      if (canon(await doc()) === prior) continue;
      presses += 1;
      if (canon(await doc()) === canon(before)) break;
    }
    assert.equal(canon(await doc()), canon(before), `${name}: undo restores the document`);
    if (single) assert.equal(presses, 1, `${name}: one undo step`);
    for (let i = 0; i < presses; i += 1) await button('Redo').click();
    await waitDoc(current => canon(current) === canon(after), `${name}: redo`);
    mark(name);
    return after;
  }
  // The shape's box on screen, from the frame the canvas draws around the selected overlay.
  const frameBox = async () => { const box = await page.locator('[data-overlay-frame]').boundingBox(); assert.ok(box, 'a frame is drawn around the selected overlay'); return box; };

  await page.goto(`http://127.0.0.1:${server.address().port}/index.html`);
  await page.locator('#preview svg').waitFor();
  await page.waitForFunction(() => globalThis.host?.editor);
  await button('Source').click();
  await page.locator('#json').fill(JSON.stringify(source));
  await page.waitForFunction(() => !document.querySelector('#apply-json').disabled && !document.querySelector('#json-error').textContent);
  await button('Apply changes').click();
  await page.locator('#preview [data-canvas-target][data-opf-path="slides.0.title"]').waitFor();
  await settle();
  await page.locator('#tab-content').click();

  // --- insert as an overlay from the gallery: "On the slide"
  const insert = page.locator('#insert-shape');
  await insert.click();
  const menu = page.locator('.opf-shape-menu');
  await menu.waitFor();
  const placement = menu.locator('[data-role="shape-placement"]');
  assert.deepEqual(await placement.locator('label').allTextContents(), [' In the layout', ' On the slide']);
  assert.equal(await placement.locator('input:checked').getAttribute('value'), 'block', 'in the layout is the default');
  await placement.getByLabel('On the slide').check();
  await menu.getByLabel('Search shapes', { exact: true }).fill('star 5');
  await page.waitForFunction(() => document.querySelector('.opf-shape-menu .opf-sp-tile')?.getAttribute('data-shape') === 'star5');
  await step('an overlay shape inserted from the gallery', async () => { await menu.locator('.opf-sp-tile').first().click(); await menu.waitFor({ state: 'hidden' }); }, current => current.slides[0].shapes?.length === 1 && current.slides[0].shapes[0].shape === 'star5' && current.slides[0].blocks.length === 2, { single: true });
  const inserted = (await shapes())[0];
  assert.ok(inserted.x >= 0 && inserted.y >= 0 && inserted.width > 0.1 && Math.abs((inserted.height * 720) / (inserted.width * 1280) - 1) < 0.02, `a star keeps its proportions: ${JSON.stringify(inserted)}`);
  // The choice is remembered.
  await insert.click();
  assert.equal(await placement.locator('input:checked').getAttribute('value'), 'overlay', 'the choice is remembered');
  await page.keyboard.press('Escape');
  await settle();
  await page.locator('#preview [data-opf-path="slides.0.shapes.0"]').waitFor();
  mark('the gallery places a shape on the slide, with the choice remembered');
  await shot('overlay-inserted');

  // --- the frame: a selected overlay shape shows eight handles
  await select('slides.0.shapes.0');
  await page.locator('[data-overlay-frame]').waitFor();
  assert.equal(await page.locator('[data-overlay-handle]').count(), 9, 'eight resize handles and a move grip');
  assert.equal(await selection.locator('.opf-shape-controls [data-role="shape-placement-group"]').count(), 1, 'the section has Place on the slide');
  assert.equal(await selection.locator('.opf-shape-controls [data-role="shape-stack-group"]').count(), 1, 'and Stacking');
  mark('a selected overlay shape shows its frame, and the section its place and stacking');

  // --- move by dragging its outline; the fractions are written, kept on the slide, one undo step
  const svgBox = async () => page.locator('#preview svg').first().boundingBox();
  const drag = async (from, to, { steps = 8, keep = false } = {}) => {
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps });
    if (!keep) await page.mouse.up();
  };
  const before = await frameBox();
  const slideBox = await svgBox();
  const moved = await step('dragging the shape moves it: x and y are written as fractions', async () => {
    // A star's body is its center: press a little above it, on the outline target and not on any text.
    await drag({ x: before.x + before.width / 2, y: before.y + before.height * 0.62 }, { x: before.x + before.width / 2 + 120, y: before.y + before.height * 0.62 + 60 });
  }, current => { const s = current.slides[0].shapes[0]; return s.x > inserted.x + 0.02 && s.y > inserted.y + 0.02 && s.width === inserted.width; }, { single: true });
  const expectedDx = 120 / slideBox.width;
  assert.ok(Math.abs(moved.slides[0].shapes[0].x - inserted.x - expectedDx) < 0.01, `x moved by the pointer's travel: ${moved.slides[0].shapes[0].x - inserted.x} against ${expectedDx}`);
  await shot('overlay-moved');
  // Kept on the slide, however far it is dragged.
  const now = await frameBox();
  await drag({ x: now.x + now.width / 2, y: now.y + now.height * 0.62 }, { x: slideBox.x + slideBox.width + 400, y: slideBox.y + slideBox.height + 400 });
  const edge = (await shapes())[0];
  assert.ok(edge.x + edge.width <= 1 + 1e-9 && edge.y + edge.height <= 1 + 1e-9, `kept on the slide: ${JSON.stringify(edge)}`);
  await undo();
  await waitDoc(current => canon(current.slides[0].shapes[0]) === canon(moved.slides[0].shapes[0]), 'undo the far drag');
  mark('a move is kept on the slide');
  // A press that does not travel is a click: it selects and nothing is written.
  const quiet = await doc();
  const there = await frameBox();
  await page.mouse.click(there.x + there.width / 2, there.y + there.height * 0.62);
  await page.waitForTimeout(200);
  assert.equal(canon(await doc()), canon(quiet), 'a click writes nothing');
  // Escape cancels a drag.
  const start = await frameBox();
  await drag({ x: start.x + start.width / 2, y: start.y + start.height * 0.62 }, { x: start.x + start.width / 2 + 90, y: start.y + start.height * 0.62 }, { keep: true });
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await page.waitForTimeout(200);
  assert.equal(canon(await doc()), canon(quiet), 'Escape cancels a move');
  mark('a click selects and Escape cancels a drag');

  // --- resize by a handle
  const frame = await frameBox();
  const se = page.locator('[data-overlay-handle="se"]');
  const seBox = await se.boundingBox();
  const resized = await step('dragging a handle resizes it', async () => {
    await drag({ x: seBox.x + seBox.width / 2, y: seBox.y + seBox.height / 2 }, { x: seBox.x + seBox.width / 2 + 80, y: seBox.y + seBox.height / 2 + 50 });
  }, current => { const s = current.slides[0].shapes[0]; return s.width > moved.slides[0].shapes[0].width && s.height > moved.slides[0].shapes[0].height && s.x === moved.slides[0].shapes[0].x; }, { single: true });
  assert.ok(Math.abs(resized.slides[0].shapes[0].width - moved.slides[0].shapes[0].width - 80 / slideBox.width) < 0.01);
  assert.ok(frame.width > 0);
  // The north-west handle keeps the opposite corner still.
  const nw = page.locator('[data-overlay-handle="nw"]');
  const nwBox = await nw.boundingBox();
  const corner = (await shapes())[0];
  await drag({ x: nwBox.x + nwBox.width / 2, y: nwBox.y + nwBox.height / 2 }, { x: nwBox.x + nwBox.width / 2 + 30, y: nwBox.y + nwBox.height / 2 + 20 });
  const shrunk = (await shapes())[0];
  assert.ok(Math.abs(shrunk.x + shrunk.width - corner.x - corner.width) < 0.002 && Math.abs(shrunk.y + shrunk.height - corner.y - corner.height) < 0.002, 'the south-east corner stays');
  await undo();
  await shot('overlay-resized');
  mark('the north-west handle keeps the opposite corner');
  // Keyboard: arrows move the focused frame, Shift resizes.
  await page.locator('[data-overlay-frame]').focus();
  await step('arrow keys move the frame, one undoable step each', async () => { await page.keyboard.press('ArrowRight'); }, current => current.slides[0].shapes[0].x > resized.slides[0].shapes[0].x, { single: true });
  await page.locator('[data-overlay-frame]').focus();
  await step('Shift and an arrow resize it', async () => { await page.keyboard.press('Shift+ArrowRight'); }, current => current.slides[0].shapes[0].width > resized.slides[0].shapes[0].width, { single: true });

  // --- placement fields
  await step('X, Y, Width and Height in the section', async () => { await setNumber('X', 10); await setNumber('Y', 20); await setNumber('Width', 30); await setNumber('Height', 25); }, current => { const s = current.slides[0].shapes[0]; return s.x === 0.1 && s.y === 0.2 && s.width === 0.3 && s.height === 0.25; });

  // --- the adjust handles of an overlay shape work too
  await step('an overlay shape changes preset and keeps its place', async () => {
    await selection.locator('[data-role="shape-change"]').click();
    const panel = selection.locator('[data-role="shape-picker-panel"]');
    await panel.getByLabel('Search shapes', { exact: true }).fill('chevron');
    await panel.locator('.opf-sp-tile').first().click();
  }, current => current.slides[0].shapes[0].shape === 'chevron' && current.slides[0].shapes[0].x === 0.1);
  await page.locator('[data-shape-handle="0"]').waitFor();
  const handleBox = await page.locator('[data-shape-handle="0"]').boundingBox();
  await step('an overlay shape\'s adjust handle writes adjust', async () => { await drag({ x: handleBox.x + handleBox.width / 2, y: handleBox.y + handleBox.height / 2 }, { x: handleBox.x - 40, y: handleBox.y + handleBox.height / 2 }); }, current => typeof current.slides[0].shapes[0].adjust?.adj === 'number');
  mark('an overlay shape has the adjust handles and the shape picker too');

  // --- stacking
  await page.evaluate(() => globalThis.host.session.applyPatch([{ op: 'add', path: '/slides/0/shapes/-', value: { shape: 'rect', x: 0.6, y: 0.6, width: 0.2, height: 0.1, text: 'Top' } }]));
  await settle();
  await select('slides.0.shapes.0');
  const order = async () => (await shapes()).map(entry => entry.text ?? entry.shape);
  assert.deepEqual(await order(), ['chevron', 'Top']);
  await step('Bring to front', async () => { await selection.locator('[data-role="overlay-front"]').click(); }, current => current.slides[0].shapes.at(-1).shape === 'chevron', { single: true });
  await select('slides.0.shapes.1');
  await step('Send backward', async () => { await selection.locator('[data-role="overlay-backward"]').click(); }, current => current.slides[0].shapes[0].shape === 'chevron', { single: true });
  mark('Bring forward and Send backward are the array order');
  await shot('overlay-stacking');

  // --- delete
  await select('slides.0.shapes.1');
  await step('Delete removes an overlay shape', async () => { await selection.locator('[data-role="overlay-remove"]').click(); }, current => current.slides[0].shapes.length === 1, { single: true });

  // --- a shape attached to a block keeps its anchor
  await slide(1);
  await select('slides.1.shapes.0');
  await page.locator('[data-overlay-frame]').waitFor();
  const anchored = await page.locator('[data-role="shape-anchor-info"]').textContent();
  assert.match(anchored, /Attached to metric, top/);
  const anchorFrame = await frameBox();
  const moveUp = await step('dragging an attached shape changes its offset and keeps `at`', async () => {
    // A small shape is mostly its text, which a press edits: its grip moves it.
    const grip = await page.locator('[data-overlay-handle="move"]').boundingBox();
    await drag({ x: grip.x + grip.width / 2, y: grip.y + grip.height / 2 }, { x: grip.x + grip.width / 2, y: grip.y + grip.height / 2 - 30 });
  }, current => { const s = current.slides[1].shapes[0]; return s.at?.block === 'metric' && s.at.offset > 8 && s.x === undefined; }, { single: true });
  assert.ok(moveUp.slides[1].shapes[0].at.offset > 8);
  const sw = page.locator('[data-overlay-handle="se"]');
  const swBox = await sw.boundingBox();
  await step('resizing an attached shape changes at.width and at.height', async () => { await drag({ x: swBox.x + swBox.width / 2, y: swBox.y + swBox.height / 2 }, { x: swBox.x + swBox.width / 2 + 24, y: swBox.y + swBox.height / 2 + 24 }); }, current => { const s = current.slides[1].shapes[0]; return s.at.width > 48 && s.at.height > 48 && s.x === undefined; }, { single: true });
  await step('Free from block turns it into fractions', async () => { await selection.locator('[data-role="shape-free"]').click(); }, current => { const s = current.slides[1].shapes[0]; return s.at === undefined && s.x > 0 && s.width > 0; }, { single: true });
  await shot('overlay-anchored');
  mark('an attached shape keeps its anchor until it is freed');

  // --- connectors
  await slide(0);
  await page.locator('#connector-route').selectOption('elbow');
  const connect = page.locator('#connect-shapes');
  const leftBox = await page.locator('#preview [data-opf-path="slides.0.blocks.0.text"]').first().boundingBox();
  const rightBox = await page.locator('#preview [data-opf-path="slides.0.blocks.1.text"]').first().boundingBox();
  const connectorStep = await step('Connect joins two blocks with a connector, one undoable step', async () => {
    await connect.click();
    assert.equal(await connect.getAttribute('aria-pressed'), 'true');
    await page.locator('[data-connect-cover]').waitFor();
    await page.mouse.move(leftBox.x + 10, leftBox.y + 10);
    await page.locator('[data-connect-hover]').waitFor({ state: 'visible' });
    await shot('connect-picking');
    await page.mouse.click(leftBox.x + 10, leftBox.y + 10);
    await page.locator('[data-connect-start]').waitFor({ state: 'visible' });
    await page.mouse.click(rightBox.x + 10, rightBox.y + 10);
    await page.locator('[data-connect-cover]').waitFor({ state: 'detached' });
  }, current => { const list = current.slides[0].shapes ?? []; const connector = list.find(entry => entry.connector); return connector?.connector.from === 'left' && connector.connector.to === 'right' && connector.connector.route === 'elbow' && connector.stroke?.end?.type === 'triangle'; }, { single: true });
  assert.equal(await connect.getAttribute('aria-pressed'), 'false');
  await settle();
  const connectorPath = `slides.0.shapes.${connectorStep.slides[0].shapes.findIndex(entry => entry.connector)}`;
  await page.locator(`#preview [data-opf-path="${connectorPath}"]`).waitFor();
  await shot('connector-drawn');
  mark('Connect picks two blocks and the route, with an arrowhead');
  // Esc cancels the tool; two clicks on the same thing do nothing.
  const quietDoc = await doc();
  await connect.click();
  await page.locator('[data-connect-cover]').waitFor();
  await page.mouse.click(leftBox.x + 10, leftBox.y + 10);
  await page.mouse.click(leftBox.x + 12, leftBox.y + 12);
  assert.equal(canon(await doc()), canon(quietDoc), 'the same thing twice joins nothing');
  await page.keyboard.press('Escape');
  await page.locator('[data-connect-cover]').waitFor({ state: 'detached' });
  assert.equal(await connect.getAttribute('aria-pressed'), 'false');
  mark('Escape cancels the Connect tool');

  // --- a connector in the section
  await select(connectorPath);
  const connectorGroup = selection.locator('.opf-shape-controls [data-role="shape-connector-group"]');
  await connectorGroup.waitFor();
  assert.equal(await selection.locator('.opf-shape-controls [data-role="shape-fill-group"]').isVisible(), false, 'a connector has no fill');
  await step('the connector\'s route', async () => { await field('Connector route').selectOption('curved'); }, current => current.slides[0].shapes.find(entry => entry.connector).connector.route === 'curved');
  await step('the connector end (a shape with no id gets one)', async () => { await field('Connector end').selectOption({ label: 'chevron (no id yet)' }); }, current => { const c = current.slides[0].shapes.find(entry => entry.connector).connector; return c.from === 'left' && c.to === 'chevron' && current.slides[0].shapes.find(entry => entry.shape === 'chevron').id === 'chevron'; });
  await step('a connection site', async () => { await setNumber('Start site', 1); }, current => current.slides[0].shapes.find(entry => entry.connector).connector.fromSite === 1);
  await step('the connector\'s line and arrowheads', async () => { await field('Line').selectOption('custom'); await setNumber('Line width', 4); await field('Start arrowhead').selectOption('oval'); }, current => { const s = current.slides[0].shapes.find(entry => entry.connector).stroke; return s.width === 4 && s.start?.type === 'oval' && s.end?.type === 'triangle'; });
  await step('Send to back moves the connector in the array', async () => {
    await page.evaluate(() => globalThis.host.session.applyPatch([{ op: 'add', path: '/slides/0/shapes/-', value: { shape: 'ellipse', x: 0.7, y: 0.1, width: 0.1, height: 0.1 } }]));
    await settle();
    await select(connectorPath);
    await selection.locator('[data-role="overlay-back"]').click();
  }, current => current.slides[0].shapes[0].connector !== undefined);
  mark('a connector has its route, ends, sites, line and arrowheads in the section');
  await shot('connector-controls');
  // Deleting a shape removes the connectors on it.
  await page.evaluate(() => globalThis.host.session.applyPatch([{ op: 'add', path: '/slides/0/shapes/-', value: { id: 'bubble', shape: 'cloud', x: 0.4, y: 0.1, width: 0.2, height: 0.15 } }, { op: 'add', path: '/slides/0/shapes/-', value: { connector: { from: 'left', to: 'bubble' } } }]));
  await settle();
  const bubble = (await shapes()).findIndex(entry => entry.id === 'bubble');
  await select(`slides.0.shapes.${bubble}`);
  await step('deleting a shape deletes the connectors on it', async () => { await selection.locator('[data-role="overlay-remove"]').click(); }, current => !current.slides[0].shapes.some(entry => entry.id === 'bubble' || entry.connector?.to === 'bubble'), { single: true });
  mark('deleting an overlay deletes the connectors on it');

  assert.deepEqual(errors, [], 'no page errors');
  console.log(`shape overlays browser test ok: ${checks.length} checks`);
  for (const name of checks) console.log(`  - ${name}`);
} finally {
  await browser?.close();
  server.close();
}
