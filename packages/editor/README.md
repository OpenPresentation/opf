# OPF Editor

Embeddable local editor primitives for Open Presentation Format documents. The package turns traced `@openpresentation/opf-render` SVG output into JSON-path-aware edits, validates OPF after each change, and records undo/redo as JSON Patch operations.

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

## Live browser canvas (preview)

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

Load the same font bytes into the browser using `loadBrowserFontRegistry` from `@openpresentation/opf-render/fonts-browser` before mounting. The host owns font URLs, storage and collaboration. `onDraft` provides live document drafts; the session only changes on commit. Escape cancels. Concurrent edits to the selected payload cancel a stale draft.

These APIs require the coordinated local preview packages; the previous registry release lacks them. In the sibling OPF checkout, `pnpm pack:ecosystem` prepares installable tarballs and an exact install command in `artifacts/npm/README.md`. Public publishing is separate. See the sibling `opf/docs/live-editor.md` for full setup, support matrix and roadmap.

The canvas retains canonical SVG glyphs while a transparent native input supplies the caret. Complete rich-text formatting, freeform drag/resize, all chart/media treatments, and cross-engine pixel identity remain work in progress. The Source dialog in the playground now provides a live JSON preview; changes are validated before committing.

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

Public npm package publication is handled by `.github/workflows/release.yml` with npm provenance.

Required first-publish setup:

1. An npm owner for the `@openpresentation` scope must run the first publish or reserve/grant the `@openpresentation/opf-editor` package.
2. Configure npm Trusted Publishing for GitHub repository `OpenPresentation/opf-editor` and workflow `.github/workflows/release.yml`.
3. Publish by creating a GitHub Release or manually running the Release workflow after CI passes.

This repo does not require an npm automation token when Trusted Publishing is configured.

## Shared dynamic composition (local development)

The current checkout uses `@openpresentation/opf/composition` for portable geometry. Slides can select `auto`, `row`, `column`, or `grid`, set weighted tracks, and request path-specific overflow diagnostics. See the sibling OPF repo's `docs/dynamic-composition.md` for the complete contract.

These new APIs are pending a coordinated OPF release. With all repos checked out beside each other, build OPF and run `node scripts/link-ecosystem.mjs` from that repo before building this package. Run `pnpm test:ecosystem` in OPF to check editing, rendering, editable PowerPoint geometry, and import together. The published OPF 0.3.0 package does not contain the new composition entry point; downstream publication must wait for the new core release and an updated minimum dependency version.

## Local interactive demo

With the sibling workspace linked, run `pnpm demo:editor` from the OPF repo, then serve its `artifacts/editor` directory with a static HTTP server. The demo lets you select SVG text, apply edits, change composition, edit the JSON document, and undo/redo. It uses the real renderer and editor session with no service dependency.

Editor snapshots are immutable and keep the same object identity until a change. This supports React `useSyncExternalStore` without render loops. `editor.document` remains a separate mutable copy for callers that need one.

Nested content groups expose their bounds through `editor.composeSlide(index).groups`. Use `editor.setGroupComposition("slides.0.blocks.0", {mode:"column"})` to reflow a group with validation and undo/redo. The playground includes a nested example and group arrangement controls.

`editor.paginateSlide(index, {minFontSize:24})` splits a crowded draft into ordinary OPF slides as one undoable transaction. It returns the change and source mappings; failed pagination leaves the document unchanged. The playground’s Split overflow action demonstrates the workflow.

`composeSlide(index, {textMeasurement})` and `paginateSlide(index, {textMeasurement})` accept the same font provider as preview and export. The local playground now uses bundled, embedded fonts and reports substitutions.


## Copy, paste, and gallery imports

The browser-safe `/transfer` export provides `parseOpfTransfer`, `serializeOpfTransfer`, and `prepareOpfImport`. Copy whole documents, self-contained slides, or selected JSON values as readable JSON, compact JSON, or fenced Markdown. Parse pasted documents, slides, arrays, fragments, and one fenced code block. Prepare an immutable validated import before applying one root JSON Patch through the editor session. Insertion namespaces inline catalogs and conflicting asset/slide IDs and preserves primary source design defaults.

