# OPF Editor

Unfinished prepared shaping work is preserved in the [September 15 roadmap](docs/roadmap-shaping-20260915.md); it is not part of the published runtime.

Version 0.10.0 requires `@openpresentation/opf` ^0.11.2, renderer ^0.11.0, and PPTX ^0.11.0 (install them together so cover centering resolves the same core everywhere; renderer 0.11.0 also activates the playground's automatic script fonts and lazy Intos fonts). Version 0.9.0 required `@openpresentation/opf` ^0.11.1, renderer ^0.10.0, and PPTX ^0.10.0. Composition and slide transfer fall back to the shared `aptos` font scheme and report unknown scheme ids through `onDiagnostic`; gallery apply keeps every font-scheme role.

Version 0.8.0 required `@openpresentation/opf` ^0.11.0, renderer ^0.9.0, and PPTX ^0.9.0. Named ColorRefs (scheme slots, roles, and `var:<id>`) paint through the published renderer and hex-resolve on export. Payload ids share the slide id namespace for pagination and transfer. Native `schemeClr`, theme write, and `p:hf` remain out of scope.

Version 0.7.0 and this checkout require Node 24 (`24.x`). Use `.nvmrc` for local development. Earlier published versions retain their original engine declarations. Browser entrypoints remain browser-safe; native application compatibility is verified separately.

Version 0.7.0 forwards effective title alignment and shared outline placement options through composition and explicit pagination. Use the same `textMeasurement` and `textRasterPadding` in canvas rendering and export. Accepted rich-text trace origins support selection, caret placement and undo. See the [source contract and limits](https://github.com/OpenPresentation/opf/blob/f94125a1ff95bf0974a055fe1c081d348dad54f2/docs/plans/text-placement.md); native PowerPoint fidelity remains separate.

Embeddable local editor primitives for Open Presentation Format documents. The package turns traced `@openpresentation/opf-render` SVG output into JSON-path-aware edits, validates OPF after each change, and records undo/redo as JSON Patch operations.

### Reusable JSON control (0.7.0)

Version 0.7.0 exposes `mountJsonCodeEditor` from `@openpresentation/opf-editor/json-editor` and `getJsonFieldContext` / `replaceFieldOption` from `/json-options`. Earlier published version 0.6.0 does not include these exports. They extract the code editing and contextual choices already used on openpresentation.org, so hosts can reuse them without replacing their surrounding UI.

```js
import { mountJsonCodeEditor } from '@openpresentation/opf-editor/json-editor';
const control = mountJsonCodeEditor(container, {
  code: source,
  label: 'OPF JSON document',
  lineNumbers: true,
  catalogs: loadedCatalogRecords,
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

Click a categorical property/value or press `Ctrl+Space`, `Cmd+Space` or `Alt+Down` to open its choices. Document catalog records override already-loaded records, which override built-ins; the actual schema supplies enums and booleans. Prose and extension fields do not gain menus just because their keys resemble schema fields. External catalog URLs are not fetched. `setCatalogs` replaces the host's loaded context and closes stale choices. Supply `onOptions(left?, top?)` to retain an existing menu UI.

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
- Structured catalog controls that only commit known catalog IDs
- JSON Patch state transitions with inverse patches for undo/redo
- Optional DOM controls plus React and Svelte bindings in separate embeddable entry points

## Live browser canvas

The new `@openpresentation/opf-editor/canvas` entry provides a framework-independent SVG canvas with inline text/table-cell editing, live validated drafts, undo/redo, cancellation, and structured property forms for charts, lists, metrics, quotes, code, timelines and images. Mount it in a DOM container:

```js
import { createCanvasEditor } from '@openpresentation/opf-editor/canvas';

const canvas = createCanvasEditor(container, {
  document: presentation,
  renderOptions: { textMeasurement: fontRegistry.textMeasurement },
  onCommit: ({ editor }) => saveDocument(editor.document),
});
await canvas.ready;
// canvas.destroy() when unmounting.
```

Load the same font bytes into the browser using `loadBrowserFontRegistry` from `@openpresentation/opf-render/fonts-browser` before mounting. The host owns font URLs, storage and collaboration. For non-Latin documents, pass the pinned script pack's location as `scriptBaseUrl` and call `fonts.ensureScripts(document)` after edits (renderer with `scripts: 'auto'`, FF-19): only the faces for the scripts a document draws are fetched, once, hash-verified, for example Noto Sans JP for Japanese; a Latin-only document fetches none. The playground does this from `./script-fonts/`, which `npm run build:playground` fills with the pinned faces. `onDraft` provides live document drafts; the session only changes on commit. Escape cancels. Concurrent edits to the selected payload cancel a stale draft.

Fonts load before pixels (FF-41). A document can need faces the browser registry has not loaded yet: script faces for the languages it draws and vendored preview faces for the font families it resolves (Intos for Aptos, Open Sans, Barlow). Pass a font gate as `fonts` and the canvas never renders such a document early: on every path (editor changes, undo and redo, imports, dimension switches, slide changes, in-progress edits) it shows "Loading fonts…", loads the faces and then renders. A load that fails is reported through `onFonts`/`onError` and offers a retry button; nothing retries by itself, and the failed document is not drawn.

```js
import { createCanvasEditor, createFontGate } from '@openpresentation/opf-editor/canvas';

const fonts = createFontGate(fontRegistry); // a registry without the lazy loaders gates nothing
const canvas = createCanvasEditor(container, { document, fonts, renderOptions: { textMeasurement: fontRegistry.textMeasurement } });
// Other renders of your own: fonts.run(document, { ready: draw, failed: showError, loading: showSpinner })
```

Note that `session.composeSlide()` and `session.paginateSlide()` measure with the plain `textMeasurement` you pass, which is strict: for a document with a script the design font lacks (Japanese under Aptos) pass `createScriptTextMeasurement(fontRegistry.textMeasurement, resolveScriptFonts(document, { slideIndex }))` from `@openpresentation/opf-render/fonts`, as `renderSvg` does internally.

These APIs were introduced in 0.1.0. Version 0.7.0 requires core 0.10.0 and renderer 0.8.0 for the canvas, including shared accepted geometry, styled/merged cells, rich table values, headers and content-aware row heights. See the OPF repository’s `docs/live-editor.md` for setup, the support matrix and roadmap. `pnpm pack:ecosystem` in that repository also prepares local preview tarballs for coordinated development.

The canvas retains canonical SVG glyphs while a transparent native input supplies the caret. Advanced shaping, freeform object positioning, all chart/media treatments, and cross-engine pixel identity remain work in progress. The Source dialog in the playground now provides a live JSON preview; changes are validated before committing.

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
import { renderSvg } from "@openpresentation/opf-render";

const editor = createEditorSession(opfDocument, { rejectInvalid: true });
const svg = renderSvg(editor.document, { trace: true });

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

Catalog helpers commit catalog IDs from the OPF catalog registry instead of accepting freeform incompatible values:

```js
import {
  createCatalogSelect,
  getCatalogOptions
} from "@openpresentation/opf-editor";

getCatalogOptions("themes").map((option) => option.id);

const themeSelect = createCatalogSelect(editor, {
  path: "design.theme",
  catalogKind: "themes",
  label: "Theme"
});

toolbar.append(themeSelect);
```

Invalid IDs throw before they reach the document. Existing object-form references keep their sibling override fields and replace only `id`.

## Dimension switches

`@openpresentation/opf-editor/switches` turns "switch this pptx.gallery dimension to X" into one validated, undoable transaction. It covers the 14 gallery dimensions (FF-16, [font-fidelity-everywhere](https://github.com/OpenPresentation/opf/tree/main/docs/programs/font-fidelity-everywhere)):

```js
import { switchDimension, prepareDimensionSwitch, SWITCH_DIMENSIONS } from "@openpresentation/opf-editor/switches";

switchDimension(editor, "font-schemes", "georgia");                      // /design/fontScheme
switchDimension(editor, "charts", "line", { slideIndex: 1 });            // /slides/1/chart/type
switchDimension(editor, "blocks", "list", { path: "slides.2.blocks.0" }); // replace one block
editor.undo();                                                            // one step per switch
const { patches, document } = prepareDimensionSwitch(editor.document, "themes", "classic"); // preview only
```

| Dimension | Document patch | Notes |
| --- | --- | --- |
| `layouts` | `/slides/N/layout` | Needs `slideIndex`. Adds the blank payloads the layout declares, like the JSON editor's layout choice; existing content stays. |
| `color-schemes`, `font-schemes` | `/design/colorScheme`, `/design/fontScheme` | Deck by default, one slide with `slideIndex`. An inline object value is replaced by the bare id. |
| `themes` | `/design/theme` plus the theme's color scheme, font scheme, background and dimensions | Writes the whole bundle, as the gallery's theme snippet does, so fonts follow. `bundle: false` changes only the id. |
| `languages`, `narratives`, `tones`, `audiences` | `/language`, `/narrative`, `/tone`, `/audience` | Catalog ids; `audiences` accepts an id or an array. |
| `backgrounds` | `/design/background` | A background object or a shorthand string (theme slot such as `dark1`, or a hex color). |
| `headers-footers` | `/design/header`, `/design/footer` | `{header?, footer?}`: an absent field stays, `null` removes it. |
| `image-treatments` | `/design/slideImage`, `/design/imageFill` | `{slideImage?, imageFill?}`, same rule. |
| `socials` | `/speaker/socials/<platform>` or the `organization` | `{platform, handle}` with `owner` and `index`; the owner must exist. |
| `charts` | `<chart owner>/chart/type` | The slide's first chart, or the block named by `path`. The data is kept as it is and only the document schema is checked: the editor does not verify that the data suits the new type, so preview the result (map types, for example, expect their own data). |
| `blocks` | replaces one block | `path` names a complete `blocks/N` block or a slide/region with one content field. The value is a block kind or a block object. |

A deck-level design switch cannot reach a slide that carries its own value for that key. The result lists those slides in `shadowed`; `clearSlideOverrides: true` removes the overrides in the same transaction. `record` adds a gallery item's catalog record inline in the same transaction when neither the document nor the bundled catalog defines its id (a gallery-only layout or font scheme). Every switch is validated: an unknown catalog id, an invalid value or an invalid resulting document throws before anything changes, and switching to the current value commits nothing. The editor session emits the usual `patch`, `undo` and `redo` events with `meta.source: "dimension-switch"` and `meta.dimension`, so the canvas and any host preview recompose from the switched document. `resolveSlideFonts(document, slideIndex)` returns the heading, body and code families the preview measures and the export names.

### Content-type conversion: replacement only (FF-16 decision)

The editor does not convert one content type into another. `blocks` is block replacement only: the old payload is discarded (text is not turned into list items, a list into a chart, and so on) and the block keeps only its `id` and `extensions`. Author the replacement content explicitly, or insert and remove blocks. This release provides no conversion API.

### What a switch does not establish

A switch changes the document; it does not change what the engines support. Language changes recompose fonts only as far as the installed core, renderer and PPTX packages implement the language and script model (FF-18, FF-19); the editor's own composition measures the Latin families. `image-treatments` previews only where the installed renderer draws `design.slideImage`. `test/switches.mjs` checks the patch, one undo step, undo/redo, and preview refresh for all 14 dimensions. `test/switches-export.mjs` exports after each switch, undo and redo and applies opf-pptx's FF-08 typeface check (`checkPptxTypefaces`) when the installed package has it; set `OPF_REQUIRE_FF08=1` to fail instead of skip when it does not. Published opf-pptx 0.9.1 does not include it.

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

1. Open a release-prep PR containing only the version bump, `CHANGELOG.md`, dependency ranges, lockfile and current-instruction docs. Publish in dependency order (core, then renderer, then PPTX, then editor): refresh this repo's lockfile only after the required `@openpresentation/opf`, `@openpresentation/opf-render` and `@openpresentation/opf-pptx` versions are on the registry (`npm install --package-lock-only`), then run `npm run test:packed` against them.
2. Merge after CI is green, then publish by pushing the git tag `opf-editor-v<version>` (or `@openpresentation/opf-editor@v<version>`) at the merge commit. The workflow verifies that the tag matches `package.json` and reruns audit, typecheck, validate, tests, playground, code/JSON browser and packed checks before `npm publish --access public --provenance`. A manual `workflow_dispatch` runs the same job without the tag check and is a fallback only.
3. Verify with `npm view @openpresentation/opf-editor@<version> version gitHead dist.attestations` and, from the core repo, `node scripts/test-editor-publication.mjs <version> <release-commit> <this-checkout>`. Never republish an existing version.

## Shared dynamic composition

The current checkout uses `@openpresentation/opf/composition` for portable geometry. Slides can select `auto`, `row`, `column`, or `grid`, set weighted tracks, and request path-specific overflow diagnostics. See the sibling OPF repo's `docs/dynamic-composition.md` for the complete contract.

Version 0.10.0 requires `@openpresentation/opf@^0.11.2`. The optional renderer peer requires `@openpresentation/opf-render@^0.11.0`. Coordinated playground export uses `@openpresentation/opf-pptx@^0.11.0`. Clean registry installs support the composition APIs without sibling checkouts. For coordinated source development, build OPF and run `node scripts/link-ecosystem.mjs` there; `pnpm test:ecosystem` verifies shared geometry and import/export behavior.

## Local interactive demo

With the sibling workspace linked, run `pnpm demo:editor` from the OPF repo, then serve its `artifacts/editor` directory with a static HTTP server. The demo lets you select SVG text, apply edits, change composition, edit the JSON document, and undo/redo. It uses the real renderer and editor session with no service dependency.

Editor snapshots are immutable and keep the same object identity until a change. This supports React `useSyncExternalStore` without render loops. `editor.document` remains a separate mutable copy for callers that need one.

Nested content groups expose their bounds through `editor.composeSlide(index).groups`. Use `editor.setGroupComposition("slides.0.blocks.0", {mode:"column"})` to reflow a group with validation and undo/redo. The playground includes a nested example and group arrangement controls.

`editor.paginateSlide(index, {minFontSize:24})` splits a crowded draft into ordinary OPF slides as one undoable transaction. It returns the change and source mappings; failed pagination leaves the document unchanged. The playground’s Split overflow action demonstrates the workflow.

`composeSlide(index, {textMeasurement})` and `paginateSlide(index, {textMeasurement})` accept the same font provider as preview and export. The local playground now uses bundled, embedded fonts and reports substitutions. The font a user selects (for example Calibri or Aptos) is the source of truth and stays in the document; because license-restricted (proprietary) fonts are never bundled, the canvas draws an open look-alike (a metric-compatible one such as Carlito for Calibri where it exists, a visual-only fallback for Aptos today) and the substitution report says so. Release caveat: the published editor depends on opf-pptx `^0.9.0`, which resolves 0.9.1 and still writes the substitute into the PPTX; selected-name export arrives with the next opf-pptx release. See the [OPF font policy](https://github.com/OpenPresentation/opf/blob/main/docs/font-fidelity.md#font-policy-ff-31).


## Copy, paste, and gallery imports

The browser-safe `/transfer` export provides `parseOpfTransfer`, `serializeOpfTransfer`, and `prepareOpfImport`. Copy whole documents, self-contained slides, or selected JSON values as readable JSON, compact JSON, or fenced Markdown. Parse pasted documents, slides, arrays, fragments, and one fenced code block. Prepare an immutable validated import before applying one root JSON Patch through the editor session. Insertion namespaces inline catalogs and conflicting asset/slide IDs and preserves primary source design defaults.

The `/galleries` export provides `loadOpfGallery` and `loadOpfGalleryItem`, accepting an AbortSignal and injectable fetch. Registries use `{name, items:[{id, name, category, opf}]}` for inline documents or `opfUrl` for a relative JSON URL. Public PPTX.gallery registry descriptors are supported. Cross-origin endpoints need CORS; requests omit credentials/referrers, cap responses at 20 MB, and keep automatic item requests on the configured gallery origin. Documents should include inline catalog records; arbitrary external catalog sources are not automatically fetched.

The playground includes Copy OPF and Import dialogs with paste, file/drop, gallery search, and URL tabs. Files accept OPF JSON and PowerPoint `.pptx` up to 20 MB. PPTX conversion runs locally using `@openpresentation/opf-pptx`; review the converted preview and diagnostics before inserting slides or opening a presentation. Applying an import is one undoable edit. Custom registries persist in local storage; defaults are configured in `examples/galleries.json`. Copy permissions may require using the Select all fallback. Pasting within text fields keeps normal text editing. Cmd/Ctrl+Shift+C opens copying and Cmd/Ctrl+O opens file import.

The **PowerPoint** button commits the current canvas draft and prepares an editable `.pptx` download from that snapshot, using the preview's text measurements. Conversion diagnostics remain visible in the download dialog. Missing/remote images require an explicit host resolver or embedded data; export does not silently fetch them or omit them. Save OPF separately to retain the complete original source. With an opf-pptx that includes FF-31 (after 0.9.1), the download names the font the user selected, never the preview look-alike, so PowerPoint shows that font when it is installed or available as a Microsoft 365 cloud font; opf-pptx 0.9.1, which the published editor resolves today, still writes the substitute. The download does not embed font binaries, and license-restricted (proprietary) fonts are never embedded. Arbitrary native positions and unsupported PowerPoint features can change during reimport.

Run `npm ci`, `npm run build:playground`, then serve `artifacts/playground` with a local static server. This example uses the published core/render/PPTX packages and this checkout's editor source; it does not require an account, AI provider or paid service. `npm run test:playground` builds and executes a real browser flow (local Edge on Windows, installed Chromium in CI): author JSON, inline edit, export a native merged table, validate/reimport the actual downloaded file, undo/redo, save OPF and reject malformed input without changing the document. It is browser behavior evidence, not a claim of native PowerPoint raster equivalence.

Slide insertion does not merge root speakers, organizations, or narrative metadata. Use Open as a presentation for the full source document. Some gallery presets contain minimal examples. The root OPF workspace's `docs/live-editor.md` documents the complete demo and npm API workflow.


## Schema-driven property editing

`@openpresentation/opf-editor/schema-inspector` exports `createSchemaInspector(container, {editor, path, onDraft, onCommit})`. It uses the canonical schemas to expose optional properties, union forms, nested arrays and maps, catalog records, and scalar fields. Valid drafts invoke `onDraft` for a host preview. `commit()` validates and applies one undoable root patch; `reset()` discards the draft; `navigate(path)` selects another field; `destroy()` unsubscribes and removes owned DOM. Concurrent document changes reject a stale draft.

`@openpresentation/opf-editor/schema` exports schema resolution, field traversal, initial values, and the full property inventory. These APIs power the All properties workspace and the gallery reference. Arbitrary extensions can use string, number, boolean, object, array, and null forms. Full-schema editing does not imply that the SVG renderer implements every visual feature.


### Rich text on the canvas

Select rendered rich text to format it, or double-click a rich text block to type. The toolbar supports character styles, point size, font family, hex color, scheme slots/roles, `var:<id>` references, links, scripts, and selected-text replacement. Plain text payloads offer **Format text** during inline editing. **Edit runs** opens the structured fields; `canvas.editProperties(path)` does the same programmatically. Each action is validated and undoable. Version 0.1.1 supports direct mixed-style typing: double-click to type, drag to select, use Format selection for styles, and commit with Done or Ctrl/Cmd+Enter. Escape cancels. Native input and composition events preserve run metadata; the canonical SVG supplies glyph/caret geometry. The whole session commits as one undo step, with draft undo/redo available while typing. Empty-line caret geometry requires renderer 0.1.1 or later; cross-engine and real operating-system IME verification remain open.

Version 0.7.0: rich input maps the textarea's LF-normalized offsets back to the original source. Typing preserves untouched CRLF/CR endings and surrounding run metadata; newly inserted newlines use the first source line-ending style. The `updateRichTextInput` change offsets are native textarea offsets, while formatting and replacement helpers continue to use original source offsets.

Browser regression checks run with `npm run test:rich-input-browser -- artifacts/rich-input-browser.json measured` (or `estimated`). An optional consumer path after the mode selects an existing coordinated installed consumer; all browser runtime and font-preparation imports must then resolve inside that consumer. See [line-ending acceptance](docs/evidence/rich-input-line-endings-20260915/README.md) for scope and preserved failures.

Headless applications and agents can import `formatRichTextRange`, `replaceRichTextRange`, and `richTextContent` from `@openpresentation/opf-editor/rich-text`. The helpers preserve surrounding run metadata and accept UTF-16 offsets on whole grapheme boundaries. A null format value removes an override. Apply the returned value through the editor session or validate the resulting document before saving.


### Resize dynamic layouts

The canvas can show draggable, keyboard-accessible dividers for root and nested composition tracks. Pass `layoutEditing: true`, or call `canvas.setLayoutEditing(true)`. A pointer drag produces live preview drafts and commits one undo step. Escape cancels; strict overflow prevents invalid fit. Automatic layouts become explicit grids when resized. Promoted regions stay fixed, while their nested groups can be resized.

`prepareTrackResize(document, flow, boundary, fraction)` from `@openpresentation/opf-editor/layout` returns a candidate document and guarded patches for headless agents. Obtain `flow` from the shared renderer's `geometry.flows`; preview the candidate before applying. The editor supports JSON Patch `test` guards alongside add/replace/remove; failed guards leave state and history unchanged. This export is included in version 0.1.0.


### Move complete blocks

Arrange mode also shows numbered block handles. Drag to reorder siblings, use arrow keys for earlier/later, or click a handle to choose an existing destination group/slide and insertion position. The move preserves the whole block, including rich text, table/chart data, and nested groups. Each move is validated, preflighted by the renderer, and undoable. Parent weights stay with layout positions; moves that leave an empty container or create a containment cycle are rejected.

Agents can import `prepareBlockMove` and `listBlockContainers` from `@openpresentation/opf-editor/layout`. The prepared result includes a full candidate document, guarded atomic patches, the new block path, and a changed flag. Destination indexes refer to the pre-removal document. Use `canvas.openBlockMenu(path)` for the corresponding browser controls.

## Styled and merged table cells

Define cells with `{value, style, rowSpan, colSpan}` and place explicit `null` at covered positions. Inline editing follows the anchor's `.value` path, preserving its style and merge geometry. Double-click a value or focus it and press Enter to edit; the existing text-formatting controls support scalar promotion, rich runs and partial selection. Covered positions are not separate editable targets.

The core schema rejects overlapping/out-of-bounds spans and hidden content. Model patches can change a span and remove a row atomically; undo restores the complete operation. Styling or restructuring a table remains available through JSON/model edits and the existing structured property forms.

`test/styled-table.mjs` covers model behavior. The core repository's `scripts/build-rich-table-browser.mjs` builds both rich and styled browser fixtures. Browser verification uses actual loaded Roboto fonts and covers merged typing, scalar formatting, partial selection, empty values, cancellation and undo. Native PowerPoint appearance is a separate converter verification boundary.
