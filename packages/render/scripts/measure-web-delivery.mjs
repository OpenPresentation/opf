// RR-59: production (minified, split ESM, HTTP gzip) delivery and no-JS font fidelity.
// Run after npm run build: node scripts/measure-web-delivery.mjs [output-directory]
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {gzipSync} from 'node:zlib';
import {build} from 'esbuild';
import {chromium} from 'playwright';
import {loadFonts} from '../dist/fonts-node.js';
import {renderDeckHtml} from '../dist/element.js';
import {renderSvg} from '../dist/svg.js';
import {copyPreviewFonts} from '../dist/preview-fonts-node.js';
import {embed} from '@openpresentation/opf';
import {defaultCatalog} from '@openpresentation/opf/catalog';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.resolve(root, process.argv[2] ?? 'artifacts/web-delivery');
await mkdir(output, {recursive: true});
// OPF 0.15: the deck embeds the font scheme it names (core embed), so the server markup and the browser upgrade resolve
// the same records with no host catalog registered on either side.
const deck = embed({name: 'Measured delivery', design: {fontScheme: 'roboto'}, slides: [
  {title: 'First slide', text: 'Exact measured text'},
  {title: 'Second slide', text: 'Exact measured text'},
  {title: 'Third slide', text: 'Exact measured text'},
]}, {catalogs: [defaultCatalog]}).document;
const fonts = await loadFonts({pack: 'office'});
const payloads = {};
for (const pack of ['base', 'office']) {
  const handle = pack === 'office' ? fonts : await loadFonts({pack});
  const svg = renderSvg(deck, {fonts: handle})[0];
  payloads[pack] = {svgBytes: Buffer.byteLength(svg), svgGzipBytes: gzipSync(svg).length, fontRules: (svg.match(/@font-face/g) ?? []).length};
}
const entries = {
  immediate: `import {defineOpfDeck} from '${path.join(root, 'dist/element.js')}'; defineOpfDeck();`,
  deferred: `document.querySelector('#upgrade').addEventListener('click', async event => { event.currentTarget.disabled = true; const {defineOpfDeck} = await import('${path.join(root, 'dist/element.js')}'); defineOpfDeck(); await document.querySelector('opf-deck').ready; event.target.hidden = true; });`,
};
for (const [name, contents] of Object.entries(entries)) await writeFile(path.join(output, `${name}.js`), contents);
const built = await build({entryPoints: ['immediate', 'deferred'].map(name => path.join(output, `${name}.js`)), bundle: true, minify: true, splitting: true, format: 'esm', platform: 'browser', outdir: path.join(output, 'bundle'), metafile: true});
assert.ok(!Object.keys(built.metafile.inputs).some(input => /sharp|resvg|fonts-node|raster\.js/.test(input)));
copyPreviewFonts({outDir: path.join(output, 'opf-fonts')});
const html = mode => renderDeckHtml(deck, {slides: 'all', fonts, fontMode: mode, embed: true, attributes: {id: 'deck', fonts: '/opf-fonts/'}});
const shell = body => `<!doctype html><html lang="en"><meta charset="utf-8"><title>Delivery</title><style>body{margin:0}opf-deck{display:block;width:960px}figure svg{width:960px}opf-deck::part(viewport){border:0;border-radius:0}</style><body>${body}</body></html>`;
const pages = {
  '/standalone': shell(html('standalone')),
  '/shared': shell(html('shared')),
  '/external': shell(`<link rel="stylesheet" href="/ssr-fonts.css">${html('external')}`),
  '/immediate': shell(`${html('shared')}<script type="module" src="/bundle/immediate.js"></script>`),
  '/deferred': shell(`${html('shared')}<button id="upgrade" type="button">Enable slide controls</button><script type="module" src="/bundle/deferred.js"></script>`),
};
const used = fonts.embeddedFonts.filter(face => face.family === 'Roboto' && [400, 700].includes(face.weight) && !face.italic);
const css = used.map(face => `@font-face{font-family:"${face.family}";font-weight:${face.weight};font-style:normal;src:url("/ssr-font-${face.weight}.ttf")}`).join('\n');
const served = [];
const server = http.createServer(async (request, response) => {
  const pathname = new URL(request.url, 'http://local').pathname;
  try {
    let body, type;
    if (pages[pathname]) { body = Buffer.from(pages[pathname]); type = 'text/html'; }
    else if (pathname === '/ssr-fonts.css') { body = Buffer.from(css); type = 'text/css'; }
    else if (/^\/ssr-font-\d+.ttf$/.test(pathname)) { body = Buffer.from(used.find(face => pathname === `/ssr-font-${face.weight}.ttf`).dataUrl.split(',')[1], 'base64'); type = 'font/ttf'; }
    else if (pathname.startsWith('/bundle/') || pathname.startsWith('/opf-fonts/')) {
      const file = path.resolve(output, '.' + pathname);
      assert.ok(file.startsWith(output + path.sep));
      body = await readFile(file); type = file.endsWith('.js') ? 'text/javascript' : 'font/ttf';
    } else { response.writeHead(404); response.end(); return; }
    const encoded = gzipSync(body);
    served.push({path: pathname, bytes: body.length, gzipBytes: encoded.length});
    response.writeHead(200, {'content-type': type, 'content-encoding': 'gzip', 'content-length': encoded.length, 'cache-control': 'no-store'});
    response.end(encoded);
  } catch { response.writeHead(404); response.end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
const report = {boundary: 'Local candidate, esbuild production minified split ESM, Chromium, HTTP gzip. Bytes separate JavaScript, external fonts and HTML (including inline font data). No native Office or published-artifact claim.', payloads, modes: {}};
const errors = [];
try {
  let reference, firstSlide;
  for (const mode of ['standalone', 'shared', 'external']) {
    const context = await browser.newContext({javaScriptEnabled: false, viewport: {width: 960, height: 1800}});
    const page = await context.newPage();
    page.on('request', request => assert.ok(request.url().startsWith(origin), 'all inputs are local'));
    const start = served.length;
    await page.goto(`${origin}/${mode}`);
    await page.evaluate(() => document.fonts.ready);
    assert.equal(await page.locator('figure svg').count(), 3);
    const screenshot = await page.screenshot();
    if (reference) assert.deepEqual(screenshot, reference, `${mode}: no-JS pixels equal standalone measured fonts`);
    else { reference = screenshot; firstSlide = await page.locator('figure svg').first().screenshot(); }
    const fetched = served.slice(start);
    report.modes[mode] = {htmlGzipBytes: fetched.find(item => item.path === `/${mode}`).gzipBytes, jsGzipBytes: 0, fontRequests: fetched.filter(item => /\.ttf$/.test(item.path)), noJavaScriptPixelMatch: true};
    await context.close();
  }
  // A standalone SVG must also paint when carried away from the page and every HTTP resource is unavailable.
  const offlineContext = await browser.newContext({javaScriptEnabled: false, viewport: {width: 960, height: 900}});
  await offlineContext.setOffline(true);
  const offline = await offlineContext.newPage();
  const svgUrl = `data:image/svg+xml;base64,${Buffer.from(renderSvg(deck, {fonts})[0]).toString('base64')}`;
  await offline.setContent(shell(`<img style="display:block;width:960px" src="${svgUrl}" alt="Offline slide">`));
  assert.deepEqual(await offline.locator('img').screenshot(), firstSlide, 'standalone image paints the same fonts with HTTP unavailable');
  report.offlineStandalonePixelMatch = true;
  await offlineContext.close();
  for (const mode of ['immediate', 'deferred']) {
    const context = await browser.newContext({viewport: {width: 960, height: 1800}});
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => assert.ok(request.url().startsWith(origin), 'all inputs are local'));
    const start = served.length;
    await page.goto(`${origin}/${mode}`);
    if (mode === 'deferred') {
      assert.equal(await page.evaluate(() => Boolean(document.querySelector('opf-deck').shadowRoot)), false);
      const before = served.slice(start);
      assert.equal(before.filter(item => /\.ttf$/.test(item.path)).length, 0);
      report.modes.deferredBeforeUpgrade = {htmlGzipBytes: before.find(item => item.path === '/deferred').gzipBytes, jsGzipBytes: before.filter(item => /\.js$/.test(item.path)).reduce((sum, item) => sum + item.gzipBytes, 0), fontRequests: []};
      assert.ok(report.modes.deferredBeforeUpgrade.jsGzipBytes < 1024, 'the deferred entry must stay a small bootstrap');
      await page.locator('#upgrade').click();
    }
    await page.waitForFunction(() => document.querySelector('opf-deck').shadowRoot?.querySelector('.slide svg'));
    await page.evaluate(() => document.querySelector('opf-deck').ready);
    assert.deepEqual(await page.locator('opf-deck .slide svg').screenshot(), firstSlide, 'strict interactive upgrade paints the same measured slide');
    const fetched = served.slice(start);
    report.modes[mode] = {htmlGzipBytes: fetched.find(item => item.path === `/${mode}`).gzipBytes, jsGzipBytes: fetched.filter(item => /\.js$/.test(item.path)).reduce((sum, item) => sum + item.gzipBytes, 0), fontRequests: fetched.filter(item => /\.ttf$/.test(item.path)), jsRequests: fetched.filter(item => /\.js$/.test(item.path)), measuredUpgradePixelMatch: true};
    assert.equal(report.modes[mode].fontRequests.length, 2, 'Roboto startup regular plus the drawn bold face, no unrelated font fetches');
    assert.ok(report.modes[mode].fontRequests.every(item => item.path.includes('/roboto/')));
    await context.close();
  }
  assert.deepEqual(errors, []);
  await writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
