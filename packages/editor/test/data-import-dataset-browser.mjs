import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

// RR-54: the playground's Import data dialog stores data as a shared dataset ("Store as a shared dataset"): the dataset id starts as the first
// one the deck does not hold (a second import does not replace the first), an invalid id is explained, and the dataset and the slide that shows
// it are one undo step. The dialog is bundled straight from examples/ with a stub page; OPF_CORE_DIST names a built core `dist` to bundle.
const root = fileURLToPath(new URL('../', import.meta.url));
const out = path.join(root, 'artifacts', 'data-import-dataset');
await mkdir(out, { recursive: true });
const coreDist = process.env.OPF_CORE_DIST ? path.resolve(process.env.OPF_CORE_DIST) : undefined;
await build({
  stdin: { contents: `import { createEditorSession } from './src/index.js';\nimport { installDataControls } from './examples/data-controls.js';\nwindow.opfTest = { createEditorSession, installDataControls };\n`, resolveDir: root, sourcefile: 'entry.js' },
  outfile: path.join(out, 'bundle.js'),
  bundle: true,
  format: 'iife',
  platform: 'browser',
  logLevel: 'error',
  plugins: coreDist ? [{
    name: 'local-core',
    setup(b) {
      b.onResolve({ filter: /^@openpresentation\/opf(\/.*)?$/ }, (args) => {
        const sub = args.path.slice('@openpresentation/opf'.length).replace(/^\//, '');
        return { path: path.join(coreDist, sub ? `${sub}.js` : 'index.js') };
      });
    },
  }] : [],
});
await writeFile(path.join(out, 'index.html'), '<!doctype html><html lang="en"><meta charset="utf-8"><title>Import data</title><div class="header-actions"></div><script src="bundle.js"></script></html>');

const deck = { name: 'Import', design: { theme: 'minimal', fontScheme: 'aptos' }, slides: [{ id: 's', title: 'One', blocks: [{ text: 'Hello' }] }] };
let browser;
try {
  browser = await chromium.launch({ channel: process.platform === 'win32' && !process.env.CI ? 'msedge' : undefined });
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.stack ?? error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto(pathToFileURL(path.join(out, 'index.html')).href);
  await page.evaluate((source) => {
    const editor = window.opfTest.createEditorSession(source, { rejectInvalid: true });
    window.editor = editor;
    window.slide = 0;
    window.opfTest.installDataControls({ editor, getCanvas: () => undefined, getSlideIndex: () => window.slide, getSelectedPath: () => `slides.${window.slide}`, setSlideIndex: (index) => { window.slide = index; }, status: () => {}, renderOptions: {} });
  }, deck);
  const imports = (csv) => page.evaluate(async (text) => {
    document.getElementById('import-data').click();
    const area = document.getElementById('data-text');
    area.value = text;
    area.dispatchEvent(new Event('input'));
    return { id: document.getElementById('data-dataset-id').value };
  }, csv);
  const datasets = () => page.evaluate(() => window.editor.document.datasets);
  const depth = () => page.evaluate(() => window.editor.snapshot().undoDepth);

  await imports('Quarter,Revenue\nQ1,12\nQ2,18');
  await page.locator('#data-dataset').check();
  await page.locator('#data-as').selectOption('chart');
  assert.equal(await page.locator('#data-dataset-id').inputValue(), 'data', 'the first dataset is called data');
  await page.waitForFunction(() => !document.getElementById('data-apply').disabled);
  await page.locator('#data-apply').click();
  assert.deepEqual((await datasets()).data.rows, [['Q1', 12], ['Q2', 18]]);
  assert.equal(await depth(), 1, 'the dataset and the slide are one undo step');
  assert.deepEqual(await page.evaluate(() => window.editor.document.slides[1].chart.data), { dataset: 'data' });

  // A second import takes the next free id instead of replacing the first dataset.
  await imports('Region,Share\nEMEA,0.4\nAPAC,0.6');
  assert.equal(await page.locator('#data-dataset-id').inputValue(), 'data-2');
  await page.waitForFunction(() => !document.getElementById('data-apply').disabled);
  await page.locator('#data-apply').click();
  const after = await datasets();
  assert.deepEqual(Object.keys(after), ['data', 'data-2']);
  assert.deepEqual(after.data.rows, [['Q1', 12], ['Q2', 18]], 'the first dataset is untouched');
  assert.equal(await depth(), 2);

  // An invalid id is explained and nothing is imported.
  await imports('A,B\n1,2');
  await page.locator('#data-dataset-id').fill('not valid!');
  await page.waitForFunction(() => document.getElementById('data-error').textContent.length > 0);
  assert.match(await page.locator('#data-error').innerText(), /dataset id/i);
  assert.equal(await page.locator('#data-apply').isDisabled(), true);
  // An id typed on purpose that names an existing dataset says its rows are replaced.
  await page.locator('#data-dataset-id').fill('data');
  await page.waitForFunction(() => /exists/.test(document.getElementById('data-dataset-note').textContent));
  assert.deepEqual(errors, []);
  console.log('Import data (RR-54): store as a shared dataset takes a free id, explains an invalid one and is one undo step, in a real browser.');
} finally {
  await browser?.close();
}
