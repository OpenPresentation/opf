// RR-28: a real browser drives <opf-deck> and the slideshow player, offline. A local server hands the page the bundled
// element, the deck and a self-hosted font root filled by copyPreviewFonts; every request is recorded. Checks:
//   - the slide the element draws is the slide toSvg draws (same markup, and the same pixels),
//   - face-level lazy fonts, and no request beyond the deck and those font files,
//   - navigation (buttons, keyboard, swipe, thumbnails, the `slide` attribute), `slidechange` events, hidden slides skipped,
//   - accessibility: axe, the accessible name and text of every slide, focus management, reduced motion,
//   - the player (keys, number then Enter, black and white screens, Escape, focus back) and the speaker view in a second
//     window (current and next slide, plain-text notes, timer, clock, hidden slides skipped) with both windows in step over
//     BroadcastChannel, also from a second tab,
//   - the static server markup upgrading in place, and errors.
import assert from 'node:assert/strict';
import http from 'node:http';
import {mkdir, readFile, rm, writeFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {chromium} from 'playwright';
import sharp from 'sharp';
import {copyPreviewFonts} from '../dist/preview-fonts-node.js';
import {toHtml} from '../dist/element.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDirectory = path.resolve(root, process.argv[2] ?? 'artifacts/player');
await rm(outputDirectory, {recursive: true, force: true});
await mkdir(outputDirectory, {recursive: true});
const fontRoot = path.join(outputDirectory, 'opf-fonts');
const copied = copyPreviewFonts({outDir: fontRoot, scripts: ['Arab']});
assert.equal(copied.missing.length, 0);

const deckText = await readFile(path.join(root, 'test/fixtures/player-deck.opf.json'), 'utf8');
const deck = JSON.parse(deckText);
const xssDeck = {name: 'Notes are text', slides: [{id: 'a', title: 'First', notes: '<img src=x onerror="window.__pwned=1"> <b>not bold</b>', section: '<i>S</i>'}, {id: 'b', title: 'Second'}]};
const hiddenFirst = {name: 'Hidden first', slides: [{id: 'h', title: 'Hidden', hidden: true}, {id: 'v1', title: 'Visible one'}, {id: 'v2', title: 'Visible two'}]};
const arabicDeck = {name: 'عرض تجريبي', language: 'ar', slides: [{id: 'one', title: 'مرحبا بالعالم', text: 'هذا اختبار للعرض'}, {id: 'two', title: 'الشريحة الثانية', items: ['الأول', 'الثاني']}]};

// --- the bundle: the element (registered), the player, and the renderer, as a page would import them ---------------
const entry = "import '../dist/element-define.js'; import {present} from '../dist/player.js'; import {toSvg} from '../dist/svg.js'; import {loadPreviewFonts} from '../dist/preview-fonts.js'; import {prepareSlideSvg} from '../dist/deck-runtime.js'; import {defineOpfDeck} from '../dist/element.js'; window.opf = {present, toSvg, loadPreviewFonts, prepareSlideSvg, defineOpfDeck};";
const bundle = await build({stdin: {contents: entry, resolveDir: path.join(root, 'test'), sourcefile: 'page-entry.js', loader: 'js'}, bundle: true, platform: 'browser', format: 'iife', write: false, minify: true, metafile: true});
const script = bundle.outputFiles[0].text;
assert.ok(!Object.keys(bundle.metafile.inputs).some(input => /sharp|resvg|raster|fonts-node|preview-fonts-node/.test(input)), 'the browser bundle must not pull in native raster or Node modules');
// Tree shaking: the element alone does not carry the player (it loads on demand), and a page that imports the server markup only
// does not carry the element or the player.
const split = await build({stdin: {contents: "import '../dist/element-define.js';", resolveDir: path.join(root, 'test'), loader: 'js'}, bundle: true, platform: 'browser', format: 'esm', splitting: true, outdir: path.join(outputDirectory, 'split'), write: false, minify: true, metafile: true});
const chunks = split.outputFiles.map(file => ({name: path.basename(file.path), text: file.text}));
assert.ok(chunks.length >= 2, `the player is a separate chunk loaded on demand (got ${chunks.map(chunk => chunk.name)})`);
const mainChunk = chunks.find(chunk => /opf-deck/.test(chunk.text) && /attachShadow/.test(chunk.text));
assert.ok(mainChunk && !/PlayerSession|Speaker view/.test(mainChunk.text), 'the element chunk carries no slideshow code');
assert.ok(chunks.some(chunk => /Speaker view/.test(chunk.text)), 'the player chunk exists');
const serverOnly = await build({stdin: {contents: "import {toHtml} from '../dist/element.js'; console.log(toHtml);", resolveDir: path.join(root, 'test'), loader: 'js'}, bundle: true, platform: 'node', format: 'esm', write: false, minify: true});
assert.ok(!/attachShadow|PlayerSession/.test(serverOnly.outputFiles[0].text), 'server-side markup does not pull in the element class or the player (tree shaking)');

const axeSource = await readFile(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');

// --- the server -------------------------------------------------------------------------------------------------
const pageStyle = '<style>body{margin:16px;font-family:sans-serif} opf-deck{max-width:960px} opf-deck.exact{position:absolute;left:16px;top:120px;width:960px} opf-deck.exact::part(viewport){border:0;border-radius:0}</style>';
const shell = (body, extra = '') => `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Deck test</title>${pageStyle}</head><body><main><h1>Embedded deck</h1><button id="before" type="button">Before</button>${body}<button id="after" type="button">After</button></main>${extra}<script src="/bundle.js"></script></body></html>`;
const pages = {
  '/basic.html': shell('<opf-deck id="d" class="exact" src="/deck.opf.json" fonts="/opf-fonts/" thumbnails present></opf-deck>'),
  '/plain.html': shell('<opf-deck id="d" src="/deck.opf.json"></opf-deck>'),
  '/hidden.html': shell('<opf-deck id="d" src="/deck.opf.json" fonts="/opf-fonts/" include-hidden></opf-deck>'),
  '/slide3.html': shell('<opf-deck id="d" src="/deck.opf.json" fonts="/opf-fonts/" slide="3"></opf-deck>'),
  '/missing.html': shell('<opf-deck id="d" src="/missing.json" fonts="/opf-fonts/"></opf-deck>'),
  '/broken.html': shell('<opf-deck id="d" src="/broken.json"></opf-deck>'),
  '/fallback.html': shell('<opf-deck id="d" src="/fallback.json"></opf-deck>'),
  '/wrongmime.html': shell('<opf-deck id="d" src="/wrongmime.json"></opf-deck>'),
  '/nofonts.html': shell('<opf-deck id="d" src="/deck.opf.json" fonts="/no-such-fonts/"></opf-deck>'),
  '/empty.html': shell('<div id="host"></div>'),
  '/arabic.html': shell('<opf-deck id="d" src="/arabic.opf.json" fonts="/opf-fonts/"></opf-deck>'),
  '/ssr.html': shell(toHtml(deck, '1-', {embed: true, fonts: '/opf-fonts/', attributes: {id: 'd'}}).replace('<opf-deck', '<opf-deck').replace(/^/, '')).replace('<script src="/bundle.js"></script>', ''),
};
const requests = [];
const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, 'http://x');
  requests.push(url.pathname);
  const send = (status, type, body) => { response.writeHead(status, {'content-type': type}); response.end(body); };
  if (pages[url.pathname]) return send(200, 'text/html', pages[url.pathname]);
  if (url.pathname === '/bundle.js') return send(200, 'text/javascript', script);
  if (url.pathname === '/axe.js') return send(200, 'text/javascript', axeSource);
  if (url.pathname === '/deck.opf.json') return send(200, 'application/json', deckText);
  if (url.pathname === '/arabic.opf.json') return send(200, 'application/json', JSON.stringify(arabicDeck));
  if (url.pathname === '/slow.json') { await new Promise(resolve => setTimeout(resolve, 400)); return send(200, 'application/json', deckText); }
  if (url.pathname === '/broken.json') return send(200, 'application/json', '{"slides": 5');
  if (url.pathname === '/fallback.json') return send(200, 'text/html', '<!doctype html><html><body>SPA fallback</body></html>');
  if (url.pathname === '/wrongmime.json') return send(200, 'text/html', deckText);
  if (url.pathname === '/favicon.ico') return send(204, 'image/x-icon', '');
  if (url.pathname.startsWith('/opf-fonts/')) {
    const file = path.join(outputDirectory, url.pathname);
    if (file.startsWith(fontRoot) && existsSync(file)) return send(200, 'font/ttf', await readFile(file));
  }
  send(404, 'text/plain', 'not found');
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch({channel: process.platform === 'win32' && !process.env.CI ? 'msedge' : undefined});
const problems = [];
const context = await browser.newContext({viewport: {width: 1100, height: 900}, locale: 'en-US', timezoneId: 'UTC', hasTouch: true});
const watch = (page, label) => {
  page.on('pageerror', error => problems.push(`${label}: ${error.message}`));
  page.on('console', message => { if (message.type() === 'error' && !/Failed to load resource/.test(message.text())) problems.push(`${label}: ${message.text()}`); });
  return page;
};
const open = async (route, {wait = true} = {}) => {
  const page = watch(await context.newPage(), route);
  await page.goto(origin + route);
  if (wait) await page.evaluate(() => document.getElementById('d').ready);
  return page;
};
const deckEl = page => page.locator('opf-deck#d');
const counter = page => deckEl(page).locator('.counter [aria-hidden]');
const viewport = page => deckEl(page).locator('.viewport');
const slideText = page => deckEl(page).locator('.slide svg text').allTextContents();
const titleOf = async page => (await slideText(page))[0];
const shown = async page => page.evaluate(() => { const element = document.getElementById('d'); return {slide: element.slide, total: element.total, title: element.currentSlide?.title}; });
const events = page => page.evaluate(() => window.__events.splice(0));
const record = page => page.evaluate(() => { window.__events = []; const element = document.getElementById('d'); if (window.__listener) element.removeEventListener('slidechange', window.__listener); window.__listener = event => window.__events.push({...event.detail}); element.addEventListener('slidechange', window.__listener); });

try {
  // ------------------------------------------------------------------------------------------------------------------
  // The element: the slide is the renderer's slide, drawn with face-level lazy fonts and nothing else requested.
  const page = await open('/basic.html');
  await record(page);
  assert.deepEqual(await shown(page), {slide: 1, total: 5, title: 'Quarterly review'}, 'five slides play, the hidden one is not counted');
  assert.equal(await counter(page).innerText(), '1 / 5');
  assert.equal(await page.evaluate(() => document.getElementById('d').shadowRoot.querySelectorAll('.thumbs li').length), 5, 'a thumbnail per slide that plays');

  const fontRequests = requests.filter(pathname => pathname.startsWith('/opf-fonts/'));
  assert.deepEqual(fontRequests.sort(), ['/opf-fonts/base/roboto/400Regular/Roboto_400Regular.ttf', '/opf-fonts/lazy/fonts/intos/Intos-Regular.ttf', '/opf-fonts/lazy/fonts/intos/IntosDisplay-Bold.ttf'], 'Roboto Regular starts the registry, then only the two Intos faces the deck draws: face level, from the self-hosted root');
  for (const pathname of requests) assert.ok(['/basic.html', '/bundle.js', '/deck.opf.json', '/favicon.ico'].includes(pathname) || pathname.startsWith('/opf-fonts/'), `unexpected request ${pathname}`);

  // The same markup and the same pixels as toSvg.
  const exact = await page.evaluate(async () => {
    const registry = await window.opf.loadPreviewFonts('/opf-fonts/');
    const element = document.getElementById('d');
    const deck = element.document;
    const out = [];
    for (let slide = 1; slide <= element.total; slide++) {
      element.goto(slide);
      const index = element.currentSlide.index;
      const reference = window.opf.toSvg(deck, index + 1, {fonts: {textMeasurement: registry.textMeasurement}, date: new Date().toISOString().slice(0, 10)});
      const prepared = window.opf.prepareSlideSvg(reference);
      const shownSvg = element.shadowRoot.querySelector('.slide svg');
      const template = document.createElement('template'); template.innerHTML = prepared;
      out.push({index, same: shownSvg.outerHTML === template.content.firstElementChild.outerHTML, reference});
    }
    element.goto(1);
    return out;
  });
  assert.equal(exact.length, 5);
  for (const item of exact) assert.ok(item.same, `slide ${item.index}: the element's markup is toSvg's markup (root size and role aside)`);
  const compare = async (slide) => {
    await page.evaluate(slide => { document.getElementById('d').goto(slide); }, slide);
    const element = await page.screenshot({clip: {x: 16, y: 120, width: 960, height: 540}});
    await page.evaluate(({svg}) => {
      const host = document.createElement('div'); host.id = 'ref'; host.style.cssText = 'position:fixed;left:16px;top:120px;width:960px;height:540px;z-index:9;background:#fff';
      host.innerHTML = svg.replace(/^<svg\b[^>]*>/, tag => tag.replace(/ width="\d+"/, ' width="960"').replace(/ height="\d+"/, ' height="540"')); document.body.append(host);
    }, {svg: exact[slide - 1].reference});
    const reference = await page.screenshot({clip: {x: 16, y: 120, width: 960, height: 540}});
    await page.evaluate(() => document.getElementById('ref').remove());
    if (process.env.PLAYER_DUMP) { await writeFile(path.join(outputDirectory, `slide-${slide}-element.png`), element); await writeFile(path.join(outputDirectory, `slide-${slide}-reference.png`), reference); }
    const [a, b] = await Promise.all([sharp(element).raw().toBuffer({resolveWithObject: true}), sharp(reference).raw().toBuffer({resolveWithObject: true})]);
    assert.deepEqual([a.info.width, a.info.height], [b.info.width, b.info.height], `slide ${slide} screenshots are the same size`);
    let differing = 0;
    for (let i = 0; i < a.data.length; i += a.info.channels) if (Math.abs(a.data[i] - b.data[i]) + Math.abs(a.data[i + 1] - b.data[i + 1]) + Math.abs(a.data[i + 2] - b.data[i + 2]) > 6) differing++;
    return differing / (a.info.width * a.info.height);
  };
  for (let slide = 1; slide <= 5; slide++) { const fraction = await compare(slide); assert.ok(fraction < 0.0005, `slide ${slide}: the element's pixels are toSvg's pixels (${(fraction * 100).toFixed(4)}% differ)`); }
  await page.evaluate(() => document.getElementById('d').goto(1));
  await events(page);

  // Navigation: buttons, keyboard, thumbnails, the slide attribute and property, events.
  await deckEl(page).locator('button.next').click();
  assert.equal(await titleOf(page), 'Agenda');
  assert.deepEqual(await events(page), [{slide: 2, total: 5, index: 1, id: 'agenda', title: 'Agenda', notes: 'Keep this under one minute.', section: 'Opening'}], 'slidechange carries the slide, the document index and the plain-text notes');
  await deckEl(page).locator('button.next').click();
  assert.equal(await titleOf(page), 'Revenue grew 18 percent', 'the hidden slide between Agenda and Revenue is skipped');
  assert.equal((await events(page))[0].index, 3);
  await deckEl(page).locator('button.previous').click();
  assert.equal(await titleOf(page), 'Agenda');
  await events(page);
  await viewport(page).focus();
  await page.keyboard.press('End');
  assert.equal(await counter(page).innerText(), '5 / 5');
  assert.equal(await deckEl(page).locator('button.next').getAttribute('aria-disabled'), 'true', 'next is disabled on the last slide');
  await page.keyboard.press('ArrowRight');
  assert.equal(await counter(page).innerText(), '5 / 5', 'no wrap past the end');
  await page.keyboard.press('Home');
  assert.equal(await counter(page).innerText(), '1 / 5');
  await page.keyboard.press('PageDown'); await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowLeft'); await page.keyboard.press('PageUp');
  assert.equal(await counter(page).innerText(), '1 / 5');
  assert.equal((await events(page)).length, 6, 'one slidechange per move and none for a move that did not happen');
  // Keys the page needs are left alone.
  const keyEvent = await page.evaluate(() => { const target = document.getElementById('d').shadowRoot.querySelector('.viewport'); const event = new KeyboardEvent('keydown', {key: 'ArrowDown', bubbles: true, composed: true, cancelable: true}); target.dispatchEvent(event); return event.defaultPrevented; });
  assert.equal(keyEvent, false, 'ArrowDown still scrolls the page');
  // Thumbnails.
  await deckEl(page).locator('.thumbs li').nth(3).locator('button').click();
  assert.equal(await counter(page).innerText(), '4 / 5');
  assert.equal(await deckEl(page).locator('.thumbs button[aria-current="true"]').getAttribute('aria-label'), 'Go to Slide 4 of 5: What customers say');
  assert.deepEqual(await page.evaluate(() => [...document.getElementById('d').shadowRoot.querySelectorAll('.thumbs button')].map(button => button.tabIndex)), [-1, -1, -1, 0, -1], 'roving tabindex: one tab stop for the strip');
  await deckEl(page).locator('.thumbs button[aria-current="true"]').focus();
  await page.keyboard.press('ArrowLeft');
  assert.equal(await page.evaluate(() => document.getElementById('d').shadowRoot.activeElement.getAttribute('aria-label')), 'Go to Slide 3 of 5: Revenue grew 18 percent', 'arrow keys move between thumbnails');
  await page.keyboard.press('Enter');
  assert.equal(await counter(page).innerText(), '3 / 5');
  // In a narrow column the strip scrolls and the current thumbnail is centred in it, wherever the page puts the element
  // (a host that is not positioned is the case that breaks offset arithmetic).
  await page.emulateMedia({reducedMotion: 'reduce'});
  await page.evaluate(() => { const element = document.getElementById('d'); element.style.position = 'static'; element.style.width = '320px'; element.style.marginTop = '700px'; element.style.marginLeft = '300px'; element.goto(3); });
  await page.waitForFunction(() => {
    const root = document.getElementById('d').shadowRoot;
    const strip = root.querySelector('.thumbs').getBoundingClientRect(), current = root.querySelector('.thumbs [aria-current="true"]').getBoundingClientRect();
    return Math.abs((current.left + current.right) / 2 - (strip.left + strip.right) / 2) < 3;
  }, null, {timeout: 3000});
  assert.equal(await page.evaluate(() => { const strip = document.getElementById('d').shadowRoot.querySelector('.thumbs'); return strip.scrollWidth > strip.clientWidth; }), true, 'the strip scrolls');
  await page.evaluate(() => { const element = document.getElementById('d'); element.style.position = ''; element.style.width = ''; element.style.marginTop = ''; element.style.marginLeft = ''; element.goto(3); });
  await page.emulateMedia({reducedMotion: 'no-preference'});
  const thumbIds = await page.evaluate(() => [...document.getElementById('d').shadowRoot.querySelectorAll('.thumbs [id], .slide [id]')].map(node => node.id));
  assert.equal(new Set(thumbIds).size, thumbIds.length, 'a thumbnail and its slide never share an id');
  // The attribute and the property.
  await events(page);
  await page.evaluate(() => document.getElementById('d').setAttribute('slide', '2'));
  assert.equal(await counter(page).innerText(), '2 / 5');
  assert.equal((await events(page)).length, 1);
  await page.evaluate(() => { document.getElementById('d').slide = 99; });
  assert.equal(await counter(page).innerText(), '5 / 5', 'a number past the end clamps');
  await page.evaluate(() => document.getElementById('d').setAttribute('slide', '1'));
  // Swipe on a touch surface.
  const swipe = (dx) => page.evaluate((dx) => {
    const target = document.getElementById('d').shadowRoot.querySelector('.viewport');
    const make = (type, x) => new PointerEvent(type, {pointerType: 'touch', pointerId: 7, clientX: x, clientY: 100, bubbles: true, composed: true});
    target.dispatchEvent(make('pointerdown', 300)); target.dispatchEvent(make('pointerup', 300 + dx));
  }, dx);
  await swipe(-120);
  assert.equal(await counter(page).innerText(), '2 / 5', 'swipe left is next');
  await swipe(120);
  assert.equal(await counter(page).innerText(), '1 / 5', 'swipe right is previous');
  await swipe(20);
  assert.equal(await counter(page).innerText(), '1 / 5', 'a short drag is not a swipe');
  assert.equal((await context.pages()).length, 1);

  // Hidden slides and the include-hidden attribute.
  const withHidden = await open('/hidden.html');
  assert.equal(await withHidden.evaluate(() => document.getElementById('d').total), 6, 'include-hidden plays every slide');
  await withHidden.evaluate(() => document.getElementById('d').goto(3));
  assert.equal(await titleOf(withHidden), 'Internal numbers');
  await withHidden.close();
  const later = await open('/slide3.html');
  assert.deepEqual(await shown(later), {slide: 3, total: 5, title: 'Revenue grew 18 percent'}, 'the slide attribute counts the sequence that plays');
  await later.close();

  // ------------------------------------------------------------------------------------------------------------------
  // Accessibility.
  const label = await viewport(page).getAttribute('aria-label');
  assert.equal(label, 'Slide 1 of 5: Quarterly review', 'the slide is named by its position and title');
  assert.equal(await viewport(page).getAttribute('aria-roledescription'), 'slide');
  const regionName = await page.evaluate(() => document.getElementById('d').shadowRoot.querySelector('.deck').getAttribute('aria-label'));
  assert.equal(regionName, 'Quarterly review', 'the deck is a region named after the deck');
  assert.deepEqual(await slideText(page), ['Quarterly review', 'Q3 operating results'], 'the slide text is live text in reading order, not an image');
  assert.equal(await page.evaluate(() => document.getElementById('d').shadowRoot.querySelector('.slide svg').getAttribute('role')), null, 'the svg is not an opaque image');
  assert.equal(await page.evaluate(() => { const slide = document.getElementById('d').shadowRoot.querySelector('.slide'); return [slide.querySelector('svg').getAttribute('aria-roledescription'), slide.querySelector('svg').getAttribute('aria-label'), slide.querySelectorAll('[aria-roledescription="slide"]').length + document.getElementById('d').shadowRoot.querySelectorAll('[role=group][aria-roledescription="slide"]').length].join('|'); }), '||1', 'FA-30: the drawing is not a second slide container; the viewport is the one (announced once)');
  const snapshot = await deckEl(page).ariaSnapshot();
  assert.match(snapshot, /Quarterly review/);
  assert.ok(snapshot.indexOf('Quarterly review') < snapshot.indexOf('Q3 operating results'), 'screen readers meet the title before the subtitle');
  assert.equal(await deckEl(page).locator('.thumbs').getAttribute('role'), 'list');
  assert.equal(await page.evaluate(() => document.getElementById('d').shadowRoot.querySelector('.thumbs svg').getAttribute('aria-hidden') ?? document.getElementById('d').shadowRoot.querySelector('.thumbs .frame').getAttribute('aria-hidden')), 'true', 'thumbnail drawings are hidden from screen readers; their buttons carry the names');
  assert.equal(await page.evaluate(() => document.getElementById('d').shadowRoot.querySelector('[role=status][aria-live=polite]') !== null), true, 'slide changes are announced through a live region');
  await deckEl(page).locator('button.next').click();
  await viewport(page).focus();
  await page.keyboard.press('ArrowRight');
  assert.equal(await deckEl(page).locator('[aria-live=polite]').innerText(), 'Slide 3 of 5: Revenue grew 18 percent', 'a keyboard move is announced');
  await page.evaluate(() => document.getElementById('d').goto(1));
  // Tab order: the deck is a short run of stops, then the page continues.
  await page.locator('#before').focus();
  const stops = [];
  for (let step = 0; step < 6; step++) { await page.keyboard.press('Tab'); stops.push(await page.evaluate(() => { const active = document.activeElement; const inner = active.shadowRoot?.activeElement; return inner ? `${active.localName}>${inner.className || inner.localName}` : active.id || active.localName; })); }
  assert.deepEqual(stops, ['opf-deck>viewport', 'opf-deck>previous', 'opf-deck>next', 'opf-deck>present', 'opf-deck>thumb', 'after'], `tab order: ${stops}`);
  // axe over the page with the deck, thumbnails and Present button (open shadow DOM is walked).
  await page.addScriptTag({url: '/axe.js'});
  const axeRun = () => page.evaluate(async () => (await window.axe.run(document, {runOnly: {type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']}})).violations.map(violation => ({id: violation.id, nodes: violation.nodes.map(node => node.target.join(' ')).slice(0, 3)})));
  assert.deepEqual(await axeRun(), [], 'axe finds no violations in the element');

  // Reduced motion: the controls do not animate.
  const transition = () => page.evaluate(() => getComputedStyle(document.getElementById('d').shadowRoot.querySelector('button.next')).transitionDuration);
  assert.notEqual(await transition(), '0s', 'buttons ease their background when motion is welcome');
  await page.emulateMedia({reducedMotion: 'reduce'});
  assert.equal(await transition(), '0s', 'and not when the visitor asked for reduced motion');
  await page.emulateMedia({reducedMotion: 'no-preference'});

  // ------------------------------------------------------------------------------------------------------------------
  // The player: keys, blank screens, number then Enter, focus.
  await record(page);
  await deckEl(page).locator('button.present').focus();
  await page.keyboard.press('Enter');
  const player = page.locator('[data-opf-player]');
  await player.locator('.player').waitFor();
  await page.waitForFunction(() => document.querySelector('[data-opf-player]')?.shadowRoot?.querySelector('.frame svg'));
  const overlay = (selector) => player.locator(selector);
  const playerCounter = () => overlay('.counter').innerText();
  const playerTitle = async () => (await overlay('.frame svg text').first().textContent());
  assert.equal(await playerCounter(), '1 / 5');
  assert.equal(await overlay('.player').getAttribute('role'), 'dialog');
  assert.equal(await overlay('.player').getAttribute('aria-modal'), 'true');
  assert.equal(await overlay('.player').getAttribute('aria-label'), 'Slideshow: Quarterly review');
  assert.equal(await page.evaluate(() => document.querySelector('main').inert), true, 'the page behind the player is inert');
  assert.equal(await page.evaluate(() => document.querySelector('[data-opf-player]').shadowRoot.activeElement?.className), 'player', 'focus moves into the dialog');
  assert.equal(await overlay('.frame section').getAttribute('aria-label'), 'Slide 1 of 5: Quarterly review');
  assert.equal(await page.evaluate(() => document.querySelector('[data-opf-player]').shadowRoot.querySelector('.frame svg').getAttribute('role')), null);
  // Tab stays inside the dialog.
  const focusKept = [];
  for (let step = 0; step < 7; step++) { await page.keyboard.press('Tab'); focusKept.push(await page.evaluate(() => document.activeElement.hasAttribute('data-opf-player'))); }
  assert.ok(focusKept.every(Boolean), 'Tab cycles inside the player');
  await page.evaluate(() => document.querySelector('[data-opf-player]').shadowRoot.querySelector('.player').focus());
  await page.keyboard.press('ArrowRight');
  assert.equal(await playerCounter(), '2 / 5');
  assert.equal(await playerTitle(), 'Agenda');
  await page.keyboard.press('Space');
  assert.equal(await playerTitle(), 'Revenue grew 18 percent', 'space is next, and the hidden slide is skipped');
  await page.keyboard.press('ArrowLeft'); await page.keyboard.press('Backspace');
  assert.equal(await playerCounter(), '1 / 5', 'left arrow and backspace are previous');
  await page.keyboard.press('End');
  assert.equal(await playerCounter(), '5 / 5');
  await page.keyboard.press('Home');
  assert.equal(await playerCounter(), '1 / 5');
  await page.keyboard.press('n'); await page.keyboard.press('Enter'); await page.keyboard.press('PageDown'); await page.keyboard.press('p');
  assert.equal(await playerCounter(), '3 / 5', 'n, Enter and Page Down are next; p is previous');
  // number then Enter
  await page.keyboard.press('4');
  assert.equal(await overlay('.goto').innerText(), 'Go to slide 4');
  await page.keyboard.press('Enter');
  assert.equal(await playerCounter(), '4 / 5');
  assert.equal(await overlay('.goto').isHidden(), true);
  await page.keyboard.press('3'); await page.keyboard.press('Escape');
  assert.equal(await overlay('.goto').isHidden(), true, 'Escape clears a half-typed number');
  assert.equal(await overlay('.player').count(), 1, 'and does not leave the show');
  await page.keyboard.press('9'); await page.keyboard.press('9'); await page.keyboard.press('Enter');
  assert.equal(await playerCounter(), '5 / 5', 'a number past the end goes to the last slide');
  await page.keyboard.press('1'); await page.keyboard.press('Enter');
  assert.equal(await playerCounter(), '1 / 5');
  // black and white
  await page.keyboard.press('b');
  assert.equal(await overlay('.blank').isVisible(), true);
  assert.equal(await overlay('.blank').evaluate(node => getComputedStyle(node).backgroundColor), 'rgb(0, 0, 0)');
  assert.equal(await overlay('[role=status][aria-live]').innerText(), 'Black screen', 'a blank screen is announced');
  await page.keyboard.press('b');
  assert.equal(await overlay('.blank').isHidden(), true, 'b again shows the slide');
  await page.keyboard.press('w');
  assert.equal(await overlay('.blank').evaluate(node => getComputedStyle(node).backgroundColor), 'rgb(255, 255, 255)');
  await page.keyboard.press('ArrowRight');
  assert.equal(await overlay('.blank').isHidden(), true, 'a navigation key brings the slide back');
  assert.equal(await playerCounter(), '1 / 5', 'without moving on');
  await page.keyboard.press('ArrowRight');
  assert.equal(await playerCounter(), '2 / 5');
  assert.deepEqual((await events(page)).filter(event => event.slide > 0).map(event => event.slide).slice(-2), [1, 2], 'the element hears the show');
  // reduced motion in the player
  await page.evaluate(() => { document.querySelector('[data-opf-player]').shadowRoot.querySelector('.player').classList.remove('idle'); });
  const hudTransition = () => overlay('.hud').evaluate(node => getComputedStyle(node).transitionDuration);
  assert.notEqual(await hudTransition(), '0s');
  await page.emulateMedia({reducedMotion: 'reduce'});
  assert.equal(await hudTransition(), '0s');
  await page.emulateMedia({reducedMotion: 'no-preference'});
  // axe with the player open: the page is inert, the dialog is the content.
  assert.deepEqual(await axeRun(), [], 'axe finds no violations with the player open');

  // Escape ends the show: focus goes back to where the show started, the page is live again, the element is on the slide the show ended on.
  await page.evaluate(() => document.querySelector('[data-opf-player]').shadowRoot.querySelector('.player').focus());
  await page.keyboard.press('Escape');
  await page.locator('[data-opf-player]').waitFor({state: 'detached'});
  assert.equal(await page.evaluate(() => document.querySelector('main').inert), false, 'the page is live again');
  assert.equal(await page.evaluate(() => document.getElementById('d').shadowRoot.activeElement?.className), 'present', 'keyboard invocation restores the Present button');
  assert.equal(await counter(page).innerText(), '2 / 5', 'the element shows the slide the show ended on');

  await deckEl(page).locator('button.present').click();
  await player.locator('.player').waitFor();
  await page.keyboard.press('Escape');
  await player.waitFor({state: 'detached'});
  assert.equal(await page.evaluate(() => document.getElementById('d').shadowRoot.activeElement?.className), 'present', 'click invocation restores the Present button');
  const explicitFocus = await page.evaluate(async () => {
    const element = document.getElementById('d'), target = document.getElementById('after');
    let focusAtEnd;
    element.addEventListener('presentend', () => { focusAtEnd = document.activeElement.id; }, {once: true});
    const session = await element.present({fullscreen: false, returnFocus: target});
    session.close();
    return {focusAtEnd, after: document.activeElement.id};
  });
  assert.deepEqual(explicitFocus, {focusAtEnd: 'after', after: 'after'}, 'explicit focus survives close and presentend');
  assert.equal(await page.evaluate(async () => {
    const target = document.createElement('button'); document.body.append(target); target.focus();
    const element = document.getElementById('d');
    const opening = element.present({fullscreen: false}); target.remove();
    const session = await opening; session.close();
    return element.shadowRoot.activeElement?.className;
  }), 'viewport', 'a target removed during asynchronous startup falls back safely');
  assert.equal(await page.evaluate(async deck => {
    document.getElementById('before').focus();
    const session = await window.opf.present(deck, {fullscreen: false}); session.close();
    return document.activeElement.id;
  }, deck), 'before', 'direct present still restores host focus');

  // ------------------------------------------------------------------------------------------------------------------
  // The speaker view in a second window (a second show, with an injected clock so the timer and the clock are exact).
  await page.evaluate(() => { window.__now = Date.UTC(2026, 9, 1, 14, 7, 0); window.__showEvents = []; });
  await page.evaluate(async () => { const session = await document.getElementById('d').present({now: () => window.__now, fullscreen: false}); window.__show = session; session.addEventListener('slidechange', event => window.__showEvents.push(event.detail.slide)); });
  await player.locator('.player').waitFor();
  await page.evaluate(() => document.querySelector('[data-opf-player]').shadowRoot.querySelector('.player').focus());
  await events(page);
  const [popup] = await Promise.all([page.waitForEvent('popup'), page.keyboard.press('s')]);
  watch(popup, 'speaker');
  await popup.locator('.pv').waitFor();
  await popup.waitForFunction(() => document.querySelector('.notes')?.textContent.length > 0);
  assert.equal(await popup.title(), 'Speaker view: Quarterly review');
  const pv = {position: () => popup.locator('header .big').first().innerText(), notes: () => popup.locator('.notes').evaluate(node => node.textContent), nextText: () => popup.locator('.slidebox').nth(1).locator('svg text').allTextContents(), currentText: () => popup.locator('.slidebox').first().locator('svg text').allTextContents()};
  assert.equal(await pv.position(), 'Slide 2 of 5');
  assert.equal(await pv.notes(), 'Keep this under one minute.');
  assert.deepEqual((await pv.currentText())[0], 'Agenda');
  assert.deepEqual((await pv.nextText())[0], 'Revenue grew 18 percent', 'the next slide skips the hidden one');
  assert.equal(await popup.locator('.slidebox').nth(1).locator('.end').isHidden(), true);
  assert.equal(await popup.locator('.slidebox').nth(1).locator('svg').getAttribute('aria-hidden'), 'true', 'the next-slide preview is not read twice');
  assert.match(await popup.locator('header .muted').first().innerText(), /Section: Opening/);
  if (process.env.PLAYER_DUMP) { await popup.screenshot({path: path.join(outputDirectory, 'speaker-view.png')}); await page.screenshot({path: path.join(outputDirectory, 'player.png')}); }
  // Timer and clock are exact with an injected clock.
  assert.match(await popup.locator('[role=timer]').innerText(), /^0:0\d$/, 'the timer starts with the view');
  assert.equal(await popup.locator('header .muted').nth(1).innerText(), 'of 10:00', 'the deck duration is the target');
  assert.equal(await popup.locator('header .big').last().innerText(), '2:07 PM', 'the clock reads the injected time');
  await page.evaluate(() => { window.__now += 65000; });
  await popup.waitForFunction(() => document.querySelector('[role=timer]').textContent === '1:05', null, {timeout: 4000});
  await page.evaluate(() => { window.__now += 11 * 60000; });
  await popup.waitForFunction(() => document.querySelector('[role=timer]').classList.contains('over'), null, {timeout: 4000});
  await popup.getByRole('button', {name: 'Pause'}).click();
  await popup.getByRole('button', {name: 'Reset timer'}).click();
  assert.equal(await popup.locator('[role=timer]').innerText(), '0:00');
  assert.equal(await popup.getByRole('button', {name: /Resume/}).count(), 1);
  await popup.getByRole('button', {name: /Resume/}).click();
  // Sync, speaker view to audience window.
  await events(page);
  await popup.getByRole('button', {name: /Next/}).click();
  await page.waitForFunction(() => document.querySelector('[data-opf-player]').shadowRoot.querySelector('.counter').textContent.trim() === '3 / 5');
  assert.equal(await playerTitle(), 'Revenue grew 18 percent');
  assert.equal(await pv.position(), 'Slide 3 of 5');
  assert.equal(await pv.notes(), 'Point at the enterprise bar.');
  assert.match(await popup.locator('header .muted').first().innerText(), /Section: Results/);
  // audience window to speaker view
  await page.keyboard.press('ArrowRight');
  await popup.waitForFunction(() => document.querySelector('header .big').textContent === 'Slide 4 of 5');
  assert.equal(await pv.notes(), 'No notes for this slide.');
  await popup.keyboard.press('ArrowRight');
  await popup.waitForFunction(() => document.querySelector('header .big').textContent === 'Slide 5 of 5');
  assert.equal(await playerCounter(), '5 / 5', 'a key in the speaker view moves the show');
  assert.equal(await popup.locator('.slidebox').nth(1).locator('.end').isVisible(), true, 'the last slide has no next slide');
  assert.equal((await events(page)).filter(event => event.slide).map(event => event.slide).join(), '3,4,5', 'the element hears slide changes made in either window');
  // number then Enter in the speaker view
  await popup.keyboard.press('2'); await popup.keyboard.press('Enter');
  await page.waitForFunction(() => document.querySelector('[data-opf-player]').shadowRoot.querySelector('.counter').textContent.trim() === '2 / 5');
  // blank from the speaker view
  await popup.getByRole('button', {name: 'Black screen'}).click();
  await page.waitForFunction(() => !document.querySelector('[data-opf-player]').shadowRoot.querySelector('.blank').hidden);
  assert.equal(await popup.getByRole('button', {name: 'Black screen'}).getAttribute('aria-pressed'), 'true');
  await page.keyboard.press('b');
  await popup.waitForFunction(() => document.querySelector('button[aria-pressed="true"]') === null);
  // notes font size
  await popup.getByRole('button', {name: 'Larger notes text'}).click();
  assert.equal(await popup.locator('.notes').evaluate(node => getComputedStyle(node).fontSize), '22px');
  // The speaker view is accessible too.
  await popup.addScriptTag({url: `${origin}/axe.js`});
  const speakerAxe = await popup.evaluate(async () => (await window.axe.run(document, {runOnly: {type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice']}})).violations.map(violation => ({id: violation.id, nodes: violation.nodes.map(node => node.target.join(' ')).slice(0, 3)})));
  assert.deepEqual(speakerAxe, [], 'axe finds no violations in the speaker view');
  // Escape in the speaker view closes only the speaker view.
  await popup.keyboard.press('Escape').catch(() => {});
  await popup.waitForEvent('close').catch(() => {});
  assert.equal(popup.isClosed(), true);
  assert.equal(await player.locator('.player').count(), 1, 'the show goes on');

  // A speaker view in a second tab (no popup): it follows the show over BroadcastChannel across tabs.
  const tab = await open('/empty.html', {wait: false});
  await tab.evaluate(async () => { window.__session = await window.opf.present(window.__deckJson ?? await (await fetch('/deck.opf.json')).json(), {role: 'presenter', fonts: '/opf-fonts/'}); });
  const tabShadow = tab.locator('[data-opf-player]');
  await tabShadow.locator('.pv').waitFor();
  await tab.waitForFunction(() => document.querySelector('[data-opf-player]').shadowRoot.querySelector('header .big').textContent === 'Slide 2 of 5');
  if (process.env.PLAYER_DUMP) await tab.screenshot({path: path.join(outputDirectory, 'tab-presenter.png')});
  await tab.locator('[data-opf-player]').getByRole('button', {name: /Next/}).click();
  await page.waitForFunction(() => document.querySelector('[data-opf-player]').shadowRoot.querySelector('.counter').textContent.trim() === '3 / 5');
  assert.equal(await playerTitle(), 'Revenue grew 18 percent', 'a second tab asks the others where the show is, and moves it');
  await tab.close();

  assert.equal(await page.evaluate(() => window.__show.slide), 3, 'the show the tab moved is on slide 3');
  await page.evaluate(() => window.__show.close());
  await player.waitFor({state: 'detached'});

  // The speaker view closes with the show.
  await deckEl(page).locator('button.present').click();
  await player.locator('.player').waitFor();
  const [popup2] = await Promise.all([page.waitForEvent('popup'), overlay('button[aria-label^="Open speaker view"]').click()]);
  await popup2.locator('.pv').waitFor();
  await page.waitForTimeout(1200);
  assert.equal(await player.locator('.player').count(), 1, 'opening the speaker view does not end the show, even if the browser leaves full screen for it');
  await overlay('button[aria-label^="Exit slideshow"]').click();
  await player.waitFor({state: 'detached'});
  await popup2.waitForEvent('close').catch(() => {});
  assert.equal(popup2.isClosed(), true, 'ending the show closes the speaker view');
  await page.evaluate(() => { window.__fullscreen = []; });

  // A show asked for twice while it is still loading is one show; Escape while it loads ends it and leaves the page as it was.
  const loading = await page.evaluate(async () => {
    const [first, second] = await Promise.all([window.opf.present('/slow.json', {fullscreen: false}), window.opf.present('/slow.json', {fullscreen: false})]);
    const out = {same: first === second, slide: first.slide};
    first.close();
    const pending = window.opf.present('/slow.json', {fullscreen: false}).then(() => 'started', error => error.name);
    await new Promise(resolve => setTimeout(resolve, 100));
    out.coveredWhileLoading = document.querySelectorAll('[data-opf-player]').length === 1 && document.querySelector('main').inert;
    document.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true}));
    out.result = await pending;
    out.hosts = document.querySelectorAll('[data-opf-player]').length;
    out.inert = document.querySelector('main').inert;
    return out;
  });
  assert.deepEqual(loading, {same: true, slide: 1, coveredWhileLoading: true, result: 'AbortError', hosts: 0, inert: false});

  // A blocked popup is reported, not thrown.
  const blocked = await page.evaluate(async () => {
    const session = await window.opf.present(document.getElementById('d').document, {fullscreen: false});
    const original = window.open; window.open = () => null;
    const result = session.openPresenterView(); window.open = original;
    session.close();
    return {result, closed: session.closed};
  });
  assert.deepEqual(blocked, {result: null, closed: true});

  // One show per window: a second click on Present is the same show.
  const same = await page.evaluate(async () => { const element = document.getElementById('d'); const first = await element.present({fullscreen: false}); const second = await element.present({fullscreen: false}); const out = {same: first === second, hosts: document.querySelectorAll('[data-opf-player]').length}; first.close(); return out; });
  assert.deepEqual(same, {same: true, hosts: 1});
  // F leaves full screen without ending the show; the show still ends when full screen is left another way.
  const toggled = await page.evaluate(async () => {
    const session = await window.opf.present(document.getElementById('d').document, {});
    await new Promise(resolve => setTimeout(resolve, 300));
    const entered = Boolean(document.fullscreenElement);
    if (entered) {
      document.querySelector('[data-opf-player]').shadowRoot.querySelector('.player').dispatchEvent(new KeyboardEvent('keydown', {key: 'f', bubbles: true, composed: true}));
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    const out = {entered, left: !document.fullscreenElement, closed: session.closed};
    session.close();
    return out;
  });
  if (toggled.entered) assert.deepEqual(toggled, {entered: true, left: true, closed: false}, 'the F key leaves full screen and keeps the show running');

  // The player on its own, from a document or a URL, not through an element.
  const standalone = await page.evaluate(async () => {
    const session = await window.opf.present('/deck.opf.json', {fonts: '/opf-fonts/', fullscreen: false, startSlide: 3});
    const out = {slide: session.slide, total: session.total, hostCount: document.querySelectorAll('[data-opf-player]').length};
    const changes = []; session.addEventListener('slidechange', event => changes.push(event.detail.slide));
    session.next(); session.next(); session.next(); session.goto(1); session.previous();
    session.blank('white'); out.blank = session.blankMode; session.blank('none');
    out.changes = changes;
    const closed = new Promise(resolve => session.addEventListener('close', event => resolve(event.detail.slide)));
    session.close(); session.close();
    out.closedAt = await closed;
    out.hostsAfter = document.querySelectorAll('[data-opf-player]').length;
    return out;
  });
  assert.deepEqual(standalone, {slide: 3, total: 5, hostCount: 1, blank: 'white', changes: [4, 5, 1], closedAt: 1, hostsAfter: 0});
  const refused = await page.evaluate(async () => {
    const errors = [];
    for (const source of [{slides: [{hidden: true}]}, {no: 'slides'}, '/missing.json', '{"slides": 3']) {
      try { await window.opf.present(source, {fullscreen: false}); errors.push('no error'); } catch (error) { errors.push(`${error.name}:${error.code}`); }
    }
    return {errors, leftover: document.querySelectorAll('[data-opf-player]').length, inert: document.querySelector('main').inert};
  });
  assert.deepEqual(refused, {errors: ['DeckError:no-slides', 'DeckError:invalid-document', 'DeckError:fetch-failed', 'DeckError:invalid-document'], leftover: 0, inert: false}, 'a deck that cannot play leaves the page as it was');
  await page.close();

  // Fullscreen: leaving it ends the show (Escape in browsers that do not deliver the key).
  const fs = await open('/basic.html');
  const fullscreen = await fs.evaluate(async () => {
    const session = await window.opf.present(document.getElementById('d').document, {});
    await new Promise(resolve => setTimeout(resolve, 400));
    const entered = Boolean(document.fullscreenElement);
    if (entered) { await document.exitFullscreen(); await new Promise(resolve => setTimeout(resolve, 200)); }
    const result = {entered, closed: session.closed};
    session.close();
    return result;
  });
  if (fullscreen.entered) assert.equal(fullscreen.closed, true, 'leaving full screen (Escape) ends the show');
  else console.log('full screen is not available in this browser; the Escape key path was exercised above');
  await fs.close();

  // ------------------------------------------------------------------------------------------------------------------
  // Notes are text, never markup, in the speaker view.
  const notesPage = await open('/empty.html', {wait: false});
  const [notesPopup] = await Promise.all([
    notesPage.waitForEvent('popup'),
    notesPage.evaluate(async (deck) => { const session = await window.opf.present(deck, {fullscreen: false}); window.__session = session; document.addEventListener('click', () => session.openPresenterView(), {once: true}); }, xssDeck).then(() => notesPage.mouse.click(5, 5)),
  ]);
  await notesPopup.locator('.notes').waitFor();
  assert.equal(await notesPopup.locator('.notes').evaluate(node => node.textContent), '<img src=x onerror="window.__pwned=1"> <b>not bold</b>');
  assert.equal(await notesPopup.locator('.notes img, .notes b').count(), 0, 'notes are not parsed as markup');
  assert.equal(await notesPopup.locator('header .muted').first().innerText(), 'Section: <i>S</i>');
  assert.equal(await notesPage.evaluate(() => window.__pwned ?? null), null);
  await notesPage.close();

  // Hidden slides at the start of a deck: the show starts on the first slide that plays.
  const first = await open('/empty.html', {wait: false});
  assert.deepEqual(await first.evaluate(async (deck) => { const session = await window.opf.present(deck, {fullscreen: false}); const out = {slide: session.slide, total: session.total, title: document.querySelector('[data-opf-player]').shadowRoot.querySelector('.frame svg text').textContent}; session.close(); return out; }, hiddenFirst), {slide: 1, total: 2, title: 'Visible one'});
  await first.close();

  // ------------------------------------------------------------------------------------------------------------------
  // Static markup from the server upgrades in place.
  const ssr = watch(await context.newPage(), 'ssr');
  await ssr.goto(`${origin}/ssr.html`);
  assert.equal(await ssr.evaluate(() => document.getElementById('d').shadowRoot), null, 'before the script runs it is plain markup');
  assert.equal(await ssr.locator('opf-deck figure').count(), 5, 'every slide is there for a reader without JavaScript');
  assert.equal(await ssr.locator('opf-deck figure svg').first().evaluate(node => node.getBoundingClientRect().width > 300), true, 'drawn at the width of its container');
  assert.equal(await ssr.locator('opf-deck figure').first().getAttribute('aria-label'), 'Slide 1 of 5: Quarterly review');
  const before = requests.length;
  await ssr.addScriptTag({url: '/bundle.js'});
  await ssr.evaluate(() => document.getElementById('d').ready);
  assert.equal(await ssr.evaluate(() => document.getElementById('d').shadowRoot !== null), true);
  assert.equal(await ssr.locator('opf-deck figure').first().evaluate(node => node.getBoundingClientRect().width), 0, 'the fallback is replaced by the shadow DOM, not shown twice');
  assert.equal(await ssr.evaluate(() => document.getElementById('d').total), 5);
  assert.ok(!requests.slice(before).includes('/deck.opf.json'), 'an embedded document needs no request');
  await ssr.close();

  // ------------------------------------------------------------------------------------------------------------------
  // Script fonts load lazily, and a right-to-left deck turns the controls around.
  const arabic = await open('/arabic.html');
  assert.ok(requests.some(pathname => pathname.startsWith('/opf-fonts/scripts/noto-sans-arabic/')), 'the Arabic face is fetched, from the self-hosted root, because the deck draws Arabic');
  assert.ok(!requests.some(pathname => /noto-sans-jp|noto-sans-sc|noto-sans-thai/.test(pathname)), 'and no other script');
  assert.equal(await arabic.evaluate(() => [...document.fonts].some(face => /Noto Sans Arabic/.test(face.family) && face.status === 'loaded')), true);
  assert.equal(await arabic.evaluate(() => document.getElementById('d').shadowRoot.querySelector('.slide svg').getAttribute('lang')), 'ar');
  assert.equal(await arabic.evaluate(() => document.getElementById('d').shadowRoot.querySelector('.deck').classList.contains('rtl')), true, 'a deck in a right-to-left language reads right to left');
  await arabic.locator('opf-deck .viewport').focus();
  await arabic.keyboard.press('ArrowLeft');
  assert.equal(await arabic.evaluate(() => document.getElementById('d').slide), 2, 'so Left is next');
  await arabic.keyboard.press('ArrowRight');
  assert.equal(await arabic.evaluate(() => document.getElementById('d').slide), 1, 'and Right is previous');
  assert.equal((await arabic.locator('opf-deck .slide svg text').allTextContents())[0].replace(new RegExp(`[${String.fromCodePoint(0x2066)}-${String.fromCodePoint(0x2069)}]`, 'g'), ''), 'مرحبا بالعالم', 'the text is live Arabic (the renderer wraps right-to-left lines in bidi isolates)');
  if (process.env.PLAYER_DUMP) await arabic.screenshot({path: path.join(outputDirectory, 'arabic.png')});
  await arabic.close();

  // ------------------------------------------------------------------------------------------------------------------
  // The document property, no fonts, errors.
  const prop = await open('/empty.html', {wait: false});
  const viaProperty = await prop.evaluate(async (deck) => {
    const element = document.createElement('opf-deck');
    element.id = 'd'; document.getElementById('host').append(element);
    element.document = deck;
    await element.ready;
    const first = element.currentSlide.title;
    element.document = JSON.stringify({slides: [{title: 'Replaced'}]});
    await element.ready;
    return {first, second: element.currentSlide.title, total: element.total, fonts: performance.getEntriesByType('resource').filter(entry => entry.name.includes('/opf-fonts/')).length};
  }, deck);
  assert.deepEqual(viaProperty, {first: 'Quarterly review', second: 'Replaced', total: 1, fonts: 0}, 'a document property draws without any request, with estimated layout and no fonts');
  await prop.close();

  const plain = await open('/plain.html');
  assert.equal(await titleOf(plain), 'Quarterly review');
  assert.deepEqual(await plain.evaluate(() => performance.getEntriesByType('resource').map(entry => new URL(entry.name).pathname).filter(pathname => !['/bundle.js', '/deck.opf.json', '/favicon.ico'].includes(pathname))), [], 'without a fonts root nothing but the deck is requested');
  await plain.close();

  const failing = await open('/missing.html', {wait: false});
  const failure = await failing.evaluate(async () => { const element = document.getElementById('d'); try { await element.ready; return 'resolved'; } catch (error) { return `${error.code}`; } });
  assert.equal(failure, 'fetch-failed');
  assert.match(await failing.locator('opf-deck .error').innerText(), /could not be loaded \(404\)/);
  assert.match(await failing.locator('opf-deck .error').innerText(), /\/missing.json/);
  assert.equal(await failing.locator('opf-deck .error').getAttribute('role'), 'alert');
  await failing.close();
  const broken = await open('/broken.html', {wait: false});
  assert.equal(await broken.evaluate(async () => { try { await document.getElementById('d').ready; } catch (error) { return error.code; } }), 'invalid-document');
  await broken.close();
  const fallback = await open('/fallback.html', {wait: false});
  const invalid = await fallback.evaluate(async () => { try { await document.getElementById('d').ready; } catch (error) { return {code: error.code, message: error.message, details: error.details}; } });
  assert.equal(invalid.code, 'invalid-document');
  assert.match(invalid.message, /fallback.json.*text\/html.*response is HTML.*SPA fallback/s);
  assert.deepEqual(invalid.details, {source: `${origin}/fallback.json`, status: 200, contentType: 'text/html'});
  const diagnostic = await fallback.evaluate(async () => {
    const element = document.getElementById('d'); let detail;
    element.addEventListener('error', event => { detail = event.detail; }, {once: true});
    try { await element.reload(); } catch { /* inspect the public diagnostic */ }
    return detail;
  });
  assert.deepEqual(diagnostic, {code: invalid.code, message: invalid.message, fatal: true, ...invalid.details}, 'public error event retains fetched response context');
  await fallback.evaluate(async () => { const element = document.getElementById('d'); element.src = '/deck.opf.json'; await element.ready; });
  assert.equal(await titleOf(fallback), 'Quarterly review', 'correcting src recovers from an HTML fallback');
  await fallback.close();
  const wrongmime = await open('/wrongmime.html');
  assert.equal(await titleOf(wrongmime), 'Quarterly review', 'valid JSON is accepted even when the host sends text/html');
  await wrongmime.close();

  const degraded = await open('/nofonts.html', {wait: false});
  const degradedEvents = await degraded.evaluate(async () => { const element = document.getElementById('d'); const seen = []; element.addEventListener('error', event => seen.push(event.detail)); await element.ready; await new Promise(resolve => setTimeout(resolve, 50)); return {seen, title: element.currentSlide.title}; });
  assert.equal(degradedEvents.title, 'Quarterly review', 'unreachable fonts do not stop the deck');
  await degraded.close();

  assert.deepEqual(problems, [], 'no page errors or console errors');
  console.log('player browser checks passed');
} finally {
  await browser.close();
  server.close();
}
