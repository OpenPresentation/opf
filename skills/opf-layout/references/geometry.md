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

Core 0.8.0 adds opt-in `explain: true` to these options. `geometry.explanation` reports versioned automatic candidate scores, selected columns, reasons for preserving explicit modes/regions, and paths whose complete internal fit is unmeasured. `textMeasurement: "provided"` means a width provider was supplied, not that shaping or native fidelity was verified. Core 0.7.0 does not include this option. Costs add cell-aspect deviation, font reduction, 1,000 per overflowing text/table/quote leaf, 100 per small cell, and 2 per unused final-row position. Lower is preferred; costs are not quality percentages. Parent scores use geometric seeds for automatic descendants; final child optimization can differ. Explanations do not apply repairs or change content.

Variables named `effectiveDesign`, `resolvedLayout`, `resolvedFontFamilies`, and `textMeasurement` above are host inputs, not automatic globals. In the editor, `editor.composeSlide(index, {textMeasurement})` performs its design resolution. In the renderer, use `resolvePresentation(document, options).slides[index].geometry`.

For explicit page splitting:

```js
import { paginatePresentation } from '@openpresentation/opf/pagination';
const result = paginatePresentation(document, {textMeasurement});
const paginatedDocument = result.presentation;
// result.pages contains source/output mappings; preserve it if revisions need provenance.
```

Pagination preserves characters and payload order; it does not summarize. Text offsets in mappings are half-open UTF-16 ranges. Tables repeat columns, headings repeat, and notes stay on the first page. Atomic content that cannot fit rejects the operation. Validate and inspect output; chart and timeline density models are not complete. The editor's `paginateSlide(index, options)` records one undoable change and returns both the change and pagination result.

Core 0.8.0's coordinated quote integration uses `grid-score-v2` and `quote-flow-v1`: quote items carry accepted `quoteLayout.parts`, including body/source boxes, fits, styles and UTF-16 source mappings. The body's compatibility `item.text` includes generated quotation marks. The allocator adjusts footer space before reducing fonts; consumers must reject reported failures and must not re-fit accepted parts. Glyph outlines can differ from these advance-based boxes. Core 0.7.0 does not contain this integration; shared preview/export requires renderer/PPTX 0.6.0. Check the installed versions and the published set in `release-plan.json` during the coordinated rollout.

In that coordinated release, pagination persists the evaluated minimum in returned slides even when no extra page is needed. Apply the returned document; a one-page policy change is undoable in the coordinated editor, while a second unchanged invocation is a no-op. Quote bodies may split, but each fragment retains its complete attribution/source. Irreducible footers reject all output.

Core 0.9.0 adds `layoutCode(value, box, options)` and accepted `item.codeLayout.parts` for code filename, language and body. `grid-score-v3` includes every code part's requested-to-fitted font reduction and one overflow penalty per failing code leaf. Reuse the accepted boxes, styles and source/text-tab segments; do not trim source, replace tabs with spaces or fit the parts again. Each source line has half-open UTF-16 `start`, `end`, `nextStart` and a hard/soft/end boundary. Joining `part.text.slice(line.start, line.nextStart)` preserves original spaces and CR/LF/CRLF. Generated labels are not source fields.

Code pagination preserves exact body fragments and repeats filename/language, retaining the evaluated floor. Irreducible metadata rejects the whole operation even with an empty body. Coordinated renderer/PPTX 0.7.0 and editor 0.6.0 reuse these measurements; inspect the installed versions and rollout plan before relying on them. SVG/PPTX reject XML-forbidden code characters with `invalid-code-text`, source path and UTF-16 offset; schema-valid JSON and font coverage are separate checks. Complete native code tags can recover source/metadata after edits, but native formatting, positions, font theme and readability policy are not reconstructed. Inspect native output and preserve the original PPTX; this is not pixel or arbitrary Office round-trip equivalence.


## Resizing tracks

`geometry.flows` exposes exact track offsets/sizes and container paths. The editor's `prepareTrackResize(document, flow, boundary, fraction)` from `@openpresentation/opf-editor/layout` returns a validated candidate and guarded JSON Patch. The fraction is the first track's share of an adjacent pair, clamped to 5–95%. Row/grid flows resize columns; column flows resize rows. An automatic layout becomes an explicit grid with its currently chosen columns. Preview before applying, especially under strict overflow. Promoted regions do not move; nested flows within them can be resized. Reserved placeholder slots require an explicit arrangement, and flows with more than twelve tracks should be grouped first. Canvas users can choose Arrange or call `setLayoutEditing(true)`.
