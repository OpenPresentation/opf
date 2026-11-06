# Editor and transfer APIs

These entrypoints are published in editor 0.8.0 and later. Use core 0.18.1, renderer 0.18.0, editor 0.18.0 and PPTX 0.18.0 on Node 24 for the coordinated workflow. Check installed package exports when using older releases; repository changes can precede publication.


## Embedding the whole editor

To put the full editor in a page, use `createOpfEditor(element, options)` from `@openpresentation/opf-editor/workspace` (or `<OpfEditor>` and the hooks from `@openpresentation/opf-editor/react`) instead of wiring the canvas, the source pane, the slide row, the presenter and the export menu one by one. It owns the session, the fonts gate and the order in which the parts hear a change; each part is optional (`panels`), the arrangement is built or the host's own (`slots`), and the chrome is themed with `theme` and the `--opf-ui-*` tokens. The source pane reports the caret (`cursor` event: `pointer`, `idPath`, `from`, `to`; React `useOpfCursor`), can `revealPath` a pointer or range without taking focus, and takes the host's own marks by path or range (`setDecorations`) apart from the editor's; this works in JSON, YAML and Markdown. Options, handle, events and the token contract are in `packages/editor/docs/embedding.md` and `packages/editor/docs/theming.md`. Edits still go through the session as validated, undoable patches: use `editor.session` for anything the handle does not do.

## Atomic patching

```js
import { createEditorSession } from '@openpresentation/opf-editor';
const editor = createEditorSession(document, {rejectInvalid: true});
const index = editor.presentation.slides.findIndex(slide => slide.id === targetId);
if (index < 0) throw new Error('Slide ID not found');
editor.applyPatch([
  {op: 'test', path: `/slides/${index}/id`, value: targetId},
  {op: 'replace', path: `/slides/${index}/title`, value: newTitle},
], {source: 'agent', rejectInvalid: true});
// Read editor.presentation for saving; editor.undo() reverses this transaction.
```

The patch assumes `title` already exists; use `add` or `createValuePatch` for optional fields. A stable-ID `test` detects a moved/replaced target, not every concurrent content change; add an expected-value test or host revision check as needed. Never build pointer paths by joining unescaped user keys.

## Content conversions

Core's `@openpresentation/opf/convert` (RR-26, after the release that lists it) holds the pure converters: `convertContent(payload, kind)` and `contentConversionTargets(payload)` return the new payload, `lossless` and a `loss` list, or refuse with `OPFConversionError`. Show `loss` before applying and apply the result as one validated, undoable transaction (the editor's `convertBlock` does). The same module nests list items (`demoteListItems`, `promoteListItems`), groups and ungroups blocks, moves images between content and slide design, and splits or merges slides. See docs/conversions.md in the OpenPresentation/opf repository for every pair and its loss report.

## Canvas and optional properties

```js
import { createCanvasEditor } from '@openpresentation/opf-editor/canvas';
import { createSchemaInspector } from '@openpresentation/opf-editor/schema-inspector';
const canvas = createCanvasEditor(slideContainer, {editor, slideIndex: 0, fonts});
await canvas.ready;
const inspector = createSchemaInspector(propertyContainer, {
  editor,
  path: '/slides/0',
  onDraft: ({presentation: draft}) => previewDraft(draft),
});
// inspector.commit() validates and applies one undoable change.
// On unmount: inspector.destroy(); canvas.destroy();
```

Containers, the fonts handle (`loadFonts()` from `@openpresentation/opf-render/fonts-browser`), and `previewDraft` belong to the host. Mount after DOM creation. A schema-inspector draft is deliberately staged; avoid creating a second authoritative document. When the session changes concurrently, stale drafts must be discarded/rebased. Nonvisual metadata is edited as properties, not drawn as slide text.

## Copy and import

```js
import { parseOpfTransfer, serializeOpfTransfer, prepareOpfImport } from '@openpresentation/opf-editor/transfer';
const copied = serializeOpfTransfer(editor.presentation, {scope: 'slide', slideIndex: 0, format: 'markdown'});
const parsed = parseOpfTransfer(copied);
const proposed = prepareOpfImport(editor.presentation, parsed, {mode: 'insert', slideIndex: 0});
// Preview proposed.presentation, then apply the intended import as one transaction.
editor.applyPatch([{op: 'replace', path: '', value: proposed.presentation}], {source: 'import', rejectInvalid: true});
```

Copy scopes are presentation, slide, and selection; formats are pretty, compact, and markdown. Selection needs `path`. Import modes are insert, replace, and selection; selection also needs `path`.

Slide copies retain design/catalog/asset context. Insertion copies the slides' records with core `copySlides` (groups match by source; an identical record is reused; a differing custom record becomes `<id>-2`; a differing catalog revision moves into `custom` as `<id>-2` and is listed) and renames conflicting slide/asset IDs while preserving primary source design defaults. It does not merge root speaker/organization/narrative metadata. Use replace to retain the complete imported document. Recompute the proposed import against the latest document before applying if the host can change during review.


