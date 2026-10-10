// RR-59 (opf-render#170): forced-colors verification of <opf-deck> and its slideshow player, with Chromium's forced-colors
// EMULATION (`page.emulateMedia({forcedColors: 'active'})`), in the light and the dark colour scheme. Nothing here changes a
// Windows setting, and it is not the real Windows contrast theme (a contrast theme brings its own palette; the emulation uses
// Chromium's default forced palette for the emulated scheme). It checks that the following stay visible when the browser
// replaces the author's colours with system colours:
//   - the slide boundary (the viewport frame), the Previous, Next and Present buttons, the slide counter, the thumbnails and
//     the current thumbnail,
//   - the focus ring of the focused control (the slide group, each button, a thumbnail),
//   - the slideshow: its Previous, Next, Speaker view and Exit buttons, the counter and the focus ring; and the speaker view window
//     (its buttons, notes and slide boxes),
// as computed style (border and outline style, width and colour; a colour must be a system colour, not an author colour) and as
// pixels of a real screenshot (the boundary and the focus ring are drawn in a system colour that differs from the page's
// background; text has contrast against what is drawn behind it). No control may rely only on its background colour.
// Two pages: the starter embed (the website starter's element, styled with the site's `--opf-deck-*` tokens, in the page's own
// light and dark) and a bare `<opf-deck>`. Screenshots go to artifacts/forced-colors/ (not committed). Offline: localhost only.
import assert from 'node:assert/strict';
import http from 'node:http';
import {mkdir, readFile, rm, writeFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {chromium} from 'playwright';
import sharp from 'sharp';
import {copyPreviewFonts} from '../dist/preview-fonts-node.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDirectory = path.resolve(root, process.argv[2] ?? 'artifacts/forced-colors');
await rm(outputDirectory, {recursive: true, force: true});
await mkdir(outputDirectory, {recursive: true});
const fontRoot = path.join(outputDirectory, 'opf-fonts');
assert.equal(copyPreviewFonts({outDir: fontRoot}).missing.length, 0);

const deckText = await readFile(path.join(root, 'test/fixtures/player-deck.opf.json'), 'utf8');
const entry = "import '../dist/element-define.js'; import '../dist/player.js';";
const bundle = await build({stdin: {contents: entry, resolveDir: path.join(root, 'test'), sourcefile: 'forced-colors-entry.js', loader: 'js'}, bundle: true, platform: 'browser', format: 'iife', write: false, minify: true});
const script = bundle.outputFiles[0].text;

// The starter embed: the website starter's element (`thumbnails present`, a self-hosted font root) with the site's tokens
// (openpresentation.org maps `--opf-deck-*` to its own colour tokens, which differ between its light and dark themes).
const starterStyle = `
:root { color-scheme: light dark; --foreground: 222 20% 12%; --muted-foreground: 222 10% 38%; --border-strong: 222 14% 62%; --muted: 222 20% 94%; --accent: 262 70% 55%; --accent-strong: 262 70% 42%; --background: 0 0% 100%; }
@media (prefers-color-scheme: dark) { :root { --foreground: 210 20% 96%; --muted-foreground: 215 12% 70%; --border-strong: 215 12% 42%; --muted: 222 20% 16%; --accent: 262 80% 70%; --accent-strong: 262 80% 74%; --background: 222 24% 8%; } }
body { margin: 16px; font-family: system-ui, sans-serif; background: hsl(var(--background)); color: hsl(var(--foreground)); }
opf-deck { --opf-deck-fg: hsl(var(--foreground)); --opf-deck-muted: hsl(var(--muted-foreground)); --opf-deck-border: hsl(var(--border-strong)); --opf-deck-stage: hsl(var(--muted)); --opf-deck-focus: hsl(var(--accent-strong)); --opf-deck-accent: hsl(var(--accent-strong)); --opf-deck-hover: hsl(var(--accent) / .18); display: block; max-width: 720px; }`;
const bareStyle = 'body{margin:16px;font-family:sans-serif} opf-deck{max-width:720px}';
const shell = (style, body) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Forced colors</title><style>${style}</style></head><body><main><h1>Embedded deck</h1><button id="before" type="button">Before</button>${body}<button id="after" type="button">After</button></main><script src="/bundle.js"></script></body></html>`;
const pages = {
  '/starter.html': shell(starterStyle, '<opf-deck id="d" src="/deck.opf.json" fonts="/opf-fonts/" thumbnails present></opf-deck>'),
  '/bare.html': shell(bareStyle, '<opf-deck id="d" src="/deck.opf.json" fonts="/opf-fonts/" thumbnails present></opf-deck>'),
};
const requests = [];
const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, 'http://x');
  requests.push(url.pathname);
  const send = (status, type, body) => { response.writeHead(status, {'content-type': type}); response.end(body); };
  if (pages[url.pathname]) return send(200, 'text/html', pages[url.pathname]);
  if (url.pathname === '/bundle.js') return send(200, 'text/javascript', script);
  if (url.pathname === '/deck.opf.json') return send(200, 'application/json', deckText);
  if (url.pathname === '/favicon.ico') return send(204, 'image/x-icon', '');
  if (url.pathname.startsWith('/opf-fonts/')) {
    const file = path.join(outputDirectory, url.pathname);
    if (file.startsWith(fontRoot) && existsSync(file)) return send(200, 'font/ttf', await readFile(file));
  }
  send(404, 'text/plain', 'not found');
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;

// --- colour helpers ---------------------------------------------------------------------------------------------------
const parse = text => { const match = /^rgba?\(([^)]+)\)$/.exec(text.trim()); assert.ok(match, `a computed rgb colour, got "${text}"`); const parts = match[1].split(/[ ,/]+/).filter(Boolean).map(Number); return {r: parts[0], g: parts[1], b: parts[2], a: parts[3] ?? 1}; };
const key = color => `${color.r},${color.g},${color.b}`;
const luminance = ({r, g, b}) => [r, g, b].map(value => { const channel = value / 255; return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4; }).reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
const contrast = (a, b) => { const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };
const SYSTEM = ['Canvas', 'CanvasText', 'LinkText', 'VisitedText', 'ActiveText', 'ButtonFace', 'ButtonText', 'ButtonBorder', 'Field', 'FieldText', 'Highlight', 'HighlightText', 'SelectedItem', 'SelectedItemText', 'Mark', 'MarkText', 'GrayText'];

const browser = await chromium.launch({channel: process.platform === 'win32' && !process.env.CI ? 'msedge' : undefined});
const problems = [];
const report = [];

// The system palette of the emulation, resolved with probes that opt out of forced colours.
const palette = page => page.evaluate(names => {
  const out = {};
  for (const name of names) { const probe = document.createElement('div'); probe.style.cssText = `forced-color-adjust:none;position:absolute;color:${name}`; document.body.append(probe); out[name] = getComputedStyle(probe).color; probe.remove(); }
  return out;
}, SYSTEM);

// What a control's box draws: border, outline and colours, from the computed style (open shadow root).
const styleOf = (page, selector, scope = 'deck') => page.evaluate(([selector, scope]) => {
  const host = scope === 'player' ? document.querySelector('[data-opf-player]') : document.getElementById('d');
  const element = host.shadowRoot.querySelector(selector);
  if (!element) return null;
  const style = getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  return {borderStyle: style.borderTopStyle, borderWidth: parseFloat(style.borderTopWidth), borderColor: style.borderTopColor, outlineStyle: style.outlineStyle, outlineWidth: parseFloat(style.outlineWidth), outlineOffset: parseFloat(style.outlineOffset), outlineColor: style.outlineColor, color: style.color, background: style.backgroundColor, backgroundImage: style.backgroundImage, opacity: parseFloat(style.opacity), forcedColors: matchMedia('(forced-colors: active)').matches, rect: {x: rect.x, y: rect.y, width: rect.width, height: rect.height}};
}, [selector, scope]);

const pixels = async (page, clip) => { const {data, info} = await sharp(await page.screenshot({clip, animations: 'disabled'})).removeAlpha().raw().toBuffer({resolveWithObject: true}); return {data, width: info.width, height: info.height}; };
const pixelAt = ({data, width}, x, y) => ({r: data[(y * width + x) * 3], g: data[(y * width + x) * 3 + 1], b: data[(y * width + x) * 3 + 2]});
const histogram = ({data}) => { const counts = new Map(); for (let at = 0; at < data.length; at += 3) { const id = `${data[at]},${data[at + 1]},${data[at + 2]}`; counts.set(id, (counts.get(id) ?? 0) + 1); } return counts; };
const fromKey = id => { const [r, g, b] = id.split(',').map(Number); return {r, g, b}; };
const dominant = counts => fromKey([...counts].sort((a, b) => b[1] - a[1])[0][0]);

const check = (label, condition, detail = '') => { if (!condition) problems.push(`${label}${detail ? `: ${detail}` : ''}`); };
const inSystem = (sys, color) => Object.values(sys).some(value => key(parse(value)) === key(parse(color)));
const nameOf = (sys, color) => Object.entries(sys).filter(([, value]) => key(parse(value)) === key(parse(color))).map(([name]) => name).join('/') || 'author colour';

// A control keeps a visible frame: a border that is drawn, in a system colour that is not the page's Canvas, so that it does not
// depend on its background (which the browser forces to Canvas or ButtonFace).
const checkFrame = (label, sys, style) => {
  if (!style) return check(label, false, 'not found');
  check(label, style.forcedColors, 'forced colors are not active');
  check(`${label} border`, style.borderStyle !== 'none' && style.borderStyle !== 'hidden' && style.borderWidth >= 1, `${style.borderStyle} ${style.borderWidth}px`);
  check(`${label} border colour is a system colour`, inSystem(sys, style.borderColor), `${style.borderColor} (${nameOf(sys, style.borderColor)})`);
  check(`${label} border differs from Canvas`, key(parse(style.borderColor)) !== key(parse(sys.Canvas)), style.borderColor);
};
const checkRing = (label, sys, style, {minimum = 2} = {}) => {
  if (!style) return check(label, false, 'not found');
  check(`${label} focus outline`, style.outlineStyle !== 'none' && style.outlineStyle !== 'hidden' && style.outlineWidth >= minimum, `${style.outlineStyle} ${style.outlineWidth}px`);
  check(`${label} focus outline colour is a system colour`, inSystem(sys, style.outlineColor), `${style.outlineColor} (${nameOf(sys, style.outlineColor)})`);
  check(`${label} focus outline differs from Canvas`, key(parse(style.outlineColor)) !== key(parse(sys.Canvas)), style.outlineColor);
};

// The focus ring as pixels: the ring colour fills at least half of the frame just outside the control while it has focus, and
// none of it while it does not.
// The ring colour is composited over Canvas first: Chromium on Linux draws a focus ring as the system colour at alpha 0.8
// (computed `rgba(5, 0, 73, 0.8)`), Chromium on Windows at alpha 1.
const blend = (color, canvas) => ({r: Math.round(color.a * color.r + (1 - color.a) * canvas.r), g: Math.round(color.a * color.g + (1 - color.a) * canvas.g), b: Math.round(color.a * color.b + (1 - color.a) * canvas.b)});
const near = (a, b) => Math.abs(a.r - b.r) <= 2 && Math.abs(a.g - b.g) <= 2 && Math.abs(a.b - b.b) <= 2;
const ringPixels = async (page, style, ringColor, canvas) => {
  const drawnRing = blend(ringColor, canvas);
  const margin = 8;
  const clip = {x: Math.max(0, Math.floor(style.rect.x) - margin), y: Math.max(0, Math.floor(style.rect.y) - margin), width: Math.ceil(style.rect.width) + 2 * margin, height: Math.ceil(style.rect.height) + 2 * margin};
  const image = await pixels(page, clip);
  const left = Math.floor(style.rect.x) - clip.x, top = Math.floor(style.rect.y) - clip.y, right = left + Math.ceil(style.rect.width), bottom = top + Math.ceil(style.rect.height);
  let outside = 0, ring = 0;
  const seen = new Map();
  for (let y = 0; y < image.height; y++) for (let x = 0; x < image.width; x++) {
    if (x >= left && x < right && y >= top && y < bottom) continue;
    outside++;
    const pixel = pixelAt(image, x, y), id = key(pixel);
    seen.set(id, (seen.get(id) ?? 0) + 1);
    if (near(pixel, drawnRing)) ring++;
  }
  // On a failure the message names the colours that were drawn around the control, most frequent first.
  const drawn = [...seen].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([id, count]) => `rgb(${id}) x${count}`).join(', ');
  return {ring, outside, perimeter: 2 * (right - left + bottom - top), drawn, drawnRing};
};

const tabTo = async (page, selectors) => {
  await page.locator('#before').focus();
  for (let step = 0; step < 8; step++) {
    await page.keyboard.press('Tab');
    const at = await page.evaluate(() => { const host = document.activeElement; const inner = host?.shadowRoot?.activeElement; return inner ? (inner.className?.baseVal ?? inner.className) || inner.localName : host?.id || host?.localName; });
    if (selectors.includes(at)) return at;
  }
  throw new Error(`never reached ${selectors}`);
};

const runCase = async ({route, scheme}) => {
  const label = `${route.slice(1, -5)}/${scheme}`;
  const context = await browser.newContext({viewport: {width: 900, height: 900}, locale: 'en-US', timezoneId: 'UTC', deviceScaleFactor: 1});
  const page = await context.newPage();
  page.on('pageerror', error => problems.push(`${label}: ${error.message}`));
  page.on('console', message => { if (message.type() === 'error' && !/Failed to load resource/.test(message.text())) problems.push(`${label}: ${message.text()}`); });
  await page.emulateMedia({forcedColors: 'active', colorScheme: scheme});
  await page.goto(origin + route);
  await page.evaluate(() => document.getElementById('d').ready);
  await page.addStyleTag({content: '*, *::before, *::after { transition: none !important; animation: none !important; caret-color: transparent !important; }'});
  const state = await page.evaluate(() => ({forced: matchMedia('(forced-colors: active)').matches, dark: matchMedia('(prefers-color-scheme: dark)').matches}));
  assert.deepEqual(state, {forced: true, dark: scheme === 'dark'}, `${label}: the emulation is on`);
  const sys = await palette(page);
  const entry = {label, palette: {Canvas: sys.Canvas, CanvasText: sys.CanvasText, ButtonBorder: sys.ButtonBorder, Highlight: sys.Highlight}};
  await page.evaluate(() => window.scrollTo(0, 0));

  // 1. The frames: slide boundary, buttons, thumbnails, the current thumbnail.
  const frames = {viewport: '.viewport', previous: 'button.previous', next: 'button.next', present: 'button.present', thumb: '.thumb', current: '.thumb[aria-current="true"]'};
  const styles = {};
  for (const [name, selector] of Object.entries(frames)) styles[name] = await styleOf(page, selector);
  for (const name of ['viewport', 'previous', 'next', 'present', 'thumb']) checkFrame(`${label} ${name}`, sys, styles[name]);
  // The current thumbnail is marked by an outline (a shape), not by a colour change alone.
  const current = styles.current;
  check(`${label} current thumbnail`, Boolean(current) && current.outlineStyle !== 'none' && current.outlineWidth >= 2, current ? `${current.outlineStyle} ${current.outlineWidth}px` : 'not found');
  if (current) check(`${label} current thumbnail outline colour is a system colour`, inSystem(sys, current.outlineColor), current.outlineColor);
  // No control hides its frame behind its background: with the author's background-colour removed by the browser, the
  // background is a system colour too.
  for (const name of ['previous', 'next', 'present']) check(`${label} ${name} background is a system colour`, inSystem(sys, styles[name].background) || parse(styles[name].background).a === 0, styles[name].background);

  // 2. The slide boundary as pixels: the top border row of the viewport is in the system border colour, along its width.
  const box = styles.viewport.rect;
  const edge = await pixels(page, {x: Math.floor(box.x) - 4, y: Math.floor(box.y) - 4, width: Math.ceil(box.width) + 8, height: Math.ceil(box.height) + 8});
  // The frame is one device pixel wide at a fractional position, so look for it in the rows around the box's top edge.
  let drawn = 0;
  for (let row = 2; row <= 6; row++) { let count = 0; for (let x = 12; x < edge.width - 12; x++) if (key(pixelAt(edge, x, row)) === key(parse(styles.viewport.borderColor))) count++; drawn = Math.max(drawn, count); }
  check(`${label} slide boundary pixels`, drawn >= (edge.width - 24) * 0.95, `${drawn} of ${edge.width - 24} top-border pixels are ${styles.viewport.borderColor}`);
  check(`${label} slide boundary contrast`, contrast(parse(styles.viewport.borderColor), parse(sys.Canvas)) >= 3, `${contrast(parse(styles.viewport.borderColor), parse(sys.Canvas)).toFixed(2)}:1 against Canvas`);
  // The slide itself draws (forced colours restyle HTML, not the slide's own SVG): the inside of the viewport is not one flat colour.
  const inside = await pixels(page, {x: Math.floor(box.x) + 2, y: Math.floor(box.y) + 2, width: Math.floor(box.width) - 4, height: Math.floor(box.height) - 4});
  check(`${label} slide drawing`, histogram(inside).size > 2, 'the slide area is one flat colour');
  entry.slideColors = histogram(inside).size;
  await page.screenshot({path: path.join(outputDirectory, `${label.replace('/', '-')}-deck.png`), fullPage: true});

  // 3. The disabled Previous button (slide 1) still shows its frame, with contrast against Canvas.
  check(`${label} disabled Previous`, (await page.evaluate(() => document.getElementById('d').shadowRoot.querySelector('button.previous').getAttribute('aria-disabled'))) === 'true');
  const prev = styles.previous;
  // Disabled is drawn in GrayText at full opacity (fading would blend the frame and its focus ring into Canvas), so it is still a frame.
  check(`${label} disabled Previous is GrayText, not faded`, prev.opacity === 1 && key(parse(prev.color)) === key(parse(sys.GrayText)) && key(parse(prev.borderColor)) === key(parse(sys.GrayText)), `opacity ${prev.opacity}, ${prev.color}, ${prev.borderColor}`);
  const prevImage = await pixels(page, {x: Math.floor(prev.rect.x), y: Math.floor(prev.rect.y), width: Math.ceil(prev.rect.width), height: Math.ceil(prev.rect.height)});
  const prevEdges = [0, 1, 2].map(row => pixelAt(prevImage, Math.floor(prevImage.width / 2), row));
  const prevEdge = prevEdges.sort((x, y) => contrast(y, parse(sys.Canvas)) - contrast(x, parse(sys.Canvas)))[0];
  const prevContrast = contrast(prevEdge, parse(sys.Canvas));
  check(`${label} disabled Previous border contrast`, prevContrast >= 3, `${prevContrast.toFixed(2)}:1 (${key(prevEdge)} on ${key(parse(sys.Canvas))})`);
  entry.disabledBorderContrast = Number(prevContrast.toFixed(2));

  // 4. Focus rings, reached with the keyboard: the slide group, Previous, Next, Present, the thumbnail strip.
  const stops = {viewport: '.viewport', prev: 'button.previous', next: 'button.next', present: 'button.present', thumb: '.thumb'};
  const classOf = {viewport: 'viewport', prev: 'previous', next: 'next', present: 'present', thumb: 'thumb'};
  entry.focus = {};
  for (const name of ['viewport', 'prev', 'next', 'present', 'thumb']) {
    // Move focus by keyboard so that :focus-visible applies.
    await page.locator('#before').focus();
    await page.keyboard.press('Tab');
    const order = ['viewport', 'prev', 'next', 'present', 'thumb'];
    for (let step = 0; step < order.indexOf(name); step++) await page.keyboard.press('Tab');
    const active = await page.evaluate(() => document.getElementById('d').shadowRoot.activeElement?.className ?? '');
    check(`${label} Tab reaches ${name}`, active.includes(classOf[name]), `active "${active}"`);
    const focused = await page.evaluate(selector => { const active = document.getElementById('d').shadowRoot.activeElement; return active?.matches?.(selector) ?? false; }, stops[name]);
    check(`${label} ${name} holds focus`, focused);
    const style = await styleOf(page, stops[name]);
    checkRing(`${label} ${name}`, sys, style, {minimum: name === 'thumb' ? 2 : 2});
    // For the thumbnail that is also the current one, the ring and the current marker are the same outline; the strip's arrow keys move the ring.
    const ring = parse(style.outlineColor);
    const onPixels = await ringPixels(page, style, ring, parse(sys.Canvas));
    check(`${label} ${name} focus ring contrast`, contrast(onPixels.drawnRing, parse(sys.Canvas)) >= 3, `${contrast(onPixels.drawnRing, parse(sys.Canvas)).toFixed(2)}:1 against Canvas (ring drawn as ${key(onPixels.drawnRing)})`);
    const outlineBox = {...style, rect: style.rect};
    check(`${label} ${name} focus ring pixels`, onPixels.ring >= onPixels.perimeter * 0.5, `${onPixels.ring} pixels of ${style.outlineColor} around a ${Math.round(style.rect.width)}x${Math.round(style.rect.height)} control; drawn there: ${onPixels.drawn}`);
    entry.focus[name] = {outline: `${style.outlineStyle} ${style.outlineWidth}px ${nameOf(sys, style.outlineColor)}`, ringPixels: onPixels.ring};
    await page.screenshot({path: path.join(outputDirectory, `${label.replace('/', '-')}-focus-${name}.png`), clip: {x: Math.max(0, style.rect.x - 12), y: Math.max(0, style.rect.y - 12), width: Math.min(880, style.rect.width + 24), height: Math.min(300, style.rect.height + 24)}});
    void outlineBox;
  }
  // A control that does not have focus draws no ring.
  await page.locator('#after').focus();
  const quiet = await styleOf(page, 'button.present');
  check(`${label} Present without focus`, quiet.outlineStyle === 'none' || quiet.outlineWidth === 0, `${quiet.outlineStyle} ${quiet.outlineWidth}px`);

  // 5. The slideshow (Present, then Exit).
  await page.locator('#before').focus();
  await tabTo(page, ['present']);
  await page.keyboard.press('Enter');
  const player = page.locator('[data-opf-player]');
  await player.locator('.player').waitFor();
  await page.waitForFunction(() => document.querySelector('[data-opf-player]')?.shadowRoot?.querySelector('.frame svg'));
  await page.addStyleTag({content: '*, *::before, *::after { transition: none !important; animation: none !important; }'});
  await page.evaluate(() => { const shadow = document.querySelector('[data-opf-player]').shadowRoot; const sheet = new CSSStyleSheet(); sheet.replaceSync('*, *::before, *::after { transition: none !important; animation: none !important; }'); shadow.adoptedStyleSheets = [...shadow.adoptedStyleSheets, sheet]; });
  await page.mouse.move(450, 700);
  await page.keyboard.press('Tab'); // the HUD fades while idle; focus within shows it
  const hud = {previous: 'button[aria-label="Previous slide"]', next: 'button[aria-label="Next slide"]', speaker: 'button[aria-label^="Open speaker view"]', exit: 'button[aria-label^="Exit slideshow"]'};
  entry.player = {};
  for (const [name, selector] of Object.entries(hud)) {
    await player.locator(selector).focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab'); // back onto the button with the keyboard, so :focus-visible applies
    const style = await styleOf(page, selector, 'player');
    checkFrame(`${label} player ${name}`, sys, style);
    const focused = await page.evaluate(selector => document.querySelector('[data-opf-player]').shadowRoot.activeElement?.matches(selector), selector);
    check(`${label} player ${name} holds focus`, focused === true);
    checkRing(`${label} player ${name}`, sys, style);
    const ring = await ringPixels(page, style, parse(style.outlineColor), parse(sys.Canvas));
    check(`${label} player ${name} focus ring contrast`, contrast(ring.drawnRing, parse(sys.Canvas)) >= 3, `${contrast(ring.drawnRing, parse(sys.Canvas)).toFixed(2)}:1 against Canvas`);
    check(`${label} player ${name} focus ring pixels`, ring.ring >= ring.perimeter * 0.5, `${ring.ring} pixels of ${style.outlineColor}; drawn there: ${ring.drawn}`);
    entry.player[name] = {border: `${style.borderStyle} ${style.borderWidth}px ${nameOf(sys, style.borderColor)}`, outline: `${style.outlineStyle} ${style.outlineWidth}px ${nameOf(sys, style.outlineColor)}`};
  }
  // The counter is text on the HUD strip: its colour has contrast against what is drawn behind it.
  const counter = await styleOf(page, '.hud .counter', 'player');
  const counterImage = await pixels(page, {x: Math.floor(counter.rect.x), y: Math.floor(counter.rect.y), width: Math.ceil(counter.rect.width), height: Math.ceil(counter.rect.height)});
  const counterBackground = dominant(histogram(counterImage));
  const counterContrast = contrast(parse(counter.color), counterBackground);
  check(`${label} player counter contrast`, counterContrast >= 4.5, `${counterContrast.toFixed(2)}:1 (${counter.color} on ${key(counterBackground)}; HUD background-image ${counter.backgroundImage})`);
  entry.player.counterContrast = Number(counterContrast.toFixed(2));
  // The slide in the show is drawn (not a flat colour), and the stage is not the page behind it.
  const stage = await styleOf(page, '.player', 'player');
  const shown = await pixels(page, {x: 0, y: 0, width: 900, height: 600});
  check(`${label} player slide drawing`, histogram(shown).size > 2, 'the show is one flat colour');
  await page.screenshot({path: path.join(outputDirectory, `${label.replace('/', '-')}-player.png`)});
  void stage;
  // The speaker view (a second window, the same emulation): its buttons, notes and slide boxes keep a system-colour frame, a
  // focused control draws a ring, and the disabled Previous on slide 1 is GrayText.
  const [popup] = await Promise.all([page.waitForEvent('popup'), player.locator(hud.speaker).click()]);
  await popup.emulateMedia({forcedColors: 'active', colorScheme: scheme});
  await popup.locator('.pv').waitFor();
  await popup.waitForFunction(() => document.querySelector('.slidebox svg'));
  await popup.addStyleTag({content: '*, *::before, *::after { transition: none !important; animation: none !important; }'});
  const view = selector => popup.evaluate(selector => { const element = document.querySelector(selector); const style = getComputedStyle(element); const rect = element.getBoundingClientRect(); return {borderStyle: style.borderTopStyle, borderWidth: parseFloat(style.borderTopWidth), borderColor: style.borderTopColor, outlineStyle: style.outlineStyle, outlineWidth: parseFloat(style.outlineWidth), outlineColor: style.outlineColor, color: style.color, opacity: parseFloat(style.opacity), forcedColors: matchMedia('(forced-colors: active)').matches, rect: {x: rect.x, y: rect.y, width: rect.width, height: rect.height}}; }, selector);
  entry.speakerView = {};
  const popupSys = await palette(popup);
  for (const [name, selector] of Object.entries({slidebox: '.slidebox', notes: '.notes', previous: 'footer button:nth-of-type(1)', next: 'footer button:nth-of-type(2)'})) {
    const style = await view(selector);
    checkFrame(`${label} speaker view ${name}`, popupSys, style);
    entry.speakerView[name] = `${style.borderStyle} ${style.borderWidth}px ${nameOf(popupSys, style.borderColor)}`;
    if (name === 'previous') check(`${label} speaker view disabled Previous is GrayText, not faded`, style.opacity === 1 && key(parse(style.color)) === key(parse(popupSys.GrayText)) && key(parse(style.borderColor)) === key(parse(popupSys.GrayText)), `opacity ${style.opacity}, ${style.color}`);
  }
  await popup.locator('footer button').nth(1).focus();
  await popup.keyboard.press('Shift+Tab');
  await popup.keyboard.press('Tab');
  const speakerNext = await view('footer button:nth-of-type(2)');
  checkRing(`${label} speaker view Next`, popupSys, speakerNext);
  const speakerRing = await ringPixels(popup, speakerNext, parse(speakerNext.outlineColor), parse(popupSys.Canvas));
  check(`${label} speaker view Next focus ring pixels`, speakerRing.ring >= speakerRing.perimeter * 0.5, `${speakerRing.ring} pixels of ${speakerNext.outlineColor}; drawn there: ${speakerRing.drawn}`);
  await popup.screenshot({path: path.join(outputDirectory, `${label.replace('/', '-')}-speaker-view.png`)});
  await popup.close();
  await page.bringToFront();
  await player.locator('.player').waitFor();
  await player.locator(hud.exit).click();
  await player.waitFor({state: 'detached'});
  const back = await page.evaluate(() => document.getElementById('d').shadowRoot.activeElement?.className);
  check(`${label} Exit returns focus to Present`, back === 'present', String(back));
  await context.close();
  report.push(entry);
};

try {
  for (const route of ['/starter.html', '/bare.html']) for (const scheme of ['light', 'dark']) await runCase({route, scheme});
  await writeFile(path.join(outputDirectory, 'report.json'), `${JSON.stringify({browser: browser.version(), emulation: 'Chromium forced-colors emulation (page.emulateMedia forcedColors: active), not the Windows contrast theme', cases: report}, null, 2)}\n`);
} finally {
  await browser.close();
  server.close();
}
const outside = requests.filter(pathname => !['/starter.html', '/bare.html', '/bundle.js', '/deck.opf.json', '/favicon.ico'].includes(pathname) && !pathname.startsWith('/opf-fonts/'));
check('no other request', outside.length === 0, outside.join(', '));
assert.deepEqual(problems, [], `forced-colors problems:\n${problems.join('\n')}`);
console.log(`forced colors (Chromium emulation, ${report.length} cases: starter and bare embed, light and dark) passed`);
