import { expect, test, type Page } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import JSZip from 'jszip';
import manifest from '../../package.json';
import type { Presentation } from '@openpresentation/opf';

const deck = {
  name: 'Anonymous Author workflow',
  design: { theme: 'classic', fontScheme: 'roboto' },
  slides: [{ title: 'A measured decision', composition: { mode: 'row', weights: [2, 1] }, blocks: [
    { text: 'Keep the evidence editable.' },
    { table: { columns: ['Decision', 'Owner'], rows: [[{ value: 'Shared ownership', colSpan: 2 }, null], ['Review', 'Team']] } },
  ] }],
};

async function download(page: Page, format: 'JSON' | 'YAML' | 'MD' | 'PPTX') {
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  const pending = page.waitForEvent('download');
  await page.getByRole('menuitem', { name: new RegExp(`^${format} `) }).click();
  const file = await pending;
  expect(await file.failure()).toBeNull();
  return { name: file.suggestedFilename(), bytes: await readFile((await file.path())!) };
}
async function source(page: Page) { return JSON.parse((await download(page, 'JSON')).bytes.toString('utf8')); }

for (const dimensions of [{width:1280,height:720},{width:540,height:960}]) test(`anonymous code editing preserves source and visible selection through offline export/reimport at ${dimensions.width}x${dimensions.height}`, async ({page}) => {
  await page.setViewportSize(dimensions);
  const {fromPptx}=await import('@openpresentation/opf-pptx');const {validatePresentation}=await import('@openpresentation/opf');
  const original={design:{fontScheme:'roboto',dimensions:{widthInches:dimensions.width/96,heightInches:dimensions.height/96}},slides:[{code:{source:'\tconst value = "two  spaces";  \r\n\r\nreturn value;\r\n',filename:'src/Example.ts',language:'TypeScript'}}]};
  expect(validatePresentation(original).valid).toBe(true);
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));await page.goto('/author');
  const input=page.getByRole('textbox',{name:'Editor content'});await expect(input).toBeVisible();
  await input.focus();await page.keyboard.press('ControlOrMeta+a');await page.evaluate(text=>navigator.clipboard.writeText(text),'{"name":42,"slides":[]}');await page.keyboard.press('ControlOrMeta+v');
  await expect(page.locator('.monaco-editor .squiggly-error, .monaco-editor .squiggly-warning')).not.toHaveCount(0);
  await input.focus();await page.keyboard.press('ControlOrMeta+a');await page.evaluate(text=>navigator.clipboard.writeText(text),JSON.stringify(original,null,2));await page.keyboard.press('ControlOrMeta+v');await expect.poll(()=>source(page)).toEqual(original);
  await page.getByRole('tablist',{name:'Document view'}).getByRole('tab',{name:/^preview/}).click();
  const canvas=page.locator(`[data-opf-editor="${manifest.dependencies['@openpresentation/opf-editor']}"]`);await expect(canvas.getByRole('button',{name:'Import file',exact:true})).toBeEnabled();await expect(canvas).toContainText('src/Example.ts');
  const writes:string[]=[];page.on('request',request=>{if(request.method()==='POST')writes.push(request.url());});await page.context().setOffline(true);
  const target=canvas.locator('[data-canvas-target][data-opf-path="slides.0.code.source"]');await target.dblclick();const codeInput=page.getByRole('textbox',{name:'Edit source inline',exact:true});
  const selection=await codeInput.evaluate(node=>({color:getComputedStyle(node).color,selection:getComputedStyle(node,'::selection').color,start:(node as HTMLTextAreaElement).selectionStart,end:(node as HTMLTextAreaElement).selectionEnd,length:(node as HTMLTextAreaElement).value.length}));
  expect(selection.selection).toBe(selection.color);expect(selection.color).not.toBe('rgba(0, 0, 0, 0)');expect(selection.end-selection.start).toBe(selection.length);
  await codeInput.press('Control+Enter');expect(await source(page)).toEqual(original);
  const edited=structuredClone(original);edited.slides[0].code.source=original.slides[0].code.source.replace('const value','const renamed');
  await target.dblclick();await codeInput.fill(edited.slides[0].code.source);await codeInput.press('Control+Enter');await expect.poll(()=>source(page)).toEqual(edited);
  await canvas.getByRole('button',{name:'Undo canvas',exact:true}).click();await expect.poll(()=>source(page)).toEqual(original);await canvas.getByRole('button',{name:'Redo canvas',exact:true}).click();
  await target.dblclick();await codeInput.press('ArrowRight');await codeInput.press('Tab');expect(await codeInput.inputValue()).toMatch(/\t$/);await codeInput.press('Escape');expect(await source(page)).toEqual(edited);
  const filename=canvas.locator('[data-canvas-target][data-opf-path="slides.0.code.filename"]');await filename.dblclick();const filenameInput=page.getByRole('textbox',{name:'Edit filename inline',exact:true});
  await filenameInput.fill('src/Renamed.ts');await filenameInput.press('Control+Enter');edited.slides[0].code.filename='src/Renamed.ts';await expect.poll(()=>source(page)).toEqual(edited);
  const pptx=await download(page,'PPTX');const imported=await fromPptx(pptx.bytes);expect(validatePresentation(imported).valid).toBe(true);expect((imported as unknown as Presentation).slides[0].blocks).toEqual([{type:'code',code:edited.slides[0].code}]);
  await page.getByLabel('Import OPF or PowerPoint',{exact:true}).setInputFiles({name:pptx.name,mimeType:'application/vnd.openxmlformats-officedocument.presentationml.presentation',buffer:pptx.bytes});await expect(page.getByLabel('Import preview')).toContainText('src/Renamed.ts');
  await page.getByRole('button',{name:'Open presentation',exact:true}).click();await expect.poll(()=>source(page)).toEqual(imported);await canvas.getByRole('button',{name:'Undo canvas',exact:true}).click();await expect.poll(()=>source(page)).toEqual(edited);
  expect(writes).toEqual([]);expect(errors).toEqual([]);
});

