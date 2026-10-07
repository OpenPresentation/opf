// RR-55: the Review panel in a real browser, without the playground: findings grouped by category, the full check debounced (never per
// keystroke), and the optional `review` hook that brings a hosted reviewer's findings into the same list, kept per Finding.source.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { chromium } from 'playwright';

const repo = fileURLToPath(new URL('../', import.meta.url));
const output = path.resolve(repo, 'artifacts/review-hook');
await mkdir(output, { recursive: true });
const src = (file) => JSON.stringify(path.join(repo, 'src', file).replace(/\\/g, '/'));
await build({
  stdin: {
    resolveDir: repo,
    loader: 'js',
    contents: `
import { createEditorSession } from ${src('index.js')};
import { createReviewPanel } from ${src('review-panel.js')};
window.harness = { createEditorSession, createReviewPanel };`,
  },
  outfile: path.join(output, 'harness.js'), bundle: true, platform: 'browser', format: 'esm', logLevel: 'error',
});
const page = '<!doctype html><meta charset="utf-8"><title>Review hook</title><div id="panel" style="width:520px"></div><script type="module" src="./harness.js"></script>';
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/' || url.pathname === '/index.html') { res.writeHead(200, { 'Content-Type': 'text/html' }).end(page); return; }
    if (url.pathname === '/harness.js') { res.writeHead(200, { 'Content-Type': 'text/javascript' }).end(await readFile(path.join(output, 'harness.js'))); return; }
    if (url.pathname === '/favicon.ico') { res.writeHead(204).end(); return; }
    res.writeHead(404).end();
  } catch { res.writeHead(500).end(); }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

