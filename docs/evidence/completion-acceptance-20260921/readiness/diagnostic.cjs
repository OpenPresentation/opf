const { createRequire } = require('node:module');
const { writeFile } = require('node:fs/promises');
const path = require('node:path');
const requireApp = createRequire('/private/tmp/opf-issue88-explicit-formatting-20260921/pptx-dev/package.json');
const { chromium } = requireApp('@playwright/test');
const root = __dirname;

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 540, height: 960 }, permissions: ['clipboard-read', 'clipboard-write'] });
  await context.tracing.start({ screenshots: true, snapshots: true, sources: false });
  await context.addInitScript(() => {
    const events = [], longTasks = [], ids = new WeakMap();
    window.__opfReadiness = { origin: performance.timeOrigin, events, longTasks };
    const record = (type, details) => events.push({ time: performance.now(), type, details });
    const NativeWorker = window.Worker;
    let nextId = 0;
    window.Worker = new Proxy(NativeWorker, {
      construct(target, args, newTarget) {
        const worker = Reflect.construct(target, args, newTarget);
        const id = ++nextId; ids.set(worker, id);
        record('worker-created', { id, url: String(args[0]), options: args[1] });
        worker.addEventListener('message', event => {
          const data = event.data;
          record('worker-reply', { id, type: data?.type, seq: data?.seq, method: data?.method, error: data?.err ? String(data.err) : undefined });
        });
        worker.addEventListener('error', event => record('worker-error', { id, message: event.message }));
        return worker;
      },
    });
    const postMessage = NativeWorker.prototype.postMessage;
    NativeWorker.prototype.postMessage = function (...args) {
      const message = args[0];
      record('worker-request', { id: ids.get(this), type: message?.type, req: message?.req, method: message?.method,
        nestedMethod: message?.method === '$fmr' ? message.args?.[0] : undefined });
      return Reflect.apply(postMessage, this, args);
    };
    new PerformanceObserver(list => longTasks.push(...list.getEntries().map(entry => entry.toJSON()))).observe({ type: 'longtask', buffered: true });
    let previous;
    setInterval(() => {
      const state = {
        editor: Boolean(document.querySelector('.monaco-editor')),
        markers: document.querySelectorAll('.squiggly-error, .squiggly-warning').length,
        canvases: document.querySelectorAll('[data-testid="inspector-canvas-overlay"] svg').length,
        renderer: document.querySelectorAll('[data-opf-renderer] svg').length,
        loadingInspector: document.body?.innerText.includes('Loading Inspector…'),
        loadingFonts: document.body?.innerText.includes('Loading slide fonts'),
        suggest: document.querySelector('.suggest-widget')?.className,
      };
      const key = JSON.stringify(state);
      if (key !== previous) { record('ui-state', state); previous = key; }
    }, 100);
  });
  const page = await context.newPage();
  const requests = [], errors = [], consoleMessages = [], workers = [];
  const requestIds = new WeakMap();
  const pendingHeaders = [];
  page.on('request', request => {
    const record = { id: requests.length, observedAt: Date.now(), url: request.url(), method: request.method(), resourceType: request.resourceType() };
    requestIds.set(request, record); requests.push(record);
  });
  page.on('response', response => {
    const record = requestIds.get(response.request());
    if (!record) return;
    record.responseObservedAt = Date.now(); record.status = response.status();
    pendingHeaders.push(response.allHeaders().then(headers => {
      record.headers = Object.fromEntries(Object.entries(headers).filter(([key]) => ['cache-control', 'age', 'x-vercel-cache', 'content-length', 'content-encoding', 'content-type', 'date'].includes(key)));
    }));
  });
  page.on('requestfinished', request => { const record = requestIds.get(request); if (record) { record.finishedAt = Date.now(); record.timing = request.timing(); } });
  page.on('requestfailed', request => { const record = requestIds.get(request); if (record) { record.failedAt = Date.now(); record.failure = request.failure()?.errorText; record.timing = request.timing(); } });
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => consoleMessages.push({ time: Date.now(), type: message.type(), text: message.text().slice(0, 1000) }));
  page.on('worker', worker => workers.push(worker));
  const phases = [];
  const phase = (name, details = {}) => { const value = { name, at: Date.now(), ...details }; phases.push(value); console.log(JSON.stringify(value)); };
  async function observeUntil(name, fn, timeout = 30000) {
    const started = Date.now();
    try { await page.waitForFunction(fn, null, { timeout }); phase(name, { elapsedMs: Date.now() - started, observed: true }); }
    catch (error) { phase(name, { elapsedMs: Date.now() - started, observed: false, error: error.message.split('\n')[0] }); }
  }
  phase('navigation-start');
  await page.goto('https://www.pptx.dev/inspector');
  phase('load-event');
  const input = page.getByRole('textbox', { name: 'Editor content', exact: true });
  await input.waitFor({ state: 'visible', timeout: 30000 });
  phase('editor-visible');
  await input.focus(); await input.press('ControlOrMeta+a');
  await page.evaluate(() => navigator.clipboard.writeText('{"name":42,"slides":[]}'));
  await input.press('ControlOrMeta+v'); phase('invalid-source-pasted');
  await observeUntil('schema-markers-observed', () => document.querySelectorAll('.squiggly-error, .squiggly-warning').length > 0);
  const source = '{\n  "name"  : "Readiness probe",\n  "design":{"theme":"minimal","fontScheme":"roboto"},\n  "slides":[{"id":"probe","title":"Ready"}]\n}\n';
  await input.focus(); await input.press('ControlOrMeta+a');
  await page.evaluate(value => navigator.clipboard.writeText(value), source);
  await input.press('ControlOrMeta+v'); phase('valid-source-pasted');
  await observeUntil('markers-cleared', () => document.querySelectorAll('.squiggly-error, .squiggly-warning').length === 0);
  await input.focus(); await input.press('F1');
  const command = page.locator('.quick-input-widget input');
  await command.waitFor({ state: 'visible' }); await command.fill('>Format Document'); await command.press('Enter');
  phase('format-command-submitted');
  await observeUntil('format-rpc-replied', () => {
    const events = window.__opfReadiness.events;
    return events.some(request => request.type === 'worker-request' && request.details.nestedMethod === 'format'
      && events.some(reply => reply.type === 'worker-reply' && reply.details.id === request.details.id && String(reply.details.seq) === String(request.details.req)));
  });
  await observeUntil('canvas-ready', () => document.querySelectorAll('[data-testid="inspector-canvas-overlay"] svg').length === 1);
  await page.screenshot({ path: path.join(root, 'diagnostic-final.png'), fullPage: true });
  const observation = await page.evaluate(() => ({ ...window.__opfReadiness, resources: performance.getEntriesByType('resource').map(entry => entry.toJSON()), navigation: performance.getEntriesByType('navigation').map(entry => entry.toJSON()) }));
  const workerResources = [];
  for (const worker of workers) {
    try { workerResources.push({ url: worker.url(), ...await worker.evaluate(() => ({ origin: performance.timeOrigin, resources: performance.getEntriesByType('resource').map(entry => entry.toJSON()) })) }); }
    catch (error) { workerResources.push({ url: worker.url(), error: error.message }); }
  }
  await Promise.allSettled(pendingHeaders);
  await writeFile(path.join(root, 'diagnostic.json'), JSON.stringify({ startedAt: phases[0].at, version: browser.version(), phases, errors, consoleMessages, requests, observation, workerResources }, null, 2));
  await context.tracing.stop({ path: path.join(root, 'diagnostic-trace.zip') });
  await browser.close();
  console.log('Diagnostic completed; this is observational evidence, not acceptance.');
})().catch(error => { console.error(error); process.exitCode = 1; });
