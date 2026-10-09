# OPF Editor

Unfinished prepared shaping work is preserved in the [September 15 roadmap](docs/roadmap-shaping-20260915.md); it is not part of the published runtime.

## Using the editor with opf-render 0.16: what to install (RR-63, unreleased)

`@openpresentation/opf-render` is an optional peer of the editor, and from render 0.16 its heavy pieces are optional peers too, so install only what you use. The editor itself draws with `@openpresentation/opf-render/svg` and loads fonts with `/fonts-browser`, which need nothing else. Add:

| You use | Also install |
| --- | --- |
| The canvas, the preview, SVG downloads in a browser (the host serves its own font files) | nothing |
| `loadFonts` from `/fonts-node` (a server, a test, a build script such as `npm run build:playground`) | the font packages of the pack: `@expo-google-fonts/roboto` and `roboto-mono` for `base`; also `arimo`, `caladea`, `cousine`, `gelasio`, `tinos` and `noto-sans` for `office`; a script face (`scripts: 'auto'`) needs its `@expo-google-fonts/noto-*` package. A missing one fails with `font-resource-unavailable` and names it |
| `svgToPng` / `svgToPdf` from the Node entries (`/png`, `/pdf`) | `@resvg/resvg-js` (and `sharp`, `pdf-lib` as the renderer's README says); a missing one fails with `converter-missing` |
| `exportDeck` PDF (vector), PNG, SVG | nothing: the browser entry `@openpresentation/opf-render/export-browser` imports no converter |
| `exportDeck` raster PDF (`pdfMode: "raster"`) | `pdf-lib`, imported by the page and passed as the `pdfLib` option (`import * as pdfLib from "pdf-lib"`); without it the export rejects with `converter-missing` |

```js
const pdfLib = await import("pdf-lib");
await exportDeck(editor.presentation, { format: "pdf", pdfMode: "raster", pdfLib, fonts });
```

The playground imports `pdf-lib` for you when its raster PDF choice is used.

## OPF 0.15: catalogs from the host, backgrounds and image blocks (FA-23)

The release after 0.14.2 moves the editor onto core 0.15 (a breaking, clean spec: no migration). See `changes/fa-23-opf-0-15.md`.

- **Catalogs come from the host.** Core ships no catalog records; the editor library imports no catalog data either. The host registers its catalogs once, on the session, and the editor hands that one list to core (resolution, validation, `embed`, `copySlides`, `updateFromCatalog`), every picker, the canvas renderer and the exports:

  ```js
  import { createEditorSession, saveDocument } from "@openpresentation/opf-editor";
  import { defaultCatalog, catalogDisplay } from "@openpresentation/opf/catalog"; // the host app's choice, not the library's

  const editor = createEditorSession(doc, { catalogs: [defaultCatalog, acmeCatalog] }); // the first is the host default
  editor.catalogs;                      // the frozen list; editor.setCatalogs([...]) replaces it (one "catalogs" event)
  const { document } = saveDocument(editor); // core embed: every referenced record embedded once, renders with no catalog
  ```

  `mergeCatalogs(...lists)` is the one merge (the session's list first, the first catalog per `source` wins); `catalogsFor(editor, options)` is the list for one call. Pickers list core's `catalogRecords` and write the reference it gives, `id` or `name:id`.
- **Save and export embed.** `prepareSave`/`saveDocument`, `serializeOpfTransfer` (presentation and slide scope) and `exportDeck` call core's `embed`; the playground's OPF download and PPTX export do too.
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

In version 0.7.1, layout choices add blank payloads for missing declared placeholders, preserving existing content. Repeated slots use separate blocks; subtitle slots use `subtitle`, and metric slots use `{ "metric": { "value": "", "label": "" } }`. Charts receive the smallest valid data scaffold rather than invented numeric values. Existing positioned content stays in its regions; additional body slots append inside the last region. Non-layout options still change only their value. Custom menus must apply the full source returned by `replaceFieldOption`, or use `fieldOptionEdit(context, value)` and pass its `from`, `to`, and `insert` to `control.api.replace` as one undoable edit. Always check that `context.source` still matches the editor first. Version 0.7.0 only changed the selected token. Version 0.7.1 requires core 0.10.1 for metric, quote and timeline placeholder contracts.

Run `npm run test:json` and `npm run test:json-browser` for the focused model and offline browser checks. The browser runner also accepts a report path followed by a clean installed consumer directory. These checks cover the JSON control; renderer, native PowerPoint and production adoption remain separate acceptance steps.

Version 0.7.0 uses core 0.10.0 and renderer 0.8.0. Code source/metadata edits preserve line endings, literal tabs and cancellation/undo through accepted trace targets. Committed preview uses shared quote/code geometry; the active source textarea uses native browser editing. `paginateSlide` records a one-page readability-policy change in undo history, and an unchanged repeat is a no-op. Coordinated examples use PPTX 0.8.0 for exact code source/metadata recovery. Native formatting, font theme and geometry are not restored; quotes still import as editable text blocks with structure and readability-policy loss.

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

```js
import { createCanvasEditor } from '@openpresentation/opf-editor/canvas';

const canvas = createCanvasEditor(container, {
  presentation,
  fonts, // the renderer's fonts handle: const fonts = await loadFonts({ faces, ... })
  onCommit: ({ editor }) => saveDocument(editor.presentation),
});
await canvas.ready;
// canvas.destroy() when unmounting.
```

Load the same font bytes into the browser with `loadFonts` from `@openpresentation/opf-render/fonts-browser` before mounting; the handle it returns is the one `fonts` option of the canvas, `exportDeck`, `editor.composeSlide` and `editor.paginateSlide`. The host owns font URLs, storage and collaboration. For non-Latin documents, pass the pinned script pack's location as `scriptBaseUrl` and the canvas calls `fonts.ensure(presentation)` after edits (`scripts: 'auto'`, FF-19): only the faces for the scripts a document draws are fetched, once, hash-verified, for example Noto Sans JP for Japanese; a Latin-only document fetches none. The playground does this from `./script-fonts/`, which `npm run build:playground` fills with the pinned faces. `onDraft` provides live document drafts; the session only changes on commit. Escape cancels. Concurrent edits to the selected payload cancel a stale draft.

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

`session.composeSlide(index, { fonts })` and `session.paginateSlide(index, { fonts })` take the same handle and resolve the slide's canvas, layout, theme, colour scheme and font families with core's `resolveSlideContext` (slide design, then deck design, then theme, then the engine default: the order the renderer and the PowerPoint export use) and the session's registered catalogs, so the editor composes what is drawn and exported. A reference that resolves nowhere never throws: the slide composes automatically or with core's `ENGINE_DEFAULT_*`, and `onDiagnostic` hears each `unresolved-reference` diagnostic. The handle's `textMeasurement` is strict: for a document with a script the design font lacks (Japanese under Aptos) pass `{ fonts: { textMeasurement: createScriptTextMeasurement(fonts.textMeasurement, resolveScriptFonts(presentation, { slideIndex })) } }` (`createScriptTextMeasurement` is from `@openpresentation/opf-render/fonts`, `resolveScriptFonts` from `@openpresentation/opf/composition`), as `renderSvg` does internally.

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
import { renderSlideSvg } from "@openpresentation/opf-render";

const editor = createEditorSession(opfDocument, { rejectInvalid: true });
const svg = renderSlideSvg(editor.presentation, 0, { trace: true, fonts });

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

`listSwitchOptions(presentation, dimension, { catalogs, vocabularies })` lists what a dimension offers: a catalog dimension lists core's `catalogRecords` (the document's embedded records first, then the host catalogs'), each with the reference to write; `charts`, `socials` and `languages` list core's vocabularies, labelled from `vocabularies` (`catalogDisplay` from `@openpresentation/opf/catalog`, supplied by the host). `compatibleChartTypes(presentation, { slideIndex, path })` lists the chart types the chart's inline data can use as it is, by data shape: the first column labels the categories and each further column is a series (how the renderers read it), a type with N series needs exactly N value columns, except that stacked types and the combo chart take that many or more (combo: two or more), and the single-series, distribution and geographic types are offered only where they fit. Switching a combo chart to another type removes its `line`, `secondaryAxis` and secondary axis title. It is data-shape compatibility, not a claim that an engine draws the type. `currentSwitchValue(presentation, dimension, { slideIndex })` reads the value back as `{ value, scope }`.

## Design options (RR-06)

`@openpresentation/opf-editor/design-options` edits the design-level settings that used to need All properties. Each call is one validated patch and one undo step, at the deck or on one slide with `slideIndex`; `null` removes a value so it is inherited again. `prepare...` forms return the patch without touching a session.

```js
import { setDesignOption, setLogoVariant, setHeaderFooterZone, insertZoneValue, getDesignOption, designWarnings } from "@openpresentation/opf-editor/design-options";

setDesignOption(editor, "titleAlignment", "center", { slideIndex: 2 });   // /slides/2/design/titleAlignment
setDesignOption(editor, "watermark", { src: "asset:mark", opacity: 0.1 }); // merges into an existing watermark; false hides an inherited one
setLogoVariant(editor, "light", "asset:logo-white");                       // default stays a bare source; more variants make a LogoSet
setHeaderFooterZone(editor, "footer", "right", { text: "{{slide.number}} / {{deck.slideCount}}", logo: true });
insertZoneValue(editor, "footer", "left", "organization.name", { start: 0, end: 0 }); // puts {{organization.name}} at the start of the left text
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
| `logo` | `design.logo` | a source, an Asset object or a LogoSet; `setLogoVariant` edits one of the 12 variants |
| `organizationLogo` | `organization.logo` (deck only; `index` picks an organization) | a source or Asset object |
| `watermark` | `design.watermark` | `false`, a source, `{ src, opacity }` or the text stamp `{ text, opacity }` (fields merge; a lone source stays a bare source; setting `text` drops `src` and setting `src` drops `text`: a watermark is one or the other) |
| header and footer zones | `design.header` / `design.footer` `.left/.center/.right` | `setHeaderFooterZone` merges every part a zone can hold (`text`, `logo`, `image`, `date` (true, or a fixed date) and `dateFormat`, `socials`; `ZONE_FIELDS`) into one zone, checking each value. Generated values are `{{ }}` variables written in `text`, in the order the author wants and with `\n` between lines: `{{slide.number}}`, `{{deck.slideCount}}`, `{{slide.section}}`, `{{organization.name}}`, `{{speaker.name}}`, `{{deck.name}}` (the entries of `ZONE_VALUES`, the panel's "Insert value" menu). `insertZoneValue(editor, which, zone, name, { start, end, text, slideIndex })` puts one token into a zone's text at UTF-16 offsets (a selection is replaced; the end by default; `text` when a text box holds typing that is not committed yet) as one undoable, validated edit, and `prepareZoneValue` returns the patch without a session. The 0.16 fields `organization`, `speaker`, `section`, `slideNumber` and `slideNumberFormat` are gone with no alias (`{current}` and `{total}` too), and are refused with a message that names the variable to write instead. A removed field, an emptied zone and an emptied header are all deleted rather than left as `{}`; a removed field, an emptied zone and an emptied header are all deleted rather than left as `{}`. A slide's own header or footer replaces the deck's whole one, so the first edit on a slide starts from a copy of the deck's (its other zones stay), and a slide emptied that way hides the furniture (`false`) instead of inheriting it again |

A deck-scope change reports `shadowed` slides whose own design hides it (`clearSlideOverrides: true` removes those values in the same transaction). Results carry `warnings`: a header or footer zone with `logo: true`, or picture bullets, with no logo to draw (no slide, deck or primary-organization logo) is reported as `unresolved-logo`, and a zone that shows the organization's social profiles when there are none, or whose text uses a deck-wide variable the document has no value for (`{{organization.name}}` without an organization, `{{speaker.name}}` without a named speaker), or `{{slide.section}}` on a slide without a section, as `unresolved-content`, before export, as `designWarnings(presentation, slideIndex)` does for the current document. `DESIGN_OPTIONS` describes every option for a generic panel, and `getDesignOption` reads `{ value, scope, inherited }`.

### Image uploads (RR-06)

`@openpresentation/opf-editor/assets` turns a local file into an `assets` entry and uses it in the same undoable patch:

```js
import { applyImageUpload } from "@openpresentation/opf-editor/assets";
import { prepareLogoVariant } from "@openpresentation/opf-editor/design-options";

const change = await applyImageUpload(editor, file, (reference, presentation) => prepareLogoVariant(presentation, "light", reference), { alt: "Acme logo" });
change.assetId; // "acme-logo": the document now has assets["acme-logo"] = { src: "data:image/png;base64,...", mediaType, title, alt } and design.logo.light = "asset:acme-logo"
```

`build(reference, presentation)` is any `prepare...` function of this package, so the same upload works for the logo (all 12 variants), organization logo, watermark, a background (`prepareBackground`) and a header/footer zone image. The file is checked before anything changes: PNG, JPEG, GIF, WebP or SVG by its bytes (a `.jpg` that is really a PNG, a text file, an empty file and an SVG with script are refused), and at most `maxBytes` (default 2 MiB, `DEFAULT_MAX_IMAGE_BYTES`) with a message that says what to do. A host that stores images elsewhere passes `onAddAsset({ name, mediaType, bytes, size, alt, file })` and returns the reference to use (a web address, or an `asset:` id it added); nothing is then added to `assets`. `setAssetAlt` edits an asset's alt text as one step.

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
```

Styles use scheme roles, so they follow the color scheme, and the renderers keep the text readable on any fill. A style sets the header fill (`theme`, `plain`, `accent`), banded rows and borders (`theme`, `none`, `horizontal`, `grid`); named presets are `theme`, `banded`, `grid`, `minimal` and `open`, and `theme` removes a previous style. A style owns only the fill and border fields of a cell: text color, alignment, padding, values and merges are kept. Merging never hides text: covered cells that hold text refuse with `merge-would-lose-content` unless you pass `join: true`, which joins the words into the anchor with a space and keeps run formatting. Other refusals are `merge-overlap` (the region crosses another merge), `invalid-table-span` (outside the table, or a header cell spanning into the body) and `table-cell-covered`. Splitting leaves the formerly covered cells as empty text. `parseTableCellPath` maps a canvas selection to a table and cell, and `describeTableCell` and `readTableStyle` read the current state.

Table alt text (FA-27): `setTableAlt(editor, tablePath, { alt: "North America leads EMEA in Q4." })` writes the table's text alternative (`Table.alt`) as one undoable patch, like a chart's. `alt` is trimmed and an empty string or `null` removes it; `{ decorative: true }` writes the empty alt (decorative, and it wins over `alt`) and `{ decorative: false }` removes an empty alt. It works on a table that shows a shared dataset too, since the alt belongs to the table and not to its data. `readTableAlt(table)` gives `{ alt, decorative }` for a form and `prepareTableAlt` is the headless patch. The table section of the design controls has an "Alt text" field and a "Decorative (no alt text)" box, and find and replace searches `table.alt`. `validate` does not ask for a table alt, so the field is optional.

## Slide management (RR-21)

`@openpresentation/opf-editor/slides` adds, duplicates, deletes, reorders, hides and sections slides. Every function has a `prepare…` form that returns the JSON Patch for a document without touching a session (`{ presentation, patches, changed, selection }`), and an apply form that commits it as ONE validated, undoable change, so a single Undo restores the deck exactly and the preview, thumbnails and PPTX export follow from the document. An operation that changes nothing commits nothing (`changed: false`).

```js
import { addSlide, duplicateSlides, removeSlides, moveSlides, moveSlidesBy, setHidden, addSection, renameSection, removeSection, moveSection, setSection, listSections } from "@openpresentation/opf-editor/slides";

addSlide(editor, { at: 2, layout: "list-2x" });   // the layout's placeholders become empty slots, as when switching a slide's layout
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
  renderThumbnail: (deck, index) => renderSlideSvg(deck, index, { fonts, trace: false }), toolbar: document.querySelector("#slide-toolbar"),
  contentActions, // optional: { splitSlideByBlocks, mergeSlides } from "@openpresentation/opf-editor/content-actions"
});
editor.subscribe(() => manager.render());
```

`@openpresentation/opf-editor/outline` and `/outline-view` edit the deck as an outline: a row per slide title, subtitle, text paragraph and list item, and a read-only row for content that is not text (a chart, a table, an image) or text that carries formatting, so nothing is flattened away. Typing commits as one change when the row loses focus or on Enter. Enter adds a line (after a title: a slide), Alt+Up and Alt+Down move a bullet with the bullets nested under it, or a slide with its text, Alt+Shift+Right demotes and Alt+Shift+Left promotes. Demoting a bullet nests it (`level`); promoting a top-level bullet turns it into a new slide that takes the bullets after it; demoting a plain slide makes it a bullet of the slide before it (refused, with the reason, when that would drop content such as notes, blocks or a design). Backspace on an empty line removes it. Tab keeps moving focus, so the outline is no keyboard trap.

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
import { prepareDatasetImport, importData } from "@openpresentation/opf-editor/data";

setGridColumnFormat(editor, "slides.3.blocks.0.chart", 1, "$#,##0.0");   // header "Revenue" becomes { name: "Revenue", format }; null clears it
setChartMapping(editor, "slides.3.blocks.0.chart", { category: "Region", series: ["Revenue"] });
detachGridDataset(editor, "slides.3.blocks.1.table");                   // its own copy instead of the shared dataset
const stored = prepareDatasetImport(editor.presentation, importData(csv, { as: "chart" }), { id: "revenue" });
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
  vocabularies: catalogDisplay, // from @openpresentation/opf/catalog, in the host app
});
const selectionControls = createDesignControls(contentPanel, { editor, getSlideIndex, getSelectedPath, sections: ["selection", "image", "table", "slide-content"], onSelectPath: select });
controls.refresh(); // when the slide or the selection changes
```

Sections: `look` (theme, color scheme, font scheme, language, this slide's layout), `background` (type, theme slot, solid color, gradient with its stops, image with fit, focus, alt text, recolor and overlay, any of the 54 patterns, opacity; a draft until Apply, with Remove), `header-footer` (choose header or footer and a zone, then every part the zone supports: a text box with an "Insert value" menu that puts the slide number, slide count, section, organization, speaker or deck name at the cursor as a `{{ }}` variable (Enter commits, Shift+Enter starts a new line), logo, image, social profiles, and the current or fixed date and format, with a summary of the zones in use), `brand` (logo variants, organization logo, picture bullets, accent font, watermark), `layout-options` (alignment, direction, primary chart, content box, default image fit), `info` (narrative, tone, audience, socials), `selection` (content type with a loss report, list levels, group of metrics, group and ungroup, image to background or watermark, replacement, chart type), `image` (the selected image block's fit, focus, shape, corner radius, border, opacity, recolor, overlay, aspect ratio and placement), `catalog` (reference findings and the explicit "Update from catalog"), `slide-content` (blocks to regions and back, design images back into the content) and `table` (style, merge, split, cell fill and alignment). The panel is native `details`, `fieldset`, `select`, checkbox and text controls with a label on each, so it works with the keyboard and with screen readers: groups open with Enter or Space, a select changes with the arrow keys, text fields commit on Enter or when you leave them, and results and refusals are announced in `role="status"` and `role="alert"` regions. A refused change (an invalid value, text a merge would hide) is explained, changes nothing, and puts the field back. "Applies to" switches the design controls between the whole presentation and the current slide, and a control shows when a slide value is "set on this slide" or "from the presentation". The panel offers only conversions that exist, shows what a conversion loses before you choose it, and lists why an unavailable one is unavailable.

In React (or Svelte, or anything else) mount it into a ref and destroy it on unmount; it needs no framework runtime:

```jsx
useEffect(() => {
  const controls = createDesignControls(ref.current, { editor, getSlideIndex: () => slide, getSelectedPath: () => selected });
  return () => controls.destroy();
}, [editor]);
// call controls.refresh() (keep it in a ref) when slide or selected changes
```

The playground mounts both panels (the Design tab, and the selection area of the Content tab). One click on text still enters text editing; the panels follow the selection after Escape. Every image field (logo variants, organization logo, watermark, background image and header/footer zone image) takes an asset reference (suggested from the document's assets), a web address or a data address, and has a file picker and an alt-text field: the chosen file is validated (PNG, JPEG, GIF, WebP or SVG, up to `maxImageBytes`, 2 MiB by default), added to `assets` and used in one undo step, or handed to your app through `onAddAsset`. Alt text is saved on the asset; typed before an upload it is used for that upload.

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
import { renderSlideSvg } from '@openpresentation/opf-render/svg';

const panel = createTemplatePanel(container, {
  editor,
  // The live preview: the template drawn with the values typed so far (unfilled variables show their example).
  renderPreview: ({ presentation, variables, slideIndex }) => renderSlideSvg(presentation, slideIndex, { fonts, variables }),
  getTarget: () => ({ path: selectedPath, start, end }), // the text field a token is inserted into; omit to hide that section
  onApply: () => redraw(),
});
```