let browser;
const checks = [];
try {
  browser = await chromium.launch({ channel: process.platform === 'win32' && !process.env.CI ? 'msedge' : undefined });
  const tab = await browser.newPage({ viewport: { width: 900, height: 900 } });
  const problems = [];
  tab.on('pageerror', (error) => problems.push(error.message));
  tab.on('console', (message) => { if (message.type() === 'error') problems.push(message.text()); });
  await tab.goto(`http://127.0.0.1:${server.address().port}/`);
  await tab.waitForFunction(() => window.harness);

  // The deck: a contrast problem (accessibility), a missing title (accessibility), placeholder text (content).
  await tab.evaluate(() => {
    const deck = { name: 'Hook', language: 'en-US', design: { background: { type: 'solid', color: '#FFFFFF' } }, slides: [
      { id: 'a', title: 'Revenue', text: [{ text: 'faint', color: '#CCCCCC' }, ' and normal'] },
      { id: 'b', title: 'Second', text: 'Fine.' },
      { id: 'c', text: 'No title here' },
    ] };
    const editor = window.harness.createEditorSession(deck, { rejectInvalid: true });
    const state = { checks: 0, hookCalls: [], hook: 'ok' };
    const hosted = {
      valid: true, counts: { error: 0, warning: 1, info: 1 },
      findings: [
        { ruleId: 'pptx.dev/narrative-gap', source: 'pptx.dev/review', severity: 'warning', category: 'narrative', path: '/slides/1', message: 'Slide 2 never says what to do.', help: 'Add the ask.',
          fixes: [{ title: 'Add a call to action', patch: [{ op: 'add', path: '/slides/1/subtitle', value: 'Decide by Friday' }] }] },
        { ruleId: 'pptx.dev/audience-fit', source: 'pptx.dev/review', severity: 'info', category: 'audience-fit', path: '', message: 'Too much jargon for executives.' },
      ],
    };
    const panel = window.harness.createReviewPanel(document.getElementById('panel'), {
      editor, delay: 60,
      getValidateOptions: () => { state.checks += 1; return {}; },
      review: async (presentation, options) => {
        state.hookCalls.push({ slides: presentation.slides.length, hasSignal: options.signal instanceof AbortSignal, coreFindings: options.report?.findings.length });
        await new Promise((resolve) => setTimeout(resolve, 40));
        if (state.hook === 'fail') throw new Error('The review service is unreachable.');
        return hosted;
      },
    });
    Object.assign(window, { editor, panel, state });
  });
  const panel = tab.locator('.opf-review');
  const items = (selector = '') => panel.locator(`.opf-review-item${selector}`);

  // --- grouped by category, core's order -----------------------------------------------------------------------------------------------
  assert.equal(await tab.evaluate(() => state.checks), 1, 'mounting checks once, at once');
  const groups = await panel.locator('.opf-review-category').evaluateAll((nodes) => nodes.map((node) => [node.dataset.category, node.querySelector('h3').textContent]));
  assert.deepEqual(groups.map(([category]) => category), ['accessibility', 'content'], 'categories appear in core\'s order, only when they hold findings');
  assert.match(groups[0][1], /^Accessibility \(\d+\)$/);
  assert.equal(await items('[data-rule="opf/text-contrast"]').count(), 1);
  assert.equal(await panel.locator('.opf-review-category[data-category="accessibility"] .opf-review-item[data-rule="opf/text-contrast"]').count(), 1, 'a finding sits in its category');
  assert.equal(await panel.locator('[data-action="run-review"]').textContent(), 'Run review');
  assert.equal(await items('[data-source="pptx.dev/review"]').count(), 0, 'the hook has not run: no hosted findings yet');
  checks.push('findings are grouped by category in core\'s order');

  // --- the check is debounced: a burst of edits checks once ---------------------------------------------------------------------------------
  await tab.evaluate(() => { for (let i = 0; i < 6; i += 1) editor.set('slides.1.title', `Second ${i}`); });
  assert.equal(await tab.evaluate(() => state.checks), 1, 'nothing is checked while edits keep coming');
  await tab.waitForFunction(() => state.checks === 2);
  await tab.waitForTimeout(200);
  assert.equal(await tab.evaluate(() => state.checks), 2, 'one check for the whole burst, not six');
  checks.push('a burst of edits runs the full check once');

  // --- the hook: hosted findings join core's, keyed by source --------------------------------------------------------------------------------
  await panel.locator('[data-action="run-review"]').click();
  await tab.waitForFunction(() => document.querySelectorAll('.opf-review-item[data-source="pptx.dev/review"]').length === 2);
  const hookCall = await tab.evaluate(() => state.hookCalls[0]);
  assert.deepEqual(hookCall, { slides: 3, hasSignal: true, coreFindings: await tab.evaluate(() => panel.validation.findings.length) }, 'the hook gets the presentation, a signal and core\'s report');
  const categories = await panel.locator('.opf-review-category').evaluateAll((nodes) => nodes.map((node) => node.dataset.category));
  assert.deepEqual(categories, ['accessibility', 'content', 'narrative', 'audience-fit'], 'hosted categories follow core\'s');
  const gap = items('[data-rule="pptx.dev/narrative-gap"]');
  assert.match(await gap.locator('.opf-review-meta').textContent(), /^Slide 2 · pptx\.dev\/narrative-gap · pptx\.dev\/review$/, 'the source is named');
  assert.equal(await items('[data-source="opf"]').count(), (await tab.evaluate(() => panel.validation.findings.length)), 'core\'s findings are all still there');
  assert.equal(await tab.evaluate(() => panel.report.sources.join()), 'opf,pptx.dev/review');
  assert.match(await panel.locator('.opf-review-meta[role="status"]').textContent(), /up to date/);
  assert.equal(await panel.locator('[data-action="run-review"]').textContent(), 'Run review again');
  checks.push('the review hook\'s findings join core\'s, kept per source');

  // --- a hosted fix is one undoable edit -----------------------------------------------------------------------------------------------
  const depth = await tab.evaluate(() => editor.snapshot().undoDepth);
  await gap.getByRole('button', { name: 'Add a call to action' }).click();
  assert.equal(await tab.evaluate(() => editor.get('slides.1.subtitle')), 'Decide by Friday');
  assert.equal(await tab.evaluate(() => editor.snapshot().undoDepth), depth + 1, 'one edit');
  await tab.evaluate(() => editor.undo());
  assert.equal(await tab.evaluate(() => editor.get('slides.1.subtitle')), undefined, 'undo restores it');
  checks.push('a hosted fix applies as one undoable edit');

  // --- after an edit the hosted findings stay, marked as possibly out of date; core's follow the edit ---------------------------------------
  await tab.evaluate(() => editor.set('slides.2.title', 'Now it has a title'));
  await tab.waitForFunction(() => document.querySelectorAll('.opf-review-item[data-rule="opf/missing-slide-title"]').length === 0);
  assert.equal(await items('[data-source="pptx.dev/review"]').count(), 2, 'hosted findings stay until the next run');
  assert.match(await panel.locator('.opf-review-meta[role="status"]').textContent(), /before your latest edit/);
  checks.push('hosted findings are marked out of date after an edit, and core\'s are re-checked');

  // --- a failing hook shows its message and leaves core's findings -----------------------------------------------------------------------------
  await tab.evaluate(() => { state.hook = 'fail'; });
  await panel.locator('[data-action="run-review"]').click();
  await tab.waitForFunction(() => /could not run/.test(document.querySelector('.opf-review-meta[role="status"]').textContent));
  assert.match(await panel.locator('.opf-review-meta[role="status"]').textContent(), /The review service is unreachable\./);
  assert.ok(await items('[data-source="opf"]').count() > 0, 'core\'s findings are untouched by a failing hook');
  checks.push('a failing hook reports itself and leaves core\'s findings');

  // --- a change while the review runs drops its result ------------------------------------------------------------------------------------------
  await tab.evaluate(() => { state.hook = 'ok'; });
  await panel.locator('[data-action="run-review"]').click();
  await tab.evaluate(() => editor.set('name', 'Renamed during the review'));
  await tab.waitForTimeout(250);
  assert.doesNotMatch(await panel.locator('.opf-review-meta[role="status"]').textContent(), /Running/, 'the run was dropped, not left spinning');
  checks.push('an edit during a hosted review drops that run');

  assert.deepEqual(problems, [], 'no page errors');
  console.log(`Review hook (browser): ${checks.length} checks. ${checks.join('; ')}.`);
} finally {
  await browser?.close();
  server.close();
}
