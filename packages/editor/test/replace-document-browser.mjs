import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { toYaml } from '@openpresentation/opf/yaml';
import { gallery } from '@openpresentation/gallery';
import { prepareSave } from '../dist/index.js';

// RR-98: File > Open in the playground ("Open as a presentation") is a whole-document replace: the opened file is exactly the
// document, no catalog record of the current deck is forked, and Undo restores the previous document and Redo the opened one.
const bundle = await build({ stdin: { contents: `import { createEditorSession } from './src/index.js'; import { installTransferControls } from './examples/transfer-controls.js'; import { gallery } from '@openpresentation/gallery'; globalThis.openApi = { createEditorSession, installTransferControls, gallery };`, resolveDir: process.cwd() }, bundle: true, write: false, format: 'iife', platform: 'browser' });
const html = (await readFile(new URL('../examples/playground.html', import.meta.url), 'utf8')).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<link\b[^>]*>/gi, '');
const embedded = (document) => prepareSave(document, { catalogs: [gallery] }).document;
const conference = embedded({ name: 'Conference talk', slides: [{ id: 'a1', title: 'Opening', layout: 'cover' }, { id: 'a2', title: 'Body', text: 'Alpha', layout: 'text' }] });
const tour = embedded({ name: 'Full feature tour', slides: [{ id: 'b1', title: 'Tour', layout: 'cover' }, { id: 'b2', title: 'More', text: 'Beta' }] });
tour.catalogs.default.layouts.cover.name = 'Cover, newer catalog build';
const files = {
  json: { name: 'tour.opf.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(tour, null, 2)) },
  yaml: { name: 'tour.opf.yaml', mimeType: 'text/yaml', buffer: Buffer.from(toYaml(tour).yaml) },
};
const customIds = (document) => Object.values(document.catalogs?.custom ?? {}).flatMap((records) => Object.keys(records));
const browser = await chromium.launch(process.env.OPF_BROWSER_EXECUTABLE_PATH ? { executablePath: process.env.OPF_BROWSER_EXECUTABLE_PATH } : {});
try {
  for (const [kind, file] of Object.entries(files)) {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.route('**/*', (route) => route.abort());
    await page.setContent(html);
    await page.addScriptTag({ content: bundle.outputFiles[0].text });
    await page.evaluate((start) => {
      const editor = openApi.createEditorSession(start, { catalogs: [openApi.gallery] });
      const fonts = { pending: () => [], ensure: () => Promise.resolve() };
      const ui = openApi.installTransferControls({ editor, getCanvas: () => undefined, getSlideIndex: () => 0, getSelectedPath: () => undefined, setSlideIndex: () => {}, status: () => {}, galleries: [], fonts });
      globalThis.session = { editor, ui };
    }, conference);
    await page.evaluate(() => session.ui.openImport('file'));
    await page.locator('#opf-file').setInputFiles(file);
    await page.waitForFunction(() => !document.getElementById('import-apply').disabled);
    await page.selectOption('#import-action', 'replace');
    await page.waitForFunction(() => !document.getElementById('import-apply').disabled);
    await page.click('#import-apply');
    const opened = await page.evaluate(() => ({ document: session.editor.presentation, depth: session.editor.snapshot().undoDepth, error: document.getElementById('import-error').textContent }));
    assert.equal(opened.error, '', kind);
    assert.deepEqual(customIds(opened.document), [], `${kind}: no catalog record is forked`);
    assert.ok(!/-custom/.test(JSON.stringify(opened.document)), `${kind}: no *-custom id`);
    assert.equal(opened.document.name, 'Full feature tour');
    assert.equal(opened.document.catalogs.default.layouts.cover.name, 'Cover, newer catalog build');
    assert.deepEqual(opened.document.slides.map((slide) => slide.layout), ['cover', undefined], `${kind}: references keep their ids`);
    assert.equal(opened.depth, 1, `${kind}: one undoable change`);
    const undone = await page.evaluate(() => { session.editor.undo(); return session.editor.presentation; });
    assert.deepEqual(undone, conference, `${kind}: Undo restores the previous document`);
    const redone = await page.evaluate(() => { session.editor.redo(); return session.editor.presentation; });
    assert.deepEqual(redone, opened.document, `${kind}: Redo opens it again`);
    assert.deepEqual(errors, []);
    await page.close();
  }
  console.log('Open file: a deck file replaces the document without forking catalog records; Undo and Redo are exact.');
} finally { await browser.close(); }
