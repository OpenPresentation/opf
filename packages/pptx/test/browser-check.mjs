import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('../', import.meta.url));
const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation' };
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (pathname === '/favicon.ico') { response.writeHead(204).end(); return; }
    const target = path.resolve(root, '.' + pathname);
    const relative = path.relative(root, target);
    if (relative.startsWith('..') || path.isAbsolute(relative)) { response.writeHead(403).end(); return; }
    const bytes = await readFile(target);
    response.writeHead(200, { 'Content-Type': types[path.extname(target)] ?? 'application/octet-stream' }).end(bytes);
  } catch {
    response.writeHead(404).end();
  }
});
await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
let browser;
try {
  browser = await chromium.launch({ channel: process.platform === 'win32' && !process.env.CI ? 'msedge' : undefined });
  const report = [];
  for (const suite of ['webp-fallback', 'native-rich-table-import', 'native-table-styles', 'native-styled-table-import', 'native-content-layout']) {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    const response = await page.goto(`http://127.0.0.1:${server.address().port}/artifacts/${suite}/browser/index.html`);
    assert.equal(response.status(), 200);
    await page.waitForFunction(() => /^(PASS|FAIL):/.test(document.title), undefined, { timeout: 60000 });
    const result = await page.locator('pre').innerText();
    assert.match(await page.title(), /^PASS:/, result);
    assert.deepEqual(errors, [], `${suite}: browser errors`);
    const parsed = JSON.parse(result);
    assert.equal(parsed.passed, true);
    report.push({ suite, ...parsed });
    await page.close();
  }
  console.log(JSON.stringify({ browser: browser.version(), suites: report }, null, 2));
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