The panel lists every variable with the input its kind needs (text, number, date, color, link, one-entry-per-line list, and an image source with an asset pick or an uploaded file, 5 MB at most), marks which are filled, defaulted, optional or still needed, says where each is used, rejects a bad value in place, and previews the result as values change. **Fill the presentation** resolves the variables and replaces the document with the concrete deck as one validated, undoable edit (one Undo restores the template); **Fill what is ready** keeps the unfilled variables declared. **Insert a variable into text** inserts `{{id}}` into the selected text, optionally declaring a new variable in the same edit. A **Built-in variables** section lists the values the document supplies itself (`deck.*`, `speaker.*`, `speakers`, `organization.*`, and `speaker.<id>.*` / `organization.<id>.*` by id), read-only, each with its current value or "not set" and where it is used; they are filled from the document's own fields, not in the panel, and the same names appear in the insert list so `{{speaker.name}}` can be inserted without declaring anything. The three slide-scoped built-ins (`slide.number`, `slide.section`, `deck.slideCount`; `scope: "slide"` in `listBuiltins`) come last and have no single value: the panel shows them as "varies per slide" (and notes when no slide has a section), because each slide gets its own when it is drawn or exported. A checkbox marks the document as a template.

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

`@openpresentation/opf-editor/export` turns the deck into a download in the page, next to the PowerPoint export; the playground's "PDF · PNG · SVG" button is a thin dialog over it.

