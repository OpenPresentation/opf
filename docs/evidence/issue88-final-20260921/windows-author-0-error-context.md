# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: author-json-options.spec.ts >> Author categorical choices include built-in, document and loaded catalogs with exact LF source undo/redo
- Location: tests\e2e\author-json-options.spec.ts:65:5

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('.suggest-widget.visible').getByRole('option', { name: 'Dark, Enum Member', exact: true })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" locator('.suggest-widget.visible').getByRole('option', { name: 'Dark, Enum Member', exact: true }) with timeout 5000ms
  - waiting for locator('.suggest-widget.visible').getByRole('option', { name: 'Dark, Enum Member', exact: true })

```

```yaml
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
    - text: design.theme
    - form "Agent message composer":
      - group:
        - button "Choose File"
        - textbox "Agent message":
          - /placeholder: Paste OPF JSON, or sign in for AI...
        - group:
          - button "Attach source files": Attach
          - button "Submit": Sign in
    - button "try a sample"
    - button "warmer"
    - button "tighter"
    - separator "Resize Agent and Edit panes"
    - tablist "Document view":
      - tab "code" [selected]
      - tab "preview 1"
      - tablist "Editor format":
        - tab "JSON" [selected]
        - tab "YAML"
        - tab "MD"
    - code:
      - textbox "Editor content"
      - listbox "Suggest":
        - listitem "\"bold\", Value":  "bold"
        - listitem "\"classic\", Value":  "classic"
        - listitem "\"corporate-minimal\", Value":  "corporate-minimal"
        - listitem "\"dark\", Value":  "dark"
        - listitem "\"https://acme.com/decks/themes/acme-brand.json\", Value":  "https://acme.com/decks/themes/acme-brand.json"
        - listitem "\"minimal\", Value":  "minimal"
        - listitem "\"ocean-depth\", Value":  "ocean-depth"
        - listitem "\"pkg:@acme/decks/themes/acme-brand\", Value":  "pkg:@acme/decks/themes/acme-brand"
        - 'listitem "{\"id\":\"minimal\",\"background\":\"dark1\",\"dimensions\":\"widesc..., Value"': " {\"id\":\"minimal\",\"background\":\"dark1\",\"dimensions\":\"widesc..."
        - listitem "Bold, Enum Member":  Bold
        - listitem "Classic, Enum Member":  Classic
        - listitem "Dark, Enum Member":  Dark
    - text: cursor 5:15
    - separator "Resize Edit and right rail"
    - complementary:
      - tablist "Right rail":
        - tab "inspector" [selected]
        - tab "gallery"
        - tab "trace"
      - text: Selection
      - heading "design.theme" [level=2]
      - text: minimal doc › nested field
      - button "Pin this field as LLM context"
      - heading "Effective value" [level=3]
      - text: from Gallery Ref
      - paragraph: Minimal
      - paragraph: pptx.gallery
      - heading "Resolution" [level=3]
      - article:
        - text: "5"
        - heading "Authored" [level=4]
        - paragraph: minimal
        - paragraph: opf:$.design.theme
        - button "View raw"
        - button "Make winner" [disabled]
      - article:
        - text: "4"
        - heading "Gallery Ref" [level=4]
        - paragraph: pptx.gallery/themes/minimal
        - paragraph: pptx.gallery
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
        - paragraph: pptx.gallery/themes/minimal
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
- alert
- text: Loading...
```

# Test source

```ts
  1   | import { expect, test, type Page } from '@playwright/test';
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
  28  | async function openChoices(page: Page, source: string, field: 'theme' | 'layout', value: string) {
  29  |   const property = `"${field}": "${value}"`;
  30  |   const start = source.indexOf(property);
  31  |   expect(start, `Find the authored ${field} value`).toBeGreaterThanOrEqual(0);
  32  |   const offset = start + `"${field}": "`.length;
  33  |   const prefix = source.slice(0, offset);
  34  |   const line = prefix.split('\n').length;
  35  |   const column = offset - prefix.lastIndexOf('\n');
  36  |   const input = page.getByRole('textbox', { name: 'Editor content', exact: true });
  37  |   await input.focus();
  38  |   // Monaco's Go to Line works on Windows and macOS. Check the app's reported
  39  |   // cursor before asking for options so a wrong keybinding cannot fake coverage.
  40  |   await input.press('Control+g');
  41  |   const location = page.locator('.quick-input-widget input');
  42  |   await expect(location).toBeVisible();
  43  |   // Retain the ':' quick-access prefix; removing it switches to symbol search.
  44  |   await location.fill(`:${line}:${column}`);
  45  |   await location.press('Enter');
  46  |   await expect(page.getByText(`cursor ${line}:${column}`, { exact: true })).toBeVisible();
  47  |   await input.press('Control+Space');
  48  |   const choices = page.locator('.suggest-widget.visible');
  49  |   await expect(choices).toBeVisible();
  50  |   return choices;
  51  | }
  52  | 
  53  | async function expectUndoRedo(page: Page, before: string, after: string) {
  54  |   await expect.poll(() => copySource(page)).toBe(after);
  55  |   const input = page.getByRole('textbox', { name: 'Editor content', exact: true });
  56  |   await input.focus();
  57  |   await input.press('ControlOrMeta+z');
  58  |   await expect.poll(() => copySource(page)).toBe(before);
  59  |   await input.focus();
  60  |   await input.press('ControlOrMeta+Shift+z');
  61  |   await expect.poll(() => copySource(page)).toBe(after);
  62  | }
  63  | 
  64  | for (const eol of ['LF', 'CRLF'] as const) {
  65  | test(`Author categorical choices include built-in, document and loaded catalogs with exact ${eol} source undo/redo`, async ({ page }) => {
  66  |   const original = eol === 'CRLF' ? originalLF.replace(/\n/g, '\r\n') : originalLF;
  67  |   const { validatePresentation } = await import('@openpresentation/opf');
  68  |   expect(validatePresentation(document).errors).toEqual([]);
  69  |   // Use the app's browser-local workspace contract, including a loaded file
  70  |   // catalog. No remote catalog, account, or backend write is needed.
  71  |   const workspace: AuthorLocalWorkspaceV1 = {
  72  |     schemaVersion: 1, updatedAt: '2026-09-21T00:00:00.000Z',
  73  |     format: 'json', opfDraft: original, acceptedOpfText: original,
  74  |     gallerySources: [{
  75  |       id: 'local-test-catalog', name: 'Local test catalog',
  76  |       sourceType: 'local', contentType: 'file', enabled: true,
  77  |       kinds: ['layouts'], records: { layouts: [loadedLayout] },
  78  |       validation: { valid: true },
  79  |       createdAt: '2026-09-21T00:00:00.000Z', updatedAt: '2026-09-21T00:00:00.000Z',
  80  |     }],
  81  |     localVersions: [], ui: { centerTab: 'code', pinnedPaths: [] },
  82  |   };
  83  |   await page.addInitScript(({ key, workspace }) => {
  84  |     localStorage.setItem(key, JSON.stringify(workspace));
  85  |   }, { key: 'pptx-dev:author:local-workspace:v1', workspace });
  86  |   const errors: string[] = [];
  87  |   page.on('pageerror', error => errors.push(error.message));
  88  |   await page.goto('/author');
  89  |   await expect(page.getByRole('textbox', { name: 'Editor content', exact: true })).toBeVisible();
  90  |   await expect.poll(() => copySource(page)).toBe(original);
  91  | 
  92  |   const themes = await openChoices(page, original, 'theme', 'minimal');
  93  |   // Distinguish the shared catalog provider's labelled Enum Member from the
  94  |   // JSON worker's quoted schema example ("dark", Value).
  95  |   const dark = themes.getByRole('option', { name: 'Dark, Enum Member', exact: true });
> 96  |   await expect(dark).toBeVisible();
      |                      ^ Error: expect(locator).toBeVisible() failed
  97  |   await page.screenshot({ path: test.info().outputPath('author-theme-options.png'), fullPage: true });
  98  |   await dark.click();
  99  |   const themed = original.replace('"theme": "minimal"', '"theme": "dark"');
  100 |   await expectUndoRedo(page, original, themed);
  101 | 
  102 |   const layouts = await openChoices(page, themed, 'layout', 'text-1x');
  103 |   const local = layouts.getByRole('option', { name: 'AAA Document Layout, Enum Member', exact: true });
  104 |   await expect(local).toBeVisible();
  105 |   await expect(layouts.getByRole('option', { name: 'AAB Loaded Layout, Enum Member', exact: true })).toBeVisible();
  106 |   await page.screenshot({ path: test.info().outputPath('author-layout-options.png'), fullPage: true });
  107 |   await local.click();
  108 |   const withDocumentLayout = themed.replace('"layout": "text-1x"', '"layout": "document-layout"');
  109 |   await expectUndoRedo(page, themed, withDocumentLayout);
  110 | 
  111 |   const loadedChoices = await openChoices(page, withDocumentLayout, 'layout', 'document-layout');
  112 |   await loadedChoices.getByRole('option', { name: 'AAB Loaded Layout, Enum Member', exact: true }).click();
  113 |   const withLoadedLayout = withDocumentLayout.replace('"layout": "document-layout"', '"layout": "loaded-layout"');
  114 |   await expectUndoRedo(page, withDocumentLayout, withLoadedLayout);
  115 |   expect(JSON.parse(await copySource(page))).toEqual({
  116 |     ...document,
  117 |     design: { ...document.design, theme: 'dark' },
  118 |     slides: [{ ...document.slides[0], layout: 'loaded-layout' }],
  119 |   });
  120 |   expect(errors).toEqual([]);
  121 |   await page.screenshot({ path: test.info().outputPath('author-json-options.png'), fullPage: true });
  122 | });
  123 | }
  124 | 
```