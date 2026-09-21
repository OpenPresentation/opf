import { expect, test, type Locator, type Page } from '@playwright/test';
import type { AuthorLocalWorkspaceV1 } from '../../lib/author/local-workspace';
import { copySource, observeClipboardWrites } from './helpers/clipboard';

test.beforeEach(async ({ page }) => observeClipboardWrites(page));

const documentLayout = {
  id: 'document-layout', name: 'AAA Document Layout',
  placeholders: [{ type: 'title' }, { type: 'text' }],
};
const loadedLayout = {
  id: 'loaded-layout', name: 'AAB Loaded Layout',
  placeholders: [{ type: 'title' }, { type: 'text' }],
};
const document = {
  name: 'Categorical choices preserve source',
  author: 'Browser reviewer',
  design: { theme: 'minimal', fontScheme: 'roboto' },
  slides: [{
    title: 'A local decision', layout: 'text-1x',
    text: [{ text: 'Two  spaces stay.', bold: true }, { text: '\nAnd a second line.', italic: true }],
    notes: 'Keep these notes\n\tand their whitespace.',
  }],
  catalogs: { layouts: { records: [documentLayout] } },
};
const originalLF = JSON.stringify(document, null, 2).replace('"name": ', '"name"  :   ') + '\n';

function categoricalChoice(choices: Locator, label: string) {
  // Monaco's suggestWidget accessibilityProvider intentionally uses listitem
  // on Windows and option elsewhere (esm/vs/editor/contrib/suggest/browser/suggestWidget.js).
  const role = process.platform === 'win32' ? 'listitem' : 'option';
  return choices.getByRole(role, { name: `${label}, Enum Member`, exact: true });
}

async function openChoices(page: Page, source: string, field: 'theme' | 'layout', value: string) {
  const property = `"${field}": "${value}"`;
  const start = source.indexOf(property);
  expect(start, `Find the authored ${field} value`).toBeGreaterThanOrEqual(0);
  const offset = start + `"${field}": "`.length;
  const prefix = source.slice(0, offset);
  const line = prefix.split('\n').length;
  const column = offset - prefix.lastIndexOf('\n');
  const input = page.getByRole('textbox', { name: 'Editor content', exact: true });
  await input.focus();
  // Monaco's Go to Line works on Windows and macOS. Check the app's reported
  // cursor before asking for options so a wrong keybinding cannot fake coverage.
  await input.press('Control+g');
  const location = page.locator('.quick-input-widget input');
  await expect(location).toBeVisible();
  // Retain the ':' quick-access prefix; removing it switches to symbol search.
  await location.fill(`:${line}:${column}`);
  await location.press('Enter');
  await expect(page.getByText(`cursor ${line}:${column}`, { exact: true })).toBeVisible();
  await input.press('Control+Space');
  const choices = page.locator('.suggest-widget.visible');
  await expect(choices).toBeVisible();
  return choices;
}

async function expectUndoRedo(page: Page, before: string, after: string) {
  await expect.poll(() => copySource(page)).toBe(after);
  const input = page.getByRole('textbox', { name: 'Editor content', exact: true });
  await input.focus();
  await input.press('ControlOrMeta+z');
  await expect.poll(() => copySource(page)).toBe(before);
  await input.focus();
  await input.press('ControlOrMeta+Shift+z');
  await expect.poll(() => copySource(page)).toBe(after);
}

for (const eol of ['LF', 'CRLF'] as const) {
test(`Author categorical choices include built-in, document and loaded catalogs with exact ${eol} source undo/redo`, async ({ page }) => {
  const original = eol === 'CRLF' ? originalLF.replace(/\n/g, '\r\n') : originalLF;
  const { validatePresentation } = await import('@openpresentation/opf');
  expect(validatePresentation(document).errors).toEqual([]);
  // Use the app's browser-local workspace contract, including a loaded file
  // catalog. No remote catalog, account, or backend write is needed.
  const workspace: AuthorLocalWorkspaceV1 = {
    schemaVersion: 1, updatedAt: '2026-09-21T00:00:00.000Z',
    format: 'json', opfDraft: original, acceptedOpfText: original,
    gallerySources: [{
      id: 'local-test-catalog', name: 'Local test catalog',
      sourceType: 'local', contentType: 'file', enabled: true,
      kinds: ['layouts'], records: { layouts: [loadedLayout] },
      validation: { valid: true },
      createdAt: '2026-09-21T00:00:00.000Z', updatedAt: '2026-09-21T00:00:00.000Z',
    }],
    localVersions: [], ui: { centerTab: 'code', pinnedPaths: [] },
  };
  await page.addInitScript(({ key, workspace }) => {
    localStorage.setItem(key, JSON.stringify(workspace));
  }, { key: 'pptx-dev:author:local-workspace:v1', workspace });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/author');
  await expect(page.getByRole('textbox', { name: 'Editor content', exact: true })).toBeVisible();
  await expect.poll(() => copySource(page)).toBe(original);

  const themes = await openChoices(page, original, 'theme', 'minimal');
  // Distinguish the shared catalog provider's labelled Enum Member from the
  // JSON worker's quoted schema example ("dark", Value).
  const dark = categoricalChoice(themes, 'Dark');
  await expect(dark).toBeVisible();
  await page.screenshot({ path: test.info().outputPath('author-theme-options.png'), fullPage: true });
  await dark.click();
  const themed = original.replace('"theme": "minimal"', '"theme": "dark"');
  await expectUndoRedo(page, original, themed);

  const layouts = await openChoices(page, themed, 'layout', 'text-1x');
  const local = categoricalChoice(layouts, 'AAA Document Layout');
  await expect(local).toBeVisible();
  await expect(categoricalChoice(layouts, 'AAB Loaded Layout')).toBeVisible();
  await page.screenshot({ path: test.info().outputPath('author-layout-options.png'), fullPage: true });
  await local.click();
  const withDocumentLayout = themed.replace('"layout": "text-1x"', '"layout": "document-layout"');
  await expectUndoRedo(page, themed, withDocumentLayout);

  const loadedChoices = await openChoices(page, withDocumentLayout, 'layout', 'document-layout');
  await categoricalChoice(loadedChoices, 'AAB Loaded Layout').click();
  const withLoadedLayout = withDocumentLayout.replace('"layout": "document-layout"', '"layout": "loaded-layout"');
  await expectUndoRedo(page, withDocumentLayout, withLoadedLayout);
  expect(JSON.parse(await copySource(page))).toEqual({
    ...document,
    design: { ...document.design, theme: 'dark' },
    slides: [{ ...document.slides[0], layout: 'loaded-layout' }],
  });
  expect(errors).toEqual([]);
  await page.screenshot({ path: test.info().outputPath('author-json-options.png'), fullPage: true });
});
}
