# Dynamic composition

OPF keeps authoring intent in JSON. Use `blocks` when content can reflow; use promoted regions when relative placement is meaningful. `composition` on a slide overrides fields in the resolved layout's `composition`. Existing documents remain valid.

```json
{
  "name": "Decision brief",
  "slides": [{
    "title": "Make the main idea clear",
    "composition": { "mode": "row", "weights": [2, 1], "overflow": "error" },
    "blocks": [
      { "text": "The evidence and recommendation receive twice the width." },
      { "text": "The supporting detail receives the remaining width." }
    ]
  }]
}
```

`auto` evaluates candidate grids using text fit and cell proportions. `columns` limits its candidates. `grid` uses `columns` if given, otherwise a grid based on the canvas shape. `row` uses one row; `column` uses one column. Items retain source order. Weights size columns except in column mode, where they size rows. Missing weights are 1; unused weights have no effect. A partially filled final row retains its grid tracks.

`gap` defaults to 1/30 and `padding` to 0.08, both fractions of the canvas's shorter edge. Large gaps are reduced when necessary to keep cells positive. `minFontSize` defaults to 16 reference pixels at a 720-pixel short edge. The reference coordinate system uses 96 pixels per inch. Explicit inch dimensions override presets independently for each axis.

Headings reserve space according to their wrapped text. Content that exceeds the number of preset placeholders reflows together; it is not drawn over already-bound content. Promoted regions keep the 3×3 vocabulary, including standalone `top`, `middle`, and `bottom`. They ignore flow direction and track weights.

## Nested groups

A block or promoted region can contain its own `blocks` and `composition`. The optional discriminator is `"type": "group"`. A group has at least one child and cannot mix children with leaf fields such as `text` or `image`.

```json
{
  "composition": { "mode": "row", "weights": [2, 1] },
  "blocks": [
    {
      "composition": { "mode": "column", "padding": 0.02 },
      "blocks": [{ "text": "Recommendation" }, { "text": "Supporting evidence" }]
    },
    { "text": "Context" }
  ]
}
```

The parent allocates a box to each group, then the group arranges its children inside that box. Group padding defaults to zero; padding and gap use the group's shorter edge. Only `minFontSize` and `overflow` inherit. A strict ancestor cannot be weakened by a child's `overflow: "warn"`. Font sizes remain relative to the canvas, not the group. Groups can nest up to 32 levels; cycles and deeper nesting fail with an explicit error.

Automatic grid scoring inspects descendant text using each descendant's explicit arrangement or geometric automatic seed. After selecting the parent's grid, it optimizes each child's automatic grid. This deterministic, bounded search avoids exponential combinations; it does not claim a globally optimal packing.

`result.items` contains every leaf with its full source path and effective composition. `result.groups` contains group paths, outer bounds, and content bounds. The editor's `setGroupComposition(path, value)` validates and records undo/redo just like slide composition edits.

## Inspecting and repairing layout

```js
import { composeSlide } from '@openpresentation/opf/composition';
const result = composeSlide(deck.slides[0], { width: 1280, height: 720, layout: resolvedLayout });
console.log(result.items);       // Source paths, content, geometry, and text estimates
console.log(result.diagnostics); // Path-specific text-overflow and small-cell messages
```

This pure function expects a validated slide. The caller resolves catalog records and passes the canvas size. The rendering and export packages perform those steps at their boundaries. No network, DOM, system font, or AI dependency is required.

With `overflow: "warn"` (default), the result retains all text and returns diagnostics. SVG emits all lines and marks overflowing groups with `data-opf-overflow="true"`; text may extend beyond its box or canvas. Consumers can collect diagnostics using `onDiagnostic`. With `overflow: "error"`, the layout rejects content that does not fit. Shorten the affected content, give it more space, or explicitly split it into another slide. Use the explicit pagination transform below to produce additional editable slides.

The editor exposes `editor.composeSlide(index)` and `editor.setComposition(index, value)`. The latter validates the change, records JSON Patch history, and supports undo/redo.

## Pagination

```js
import { paginateSlide, paginatePresentation } from '@openpresentation/opf/pagination';
const { presentation, pages } = paginatePresentation(deck);
// Review, save, render, or export `presentation`; pages maps output fragments to source paths.
const single = paginateSlide(deck.slides[0], { width: 1280, height: 720, minFontSize: 24 });
```

Pagination is an authoring operation. It produces ordinary OPF slides; previews and PPTX export consume those exact pages. It preserves the input, body order, nested groups, promoted regions, rich-text formatting, and source text characters. Plain text and rich runs split at grapheme boundaries, preferring sentence/paragraph breaks and then word breaks. Lists split between items, tables between rows with column labels repeated, and code splits without rewriting its source. Indivisible payloads remain intact. Existing track weights continue to apply to positions on each resulting page.

The default readability target is 24 reference pixels for body text; a higher existing minimum is respected within each payload’s requested font size. Small-format payloads such as table cells retain their own requested typography. Pagination relies on the shared engine's estimates; it is not a guarantee that every host font renders identically. Headings repeat unchanged, speaker notes remain on the first page, and continuation IDs avoid existing deck IDs. `pages[].mappings` records full source/output paths and half-open text or item ranges. Text offsets use UTF-16, so source strings can be reconstructed exactly.

If a heading, individual list item, table row, or other atomic payload cannot fit on an otherwise empty page, `OPFPaginationError` returns actionable diagnostics. There is no partial output. `maxSlides` defaults to 100, and a layout-evaluation limit bounds work on pathological input. Specialized chart and timeline internals still require visual inspection; their complete density models remain outstanding.