test('anonymous Author canvas edits survive tab changes, offline PowerPoint export and undoable reimport', async ({ page }) => {
  const { fromPptx } = await import('@openpresentation/opf-pptx');
  const { validatePresentation } = await import('@openpresentation/opf');
  expect(validatePresentation(deck).valid).toBe(true);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/author');
  const input = page.getByRole('textbox', { name: 'Editor content' });
  await expect(input).toBeVisible();
  // A visible editor can precede its JSON worker's lazy chunk download. Prove
  // schema diagnostics work before later switching this workflow offline.
  await input.focus();
  await page.keyboard.press('ControlOrMeta+a');
  await page.evaluate(text => navigator.clipboard.writeText(text), '{"name":42,"slides":[]}');
  await page.keyboard.press('ControlOrMeta+v');
  await expect(page.locator('.monaco-editor .squiggly-error, .monaco-editor .squiggly-warning')).not.toHaveCount(0);
  await input.focus();
  await page.keyboard.press('ControlOrMeta+a');
  await page.evaluate(text => navigator.clipboard.writeText(text), JSON.stringify(deck, null, 2));
  await page.keyboard.press('ControlOrMeta+v');
  await expect.poll(() => source(page)).toEqual(deck);
  const tabs = page.getByRole('tablist', { name: 'Document view' });
  await tabs.getByRole('tab', { name: /^preview/ }).click();
  const canvas = page.locator(`[data-opf-editor="${manifest.dependencies['@openpresentation/opf-editor']}"]`);
  await expect(canvas.getByRole('button', { name: 'Import file', exact: true })).toBeEnabled();
  await expect(canvas).toContainText('Shared ownership');
  const writes: string[] = [];
  page.on('request', request => { if (request.method() === 'POST') writes.push(request.url()); });
  await page.context().setOffline(true);
  const title = canvas.locator('[data-canvas-target][data-opf-path="slides.0.title"]');
  await title.dblclick();
  const titleInput = page.getByRole('textbox', { name: 'Edit title inline', exact: true });
  await titleInput.fill('Reviewed in Author');
  await titleInput.press('Control+Enter');
  const edited = structuredClone(deck);
  edited.slides[0].title = 'Reviewed in Author';
  await expect.poll(() => source(page)).toEqual(edited);
  await tabs.getByRole('tab', { name: /^code/ }).click();
  await expect(input).toBeVisible();
  await tabs.getByRole('tab', { name: /^preview/ }).click();
  await canvas.getByRole('button', { name: 'Undo canvas', exact: true }).click();
  await expect.poll(() => source(page)).toEqual(deck);
  await canvas.getByRole('button', { name: 'Redo canvas', exact: true }).click();
  await expect.poll(() => source(page)).toEqual(edited);

  // Activate actions without a pointer blur: each handler must commit its own draft.
  for (const format of ['JSON', 'YAML', 'MD'] as const) {
    await title.dblclick();
    edited.slides[0].title = `Committed by ${format} export`;
    await titleInput.fill(edited.slides[0].title);
    await page.getByRole('button', { name: 'Export', exact: true }).evaluate(button => (button as HTMLButtonElement).click());
    const pending = page.waitForEvent('download');
    await page.getByRole('menuitem', { name: new RegExp(`^${format} `) }).evaluate(button => (button as HTMLButtonElement).click());
    expect((await readFile((await (await pending).path())!, 'utf8'))).toContain(edited.slides[0].title);
    await expect.poll(() => source(page)).toEqual(edited);
  }
  await title.dblclick();
  edited.slides[0].title = 'Committed by copy';
  await titleInput.fill(edited.slides[0].title);
  await page.getByRole('button', { name: 'copy', exact: true }).evaluate(button => (button as HTMLButtonElement).click());
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toContain(edited.slides[0].title);
  // Local Author metadata requests use the same submit boundary without any AI service.
  await page.getByRole('textbox', { name: 'Agent message', exact: true }).fill('Set author to Browser Reviewer');
  await title.dblclick();
  edited.slides[0].title = 'Committed before Author request';
  await titleInput.fill(edited.slides[0].title);
  await page.getByRole('button', { name: 'Submit', exact: true }).evaluate(button => (button as HTMLButtonElement).click());
  await expect.poll(() => source(page)).toMatchObject({ ...edited, author: 'Browser Reviewer' });
  Object.assign(edited, { author: 'Browser Reviewer' });

  // Export also commits an active inline draft, without waiting for React's source update.
  await title.dblclick();
  await titleInput.fill('Export commits this title');
  const pptx = await download(page, 'PPTX');
  edited.slides[0].title = 'Export commits this title';
  await expect.poll(() => source(page)).toEqual(edited);
  const zip = await JSZip.loadAsync(pptx.bytes);
  const xml = await zip.file('ppt/slides/slide1.xml')!.async('string');
  expect(xml).toContain(edited.slides[0].title);
  expect(xml).toContain('<a:tbl>');
  expect(xml).toContain('gridSpan="2"');
  const converted = await fromPptx(pptx.bytes);
  expect(validatePresentation(converted).valid).toBe(true);
  await page.getByLabel('Import OPF or PowerPoint', { exact: true }).setInputFiles({ name: pptx.name, mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', buffer: pptx.bytes });
  await expect(page.getByLabel('Import preview')).toContainText(edited.slides[0].title);
  await page.getByRole('button', { name: 'Open presentation', exact: true }).click();
  await expect.poll(() => source(page)).toEqual(converted);
  await canvas.getByRole('button', { name: 'Undo canvas', exact: true }).click();
  await expect.poll(() => source(page)).toEqual(edited);
  await canvas.getByRole('button', { name: 'Redo canvas', exact: true }).click();
  await expect.poll(() => source(page)).toEqual(converted);
  await page.getByLabel('Import OPF or PowerPoint', { exact: true }).setInputFiles({ name: 'broken.pptx', mimeType: 'application/octet-stream', buffer: Buffer.from('not a PowerPoint archive') });
  await expect(page.getByRole('dialog').getByRole('alert')).toBeVisible();
  await page.getByRole('button', { name: 'Cancel import', exact: true }).click();
  expect(await source(page)).toEqual(converted);
  expect(writes).toEqual([]);
  expect(errors).toEqual([]);
  await writeFile(test.info().outputPath('author-export.pptx'), pptx.bytes);
  await test.info().attach('author-export.pptx', { body: pptx.bytes, contentType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' });
  await page.screenshot({ path: test.info().outputPath('author.png'), fullPage: true });
});
