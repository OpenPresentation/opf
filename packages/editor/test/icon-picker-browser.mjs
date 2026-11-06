import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

// LH-166 in a real browser, on the built playground (npm run build:playground). A list entry, a metric and a group get an icon from the
// registered sets (search by name and keyword, one set or all), from an SVG pasted into the deck's icons, change it and lose it; each is one
// undoable change that redraws the chip; an SVG that cannot be an icon is refused with the opf/icon-invalid finding's message; the controls
// are named and work from the keyboard. OPF_ICON_SHOTS=<dir> also writes screenshots of the picker.
const shots = process.env.OPF_ICON_SHOTS;
if (shots) await mkdir(shots, { recursive: true });
const root = fileURLToPath(new URL('../artifacts/playground/', import.meta.url));
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.ttf': 'font/ttf' };
const requests = [];
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

const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M4 12l5 5L20 6" fill="none" stroke="currentColor" stroke-width="2"/></svg>';
const BAD = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><script>alert(1)</script><path d="M4 12l5 5L20 6"/></svg>';
const source = {
  name: 'Icons',
  design: { theme: 'classic', fontScheme: 'roboto' },
  slides: [
    { id: 'cover', title: 'Why customers choose us' },
    { id: 'list', title: 'What you get', blocks: [{ items: ['Fast delivery', 'Safe payments', 'Friendly support'] }] },
    { id: 'metric', title: 'Growth', blocks: [{ metric: { value: 42, unit: '%', label: 'Retention' } }] },
    { id: 'group', title: 'Pillars', blocks: [{ text: 'Speed: ships in a day' }, { text: 'Trust: audited every year' }] },
  ],
};

