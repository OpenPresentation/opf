import { expect, test, type Page } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { copySource, observeClipboardWrites } from './helpers/clipboard';

type WorkerRequest = { method: string; complete: boolean; failed: boolean };
declare global {
  interface Window { __opfFormatWorkerRequests: WorkerRequest[] }
}

async function observeFormattingWorker(page: Page) {
  await page.addInitScript(() => {
    const requests: WorkerRequest[] = [];
    const pending = new WeakMap<Worker, Map<string, WorkerRequest>>();
    window.__opfFormatWorkerRequests = requests;
    const postMessage = Worker.prototype.postMessage;
    Worker.prototype.postMessage = function (this: Worker, ...args: [message: unknown, options?: Transferable[] | StructuredSerializeOptions]) {
      let replies = pending.get(this);
      if (!replies) {
        replies = new Map();
        pending.set(this, replies);
        this.addEventListener('message', event => {
          const reply = event.data;
          if (reply?.type !== 1) return;
          const request = pending.get(this)?.get(String(reply.seq));
          if (request) {
            request.complete = true;
            request.failed = Boolean(reply.err);
          }
        });
      }
      const message = args[0] as { type?: number; method?: string; args?: unknown[]; req?: string | number } | null;
      // Observe Monaco 0.56's real worker RPC without intercepting its result.
      // JSON methods use $fmr; minimal text edits run on the editor worker.
      const method = message?.method === '$fmr' ? message.args?.[0] : message?.method;
      if (message?.type === 0 && typeof method === 'string' && ['format', 'doValidation', '$computeMoreMinimalEdits'].includes(method)) {
        const request = { method, complete: false, failed: false };
        requests.push(request);
        replies.set(String(message.req), request);
      }
      return Reflect.apply(postMessage, this, args);
    };
  });
}


const authored = '{\n   "name" : "Keep\\u0020authored",\n'
  + '   "extensions" : {"review":{"amount":1e2,"path":"a\\/b"}},\n'
  + '   "design":{"fontScheme":"roboto"},\n'
  + '   "slides" : [{"id":"first","title" : "First slide","notes":"Keep  notes"},\n'
  + '      {"id":"second", "title":"Second slide", "text":[{"text":"Rich  text","bold":true}]}]\n'
  + '}\n';

test('warm JSON worker leaves pasted source untouched while explicit Format Document remains undoable', async ({ page }) => {
  await observeClipboardWrites(page);
  await observeFormattingWorker(page);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/inspector');
  const input = page.getByRole('textbox', { name: 'Editor content', exact: true });
  await expect(input).toBeVisible();
  const editor = page.locator('.monaco-editor').first();
  const lines = editor.locator('.view-lines');
  const diagnostics = editor.locator('.squiggly-error, .squiggly-warning');

  // Introduce spaces with ordinary typing at a known property boundary.
  // Typing a whole JSON object can invoke bracket auto-closing, while a paste
  // would exercise the implicit formatter before this control is established.
  const starting = await copySource(page);
  const name = starting.indexOf('"name":');
  expect(name).toBeGreaterThanOrEqual(0);
  const offset = name + '"name"'.length;
  const prefix = starting.slice(0, offset);
  const line = prefix.split('\n').length;
  const column = offset - prefix.lastIndexOf('\n');
  await input.focus();
  await input.press('Control+g');
  const location = page.locator('.quick-input-widget input');
  await expect(location).toBeVisible();
  await location.fill(`:${line}:${column}`);
  await location.press('Enter');
  await page.keyboard.insertText('  ');
  const unformatted = starting.slice(0, offset) + '  ' + starting.slice(offset);
  await expect.poll(() => copySource(page)).toBe(unformatted);
  // Invoke the actual user command; a ready schema worker alone does not prove
  // that the formatter has registered or completed an edit.
  await input.focus();
  await input.press('F1');
  const command = page.locator('.quick-input-widget input');
  await expect(command).toBeVisible();
  await command.fill('>Format Document');
  await command.press('Enter');
  await expect(command).not.toBeVisible();
  // Observe the applied edit before Copy changes focus/cursor and can cancel an
  // in-flight formatter. This is a state barrier, not an arbitrary timeout.
  await expect(lines).toContainText('"name":');
  await expect.poll(() => page.evaluate(() => window.__opfFormatWorkerRequests
    .filter(request => request.method === 'format' && request.complete && !request.failed).length)).toBeGreaterThan(0);
  const formatted = await copySource(page);
  expect(formatted).not.toBe(unformatted);
  expect(JSON.parse(formatted)).toEqual(JSON.parse(unformatted));
  await input.focus();
  await input.press('ControlOrMeta+z');
  await expect.poll(() => copySource(page)).toBe(unformatted);

  // Exercise a normal model/language change after the worker is warm. Monaco
  // creates paste-format contributions lazily; a cold first paste can otherwise
  // miss their provider registration and give false source-preservation evidence.
  await page.getByRole('tab', { name: 'YAML', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'YAML', exact: true })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('tab', { name: 'JSON', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'JSON', exact: true })).toHaveAttribute('aria-selected', 'true');

  // Prime a known schema error so clearing its marker proves a fresh completed
  // validation cycle after the final paste. Keep focus and caret stationary
  // throughout that cycle: moving either can cancel the old implicit formatter.
  await input.focus();
  await input.press('ControlOrMeta+a');
  await page.evaluate(() => navigator.clipboard.writeText('{"name":42,"slides":[]}'));
  await input.press('ControlOrMeta+v');
  await expect(diagnostics).not.toHaveCount(0);
  await expect.poll(() => page.evaluate(() => window.__opfFormatWorkerRequests.filter(request => !request.complete).length)).toBe(0);
  const start = await page.evaluate(() => window.__opfFormatWorkerRequests.length);
  await input.focus();
  await input.press('ControlOrMeta+a');
  await page.evaluate(value => navigator.clipboard.writeText(value), authored);
  await input.press('ControlOrMeta+v');
  await expect.poll(() => page.evaluate(index => window.__opfFormatWorkerRequests.slice(index)
    .some(request => request.method === 'doValidation' && request.complete && !request.failed), start)).toBe(true);
  await expect(diagnostics).toHaveCount(0);
  await expect.poll(() => page.evaluate(index => window.__opfFormatWorkerRequests.slice(index)
    .filter(request => !request.complete).length, start)).toBe(0);
  const workerRequests = await page.evaluate(index => window.__opfFormatWorkerRequests.slice(index), start);
  const copied = await copySource(page);
  for (const [name, body] of [
    ['authored-source.json', authored],
    ['copied-source.json', copied],
    ['paste-worker-requests.json', JSON.stringify(workerRequests, null, 2)],
  ]) {
    const artifact = test.info().outputPath(name);
    await writeFile(artifact, body);
    await test.info().attach(name, { path: artifact, contentType: 'application/json' });
  }
  expect(JSON.parse(copied)).toEqual(JSON.parse(authored));
  expect(copied).toBe(authored);
  expect(workerRequests.filter(request => request.method === 'format')).toEqual([]);
  expect(workerRequests.some(request => request.failed)).toBe(false);
  expect(errors).toEqual([]);
});
