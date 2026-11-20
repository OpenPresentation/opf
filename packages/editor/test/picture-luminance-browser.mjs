// LH-145: the editing canvas measures the picture behind the text in the page (a canvas decode, cached) and redraws with the scrim sized for
// it: none for a dark photo under light text, still one for a light photo; `convert` (and the PPTX hand-off) gets the same sampler.
// Real Chromium; the harness is bundled from the sources, so it runs the browser entry of the renderer.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { chromium } from 'playwright';

const repo = fileURLToPath(new URL('../', import.meta.url));
const output = path.resolve(repo, process.argv[2] ?? 'artifacts/picture-luminance');
await mkdir(output, { recursive: true });
const posix = (file) => path.join(repo, file).split(path.sep).join('/');
const source = `
import { createEditorSession } from ${JSON.stringify(posix('src/index.js'))};
import { createCanvasEditor } from ${JSON.stringify(posix('src/canvas.js'))};
import { convert } from ${JSON.stringify(posix('src/export.js'))};
import { gallery as defaultCatalog } from '@openpresentation/gallery';
const photo = (rgb) => { const canvas = document.createElement('canvas'); canvas.width = 160; canvas.height = 90; const context = canvas.getContext('2d'); context.fillStyle = rgb; context.fillRect(0, 0, 160, 90); return canvas.toDataURL('image/png'); };
const deck = (rgb, variant = 'dark1') => ({ name: 'Photo cover', slides: [{ id: 'cover', title: 'A cover over a photo', subtitle: 'Subtitle', design: { variant, background: { type: 'image', src: photo(rgb) } } }] });
const mount = (document_, options = {}) => {
  const container = document.createElement('div'); container.style.width = '960px'; document.body.append(container);
  const editor = createEditorSession(document_, { rejectInvalid: true, catalogs: [defaultCatalog] });
  const canvas = createCanvasEditor(container, { editor, ...options });
  return { container, canvas, editor };
};
const scrims = (container) => container.querySelectorAll('linearGradient').length;
window.harness = { deck, mount, scrims, convert, defaultCatalog };
`;
await build({ stdin: { contents: source, resolveDir: repo, loader: 'js' }, outfile: path.join(output, 'harness.js'), bundle: true, platform: 'browser', format: 'esm', logLevel: 'error' });
const server = createServer(async (req, res) => {
  if (req.url === '/favicon.ico') { res.writeHead(204).end(); return; }
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/') { res.writeHead(200, { 'Content-Type': 'text/html' }).end('<!doctype html><meta charset="utf-8"><title>Picture luminance</title><script type="module" src="./harness.js"></script>'); return; }
  try { const body = await readFile(path.join(output, 'harness.js')); res.writeHead(200, { 'Content-Type': 'text/javascript' }).end(body); } catch { res.writeHead(404).end(); }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch({ channel: process.platform === 'win32' ? 'msedge' : undefined }), errors = [];
try {
  const page = await browser.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.waitForFunction(() => window.harness);
  const result = await page.evaluate(async () => {
    const { deck, mount, scrims, convert } = window.harness;
    const settle = async (container, wanted) => { for (let tries = 0; tries < 100 && scrims(container) !== wanted; tries++) await new Promise((resolve) => setTimeout(resolve, 50)); return scrims(container); };
    const out = {};
    // A dark photo under light text: drawn first for the worst case, redrawn without a scrim once measured.
    const dark = mount(deck('rgb(16,22,38)'));
    out.darkFirst = scrims(dark.container);
    out.darkSettled = await settle(dark.container, 0);
    // A light photo under light text keeps its scrim after measuring; dark text on it needs none.
    const light = mount(deck('rgb(232,232,222)'));
    await new Promise((resolve) => setTimeout(resolve, 600));
    out.lightSettled = scrims(light.container);
    const lightDarkText = mount(deck('rgb(232,232,222)', 'light1'));
    out.lightDarkTextSettled = await settle(lightDarkText.container, 0);
    // Off, the canvas draws the worst case; a host's own sampler wins over the meter.
    const off = mount(deck('rgb(16,22,38)'), { measurePictures: false });
    await new Promise((resolve) => setTimeout(resolve, 600));
    out.offSettled = scrims(off.container);
    const hostSampler = mount(deck('rgb(232,232,222)'), { renderOptions: { pictureLuminance: () => ({ columns: 1, rows: 1, values: [0.01], high: [0.01] }) } });
    out.hostSampler = scrims(hostSampler.container);
    // The edit that swaps the photo is measured again: the dark one becomes light and its scrim returns.
    dark.editor.applyPatch([{ op: 'replace', path: '/slides/0/design/background/src', value: window.harness.deck('rgb(232,232,222)').slides[0].design.background.src }]);
    out.swapped = await settle(dark.container, 1);
    // The export measures too: an SVG of the dark deck has no scrim, with the picture measured by the same browser decode.
    const svg = await convert(deck('rgb(16,22,38)'), { format: 'svg', catalogs: [window.harness.defaultCatalog] });
    out.exportDark = (new TextDecoder().decode(svg.files[0].bytes).match(/<linearGradient\b/g) ?? []).length;
    const svgOff = await convert(deck('rgb(16,22,38)'), { format: 'svg', catalogs: [window.harness.defaultCatalog], renderOptions: { pictureLuminance: () => undefined } });
    out.exportDarkHostWorst = (new TextDecoder().decode(svgOff.files[0].bytes).match(/<linearGradient\b/g) ?? []).length;
    return out;
  });
  assert.ok(result.darkFirst > 0, `the first draw is the worst case (${result.darkFirst})`);
  assert.equal(result.darkSettled, 0, 'a dark photo under light text loses its scrim once measured');
  assert.ok(result.lightSettled > 0, 'a light photo under light text keeps a scrim');
  assert.equal(result.lightDarkTextSettled, 0, 'a light photo under dark text needs none');
  assert.ok(result.offSettled > 0, 'measurePictures: false keeps the worst case');
  assert.ok(result.hostSampler === 0, "a host's renderOptions.pictureLuminance wins");
  assert.ok(result.swapped > 0, 'a swapped photo is measured again');
  assert.equal(result.exportDark, 0, 'convert measures the pictures');
  assert.ok(result.exportDarkHostWorst > 0, "convert honors the host's sampler");
  assert.deepEqual(errors, []);
  console.log('picture luminance browser: the canvas and convert size the scrim for the photo.');
} finally { await browser.close(); server.close(); }