The `/galleries` export provides `loadOpfGallery` and `loadOpfGalleryItem`, accepting an AbortSignal and injectable fetch. Registries use `{name, items:[{id, name, category, opf}]}` for inline documents or `opfUrl` for a relative JSON URL. Public PPTX.gallery registry descriptors are supported. Cross-origin endpoints need CORS; requests omit credentials/referrers, cap responses at 20 MB, and keep automatic item requests on the configured gallery origin. Documents should include inline catalog records; arbitrary external catalog sources are not automatically fetched.

The playground includes Copy OPF and Add OPF dialogs with paste, file/drop, gallery search, and URL tabs. Preview before inserting or opening. Custom registries persist in local storage; defaults are configured in `examples/galleries.json`. Copy permissions may require using the Select all fallback. Pasting within text fields keeps normal text editing. Cmd/Ctrl+Shift+C opens copying and Cmd/Ctrl+O opens file import.

Slide insertion does not merge root speakers, organizations, or narrative metadata. Use Open as a presentation for the full source document. Some gallery presets contain minimal examples. The root OPF workspace's `docs/live-editor.md` documents the complete demo and npm API workflow.


## Schema-driven property editing

`@openpresentation/opf-editor/schema-inspector` exports `createSchemaInspector(container, {editor, path, onDraft, onCommit})`. It uses the canonical schemas to expose optional properties, union forms, nested arrays and maps, catalog records, and scalar fields. Valid drafts invoke `onDraft` for a host preview. `commit()` validates and applies one undoable root patch; `reset()` discards the draft; `navigate(path)` selects another field; `destroy()` unsubscribes and removes owned DOM. Concurrent document changes reject a stale draft.

`@openpresentation/opf-editor/schema` exports schema resolution, field traversal, initial values, and the full property inventory. These APIs power the All properties workspace and the gallery reference. Arbitrary extensions can use string, number, boolean, object, array, and null forms. Full-schema editing does not imply that the SVG renderer implements every visual feature.


### Rich text on the canvas

Select rendered rich text to format it, or double-click a rich text block to select all of it. The toolbar supports character styles, point size, font family, hex color, links, scripts, and selected-text replacement. Plain text payloads offer **Format text** during inline editing. **Edit runs** opens the structured fields; `canvas.editProperties(path)` does the same programmatically. Each action is validated and undoable. Continuous rich-text typing with a mixed-style caret remains under development.

Headless applications and agents can import `formatRichTextRange`, `replaceRichTextRange`, and `richTextContent` from `@openpresentation/opf-editor/rich-text`. The helpers preserve surrounding run metadata and accept UTF-16 offsets on whole grapheme boundaries. A null format value removes an override. Apply the returned value through the editor session or validate the resulting document before saving.


### Resize dynamic layouts

The canvas can show draggable, keyboard-accessible dividers for root and nested composition tracks. Pass `layoutEditing: true`, or call `canvas.setLayoutEditing(true)`. A pointer drag produces live preview drafts and commits one undo step. Escape cancels; strict overflow prevents invalid fit. Automatic layouts become explicit grids when resized. Promoted regions stay fixed, while their nested groups can be resized.

`prepareTrackResize(document, flow, boundary, fraction)` from `@openpresentation/opf-editor/layout` returns a candidate document and guarded patches for headless agents. Obtain `flow` from the shared renderer's `geometry.flows`; preview the candidate before applying. The editor supports JSON Patch `test` guards alongside add/replace/remove; failed guards leave state and history unchanged. This export requires the coordinated local preview package until a compatible public release is published.


### Move complete blocks

Arrange mode also shows numbered block handles. Drag to reorder siblings, use arrow keys for earlier/later, or click a handle to choose an existing destination group/slide and insertion position. The move preserves the whole block, including rich text, table/chart data, and nested groups. Each move is validated, preflighted by the renderer, and undoable. Parent weights stay with layout positions; moves that leave an empty container or create a containment cycle are rejected.

Agents can import `prepareBlockMove` and `listBlockContainers` from `@openpresentation/opf-editor/layout`. The prepared result includes a full candidate document, guarded atomic patches, the new block path, and a changed flag. Destination indexes refer to the pre-removal document. Use `canvas.openBlockMenu(path)` for the corresponding browser controls.