## Fill template panel

For a template or any deck with content variables, `@openpresentation/opf-editor/templates` lists the variables with typed inputs (text, number, date, color, URL, list, image source), shows required and unfilled state and where each is used, and re-renders the preview as values change. Values stay in the panel until applied: applying fills the variables through the session as one validated, undoable replacement, so a template can be filled and restored by undo. The panel also lists the deck's built-in variables (`speaker.*`, `organization.*`, `deck.*`, `speakers`) read-only, with the value each currently has and where it is used; they are filled from the document, not in the panel. Inserting a variable token into a text field is an ordinary session edit.

## Rich text ranges

Use `formatRichTextRange`, `replaceRichTextRange`, and `richTextContent` from `@openpresentation/opf-editor/rich-text` for immutable edits inside rich `text` payloads. Offsets use UTF-16 with whole-grapheme boundaries. Preserve the original array and select only the requested range; avoid flattening runs to plain text. Apply the returned runs with one validated `editor.set` or CLI JSON Patch, and use an expected-value guard for concurrent work. A `null` format value removes that override; `false` explicitly turns a boolean style off. Replacement inherits the first selected run’s style, or the preceding run for an insertion at a boundary.

Text entry (editor 0.10.2): a single click on editable text (plain or rich) enters inline editing with the caret at the clicked character; press-drag selects a range; while editing, double-click selects a word and triple-click a paragraph; clicking another text target commits and enters it in one click; Escape leaves editing with the box still selected. Enter, Space or F2 on a focused target enters with all text selected, as does `beginEdit(path)`. `createCanvasEditor(el, {textEntry: 'dblclick'})` restores the two-step gesture (click selects, double-click enters with the caret at the pointer). Non-text targets keep click-to-select and double-click-for-properties. When driving the canvas from a browser test, enter with the keyboard (focus the target, press Enter) if the test expects all text selected; `dblclick()` on the default canvas places the caret and selects a word.

The canvas toolbar selects and formats the actual SVG glyphs. `beginEdit(path)` selects all text for a rich payload; `editProperties(path)` explicitly opens run fields. Continuous rich-text typing/caret support is still separate work.


## Moving complete blocks

Use `prepareBlockMove(presentation, fromPath, toContainerPath, toIndex)` from `@openpresentation/opf-editor/layout`. Choose complete block paths, not their text/data subfields. `toIndex` is an insertion position before removal. The helper accounts for shifted group addresses, preserves nested content and metadata, validates the full result, and returns guarded remove/add patches with the new `path`. No-op moves return no patches. Apply the prepared patches atomically; do not discard their test guards. Parent weights remain attached to positions. Empty source containers and moves into a group's own descendants are rejected. Render the candidate before applying to catch strict overflow or unavailable fonts. `listBlockContainers` discovers eligible existing groups/slides without traversing arbitrary extension data.

For list formatting, edit the exact entry or description path, such as `slides.0.items.1.text` or `slides.0.items.1.description`. Strings edit inline; rich arrays support range formatting. The parent `items` or `bullets` array is structural content, not a text-run array. Numbering is the payload's `numbering` field (for example `slides.0.numbering`, or `slides.0.left.numbering`), a style name, a `{style,start,suffix}` object or an array per level; an entry's own `start` restarts its count. Preserve each item's level and description when moving or replacing entries.

## Creating and removing content

Use `prepareBlockInsert(presentation, containerPath, block, index?)`, `prepareBlockDuplicate(presentation, blockPath)` and `prepareBlockRemove(presentation, blockPath)` from the editor's `/layout` export. `createContentBlock(kind, {source?})` supplies small starting points; image/video kinds need a source. `listBlockContainers(document, {includeImplicit:true})` also discovers implicit slides and named-region leaves that can become groups. Insertion preserves existing root metadata while normalizing payload fields to blocks. Deletion prunes empty ancestor groups, never the slide; weights stay positional. All helpers return guarded patches and a validated candidate. Render that candidate before applying, then commit one transaction. The browser exposes the same operations through Add content and Arrange handles. Video-source insertion does not establish playback or export fidelity.

## Citations, footnotes and captions

`@openpresentation/opf-editor/annotations` edits the RR-34 fields as validated, undoable session edits: `readCaption(presentation, blockPath)` / `setCaption(editor, blockPath, caption | null)` on image, chart, table and video blocks (and a one-payload slide root); `listReferences(document)`, `addReference(editor, {id, text, url?})`, `updateReference(editor, id, fields)`, `removeReference(editor, id, {force?})` (refuses while a run still cites the id unless forced, which also removes those cites); `citeRun(editor, runPath, ids)` / `unciteRun(editor, runPath)` and `setFootnote(editor, runPath, text | null)` on a run path such as `slides.0.text.2`, `slides.0.title.1` (the tag, title and subtitle may carry markers when they are `TextRun[]`) or `slides.0.quote.text.1` (a string run is converted to an object run; a text payload that is a plain string must be converted to runs first); `listCitations(document)` returns the deck numbering (markers per slide, notes and unused ids) and `referencesSlideFor(document, {title})` the references slide to insert. Every `prepare*` variant returns the guarded patches and the validated candidate without applying them.

