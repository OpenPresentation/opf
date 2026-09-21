import { expect, test, type Locator, type Page } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { getJsonFieldContext, replaceFieldOption } from '@openpresentation/opf-editor/json-options';
import type { AuthorLocalWorkspaceV1 } from '../../lib/author/local-workspace';
import { parseText } from '../../lib/playground/opf-codec';
import { copySource, observeClipboardWrites } from './helpers/clipboard';

test.beforeEach(async ({ page }) => observeClipboardWrites(page));

const documentLayout = {
  id: 'document-layout', name: 'AAA Document Layout',
  placeholders: [{ type: 'title' }, { type: 'text' }],
};
const richText = [
  { text: 'Two  spaces stay.', bold: true },
  { text: '\nAnd a second line.', italic: true },
];
const fixture = {
  name: 'Completion source preservation', author: 'Browser reviewer',
  design: { theme: 'minimal', fontScheme: 'roboto' },
  slides: [{
    title: 'A local decision', layout: 'text-1x', text: richText,
    notes: 'Keep these notes\n\tand their whitespace.',
  }],
  catalogs: { layouts: { records: [documentLayout] } },
};
const originalLF = JSON.stringify(fixture, null, 2)
  .replace('"name": "Completion', '"name"  :   "\\u0043ompletion') + '\n';
const compactLF = originalLF.replace(
  /"text": \[\n[\s\S]*?\n      \],/,
  '"text": [{"text":"Two  spaces stay.","bold":true}, {"text":"\\nAnd a second line.","italic":true}],'
);
// Hand-authored changes retain every unaffected source byte. The public helper
// supplies semantic layout/placeholder expectations, not a formatting oracle.
const notesToken = '"notes": "Keep these notes\\n\\tand their whitespace."';
const titleSubtitleLF = compactLF
  .replace('"layout": "text-1x"', '"layout": "title-subtitle"')
  .replace(notesToken, notesToken + ',\n      "subtitle": ""');
const text2xLF = compactLF
  .replace('"layout": "text-1x"', '"layout": "text-2x"')
  .replace('"text": [{"text":"Two  spaces stay.","bold":true}, {"text":"\\nAnd a second line.","italic":true}],', '')
  .replace(notesToken, notesToken + ',\n      "blocks": [{"text":[{"text":"Two  spaces stay.","bold":true},{"text":"\\nAnd a second line.","italic":true}]},{"text":""}]');

function input(page: Page) {
  return page.getByRole('textbox', { name: 'Editor content', exact: true });
}

function categoricalChoice(choices: Locator, label: string) {
  const role = process.platform === 'win32' ? 'listitem' : 'option';
  return choices.getByRole(role, { name: `${label}, Enum Member`, exact: true });
}

async function author(page: Page, source: string) {
  const { validatePresentation } = await import('@openpresentation/opf');
  expect(validatePresentation(JSON.parse(source)).errors).toEqual([]);
  const workspace: AuthorLocalWorkspaceV1 = {
    schemaVersion: 1, updatedAt: '2026-09-21T00:00:00.000Z',
    format: 'json', opfDraft: source, acceptedOpfText: source,
    gallerySources: [], localVersions: [], ui: { centerTab: 'code', pinnedPaths: [] },
  };
  await page.addInitScript(value => {
    localStorage.setItem('pptx-dev:author:local-workspace:v1', JSON.stringify(value));
  }, workspace);
  await page.goto('/author');
  await expect(input(page)).toBeVisible();
  await expect.poll(() => copySource(page)).toBe(source);
}

async function choicesAt(page: Page, source: string, offset: number) {
  const before = source.slice(0, offset);
  const line = before.split('\n').length;
  const column = offset - before.lastIndexOf('\n');
  await input(page).focus();
  await input(page).press('Control+g');
  const location = page.locator('.quick-input-widget input');
  await expect(location).toBeVisible();
  await location.fill(`:${line}:${column}`);
  await location.press('Enter');
  await expect(page.getByText(`cursor ${line}:${column}`, { exact: true })).toBeVisible();
  await input(page).press('Control+Space');
  const choices = page.locator('.suggest-widget.visible');
  await expect(choices).toBeVisible();
  return choices;
}

function tokenOffset(source: string, token: string) {
  const offset = source.indexOf(token);
  expect(offset, `Find the authored token ${token}`).toBeGreaterThanOrEqual(0);
  return offset;
}