let browser;
const checks = [];
try {
  browser = await chromium.launch({ channel: process.platform === 'win32' && !process.env.CI ? 'msedge' : undefined });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  const errors = [];
  page.on("request", request => { if (!request.url().startsWith("http://127.0.0.1") && !request.url().startsWith("data:") && !request.url().startsWith("blob:")) requests.push(request.url()); });
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
      if (Date.now() - started > 8000) assert.fail(`${message}: ${JSON.stringify(current).slice(0, 400)}`);
      await page.waitForTimeout(40);
    }
  };
  const mark = name => checks.push(name);
  const slide = async index => { await page.locator('#slide-list button').nth(index).click(); await page.waitForFunction(i => document.querySelector('#slide-list').children[i].getAttribute('aria-current') === 'true', index); await settle(); };
  const shot = async name => { if (!shots) return; await picker().evaluate(node => node.scrollIntoView({ block: 'center' })); await page.screenshot({ path: path.join(shots, `${name}.png`) }); };
  const picker = () => selection.locator('.opf-icon-picker');
  const chips = () => page.locator('#preview svg [data-opf-icon], #preview svg [data-opf-icons], #preview svg g[data-opf-role="icon"]').count();
  const previewHasIcon = () => page.locator('#preview svg').first().evaluate(node => /data-opf-icon/.test(node.outerHTML));
  // One step in, one step out: act, check the document, Undo restores it exactly and Redo returns it.
  async function step(name, action, predicate) {
    const before = await doc();
    await action();
    const after = await waitDoc(predicate, name);
    await button('Undo').click();
    await waitDoc(current => JSON.stringify(current) === JSON.stringify(before), `${name}: undo`);
    await button('Redo').click();
    await waitDoc(current => JSON.stringify(current) === JSON.stringify(after), `${name}: redo`);
    mark(name);
    return after;
  }

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

  // --- a list entry
  await slide(1);
  await page.locator('#preview [data-canvas-target][data-opf-path="slides.1.blocks.0.items.0"]').click();
  await page.keyboard.press('Escape');
  const choose = selection.getByRole('button', { name: 'Choose icon…', exact: true });
  await choose.waitFor();
  assert.equal(await selection.locator('[data-role="icon-label"]').textContent(), 'List entry icon');
  assert.equal(await selection.locator('[data-role="icon-value"]').textContent(), 'None');
  assert.equal(await selection.getByRole('button', { name: 'Remove', exact: true }).isDisabled(), true, 'nothing to remove yet');
  assert.equal(await choose.getAttribute('aria-expanded'), 'false');
  mark('the picker shows for a selected list entry, named for what it marks');

  await choose.click();
  assert.equal(await choose.getAttribute('aria-expanded'), 'true');
  const search = selection.getByLabel('Search icons', { exact: true });
  await search.waitFor();
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('data-role')), 'icon-search', 'the search takes focus');
  await selection.locator('.opf-ip-tile').first().waitFor();
  const first = await selection.locator('[data-role="icon-count"]').textContent();
  assert.match(first, /^60 of \d{4,5} icons$/, 'an empty search browses every registered set');
  assert.deepEqual(await selection.getByLabel('Icon set', { exact: true }).locator('option').allTextContents(), ['All sets', 'Lucide (ISC)', 'Tabler outline (MIT)'].map(text => text), 'the host registered Lucide and Tabler');
  mark('Choose icon opens a search over the registered sets');

  await search.fill('truck');
  await page.waitForFunction(() => /icons?$/.test(document.querySelector('[data-role="icon-count"]').textContent) && document.querySelector('.opf-ip-tile')?.getAttribute('data-icon') === 'lucide:truck');
  assert.match(await selection.locator('[data-role="icon-count"]').textContent(), /^\d+ of \d+ icons?$/);
  assert.match(await selection.locator('.opf-ip-tile').first().getAttribute('aria-label'), /^truck [(]lucide[)]/, 'a tile is named by the icon and its set');
  await search.fill('shipping');
  await page.waitForFunction(() => document.querySelector('.opf-ip-tile') && [...document.querySelectorAll('.opf-ip-tile')].some(tile => tile.dataset.icon === 'lucide:truck'));
  mark('search matches names and keywords');
  await selection.getByLabel('Icon set', { exact: true }).selectOption('tabler');
  await page.waitForFunction(() => [...document.querySelectorAll('.opf-ip-tile')].every(tile => tile.dataset.icon.startsWith('tabler:')) && document.querySelector('.opf-ip-tile'));
  await selection.getByLabel('Icon set', { exact: true }).selectOption('');
  await search.fill('truck');
  await page.waitForFunction(() => document.querySelector('.opf-ip-tile')?.dataset.icon === 'lucide:truck');
  mark('the search can be limited to one set');
  await shot('picker-open');

  const set = await step('a list entry gets an icon from a set', () => selection.locator('.opf-ip-tile[data-icon="lucide:truck"]').click(), current => JSON.stringify(current.slides[1].blocks[0].items[0]) === '{"text":"Fast delivery","icon":"lucide:truck"}');
  assert.deepEqual(set.slides[1].blocks[0].items.slice(1), ['Safe payments', 'Friendly support'], 'the other entries stay as they were');
  await page.waitForFunction(() => /lucide:truck/.test(document.querySelector('[data-role="icon-value"]').textContent));
  assert.equal(await selection.locator('.opf-ip-tile[data-icon="lucide:truck"]').getAttribute('aria-pressed'), 'true', 'the chosen icon is marked');
  await settle();
  await page.waitForFunction(() => /data-opf-icon/.test(document.querySelector('#preview svg')?.outerHTML ?? ''), undefined, { timeout: 20000 });
  mark('the preview draws the chip');
  await shot('icon-set');
  await step('an icon is changed', () => selection.locator('.opf-ip-tile[data-icon="lucide:truck"]').first().evaluate(() => {}).then(async () => { await search.fill('rocket'); await page.waitForFunction(() => document.querySelector('.opf-ip-tile')?.dataset.icon === 'lucide:rocket'); await selection.locator('.opf-ip-tile[data-icon="lucide:rocket"]').click(); }), current => current.slides[1].blocks[0].items[0].icon === 'lucide:rocket');
  await step('an icon is removed', () => selection.getByRole('button', { name: 'Remove', exact: true }).click(), current => JSON.stringify(current.slides[1].blocks[0].items[0]) === '{"text":"Fast delivery"}');
  await shot('icon-removed');

  // --- from the keyboard: Enter in the search takes the first match
  await search.fill('shield');
  await page.waitForFunction(() => document.querySelector('.opf-ip-tile')?.dataset.icon === 'lucide:shield');
  await step('Enter in the search sets the first match', async () => { await search.focus(); await page.keyboard.press('Enter'); }, current => current.slides[1].blocks[0].items[0].icon === 'lucide:shield');
  await search.focus();
  await page.keyboard.press('Escape');
  assert.equal(await choose.getAttribute('aria-expanded'), 'false', 'Escape closes the panel');
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('data-role')), 'icon-choose', 'and returns to the button');
  await button('Undo').click();
  mark('the picker works from the keyboard');

  // --- a pasted SVG goes into the deck's icons under a name
  await choose.click();
  await selection.locator('[data-role="icon-paste"] summary').click();
  const svgBox = selection.getByLabel('SVG source', { exact: true });
  await svgBox.fill(BAD);
  await selection.getByLabel('Name in this deck', { exact: true }).fill('bad-one');
  const before = await doc();
  await button('Use this SVG').click();
  await page.waitForFunction(() => document.querySelector('[data-role="icon-svg-error"]').textContent !== '');
  const refusal = await selection.locator('[data-role="icon-svg-error"]').textContent();
  assert.match(refusal, /script/i);
  assert.equal(await selection.locator('[data-role="icon-svg-error"]').getAttribute('role'), 'alert');
  assert.deepEqual(await doc(), before, 'a refused SVG changes nothing');
  assert.match(await page.locator('.opf-dc-error').evaluateAll(nodes => nodes.map(node => node.textContent).join(' ')), /script/i, 'the panel reports the same message');
  mark('an SVG that cannot be an icon is refused with the finding message');
  await shot('svg-refused');
  await svgBox.fill(SVG);
  await selection.getByLabel('Name in this deck', { exact: true }).fill('Check Mark');
  await step('a pasted SVG is stored in the deck icons and referenced by name', () => button('Use this SVG').click(), current => current.icons?.['check-mark'] === SVG && JSON.stringify(current.slides[1].blocks[0].items[0]) === '{"text":"Fast delivery","icon":"check-mark"}');
  assert.equal(await selection.locator('[data-role="icon-svg-error"]').textContent(), '', 'the error clears');
  assert.equal(await svgBox.inputValue(), '', 'the box is emptied');
  await selection.locator('.opf-ip-deck .opf-ip-tile[data-icon="check-mark"]').waitFor();
  await button('Remove').click();
  await waitDoc(current => !('icons' in current), 'removing the last use removes the icon from the deck');
  mark('removing the last use of a pasted icon also removes it from the deck');

  // --- a metric
  await slide(2);
  await page.locator('#preview [data-canvas-target][data-opf-path="slides.2.blocks.0.metric.value"]').click();
  await page.keyboard.press('Escape');
  await choose.waitFor();
  assert.equal(await selection.locator('[data-role="icon-label"]').textContent(), 'Metric icon');
  await choose.click();
  await search.fill('users');
  await page.waitForFunction(() => document.querySelector('.opf-ip-tile')?.dataset.icon === 'lucide:users');
  await step('a metric gets an icon', () => selection.locator('.opf-ip-tile[data-icon="lucide:users"]').click(), current => current.slides[2].blocks[0].metric.icon === 'lucide:users' && current.slides[2].blocks[0].metric.value === 42);
  await page.waitForFunction(() => /data-opf-icon/.test(document.querySelector('#preview svg')?.outerHTML ?? ''), undefined, { timeout: 20000 });
  await shot('metric-icon');
  await step('a metric loses its icon', () => selection.getByRole('button', { name: 'Remove', exact: true }).click(), current => !('icon' in current.slides[2].blocks[0].metric));

  // --- a group
  await slide(3);
  // A group is selected the way a person makes one: group two blocks, and the new group is the selection.
  await page.locator('#preview [data-canvas-target][data-opf-path="slides.3.blocks.0.text"]').click();
  await page.keyboard.press('Escape');
  await selection.getByRole('button', { name: 'Group with the next block', exact: true }).click();
  await waitDoc(current => Array.isArray(current.slides[3].blocks[0].blocks), 'the blocks are grouped');
  await choose.waitFor();
  assert.equal(await selection.locator('[data-role="icon-label"]').textContent(), 'Group icon');
  await choose.click();
  await search.fill('zap');
  await page.waitForFunction(() => document.querySelector('.opf-ip-tile')?.dataset.icon === 'lucide:zap');
  await step('a group gets an icon', () => selection.locator('.opf-ip-tile[data-icon="lucide:zap"]').click(), current => current.slides[3].blocks[0].icon === 'lucide:zap');
  await page.waitForFunction(() => /data-opf-icon/.test(document.querySelector('#preview svg')?.outerHTML ?? ''), undefined, { timeout: 20000 });
  await shot('group-icon');
  await step('a group loses its icon', () => selection.getByRole('button', { name: 'Remove', exact: true }).click(), current => !('icon' in current.slides[3].blocks[0]));

  // --- no icon where there is none to give
  await slide(0);
  await page.locator('#preview [data-canvas-target][data-opf-path="slides.0.title"]').first().click();
  await page.keyboard.press('Escape');
  assert.equal(await picker().isHidden(), true, 'a title has no icon');
  mark('the picker is hidden for a selection with no icon of its own');

  // --- the icon sets are the host's own and nothing left the machine
  assert.deepEqual(requests, []);
  assert.deepEqual(errors, []);
  console.log(`Icon picker (browser): ${checks.length} checks. ${checks.join('; ')}.`);
} finally {
  await browser?.close();
  server.close();
}