## Shape blocks

`@openpresentation/opf-editor/shape-options` (editor 0.34 and later; check the installed exports) edits shape blocks as one undoable step each: `insertShape(editor, { slideIndex, shape: "chevron", block: { text: "Plan" } })` (the change's `path` is the new block; a slide that holds its content inline becomes blocks in the same step), `setShapePreset(editor, path, "star5")` (keeps the adjust values the new preset also has), `setShapeAdjust(editor, path, { adj1: 0.4 }, { size })` (fractions and degrees pinned to each handle's range at the frame; `await loadShapeEngine()` first; `null` removes a value) and `setShapeProperties(editor, path, { fill, stroke, style, shadow, innerShadow, glow, softEdge, reflection, blur, rotate, flip, text, anchor, padding, textDirection, alt, decorative, hidden, link, aspectRatio, opacity })` (a value sets, `null` removes; empty text, `false` and rotation 0 remove their key). `path` may be a selection inside the block (`readShape`, `shapeBlockPathForSelection`). A name that is not a preset throws `invalid-shape` with the nearest names, an adjust name the preset lacks `shape-adjust-unknown`, and any value that would make the deck invalid `invalid-opf-edit` with the validator's message; nothing changes then. `searchShapes("speech bubble")` and `shapeGroups()` read PowerPoint's gallery groups (the MCP's `search_shapes`). `@openpresentation/opf-editor/shape-picker` is the DOM (`createShapePicker`, `createShapeMenu`); the canvas shows a selected preset shape's adjust handles and `createDesignControls` has a `shape` section for every property.

## Overlay shapes and connectors

`@openpresentation/opf-editor/shape-overlays` (editor 0.34 and later; check the installed exports) edits `slide.shapes` as one undoable step each: `insertOverlayShape(editor, { slideIndex, shape, center, frame })` (fractions of the slide; the change's `path` is `slides.N.shapes.I`), `setOverlayFrame(editor, path, { x, y, width, height })` (kept on the slide; a shape attached to a block with `at` takes `{ offset, width, height }` instead and `x` or `y` on it throws `overlay-anchored`; `detachOverlay(editor, path, frame)` frees it), `moveOverlayLayer(editor, path, "front" | "forward" | "backward" | "back")` (the array order is the stacking), `removeOverlay` (also removes the connectors that end on the shape), `connectShapes(editor, { slideIndex, from, to, route, stroke })` (the two ends are paths of blocks or overlay shapes; an end with no `id` gets one in the same patch) and `setConnector(editor, path, { route, from, to, fromSite, toSite })`. A connector's line goes through `setShapeProperties(editor, path, { stroke })`; it takes only `stroke`, `alt`, `decorative` and `hidden`. `listConnectionEnds(presentation, slideIndex)` lists what a connector can join. On a canvas, `canvas.connect({ route, stroke })` is the click-two-things tool.

## Icons on entries, metrics and groups

`@openpresentation/opf-editor/icon-options` (editor 0.33 and later; check the installed exports) edits the `icon` of a list entry, a metric and a group (a block with `blocks`) as one validated, undoable step each: `setIcon(editor, path, "lucide:truck")`, `removeIcon(editor, path)` (or `setIcon(editor, path, null)`), and `setSvgIcon(editor, path, svgText, { name })` to paste an SVG, which stores it in the deck's `icons` map under a name and references that name in the same patch list (one undo takes both back). `path` may be a selection: `slides.0.blocks.1.items.2.text` finds the entry, a metric block or a selection inside it finds the metric, a selected group block finds the group (`iconTargetForSelection`, `readIcon`). A bare entry or metric becomes `{ text, icon }` or `{ value, icon }`; removing the last use of a deck icon also removes it from `icons`. An SVG that cannot be an icon (script, event handler, external reference, raster, no size) throws `icon-invalid` with the `opf/icon-invalid` finding's message, and an unknown set icon `icon-unknown`; nothing changes. Each `prepare...` form returns the patches without a session.

The editor bundles no icon set. The host registers them in its catalogs (`catalogs: [gallery, galleryIconSets]`, `galleryIconSets` from `@openpresentation/gallery/icon-sets`), and `searchIcons(editor, "truck", { set, limit })` reads whatever is registered (name and keywords, the ranking of the MCP's `search_icons`; an empty query browses). `await loadIconSets(editor)` first so a set icon can be checked and the deck draws it. `@openpresentation/opf-editor/icon-picker` is the DOM control (`createIconPicker(container, { editor, getSelectedPath, catalogs })`), and `createDesignControls` mounts it in its selection section: the current icon, "Choose icon…" with search and a set filter, the deck's own icons, and "Paste an SVG" with an optional name. Never invent an icon name; search.
