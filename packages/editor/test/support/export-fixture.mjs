// RR-98: a small host page for the export menu and the agent handoff dialog. It bundles the real modules with esbuild, serves the real CSS
// (the whole dist/styles.css, built from src/styles), and exposes `window.mountMenu(options)` / `window.openHandoff(options)` so a test passes the host callbacks (an injected
// PowerPoint exporter, onDownload, ...) as functions that run in the page. Nothing here is mocked in the modules under test.
import { build } from 'esbuild';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { buildStyles } from '../../scripts/build-styles.mjs';

const root = new URL('../../', import.meta.url);

export const deck = {
  name: 'Fixture deck',
  slides: [
    { id: 'one', title: 'Revenue grew in every region', text: 'The enterprise segment led the quarter.' },
    { id: 'two', title: 'Next steps', items: ['Hire two engineers', 'Ship the beta'] },
  ],
};

export async function startFixture({ contextOptions = { viewport: { width: 1000, height: 800 }, acceptDownloads: true }, deck: initial = deck } = {}) {
  const entry = `
    import { createExportMenu } from './src/export-menu.js';
    import { createAgentHandoffDialog } from './src/agent-handoff-dialog.js';
    window.deck = ${JSON.stringify(initial)};
    window.mountMenu = (options = {}) => { window.menu?.destroy(); window.menu = createExportMenu(document.getElementById('host'), { getDeck: () => window.deck, ...options }); return window.menu; };
    window.openHandoff = (options = {}) => { window.dialog = createAgentHandoffDialog(document.body, { document: window.deck, ...options }); return window.dialog; };
  `;
  const bundle = await build({ stdin: { contents: entry, resolveDir: fileURLToPath(root), loader: 'js' }, bundle: true, write: false, platform: 'browser', format: 'esm', logLevel: 'silent' });
  const files = {
    '/': ['text/html', `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Export fixture</title><link rel="stylesheet" href="/styles.css"><style>body{margin:0;padding:24px;font:14px system-ui}</style></head><body class="opf-ui"><button id="before">Before</button><div id="host" style="display:inline-block"></div><button id="after">After</button><script type="module" src="/fixture.js"></script></body></html>`],
    '/fixture.js': ['text/javascript', bundle.outputFiles[0].text],
    '/styles.css': ['text/css', (await buildStyles(new URL('src/styles/', root))).css],
  };
  const server = createServer((req, res) => {
    const found = files[new URL(req.url, 'http://localhost').pathname];
    if (!found) { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'Content-Type': found[0] }).end(found[1]);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ channel: process.platform === 'win32' && !process.env.CI ? 'msedge' : undefined });
  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.stack ?? error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.waitForFunction(() => typeof window.mountMenu === 'function');
  return { page, context, browser, errors, async close() { await browser.close(); server.close(); } };
}
