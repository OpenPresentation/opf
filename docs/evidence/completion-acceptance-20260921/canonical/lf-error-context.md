# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: author-json-options.spec.ts >> Author categorical choices include built-in, document and loaded catalogs with exact LF source undo/redo
- Location: tests/e2e/author-json-options.spec.ts:72:5

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('.suggest-widget.visible')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" locator('.suggest-widget.visible') with timeout 5000ms
  - waiting for locator('.suggest-widget.visible')

```

```yaml
- alert
- main:
  - link "pptx.dev home":
    - /url: /
    - text: P pptx.dev
  - button "categorical_choices_preserve_source"
  - text: local browser valid 1 slide
  - button "copy"
  - button "Export"
  - button "New run"
  - button "More actions"
  - main:
    - tablist "Activity":
      - tab "agent" [selected]
      - tab "tools"
      - tab "schema"
    - log:
      - heading "Agent transcript" [level=3]
      - paragraph: Plans, tool calls, diffs, and checkpoints will appear here as Author works.
    - group "Author understands these inputs as": intent topic Categorical choices preserve source slides ~1
    - group "Who is this for?":
      - text: Who is this for? missing · audience
      - paragraph: I can pick a tone, narrative arc, and theme once I know the audience.
      - button "Investors"
      - button "Customers"
      - button "Executives"
      - button "Engineering team"
      - button "Board"
      - text: One question only. Skip — I'll guess and you can revert in diff.
      - button "skip — just run"
    - text: slides[0].layout
    - form "Agent message composer":
      - group:
        - button "Choose File"
        - textbox "Agent message":
          - /placeholder: Paste OPF JSON, or sign in for AI...
        - group:
          - button "Attach source files": Attach
          - button "Submit": Sign in
    - button "try a sample"
    - button "rewrite this field"
    - separator "Resize Agent and Edit panes"
    - tablist "Document view":
      - tab "code" [selected]
      - tab "preview 1"
      - tablist "Editor format":
        - tab "JSON" [selected]
        - tab "YAML"
        - tab "MD"
    - paragraph: Draft differs from last accepted OPF. Preview and export use your draft JSON.
    - button "Revert to accepted"
    - code:
      - textbox "Editor content"
    - text: cursor 11:18
    - separator "Resize Edit and right rail"
    - complementary:
      - tablist "Right rail":
        - tab "inspector" [selected]
        - tab "gallery"
        - tab "trace"
      - text: Selection
      - heading "slides[0].layout" [level=2]
      - text: document-layout doc › nested field
      - button "Pin this field as LLM context"
      - heading "Effective value" [level=3]
      - text: from Gallery Ref
      - paragraph: AAA Document Layout
      - paragraph: document
      - heading "Resolution" [level=3]
      - article:
        - text: "5"
        - heading "Authored" [level=4]
        - paragraph: document-layout
        - paragraph: opf:$.slides[0].layout
        - button "View raw"
        - button "Make winner" [disabled]
      - article:
        - text: "4"
        - heading "Gallery Ref" [level=4]
        - paragraph: document/layouts/document-layout
        - paragraph: document
        - button "View raw"
      - article:
        - text: "3"
        - heading "Doc Inheritance" [level=4]
        - paragraph: n/a
      - article:
        - text: "2"
        - heading "User Preference" [level=4]
        - paragraph: n/a
      - article:
        - text: "1"
        - heading "Engine Default" [level=4]
        - paragraph: title-and-content
        - paragraph: engine
        - button "View raw"
        - button "Make winner" [disabled]
      - heading "Linked usage" [level=3]
      - text: 1 item
      - button "slides[0]"
      - heading "Validation" [level=3]
      - text: 0 errors · 0 warnings
      - paragraph: No validation issues on this field.