async function undoRedo(page: Page, before: string, after: string) {
  await expect.poll(() => copySource(page)).toBe(after);
  await input(page).focus();
  await input(page).press('ControlOrMeta+z');
  await expect.poll(() => copySource(page)).toBe(before);
  await input(page).focus();
  await input(page).press('ControlOrMeta+Shift+z');
  await expect.poll(() => copySource(page)).toBe(after);
}

async function pasteSource(page: Page, source: string) {
  await input(page).focus();
  await input(page).press('ControlOrMeta+a');
  await page.evaluate(value => navigator.clipboard.writeText(value), source);
  await input(page).press('ControlOrMeta+v');
}

for (const scenario of [
  { label: 'Title Subtitle', value: 'title-subtitle', source: compactLF, desired: titleSubtitleLF, eol: 'LF compact', cursor: 1 },
  { label: 'Text 2x', value: 'text-2x', source: compactLF.replaceAll('\n', '\r\n'), desired: text2xLF.replaceAll('\n', '\r\n'), eol: 'CRLF compact', cursor: 5 },
]) {
  test(`Author ${scenario.label} completion preserves ${scenario.eol} source in one undo step`, async ({ page }) => {
    const { validatePresentation } = await import('@openpresentation/opf');
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    const original = scenario.source;
    await author(page, original);
    const offset = tokenOffset(original, '"text-1x"') + scenario.cursor;
    const context = getJsonFieldContext(original, offset);
    expect(context?.path).toEqual(['slides', 0, 'layout']);
    const desired = scenario.desired;
    const changed = JSON.parse(desired);
    expect(changed).toEqual(JSON.parse(replaceFieldOption(context!, scenario.value)));
    expect(validatePresentation(changed).errors).toEqual([]);
    expect(changed.name).toBe(fixture.name);
    expect(changed.author).toBe(fixture.author);
    expect(changed.catalogs).toEqual(fixture.catalogs);
    expect(changed.slides[0].notes).toBe(fixture.slides[0].notes);
    if (scenario.value === 'text-2x') {
      expect(changed.slides[0].blocks).toEqual([{ text: richText }, { text: '' }]);
    } else {
      expect(changed.slides[0].text).toEqual(richText);
      expect(changed.slides[0].subtitle).toBe('');
    }
    const choices = await choicesAt(page, original, offset);
    await expect(categoricalChoice(choices, scenario.label)).toBeVisible();
    await page.screenshot({ path: test.info().outputPath('structural-choice.png'), fullPage: true });
    await categoricalChoice(choices, scenario.label).click();
    await undoRedo(page, original, desired);
    expect(await copySource(page)).toContain('"name"  :   "\\u0043ompletion source preservation"');
    await writeFile(test.info().outputPath('original-source.json'), original);
    await writeFile(test.info().outputPath('desired-source.json'), desired);
    await writeFile(test.info().outputPath('actual-source.json'), await copySource(page));
    expect(errors).toEqual([]);
  });
}

test('Author escaped current value is not offered as an edit and leaves prior undo history intact', async ({ page }) => {
  const original = compactLF.replace('"text-1x"', '"text-\\u0031x"');
  await author(page, original);
  // A known previous user edit makes a spurious completion history entry observable.
  const themes = await choicesAt(page, original, tokenOffset(original, '"minimal"') + 1);
  await categoricalChoice(themes, 'Dark').click();
  const themed = original.replace('"theme": "minimal"', '"theme": "dark"');
  await expect.poll(() => copySource(page)).toBe(themed);
  const rawToken = '"text-\\u0031x"';
  // Trigger before the closing quote, including the authored escape in the filter.
  const current = await choicesAt(page, themed, tokenOffset(themed, rawToken) + rawToken.length - 1);
  const unchanged = categoricalChoice(current, 'Text 1x');
  // Monaco records history even for empty completions. Current values are not
  // actionable edits. Check the virtualized list through real keyboard moves,
  // including its final page; looking only at the initial viewport missed it.
  const context = getJsonFieldContext(themed, tokenOffset(themed, rawToken) + 1)!;
  await expect(categoricalChoice(current, 'Text 2x')).toBeVisible();
  for (let index = 0; index < context.options.length; index++) {
    await expect(unchanged).toHaveCount(0);
    await input(page).press('ArrowDown');
  }
  await expect(unchanged).toHaveCount(0);
  await page.screenshot({ path: test.info().outputPath('escaped-current-alternatives.png'), fullPage: true });
  await input(page).press('Escape');
  await expect(page.locator('.suggest-widget.visible')).toHaveCount(0);
  await expect.poll(() => copySource(page)).toBe(themed);
  await undoRedo(page, original, themed);
});

