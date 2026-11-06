import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

// SH-06 in a real browser, on the built playground (npm run build:playground): the shape picker (search by DrawingML name and common
// words, PowerPoint's nine groups), inserting a shape, the adjust handles on the canvas (drag, keyboard, Escape, range), changing a block's preset and
// every property in the Selected shape section (fill, line, style, effects, rotate and flip, text, alt text and link). Each is one undoable change: Undo
// restores the document exactly and Redo returns it. OPF_SHAPE_SHOTS=<dir> also writes screenshots.
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
  name: 'Shapes',
  design: { theme: 'classic', fontScheme: 'roboto' },
  slides: [
    { id: 'empty', title: 'Insert here' },
    { id: 'arrow', title: 'Adjust', blocks: [{ shape: 'chevron', text: 'Plan' }] },
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
      if (Date.now() - started > 8000) assert.fail(`${message}: ${JSON.stringify(current).slice(0, 600)}`);
      await page.waitForTimeout(40);
    }
  };
  const mark = name => checks.push(name);
  // Undo re-adds a removed key at the end of its object, so documents are compared with their keys in order.
  const canon = value => JSON.stringify(value, (key, entry) => (entry && typeof entry === 'object' && !Array.isArray(entry) ? Object.fromEntries(Object.keys(entry).sort().map(name => [name, entry[name]])) : entry));
  const shot = async name => { if (shots) await page.screenshot({ path: path.join(shots, `${name}.png`) }); };
  const slide = async index => { await page.locator('#slide-list button').nth(index).click(); await page.waitForFunction(i => document.querySelector('#slide-list').children[i].getAttribute('aria-current') === 'true', index); await settle(); };
  const select = async blockPath => { await page.evaluate(p => globalThis.host.editor.canvas.reveal(p), `${blockPath}.shape`); await page.locator(`#preview [data-canvas-selected][data-opf-path="${blockPath}.shape"]`).waitFor(); };
  const block = async (slideIndex = 1, index = 0) => (await doc()).slides[slideIndex].blocks[index];
  // One edit in, back out: act, check the document, Undo until the document is what it was (one press for a single edit; `single` insists on it, and a step
  // made of several controls needs one press for each), then Redo the same number of times and the document is what it became.
  async function step(name, action, predicate, { single = false } = {}) {
    const before = await doc();
    await action();
    const after = await waitDoc(predicate, name);
    let presses = 0;
    for (; presses < 8; ) {
      const prior = canon(await doc());
      await button('Undo').click();
      presses += 1;
      const started = Date.now();
      while (canon(await doc()) === prior && Date.now() - started < 1500) await page.waitForTimeout(40);
      if (canon(await doc()) === canon(before)) break;
    }
    assert.equal(canon(await doc()), canon(before), `${name}: undo restores the document`);
    if (single) assert.equal(presses, 1, `${name}: one undo step`);
    for (let i = 0; i < presses; i += 1) await button('Redo').click();
    await waitDoc(current => canon(current) === canon(after), `${name}: redo`);
    mark(name);
    return after;
  }
  const open = async title => { const details = selection.locator('details.opf-sc-group', { has: page.locator(`summary:text-is("${title}")`) }); if (await details.evaluate(node => !node.open)) await details.locator('summary').click(); return details; };
  const field = (label, options = {}) => selection.locator('.opf-shape-controls').getByLabel(label, { exact: true, ...options });
  const setNumber = async (label, value) => { const input = field(label); try { await input.fill(String(value), { timeout: 5000 }); } catch (error) { await page.screenshot({ path: 'artifacts/scratch/fail.png', fullPage: true }); throw error; } await input.blur(); };
  const setText = async (label, value) => { const input = field(label); await input.fill(value); await input.blur(); };

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

  // --- the picker: groups, tiles from the geometry, search by every kind of name
  const insert = page.locator('#insert-shape');
  await insert.click();
  const menu = page.locator('.opf-shape-menu');
  await menu.waitFor();
  assert.equal(await insert.getAttribute('aria-expanded'), 'true');
  await menu.locator('.opf-sp-tile').first().waitFor();
  assert.equal(await menu.locator('.opf-sp-heading').count(), 9);
  assert.deepEqual(await menu.locator('.opf-sp-heading').allTextContents(), ['Lines', 'Rectangles', 'Basic Shapes', 'Block Arrows', 'Equation Shapes', 'Flowchart', 'Stars and Banners', 'Callouts', 'Action Buttons']);
  assert.equal(await menu.locator('.opf-sp-tile').count(), 187, 'all 187 presets');
  assert.equal(await menu.locator('.opf-sp-tile svg path').first().evaluate(node => node.getAttribute('d').startsWith('M')), true, 'a tile is drawn from the preset geometry');
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('data-role')), 'shape-search', 'the search takes focus');
  mark('the gallery shows all 187 presets in PowerPoint\'s nine groups, each drawn from its geometry');
  await shot('picker-gallery');

  const search = menu.getByLabel('Search shapes', { exact: true });
  const firstOf = async query => { await search.fill(query); await page.waitForFunction(q => document.querySelector('[data-role="shape-search"]').value === q, query); return menu.locator('.opf-sp-tile').first().getAttribute('data-shape'); };
  assert.equal(await firstOf('rightArrow'), 'rightArrow', 'by DrawingML name');
  assert.equal(await firstOf('speech bubble'), 'wedgeRectCallout', 'by common words');
  assert.equal(await firstOf('cylinder'), 'can');
  assert.equal(await menu.locator('[data-role="shape-count"]').textContent(), '2 shapes');
  assert.ok(await menu.locator('.opf-sp-tile').count() > 0);
  await search.fill('arrow');
  assert.ok(await menu.locator('.opf-sp-tile').count() >= 30, 'arrow matches the block arrows');
  await search.fill('zzzzzz');
  assert.equal(await menu.locator('[data-role="shape-count"]').textContent(), 'No shapes match "zzzzzz".');
  mark('search finds presets by DrawingML name and common words');
  await search.fill('callout');
  await shot('picker-search');

  // --- insert one: by Enter on the search, one undoable step, selected with its handles
  await slide(0);
  await insert.click();
  await menu.waitFor();
  await search.fill('flowchart decision');
  await page.waitForFunction(() => document.querySelector('.opf-shape-menu .opf-sp-tile')?.getAttribute('data-shape') === 'flowChartDecision');
  await step('insert a shape from the search with Enter', async () => { await search.press('Enter'); await menu.waitFor({ state: 'hidden' }); }, current => JSON.stringify(current.slides[0].blocks) === JSON.stringify([{ shape: 'flowChartDecision' }]), { single: true });
  assert.equal(await insert.getAttribute('aria-expanded'), 'false');
  await settle();
  await page.locator('#preview [data-canvas-target][data-opf-path="slides.0.blocks.0.shape"]').waitFor();
  // Escape closes the menu without inserting; so does a press outside it.
  await insert.click();
  await menu.waitFor();
  await page.keyboard.press('Escape');
  await menu.waitFor({ state: 'hidden' });
  await insert.click();
  await menu.waitFor();
  await page.locator('#slide-title').click({ force: true });
  await menu.waitFor({ state: 'hidden' });
  assert.equal((await doc()).slides[0].blocks.length, 1);
  mark('Escape and a press outside close the menu without inserting');

  // --- the adjust handles
  await slide(1);
  await select('slides.1.blocks.0');
  const handle = page.locator('[data-shape-handle="0"]');
  await handle.waitFor();
  assert.equal(await page.locator('[data-shape-handle]').count(), 1, 'a chevron has one handle');
  assert.equal(await handle.getAttribute('data-adjust'), 'adj');
  assert.match(await handle.getAttribute('aria-label'), /Adjust chevron \(adj\), handle 1 of 1/);
  const drag = async (to, { keep = false } = {}) => {
    const box = await handle.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + to.x, box.y + box.height / 2 + to.y, { steps: 6 });
    if (!keep) await page.mouse.up();
  };
  const dragged = await step('dragging a handle writes adjust as a fraction in one undoable step', () => drag({ x: -60, y: 0 }), current => typeof current.slides[1].blocks[0].adjust?.adj === 'number' && current.slides[1].blocks[0].adjust.adj > 0.5, { single: true });
  const adj = dragged.slides[1].blocks[0].adjust.adj;
  assert.equal(adj, Math.round(adj * 10000) / 10000, 'four places');
  await shot('handle-dragged');
  // The range: pulling far left pins to the handle's own maximum (a chevron's point reaches the frame's width over height).
  await drag({ x: -4000, y: 0 });
  const pinned = (await block()).adjust.adj;
  assert.ok(pinned >= adj && pinned <= 2 + 1e-9, `pinned inside the range: ${pinned}`);
  await button('Undo').click();
  await waitDoc(current => current.slides[1].blocks[0].adjust?.adj === adj, 'undo the pinned drag');
  mark('a drag keeps the handle in its range');
  // Escape cancels a drag: nothing changes and nothing joins the undo stack.
  const before = await doc();
  await drag({ x: 80, y: 0 }, { keep: true });
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await page.waitForTimeout(200);
  assert.deepEqual(await doc(), before, 'Escape cancels the drag');
  mark('Escape cancels a drag');
  // Keyboard: arrows nudge a focused handle, one undoable step a press.
  await step('an arrow key nudges a handle', async () => { await handle.focus(); await page.keyboard.press('ArrowLeft'); }, current => current.slides[1].blocks[0].adjust.adj > adj);
  await page.locator('[data-shape-handle="0"]').waitFor();
  // The adjust field mirrors it and can set a value by typing.
  await step('the adjust field sets the value by typing', async () => { await setNumber('Adjust adj', 0.8); }, current => current.slides[1].blocks[0].adjust.adj === 0.8);
  await setNumber('Adjust adj', 5);
  await waitDoc(current => current.slides[1].blocks[0].adjust.adj === 2, 'the field pins to the range too');
  await button('Undo').click();
  await waitDoc(current => current.slides[1].blocks[0].adjust?.adj === 0.8, 'undo the typed value');
  mark('the adjust field and the handle agree');

  // A two-handle preset and an angle preset: degrees.
  await page.evaluate(() => { const e = globalThis.host.session; e.set('slides.1.blocks.0.shape', 'pie'); e.set('slides.1.blocks.0.adjust', {}); });
  await settle();
  await select('slides.1.blocks.0');
  await page.locator('[data-shape-handle="1"]').waitFor();
  assert.equal(await page.locator('[data-shape-handle]').count(), 2, 'a pie has two handles');
  const pieHandle = page.locator('[data-shape-handle="1"]');
  const pieBox = await pieHandle.boundingBox();
  await page.mouse.move(pieBox.x + pieBox.width / 2, pieBox.y + pieBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(pieBox.x + pieBox.width / 2 + 160, pieBox.y + pieBox.height / 2 + 120, { steps: 8 });
  await page.mouse.up();
  const pie = await waitDoc(current => typeof current.slides[1].blocks[0].adjust?.adj2 === 'number', 'a pie angle');
  assert.ok(pie.slides[1].blocks[0].adjust.adj2 >= 0 && pie.slides[1].blocks[0].adjust.adj2 <= 360, `degrees: ${pie.slides[1].blocks[0].adjust.adj2}`);
  assert.equal(Object.keys(pie.slides[1].blocks[0].adjust).join(), 'adj2', 'only the dragged handle\'s value is written');
  mark('an angle handle writes degrees');
  await shot('handles-pie');
  await page.evaluate(() => globalThis.host.session.set('slides.1.blocks.0', { shape: 'chevron', text: 'Plan' }));
  await settle();
  await select('slides.1.blocks.0');

  // --- change the preset: adjust values the new preset also has are kept
  await page.evaluate(() => globalThis.host.session.set('slides.1.blocks.0.adjust', { adj: 0.3 }));
  await settle();
  await select('slides.1.blocks.0');
  const change = selection.locator('[data-role="shape-change"]');
  await change.click();
  const panel = selection.locator('[data-role="shape-picker-panel"]');
  await panel.locator('.opf-sp-tile').first().waitFor();
  assert.equal(await panel.locator('.opf-sp-tile[aria-pressed="true"]').getAttribute('data-shape'), 'chevron', 'the current preset is marked');
  await panel.getByLabel('Search shapes', { exact: true }).fill('homePlate');
  await step('change the preset from the section\'s picker', async () => { await panel.locator('.opf-sp-tile').first().click(); }, current => current.slides[1].blocks[0].shape === 'homePlate' && current.slides[1].blocks[0].adjust?.adj === 0.3);
  assert.equal(await selection.locator('[data-role="shape-preset"]').textContent(), 'Home Plate (homePlate)');
  await page.evaluate(() => globalThis.host.session.set('slides.1.blocks.0', { shape: 'chevron', text: 'Plan' }));
  await settle();
  await select('slides.1.blocks.0');
  mark('changing the preset keeps the adjust values it shares');

  // --- fill
  await field('Fill').selectOption('color');
  await waitDoc(current => current.slides[1].blocks[0].fill === 'accent1', 'fill color');
  await step('a color fill with a lighter tint', async () => { await setText('Fill color', 'accent2'); await field('Fill color tint').selectOption('lighten'); }, current => JSON.stringify(current.slides[1].blocks[0].fill) === JSON.stringify({ color: 'accent2', lighten: 0.4 }));
  await step('a gradient fill with its type, angle and stops', async () => {
    await field('Fill').selectOption('gradient');
    await waitDoc(current => current.slides[1].blocks[0].fill?.gradient, 'gradient');
    await field('Gradient type').selectOption('linear');
    await setNumber('Gradient angle', 45);
    await setText('Gradient stop 1 color', '#ff8800');
  }, current => { const g = current.slides[1].blocks[0].fill?.gradient; return g?.type === 'linear' && g.angle === 45 && g.stops[0].color === '#ff8800' && g.stops.length === 2; });
  await step('a gradient stop added', async () => { await selection.getByRole('button', { name: 'Add stop', exact: true }).first().click(); }, current => current.slides[1].blocks[0].fill.gradient.stops.length === 3);
  await field('Gradient type').selectOption('radial');
  await waitDoc(current => current.slides[1].blocks[0].fill.gradient.type === 'radial' && current.slides[1].blocks[0].fill.gradient.angle === undefined, 'radial has no angle');
  await shot('fill-gradient');
  await step('a pattern fill', async () => { await field('Fill').selectOption('pattern'); }, current => current.slides[1].blocks[0].fill?.pattern?.preset === 'ltUpDiag');
  await step('the pattern preset and colors', async () => { await field('Pattern').selectOption('smGrid'); await setText('Pattern foreground', 'accent3'); }, current => { const p = current.slides[1].blocks[0].fill.pattern; return p.preset === 'smGrid' && p.foregroundColor === 'accent3'; });
  await step('no fill', async () => { await field('Fill').selectOption('none'); }, current => current.slides[1].blocks[0].fill === 'none');
  await step('the fill follows the style again', async () => { await field('Fill').selectOption(''); }, current => current.slides[1].blocks[0].fill === undefined);
  await field('Fill').selectOption('color');
  await waitDoc(current => current.slides[1].blocks[0].fill === 'accent1', 'fill color again');
  await step('opacity', async () => { await setNumber('Opacity', 0.5); }, current => current.slides[1].blocks[0].opacity === 0.5);
  mark('fill: none, color with tints, gradient, pattern and opacity');

  // --- line
  await field('Line').selectOption('custom');
  await waitDoc(current => current.slides[1].blocks[0].stroke?.width === 1.5, 'a line of your own');
  await step('line color, width and a preset dash', async () => { await setText('Line color', 'dark1'); await setNumber('Line width', 4); await field('Dash').selectOption('dashDot'); }, current => { const s = current.slides[1].blocks[0].stroke; return s.color === 'dark1' && s.width === 4 && s.dash === 'dashDot'; });
  await step('a custom dash', async () => { await field('Dash').selectOption('custom'); await setText('Custom dash', '4, 2'); }, current => JSON.stringify(current.slides[1].blocks[0].stroke.dash) === '[4,2]');
  await step('cap, join, compound, alignment and sketch', async () => {
    await field('Cap').selectOption('round');
    await field('Join').selectOption('bevel');
    await field('Compound').selectOption('double');
    await field('Alignment').selectOption('inside');
    await field('Sketch').selectOption('curved');
  }, current => { const s = current.slides[1].blocks[0].stroke; return s.cap === 'round' && s.join === 'bevel' && s.compound === 'double' && s.align === 'inside' && s.sketch === 'curved'; });
  await step('the miter limit', async () => { await field('Join').selectOption(''); await setNumber('Miter limit', 4); }, current => current.slides[1].blocks[0].stroke.miterLimit === 4 && current.slides[1].blocks[0].stroke.join === undefined);
  await step('start and end arrowheads with their sizes', async () => {
    await field('Start arrowhead').selectOption('oval');
    await field('End arrowhead').selectOption('stealth');
    await field('End arrowhead length').selectOption('large');
  }, current => { const s = current.slides[1].blocks[0].stroke; return s.start?.type === 'oval' && s.end?.type === 'stealth' && s.end.length === 'large'; });
  await step('a gradient line', async () => { await field('Gradient line').check(); }, current => Array.isArray(current.slides[1].blocks[0].stroke.gradient?.stops) && current.slides[1].blocks[0].stroke.color === undefined);
  await shot('line-controls');
  await step('no line', async () => { await field('Line').selectOption('none'); }, current => current.slides[1].blocks[0].stroke === 'none');
  await step('the line follows the style again', async () => { await field('Line').selectOption(''); }, current => current.slides[1].blocks[0].stroke === undefined);
  mark('line: color or gradient, width, dash, cap, join, miter limit, compound, alignment, arrowheads and sketch');

  // --- style, effects, transform, text, accessibility
  await step('the theme style', async () => { await field('Style').selectOption('intense'); }, current => current.slides[1].blocks[0].style === 'intense');
  await open('Effects');
  await step('a shadow preset', async () => { await field('Shadow').selectOption('perspective'); }, current => current.slides[1].blocks[0].shadow === 'perspective');
  await step('a custom shadow', async () => { await field('Shadow').selectOption('custom'); await setNumber('Shadow blur', 12); await setNumber('Shadow angle', 45); await setText('Shadow color', 'dark1'); }, current => { const s = current.slides[1].blocks[0].shadow; return s.blur === 12 && s.angle === 45 && s.color === 'dark1'; });
  await step('inner shadow', async () => { await field('Inner shadow').check(); await setNumber('Inner shadow blur', 6); }, current => current.slides[1].blocks[0].innerShadow?.blur === 6);
  await step('glow', async () => { await field('Glow').check(); await setNumber('Glow radius', 10); await setText('Glow color', 'accent2'); }, current => current.slides[1].blocks[0].glow?.radius === 10 && current.slides[1].blocks[0].glow.color === 'accent2');
  await step('soft edges', async () => { await setNumber('Soft edges', 4); }, current => current.slides[1].blocks[0].softEdge === 4);
  await step('reflection', async () => { await field('Reflection').check(); await setNumber('Reflection size', 0.4); }, current => current.slides[1].blocks[0].reflection?.size === 0.4);
  await step('blur', async () => { await setNumber('Blur', 2); }, current => current.slides[1].blocks[0].blur === 2);
  await step('no shadow', async () => { await field('Shadow').selectOption(''); }, current => current.slides[1].blocks[0].shadow === undefined);
  await shot('effects');
  mark('the six effects, with the shadow presets');
  await open('Rotate and flip');
  await step('rotate and flip', async () => { await setNumber('Rotate', 15); await field('Flip').selectOption('horizontal'); }, current => current.slides[1].blocks[0].rotate === 15 && current.slides[1].blocks[0].flip === 'horizontal');
  // A rotated, mirrored shape's handle is under the preview's own point of the outline.
  await page.locator('[data-shape-handle="0"]').waitFor();
  const mapped = await page.evaluate(() => {
    const svg = document.querySelector('#preview svg');
    const g = globalThis.host.session.composeSlide(1).items.find(item => item.field === 'shape');
    const handle = document.querySelector('[data-shape-handle="0"]').getBoundingClientRect();
    const box = svg.getBoundingClientRect();
    const scale = box.width / svg.viewBox.baseVal.width;
    return { x: (handle.x + handle.width / 2 - box.x) / scale, y: (handle.y + handle.height / 2 - box.y) / scale, frame: g.shape.box, rotate: g.shape.rotate };
  });
  assert.ok(mapped.x > mapped.frame.x - 40 && mapped.x < mapped.frame.x + mapped.frame.width + 40, 'the handle is on the shape');
  await shot('rotated');
  await step('text with its anchor, padding and direction', async () => {
    await setText('Text', 'Build');
    await field('Text anchor').selectOption('top');
    await setText('Padding', '12');
    await field('Text direction').selectOption('stacked');
  }, current => { const b = current.slides[1].blocks[0]; return b.text === 'Build' && b.anchor === 'top' && b.padding === 12 && b.textDirection === 'stacked'; });
  await step('four padding insets', async () => { await setText('Padding', '1 2 3 4'); }, current => JSON.stringify(current.slides[1].blocks[0].padding) === JSON.stringify({ top: 1, right: 2, bottom: 3, left: 4 }));
  await open('Alt text and link');
  await step('alt text, decorative, hidden and a link', async () => {
    await setText('Alt text', 'A chevron');
    await field('Decorative').check();
    await field('Hidden').check();
    await setText('Link', 'https://example.com/plan');
  }, current => { const b = current.slides[1].blocks[0]; return b.alt === 'A chevron' && b.decorative === true && b.hidden === true && b.link === 'https://example.com/plan'; });
  await field('Decorative').uncheck();
  await waitDoc(current => current.slides[1].blocks[0].decorative === undefined, 'decorative off removes the key');
  mark('rotate, flip, text, anchor, padding, direction, alt text, decorative, hidden and link');

  // A refused value is reported and nothing changes.
  const beforeBad = await doc();
  await setText('Link', 'not a url');
  await page.waitForFunction(() => document.querySelector('#selection-controls .opf-dc-error')?.textContent.length > 0);
  assert.deepEqual(await doc(), beforeBad, 'a refused link changes nothing');
  assert.equal(await field('Link').inputValue(), 'https://example.com/plan', 'the field returns to the document');
  mark('a refused value is reported and the field returns to the document');

  assert.deepEqual(errors, [], 'no page errors');
  console.log(`shape editing browser test ok: ${checks.length} checks`);
  for (const name of checks) console.log(`  - ${name}`);
} finally {
  await browser?.close();
  server.close();
}
