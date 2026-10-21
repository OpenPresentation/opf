# OPF Editor

Unfinished prepared shaping work is preserved in the [September 15 roadmap](docs/roadmap-shaping-20260915.md); it is not part of the published runtime.

## Install the editor and optional export dependencies (RR-63)

`@openpresentation/opf-render` is an optional peer of the editor, and from render 0.16 its heavy pieces are optional peers too, so install only what you use. The editor itself draws with `@openpresentation/opf-render/svg` and loads fonts with `/fonts-browser`, which need nothing else. Add:

| You use | Also install |
| --- | --- |
| The canvas, the preview, SVG downloads in a browser (the host serves its own font files) | nothing |
| `loadFonts` from `/fonts-node` (a server, a test, a build script such as `npm run build:playground`) | the font packages of the pack: `@expo-google-fonts/roboto` and `roboto-mono` for `base`; also `arimo`, `caladea`, `cousine`, `gelasio`, `tinos` and `noto-sans` for `office`; a script face (`scripts: 'auto'`) needs its `@expo-google-fonts/noto-*` package. A missing one fails with `font-resource-unavailable` and names it |
| `toPng` / `toPdf` from the Node entries (`/png`, `/pdf`) | `@resvg/resvg-js` (and `sharp`, `pdf-lib` as the renderer's README says); a missing one fails with `converter-missing` |
| `convert` PDF (vector), PNG, SVG | nothing: the browser entry `@openpresentation/opf-render/export-browser` imports no converter |
| `convert` raster PDF (`raster: true`) | `pdf-lib`, imported by the page and passed as the `pdfLib` option (`import * as pdfLib from "pdf-lib"`); without it the conversion rejects with `converter-missing` |

```js
const pdfLib = await import("pdf-lib");
await convert(editor.presentation, { format: "pdf", raster: true, pdfLib, fonts });
```

The playground imports `pdf-lib` for you when its raster PDF choice is used.

## OPF 0.15: catalogs from the host, backgrounds and image blocks (FA-23)

The release after 0.14.2 moves the editor onto core 0.15 (a breaking, clean spec: no migration). See `changes/fa-23-opf-0-15.md`.

- **Catalogs come from the host.** Core ships no catalog records; the editor library imports no catalog data either. The host registers its catalogs once, on the session, and the editor hands that one list to core (resolution, validation, `embed`, `copySlides`, `updateFromCatalog`), every picker, the canvas renderer and the exports:

  ```js
  import { createEditorSession, saveDocument } from "@openpresentation/opf-editor";
  import { gallery as defaultCatalog, catalogDisplay } from "@openpresentation/gallery"; // the host app's choice, not the library's

  const editor = createEditorSession(doc, { catalogs: [defaultCatalog, acmeCatalog] }); // the first is the host default
  editor.catalogs;                      // the frozen list; editor.setCatalogs([...]) replaces it (one "catalogs" event)
  const { document } = saveDocument(editor); // core embed: every referenced record embedded once, renders with no catalog
  ```

  `mergeCatalogs(...lists)` is the one merge (the session's list first, the first catalog per `source` wins); `catalogsFor(editor, options)` is the list for one call. Pickers list core's `catalogRecords` and write the reference it gives, `id` or `name:id`.
- **Save and export embed.** `prepareSave`/`saveDocument`, `serializeOpfTransfer` (presentation and slide scope) and `convert` (`/export`) call core's `embed`; the playground's OPF download and PPTX export do too.
- **Paste** (`prepareOpfImport`, insert mode) uses core's `copySlides`: groups match by `source`, identical records are reused, and the result's `renamed` (`custom-conflict`, `catalog-revision`, `group-name`) and `addedGroups` tell the user what changed.
- **Update from catalog** is an explicit action: `checkCatalogUpdates(presentation, { catalogs })` lists the embedded records whose catalog record differs, and `applyCatalogUpdate(editor, { refs })` applies only the approved ones as one undoable step. The design panel's `catalog` section runs both and lists the `opf/unresolved-reference` and `opf/undeclared-catalog` findings (`referenceFindings(editor.validation)`).
- **Editing a catalog's record forks it.** An edit of a layout, theme, colour scheme or font scheme embedded under `catalogs.default` or a named group (from a panel, Properties, Source or any `applyPatch`) moves it into `catalogs.custom` as `<id>-custom` (or the id in `meta.forkIds["<group>:<kind>:<id>"]`), rewrites every reference to it and drops the original, in the same undo step. The change and the session event carry `forked` and a `notice` ("… is now this presentation's own; it no longer receives catalog updates"); approved catalog updates and `moveToCustom` change records in place (`meta.catalogRecordEdit: "in-place"`). `moveToCustom(editor, { group, kind, id }, { id })` is the explicit form, offered for `opf/catalog-record-not-in-source`.
- **Backgrounds** take the flat image form `{ type: "image", src, alt, fit, focus, opacity, recolor, overlay }` (fits `cover`, `contain`, `stretch`, `tile`) and the image-source shorthand, on the deck and on a slide. **Image blocks** carry their own fit, focus, treatments and placement (`/image-options`, the panel's `image` section): a full-bleed photo is a background, a picture beside the content is a placed image block. `design.imageFit` is the default fit of image blocks.

Editor 0.15.0 uses core `^0.15.1` and the optional renderer peer `^0.15.0`. Install renderer and PPTX 0.15 together for the coordinated canvas and export workflow. The shared APIs are core's `validate`, `Finding`, `resolveSlideContext` and the catalog helpers above, and the renderer's `loadFonts()` handle passed as `fonts` to the canvas, export, composition and pagination. Historical version changes are recorded in `CHANGELOG.md`.

Version 0.8.0 required `@openpresentation/opf` ^0.11.0, renderer ^0.9.0, and PPTX ^0.9.0. Named ColorRefs (scheme slots, roles, and `var:<id>`) paint through the published renderer and hex-resolve on export. Payload ids share the slide id namespace for pagination and transfer. Native `schemeClr`, theme write, and `p:hf` remain out of scope.

This checkout supports Node 22 or later (`engines.node` `>=22`; CI tests Node 22, 24 and 26). Versions 0.7.0 to 0.11.2 declared `24.x`, so npm on Node 22 or 26 silently installed an older release instead (RR-20); upgrade past 0.11.2. Use `.nvmrc` (Node 24) for local development. Earlier published versions retain their original engine declarations. Browser entrypoints remain browser-safe; native application compatibility is verified separately.

Version 0.7.0 forwards effective title alignment and shared outline placement options through composition and explicit pagination. Use the same fonts handle (and `textRasterPadding`) in canvas rendering and export. Accepted rich-text trace origins support selection, caret placement and undo. See the [source contract and limits](https://github.com/OpenPresentation/opf/blob/f94125a1ff95bf0974a055fe1c081d348dad54f2/docs/plans/text-placement.md); native PowerPoint fidelity remains separate.

Embeddable local editor primitives for Open Presentation Format documents. The package turns traced `@openpresentation/opf-render` SVG output into JSON-path-aware edits, validates OPF after each change, and records undo/redo as JSON Patch operations.

### Reusable JSON control (0.7.0)

Version 0.7.0 exposes `mountJsonCodeEditor` from `@openpresentation/opf-editor/json-editor` and `getJsonFieldContext` / `replaceFieldOption` from `/json-options`. Earlier published version 0.6.0 does not include these exports. They extract the code editing and contextual choices already used on openpresentation.org, so hosts can reuse them without replacing their surrounding UI.

```js
import { mountJsonCodeEditor } from '@openpresentation/opf-editor/json-editor';
const control = mountJsonCodeEditor(container, {
  code: source,
  label: 'OPF JSON document',
  lineNumbers: true,
  catalogs: editor.catalogs, // the host's Catalog[] (for example [defaultCatalog])
  onChange: nextSource => receiveDraft(nextSource),
  onError: error => showError(error),
});
// After a preview edit, send the updated source back through the same control.
control.update(nextSource);
// On unmount:
control.destroy();
```

The host owns the source draft, OPF validation, slide preview, persistence and session history. `onChange` includes invalid JSON while typing; keep the last valid preview until the draft validates. `update` applies external source without emitting `onChange` or creating a local undo step. It preserves unrelated edits through CodeMirror's history mapping; it is not a collaboration/conflict-resolution protocol. Importing either entrypoint does not require a DOM; mounting requires an existing browser container.

The control provides indentation, paired quotes/brackets, folding shortcuts, search, undo/redo, JSON syntax diagnostics and explicit formatting (`Cmd/Ctrl+Shift+F`). Enter at the end of a nonempty string array item supplies indentation, quotes and commas. Other Enter positions use ordinary JSON indentation. Source offsets are UTF-16 in the original authored string. Existing CRLF, CR and LF spellings survive ordinary edits and undo; new typed lines use the first existing separator. Paste retains the text delivered by the browser clipboard event. Explicit formatting deliberately standardizes whitespace, preserving JSON values and numeric lexemes.

Click a categorical property/value or press `Ctrl+Space`, `Cmd+Space` or `Alt+Down` to open its choices. Records the document embeds come first, then those of the catalogs the host passes as `catalogs` (`Catalog[]`, the session's registered list); there are no built-in records. The actual schema supplies enums and booleans. Prose and extension fields do not gain menus just because their keys resemble schema fields. External catalog URLs are not fetched. `setCatalogs(list)` replaces the host's catalogs and closes stale choices. Supply `onOptions(left?, top?)` to retain an existing menu UI.

In OPF 0.19, layout choices change only the template reference and preserve authored content. Empty regions remain available for explicit insertion; choosing a template does not invent blank payloads. The JSON field menu groups templates by intent and describes their supported regions. Hosts apply `replaceFieldOption` or `fieldOptionEdit(context, value)` as one undoable edit and check that `context.source` is still current.

Run `npm run test:json` and `npm run test:json-browser` for the focused model and offline browser checks. The browser runner also accepts a report path followed by a clean installed consumer directory. These checks cover the JSON control; renderer, native PowerPoint and production adoption remain separate acceptance steps.

Version 0.7.0 uses core 0.10.0 and renderer 0.8.0. Code source/metadata edits preserve line endings, literal tabs and cancellation/undo through accepted trace targets. Committed preview uses shared quote/code geometry; the active source textarea uses native browser editing. `paginateSlide` records a one-page readability-policy change in undo history, and an unchanged repeat is a no-op. Coordinated examples use PPTX 0.8.0 for exact code source/metadata recovery. Native formatting, font theme and geometry are not restored; quotes still import as editable text blocks with structure and readability-policy loss.

## Source pane (RR-98)

`createSourcePane` from `@openpresentation/opf-editor/source-pane` is the OPF source as JSON, YAML or Markdown, with the file name, the format menu, Format, Copy and Download, line numbers and the findings under the code. It is plain DOM and builds on `mountJsonCodeEditor`, `exact-source` and the field menu of `/json-options`; it adds no second editor and makes no network request.

```js
import { createSourcePane } from '@openpresentation/opf-editor/source-pane';
const pane = createSourcePane(container, {
  editor,                       // the editor session: every edit goes through editor.applyPatch
  name: 'deck',                 // shown as deck.opf.json; spaces and slashes become "-"
  onRename: name => save(name),
  format: 'json',               // 'json' | 'yaml' | 'md'
  onFormatChange: (format, previous) => remember(format),
  source: authoredJson,         // optional: the JSON bytes to keep (formatting, escapes, key order)
  findings: report.findings,    // or getFindings: () => validate(...).findings; default: the session's validation
  onFindingSelect: (finding, line) => reveal(finding.path),
  onCopy: file => clipboard.write(file.text),          // default: navigator.clipboard.writeText
  onDownload: file => saveAs(file.filename, file.text), // default: a Blob link named <name>.opf.<ext>
  density: 'comfortable',       // 'touch' makes the controls 40px
  readOnly: false,
  completions: true,            // live property and value suggestions while typing JSON (default true)
});
pane.setFormat('yaml'); pane.focusPath('/slides/1/title'); pane.getText(); pane.destroy();
```

Methods: `setFindings(list | null)`, `setFormat(format)`, `focusPath(pointer)` (moves the cursor to the line of a JSON Pointer in any format; exact for JSON, best effort for YAML and Markdown), `getText()`, `refresh()`, `setName`, `setDensity`, `setReadOnly` and `destroy()`. A finding is `{ path, message, severity, line? }` (core `Finding` objects fit). Rows show the path in mono and the line at the right; a click moves the cursor and calls `onFindingSelect`.

- **JSON is canonical** and keeps the author's bytes: a YAML or Markdown edit rewrites only the changed JSON tokens (`exact-source`), and Undo restores the exact spelling.
- **YAML and Markdown** are core's browser-safe converters, `@openpresentation/opf/yaml` and `/markdown`. Switching format writes the session's document in the new format. An edit parses back to the document and reaches the session as one `replace` patch, after a short delay (`applyDelay`, default 250 ms) so one burst of typing is one undo step. A syntax error, or an OPF rule the session refuses, is listed with its line and never reaches the document; Undo, Redo and outside edits replace a draft that did not parse.
- **Nothing is lost silently.** Markdown writes what its dialect has no syntax for (a `design`, region keys, nested groups) as YAML in `opf-slide` and `opf-block` fences; each such part is a warning finding with its JSON Pointer and reason. Comments in YAML cannot survive a rewrite from the document: Format and outside edits drop them and say how many. A document that is not valid OPF cannot be written as YAML or Markdown; the pane stays in JSON and says so.
- **Completions.** In JSON the pane offers property names and values as you type (`completions: false` keeps the field menu only): the keys the schema allows at the cursor's object, and the enum, boolean and catalog values of the field, from the same data as the field menu (`getJsonCompletions` in `/json-options`, which reads drafts that do not parse yet). Enter accepts, Escape closes, and Ctrl+Space or Alt+ArrowDown still open the field menu. YAML and Markdown keep the menu only. `mountJsonCodeEditor` takes the same `completions` option, off by default there.
- **Accessibility.** The editor's `aria-invalid` is `true` while the findings include an error and `false` otherwise. The format button (`aria-label="Source format"`) opens a `role="menu"` of `menuitemradio` items: Arrow keys, Home, End, Enter, Escape (focus returns to the button) and Tab. The file name is a button that becomes a text input; Enter or Escape commits. Controls show a 2px `--opf-ui-ring` focus outline.
- **Styles.** `src/styles/source-pane.css` uses only `--opf-ui-*` tokens under the `opf-source-` prefix. It ships in the editor's `styles.css` (`@openpresentation/opf-editor/styles.css`), which also defines the tokens.
- **Dependency.** `@codemirror/lang-yaml` (MIT) highlights YAML; Markdown uses a small stream tokenizer built on `@codemirror/language`, so no Markdown, HTML, CSS or JavaScript grammar is added.

Icons are inline paths from [Lucide](https://lucide.dev) (ISC license). The harness is `examples/source-pane.html` (built by `npm run build:playground`); `npm run test:source-pane-browser` drives it.

## Layout editor (RR-99)

`createLayoutEditor` from `@openpresentation/opf-editor/layout-editor` is a Figma-style GUI for building one layout record: a `direction` plus an ordered `regions` list of regions and splits (FA-33). It is plain DOM, styled only by `--opf-ui-*` tokens (`src/styles/layout-editor.css`, shipped in `styles.css`), and makes no network request. It is built from four parts that are exported separately, so a host can arrange them differently:

| Part | Export | Prefix |
| --- | --- | --- |
| Tool palette | `createLayoutToolPalette` | `opf-lx-palette`, `opf-lx-tool` |
| Canvas: a 16:9 slide frame with the region tree as labeled boxes | `createLayoutCanvas` | `opf-lx-canvas`, `opf-lx-node` |
| Layers: the tree of splits and regions, with the findings | `createLayoutTree` | `opf-lx-layers`, `opf-lx-tree` |
| Inspector: the properties of the selection | `createLayoutInspector` | `opf-lx-inspector` |

```js
import { createLayoutEditor } from '@openpresentation/opf-editor/layout-editor';
import { toSvg } from '@openpresentation/opf-render/svg';

const layoutEditor = createLayoutEditor(container, {
  record,                          // { id, name, direction, regions: [...] }; default: a title and one content region
  onChange: (record) => save(record),   // after each edit, undo and redo (not after setRecord)
  density: 'comfortable',          // 'touch' makes the controls 40px
  toSvg, fonts,                    // optional: Preview draws the sample slide with the host's renderer and fonts handle
});
layoutEditor.getRecord();          // a copy of the record
layoutEditor.setRecord(other);     // load a layout; clears the selection and the history
layoutEditor.getFindings();        // core's findings: { ruleId, severity, message, path, node, field }
layoutEditor.saveToDeck(session);  // writes catalogs.custom.layouts through saveCustomLayout, one undoable edit
layoutEditor.applyToSlide(session, 0); // saves, then makes it slide 0's layout, in one undoable edit
```

To arrange the parts yourself, create one model and pass it to each part; `saveLayoutToDeck(session, model)` and `applyLayoutToSlide(session, model, slideIndex)` are the deck functions the composed editor calls.

```js
import { createLayoutModel, createLayoutToolPalette, createLayoutCanvas, createLayoutTree, createLayoutInspector } from '@openpresentation/opf-editor/layout-editor';
const model = createLayoutModel({ record });
createLayoutToolPalette(paletteHost, { model, orientation: 'horizontal' });
createLayoutCanvas(canvasHost, { model });
createLayoutTree(layersHost, { model });
createLayoutInspector(inspectorHost, { model });
```

**Tools** (Figma-style shortcuts; the palette buttons have the same names): Select (V), Split into a row (R), Split into a column (C), Insert region (I), Heading regions (T), Hand (H, or hold Space) and Preview (P).
- **Select:** click a region to select it; click again inside a selected split to select what is inside. Esc selects the parent. Shift-click adds a sibling. Double-click or F2 renames in place.
- **Split into a row or column:** click a region. The original keeps its name and rules and the new one is called `region-N`; the tool returns to Select. In a list that already runs along that axis the new region is a sibling that shares the original's size, otherwise a split holds both. With a split tool active, Enter splits the selected region.
- **Insert region:** slots appear between siblings and at a split's edges; click one (or Tab to it and press Enter).
- **Heading regions:** a menu to add or remove the `title` and `subtitle` regions. Without a title region the engine adds an implicit title row, drawn as a dashed band.
- **Hand:** pan a zoomed slide (zoom buttons, Ctrl or Cmd with the wheel).
- **Preview:** placeholder blocks of each region's accepted kinds. With the host's `toSvg` (and its `fonts` handle) the sample slide is drawn by the renderer behind the region outlines; without them a wireframe is drawn. A layout with an error finding shows the wireframe.

**Direct manipulation on the canvas:**
- **Resize:** drag the divider between siblings. With other siblings the pair keeps its joint size and snaps to whole numbers and halves; alone in its list it snaps to the nearest whole-number ratio. The ratio shows while dragging ("2 : 1"); Shift skips snapping. Double-click a divider to make both sides equal. A divider next to an `auto` size is not a share and is fixed.
- **Reorder and move:** drag a region (or several selected siblings) before or after a sibling, or into another split, with a drop indicator; a refused drop (too deep, a split into itself) shows the reason. The same drag works in the layers panel.
- **Delete:** Delete or Backspace. A split left with one child collapses into it, and the child takes the split's size and inherited anchor. The last region of a layout is kept.
- **Context menu** (right click, the menu key or Shift+F10): wrap in row, wrap in column, unwrap, duplicate, delete, rename.

**Inspector:** with nothing selected, the layout (`id`, `name`, `summary`, `direction`, a default `anchor` that inherits down, `overflowRegion` as a picker over the body regions, and the design hints the record carries, which can be removed). A split has a `direction` toggle, `size` and `anchor`. A region has `name` (unique), `size` (a number, or `auto` only inside a column), `accepts` as chips (none selected means every kind), `role`, `flow`, `max`, `anchor` (shown as "Inherited" with its source while unset), `bleed`, `listColumns` and `empty`. A heading region takes only a size.

**Validation and history:** every edit is checked live by core (`opf/layout-template` and `opf/layout-region`, plus the schema); the finding's region is highlighted on the canvas and in the layers panel, its message is under the field, and the findings are listed under the layers (click one to select its region). Edits that would break the layout (more than three levels, more than twelve entries, a grid over 12 by 12 tracks) are refused with the reason. The editor has its own undo and redo (Cmd or Ctrl+Z, Shift+Z; the buttons in the top bar); one drag is one step and typing a value is one step. `saveToDeck` refuses a layout with an error finding and an id the deck already has, unless `replace: true`.

**Keyboard:** arrows move between siblings, Enter goes into a split and Esc goes up; `[` and `]` move a region earlier or later (at the end of a split it leaves the split); Shift with a bracket moves it into the neighboring split; Cmd or Ctrl+D duplicates; Delete deletes. A divider is `role="separator"` with `aria-valuenow` (the first side's share of the pair, in percent) and `aria-valuetext` ("2 : 1"); Arrow keys resize it by half a share (Shift: one), Enter makes the sides equal. The layers panel is `role="tree"` (Up and Down, Right to open or enter, Left to close or go to the parent, Home, End, F2). Every action is also a button in the inspector. Touch density makes controls 40px and the divider hit area wider; below 760px the palette is a row above the canvas and Layers and Inspector are tabs under it.

The headless operations the editor runs are in `@openpresentation/opf-editor/layout-tree` (`splitRegion`, `wrapNodes`, `unwrapNode`, `moveNodes`, `deleteNodes`, `duplicateNodes`, `resizeSizes`, `layoutBoxes` and more): pure functions that return a new record and the paths to select, or throw a `LayoutOperationError` with the reason, and keep a core-valid record core-valid. `npm run test:layout-editor-browser` drives `examples/layout-editor.html` (built by `npm run build:playground`); the playground's Layouts view mounts the same editor on the presentation's custom layouts. Icons are inline paths from [Lucide](https://lucide.dev) (ISC license).

## Scope

- Package: `@openpresentation/opf-editor`
- Repository: `OpenPresentation/opf-editor`
- License: MIT
- Compatibility target: `@openpresentation/opf`
- Renderer relationship: built on `@openpresentation/opf-render` trace output
- Headless JSON edit bindings for renderer trace attributes
- Structured catalog controls that only commit catalog references that resolve (in the document or the host's registered catalogs)
- JSON Patch state transitions with inverse patches for undo/redo
- Optional DOM controls plus React and Svelte bindings in separate embeddable entry points
- Dimension switches, safe block conversion and content actions (list levels, grouping, regions, images to design, slide split and merge), design-level options, table style and cell merge as headless APIs (`/switches`, `/block-convert`, `/content-actions`, `/design-options`, `/tables`, `/assets`, `/backgrounds`) and one accessible DOM panel (`/design-controls`)

- Dimension switches, safe block conversion, design-level options, table style and cell merge, captions, references, citations and footnotes as headless APIs (`/switches`, `/block-convert`, `/design-options`, `/tables`, `/assets`, `/backgrounds`, `/annotations`) and one accessible DOM panel (`/design-controls`)

## Live browser canvas

A timeline event's `status` (`done`, `current`, `planned`; core's `TimelineEvent.status`) is a menu in the canvas properties form and in the schema inspector, not free text; "Add" on a timeline adds an event with no status. The canvas draws it as the preview does, and a PPTX export keeps it.

The new `@openpresentation/opf-editor/canvas` entry provides a framework-independent SVG canvas with inline text/table-cell editing, live validated drafts, undo/redo, cancellation, and structured property forms for charts, lists, metrics, quotes, code, timelines and images. Mount it in a DOM container:

Chart options (RR-35): `@openpresentation/opf-editor/chart-options` edits a chart's `axisTitles`, `legend` and `dataLabels` as one undoable patch (`setChartOptions(editor, chartPath, { legend: "bottom", dataLabels: { position: "inside-end" } })`), and `@openpresentation/opf-editor/chart-options-panel` mounts the control panel (`createChartOptionsPanel(host, { editor, getSelectedPath })`). The panel offers only what the chart type can show. On a combo chart (FA-15) it also lists the series: a "Line" box per series sets `line` and a "Secondary axis" box per line sets `secondaryAxis` (`setChartOptions(editor, chartPath, { line: ["Margin"], secondaryAxis: ["Margin"] })`), and the secondary axis title field appears while a line uses that axis. At least one series stays columns and one is a line; `line` is written only when it differs from the default (the last series), and the secondary title goes with the last secondary line.

Chart highlight (FA-14): the same module edits `chart.highlight`: `setChartOptions(editor, chartPath, { highlight: { series: ["Revenue"], categories: ["Q3"] } })` replaces each listed part (an empty list removes it, `null` removes the field), refuses a name the chart does not have, and writes only what the chart type can highlight (core `chartOptionSupport(...).highlight`). `readChartOptions(chart, document)` returns the `choices` (plotted series and category labels, resolved through the document for a dataset chart), and the panel lists them as two groups of checkboxes ("Highlight series", "Highlight categories").

Chart colors (RR-96): the same module edits `chart.colors`, the colors by position, as one undoable patch: `setChartOptions(editor, chartPath, { colors: ["accent3", "#7B241C"] })` replaces the list (an entry is a hex color, a scheme slot such as `accent3`, which keeps following the deck and is written to PowerPoint as a theme color, or a `var:` color variable; `null` or `""` leaves that position to the deck palette, written as the palette color itself when a later position is set; `null` for the whole value removes the field; at most 24). `readChartOptions` reports what a position means (`colors.by`: the plotted series, the slices or rows of a pie, doughnut, treemap or funnel, or the colors a histogram, pareto or waterfall draws with; `colors.labels`) and the list as written (`state.colors`). The chart options panel gains a "Colors" group: one row per position with the deck's accent swatches, a "Default" choice and a hex field, plus "Reset to deck palette". The swatches come from `readSchemeSlots` (`/color-slots`), the deck's resolved scheme at a slide. The opf-render preview draws `chart.colors` once opf-render#256 lands; the document, Undo and the PowerPoint export carry it now.

```js
import { createCanvasEditor } from '@openpresentation/opf-editor/canvas';
import { saveDocument } from '@openpresentation/opf-editor';

const canvas = createCanvasEditor(container, {
  presentation,
  fonts, // the renderer's fonts handle: const fonts = await loadFonts({ faces, ... })
  onCommit: ({ editor }) => console.log(saveDocument(editor).document),
});
await canvas.ready;
// canvas.destroy() when unmounting.
```

Load the same font bytes into the browser with `loadFonts` from `@openpresentation/opf-render/fonts-browser` before mounting; the handle it returns is the one `fonts` option of the canvas, `convert` (`/export`), `editor.composeSlide` and `editor.paginateSlide`. The host owns font URLs, storage and collaboration. For non-Latin documents, pass the pinned script pack's location as `scriptBaseUrl` and the canvas calls `fonts.ensure(presentation)` after edits (`scripts: 'auto'`, FF-19): only the faces for the scripts a document draws are fetched, once, hash-verified, for example Noto Sans JP for Japanese; a Latin-only document fetches none. The playground does this from `./script-fonts/`, which `npm run build:playground` fills with the pinned faces. `onDraft` provides live document drafts; the session only changes on commit. Escape cancels. Concurrent edits to the selected payload cancel a stale draft.

Fonts load before pixels (FF-41). A document can need faces the browser has not loaded yet: script faces for the languages it draws and vendored preview faces for the font families it resolves (Intos for Aptos, Open Sans, Barlow). The handle knows what is missing (`fonts.pending(presentation)`) and loads it (`await fonts.ensure(presentation)`), so the canvas needs no separate gate: with the handle as `fonts` it never renders such a document early: on every path (editor changes, undo and redo, imports, dimension switches, slide changes, in-progress edits) it shows "Loading fonts…", loads the faces and then renders. A load that fails is reported through `onFonts`/`onError` and offers a retry button; nothing retries by itself, and the failed document is not drawn.

```js
import { createCanvasEditor, whenFontsReady } from '@openpresentation/opf-editor/canvas';
import { loadFonts } from '@openpresentation/opf-render/fonts-browser';

const fonts = await loadFonts({ faces, scriptBaseUrl, lazyFontsBaseUrl }); // a handle with no faces to load gates nothing
// The canvas draws with the session's registered catalogs (plus renderOptions.catalogs) and hands the same list to the handle, so
// font schemes only your catalogs know resolve in the registry too.
const canvas = createCanvasEditor(container, { editor, fonts });
// Other renders of your own: whenFontsReady(fonts, presentation, { ready: draw, failed: showError, loading: showSpinner })
```

`session.composeSlide(index, { fonts })` and `session.paginateSlide(index, { fonts })` take the same handle and resolve the slide's canvas, layout, theme, colour scheme and font families with core's `resolveSlideContext` (slide design, then deck design, then theme, then the engine default: the order the renderer and the PowerPoint export use) and the session's registered catalogs, so the editor composes what is drawn and exported. The slide it composes is `resolveSlideContext(...).slide`, so the organization logo references in its image fields (`var:organization.logo.icon` in a header or footer zone, an image block or a slide image) are already the right artwork for the slide's background (`onLight` on a light slide, `onDark` on a dark one); the cover and section logo and the zone parts come back in `composeSlide(index).logo` and `.furniture.parts` (each part is drawn from its `box`). A reference that resolves nowhere never throws: the slide composes automatically or with core's `ENGINE_DEFAULT_*`, and `onDiagnostic` hears each `unresolved-reference` diagnostic. The handle's `textMeasurement` is strict: for a document with a script the design font lacks (Japanese under Aptos) pass `{ fonts: { textMeasurement: createScriptTextMeasurement(fonts.textMeasurement, resolveScriptFonts(presentation, { slideIndex })) } }` (`createScriptTextMeasurement` is from `@openpresentation/opf-render/fonts`, `resolveScriptFonts` from `@openpresentation/opf/composition`), as `toSvg` does internally.

These APIs were introduced in 0.1.0. Version 0.7.0 requires core 0.10.0 and renderer 0.8.0 for the canvas, including shared accepted geometry, styled/merged cells, rich table values, headers and content-aware row heights. See the OPF repository’s `docs/live-editor.md` for setup, the support matrix and roadmap. `pnpm pack:ecosystem` in that repository also prepares local preview tarballs for coordinated development.

### Entering text editing

One click puts the caret where you click, the way PowerPoint and Google Slides do. Hover outlines a text target; a single press (mouse, pen, or a touch tap) on editable text selects the box, starts inline editing and places the caret at the nearest character boundary to the pointer (correct for wrapped, multi-line, centered and right-aligned text). Press and drag selects the range from the press point to the release point. While editing, a native double-click selects a word, a triple-click a line or paragraph, and a click elsewhere in the text moves the caret; clicking a different text target commits the current edit (an invalid edit still refuses) and enters the new one in the same click. Enter, Space or F2 on a focused target enters with **all** text selected (the keyboard replace convention); `canvas.beginEdit(path)` does the same. Escape leaves editing and keeps the box selected. Images, charts and other non-text targets are unchanged: a click selects, a double-click opens their properties. Layout handles and block controls keep their own pointer handling, and a text press never moves the box.

The gesture is configurable:

```js
createCanvasEditor(container, { presentation, textEntry: 'click' }); // default: one click enters
createCanvasEditor(container, { presentation, textEntry: 'dblclick' }); // one click selects, a double-click enters
```

`textEntry: 'dblclick'` keeps the older two-step gesture (select, then double-click) but a double-click now also places the caret at the pointer instead of selecting all text. Hosts and tests that used `dblclick()` and then relied on all text being selected should switch to keyboard entry (focus the target and press Enter) or select explicitly; `locator.dblclick()` on the default canvas now places the caret and then selects the word under it.

Plain-text carets are resolved from the rendered SVG glyphs: each line carries its exact source range (`data-opf-source-start`/`-end` or `data-opf-text-start`/`-end`), so collapsed spaces at wraps, tabs, CRLF sources and bidi isolate marks map to offsets of the input value rather than to glyph indexes. A line whose text does not match its traced source range falls back to a hidden copy of the positioned textarea. Rich text uses its own pointer-to-offset mapping. Mouse and pen enter on press; a touch tap enters on the tap, so scrolling with a finger never starts editing. Right-to-left and CJK use the same per-glyph mapping; real operating-system IME and bidi caret behaviour are not verified here.

The canvas retains canonical SVG glyphs while a transparent native input supplies the caret. Advanced shaping, freeform object positioning, all chart/media treatments, and cross-engine pixel identity remain work in progress. The Source dialog in the playground now provides a live JSON preview; changes are validated before committing.

### Input methods (IME): not certified

IME input is **not certified**. Real Japanese (Kana to Kanji), Chinese (pinyin) and Korean (Hangul) input methods have not been tested in this editor, on any browser or operating system; no run with a real input method is recorded (opf-editor#137). Only synthetic `CompositionEvent`s are tested (`test/rich-input-browser.mjs` dispatches `compositionstart`, an `insertCompositionText` input and `compositionend` on the rich-text input and checks that the canvas does not commit midway and that one Undo restores the original). Synthetic events do not reproduce a candidate window, a re-render during a composition, or the order of `keydown`, `compositionend` and `input` that real browsers and input methods produce, so treat inline editing with an input method as unverified until a pass is recorded.

What exists in the code (written for input methods, not verified with one):

- **Canvas** (`src/canvas.js`): the inline text input marks the field as composing between `compositionstart` and `compositionend` (no draft and no commit are made meanwhile, and the input is repositioned), ignores `keydown` while `isComposing` (so Enter and Escape that act on a composition do not commit or cancel the edit), and queues a draft when the composition ends.
- **Rich-text input** (`src/rich-text-input.js`): tracks composition, keeps the pre-composition value so one history step covers the composed text, and ignores `isComposing` key events.
- **Data grid** (`src/data-grid.js`): an Enter or Tab that confirms a composition is not treated as a command (`isComposing`).
- **Outline view** (`src/outline-view.js`) and the **design controls** (`src/design-controls.js`): Enter during a composition does not commit (`isComposing`).

Not tested at all, even with synthetic events: the data grid, the outline view and the design controls. Failures with a real input method are reported as defects with the input method named.

## List numbering (RR-33)

`@openpresentation/opf-editor/numbering` is the headless model and `/numbering-panel` the DOM control for the `numbering` field of `items` and `bullets` payloads (a style name, a `{ style, start, suffix }` object, or an array per list level). `setNumbering(editor, path, value)` numbers the list a path points at or into (`undefined` turns numbering off and drops the entry `start` values), `setEntryStart(editor, itemPath, start)` restarts the count at an entry, `numberingValue(levels)` writes the shortest form, `numberingState(presentation, path)` reads the settings and the markers the list draws, and `findNumberableLists(presentation, slideIndex)` lists a slide's lists. Each write is one validated, undoable session edit. `createNumberingPanel(container, { editor, getTarget, getSlideIndex, onStatus })` mounts the control: number this list, style, start and suffix, different numbering per level, the markers it will draw, and a restart at the selected entry. The playground opens it from **List numbering**. Needs a core release that ships `numbering`; see core's [numbered lists](https://github.com/OpenPresentation/opf/blob/main/docs/numbered-lists.md).

## Runtime Policy

The package runtime must stay local and deterministic:

- No hosted service in the critical path
- No telemetry or hidden analytics
- No commercial SDK dependency in the critical path
- No required network calls
- Host applications own auth, storage, queues, analytics, collaboration, branding, and product workflow

## Development

```sh
npm ci
npm run build
npm run typecheck
npm test
npm run validate
```

## Headless Editing

```js
import {
  createEditorSession,
  createSvgTraceBinding
} from "@openpresentation/opf-editor";
import { toSvg } from "@openpresentation/opf-render";

const editor = createEditorSession(opfDocument, { rejectInvalid: true });
const svg = toSvg(editor.presentation, 1, { trace: true, fonts });

preview.innerHTML = svg;
const binding = createSvgTraceBinding(preview.querySelector("svg"), editor, {
  onSelect(selection) {
    inspector.open({
      path: selection.path,
      value: selection.value,
      commit(value) {
        binding.commit(selection.element, value);
      }
    });
  }
});
```

Every change returns JSON Patch operations plus inverse operations:

```js
const change = editor.set("slides.0.title", "Quarterly plan");

change.patches;
// [{ op: "replace", path: "/slides/0/title", value: "Quarterly plan" }]

change.inversePatches;
// [{ op: "replace", path: "/slides/0/title", value: "Old title" }]

editor.undo();
editor.redo();
```

`createSvgTraceBinding` only reads `data-opf-path`; it does not require a hosted service, a second renderer, storage, analytics, auth, or product chrome. Host applications decide how selected paths appear in their own inspector UI.

## Catalog Controls

Catalog helpers commit catalog references (`id` or `name:id`) that resolve in the document or the session's registered catalogs, instead of accepting freeform incompatible values:

```js
import {
  createCatalogSelect,
  getCatalogOptions
} from "@openpresentation/opf-editor";

getCatalogOptions("themes", { editor }).map((option) => option.id); // references, embedded records first

const themeSelect = createCatalogSelect(editor, {
  path: "design.theme",
  catalogKind: "themes",
  label: "Theme"
});

toolbar.append(themeSelect);
```

References that resolve nowhere throw before they reach the document. Existing object-form references keep their sibling override fields and replace only `id`.

## Dimension switches

`@openpresentation/opf-editor/switches` turns "switch this pptx.gallery dimension to X" into one validated, undoable transaction. It covers the 14 gallery dimensions (FF-16, [font-fidelity-everywhere](https://github.com/OpenPresentation/opf/tree/main/docs/programs/font-fidelity-everywhere)) and, after them in `SWITCH_DIMENSIONS`, the two document-level choices the gallery does not page yet: `slide-sizes` and `purposes` (RR-41, [opf#293](https://github.com/OpenPresentation/opf/issues/293)):

```js
import { switchDimension, prepareDimensionSwitch, SWITCH_DIMENSIONS } from "@openpresentation/opf-editor/switches";

switchDimension(editor, "font-schemes", "georgia");                      // /design/fontScheme
switchDimension(editor, "charts", "line", { slideIndex: 1 });            // /slides/1/chart/type
switchDimension(editor, "blocks", "list", { path: "slides.2.blocks.0" }); // replace one block
editor.undo();                                                            // one step per switch
const { patches, presentation } = prepareDimensionSwitch(editor.presentation, "themes", "classic"); // preview only
```

| Dimension | Document patch | Notes |
| --- | --- | --- |
| `layouts` | `/slides/N/layout` | Needs `slideIndex`. Adds the blank payloads the layout declares, like the JSON editor's layout choice; existing content stays. |
| `color-schemes`, `font-schemes` | `/design/colorScheme`, `/design/fontScheme` | Deck by default, one slide with `slideIndex`. An inline object value is replaced by the bare id, except an accent font in a font scheme object, which stays (`{ id, accent }`). |
| `themes` | `/design/theme` | The theme's own color scheme, font scheme, background (and, at the deck, size) apply: overrides of those at the switched scope are removed, nothing is copied out of the record. On a slide whose deck sets one of them, the theme's value is written on the slide (its references qualified with the theme's catalog group). `bundle: false` changes only the reference. |
| `languages` | `/language` | A BCP-47 tag (`en-US`, `ja`) or a language object; `listSwitchOptions` offers core's `LANGUAGES`, labelled from `vocabularies.languages`. |
| `narratives`, `tones`, `audiences` | `/narrative`, `/tone`, `/audience` | Catalog references; `audiences` accepts one or an array. A custom narrative is a `catalogs.custom.narratives` record; slides keep their `beat` links. |
| `backgrounds` | `/design/background` | A background object or a shorthand string (theme slot such as `dark1`, a hex color, or an image source: a cover image). |
| `headers-footers` | `/design/header`, `/design/footer` | `{header?, footer?}`: an absent field stays, `null` removes it. |
| `image-treatments` | `<image block>/fit`, `/focus`, `/shape`, ... | Needs `path` (the image block). The fields of `setImageTreatment`; `null` removes one. |
| `socials` | `/speaker/socials/<platform>` or the `organization` | `{platform, handle}` with `owner` and `index`; the owner must exist. The platform is a key of core's `SOCIAL_PLATFORMS`. |
| `charts` | `<chart owner>/chart/type` | The slide's first chart, or the block named by `path`. The data is kept as it is and only the document schema is checked: switching does not verify that the data suits the new type (`compatibleChartTypes` lists the types the data can use; map types, for example, expect their own data). |
| `blocks` | replaces one block, or with `convert: true` moves its content to the new kind | `path` names a complete `blocks/N` block or a slide/region with one content field. The value is a block kind or a block object. See *Content-type conversion*. |
| `slide-sizes` | `/design/dimensions` | One of the schema's ten presets (`SLIDE_SIZE_PRESETS`: `16:9`, `4:3`, `16:10`, the social-feed ratios `1:1`, `4:5` and `9:16`, `letter`, `a4`, `widescreen`, `standard`). Deck only (`slideIndex` is refused: a presentation has one slide size). The preview recomposes at the new canvas and the PowerPoint export writes the matching `p:sldSz`; a custom size (inches) is replaced by the preset. `listSwitchOptions` labels each preset with its inches; `currentSwitchValue` reads `design.dimensions`, else the theme's size. A slide's design cannot set `dimensions`, so nothing shadows the deck's size. A deck-scope theme switch still writes its own size; a slide-scope one does not. |
| `purposes` | `/purpose` | A `purposes` catalog reference, any free-form goal text (not checked against the catalogs), or a Purpose object. `record` embeds a gallery item's purpose record. Authoring metadata: the preview does not change. |

A deck-level design switch cannot reach a slide that carries its own value for that key. The result lists those slides in `shadowed`; `clearSlideOverrides: true` removes the overrides in the same transaction. `record` embeds a gallery item's catalog record in the same transaction, under the group whose source is `recordSource` (else `custom`), when the document does not embed it yet. `catalogs` are the host's catalogs (merged after the session's when a panel calls the switch). Every switch is validated: an unknown catalog reference, an invalid value or an invalid resulting document throws before anything changes, and switching to the current value commits nothing. The editor session emits the usual `patch`, `undo` and `redo` events with `meta.source: "dimension-switch"` and `meta.dimension`, so the canvas and any host preview recompose from the switched document. `resolveSlideContext(presentation, slideIndex).options.fontFamilies` (core) returns the heading, body and code families the preview measures and the export names.

### Content-type conversion (RR-06, RR-26)

`blocks` replaces a block by default and discards its old payload. Pass `convert: true` (or call `convertBlock`) to move the block's own content into the new kind instead. A conversion keeps the user's content and never adds any: no value, label, date, number or sentence is invented, what a target kind cannot carry is reported in `loss` rather than dropped silently, and a pair with no meaningful mapping is refused. The converters themselves are pure functions in core, `@openpresentation/opf/convert` (see [content conversions](https://github.com/OpenPresentation/opf/blob/main/docs/conversions.md) for every pair, its loss report and the decisions behind them); this entry point is the transaction around them: it finds the block, guards the patch with a `test` of what it read, validates the document and applies one undoable step.

```js
import { convertBlock, blockConversionTargets, prepareBlockConversion } from "@openpresentation/opf-editor/block-convert";

blockConversionTargets(editor.presentation, "slides.2.blocks.0");
// [{ kind: "list", label: "List", available: true, lossless: true, loss: [] }, { kind: "metric", available: false, reason: "The first line is longer than 24 characters, ..." }, ...]
const change = convertBlock(editor, "slides.2.blocks.0", "list"); // one undoable step
change.lossless; change.loss; // for example [] or ["text formatting", "list nesting levels"]
convertBlock(editor, "slides.2.blocks.0", "table", {}, { delimiter: "," }); // the fifth argument is core's conversion options
switchDimension(editor, "blocks", "list", { path: "slides.2.blocks.0", convert: true }); // the same through the switch (`conversion` carries the options)
```

| From | To | What happens |
| --- | --- | --- |
| text | list | One item per line; indentation and `-`, `*`, `1.` markers become nesting levels (numbering is reported); blank lines are dropped and reported. Run formatting stays. |
| text | quote | The text is the quote. A trailing dash line (`— Name, Title`, `–`, `--`, `~`, `-`) is the attribution and a second one the source; only unambiguous endings are read. Formatting is flattened and reported. |
| text | metric | The first line (at most 24 characters) is the value (a canonical number becomes a number), the second the label, the rest the description. Refused when the first line is longer. |
| text | code | One fenced block gives the source, the language and the file name; nothing is guessed from the code. |
| text | timeline | One event per line; `2024 — Launch`, `Q1 2026: Pilot` and `Jan - Kickoff` give `when`; an indented line is the previous event's description. |
| text | table | A Markdown pipe table, tab-separated lines or a `delimiter`; refused without that structure. |
| list | text, timeline, table | Nesting becomes indentation (lossless) or is reported; a description is kept as an indented line or an event description; a table has one column, or text and description, with no invented headings. |
| quote, metric, code | text | The quote, then `— attribution` and `— source`; the metric as `value unit`, label, description and delta (a trend is reported as lost); code in a fenced block that keeps its language and file name. |
| timeline | text, list, table | `when: what` per event with the description indented; a table has `When`, `What`, `Description` columns for the fields in use. Lossless apart from the timeline name and description, and each event's `status`, which a conversion reports as lost (`timeline event status`). |
| chart | table | Inline data only. A chart's type is reported as lost. |
| table | chart | Needs a plain label for every column and numbers after the first; styled, merged or rich cells and external data are refused. |
| table | list, timeline, text, metric blocks | First column is the item; columns are read by heading (`When`, `What`, `Value`, ...); Markdown or tab-separated text. Dropped columns and headings are reported. |
| group of metrics | table | A group (or a slide, or a region) whose blocks are all metrics; only the columns in use. |

Images, videos and any other group have no conversion. Everything else is replacement. `blockPathForSelection(presentation, selectedPath)` maps a selection such as `slides.0.blocks.1.text` to its block for a host that offers the control on selection, and `metricGroupForSelection` finds the group of metrics around a selected metric. Conversions are guarded by a `test` operation, so one built from a stale read cannot overwrite a concurrent edit.

### Content actions (RR-26)

`@openpresentation/opf-editor/content-actions` holds the other pure transforms of core's `/convert` as editor transactions. Every action has a `prepare...` form that returns `{ presentation, patches, path, changed, lossless, loss, reason }` without touching a session (pass `{ validate: false }` for a dry run that only needs the loss report), and an applying form that is one guarded, validated, undoable step. A refusal throws `content-action-refused` with core's reason.

| Action | Applying form | What it does |
| --- | --- | --- |
| List levels | `shiftListItems(editor, listPath, [indexes], delta)` | Indent (`1`) or outdent (`-1`) items; a level is at most one deeper than the item above, items under a moved item move with it, nothing is lost. |
| Group | `groupBlocks(editor, containerPath, [indexes])`, `ungroupBlock(editor, groupPath)` | Wrap blocks of a slide or group in a group, or dissolve one (its composition and id are reported). |
| Regions | `placeBlocksInRegions`, `regionsAsBlocks`, `moveSlideRegion` | Give each block its own named region (no overlap), turn regions back into blocks in reading order (placement is reported), move or swap a region. |
| Images | `moveImageToDesign(editor, blockPath, "background" \| "watermark", options)`, `moveImageToContent(editor, slideIndex, source)` | Promote an image block to the slide's background (it keeps alt, fit, focus, opacity and overlay) or watermark and back; what the target cannot hold is reported. Bleeding an image to an edge beside the content is the block's `placement`, not a move. |
| Slides | `splitSlideByBlocks`, `splitSlideOnOverflow`, `mergeSlides`, `unpaginateSlides` | Split a slide by its blocks, or where it overflows through the existing pagination (the change carries `pages`), merge consecutive slides, and put paginated slides back together from `pages`. Each is one undo step made of per-slide `test`, `replace`, `remove` and `add` operations. |

The playground's Content tab mounts the block-level and slide-structure actions (`slide-content` section of `/design-controls`). Slide-level split and merge are in the playground's slide menu (the slide manager's `contentActions` option) as well as in the API.

### Pickers: options, chart types and current values

`listSwitchOptions(presentation, dimension, { catalogs, vocabularies })` lists what a dimension offers: a catalog dimension lists core's `catalogRecords` (the document's embedded records first, then the host catalogs'), each with the reference to write; `charts`, `socials` and `languages` list core's vocabularies, labelled from `vocabularies` (`catalogDisplay` from `@openpresentation/gallery`, supplied by the host). `compatibleChartTypes(presentation, { slideIndex, path })` lists the chart types the chart's inline data can use as it is, by data shape: the first column labels the categories and each further column is a series (how the renderers read it), a type with N series needs exactly N value columns, except that stacked types and the combo chart take that many or more (combo: two or more), and the single-series, distribution and geographic types are offered only where they fit. Switching a combo chart to another type removes its `line`, `secondaryAxis` and secondary axis title. It is data-shape compatibility, not a claim that an engine draws the type. `currentSwitchValue(presentation, dimension, { slideIndex })` reads the value back as `{ value, scope }`.

## Design options (RR-06)

`@openpresentation/opf-editor/design-options` edits the design-level settings that used to need All properties. Each call is one validated patch and one undo step, at the deck or on one slide with `slideIndex`; `null` removes a value so it is inherited again. `prepare...` forms return the patch without touching a session.

Color variants (RR-96, needs core 0.23): `@openpresentation/opf-editor/design-variants` edits `design.variant`, PowerPoint's Variants for the deck's one color scheme: a mapping over its twelve slots (never a second scheme) that says which slot is the background, and so the text and the alternate surface, plus an optional accent order. `setDesignVariant(editor, "dark1")` writes the slot name (so it keeps following the scheme), at the deck or on one slide with `{ slideIndex }`; `{ accents: [...] }` reorders the six accents and keeps the background; `null` removes the variant (a slide then follows the deck); `{ clearSlideOverrides: true }` also removes slides' own variants that would hide a deck change, and the result's `shadowed` lists the slides whose own variant or theme-slot background still does. `readDesignVariant` reports the scope's own variant and the effective one (core's resolution, so a theme-slot background or a picture's `tone` counts) and `variantSwatches` the four variants (`light1`, `light2`, `dark1`, `dark2`) as colors built from the deck's own slots, like PowerPoint's gallery. The design controls gain a "Color variant" section with those four swatches, "Same as presentation" on a slide, and an accent order control; the editor imports core's `normalizeColorVariant`, so it needs core 0.23 (the peer floor moves with the release). The preview and the PowerPoint export read the variant from core's roles (the renderer and exporter releases that follow core 0.23); the editor only commits the patch.

```js
import { setDesignOption, setOrganizationLogo, setHeaderFooterZone, insertZoneValue, insertZoneLogo, getDesignOption, designWarnings } from "@openpresentation/opf-editor/design-options";

setDesignOption(editor, "titleAlignment", "center", { slideIndex: 2 });   // /slides/2/design/titleAlignment
setDesignOption(editor, "watermark", { src: "asset:mark", opacity: 0.1 }); // merges into an existing watermark; false hides an inherited one
setOrganizationLogo(editor, "all", "asset:logo");                         // organization.logo: one image for every shape
setOrganizationLogo(editor, "icon", "asset:mark-white", { background: "onDark" }); // a shape's own image for dark backgrounds (the rest keeps what it had)
setDesignOption(editor, "logo", { organization: "beta", shape: "icon" });  // design.logo = "var:organization.beta.logo.icon"; false draws none, null the primary organization's
setHeaderFooterZone(editor, "footer", "right", { text: "{{slide.number}} / {{deck.slideCount}}" });
insertZoneValue(editor, "footer", "left", "organization.name", { start: 0, end: 0 }); // puts {{organization.name}} at the start of the left text
insertZoneLogo(editor, "header", "left");                                  // the zone's image becomes var:organization.logo.icon
```

| Option | Writes | Values |
| --- | --- | --- |
| `titleAlignment`, `contentAlignment` | `design.titleAlignment`, `design.contentAlignment` | `left`, `center`, `right` |
| `contentDirection` | `design.contentDirection` | `horizontal`, `vertical` |
| `chartPrimary` | `design.chartPrimary` | `none`, `top`, `bottom`, `left`, `right` |
| `listBullet` | `design.listBullet` | `character`, `image` (picture bullets draw the logo) |
| `contentBox` | `design.contentBox` | `true`, `false` |
| `imageFit` | `design.imageFit` | `cover`, `contain`, `stretch`: the fit of image blocks that choose none |
| `accentFont` | `design.fontScheme.accent` | a family name; the font scheme becomes its object form and collapses back to the bare id when the accent is cleared |
| `logo` | `design.logo` | which organization's logo covers, sections and picture bullets draw: `null` (the primary organization's, the default), `false` (none), a reference such as `"var:organization.beta.logo.icon"`, or `{ organization, shape }` (an organization id and a shape) to write one. A reference to an organization the deck does not have is refused (`unknown-organization`). `readLogoChoice` reads it as `{ mode: "primary" \| "none" \| "reference" \| "custom", organization?, shape?, scope, inherited }`; `parseLogoReference` and `logoReference` convert between the string and `{ organization, shape }` |
| the organization's logo | `organization.logo` (deck only; not a `setDesignOption` option) | `setOrganizationLogo(editor, shape, source, { background, organization })` sets or clears (`null`) it: `shape` is `"all"` (one image for every shape: `organization.logo` is that image) or one of `LOGO_SHAPES` (`full`, `stacked`, `icon`, `wordmark`); `background` is `"both"` (default), `"onLight"` or `"onDark"` (a different image on light or dark slides; the other keeps what the shape had, and a plain image counts as both); `organization` is an index or id (default: the primary organization, `role: "primary"` else the first). A bare logo is the full logo, so setting a shape keeps it as `full`, and a lone plain `full` collapses back to the bare image. `readOrganizationLogo` reads `{ organization, all, shapes }` and `listOrganizations` lists `{ index, id, name, primary, hasLogo }` |
| `watermark` | `design.watermark` | `false`, a source, `{ src, opacity }` or the text stamp `{ text, opacity }` (fields merge; a lone source stays a bare source; setting `text` drops `src` and setting `src` drops `text`: a watermark is one or the other) |
| header and footer zones | `design.header` / `design.footer` `.left/.center/.right` | `setHeaderFooterZone` merges every part a zone can hold (`text`, `image`, `date` (true, or a fixed date) and `dateFormat`, `socials`; `ZONE_FIELDS`) into one zone, checking each value. Generated values are `{{ }}` variables written in `text`, in the order the author wants and with `\n` between lines: `{{slide.number}}`, `{{deck.slideCount}}`, `{{slide.section}}`, `{{organization.name}}`, `{{speaker.name}}`, `{{deck.name}}` (the entries of `ZONE_VALUES`, the panel's "Insert value" menu). `insertZoneValue(editor, which, zone, name, { start, end, text, slideIndex })` puts one token into a zone's text at UTF-16 offsets (a selection is replaced; the end by default; `text` when a text box holds typing that is not committed yet) as one undoable, validated edit, and `prepareZoneValue` returns the patch without a session. The logo is the zone's `image`, a reference to the organization's logo: `insertZoneLogo(editor, which, zone, { shape, organization, slideIndex })` writes `var:organization.logo.<shape>` (`icon` by default, which fits a zone; `full` is plain `var:organization.logo`; `organization: "beta"` writes `var:organization.beta.logo.<shape>`) as one undoable, validated edit, replacing an image the zone had, and `prepareZoneLogo` returns the patch without a session. Which artwork is drawn (`onLight` or `onDark`) follows each slide's background. The 0.17 `logo: true` and the 0.16 fields `organization`, `speaker`, `section`, `slideNumber` and `slideNumberFormat` are gone with no alias (`{current}` and `{total}` too), and are refused with a message that says what to write instead. A removed field, an emptied zone and an emptied header are all deleted rather than left as `{}`; a removed field, an emptied zone and an emptied header are all deleted rather than left as `{}`. A slide's own header or footer replaces the deck's whole one, so the first edit on a slide starts from a copy of the deck's (its other zones stay), and a slide emptied that way hides the furniture (`false`) instead of inheriting it again |

A deck-scope change reports `shadowed` slides whose own design hides it (`clearSlideOverrides: true` removes those values in the same transaction). Results carry `warnings`: a zone image or `design.logo` that names a logo no organization has, or picture bullets (they use the icon shape) with no logo to draw, is reported as `unresolved-logo`, and a zone that shows the organization's social profiles when there are none, or whose text uses a deck-wide variable the document has no value for (`{{organization.name}}` without an organization, `{{speaker.name}}` without a named speaker), or `{{slide.section}}` on a slide without a section, as `unresolved-content`, before export, as `designWarnings(presentation, slideIndex)` does for the current document. `DESIGN_OPTIONS` describes every option for a generic panel, and `getDesignOption` reads `{ value, scope, inherited }`.

### Image uploads (RR-06)

`@openpresentation/opf-editor/assets` turns a local file into an `assets` entry and uses it in the same undoable patch:

```js
import { applyImageUpload } from "@openpresentation/opf-editor/assets";
import { prepareOrganizationLogo } from "@openpresentation/opf-editor/design-options";

const change = await applyImageUpload(editor, file, (reference, presentation) => prepareOrganizationLogo(presentation, "icon", reference, { background: "onDark" }), { alt: "Acme logo" });
change.assetId; // "acme-logo": the document now has assets["acme-logo"] = { src: "data:image/png;base64,...", mediaType, title, alt } and organization.logo.icon.onDark = "asset:acme-logo"
```

`build(reference, presentation)` is any `prepare...` function of this package, so the same upload works for the organization logo (one image for every shape, or each shape for both, light or dark backgrounds), watermark, a background (`prepareBackground`) and a header/footer zone image. The file is checked before anything changes: PNG, JPEG, GIF, WebP or SVG by its bytes (a `.jpg` that is really a PNG, a text file, an empty file and an SVG with script are refused), and at most `maxBytes` (default 2 MiB, `DEFAULT_MAX_IMAGE_BYTES`) with a message that says what to do. A host that stores images elsewhere passes `onAddAsset({ name, mediaType, bytes, size, alt, file })` and returns the reference to use (a web address, or an `asset:` id it added); nothing is then added to `assets`. `setAssetAlt` edits an asset's alt text as one step.

### Backgrounds (RR-06)

`@openpresentation/opf-editor/backgrounds` covers every background form the schema has: a theme slot, a solid color, a linear gradient, an image and a pattern, each with an optional opacity. The image form is flat (OPF 0.15): `{ type: "image", src, alt, fit, focus: { x, y }, opacity, overlay: { color, opacity, edge?, size? } }`, with the fits `cover`, `contain`, `stretch` and `tile`; a plain cover image is stored as the shorthand string (an `asset:`, `https://`, `data:`, `./` or `../` source). A background never moves content; with `alt` it is meaningful (PowerPoint export draws a picture at the back that carries the text).

Colors are ColorRefs: hex, a scheme slot or role (`accent1`, `surface`, ...) or `var:<id>`. `normalizeBackground` validates with sentences a person can act on (at least two stops, positions 0 to 1, a color that is none of the above), `setBackground(editor, spec, { slideIndex })` is one undoable patch through the `backgrounds` switch, `null` removes the background so the theme's (or the deck's) shows again, and `readBackground` flattens the current one for a form. `PATTERN_PRESETS` is the 54 DrawingML presets (`PATTERN_GROUPS` groups them in five families); PPTX export writes them as native pattern fills and import returns the same name. Radial gradients are not part of the OPF schema (a gradient has an angle and stops), so there is no radial control.

### Image blocks (FA-22, OPF 0.15)

`@openpresentation/opf-editor/image-options` frames one image block: `setImageTreatment(editor, "slides.1.blocks.0", { fit: "contain", focus: { x: 0.5, y: 0.3 }, shape: "rounded", cornerRadius: 0.1, border: { color: "dark1", width: 4 }, opacity: 0.9, recolor: "grayscale", overlay: { color: "dark1", opacity: 0.4, edge: "bottom", size: 0.25 }, aspectRatio: 1.78, placement: { edge: "right", size: 0.45, inset: false } })` is one validated, undoable patch (`null` removes a field), and `readImageTreatments(presentation, path)` reads them back with `placeable` and the `usedEdges` other placed blocks take. Placement bleeds the block to one slide edge and composes the title and content in the rest; only a top-level block (`slides.N.blocks.I`) can be placed, at most one per edge, and the slide's own `image` takes no framing fields (`placement-not-top-level`, `placement-edge-taken`). The design panel's `image` section shows these controls for the selected image block.


## Footnotes, citations and captions (RR-34)

`@openpresentation/opf-editor/annotations` edits the core RR-34 fields as validated, undoable session edits (a `test` guard on the edited container, then one replace), so the canvas redraws the caption band, the superscript markers and the slide's footnote area, and Undo restores the document:

```js
import { setCaption, addReference, citeRun, setFootnote, listCitations, referencesSlideFor } from "@openpresentation/opf-editor/annotations";

setCaption(editor, "slides.1.blocks.0", { text: "Figure 1. Adoption by year", align: "center" }); // image, chart, table or video block
addReference(editor, { id: "gartner-2026", text: "Gartner, Market Guide, 2026", url: "https://www.gartner.com" });
citeRun(editor, "slides.0.text.0", "gartner-2026"); // the run shows a superscript marker; the slide lists the reference
setFootnote(editor, "slides.0.text.1", "Internal forecast, not audited.");
listCitations(editor.presentation); // the numbering every engine draws: notes, references, per-slide markers, unused ids
referencesSlideFor(editor.presentation, { title: "Sources" }); // an ordinary list slide to insert
```

`captionTargets`, `readCaption`, `listReferences`, `updateReference`, `removeReference` (refuses while a run cites the id unless `force`, which also removes those cites), `unciteRun` and `runAt` complete the set; every `prepare*` variant returns the patches and the validated candidate without applying them. A string run becomes an object run when it gains a cite or footnote and returns to a string when nothing is left. The module needs the core that ships the fields; on an older core `listCitations` and `referencesSlideFor` throw `annotations-unavailable`.

## Table style and cell merge (RR-06)

`@openpresentation/opf-editor/tables` edits the styled-cell structure with one guarded patch per call (a `test` of the table, then a replace), so the canvas draws the styled and merged table and Undo restores it:

```js
import { setTableStyle, mergeTableCells, splitTableCell, setTableCellStyle, parseTableCellPath } from "@openpresentation/opf-editor/tables";

setTableStyle(editor, "slides.4.blocks.1.table", "banded");                  // or { header: "accent", banding: true, borders: "horizontal" }
mergeTableCells(editor, "slides.4.blocks.1.table", { section: "body", row: 1, column: 0 }, { colSpan: 3 });
splitTableCell(editor, "slides.4.blocks.1.table", { section: "body", row: 1, column: 0 });
setTableCellStyle(editor, "slides.4.blocks.1.table", [{ section: "header", column: 0 }], { fill: "accent", align: "center" });
setTableCellStyle(editor, "slides.4.blocks.1.table", { section: "body", row: 2, column: 3 }, { bold: true }); // a bold number cell keeps its column format and alignment; { bold: null } removes it
```

Styles use scheme roles, so they follow the color scheme, and the renderers keep the text readable on any fill. A style sets the header fill (`theme`, `plain`, `accent`), banded rows and borders (`theme`, `none`, `horizontal`, `grid`); named presets are `theme`, `banded`, `grid`, `minimal` and `open`, and `theme` removes a previous style. A style owns only the fill and border fields of a cell: text color, alignment, bold, padding, values and merges are kept. To bold one cell, set `bold: true` on its style with `setTableCellStyle` (the panel's Bold checkbox does): the cell stays a plain value in a numeric column, so it keeps the column's number `format` and alignment, which rich runs would drop (needs core with `TableCellStyle.bold`). Merging never hides text: covered cells that hold text refuse with `merge-would-lose-content` unless you pass `join: true`, which joins the words into the anchor with a space and keeps run formatting. Other refusals are `merge-overlap` (the region crosses another merge), `invalid-table-span` (outside the table, or a header cell spanning into the body) and `table-cell-covered`. Splitting leaves the formerly covered cells as empty text. `parseTableCellPath` maps a canvas selection to a table and cell, and `describeTableCell` and `readTableStyle` read the current state.

Table alt text (FA-27): `setTableAlt(editor, tablePath, { alt: "North America leads EMEA in Q4." })` writes the table's text alternative (`Table.alt`) as one undoable patch, like a chart's. `alt` is trimmed and an empty string or `null` removes it; `{ decorative: true }` writes the empty alt (decorative, and it wins over `alt`) and `{ decorative: false }` removes an empty alt. It works on a table that shows a shared dataset too, since the alt belongs to the table and not to its data. `readTableAlt(table)` gives `{ alt, decorative }` for a form and `prepareTableAlt` is the headless patch. The table section of the design controls has an "Alt text" field and a "Decorative (no alt text)" box, and find and replace searches `table.alt`. `validate` does not ask for a table alt, so the field is optional.

## Slide management (RR-21)

`@openpresentation/opf-editor/slides` adds, duplicates, deletes, reorders, hides and sections slides. Every function has a `prepare…` form that returns the JSON Patch for a document without touching a session (`{ presentation, patches, changed, selection }`), and an apply form that commits it as ONE validated, undoable change, so a single Undo restores the deck exactly and the preview, thumbnails and PPTX export follow from the document. An operation that changes nothing commits nothing (`changed: false`).

```js
import { addSlide, duplicateSlides, removeSlides, moveSlides, moveSlidesBy, setHidden, addSection, renameSection, removeSection, moveSection, setSection, listSections } from "@openpresentation/opf-editor/slides";

addSlide(editor, { at: 2, layout: "agenda" });    // OPF 0.19: an adaptive template accepts content in named regions
duplicateSlides(editor, [1, 3]);                  // copies follow the last selected slide, with fresh ids (also for content ids)
removeSlides(editor, [4]);                        // a deck keeps at least one slide: cannot-remove-all-slides
moveSlides(editor, [0, 1], 5);                    // `to` is the drop gap in the original order (0 to the slide count)
moveSlidesBy(editor, [2], -1);                    // Alt+Up: a block moves together, a scattered selection one place each
setHidden(editor, [3], true);                     // OPF `hidden: true`; showing removes the field. Omit the flag to toggle.
addSection(editor, 3, "Details");                 // a section starts at slide 3 and runs to the end of its current section
```

Sections are OPF's `section` label on each slide: consecutive slides with the same label form a section, slides without a label form an unnamed run (`listSections` returns `{ index, name, start, count, unnamed }`). Moving slides takes a section decision, `section: "adopt"` (default: the slides join the section of the slide just before them, or after them at the start), `"keep"`, a name, or `null`; drag and drop passes the section of the slide you drop beside, and dropping on a section header starts that section. `renameSection`, `removeSection` (its slides join the section before; `deleteSlides: true` deletes them too) and `moveSection` take an index from `listSections`. Collapsing a section in the list is view state, not part of the document.

`@openpresentation/opf-editor/slide-manager` mounts the slide list as the navigator or, with `variant: "sorter"`, as a thumbnail grid. It selects (click, Ctrl/Cmd+click, Shift+click, Shift+arrows, Ctrl+A), reorders by drag and drop and by keyboard (Alt+arrows; Alt+Left and Right in the sorter), duplicates (Ctrl/Cmd+D), deletes (Delete), and has a toolbar and a context menu (the context menu key, Shift+F10 or a right click) with hide, sections, move to start or end, add with layout and, when the host passes the RR-26 split and merge functions as `contentActions`, split and merge. Every result is announced in a polite live region; the roving tab stop is the current slide; the card names say position, title and whether the slide is hidden or selected.

```js
import { createSlideManager } from "@openpresentation/opf-editor/slide-manager";
const manager = createSlideManager(document.querySelector("#slide-list"), {
  editor, getSlideIndex: () => current, setSlideIndex: (index) => { current = index; redraw(); },
  renderThumbnail: (deck, index) => toSvg(deck, index + 1, { fonts, trace: false }), toolbar: document.querySelector("#slide-toolbar"),
  contentActions, // optional: { splitSlideByBlocks, mergeSlides } from "@openpresentation/opf-editor/content-actions"
});
editor.subscribe(() => manager.render());
```

OPF layouts are one ordered list of named content regions, nested with splits for two dimensions (a record has a `direction` and `regions`). The slide manager's `openLayoutPicker("apply")` groups the 28 built-ins by intent and applies one to the current slide; `openLayoutPicker()` adds a slide. Pass `renderLayoutPreview(presentation, slideIndex, choice)` to render the current slide with each candidate through the shared renderer. The picker shows the record's `preview` when supplied, otherwise a diagram of its regions and splits. It retains content when switching.

Layouts are built with the layout editor (see [Layout editor](#layout-editor-rr-99)); it replaces the earlier `openCustomLayoutEditor` dialog. The headless `layoutFromRegions`, `prepareCustomLayout`, `saveCustomLayout` (with `{ replace: true }` to edit a layout the deck already has) and `pinBlockToRegion` operations are in `/layout-templates`. Canvas Arrange mode shows every template region; empty ones say “Drop content here”, and a top-level block can be dragged or chosen by keyboard for a validated region pin. A full or incompatible region refuses the edit instead of silently ignoring the pin. The host registers the 0.19 catalog with the session; the editor ships no catalog data.

`@openpresentation/opf-editor/outline` and `/outline-view` edit the deck as an outline: a row per slide title, subtitle, text paragraph and list item, and a read-only row for content that is not text (a chart, a table, an image) or text that carries formatting, so nothing is flattened away. Typing commits as one change when the row loses focus or on Enter. Enter adds a line (after a title: a slide), Alt+Up and Alt+Down move a bullet with the bullets nested under it, or a slide with its text, Alt+Shift+Right demotes and Alt+Shift+Left promotes. Demoting a bullet nests it (`level`); promoting a top-level bullet turns it into a new slide that takes the bullets after it; demoting a plain slide makes it a bullet of the slide before it (refused, with the reason, when that would drop content such as notes, blocks or a design). Backspace on an empty line removes it. Tab keeps moving focus, so the outline is no keyboard trap.

## Slide navigator and thumbnail strip (RR-98)

Two framework-neutral DOM factories for the slide row under the canvas. Both follow the editor session on their own, take `density: "comfortable" | "touch"` (32px or 40px controls) and style themselves with the `--opf-ui-*` tokens (`src/styles/navigator.css` and `thumbnails.css`, part of `styles.css`; no fallbacks). Icons are the Lucide ChevronLeft and ChevronRight paths (ISC license), inlined; nothing loads from a network.

`@openpresentation/opf-editor/slide-navigator`: previous and next buttons around a mono counter ("01 / 03"; both numbers pad to the width of the slide count, so "001 / 120" from 100 slides). The buttons disable at the ends, and focus moves to the other one when the pressed one disables. With the navigator focused, Left, Right, Up, Down, Home and End move; `bindKeys(target)` adds page-level Left and Right that ignore typing in inputs, selects and editors (CodeMirror, contenteditable), menus, dialogs, modified keys and events another handler already took.

```js
import { createSlideNavigator } from "@openpresentation/opf-editor/slide-navigator";
const nav = createSlideNavigator(document.querySelector("#slide-nav"), {
  editor, slideIndex: current, density: "comfortable",
  onChange: (index) => { current = index; redraw(); },   // the user moved (also when a shrinking deck clamps the index)
  labels: { previous: "Previous slide", next: "Next slide" },
});
nav.bindKeys(document);   // returns an unbinder; destroy() removes every listener
nav.setSlide(3);          // show a slide the host chose; no onChange
nav.refresh();            // the count follows the editor by itself; pass `presentation` (an object or a function) instead of `editor` for a static deck
```

`@openpresentation/opf-editor/thumbnail-strip`: a `nav` of real slide renders. Each item shows a mono index and the slide title ("Untitled" when it has none); the current one has `aria-current="true"`, an accent ring and is scrolled into view (the strip scrolls itself, never the page). It is horizontal by default; `orientation: "vertical"` stacks it. Arrow keys move focus along the strip (one tab stop), Enter or Space chooses. Thumbnails use the renderer, catalogs and fonts handle the canvas uses (`fonts`, `renderOptions`), wait for the faces the document needs, and are lazy: the items near the viewport draw first through IntersectionObserver (everything draws at once without it, or with `lazy: false`).

```js
import { createThumbnailStrip } from "@openpresentation/opf-editor/thumbnail-strip";
const strip = createThumbnailStrip(document.querySelector("#thumb-strip"), {
  editor, fonts, renderOptions: { catalogs }, slideIndex: current, size: 128,
  onSelect: (index) => { current = index; redraw(); },
});
strip.setSlide(current);               // follow the host
strip.refresh({ clear: true });        // redraw now; clear drops the cache (after the host loaded fonts)
```

Thumbnails are cached by `@openpresentation/opf-editor/thumbnail-cache` (`createThumbnailCache({ toSvg, getOptions })`, promoted from the playground example with the same behavior). An entry is keyed by the slide's index, the slide count and the slide's own content, so an edit renders only the slides it changed, in one `toSvg` call that resolves the deck once. Deck metadata, section labels, registered catalogs and render settings are the cache's context: a change to any of them drops every entry, because inherited furniture and design change other slides too. `prepare(deck, indices)` renders only the listed slides, which is how the strip stays lazy. Share one cache between views with the strip's `cache` option.

## Data grid (RR-24)

`@openpresentation/opf-editor/data-grid` mounts a spreadsheet-like grid for a chart's inline data (the first column is the categories, each further column a series; an empty cell is a gap, never 0) and for tables (rich and styled cells, merged cells drawn with their spans). Cells edit from the keyboard (arrows, Enter, F2, Tab), paste TSV or CSV from Excel and Sheets, copy out as TSV, and rows and columns insert, delete and move, sort (stable and typed) and, for charts, swap. Numbers are read in one stated number format, never guessed; text that is not a number is refused inline with the reason. Every edit is one undoable patch, so the preview redraws from the session events.

```js
import { createDataGrid } from "@openpresentation/opf-editor/data-grid";
import { insertTableRows, deleteTableColumns, sortTableRows, setTableHeader } from "@openpresentation/opf-editor/tables";
import { setChartCells, transposeChart, renameChartSeries } from "@openpresentation/opf-editor/chart-data";

createDataGrid(container, { editor, getSelectedPath: () => selectedPath });
insertTableRows(editor, "slides.4.blocks.1.table", 2);                        // merged cells grow, never split
sortTableRows(editor, "slides.4.blocks.1.table", 1, { direction: "desc" });     // stable, typed, empty cells last
setChartCells(editor, "slides.3.blocks.0.chart", [{ section: "body", row: 0, column: 1, text: "12,5" }], { decimal: "," });
```

Chart columns and table headers may be `DataColumn` objects (`{ name, format }`; the grid keeps the format and shows a formatted column's numbers as the slide draws them, while editing and copy use the raw value), a chart or table may show a shared top-level dataset (the grid edits `/datasets/<id>` through `fields` and says how many items share it), each column has a number format field and each chart a category, X and series mapping (RR-54):

```js
import { setGridColumnFormat, setChartMapping, detachGridDataset } from "@openpresentation/opf-editor/data-grid";
import { prepareDatasetImport, ingest } from "@openpresentation/opf-editor/data";

setGridColumnFormat(editor, "slides.3.blocks.0.chart", 1, "$#,##0.0");   // header "Revenue" becomes { name: "Revenue", format }; null clears it
setChartMapping(editor, "slides.3.blocks.0.chart", { category: "Region", series: ["Revenue"] });
detachGridDataset(editor, "slides.3.blocks.1.table");                   // its own copy instead of the shared dataset
const stored = prepareDatasetImport(editor.presentation, ingest(csv, { as: "chart" }), { id: "revenue" });
editor.applyPatch([...stored.patches, { op: "add", path: "/slides/-", value: { id: "rev", title: "Revenue", ...stored.content } }]);
```

The number rules, paste and copy format, merged-cell behaviour, sorting, keyboard and accessibility are in [docs/data-grid.md](docs/data-grid.md).

## Design controls panel (RR-06)

`@openpresentation/opf-editor/design-controls` mounts the controls for everything above in one call. Each control commits one undoable change through the session, so a host that already subscribes to the session (the canvas does) redraws the preview, loads fonts first through its font gate, and the controls themselves follow Undo and Redo.

```js
import { createDesignControls } from "@openpresentation/opf-editor/design-controls";

const controls = createDesignControls(designPanel, {
  editor,
  getSlideIndex: () => slideIndex,
  getSelectedPath: () => selectedPath,
  sections: ["look", "background", "header-footer", "brand", "layout-options", "info", "catalog"],
  vocabularies: catalogDisplay, // from @openpresentation/gallery, in the host app
});
const selectionControls = createDesignControls(contentPanel, { editor, getSlideIndex, getSelectedPath, sections: ["selection", "image", "table", "slide-content"], onSelectPath: select });
controls.refresh(); // when the slide or the selection changes
```

Sections: `look` (theme, color scheme, font scheme, language, this slide's layout), `background` (type, theme slot, solid color, gradient with its stops, image with fit, focus, alt text, recolor and overlay, any of the 54 patterns, opacity; a draft until Apply, with Remove), `header-footer` (choose header or footer and a zone, then every part the zone supports: a text box with an "Insert value" menu that puts the slide number, slide count, section, organization, speaker or deck name at the cursor as a `{{ }}` variable (Enter commits, Shift+Enter starts a new line), an image with an "Insert logo" action (a shape and, for several organizations, an organization; it writes the logo reference as the zone's image), social profiles, and the current or fixed date and format, with a summary of the zones in use), `brand` (the organization logo: one image for every shape, or each of the four shapes for both, light and dark backgrounds, for the organization you choose; which organization's logo and shape covers, sections and picture bullets draw, or none; picture bullets, accent font, watermark), `layout-options` (alignment, direction, primary chart, content box, default image fit), `info` (narrative, tone, audience, socials), `selection` (content type with a loss report, list levels, group of metrics, group and ungroup, image to background or watermark, replacement, chart type), `image` (the selected image block's fit, focus, shape, corner radius, border, opacity, recolor, overlay, aspect ratio and placement), `catalog` (reference findings and the explicit "Update from catalog"), `slide-content` (blocks to regions and back, design images back into the content) and `table` (style, merge, split, cell fill, alignment and bold). The panel is native `details`, `fieldset`, `select`, checkbox and text controls with a label on each, so it works with the keyboard and with screen readers: groups open with Enter or Space, a select changes with the arrow keys, text fields commit on Enter or when you leave them, and results and refusals are announced in `role="status"` and `role="alert"` regions. A refused change (an invalid value, text a merge would hide) is explained, changes nothing, and puts the field back. "Applies to" switches the design controls between the whole presentation and the current slide, and a control shows when a slide value is "set on this slide" or "from the presentation". The panel offers only conversions that exist, shows what a conversion loses before you choose it, and lists why an unavailable one is unavailable.

In React (or Svelte, or anything else) mount it into a ref and destroy it on unmount; it needs no framework runtime:

```jsx
useEffect(() => {
  const controls = createDesignControls(ref.current, { editor, getSlideIndex: () => slide, getSelectedPath: () => selected });
  return () => controls.destroy();
}, [editor]);
// call controls.refresh() (keep it in a ref) when slide or selected changes
```

The playground mounts both panels (the Design tab, and the selection area of the Content tab). One click on text still enters text editing; the panels follow the selection after Escape. Every image field (organization logo, watermark, background image and header/footer zone image) takes an asset reference (suggested from the document's assets), a web address or a data address, and has a file picker and an alt-text field: the chosen file is validated (PNG, JPEG, GIF, WebP or SVG, up to `maxImageBytes`, 2 MiB by default), added to `assets` and used in one undo step, or handed to your app through `onAddAsset`. Alt text is saved on the asset; typed before an upload it is used for that upload.

Run `npm run test:design-controls-browser` (after `npm run build:playground`) for the real-browser check of every control, its keyboard operation and its undo.

### What a switch does not establish

A switch changes the document; it does not change what the engines support. Language changes recompose fonts only as far as the installed core, renderer and PPTX packages implement the language and script model (FF-18, FF-19); the editor's own composition measures the Latin families. `image-treatments` previews the image block treatments the renderer draws. `test/switches.mjs` checks the patch, one undo step, undo/redo, and preview refresh for all 16 dimensions (the 14 gallery dimensions, slide sizes and purposes), and for every slide-size preset the composed canvas and the preview viewBox. `test/switches-export.mjs` exports after each switch, undo and redo, checks that every slide-size preset writes the matching `p:sldSz` and re-imports as that preset, and applies opf-pptx's FF-08 typeface check (`checkTypefaces`) to every package it writes.

## Autosave and restore (RR-22)

`@openpresentation/opf-editor/persistence` keeps an editor session in this browser's own storage and brings it back after a reload. It is local only: the module makes no network request, and the data stays in the browser profile (IndexedDB, with localStorage as the fallback). A host that stores documents itself simply does not call it.

```js
import { createPersistence } from "@openpresentation/opf-editor/persistence";
import { createPersistenceUi } from "@openpresentation/opf-editor/persistence-ui";

const ui = createPersistenceUi({ banner: document.querySelector("#restore-banner"), indicator: document.querySelector("#autosave-status") });
const persistence = createPersistence(editor, {
  key: "my-document",                 // names this document; two documents with one key share a stored copy
  storage: "indexeddb",               // default; or "localstorage", "memory", false, or your own { get, set, delete } adapter
  onRestorePrompt: ui.prompt,         // or return "restore" | "discard" | "later" (or a promise) yourself
  onStatus: ui.status,                // "Saved on this device at 2:03 PM", or why autosave is off
  beforeFlush: () => canvas.commit(), // commit a draft before every write and before the page unloads
});
await persistence.ready;              // { available, offered }: storage opened and read (it does not wait for the user's decision)
await persistence.markSaved();        // after the host saved the document somewhere of its own: not unsaved, and the stored copy says so
```

- **Writes** happen after a change, 800 ms after the last one (at most 5 s late), serialized, and never for a document that was only opened: a stored copy is not overwritten until the document changes. The undo and redo history is stored with it (the newest 200 entries, 2,000,000 bytes at most; set `includeHistory: false` to skip it). `flush()` writes now.
- **Restore** is offered when a stored copy differs from the document the session starts with. `restore()` puts the copy back as one undoable step; into a session nobody has edited it restores the undo history too (`restoreState`, which replays the history against the document and refuses one that does not belong to it, so a stale copy never corrupts the session). If the person keeps editing while the offer is open, the offered copy is first moved aside, so ignoring the prompt never loses it; after a reload the offer mentions the older copy (`restoreEarlier()`). `discard()` deletes the stored copy.
- **Unsaved changes.** `dirty` is true when the document differs from the last `markSaved()` (or from how the session started); `beforeunload` warns while it is true (`warnOnUnload: false` to opt out) and a final write is started on unload, `pagehide` and when the tab is hidden. A host that loads a document into the editor (the gallery hands a snippet over) calls `rebase()` so that document is neither autosaved nor warned about until the person changes it. The playground marks the document saved on Save OPF, not on a PowerPoint export (a PPTX is not the OPF document).
- **Degradation.** Private browsing, blocked site data, a failing read or a full store never throw: `status` says `unavailable` or `error` with a sentence the host shows ("... download it to keep it", "browser storage is full ..."), a full store first drops the undo history and then reports, and the next change tries again. Dirty tracking and the unload warning keep working without storage.
- The playground enables it with the key `opf-editor-playground`. A host page sets `globalThis.OPF_EDITOR_HOST = { persistence: { key, storage, onRestorePrompt } }` (or `persistence: false`) before the script runs; a frame can pass `?persist=<key>` or `?persist=0`. The footer text of the inspector is the autosave indicator and a prompt appears under the document bar.
## Fill template panel (RR-32)

A template is an OPF file with variables (`{{id}}` tokens and `var:id` references, root `"template": true`; see [templates and variables](https://github.com/OpenPresentation/opf/blob/main/docs/templates-and-variables.md)). `/templates` is the headless model and `/template-panel` the DOM panel over it. Both need the core release that ships `resolveVariables` (older cores load them and throw `templates-unavailable`).

```js
import { createTemplatePanel } from '@openpresentation/opf-editor/template-panel';
import { toSvg } from '@openpresentation/opf-render/svg';

const panel = createTemplatePanel(container, {
  editor,
  // The live preview: the template drawn with the values typed so far (unfilled variables show their example).
  renderPreview: ({ presentation, variables, slideIndex }) => toSvg(presentation, slideIndex + 1, { fonts, variables }),
  getTarget: () => ({ path: selectedPath, start, end }), // the text field a token is inserted into; omit to hide that section
  onApply: () => redraw(),
});
```

The panel lists every variable with the input its kind needs (text, number, date, color, link, one-entry-per-line list, and an image source with an asset pick or an uploaded file, 5 MB at most), marks which are filled, defaulted, optional or still needed, says where each is used, rejects a bad value in place, and previews the result as values change. **Fill the presentation** resolves the variables and replaces the document with the concrete deck as one validated, undoable edit (one Undo restores the template); **Fill what is ready** keeps the unfilled variables declared. **Insert a variable into text** inserts `{{id}}` into the selected text, optionally declaring a new variable in the same edit. A **Built-in variables** section lists the values the document supplies itself (`deck.*`, `speaker.*`, `speakers`, `organization.*`, and `speaker.<id>.*` / `organization.<id>.*` by id), read-only, each with its current value or "not set" and where it is used; they are filled from the document's own fields, not in the panel, and the same names appear in the insert list so `{{speaker.name}}` can be inserted without declaring anything. The three slide-scoped text built-ins (`slide.number`, `slide.section`, `deck.slideCount`; `scope: "slide"` in `listBuiltins`) come last and have no single value: the panel shows them as "varies per slide" (and notes when no slide has a section), because each slide gets its own when it is drawn or exported. After them come the organization logos (`organization.logo`, `.stacked`, `.icon`, `.wordmark`, and the same under `organization.<id>.logo` for each organization; `kind: "image"`, `scope: "slide"`), read-only: they are images placed as a whole image field (`var:organization.logo.icon`), not `{{ }}` text, so the panel shows the `var:` reference, "light or dark artwork per slide" and "no logo yet" when the organization has none, and leaves them out of the insert list. A checkbox marks the document as a template.

The headless pieces are usable on their own: `listTemplateFields(presentation, values)`, `templateStatus`, `previewTemplate`, `createTemplateFill(editor)` (`set`, `setText`, `clear`, `reset`, `preview`, `apply({partial})`), `declareVariable`, `setTemplate`, `insertVariableToken(editor, path, id, {start, end, runIndex, format, declare})`, `variableToken` (also for built-in names), `listBuiltins(document)` (the built-ins with kind, label, scope, value, availability and uses), `suggestVariableId`. Every write goes through the session. The canvas draws a template as authored (`renderOptions.variables` defaults to `false`), so its tokens stay visible and an inline edit never overwrites one with resolved text; the panel's preview draws the resolved deck. The slide-scoped built-ins are the exception on both: the renderer substitutes them for the slide it draws (its own number, section and the deck's count), and `editor.composeSlide(index, { slideNumber, slideCount })` composes that substituted slide, while the document and an inline edit keep the token. The playground adds a **Fill template** button.

## Find and replace (RR-25)

`@openpresentation/opf-editor/find` is the headless model and `/find-panel` the DOM panel. The model lists every piece of text in a document (`collectSearchFields`: presentation name and description, header and footer text, and per slide the title, subtitle, tag, section, text and its runs, list items and bullets, code, string metrics and their label, unit and delta, quotes with attribution and source, timeline names, dates and events, chart column labels and string cells, table headers and cells including styled cells, image and video alt text, and speaker notes). Numbers, ids, asset references, URLs, colours and layout names are never searched or changed. `findMatches(presentation, query, { matchCase, wholeWord, regex, notes, slideIndex })` returns the matches with the field, offsets and a context snippet; an invalid regular expression comes back as `error` and an empty match is skipped, and so is a match that touches a variable token such as `{{slide.number}}` (a token is not text, and replacing part of its name would break it or turn it into literal text). `replaceAll(editor, query, replacement, options)` replaces every match as **one** `applyPatch` (one undo step restores every field; a document the schema rejects changes nothing) and `replaceMatch(editor, match, query, replacement, options)` replaces one. In regular-expression mode the replacement reads `$&`, `$1` to `$99`, `$<name>`, `` $` ``, `$'` and `$$`; otherwise it is literal.

**Rich text.** A run array is searched as its runs joined, so a phrase that crosses a bold/plain boundary is found. A match inside one run changes only that run and every run keeps its formatting. A match that spans several runs is replaced with the formatting of the run that holds the first matched character (the Word and Google Docs rule): the matched characters of the later runs are removed, text before and after keeps its own formatting, and a run left empty is dropped (a field always keeps at least one run). A run written as a plain string stays a plain string.

`createFindPanel(container, { editor, canvas, goToSlide, onGoTo, ... })` mounts a docked, non-modal panel: find and replace fields, Match case / Whole word / Regex / This slide only, previous and next, Replace and Replace all (with an Undo button right there), and a results list. Choosing a result shows its slide and selects the nearest content the canvas can select (`canvas.reveal(path)`; a list item selects its list); the host puts speaker notes or the presentation name in view through `onGoTo`. `installFindShortcuts(panel)` wires Ctrl/Cmd+F (find) and Ctrl/Cmd+H or Ctrl/Cmd+Shift+H (find and replace; macOS reserves Cmd+H, so use Ctrl+H or Cmd+Shift+H there). In the panel: Enter / Shift+Enter or F3 / Shift+F3 step through matches, Enter in the replace field replaces the current match, Ctrl/Cmd+Alt+Enter replaces all, Esc closes and returns focus. The panel is a labelled dialog, its count is a polite live region, an invalid pattern is an alert, and the controls are 44px on a touch screen. A modal dialog that is open keeps its own Ctrl+F. The playground mounts it under the canvas toolbar.

## Image crop and focal point (RR-25)

Select a picture on the canvas and use **Crop picture** (or `canvas.cropImage(path, { tool: "focus" })`, or the inspector's Picture section). The crop layer shows the whole picture with a crop rectangle: eight drag handles, an aspect lock (Free, Original, **Frame shape**, 1:1, 4:3, 3:2, 16:9 and the portrait ratios; Shift while dragging keeps the current ratio), exact pixel fields, Reset, Cancel and Apply. The **Focal point** tool cuts the frame's own shape around a point you click or drag, with a zoom. Keyboard: the crop area takes arrow keys (move), Shift+arrows (resize), plus and minus (scale), Enter (apply) and Esc (cancel); the layer is a modal dialog that keeps Tab inside it. On a phone or tablet the layer fills the screen and the handles have finger-sized targets. Each Apply is one undoable change.

**What is written.** The OPF schema has no crop rectangle (`Asset` is `src`, `alt`, `title`, `description`, `mediaType`, `format`). An image block has a `fit` (cover, contain, stretch) and, since OPF 0.15, a `focus` point a cover fit keeps in view, set in the "Selected image" section (`/image-options`). So the editor writes the crop into the picture itself: the cropped pixels (at the picture's own resolution; JPEG stays JPEG, everything else PNG) become a new entry of `assets` with `description: "Cropped from asset:<id>"`, and the image points at it, in one patch. The preview and the PPTX export both read those pixels, so they cannot disagree about what is shown, and the fit the document already has places the cropped picture in its frame as before (opf-pptx writes its usual `a:srcRect` for a covering placement and none for a contained one; `test/image-crop-browser.mjs` exports a cropped deck and checks that the media is the cropped asset and that the placement matches the preview in both fills). The original asset stays so **Restore original** can put it back (one undo step); a crop of a crop points at the first original and the unused intermediate asset is removed. A vector (SVG) picture is not croppable (it has no pixels; use Fit); a picture hosted on another site is cropped only if the host allows its pixels to be read (otherwise upload it first); a GIF becomes its first frame. The model is `@openpresentation/opf-editor/image-crop` (`describeImage`, `prepareCrop`, `prepareRestore`, `applyCrop`, `cropImagePixels`, and the pure rectangle maths `resizeRect`, `fitAspect`, `focalWindow`) and the layer is `/image-cropper`.

## Phone and tablet (RR-25)

At 900px and narrower the playground is one screen: the slide strip on top, the slide in the middle, and a bottom bar (Edit, Design, Find, Undo, Redo) whose Edit and Design open the inspector as a **bottom sheet** that leaves the slide in view above it; the header buttons sit behind More; nothing scrolls sideways down to 320px. On a touch screen the canvas grows each text block's selection target to about 44px (up to 24 slide units each way), a tap on text enters editing at that point, `touch-action: manipulation` removes the double-tap delay, and the field being typed in is scrolled above the on-screen keyboard (visual viewport). The inline field mirrors the slide text, which is smaller than 16px on a phone; iOS would zoom into it on focus, so the playground sets `maximum-scale=1` on the viewport only while a slide text field has the focus and restores it after (embedding hosts should do the same, or keep their own fields at 16px). `test/mobile-browser.mjs` drives six emulated devices (iPhone SE, iPhone 14 Pro, Pixel 7, a 320px Android, an iPad and an Android tablet: Chromium with each device's viewport, scale factor, touch and user agent) through the layout, the sheet, tap-to-type, find and replace by touch and a crop by touch; it does not replace a check on a real iOS Safari.

## Styling and theming (RR-98)

The editor panels ship one stylesheet. Import it once, next to your own CSS:

```js
import "@openpresentation/opf-editor/styles.css";
```

`npm run build` writes `dist/styles.css`: the token layer (`src/styles/tokens.css`) first, then every other `src/styles/*.css` in alphabetical order. It is plain CSS with no preprocessor, no `@import` and no `url()`: nothing is fetched. The package bundles no fonts either; load Inter and Geist Mono yourself (or leave the fallbacks: `system-ui` and `ui-monospace`). The panels that existed before it (design controls, review, slide manager, find, fill template, numbering, chart options, data grid, crop, the custom layout editor, the JSON editor and the restore banner) are styled with the tokens and nothing else. The find, review, crop and data-grid components still inject a small fallback stylesheet of their own, so they look as before when you do not import `styles.css`; with it, its rules win whichever `<style>` comes last.

**Tokens.** Every rule reads only `--opf-ui-*` custom properties, defined on `:root` and on `.opf-ui`, light by default. Override any of them on `:root`, on a wrapper with the class `opf-ui`, or on one component's container:

```css
.my-editor.opf-ui {
  --opf-ui-accent: hsl(262 60% 38%);
  --opf-ui-accent-strong: hsl(262 60% 38%);
  --opf-ui-ring: hsl(262 60% 38%);
  --opf-ui-radius: 4px;
}
```

| Group | Tokens |
|---|---|
| Surfaces | `--opf-ui-bg`, `--opf-ui-surface`, `--opf-ui-muted`, `--opf-ui-muted-2` |
| Text | `--opf-ui-fg`, `--opf-ui-muted-fg` |
| Accent | `--opf-ui-accent`, `--opf-ui-accent-fg`, `--opf-ui-accent-strong`, `--opf-ui-ring` |
| Lines | `--opf-ui-border`, `--opf-ui-border-strong` |
| Status | `--opf-ui-danger`, `--opf-ui-warn`, `--opf-ui-success` |
| Code | `--opf-ui-code-bg`, `--opf-ui-code-border` |
| Type | `--opf-ui-font` (`Inter, system-ui, sans-serif`), `--opf-ui-mono` (`"Geist Mono", ui-monospace, Menlo, monospace`) |
| Shape | `--opf-ui-radius-sm` 4px, `--opf-ui-radius` 6px, `--opf-ui-radius-md` 8px, `--opf-ui-radius-lg` 12px |
| Size, depth, motion | `--opf-ui-control-h` 32px, `--opf-ui-shadow-pop` (menus, popovers and dialogs only), `--opf-ui-ease` `120ms ease` (color and border only) |

Put the class `opf-ui` on an element that wraps a mounted component to get the base rules: the font, the text color, `box-sizing: border-box`, a 2px `--opf-ui-ring` outline with a 2px offset on `:focus-visible`, and no transitions under `prefers-reduced-motion: reduce`.

**Dark mode.** The dark values apply under `.dark .opf-ui`, `.opf-ui.dark`, `[data-theme="dark"]` (on the root or any ancestor) and `:root.dark`. The host decides when: toggle `class="dark"` or `data-theme="dark"` on `<html>`, or on the wrapper. The stylesheet does not read `prefers-color-scheme`, so a host that wants to follow the system setting sets the attribute from `matchMedia("(prefers-color-scheme: dark)")`. Dark also sets `color-scheme: dark`, so native controls follow.

**Touch.** `data-density="touch"` on an `.opf-ui` element raises `--opf-ui-control-h` from 32px to 40px for everything inside it (the mobile design). The new components take the same value as a `density: "comfortable" | "touch"` option.

The example page `examples/playground.html` loads this stylesheet and keeps only its own page layout in `examples/playground.css`. The JSON editor (CodeMirror) ships no CSS of its own; give its container the class `opf-json` or `opf-code`, or put it inside an `.opf-ui`, to style it. The restore banner is a host element: give it the class `restore-banner`.

## Review panel (RR-29)

`@openpresentation/opf-editor/review-panel` mounts the findings of core's `validate(presentation)` next to the document, grouped by category (format, references, policy, accessibility, layout, content): contrast, text that does not fit, missing alt text, reading order, fonts, links and more (the same rules as `opf validate`; see the [validate guide](https://github.com/OpenPresentation/opf/blob/main/docs/validate.md)). A finding is core's `Finding` (rule id, severity, category, JSON Pointer path, message, `fixes`), so a hosted reviewer that returns a `FindingReport`, such as pptx.dev's review, lists its findings in the same panel.

The session itself checks only the `format` category per edit (`validate(presentation, { only: ["format"] })`, no layout is built), and `editor.validation` is that report: `valid`, `findings`, `counts`. The panel runs the full check once the document has been quiet for a moment (`delay`, 300 ms), never per keystroke.

```js
import { createReviewPanel } from "@openpresentation/opf-editor/review-panel";

const panel = createReviewPanel(container, {
  editor,
  getSlideIndex: () => slideIndex,
  // the host's measured fonts, per slide, so overflow is judged like the preview
  getValidateOptions: (deck) => ({ fonts: { textMeasurement: (index) => measurementFor(deck, index) } }),
  // optional: a hosted reviewer; its findings join core's, kept per Finding.source (a finding with no source is listed under "review")
  review: async (presentation, { signal, report }) => (await fetch("/review", { method: "POST", body: JSON.stringify(presentation), signal })).json(),
  onGoTo: ({ finding, target }) => select(target.slide, target.path), // target.path: the nearest existing field
  onFocusField: ({ finding, fix, target }) => focusTextField(target.path), // a title, text, link, language or size
});
panel.refresh(); // after the host has redrawn (set autoRefresh: false) or after anything the session did not see
```

Findings show a severity word, the slide, the rule id and, for a hosted reviewer, its source. **Go to** selects the content. A fix (core's `FindingFix`: a `title` and an RFC 6902 `patch`) is a single undoable session edit and is refused when the document has changed since the finding (the list is refreshed instead): switching a failing colour to the readable one is a one-click safe fix; **Write alt text** opens a field in the panel (an `asset:` reference stores the text on the asset so every use has it); **Mark as decorative** (an empty alt) is an explicit choice flagged as one that changes meaning. `deckStats(editor, options)` from the root entry returns core's `stats` of the open presentation (slide, layout and section counts, words and notes coverage, images and alt text, charts, tables, speaking time) for a deck-info view: neutral facts, never severities, read from the JSON only. A check can be hidden in the panel and shown again, and the list can be limited to errors and warnings or to the current slide. The list re-checks after changes and follows Undo and Redo; arrow keys, Home and End move between findings, Escape cancels the alt-text field and focus stays on a finding after a fix. The `review` hook runs when the author presses its button (`reviewLabel`), or after every re-check with `autoReview: true`: a hosted review can be slow or metered. Its findings stay listed, marked as possibly out of date, until the next run; a failing hook shows its message and leaves core's findings in place. The headless `/review` entry (`mergeFindingReports`, `reviewFindings`, `groupFindings`, `applyReviewFix`, `setReviewAltText`, `markDecorative`) needs no DOM; call core's `validate` for the report itself. `ReviewFinding` is core's `Finding` plus `id`, `dottedPath` and a `slide` that is `null` for the whole presentation.

## PDF, PNG and SVG downloads (RR-23)

`convert(deck, { format })` from `@openpresentation/opf-editor/export` turns the deck into files in the page, next to the PowerPoint export; the [Export menu](#export-menu-and-agent-handoff-rr-98) is a thin host over it. It has the name and the result of core's in-memory `convert` (OPF 0.18, RR-73): `{ files, findings }`, core's `ConvertResult`.

```js
import { convert } from "@openpresentation/opf-editor/export";
const { files, findings } = await convert(editor.presentation, {
  format: "pdf",              // "pdf" | "png" | "svg"
  slides: "1,3-5",            // core's slide selection, counted from 1 (3, "1-3", [1, 3]); omitted: every slide that is not hidden (includeHidden: all)
  raster: false,              // PDF only: true draws each page as an image (also pass pdfLib: import * as pdfLib from "pdf-lib"); PNG and raster density: scale 1 to 4
  zip: false,                 // PNG and SVG only: true packs the slides into one archive instead of one file per slide
  name: "q3-review",          // the files' base name; default the deck's filename, else its name
  fonts,                      // the renderer's fonts handle (loadFonts): measures, loads the faces the deck needs, supplies the faces to embed
  renderOptions,              // catalogs, date, ... (the renderer's ToSvgOptions)
  signal, onProgress, onFinding,
});
// files: [{ name, type, bytes, slide?, id?, width?, height?, pages?, slides?, entries? }]; findings: core's Finding[] to review.
```

- **Same drawing as the preview.** The slides are drawn by `toSvg` with the same fonts handle as the preview (its `textMeasurement`), so a PNG or SVG is the preview, and the PDF is converted from those SVGs rather than laid out again.
- **Subset faces and outlined text (opf-editor#141).** A browser fonts handle embeds whole faces in an SVG (hundreds of KB to MBs per slide) unless it was created with `subsetWasm`, and shapes outlined text with fontkit unless it has `shapeWasm`. Serve harfbuzzjs's two WASM files like the font files (the copies of the `harfbuzzjs` package the renderer depends on: `harfbuzzjs/dist/harfbuzz-subset.wasm`, 651 KB, and `harfbuzzjs/dist/harfbuzz.wasm`, 434 KB, both MIT) and create the handle you pass as `fonts` with them:

  ```js
  const fonts = await loadFonts({
    faces, scriptBaseUrl, lazyFontsBaseUrl,
    subsetWasm: "/vendor/harfbuzz-subset.wasm", // URL, bytes or a WebAssembly.Module; SVG downloads embed each face cut to the slide's glyphs
    shapeWasm: "/vendor/harfbuzz.wasm",         // outlined text (renderOptions.text: "paths") is shaped by HarfBuzz, as browsers shape text
  });
  ```

  `convert` reads `fonts.subsets` and `fonts.outlines` from that handle, so nothing else changes: the same call writes SVG files with the faces cut to what each slide draws (the licence rule above still decides which faces may be embedded, and the renderer cuts only faces whose licence allows a modified version; the others stay whole) and, with `renderOptions: { text: "paths" }`, SVG and PNG files whose text is glyph outlines (no font needed). A PDF is unaffected: it embeds the registry's faces and cuts its own subsets, and it always draws selectable text. `renderOptions.subsetFonts: false` embeds whole faces. The canvas draws with `text: "system"`, which embeds nothing, so it never reads either. The playground does this: `npm run build:playground` copies both files next to the page.
- **Fonts.** The fonts handle loads the faces the deck needs before anything is drawn (a failure rejects with `fonts-unavailable`). Only faces the handle's registry holds are embedded (bundled or hash-pinned, never a system font), only where a slide draws them, as `@font-face` data in each SVG and as subsets in the PDF. A face whose own license text is not OFL, Apache, MIT or UFL is left out and reported (`fonts/export-font-license`).
- **PDF** is the renderer's vector PDF (selectable text, vector shapes, embedded subsets, tagged structure), `raster: true` is the image-only form. **PNG** is drawn on a canvas from the same SVG (within anti-aliasing of the renderer's resvg PNG) and is limited to 40 megapixels. **SVG** files are standalone (XML header, fonts embedded, no external references).
- **Files.** A PDF is one file (`pages`, and the one-based `slides` it shows). PNG and SVG give one file per slide, in slide order, each with its one-based `slide`, its `id` and its `width` and `height` in pixels, as core's `convert` does; with `zip: true` they are one archive (`createZip`, no dependency; `entries` names the files in it), even for one slide. `zip` with a PDF, or `raster` with PNG or SVG, rejects with `invalid-option`.
- **Names.** `exportFileName(deck, ext, suffix)` uses the deck's `filename` (a trailing .pptx/.pdf/.png/.svg dropped), else the slugified `name`, else `presentation`; the `name` option replaces both. Slides are numbered as core numbers them (`name-001.png`, more digits for a deck of 1000 slides or more), archives are `name.zip`.
- **Slides.** `slidesToConvert(deck, { slides, includeHidden })` gives the one-based slide numbers a conversion covers. A selection names exactly its slides, hidden or not; a malformed one, or a slide past the end, rejects with core's `invalid-option` (`OPFApiError`, from `parseSlideSelection`). A deck with no slide to convert rejects with `export-no-slides`.
- **Progress and cancel.** `onProgress({ stage, done, total, message })` reports fonts, drawing, per-page conversion and packing; an aborted `signal` rejects with `export-aborted` between pages and slides.
- **Findings.** Renderer and converter notes are core's `Finding` (finding.schema.json), as core's conversion reports them: `ruleId` `render/<code>` (the renderer), `pdf/<code>` (the PDF converter) or `fonts/export-font-license`, `category` the same word, `path` a JSON Pointer, `slide` (zero-based, as the Finding schema defines it) and `slideId`, and the note's facts (font family, weight, glyph count) in `measured`. `pdf/pdf-font-substituted`, `pdf/pdf-glyph-missing`, `pdf/pdf-raster-fallback` and the renderer's own are `warning`; `pdf/pdf-font-embedded` is `info`. A finding about a slide that is not converted is left out, and repeats are kept once.
- **Errors.** A rejection's `code` is `export-format` (no such format), `export-no-slides`, `export-aborted`, `export-unavailable`, `export-fonts-unlicensed`, `fonts-unavailable`, `invalid-option` or a renderer code (`converter-missing` for a raster PDF without `pdfLib`).
- PDF and PNG need `@openpresentation/opf-render` with its `export-browser` entry (RR-23, opf-render#105); without it they reject with `export-unavailable` and SVG still works. The entry imports no PDF library (opf-render 0.16): the vector PDF, PNG and SVG need nothing else, and `raster: true` needs the `pdfLib` option. Verified in Chromium; Safari and Firefox are not exercised in CI. The playground bundle grows by the PDF writer, fontkit shaping and the bidi algorithm.

Catalog controls initialize an absent deck or slide `design` for known theme, color-scheme and font-scheme fields as one validated transaction. Undo removes a newly created parent; existing design fields are retained. DOM, React and Svelte catalog controls accept `onError(error)` and emit a bubbling `opferror` event on rejected edits, restore the committed selection and expose native validity feedback. General `editor.set` and JSON Patch require existing parents.

Optional downloads can be deferred until requested: dynamically import `@openpresentation/opf-editor/export` inside the download handler. For a PowerPoint download, dynamically import `@openpresentation/opf-pptx` inside that handler too; the `/export` helper covers PDF, PNG and SVG. This defers conversion code, while canvas rendering and font measurement still have their own startup costs.

## Export menu and agent handoff (RR-98)

Three framework-neutral DOM factories, plain DOM like the other modules (no framework, no network, no fonts or CSS fetched at runtime). Their CSS is `src/styles/export-menu.css` and `src/styles/handoff.css`; it uses only the `--opf-ui-*` tokens (each with its light value as a fallback) and the class prefixes `opf-export-*` and `opf-handoff-*`.

```js
import { createExportMenu } from "@openpresentation/opf-editor/export-menu";

const menu = createExportMenu(document.querySelector("#export"), {
  getDeck: () => editor.presentation,       // required: called on every export; the menu exports a structuredClone
  beforeExport: () => !canvas || canvas.commit(), // optional: return false to stop (commit an open canvas edit first)
  fonts,                                     // the one fonts handle the preview uses
  catalogs: () => editor.catalogs,           // an array, or a function that returns one
  renderOptions,
  exportPptx: async (deck, { signal, onProgress }) => toPptx(deck, { ... }), // PowerPoint, injected (see below)
  onDownload: ({ blob, fileName, format }) => save(blob, fileName),          // default: a Blob link
  onAgentHandoff: ({ document, target }) => ...,                              // default: the dialog below
  items: { slides: ["pdf", "png", "svg", "pptx"], source: ["json", "yaml", "markdown"], agent: true }, // hide groups or formats
  mode: "menu",                              // "sheet": the mobile bottom sheet (scrim, drag handle, Close)
  density: "comfortable",                    // "touch": 40px controls (sheet rows 44px)
  disabled: false,                           // true or a reason string: disables the slide exports
});
menu.setDisabled("Showing the last valid slides. Fix the JSON to resume editing and downloads."); // or menu.setDisabled(true)
menu.setMode(matchMedia("(max-width: 900px)").matches ? "sheet" : "menu");
```

- **The menu.** A button (Download icon, "Export", ChevronDown) and a `role="menu"` in three groups: **Slides** (PowerPoint (.pptx), PDF, SVG slides, PNG images, each with a hint), **OPF source** (JSON, YAML, Markdown) and **For an agent** (Agent handoff). Items are `role="menuitem"` buttons; ArrowUp, ArrowDown, Home and End move between them, Escape closes and returns focus to the button, Tab closes and moves on. In `mode: "sheet"` the same menu is a `role="dialog"` bottom sheet that traps Tab, closes with Escape, Close or a tap on the scrim, and returns focus.
- **Slides.** PDF, PNG and SVG run this package's `convert` (above) with your `fonts`, `catalogs` and `renderOptions`; PNG and SVG arrive as one ZIP for several slides. `convertOptions` passes more `convert` options (`scale`, `includeHidden`, `converters`, ...). The menu imports the renderer through `/export`, so a host that bundles it needs `@openpresentation/opf-render` (an optional peer). **PowerPoint lives in `@openpresentation/opf-pptx`, which the editor does not import:** you inject `exportPptx(deck, { signal, onProgress })` and return the bytes (or `{ bytes, fileName?, warnings? }`). Load the fonts the deck needs first, as `examples/export-controls.js` does with `fontGate`. The PPTX item is offered only when `exportPptx` is given.
- **OPF source.** JSON is the document as "Save OPF" writes it (every catalog record the deck uses is embedded). YAML and Markdown are core's `toYaml` and `toMarkdown` (`@openpresentation/opf/yaml` and `/markdown`, loaded on first use); parts the Markdown dialect has no syntax for are written as YAML fences and reported as notes. File names are `name.opf.json`, `name.opf.yaml` and `name.opf.md`.
- **Progress, cancel, errors.** While an export runs a status panel under the button shows `onProgress` (a progress bar and the message) and a Cancel button that aborts an `AbortController` (`menu.cancel()` does the same, and `destroy()` too). Success, failure and cancellation each give a status line (`name.pdf · 2 slides · 38 KB · 1 note to review`), announced through an `aria-live="polite"` region; the converter's notes (and your PowerPoint `warnings`, core's YAML and Markdown notes, catalog references that did not resolve) are listed until dismissed. A result without notes hides itself after four seconds. `onStatus({ state, message, notes })` mirrors every change for a host footer, and `onExport({ blob, fileName, format, notes })` fires after a file was handed on.
- **Disabled.** `setDisabled(reason)` marks the slide exports `aria-disabled` with the reason as their `title` (`true` gives "Showing the last valid slides. Fix the JSON to resume editing and downloads."); source exports and the handoff stay available. While an export runs the others are disabled too.

```js
import { buildAgentHandoff } from "@openpresentation/opf-editor/agent-handoff";
import { createAgentHandoffDialog } from "@openpresentation/opf-editor/agent-handoff-dialog";

const { markdown, lines } = buildAgentHandoff(deck, { target: "pptx", fileName: "deck.opf.json" }); // "pptx" | "pdf" | "svg"
const dialog = createAgentHandoffDialog(document.body, { document: deck, target: "pdf", onClose: () => {} });
```

`buildAgentHandoff(document, { target, fileName, specUrl, agentGuideUrl })` is a pure function: a Markdown prompt for a coding agent (`# Task`, `## Setup`, `## Steps`, the Spec and Agent guide links, and `## deck.opf.json` with the exact `JSON.stringify(document, null, 2)` in a fenced block that no string in the deck can close). The agent installs `@openpresentation/cli` with `opf-render` (and `opf-pptx` for PowerPoint), validates the deck with `npx opf validate deck.opf.json` (exit 1 and the JSON path of each error for an invalid deck) and renders with `npx opf convert deck.opf.json deck.pptx` (or `deck.pdf`, `deck.svg`, one file per slide); these are the published `opf` command, run against the npm releases in a clean folder when written. The renderer's `@expo-google-fonts/*` packages are optional peers: the first conversion exits 2 with `peer-not-installed` and the exact `npm install` command, which the prompt tells the agent to run. The deck's text is data in the prompt, never instructions. `createAgentHandoffDialog(container, { document, target, onClose })` is the modal: a target switch (a `radiogroup`), the prompt read-only in mono with its line count, **Copy prompt** (Check and "Copied" for 1.2 seconds; when the browser refuses it selects the text and says so), **Download .md** and **Close**. It has `role="dialog"`, `aria-modal`, a focus trap and Escape, and returns focus to the opener. Nothing is sent anywhere.

Icons are inlined path data from [Lucide](https://lucide.dev) (ISC license), never loaded from a CDN.

## Presenter and Present button (RR-98)

`@openpresentation/opf-editor/presenter` shows the deck full screen, one slide at a time. It is plain DOM like the other modules, with no network, no fonts or CSS fetched at runtime, and no second renderer: slides are drawn by `toSvg` with the same fonts handle, catalogs and render options the canvas and the thumbnails use. Its CSS is `src/styles/presenter.css` (classes `opf-presenter-*` and `opf-present-button`; `--opf-ui-*` tokens only, part of `styles.css`). The module needs `@openpresentation/opf-render`, an optional peer, like the thumbnail strip.

```js
import { createPresenter, createPresentButton, bindPresentShortcut } from "@openpresentation/opf-editor/presenter";

const presenter = createPresenter(document.body, {
  editor,                      // or presentation: deck (an object, or a function returning it)
  fonts,                       // the renderer's fonts handle, the same one the canvas and the exports use
  renderOptions: { catalogs }, // merged after the session's catalogs
  slideIndex: current,         // the slide start() opens on (default 0)
  onSlideChange: (index) => {},  // the shown slide changed (deck index)
  onExit: (index) => { current = index; redraw(); }, // by any route: the host returns to that slide
  density: "comfortable",      // "touch": the exit button is 40px
});
createPresentButton(document.querySelector("#present"), { onPresent: () => presenter.start(current) });
bindPresentShortcut(document, () => presenter.start(current)); // F5
```

`createPresenter(container, options)` returns `{ element, start(slideIndex?), stop(), next(), previous(), goTo(index), getSlide(), isRunning(), destroy() }`. The presenter stays hidden until `start`. Call `start` from a user gesture (a click or a key press): the browser grants full screen only then. `start` resolves `"fullscreen"` or `"overlay"`.

- **Display.** The presenter's own element goes full screen through the Fullscreen API. When the browser refuses (no gesture, an iframe without `allow="fullscreen"`, iPhone Safari), the same element is a fixed overlay over the window, so everything below works the same. Slides fill the viewport and letterbox on black. The next and previous slides are drawn ahead, so advancing draws nothing. Slides draw with their `{{variables}}` resolved, as the exports do.
- **Navigation.** Right, Space, PageDown and Enter go forward; Left, PageUp and Backspace go back; Home and End jump; Esc exits. A click advances, and a click on the left third goes back. On touch, a swipe left goes forward and a swipe right goes back; a tap uses the same zones. Keys with Ctrl, Alt or Meta are left to the browser, and the keys the presenter handles do not reach the host page.
- **Hidden slides** are skipped, as the exports skip them (`slidesToConvert`; `includeHidden: true` presents them). `start(i)` and `goTo(i)` on a hidden slide show the next slide that is not hidden (`onSlideChange` says which). A deck with only hidden slides shows a message and `onExit(-1)`.
- **Counter.** A subtle "03 / 12" (mono, the navigator's format; hidden slides are not counted) and the exit button show on pointer move and hide after 2 seconds, with the cursor.
- **Exit.** Esc, the exit button, leaving full screen (the browser's Esc), `stop()` and `destroy()` all call `onExit(index)` with the deck index of the slide shown, then focus returns to the element that was focused at `start`.
- **Accessibility.** The element is `role="dialog"` with `aria-modal="true"` and an `aria-label` ("Presentation"; `labels.dialog`). Focus moves into it on start and stays in it (Tab cycles the dialog and the exit button). An `aria-live="polite"` region announces "Slide 3 of 12" (`labels.position`).
- **Fonts.** Like the canvas, the presenter waits for the faces the deck needs (`fonts.pending` and `fonts.ensure`) and shows "Loading fonts…" meanwhile.

`createPresentButton(container, { onPresent, disabled, density, variant })` mounts an icon-only button (the Lucide Presentation icon, inlined) named "Present" (`aria-label`), titled "Present (F5)". `variant` is `"quiet"` (the default: a transparent icon in `--opf-ui-muted-fg` that turns `--opf-ui-fg` on `--opf-ui-muted` on hover, like the toolbar's undo and redo, so a lone icon beside a primary Export does not compete with it) or `"primary"` (the filled accent look of the Export menu's trigger). `disabled` is `true` or a reason string (the title); the button stays focusable (`aria-disabled`) and does nothing. It returns `{ element, setDisabled(reason), setDensity(density), setVariant(variant), destroy() }`. `bindPresentShortcut(target, onPresent)` binds F5 (and prevents the browser's reload); it ignores F5 while typing in inputs, selects and editors (CodeMirror, contenteditable), in menus and dialogs, and with a modifier key, and returns a function that removes the listener. `examples/playground.js` wires all three next to the Export menu.

Tests: `npm run test:presenter-browser` and `npm run test:present-button-browser`.

## Opening a deck file (RR-98)

`@openpresentation/opf-editor/read-deck-file` reads a deck file in any OPF source format, with no DOM:

```js
import { readDeckFile, DECK_FILE_ACCEPT, DeckFileError } from "@openpresentation/opf-editor/read-deck-file";

input.accept = DECK_FILE_ACCEPT;            // ".json,.opf,.yaml,.yml,.md"
input.onchange = async () => {
  try {
    const { document, format, name, findings } = await readDeckFile(input.files[0], { catalogs });
    const editor = createEditorSession(document, { catalogs }); // the session validates it; findings say what to fix first
  } catch (error) {
    if (error instanceof DeckFileError) show(error.code, error.message, error.findings);
  }
};
```

`readDeckFile(file | { name, text }, { catalogs? })` takes a `File` (or anything with `name` and `text()`), or `{ name, text }` with the text as a string, and returns `{ document, format: "json" | "yaml" | "md", name, findings }`.

- **Format.** The extension picks it: `.yaml` and `.yml` are YAML, `.md` is Markdown, and `.json`, `.opf` or anything else is JSON. If JSON fails to parse, the text is tried as YAML, and as Markdown when it starts with front matter (`---`); `format` is the one that read it. YAML and Markdown go through core's browser-safe `fromYaml` and `fromMarkdown` (`@openpresentation/opf/yaml` and `/markdown`, loaded on first use). JSON that wraps a deck (`opfSnippet`, `opf`, `presentation`) is unwrapped as `parseOpfTransfer` does.
- **Name.** The file name without a directory and without `.opf.json`, `.opf.yaml`, `.opf.md` or its plain extension (`Q3 plan.opf.yaml` gives `Q3 plan`).
- **Findings.** The conversion's findings for YAML and Markdown, in core's `Finding` shape: `path` (a JSON Pointer such as `/slides/1/bogus`), `message`, `severity` and `location` (line and column in the file). A deck that reads but has OPF errors is returned with them, so a host can show them; JSON gives none (the editor session validates it).
- **Errors.** Text that cannot be read at all throws `DeckFileError` with a `code` and a clear message: `unreadable`, `file-too-large` (over 20 MB), `empty-file`, `unsupported-file` (a .pptx or other binary file), `invalid-json`, `invalid-yaml`, `invalid-markdown` (with the syntax `findings` and the line) and `not-a-deck` (JSON without a `slides` list, such as one slide or a block, which a host can send to its paste path as the playground does).

The source pane has no file-opening path of its own, so it keeps no second copy of this. The playground's Import dialog uses `readDeckFile` and `DECK_FILE_ACCEPT` for its file tab and for dropped files (`examples/transfer-controls.js`). Icons in the presenter button are inlined [Lucide](https://lucide.dev) paths (ISC license).

## Optional React Bindings

React bindings are isolated under `@openpresentation/opf-editor/react` and require the host app to pass its React runtime. The core package does not add React to the critical path.

```jsx
import { createOPFReactComponents } from "@openpresentation/opf-editor/react";

const { OPFTextInput, OPFCatalogSelect } = createOPFReactComponents(React);

function Inspector({ editor }) {
  return (
    <>
      <OPFTextInput editor={editor} path="slides.0.title" label="Slide title" />
      <OPFCatalogSelect editor={editor} path="design.theme" catalogKind="themes" label="Theme" />
    </>
  );
}
```

## Optional Svelte Bindings

Svelte bindings are isolated under `@openpresentation/opf-editor/svelte` as actions. They bind host-owned controls, so the package does not ship product chrome or require the Svelte runtime in the core entry point.

```svelte
<script>
  import { opfCatalogSelect, opfTextInput } from "@openpresentation/opf-editor/svelte";

  export let editor;
</script>

<input use:opfTextInput={{ editor, path: "slides.0.title", label: "Slide title" }} />
<select use:opfCatalogSelect={{ editor, path: "design.theme", catalogKind: "themes", label: "Theme" }} />
```

## Release Lane

Public npm package publication is handled by `.github/workflows/release.yml` through npm Trusted Publishing (GitHub Actions OIDC) with npm provenance; no npm token is stored. The owner authorized agents to prepare and publish npm releases whenever a release is required (2026-09-29). This authorization does not waive any gate.

1. Open a release-prep PR containing only the version bump, `CHANGELOG.md` (assembled from `changes/` with `node scripts/changelog-fragments.mjs assemble --version X.Y.Z`), dependency ranges, lockfile and current-instruction docs. Publish in dependency order (core, then renderer, then PPTX, then editor): refresh this repo's lockfile only after the required `@openpresentation/opf`, `@openpresentation/opf-render` and `@openpresentation/opf-pptx` versions are on the registry (`npm install --package-lock-only`), then run `npm run test:packed` against them.
2. Merge after CI is green, then publish by pushing the git tag `opf-editor-v<version>` (or `@openpresentation/opf-editor@v<version>`) at the merge commit. The workflow verifies that the tag matches `package.json`, that the push-to-`main` run of `ci.yml` on exactly the tagged commit succeeded (`scripts/ci-evidence.mjs`; it fails closed and re-runs no test, RR-100), and the artifact itself (audit, the packed install, `npm pack --dry-run`) before `npm publish --access public --provenance`. A tag pushed while CI still runs fails at the evidence step; re-run the failed job once CI is green. A manual `workflow_dispatch` runs the same job without the tag check and is a fallback only.
3. Verify with `npm view @openpresentation/opf-editor@<version> version gitHead dist.attestations` and, from the core repo, `node scripts/test-editor-publication.mjs <version> <release-commit> <this-checkout>`. Never republish an existing version.

## Shared dynamic composition

The current checkout uses `@openpresentation/opf/composition` for portable geometry. Slides can select `auto`, `row`, `column`, or `grid`, set weighted tracks, and request path-specific overflow diagnostics. See the sibling OPF repo's `docs/dynamic-composition.md` for the complete contract.

The current editor requires core `^0.15.1`; canvas rendering uses the optional renderer peer `^0.15.0`, and playground PPTX import/export uses `@openpresentation/opf-pptx@^0.15.0`. Clean registry installs support composition without sibling checkouts. For coordinated source development, build OPF and run `node scripts/link-ecosystem.mjs` there; `pnpm test:ecosystem` verifies shared geometry and import/export behavior.

## Local interactive demo

With the sibling workspace linked, run `pnpm demo:editor` from the OPF repo, then serve its `artifacts/editor` directory with a static HTTP server. The demo lets you select SVG text, apply edits, change composition, edit the JSON document, and undo/redo. It uses the real renderer and editor session with no service dependency.

Editor snapshots are immutable and keep the same object identity until a change. This supports React `useSyncExternalStore` without render loops. `editor.presentation` remains a separate mutable copy for callers that need one.

Nested content groups expose their bounds through `editor.composeSlide(index).groups`. Use `editor.setGroupComposition("slides.0.blocks.0", {mode:"column"})` to reflow a group with validation and undo/redo. The playground includes a nested example and group arrangement controls.

`editor.paginateSlide(index, {minFontSize:24})` splits a crowded draft into ordinary OPF slides as one undoable transaction. It returns the change and source mappings; failed pagination leaves the document unchanged. The playground’s Split overflow action demonstrates the workflow.

`composeSlide(index, { fonts })` and `paginateSlide(index, { fonts })` accept the same fonts handle as preview and export. The local playground now uses bundled, embedded fonts and reports substitutions. The font a user selects (for example Calibri or Aptos) is the source of truth and stays in the document; because license-restricted (proprietary) fonts are never bundled, the canvas draws an open look-alike (a metric-compatible one such as Carlito for Calibri where it exists, the metric-compatible Intos family for Aptos) and the substitution report says so. Since 0.14, PPTX export names the selected font, while preview substitutions remain visible in the font report. See the [OPF font policy](https://github.com/OpenPresentation/opf/blob/main/docs/font-fidelity.md#font-policy-ff-31).


## Copy, paste, and gallery imports

The browser-safe `/transfer` export provides `parseOpfTransfer`, `serializeOpfTransfer`, and `prepareOpfImport`. Copy whole documents, self-contained slides, or selected JSON values as readable JSON, compact JSON, or fenced Markdown. Parse pasted documents, slides, arrays, fragments, and one fenced code block. Prepare an immutable validated import before applying one root JSON Patch through the editor session. Insertion namespaces inline catalogs and conflicting asset/slide IDs and preserves primary source design defaults.

The `/galleries` export provides `loadOpfGallery` and `loadOpfGalleryItem`, accepting an AbortSignal and injectable fetch. Registries use `{name, items:[{id, name, category, opf}]}` for inline documents or `opfUrl` for a relative JSON URL. Public PPTX.gallery registry descriptors are supported. Cross-origin endpoints need CORS; requests omit credentials/referrers, cap responses at 20 MB, and keep automatic item requests on the configured gallery origin. Documents should include inline catalog records; arbitrary external catalog sources are not automatically fetched.

The playground includes Copy OPF and Import dialogs with paste, file/drop, gallery search, and URL tabs. Files accept OPF JSON and PowerPoint `.pptx` up to 20 MB. PPTX conversion runs locally using `@openpresentation/opf-pptx`; review the converted preview and diagnostics before inserting slides or opening a presentation. Applying an import is one undoable edit. Custom registries persist in local storage; defaults are configured in `examples/galleries.json`. Copy permissions may require using the Select all fallback. Pasting within text fields keeps normal text editing. Cmd/Ctrl+Shift+C opens copying and Cmd/Ctrl+O opens file import.

The **PowerPoint** button commits the current canvas draft and prepares an editable `.pptx` download from that snapshot, using the preview's text measurements. Conversion diagnostics remain visible in the download dialog. Missing/remote images require an explicit host resolver or embedded data; export does not silently fetch them or omit them. Save OPF separately to retain the complete original source. Since 0.14, PPTX export names the font the user selected, so PowerPoint uses it when installed or available as a Microsoft 365 cloud font. The download does not embed font binaries, and license-restricted (proprietary) fonts are never embedded. Arbitrary native positions and unsupported PowerPoint features can change during reimport.

Run `npm ci`, `npm run build:playground`, then serve `artifacts/playground` with a local static server. This example uses the published core/render/PPTX packages and this checkout's editor source; it does not require an account, AI provider or paid service. `npm run test:playground` builds and executes a real browser flow (local Edge on Windows, installed Chromium in CI): author JSON, inline edit, export a native merged table, validate/reimport the actual downloaded file, undo/redo, save OPF and reject malformed input without changing the document. It is browser behavior evidence, not a claim of native PowerPoint raster equivalence.

Slide insertion does not merge root speakers, organizations, or narrative metadata. Use Open as a presentation for the full source document. Some gallery presets contain minimal examples. The root OPF workspace's `docs/live-editor.md` documents the complete demo and npm API workflow.


## Schema-driven property editing

`@openpresentation/opf-editor/schema-inspector` exports `createSchemaInspector(container, {editor, path, onDraft, onCommit})`. It uses the canonical schemas to expose optional properties, union forms, nested arrays and maps, catalog records, and scalar fields. Valid drafts invoke `onDraft` for a host preview. `commit()` validates and applies one undoable root patch; `reset()` discards the draft; `navigate(path)` selects another field; `destroy()` unsubscribes and removes owned DOM. Concurrent document changes reject a stale draft.

`@openpresentation/opf-editor/schema` exports schema resolution, field traversal, initial values, and the full property inventory. These APIs power the All properties workspace and the gallery reference. Arbitrary extensions can use string, number, boolean, object, array, and null forms. Full-schema editing does not imply that the SVG renderer implements every visual feature.


### Rich text on the canvas

FA-13: the toolbar has a **Code** button (`TextRun.code`: an inline code span in the design's code font) and a **Language tag** field (`TextRun.lang`, a BCP-47 tag such as `fr-FR`; clear it to follow the deck language again). `formatRichTextRange` accepts `code` (boolean) and `lang` (a tag) like the other run styles, and **Reset style** clears both. `code.highlight` (lines to emphasize in a code block) has no dedicated control: it is edited in the generic schema form (**All properties**, `createSchemaInspector`), where it is an array of line numbers and `[start, end]` ranges. The design controls panel has a **Watermark text** field beside the watermark image.

Select rendered rich text to format it, or click a rich text block to type (see *Entering text editing*). The toolbar supports character styles, point size, font family, hex color, scheme slots/roles, `var:<id>` references, links, scripts, and selected-text replacement. Plain text payloads, titles, subtitles, tags and quote text offer **Format text** during inline editing, and a title, subtitle, tag or quote text that is already `TextRun[]` opens the same rich input (FA-10). **Edit runs** opens the structured fields; `canvas.editProperties(path)` does the same programmatically. Each action is validated and undoable. Version 0.1.1 supports direct mixed-style typing: click to type, drag to select, double-click for a word, triple-click for a paragraph, use Format selection for styles, and commit with Done or Ctrl/Cmd+Enter. Escape cancels. Native input and composition events preserve run metadata; the canonical SVG supplies glyph/caret geometry. The whole session commits as one undo step, with draft undo/redo available while typing. Empty-line caret geometry requires renderer 0.1.1 or later; cross-engine and real operating-system IME verification remain open.

Version 0.7.0: rich input maps the textarea's LF-normalized offsets back to the original source. Typing preserves untouched CRLF/CR endings and surrounding run metadata; newly inserted newlines use the first source line-ending style. The `updateRichTextInput` change offsets are native textarea offsets, while formatting and replacement helpers continue to use original source offsets.

Browser regression checks run with `npm run test:rich-input-browser -- artifacts/rich-input-browser.json measured` (or `estimated`). An optional consumer path after the mode selects an existing coordinated installed consumer; all browser runtime and font-preparation imports must then resolve inside that consumer. See [line-ending acceptance](docs/evidence/rich-input-line-endings-20260915/README.md) for scope and preserved failures.

Headless applications and agents can import `formatRichTextRange`, `replaceRichTextRange`, and `richTextContent` from `@openpresentation/opf-editor/rich-text`. The helpers preserve surrounding run metadata and accept UTF-16 offsets on whole grapheme boundaries. A null format value removes an override. Apply the returned value through the editor session or validate the resulting document before saving.


### Resize dynamic layouts

The canvas can show draggable, keyboard-accessible dividers for root and nested composition tracks. Pass `layoutEditing: true`, or call `canvas.setLayoutEditing(true)`. A pointer drag produces live preview drafts and commits one undo step. Escape cancels; strict overflow prevents invalid fit. Automatic layouts become explicit grids when resized. Promoted regions stay fixed, while their nested groups can be resized.

`prepareTrackResize(presentation, flow, boundary, fraction)` from `@openpresentation/opf-editor/layout` returns a candidate document and guarded patches for headless agents. Obtain `flow` from the shared renderer's `geometry.flows`; preview the candidate before applying. The editor supports JSON Patch `test` guards alongside add/replace/remove/move/copy (RFC 6902, executed by core's `@openpresentation/opf/patch`, the module `opf edit` and `opf diff` also use); failed guards leave state and history unchanged. This export is included in version 0.1.0.


### Move complete blocks

For v2 templates, Arrange draws editable region targets from `geometry.regions`, including empty and collapsed regions. Region menus insert accepted content and move compatible blocks with a region pin through the editor session, preserving validation and undo. Nested content groups retain their own composition handles; layout records contain no v1 slots.

Arrange mode also shows numbered block handles. Drag to reorder siblings, use arrow keys for earlier/later, or click a handle to choose an existing destination group/slide and insertion position. The move preserves the whole block, including rich text, table/chart data, and nested groups. Each move is validated, preflighted by the renderer, and undoable. Parent weights stay with layout positions; moves that leave an empty container or create a containment cycle are rejected.

Agents can import `prepareBlockMove` and `listBlockContainers` from `@openpresentation/opf-editor/layout`. The prepared result includes a full candidate document, guarded atomic patches, the new block path, and a changed flag. Destination indexes refer to the pre-removal document. Use `canvas.openBlockMenu(path)` for the corresponding browser controls.

## Styled and merged table cells

Define cells with `{value, style, rowSpan, colSpan}` and place explicit `null` at covered positions. Inline editing follows the anchor's `.value` path, preserving its style and merge geometry. Click a value, or focus it and press Enter, to edit; the existing text-formatting controls support scalar promotion, rich runs and partial selection. Covered positions are not separate editable targets.

The core schema rejects overlapping/out-of-bounds spans and hidden content. Model patches can change a span and remove a row atomically; undo restores the complete operation. Styling or restructuring a table remains available through JSON/model edits and the existing structured property forms.

`test/styled-table.mjs` covers model behavior. The core repository's `scripts/build-rich-table-browser.mjs` builds both rich and styled browser fixtures. Browser verification uses actual loaded Roboto fonts and covers merged typing, scalar formatting, partial selection, empty values, cancellation and undo. Native PowerPoint appearance is a separate converter verification boundary.

Final 0.19 local acceptance uses core `e21c472d88057d9d90cfa507fe91b89063f3f29a`, gallery `e0a7eee2dfe996e680b34a907cabfe41905e6d99`, renderer `9fbddcb78dbebcb87355922ca92af7d26c24c48d` and PPTX `006e8a7df9c19e85b230a27f19794e5356cdac78`, installed or linked explicitly. Gallery 2 is a direct host/example/test import. Its development dependency declaration and registry lock reconciliation, along with final core/renderer/PPTX release ranges and packed-consumer checks, remain held for the actual dependency releases. Local candidate checks do not establish a published dependency graph.
