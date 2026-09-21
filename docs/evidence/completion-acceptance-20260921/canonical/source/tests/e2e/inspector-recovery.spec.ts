import { expect, test, type Page } from '@playwright/test';
import { gzipSync } from 'node:zlib';

const hashFor = (document: unknown) => 'opf=' + gzipSync(JSON.stringify(document)).toString('base64url');
const canvas = (page: Page) => page.locator('[data-testid="inspector-canvas-overlay"][data-opf-slide-id="retained-slide"]');

async function changeSharedDocument(page: Page, document: unknown) {
  // Change history without pointer blur: an active draft must be discarded by
  // the source/session boundary rather than accidentally committed by the test.
  await page.evaluate(hash => { location.hash = hash; }, hashFor(document));
}

async function copyDocument(page: Page) {
  await page.getByRole('button', { name: /^(copy|copied)$/i, exact: true }).click();
  return JSON.parse(await page.evaluate(() => navigator.clipboard.readText()));
}

test('schema-valid strict overflow cancels an active draft and the same slide recovers after source correction', async ({ page }) => {
  const { validatePresentation } = await import('@openpresentation/opf');
  const { renderSvg } = await import('@openpresentation/opf-render/svg');
  const initial = {
    design: { fontScheme: 'roboto' },
    slides: [{ id: 'retained-slide', title: 'Initial valid slide', text: 'Original body', notes: 'Keep this metadata.' }],
  };
  const overflow = {
    ...initial,
    slides: [{
      ...initial.slides[0], title: 'Overflowing replacement',
      text: 'This source must remain intact even when it cannot fit. '.repeat(400),
      composition: { overflow: 'error', minFontSize: 32 },
    }],
  };
  const corrected = {
    ...initial,
    slides: [{ ...initial.slides[0], title: 'Corrected same slide', text: 'A readable replacement.' }],
  };
  expect(validatePresentation(initial).errors).toEqual([]);
  expect(validatePresentation(overflow).errors).toEqual([]);
  expect(validatePresentation(corrected).errors).toEqual([]);
  expect(() => renderSvg(overflow)).toThrow(/overflow|does not fit|cannot fit/i);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));

  await page.goto('/inspector#' + hashFor(initial));
  const target = canvas(page).locator('[data-canvas-target][data-opf-path="slides.0.title"]');
  await expect(target).toBeVisible();
  await target.dblclick();
  const input = page.getByRole('textbox', { name: 'Edit title inline', exact: true });
  await input.fill('Stale draft must not reach the replacement');
  await changeSharedDocument(page, overflow);
  await expect(input).toHaveCount(0);
  await expect(canvas(page)).not.toBeVisible();
  await expect(page.getByRole('alert').filter({ hasText: /Preview unavailable:/ }).first()).toBeVisible();
  await expect(page.getByText('Schema clean', { exact: true })).toBeVisible();
  await expect.poll(() => copyDocument(page)).toEqual(overflow);
  expect(errors).toEqual([]);
  await page.screenshot({ path: test.info().outputPath('inspector-strict-overflow.png'), fullPage: true });

  await changeSharedDocument(page, corrected);
  await expect(target).toBeVisible();
  await expect(canvas(page)).toHaveAttribute('data-opf-slide-index', '0');
  await expect(page.getByRole('alert').filter({ hasText: /Preview unavailable:/ })).toHaveCount(0);
  await expect(input).toHaveCount(0);
  await target.dblclick();
  await input.fill('Editable after render recovery');
  await input.press('Control+Enter');
  const edited = { ...corrected, slides: [{ ...corrected.slides[0], title: 'Editable after render recovery' }] };
  await expect.poll(() => copyDocument(page)).toEqual(edited);
  expect(errors).toEqual([]);
  await page.screenshot({ path: test.info().outputPath('inspector-render-recovered.png'), fullPage: true });

  // The same correction must also recover when the initial mount never created
  // a canvas, rather than relying on a surviving canvas's session subscription.
  await page.goto('/inspector#' + hashFor(overflow));
  await expect(page.getByRole('alert').filter({ hasText: /Preview unavailable:/ }).first()).toBeVisible();
  await changeSharedDocument(page, corrected);
  await expect(target).toBeVisible();
  await target.press('Enter');
  await expect(input).toHaveValue(corrected.slides[0].title);
  await input.press('Escape');
  await expect.poll(() => copyDocument(page)).toEqual(corrected);
  expect(errors).toEqual([]);
});

test('font substitution notes remain accessible and operable while the Inspector canvas is active', async ({ page }) => {
  const { validatePresentation } = await import('@openpresentation/opf');
  // This tests visibility of the explicit substitution disclosure. It does not
  // establish native Office compatibility.
  const document = {
    design: { fontScheme: { major: 'Aptos', minor: 'Aptos' } },
    slides: [{ id: 'retained-slide', title: 'Disclose the font choice', text: 'The requested font remains authored.' }],
  };
  expect(validatePresentation(document).errors).toEqual([]);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/inspector#' + hashFor(document));
  await expect(canvas(page)).toBeVisible();
  const notes = page.locator('[data-opf-renderer] details');
  const summary = notes.locator('summary');
  await expect(summary).toHaveText(/^Preview notes \([1-9]\d*\)$/);
  expect(await summary.evaluate(node => node.closest('[inert], [aria-hidden="true"]') === null)).toBe(true);
  await summary.click();
  await expect(notes).toHaveAttribute('open', '');
  await expect(notes.getByRole('listitem').filter({ hasText: /Aptos → Carlito \(visual substitute\)/ })).toBeVisible();
  await expect(canvas(page)).toBeVisible();
  await page.screenshot({ path: test.info().outputPath('inspector-font-notes.png'), fullPage: true });
  await summary.press('Enter');
  await expect(notes).not.toHaveAttribute('open', '');

  const target = canvas(page).locator('[data-canvas-target][data-opf-path="slides.0.title"]');
  await target.dblclick();
  const input = page.getByRole('textbox', { name: 'Edit title inline', exact: true });
  await input.fill('Font notes survive an edit');
  await input.press('Control+Enter');
  await summary.click();
  await expect(notes.getByRole('listitem').filter({ hasText: /Aptos → Carlito \(visual substitute\)/ })).toBeVisible();
  const after = await copyDocument(page);
  expect(after.design).toEqual(document.design);
  expect(after.slides[0].title).toBe('Font notes survive an edit');
  expect(errors).toEqual([]);
});
