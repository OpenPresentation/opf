// RR-20: the packed package bundles for the browser and exports there the same bytes as in Node.
// opf-pptx 0.13.0 failed in browser bundlers whenever the consumer's tree held readable-stream (opf-editor#94: its
// packed consumer installs jszip 3, which brings readable-stream 2): @node-projects/jszip's lib/support.js probes
// require("readable-stream") inside try/catch, esbuild follows it and then cannot resolve "events" and "buffer".
// This installs the packed tarball next to jszip 3.10.2 (so readable-stream 2 is resolvable, as in that consumer),
// bundles it with esbuild for the browser, then exports the core examples in Chromium and in Node from the same
// installed package and requires identical PPTX bytes.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdtemp, mkdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('../', import.meta.url));
// npm_execpath is set under `npm run`; scripts/quarantine.mjs runs the command directly, so fall back to the npm that
// ships with this Node.
const npmCli = process.env.npm_execpath?.endsWith('npm-cli.js') ? process.env.npm_execpath
  : [path.join(path.dirname(process.execPath), '../lib/node_modules/npm/bin/npm-cli.js'), path.join(path.dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js')].find(existsSync);
assert.ok(npmCli, 'npm-cli.js not found; run through npm run test:browser.');
const npm = (args, cwd) => execFileSync(process.execPath, [npmCli, ...args], { cwd, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
const temporary = await realpath(await mkdtemp(path.join(tmpdir(), 'opf-pptx-bundle-')));
let browser, server;
try {
  const packed = JSON.parse(npm(['pack', '--json', '--pack-destination', temporary], root))[0];
  const consumer = path.join(temporary, 'consumer');
  await mkdir(consumer);
  await writeFile(path.join(consumer, 'package.json'), JSON.stringify({ private: true, type: 'module' }));
  npm(['install', '--ignore-scripts', '--no-audit', '--no-fund', path.join(temporary, packed.filename), 'jszip@3.10.2'], consumer);
  assert.ok(existsSync(path.join(consumer, 'node_modules/readable-stream/package.json')), 'the consumer must hold readable-stream for this check to mean anything');

  await writeFile(path.join(consumer, 'entry.js'), `import {toPptx, fromPptx} from '@openpresentation/opf-pptx';
const hex = async bytes => [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(b => b.toString(16).padStart(2, '0')).join('');
window.exportDecks = async (items, imageBase64) => {
  const image = Uint8Array.from(atob(imageBase64), c => c.charCodeAt(0));
  const out = {};
  for (const {name, deck, options} of items) out[name] = await hex(await toPptx(deck, {...options, imageResolver: async () => image}));
  return out;
};
window.roundTrip = async deck => (await fromPptx(await toPptx(deck))).slides.length;
document.title = 'READY';
`);
  const result = await build({ absWorkingDir: consumer, entryPoints: ['entry.js'], bundle: true, platform: 'browser', format: 'esm', outfile: path.join(consumer, 'page/bundle.js'), metafile: true, logLevel: 'silent' });
  const inputs = Object.keys(result.metafile.inputs).map(input => input.replaceAll('\\', '/'));
  for (const forbidden of ['node_modules/readable-stream/', 'node_modules/core-util-is/', 'node_modules/safe-buffer/', 'node_modules/@node-projects/jszip/lib/', 'node_modules/sharp/', 'image-fallback-node'])
    assert.ok(!inputs.some(input => input.includes(forbidden)), `browser bundle must not contain ${forbidden}`);
  assert.ok(inputs.some(input => input.endsWith('node_modules/@openpresentation/opf-pptx/vendor/jszip/index-min.js')), 'browser bundle uses the vendored JSZip bundle');
  await writeFile(path.join(consumer, 'page/index.html'), '<!doctype html><meta charset="utf-8"><title>loading</title><script type="module" src="./bundle.js"></script>');

  const consumerRequire = specifier => import(pathToFileURL(path.join(consumer, 'node_modules', specifier)).href);
  const { toPptx } = await import(pathToFileURL(path.join(consumer, 'node_modules/@openpresentation/opf-pptx/dist/index.js')).href);
  const { examples } = await consumerRequire('@openpresentation/opf/dist/examples.js');
  const image = await readFile(path.join(root, 'test/fixtures/images/wide.png'));
  const options = { seed: 1, timestamp: '2026-01-01T00:00:00Z', zipDate: '2026-01-01T00:00:00Z' };
  const items = examples.map(({ file, deck }) => ({ name: file, deck, options }));
  assert.ok(items.length >= 100, `expected the core examples, found ${items.length}`);
  const node = {};
  for (const { name, deck } of items) node[name] = createHash('sha256').update(await toPptx(structuredClone(deck), { ...options, imageResolver: async () => new Uint8Array(image) })).digest('hex');

  server = createServer(async (request, response) => {
    const file = path.join(consumer, 'page', path.basename(new URL(request.url, 'http://localhost').pathname) || 'index.html');
    try { response.writeHead(200, { 'Content-Type': file.endsWith('.js') ? 'text/javascript' : 'text/html' }).end(await readFile(file)); }
    catch { response.writeHead(404).end(); }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  browser = await chromium.launch({ channel: process.platform === 'win32' && !process.env.CI ? 'msedge' : undefined });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto(`http://127.0.0.1:${server.address().port}/index.html`);
  await page.waitForFunction(() => document.title === 'READY', undefined, { timeout: 60000 });
  const web = {};
  for (let index = 0; index < items.length; index += 25)
    Object.assign(web, await page.evaluate(([chunk, png]) => window.exportDecks(chunk, png), [items.slice(index, index + 25), image.toString('base64')]));
  assert.equal(await page.evaluate(deck => window.roundTrip(deck), { name: 'Round trip', slides: [{ title: 'One' }, { title: 'Two', table: { columns: ['A', 'B'], rows: [['1', '2']] } }] }), 2);
  assert.deepEqual(errors, [], 'browser errors');
  const differing = items.map(item => item.name).filter(name => web[name] !== node[name]);
  assert.deepEqual(differing, [], 'browser and Node exports must be byte-identical');
  console.log(`Packed browser bundle passed: esbuild platform browser with readable-stream in the tree, vendored JSZip bundle, no Node built-ins; ${items.length} core examples exported in ${browser.version()} byte-identical to Node.`);
} finally {
  await browser?.close();
  if (server) await new Promise(resolve => server.close(resolve));
  assert.ok(path.basename(temporary).startsWith('opf-pptx-bundle-'));
  await rm(temporary, { recursive: true, force: true });
}
