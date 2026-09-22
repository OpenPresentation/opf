const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { chromium, expect } = require('/private/tmp/opf-author-source-fix-20260921/pptx-dev/node_modules/@playwright/test');
const { validatePresentation } = require('/private/tmp/opf-author-source-fix-20260921/pptx-dev/node_modules/@openpresentation/opf');
const root = '/private/tmp/opf-author-local-writers-20260921';
const app = 'http://127.0.0.1:4328';
const originalDocument = { name: 'Preset undo boundary', author: 'Original author', design: { theme: 'minimal', fontScheme: 'roboto' }, slides: [{ id: 'stable-preset', title: 'Original authored title', text: [{ text: 'Keep two  spaces.', bold: true }, { text: '\nSecond rich line.', italic: true }], notes: 'Preserve these notes\n\tand spacing.' }] };
const original = JSON.stringify(originalDocument, null, 2).replace('"name": ', '"name"  :   ').replace(/\n/g, '\r\n') + '\r\n';
const importedDocument = { name: 'Explicit replacement deck', author: 'Replacement author', design: { theme: 'dark', fontScheme: 'roboto' }, slides: [{ id: 'replacement-only', title: 'Replacement title must survive', text: 'This is the imported presentation.', notes: 'Imported notes remain.' }] };
const imported = JSON.stringify(importedDocument, null, 2) + '\n';
for (const document of [originalDocument, importedDocument]) expect(validatePresentation(document).errors).toEqual([]);
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const records = [];
async function copySource(page) {
  const n = await page.evaluate(() => window.__writes.length);
  await page.getByRole('button', { name: /^(copy|copied)$/i, exact: true }).click();
  await expect.poll(() => page.evaluate(index => window.__writes[index]?.complete, n)).toBe(true);
  const result = await page.evaluate(async index => ({ submitted: window.__writes[index].text, actual: await navigator.clipboard.readText() }), n);
  expect(result.actual).toBe(result.submitted);
  return result.submitted;
}
async function saveSource(page, folder, name) { const text = await copySource(page); await fs.writeFile(path.join(folder, name + '.opf.json'), text); return text; }
(async () => {
  const browser = await chromium.launch();
  await fs.writeFile(path.join(root, 'runtime.json'), JSON.stringify({ node: process.version, browser: browser.version(), app, scenarios: ['later-human-edit', 'new-run', 'file-import'], maxAttemptsPerScenario: 1, retries: 0 }, null, 2) + '\n');
  for (const scenario of ['later-human-edit', 'new-run', 'file-import']) {
    const folder = path.join(root, scenario); await fs.mkdir(folder, { recursive: true });
    const context = await browser.newContext({ viewport: { width: 1600, height: 1100 }, permissions: ['clipboard-read', 'clipboard-write'] });
    await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
    const page = await context.newPage(); page.setDefaultTimeout(5000);
    const record = { scenario, attempt: 1, stage: 'setup', pageErrors: [], nonGetRequests: [], networkFailures: [], workflowCompleted: false };
    page.on('pageerror', error => record.pageErrors.push(error.message));
    page.on('request', request => { if (!['GET','HEAD'].includes(request.method())) record.nonGetRequests.push({ method: request.method(), url: request.url() }); });
    page.on('requestfailed', request => record.networkFailures.push({ method: request.method(), url: request.url(), failure: request.failure() }));
    await page.addInitScript(({ original }) => {
      localStorage.setItem('pptx-dev:author:local-workspace:v1', JSON.stringify({ schemaVersion: 1, updatedAt: '2026-09-21T00:00:00.000Z', format: 'json', opfDraft: original, acceptedOpfText: original, gallerySources: [], localVersions: [], ui: { centerTab: 'code', pinnedPaths: [] } }));
      window.__writes = [];
      const originalWrite = navigator.clipboard.writeText.bind(navigator.clipboard);
      navigator.clipboard.writeText = async text => { const write = { text, complete: false }; window.__writes.push(write); await originalWrite(text); write.complete = true; };
    }, { original });
    try {
      await page.goto(app + '/author');
      const input = page.getByRole('textbox', { name: 'Editor content', exact: true });
      await expect(input).toBeVisible({ timeout: 20000 });
      await expect.poll(() => copySource(page)).toBe(original);
      await fs.writeFile(path.join(folder, 'original.opf.json'), original);
      record.stage = 'preset-match';
      await page.getByRole('textbox', { name: 'Agent message', exact: true }).fill('Create a formal quarterly review for the board.');
      const presets = page.getByRole('group', { name: 'Suggested gallery presets', exact: true });
      await expect(presets).toBeVisible();
      const classic = presets.getByRole('button', { name: /^Apply Classic\./ });
      await expect(classic).toBeVisible();
      await page.screenshot({ path: path.join(folder, 'before-preset.png'), fullPage: true });
      record.presetLabel = await classic.getAttribute('aria-label');
      record.stage = 'preset-apply'; await classic.click();
      await expect.poll(async () => JSON.parse(await copySource(page)).design.theme).toBe('classic');
      const afterPreset = await saveSource(page, folder, 'after-preset');
      record.presetChangedOnlyThemeSemantically = JSON.stringify({ ...JSON.parse(afterPreset), design: originalDocument.design }) === JSON.stringify(originalDocument);
      record.presetChangedRawFormatting = afterPreset !== original.replace('"theme": "minimal"', '"theme": "classic"');
      const undo = page.getByRole('button', { name: 'undo all', exact: true });
      await expect(undo).toBeVisible();
      record.stage = scenario;
      if (scenario === 'later-human-edit') {
        const edited = afterPreset.replace('Original authored title', 'Later human title must survive');
        await input.focus(); await page.keyboard.press('ControlOrMeta+a'); await page.evaluate(text => navigator.clipboard.writeText(text), edited); await page.keyboard.press('ControlOrMeta+v');
        await expect.poll(() => copySource(page)).toBe(edited);
      } else if (scenario === 'new-run') {
        await page.getByRole('button', { name: 'New run', exact: true }).click();
        await expect.poll(async () => (await copySource(page)).includes('Original authored title')).toBe(false);
      } else {
        await page.getByRole('tablist', { name: 'Document view', exact: true }).getByRole('tab', { name: /^preview/ }).click();
        const importButton = page.getByRole('button', { name: 'Import file', exact: true });
        await expect(importButton).toBeEnabled({ timeout: 20000 });
        const chooser = page.waitForEvent('filechooser'); await importButton.click();
        await (await chooser).setFiles({ name: 'replacement.opf.json', mimeType: 'application/json', buffer: Buffer.from(imported) });
        await expect(page.getByLabel('Import preview', { exact: true })).toContainText(importedDocument.slides[0].title, { timeout: 20000 });
        await page.getByRole('button', { name: 'Open presentation', exact: true }).click();
        await expect.poll(async () => JSON.parse(await copySource(page)).slides[0].title).toBe(importedDocument.slides[0].title);
        await fs.writeFile(path.join(folder, 'imported-input.opf.json'), imported);
      }
      const beforeUndo = await saveSource(page, folder, 'before-undo-all');
      record.undoStillVisible = await undo.isVisible();
      await page.screenshot({ path: path.join(folder, 'before-undo-all.png'), fullPage: true });
      record.stage = 'undo-all'; await undo.click(); await expect(undo).toHaveCount(0);
      const afterUndo = await saveSource(page, folder, 'after-undo-all');
      await page.screenshot({ path: path.join(folder, 'after-undo-all.png'), fullPage: true });
      const before = JSON.parse(beforeUndo), after = JSON.parse(afterUndo);
      record.beforeUndo = { name: before.name, author: before.author, title: before.slides[0]?.title, slideIds: before.slides.map(slide => slide.id), sourceSha256: hash(beforeUndo) };
      record.afterUndo = { name: after.name, author: after.author, title: after.slides[0]?.title, slideIds: after.slides.map(slide => slide.id), sourceSha256: hash(afterUndo) };
      record.restoredEntireOriginalSemantics = JSON.stringify(after) === JSON.stringify(originalDocument);
      record.preservesLaterDocumentContent = before.slides[0]?.title === after.slides[0]?.title && before.name === after.name;
      record.workflowCompleted = true; record.stage = 'completed';
      expect(record.nonGetRequests).toEqual([]);
    } catch (error) { record.error = error.stack || String(error); }
    finally {
      record.finalUrl = page.url();
      await fs.writeFile(path.join(folder, 'final-accessibility.txt'), await page.locator('body').ariaSnapshot().catch(error => String(error)));
      await page.screenshot({ path: path.join(folder, 'final.png'), fullPage: true }).catch(() => {});
      await context.tracing.stop({ path: path.join(folder, 'trace.zip') });
      await fs.writeFile(path.join(folder, 'result.json'), JSON.stringify(record, null, 2) + '\n'); records.push(record);
      await context.close();
    }
  }
  await browser.close(); await fs.writeFile(path.join(root, 'results.json'), JSON.stringify(records, null, 2) + '\n');
  console.log(JSON.stringify(records, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; });