The editor's `editor.paginateSlide(index)` is one validated transaction with undo/redo. It returns `{change, pagination}`; an already-fitting slide returns `change: null`. The playground includes an overflowing draft and **Split overflow** action. The CLI writes a new file and refuses to overwrite an existing one:

```sh
node packages/cli/dist/index.js paginate input.opf.json output.opf.json
```

## Fidelity boundary

The shared engine provides identical body and heading geometry to SVG and editable PPTX export. Text measurements default to deterministic estimates. For actual font advances, use the shared provider described in [measured fonts](font-fidelity.md). Complex scripts, fallback fonts, PowerPoint text rendering, rich text, charts, tables, and images still need visual verification. Dynamic composition is not a guarantee of pixel-identical PowerPoint output. List density includes rich runs, descriptions and nesting via `fitList`, with the same hanging indents used in preview and export. Only text-like payloads currently receive content-density estimates; small-cell diagnostics also cover non-text content.

SVG embeds raster data URI images locally. Remote and file images require a host resolver that supplies a raster data URI; otherwise they appear as placeholders. `strictAssets` rejects unresolved images. The runtime never fetches them.

See [the complete example](../examples/technical/dynamic-composition.opf.json) and [local ecosystem verification](ecosystem-development.md).


## Resizing in the preview

Choose **Arrange** in the editor to reveal track dividers. Drag a divider to redistribute the space between adjacent columns (row/grid) or rows (column), including nested groups. Arrow keys make small changes; Shift makes larger changes. Escape discards a pointer draft. One drag creates one undo step, and no content is removed. Strict overflow rejects a resize that violates its fit constraints.

Resizing an automatic layout makes its chosen columns explicit as `mode: grid` with `columns`. This prevents the number of columns from changing under the pointer. The adjacent share clamps to 5–95%, with positive schema-valid weights. Other track proportions and unrelated document fields remain intact. Promoted regions retain their positions; their nested groups can still be resized. Layouts with reserved placeholder slots need an explicit arrangement first. Flows with more than twelve tracks need grouping before the current resize controls can express all weights.

`createCanvasEditor(container, {layoutEditing: true, ...options})` enables dividers initially. `canvas.setLayoutEditing(boolean)` toggles them, and `canvas.commit()` / `canvas.cancel()` also handle an active resize. `onDraft` receives the proposed document; the session stays unchanged until commit. Changes to the resized container cancel a stale draft; unrelated updates are retained.

The shared engine exposes `geometry.flows`: each flow has its container path, content box, resolved column/row tracks (offset and size), clamped gap, effective composition, item count, and reserved slot count. This is renderer geometry, not new OPF document fields.

Agents can prepare the same guarded change without a DOM:

```js
import {prepareTrackResize} from '@openpresentation/opf-editor/layout';
import {resolvePresentation} from '@openpresentation/opf-render/svg';
const geometry = resolvePresentation(editor.document, renderOptions).slides[0].geometry;
const flow = geometry.flows.find(flow => flow.path === 'slides.0');
const prepared = prepareTrackResize(editor.document, flow, 0, 0.65);
// Boundary 0: give the first track 65% of the adjacent pair's combined space.
// Preview prepared.document with the same renderer and font provider before applying.
editor.applyPatch(prepared.patches, {rejectInvalid: true});
```

The patch contains a `test` guard for the container before changing its composition. Failed tests do not mutate the document or its history. A test-only patch is read-only. Rendering is preflighted by the canvas; headless callers should likewise render a candidate to enforce font and overflow constraints.

Verification: editor layout model tests, `/layout-tests.html` browser keyboard checks and trusted-pointer specimens, and `pnpm test:layout` for measured SVG/native PPTX coordinate parity. Shape-coordinate checks do not establish PowerPoint raster pixel parity.


## Reordering and moving blocks

In **Arrange**, drag a numbered block handle to reorder siblings. The insertion marker shows the destination; the shared renderer reflows the slide after drop. Arrow keys on a handle move the whole block earlier or later. Click a handle for **Earlier**, **Later**, or an explicit destination and insertion position. The destination menu supports existing groups and block-based slides, including moving a child out of a group or moving a whole group to another slide. `canvas.openBlockMenu(path)` opens the same controls programmatically.

A move preserves the entire block and its nested content, formatting, data, and references. Parent composition weights describe positions, so they stay in place. Moving to another container can change the block's inherited design and readability constraints; the canvas renders the candidate before committing it. Strict overflow or an unavailable required font rejects the move. A move cannot leave an empty block container or put a group inside its own descendants. Move the group or add another block first when the source has only one child.

```js
import {prepareBlockMove, listBlockContainers} from '@openpresentation/opf-editor/layout';
const containers = listBlockContainers(editor.document);
const prepared = prepareBlockMove(editor.document,
  '/slides/0/blocks/0', '/slides/0/blocks/1', 1);
// Insert the first block before child 1 of the second block's group.
// Destination indexes refer to the document before removal.
// prepared.path reports the moved block's address after any index shifts.
editor.applyPatch(prepared.patches, {rejectInvalid: true});
```

`prepareBlockMove` returns `{document, patches, path, changed}`. It validates the complete result and emits guarded remove/add patches, so the editor or CLI can apply it atomically. No-op moves return `changed: false` and no patches. `listBlockContainers(document, {slideIndex})` optionally limits discovery to a single slide and excludes arbitrary extension data. Headless callers should render the candidate with their intended font provider before applying. The browser and installed-package block harnesses exercise nested moves, undo, stale menus, keyboard access, strict-fit rejection, and native drag reordering.

Creation and deletion use the same layout engine: insertions can normalize implicit payloads into explicit blocks; deletions prune empty groups while retaining the slide. Existing track weights stay positional. See the [editor creation guide](live-editor.md#create-duplicate-and-delete-content) for the guarded APIs and canvas controls.