test('Author newer and invalid source dismiss stale choices and refresh inline catalogs', async ({ page }) => {
  await author(page, originalLF);
  const choices = await choicesAt(page, originalLF, tokenOffset(originalLF, '"text-1x"') + 1);
  await expect(categoricalChoice(choices, 'AAA Document Layout')).toBeVisible();
  const newerDocument = {
    name: 'Newer document', author: 'Current source owner',
    design: fixture.design,
    slides: [{ title: 'Current target', layout: 'text-1x', text: 'Keep the newer content.' }],
  };
  const newer = JSON.stringify(newerDocument, null, 2) + '\n';
  // Paste is a real editor operation while the old popup remains open. It must
  // cancel the old choice, not apply its stale layout/placeholder edits.
  await pasteSource(page, newer);
  await expect(page.locator('.suggest-widget.visible')).toHaveCount(0);
  await expect.poll(() => copySource(page)).toBe(newer);
  const refreshed = await choicesAt(page, newer, tokenOffset(newer, '"text-1x"') + 1);
  await expect(categoricalChoice(refreshed, 'Title Subtitle')).toBeVisible();
  await expect(categoricalChoice(refreshed, 'AAA Document Layout')).toHaveCount(0);
  const malformed = '{ "name": "Unfinished source", "slides": [';
  await pasteSource(page, malformed);
  await expect(page.locator('.suggest-widget.visible')).toHaveCount(0);
  await expect(page.locator('.monaco-editor .squiggly-error')).not.toHaveCount(0);
  // Author disables its export/copy toolbar for malformed JSON. Use the actual
  // editor's Copy command; this single-line fixture has no OS EOL ambiguity.
  await page.evaluate(() => navigator.clipboard.writeText('Waiting for editor Copy'));
  await input(page).focus();
  await input(page).press('ControlOrMeta+a');
  await input(page).press('ControlOrMeta+c');
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(malformed);
  await pasteSource(page, newer);
  await expect.poll(() => copySource(page)).toBe(newer);
  const recovered = await choicesAt(page, newer, tokenOffset(newer, '"text-1x"') + 1);
  await categoricalChoice(recovered, 'Title Subtitle').click();
  const context = getJsonFieldContext(newer, tokenOffset(newer, '"text-1x"') + 1)!;
  const desired = newer
    .replace('"layout": "text-1x"', '"layout": "title-subtitle"')
    .replace('"text": "Keep the newer content."', '"text": "Keep the newer content.",\n      "subtitle": ""');
  expect(JSON.parse(desired)).toEqual(JSON.parse(replaceFieldOption(context, 'title-subtitle')));
  await undoRedo(page, newer, desired);
});

test('Author format and document changes cancel the open completion without applying it', async ({ page }) => {
  const { validatePresentation } = await import('@openpresentation/opf');
  await author(page, originalLF);
  const choices = await choicesAt(page, originalLF, tokenOffset(originalLF, '"text-1x"') + 1);
  await expect(categoricalChoice(choices, 'Text 2x')).toBeVisible();
  await page.getByRole('tablist', { name: 'Editor format' }).getByRole('tab', { name: 'YAML', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'YAML', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.suggest-widget.visible')).toHaveCount(0);
  expect(parseText(await copySource(page), 'yaml')).toEqual({ ok: true, doc: fixture });
  await page.getByRole('tablist', { name: 'Editor format' }).getByRole('tab', { name: 'JSON', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'JSON', exact: true })).toHaveAttribute('aria-selected', 'true');
  const converted = await copySource(page);
  expect(JSON.parse(converted)).toEqual(fixture);
  const reopened = await choicesAt(page, converted, tokenOffset(converted, '"text-1x"') + 1);
  await expect(categoricalChoice(reopened, 'AAA Document Layout')).toBeVisible();
  await page.getByRole('button', { name: 'New run', exact: true }).click();
  await expect(page.locator('.suggest-widget.visible')).toHaveCount(0);
  await expect.poll(async () => (await copySource(page)) !== converted).toBe(true);
  const replacement = await copySource(page);
  expect(validatePresentation(JSON.parse(replacement)).errors).toEqual([]);
  expect(replacement).not.toContain('AAA Document Layout');
  expect(replacement).not.toContain('"layout": "document-layout"');
  // Copying/refocusing must not resurrect or accept the old suggestion.
  await input(page).focus();
  await expect(page.locator('.suggest-widget.visible')).toHaveCount(0);
  expect(await copySource(page)).toBe(replacement);
});