- alert
- alert
- text: "Line 11, column 18: \"layout\": \"document-layout\","
```

# Test source

```ts
  1   | import { expect, test, type Locator, type Page } from '@playwright/test';
  2   | import type { AuthorLocalWorkspaceV1 } from '../../lib/author/local-workspace';
  3   | import { copySource, observeClipboardWrites } from './helpers/clipboard';
  4   | 
  5   | test.beforeEach(async ({ page }) => observeClipboardWrites(page));
  6   | 
  7   | const documentLayout = {
  8   |   id: 'document-layout', name: 'AAA Document Layout',
  9   |   placeholders: [{ type: 'title' }, { type: 'text' }],
  10  | };
  11  | const loadedLayout = {
  12  |   id: 'loaded-layout', name: 'AAB Loaded Layout',
  13  |   placeholders: [{ type: 'title' }, { type: 'text' }],
  14  | };
  15  | const document = {
  16  |   name: 'Categorical choices preserve source',
  17  |   author: 'Browser reviewer',
  18  |   design: { theme: 'minimal', fontScheme: 'roboto' },
  19  |   slides: [{
  20  |     title: 'A local decision', layout: 'text-1x',
  21  |     text: [{ text: 'Two  spaces stay.', bold: true }, { text: '\nAnd a second line.', italic: true }],
  22  |     notes: 'Keep these notes\n\tand their whitespace.',
  23  |   }],
  24  |   catalogs: { layouts: { records: [documentLayout] } },
  25  | };
  26  | const originalLF = JSON.stringify(document, null, 2).replace('"name": ', '"name"  :   ') + '\n';
  27  | 
  28  | function categoricalChoice(choices: Locator, label: string) {
  29  |   // Monaco's suggestWidget accessibilityProvider intentionally uses listitem
  30  |   // on Windows and option elsewhere (esm/vs/editor/contrib/suggest/browser/suggestWidget.js).
  31  |   const role = process.platform === 'win32' ? 'listitem' : 'option';
  32  |   return choices.getByRole(role, { name: `${label}, Enum Member`, exact: true });
  33  | }
  34  | 
  35  | async function openChoices(page: Page, source: string, field: 'theme' | 'layout', value: string) {
  36  |   const property = `"${field}": "${value}"`;
  37  |   const start = source.indexOf(property);
  38  |   expect(start, `Find the authored ${field} value`).toBeGreaterThanOrEqual(0);
  39  |   const offset = start + `"${field}": "`.length;
  40  |   const prefix = source.slice(0, offset);
  41  |   const line = prefix.split('\n').length;
  42  |   const column = offset - prefix.lastIndexOf('\n');
  43  |   const input = page.getByRole('textbox', { name: 'Editor content', exact: true });
  44  |   await input.focus();
  45  |   // Monaco's Go to Line works on Windows and macOS. Check the app's reported
  46  |   // cursor before asking for options so a wrong keybinding cannot fake coverage.
  47  |   await input.press('Control+g');
  48  |   const location = page.locator('.quick-input-widget input');
  49  |   await expect(location).toBeVisible();
  50  |   // Retain the ':' quick-access prefix; removing it switches to symbol search.
  51  |   await location.fill(`:${line}:${column}`);
  52  |   await location.press('Enter');
  53  |   await expect(page.getByText(`cursor ${line}:${column}`, { exact: true })).toBeVisible();
  54  |   await input.press('Control+Space');
  55  |   const choices = page.locator('.suggest-widget.visible');
> 56  |   await expect(choices).toBeVisible();
      |                         ^ Error: expect(locator).toBeVisible() failed
  57  |   return choices;
  58  | }
  59  | 
  60  | async function expectUndoRedo(page: Page, before: string, after: string) {
  61  |   await expect.poll(() => copySource(page)).toBe(after);
  62  |   const input = page.getByRole('textbox', { name: 'Editor content', exact: true });
  63  |   await input.focus();
  64  |   await input.press('ControlOrMeta+z');
  65  |   await expect.poll(() => copySource(page)).toBe(before);
  66  |   await input.focus();
  67  |   await input.press('ControlOrMeta+Shift+z');
  68  |   await expect.poll(() => copySource(page)).toBe(after);
  69  | }
  70  | 
  71  | for (const eol of ['LF', 'CRLF'] as const) {
  72  | test(`Author categorical choices include built-in, document and loaded catalogs with exact ${eol} source undo/redo`, async ({ page }) => {
  73  |   const original = eol === 'CRLF' ? originalLF.replace(/\n/g, '\r\n') : originalLF;
  74  |   const { validatePresentation } = await import('@openpresentation/opf');
  75  |   expect(validatePresentation(document).errors).toEqual([]);
  76  |   // Use the app's browser-local workspace contract, including a loaded file
  77  |   // catalog. No remote catalog, account, or backend write is needed.
  78  |   const workspace: AuthorLocalWorkspaceV1 = {
  79  |     schemaVersion: 1, updatedAt: '2026-09-21T00:00:00.000Z',
  80  |     format: 'json', opfDraft: original, acceptedOpfText: original,
  81  |     gallerySources: [{
  82  |       id: 'local-test-catalog', name: 'Local test catalog',
  83  |       sourceType: 'local', contentType: 'file', enabled: true,
  84  |       kinds: ['layouts'], records: { layouts: [loadedLayout] },
  85  |       validation: { valid: true },
  86  |       createdAt: '2026-09-21T00:00:00.000Z', updatedAt: '2026-09-21T00:00:00.000Z',
  87  |     }],
  88  |     localVersions: [], ui: { centerTab: 'code', pinnedPaths: [] },
  89  |   };
  90  |   await page.addInitScript(({ key, workspace }) => {
  91  |     localStorage.setItem(key, JSON.stringify(workspace));
  92  |   }, { key: 'pptx-dev:author:local-workspace:v1', workspace });
  93  |   const errors: string[] = [];
  94  |   page.on('pageerror', error => errors.push(error.message));
  95  |   await page.goto('/author');
  96  |   await expect(page.getByRole('textbox', { name: 'Editor content', exact: true })).toBeVisible();
  97  |   await expect.poll(() => copySource(page)).toBe(original);
  98  | 
  99  |   const themes = await openChoices(page, original, 'theme', 'minimal');
  100 |   // Distinguish the shared catalog provider's labelled Enum Member from the
  101 |   // JSON worker's quoted schema example ("dark", Value).
  102 |   const dark = categoricalChoice(themes, 'Dark');
  103 |   await expect(dark).toBeVisible();
  104 |   await page.screenshot({ path: test.info().outputPath('author-theme-options.png'), fullPage: true });
  105 |   await dark.click();
  106 |   const themed = original.replace('"theme": "minimal"', '"theme": "dark"');
  107 |   await expectUndoRedo(page, original, themed);
  108 | 
  109 |   const layouts = await openChoices(page, themed, 'layout', 'text-1x');
  110 |   const local = categoricalChoice(layouts, 'AAA Document Layout');
  111 |   await expect(local).toBeVisible();
  112 |   await expect(categoricalChoice(layouts, 'AAB Loaded Layout')).toBeVisible();
  113 |   await page.screenshot({ path: test.info().outputPath('author-layout-options.png'), fullPage: true });
  114 |   await local.click();
  115 |   const withDocumentLayout = themed.replace('"layout": "text-1x"', '"layout": "document-layout"');
  116 |   await expectUndoRedo(page, themed, withDocumentLayout);
  117 | 
  118 |   const loadedChoices = await openChoices(page, withDocumentLayout, 'layout', 'document-layout');
  119 |   await categoricalChoice(loadedChoices, 'AAB Loaded Layout').click();
  120 |   const withLoadedLayout = withDocumentLayout.replace('"layout": "document-layout"', '"layout": "loaded-layout"');
  121 |   await expectUndoRedo(page, withDocumentLayout, withLoadedLayout);
  122 |   expect(JSON.parse(await copySource(page))).toEqual({
  123 |     ...document,
  124 |     design: { ...document.design, theme: 'dark' },
  125 |     slides: [{ ...document.slides[0], layout: 'loaded-layout' }],
  126 |   });
  127 |   expect(errors).toEqual([]);
  128 |   await page.screenshot({ path: test.info().outputPath('author-json-options.png'), fullPage: true });
  129 | });
  130 | }
  131 | 
```