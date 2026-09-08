# Geometry and pagination

The shared reference coordinates use 96 pixels per inch. Default widescreen dimensions are resolved by the engine; use the resolved dimensions rather than assuming every deck is 1280×720. Composition gap and padding are fractions of the container's shorter edge. Body font minima use reference pixels at a 720-pixel canvas short edge.

Current bounds: columns 1–12; gap 0–0.1; padding 0–0.2; positive weights up to 100; minFontSize 8–32. Check the installed schema before relying on these bounds. Nesting is bounded at 32 group levels. Groups inherit only readability constraints (`minFontSize`, `overflow`), and a strict ancestor cannot be weakened by a child. Child padding defaults to zero.

A two-level arrangement:

```json
{
  "slides": [{
    "id": "evidence",
    "title": "Keep supporting evidence together",
    "composition": {"mode": "row", "weights": [2, 1]},
    "blocks": [
      {"composition": {"mode": "column"}, "blocks": [
        {"text": "First source-backed observation."},
        {"text": "Second source-backed observation."}
      ]},
      {"text": "The implication for the decision."}
    ]
  }]
}
```

For raw geometry, `composeSlide(slide, options)` expects validated input and caller-resolved design:

```js
import { composeSlide, resolveCanvasDimensions } from '@openpresentation/opf/composition';
const dimensions = resolveCanvasDimensions(effectiveDesign.dimensions);
const geometry = composeSlide(slide, {
  ...dimensions,
  slideIndex,
  layout: resolvedLayout,
  fonts: resolvedFontFamilies,
  textMeasurement,
});
// geometry.items: leaf paths and boxes; geometry.groups: nested group bounds.
console.log(geometry.diagnostics);
```

Variables named `effectiveDesign`, `resolvedLayout`, `resolvedFontFamilies`, and `textMeasurement` above are host inputs, not automatic globals. In the editor, `editor.composeSlide(index, {textMeasurement})` performs its design resolution. In the renderer, use `resolvePresentation(document, options).slides[index].geometry`.

For explicit page splitting:

```js
import { paginatePresentation } from '@openpresentation/opf/pagination';
const result = paginatePresentation(document, {textMeasurement});
const paginatedDocument = result.presentation;
// result.pages contains source/output mappings; preserve it if revisions need provenance.
```

Pagination preserves characters and payload order; it does not summarize. Text offsets in mappings are half-open UTF-16 ranges. Tables repeat columns, headings repeat, and notes stay on the first page. Atomic content that cannot fit rejects the operation. Validate and inspect output; chart and timeline density models are not complete. The editor's `paginateSlide(index, options)` records one undoable change and returns both the change and pagination result.


## Resizing tracks

`geometry.flows` exposes exact track offsets/sizes and container paths. The editor's `prepareTrackResize(document, flow, boundary, fraction)` from `@openpresentation/opf-editor/layout` returns a validated candidate and guarded JSON Patch. The fraction is the first track's share of an adjacent pair, clamped to 5–95%. Row/grid flows resize columns; column flows resize rows. An automatic layout becomes an explicit grid with its currently chosen columns. Preview before applying, especially under strict overflow. Promoted regions do not move; nested flows within them can be resized. Reserved placeholder slots require an explicit arrangement, and flows with more than twelve tracks should be grouped first. Canvas users can choose Arrange or call `setLayoutEditing(true)`.