```js
import { exportDeck } from "@openpresentation/opf-editor/export";
const result = await exportDeck(editor.presentation, {
  format: "pdf",              // "pdf" | "png" | "svg"
  slides: "all",              // or "current" with slideIndex, or [slide numbers]; hidden slides only with includeHidden
  pdfMode: "vector",          // or "raster" (an image per slide; also pass pdfLib: import * as pdfLib from "pdf-lib"); PNG and raster density: scale 1 to 4
  fonts,                      // the renderer's fonts handle (loadFonts): measures, loads the faces the deck needs, supplies the faces to embed
  renderOptions,              // catalogs, date, ...
  signal, onProgress, onDiagnostic,
});
// result.download = { name, type, bytes }: one file, or a ZIP of the slides; result.diagnostics lists what to review.
```

- **Same drawing as the preview.** The slides are drawn by `renderSvg` with the same fonts handle as the preview (its `textMeasurement`), so a PNG or SVG is the preview, and the PDF is converted from those SVGs rather than laid out again.
- **Fonts.** The fonts handle loads the faces the deck needs before anything is drawn (a failure rejects with `fonts-unavailable`). Only faces the handle's registry holds are embedded (bundled or hash-pinned, never a system font), only where a slide draws them, as `@font-face` data in each SVG and as subsets in the PDF. A face whose own license text is not OFL, Apache, MIT or UFL is left out and reported (`export-font-license`).
- **PDF** is the renderer's vector PDF (selectable text, vector shapes, embedded subsets, tagged structure), `mode: "raster"` is the image-only form. **PNG** is drawn on a canvas from the same SVG (within anti-aliasing of the renderer's resvg PNG) and is limited to 40 megapixels. **SVG** files are standalone (XML header, fonts embedded, no external references). Several files are packed in a ZIP (`createZip`, no dependency).
- **Names.** `exportFileName(deck, ext, suffix)` uses the deck's `filename` (a trailing .pptx/.pdf/.png/.svg dropped), else the slugified `name`, else `presentation`; slides are `name-01.png`, archives `name-png.zip`.
- **Progress and cancel.** `onProgress({ stage, done, total, message })` reports fonts, drawing, per-page conversion and packing; an aborted `signal` rejects with `export-aborted` between pages and slides.
- **Diagnostics.** `describeDiagnostic` normalises renderer and converter notes into `{ code, severity, message, slide? }`: `pdf-font-substituted`, `pdf-glyph-missing`, `pdf-raster-fallback` and the renderer's own are `warning`; `pdf-font-embedded` is `info`.
- PDF and PNG need `@openpresentation/opf-render` with its `export-browser` entry (RR-23, opf-render#105); without it they reject with `export-unavailable` and SVG still works. The entry imports no PDF library (opf-render 0.16): the vector PDF, PNG and SVG need nothing else, and `pdfMode: "raster"` needs the `pdfLib` option. Verified in Chromium; Safari and Firefox are not exercised in CI. The playground bundle grows by the PDF writer, fontkit shaping and the bidi algorithm.

Catalog controls initialize an absent deck or slide `design` for known theme, color-scheme and font-scheme fields as one validated transaction. Undo removes a newly created parent; existing design fields are retained. DOM, React and Svelte catalog controls accept `onError(error)` and emit a bubbling `opferror` event on rejected edits, restore the committed selection and expose native validity feedback. General `editor.set` and JSON Patch require existing parents.

Optional downloads can be deferred until requested: dynamically import `@openpresentation/opf-editor/export` inside the download handler. For a PowerPoint download, dynamically import `@openpresentation/opf-pptx` inside that handler too; the `/export` helper covers PDF, PNG and SVG. This defers conversion code, while canvas rendering and font measurement still have their own startup costs.

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
2. Merge after CI is green, then publish by pushing the git tag `opf-editor-v<version>` (or `@openpresentation/opf-editor@v<version>`) at the merge commit. The workflow verifies that the tag matches `package.json` and reruns audit, typecheck, validate, tests, playground, code/JSON browser and packed checks before `npm publish --access public --provenance`. A manual `workflow_dispatch` runs the same job without the tag check and is a fallback only.
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

When the slide's layout record has placeholder groups (FA-26, `{ "type": "group", "composition", "placeholders" }`), Arrange also outlines every slot of the record at its cell (`geometry.slots`): groups, filled regions and labelled empty regions. The slots belong to the record, so they are shown, not edited; the slide's content in them keeps its own selection and handles. Layout pickers and the JSON field menu describe such a record as `title, column (text, text), chart` and compare layouts by their leaf regions.

Arrange mode also shows numbered block handles. Drag to reorder siblings, use arrow keys for earlier/later, or click a handle to choose an existing destination group/slide and insertion position. The move preserves the whole block, including rich text, table/chart data, and nested groups. Each move is validated, preflighted by the renderer, and undoable. Parent weights stay with layout positions; moves that leave an empty container or create a containment cycle are rejected.

Agents can import `prepareBlockMove` and `listBlockContainers` from `@openpresentation/opf-editor/layout`. The prepared result includes a full candidate document, guarded atomic patches, the new block path, and a changed flag. Destination indexes refer to the pre-removal document. Use `canvas.openBlockMenu(path)` for the corresponding browser controls.

## Styled and merged table cells

Define cells with `{value, style, rowSpan, colSpan}` and place explicit `null` at covered positions. Inline editing follows the anchor's `.value` path, preserving its style and merge geometry. Click a value, or focus it and press Enter, to edit; the existing text-formatting controls support scalar promotion, rich runs and partial selection. Covered positions are not separate editable targets.

The core schema rejects overlapping/out-of-bounds spans and hidden content. Model patches can change a span and remove a row atomically; undo restores the complete operation. Styling or restructuring a table remains available through JSON/model edits and the existing structured property forms.

`test/styled-table.mjs` covers model behavior. The core repository's `scripts/build-rich-table-browser.mjs` builds both rich and styled browser fixtures. Browser verification uses actual loaded Roboto fonts and covers merged typing, scalar formatting, partial selection, empty values, cancellation and undo. Native PowerPoint appearance is a separate converter verification boundary.
