// Shared by the RR-25 browser tests (find and replace, image crop, phone layout): serve the built playground
// (artifacts/playground), open it in Chromium (local Edge on Windows outside CI), load a source document through
// the Source dialog, and give the test helpers to read the document and wait for fonts.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('../../artifacts/playground/', import.meta.url));
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.ttf': 'font/ttf' };

export async function startPlayground({ source, contextOptions = { viewport: { width: 1440, height: 1000 } } } = {}) {
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname === '/favicon.ico') { res.writeHead(204).end(); return; }
      const target = path.resolve(root, '.' + decodeURIComponent(url.pathname));
      const relative = path.relative(root, target);
      if (relative.startsWith('..') || path.isAbsolute(relative)) { res.writeHead(403).end(); return; }
      res.writeHead(200, { 'Content-Type': types[path.extname(target)] ?? 'application/octet-stream' }).end(await readFile(target));
    } catch { res.writeHead(404).end(); }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ channel: process.platform === 'win32' && !process.env.CI ? 'msedge' : undefined });
  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.stack ?? error.message));
  page.on('console', (message) => { if (message.type() === 'error' && !/Failed to load resource/.test(message.text())) errors.push(message.text()); });
  const settle = () => page.waitForFunction(() => !/Loading fonts/.test(document.querySelector('#status').textContent) && !document.querySelector('#preview')?.textContent.includes('Loading fonts'), undefined, { timeout: 60000 });
  const doc = async () => JSON.parse(await page.locator('#json').inputValue());
  const waitDoc = async (predicate, message) => {
    const started = Date.now();
    for (;;) {
      const current = await doc();
      if (predicate(current)) return current;
      if (Date.now() - started > 8000) throw new Error(`${message}: ${JSON.stringify(current).slice(0, 400)}`);
      await page.waitForTimeout(40);
    }
  };
  await page.goto(`http://127.0.0.1:${server.address().port}/index.html`);
  await page.locator('#preview svg').waitFor({ timeout: 60000 });
  // Load a document the way the gallery handoff does: fill the source and click Apply.
  const load = async (deck) => {
    await page.evaluate((text) => { document.querySelector('#json').value = text; }, JSON.stringify(deck));
    await page.evaluate(() => document.querySelector('#apply-json').click());
    await page.waitForFunction((name) => document.querySelector('#document-name').value === name, deck.name ?? 'Untitled presentation', { timeout: 60000 });
    await settle();
  };
  if (source) await load(source);
  return {
    page, context, browser, server, errors, settle, doc, waitDoc, load,
    async close() { await browser.close(); server.close(); },
  };
}
