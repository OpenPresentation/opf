import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { copySource, observeClipboardWrites } from './helpers/clipboard';

test.beforeEach(async ({ page }) => observeClipboardWrites(page));

const original = '{\n  "name" : "Keep\\u0020authored",\n  "extensions": {"review": {"amount": 1e2, "path":"a\\/b"}},\n'
  + '  "design": {"fontScheme":"roboto", "header":{"left":{"text":"Shared header"}}},\n'
  + '  "slides" : [\n'
  + '    {"id":"first", "title":"First slide", "text":[{"text":"Rich  text", "bold":true}], "notes":"Keep notes"},\n'
  + '    {"id":"second", "title" : "Second\\u0020slide", "text":"Second body"},\n'
  + '    {"id":"third", "title":"Third slide", "text":"Third body"}\n'
  + '  ]\n}\n';

async function replaceSource(page: Page, text: string) {
  const input = page.getByRole('textbox', { name: 'Editor content' });
  await expect(input).toBeVisible();
  await input.focus();
  await page.keyboard.press('ControlOrMeta+a');
  await page.evaluate(value => navigator.clipboard.writeText(value), text);
  await page.keyboard.press('ControlOrMeta+v');
}

const canvas = (page: Page, index: number) => page.locator(`[data-testid="inspector-canvas-overlay"][data-opf-slide-index="${index}"]`);

async function editTitle(page: Page, index: number, text: string) {
  await canvas(page, index).locator(`[data-canvas-target][data-opf-path="slides.${index}.title"]`).dblclick();
  const input = page.getByRole('textbox', { name: 'Edit title inline', exact: true });
  await input.fill(text);
  await input.press('Control+Enter');
}

async function canvasHistory(page: Page, index: number, redo = false) {
  await canvas(page, index).locator(`[data-canvas-target][data-opf-path="slides.${index}.title"]`).click();
  await page.keyboard.press(redo ? 'ControlOrMeta+Shift+z' : 'ControlOrMeta+z');
}

for (const size of [{ width: 1440, height: 1000 }, { width: 540, height: 960 }]) {
  test(`all Inspector slides preserve exact JSON and shared furniture through offline undo/export at ${size.width}px`, async ({ page }) => {
    const { validatePresentation } = await import('@openpresentation/opf');
    const { fromPptx } = await import('@openpresentation/opf-pptx');
    await page.setViewportSize(size);
    expect(validatePresentation(JSON.parse(original)).valid).toBe(true);
    const errors: string[] = [];
    const writes: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/inspector');
    // Let Monaco's schema worker finish loading before the offline workflow.
    await replaceSource(page, '{"name":42,"slides":[]}');
    await expect(page.locator('.monaco-editor .squiggly-error, .monaco-editor .squiggly-warning')).not.toHaveCount(0);
    await replaceSource(page, original);
    await expect(page.getByTestId('inspector-canvas-overlay')).toHaveCount(3);
    for (let index = 0; index < 3; index++) await expect(canvas(page, index)).toBeVisible();
    await expect.poll(() => copySource(page)).toBe(original);
    page.on('request', request => { if (request.method() === 'POST') writes.push(request.url()); });
    await page.context().setOffline(true);

    await editTitle(page, 1, 'Reviewed second slide');
    const edited = original.replace('"Second\\u0020slide"', '"Reviewed second slide"');
    await expect.poll(() => copySource(page)).toBe(edited);
    await canvasHistory(page, 1);
    await expect.poll(() => copySource(page)).toBe(original);
    await canvasHistory(page, 2, true);
    await expect.poll(() => copySource(page)).toBe(edited);

    // An inherited field has one authored source even when edited on slide 3.
    await canvas(page, 2).locator('[data-canvas-target][data-opf-path="design.header.left.text"]').dblclick();
    const headerInput = page.getByRole('textbox', { name: 'Edit text inline', exact: true });
    await headerInput.fill('Reviewed shared header');
    await headerInput.press('Control+Enter');
    const withHeader = edited.replace('"Shared header"', '"Reviewed shared header"');
    await expect.poll(() => copySource(page)).toBe(withHeader);
    for (let index = 0; index < 3; index++) await expect(canvas(page, index)).toContainText('Reviewed shared header');
    await canvasHistory(page, 0);
    await expect.poll(() => copySource(page)).toBe(edited);
    await canvasHistory(page, 2, true);
    await expect.poll(() => copySource(page)).toBe(withHeader);

    await editTitle(page, 2, 'Reviewed third slide');
    const finalSource = withHeader.replace('"Third slide"', '"Reviewed third slide"');
    await expect.poll(() => copySource(page)).toBe(finalSource);
    const pending = page.waitForEvent('download');
    await page.getByRole('button', { name: 'pptx', exact: true }).click();
    const file = await pending;
    expect(await file.failure()).toBeNull();
    const restored = await fromPptx(await readFile((await file.path())!));
    expect(validatePresentation(restored).valid).toBe(true);
    expect(JSON.stringify(restored)).toContain('Reviewed second slide');
    expect(JSON.stringify(restored)).toContain('Reviewed third slide');
    expect(JSON.stringify(restored)).toContain('Reviewed shared header');
    expect(await copySource(page)).toBe(finalSource);
    expect(errors).toEqual([]);
    expect(writes).toEqual([]);
    await page.screenshot({ path: test.info().outputPath('inspector-later-slide.png'), fullPage: true });
  });
}

test('invalid source keeps a renderer fallback and source recovery uses the current slide order', async ({ page }) => {
  await page.goto('/inspector');
  await replaceSource(page, original);
  await expect(canvas(page, 2)).toBeVisible();
  await replaceSource(page, '{');
  await expect(page.getByTestId('inspector-canvas-overlay')).toHaveCount(0);
  await expect(page.getByText('Showing the last valid preview')).toBeVisible();
  const reordered = JSON.parse(original);
  reordered.slides.reverse();
  const source = JSON.stringify(reordered, null, 3) + '\n';
  await replaceSource(page, source);
  await expect(canvas(page, 0)).toHaveAttribute('data-opf-slide-id', 'third');
  await expect(canvas(page, 2)).toHaveAttribute('data-opf-slide-id', 'first');
  await editTitle(page, 2, 'First slide at its new index');
  await expect.poll(() => copySource(page)).toBe(source.replace('"First slide"', '"First slide at its new index"'));
});

test('shared navigation discards an ID-less draft even when the replacement title is identical', async ({ page }) => {
  const before = { slides: [{ title: 'Same title', text: 'Old first' }, { title: 'Same title', text: 'Old second' }] };
  const after = { slides: [...before.slides].reverse() };
  await page.goto('/inspector#opf=' + gzipSync(JSON.stringify(before)).toString('base64url'));
  const target = canvas(page, 1).locator('[data-canvas-target][data-opf-path="slides.1.title"]');
  await target.dblclick();
  const input = page.getByRole('textbox', { name: 'Edit title inline', exact: true });
  await input.fill('Stale uncommitted draft');
  // External navigation must not depend on pointer blur to discard a draft.
  await page.evaluate(hash => { location.hash = hash; }, 'opf=' + gzipSync(JSON.stringify(after)).toString('base64url'));
  await expect(input).toHaveCount(0);
  await expect.poll(async () => JSON.parse(await copySource(page))).toEqual(after);
  await editTitle(page, 1, 'Edited current second');
  after.slides[1].title = 'Edited current second';
  await expect.poll(async () => JSON.parse(await copySource(page))).toEqual(after);
});
