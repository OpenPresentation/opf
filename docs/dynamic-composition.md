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

### Unpublished shared content cards

The coordinated `codex/shared-metric-integration-20260910` source branches add `grid-score-v5`. For `design.contentBox: true`, each body leaf carries a `frameBox` at its outer allocation and a `box` padded inward by 12 reference pixels at a 720-pixel short edge, capped at one quarter of the frame's width or height. Scoring, accepted payload measurement, strict overflow and pagination all use that rounded interior. Headings remain unframed, nested groups keep their original padding, and explicit outer regions/track weights remain authoritative. Automatic candidates may change because their available content space changes.

Raw composition callers pass their resolved deck flag as `composeSlide(slide, {contentBox: effectiveDesign.contentBox, ...options})`; a slide's explicit `design.contentBox: false` overrides it. Coordinated renderer, editor and whole-presentation pagination resolve this option for their callers. Consumers draw at `frameBox` and use the accepted `box` and payload internals without another inset. Published core 0.9.0 does not expose this behavior. Content cards do not make the incomplete chart/timeline density models complete or certify native raster fidelity.

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

### Explain automatic selection (core 0.8.0 and later)

Pass `explain: true` to return `result.explanation`. This opt-in API requires core 0.8.0; it is absent from core 0.7.0. Enabling explanations adds no measurement calls and does not change geometry, source content, reading order, weights or selected arrangements within the same engine version.

```js
const result = composeSlide(slide, {...resolvedOptions, explain: true});
for (const decision of result.explanation.decisions) {
  console.log(decision.path, decision.reason, decision.selectedColumns);
  console.table(decision.candidates);
}
console.log(result.explanation.textMeasurement);
console.log(result.explanation.unmeasuredPayloads);
```

`resolvedOptions` supplies the same dimensions, layout, fonts and optional width provider as the preview. Core 0.8.0 identifies its explanation as `grid-score-v2`; core 0.9.0 advances to `grid-score-v3` to include complete code metadata/body measurements. Both record containers in parent-before-child order. `lowest-score` reports the candidates actually tried; `configured-mode` respects resolved row/column/grid intent and returns no invented candidates. `promoted-regions` leaves region placement fixed and has no selected column count. Empty slides have no decisions. Automatic search tries one through `min(slotCount, columns ?? 6)` columns, in ascending order; ties retain the first candidate. Reserved placeholders count as slots. The schema caps an explicit candidate limit at twelve columns.

Each candidate has `columns`, `rows`, `score` and additive `penalties`:

| Penalty | Rule |
| --- | --- |
| `cellProportions` | Sum of `abs(log(cellAspect / 1.6))` for descendant leaves |
| `fontReduction` | Reduction from 25 reference pixels for text-like leaves; quotes and code in core 0.9 sum requested-minus-fitted sizes across their parts, divided by canvas scale |
| `textOverflow` | 1,000 per overflowing text-like leaf, complete quote or complete code payload, regardless of the number of internal failure reasons |
| `tableOverflow` | 1,000 per table whose shared cell layout overflows |
| `smallCells` | 100 per leaf narrower than 100 or shorter than 60 reference pixels |
| `emptySlots` | 2 per unused position in the candidate grid's final row |

Scores are preference costs, not quality percentages or guarantees. Floating-point summation can make the component total differ slightly from `score`. Parent scoring uses descendant explicit arrangements or geometric automatic seeds; child automatic grids are optimized only after selecting the parent. Candidate scores therefore describe the bounded search, not a full assessment of the final optimized subtree. Heading fit remains in ordinary diagnostics, outside body-grid scoring. A strict-fit rejection exposes the explanation on `OPFCompositionError` when requested.

`textMeasurement` is `estimated` without a provider and `provided` with one. A provided width function does not establish font provenance, glyph coverage, shaping or native raster fidelity. Text, rich text, lists, quotes, table cells and code in core 0.9 participate in the fit model. `unmeasuredPayloads` identifies images, video, charts, metrics and timelines whose complete internal layout is not assessed. Core 0.8 also reports code as incomplete; core 0.9 measures its filename/language/body and insets. Media aspect ratios, chart labels, metric labels and timeline annotations remain gaps. A zero score or empty diagnostics is not proof that those payloads fit.

This milestone exposes the existing search for inspection. Guarded layout repairs, automatic weight allocation, content-aware candidate improvements, a common payload-internal measurement model, CLI explanations and a canvas **Auto arrange** preview/undo operation remain subsequent work. It does not silently paginate or rewrite a document.

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

The default readability target is 24 reference pixels. Core 0.8.0 returns slides that persist that floor in `composition.minFontSize`, including an already-fitting one-page result; existing higher minima and strict overflow policies remain intact. Quotes can raise their nominal body/footer sizes to the floor. Published small-format payloads such as table cells retain their earlier typography caps; the unpublished [readability-floor candidate](plans/readability-floor.md) removes those caps from shared text/list/table fitting. Pagination relies on the shared engine's estimates; it is not a guarantee that every host font renders identically. Headings repeat unchanged, speaker notes remain on the first page, and continuation IDs avoid existing deck IDs. `pages[].mappings` records full source/output paths and half-open text or item ranges. Text offsets use UTF-16, so source strings can be reconstructed exactly. Quote bodies split at grapheme boundaries and repeat complete attribution/source fields on each page. An irreducible footer rejects the whole operation, including a quote with an empty body after earlier content.

If a heading, individual list item, table row, or other atomic payload cannot fit on an otherwise empty page, `OPFPaginationError` returns actionable diagnostics. There is no partial output. `maxSlides` defaults to 100, and a layout-evaluation limit bounds work on pathological input. Specialized chart and timeline internals still require visual inspection; their complete density models remain outstanding.

The editor's `editor.paginateSlide(index)` is one validated transaction with undo/redo. It returns `{change, pagination}`. Editor 0.5.0 commits a one-page readability-policy change too; repeating the operation after the policy is recorded returns `change: null`. The playground includes an overflowing draft and **Split overflow** action. The CLI writes a new file and refuses to overwrite an existing one:

```sh
node packages/cli/dist/index.js paginate input.opf.json output.opf.json
```

## Fidelity boundary

The shared engine provides identical body and heading geometry to SVG and editable PPTX export. Text measurements default to deterministic estimates. For actual font advances, use the shared provider described in [measured fonts](font-fidelity.md). Complex scripts, fallback fonts, PowerPoint text rendering, rich text, charts, tables, and images still need visual verification. Dynamic composition is not a guarantee of pixel-identical PowerPoint output. List density includes rich runs, descriptions and nesting via `fitList`, with the same hanging indents used in preview and export. Only text-like payloads currently receive content-density estimates; small-cell diagnostics also cover non-text content.

SVG embeds raster data URI images locally. Remote and file images require a host resolver that supplies a raster data URI; otherwise they appear as placeholders. `strictAssets` rejects unresolved images. The runtime never fetches them.

See [the complete example](../examples/technical/dynamic-composition.opf.json) and [local ecosystem verification](ecosystem-development.md).


## Metric internals (unreleased integration)

The candidate `layoutMetric(value, box, options)` export accepts a finite number, string, or `{value, unit?, label?, description?, delta?, trend?}`. Import it from the root or composition entrypoint after building this checkout. It is not included in published core 0.9.0. Coordinated source branches now consume it through composition, atomic pagination, SVG, editor and PPTX; candidate/registry adoption and native raster verification remain unfinished. The [primitive checkpoint](plans/shared-metric-layout.md) and [source integration checkpoint](plans/shared-metric-integration.md) distinguish their evidence and remaining gates.

Pass the allocated reference-pixel `box`, resolved heading/body `fonts`, `textMeasurement`, canvas `scale`, effective `minFontSize`, source `path` and optional `overflow: 'error'`. `metric-flow-v1` returns separate value/unit/label/description/delta/trend parts in that order. Numeric zero is visible; scalar values keep the scalar path. Every provided field retains its original string or number in `sources[].value`. Source ranges address `String(value)` using UTF-16 offsets; the original spelling of a numeric JSON token is not available. No locale formatting, trend icon, case conversion or separator is invented. Empty optional strings retain source mappings with `visible: false`; the required empty value keeps a targetable blank line.

The allocator tries an adjacent value/unit baseline when both fit one line and the unit uses at most 35% of the cell width; otherwise it stacks the fields. Metadata has an eight-reference-pixel gap, with twelve pixels after the primary row. Related fields stay together rather than being separated by a percentage of the cell height. The value starts at up to 76 reference pixels (28% of cell height); label/unit/delta start at 23, description at 20 and trend at 18. Every requested size is raised to the chosen floor, scaled once. Natural metadata height gets space before reducing type. At most 48 arrangements are evaluated, each with at most 77 value-size trials; identical inputs and a deterministic measurement provider select the fitting candidate with least summed font reduction, preferring the first candidate on ties.

Each part exposes requested/resolved styles and the same source-preserving line/segment representation used by code (`CodeTextFit`), measured with proportional heading/body fonts. CR/LF/CRLF, tabs, whitespace and grapheme boundaries remain exact. Consumers must reuse accepted line and segment positions, font sizes and styles rather than independently re-fit or normalize text. This API reports `provided` measurement when a provider is passed, without claiming that its glyph coverage or shaping is complete. Unsupported glyphs propagate the provider's error with the field path.

Pass `align: 'left' | 'center' | 'right'` (default left) to the primitive. Its returned `alignment` and per-part `linePositions` give an absolute x origin and baseline for each `fit.sourceLines` entry, including blank lines. An inline value/unit pair moves together, with the gap following the actual value advance. Composition accepts host-resolved `contentAlignment`; an explicit slide `design.contentAlignment` overrides it. Renderer/export/pagination pass the effective design into the same operation. Alignment does not trigger a second font fit.

Check `overflow` before consuming parts. Irreducible text, invalid available space, parts outside the cell and overlapping occupied line boxes return field-specific diagnostics; strict mode throws `OPFCompositionError`. Invalid available boxes retain their dimensions and have no fit. These are advance-based line rectangles, not glyph outlines: the controlled browser evidence separately records small glyph overhangs. The API is a bounded internal allocator, not the complete layout-repair/Auto arrange operation or a native export fidelity guarantee.

`grid-score-v4` now accounts for every metric part's font reduction and applies one overflow penalty per failing metric leaf. `item.metricLayout` is measured against the rounded accepted cell; `item.text`/`item.textStyle` alias the value fit/style. Field diagnostics obey strict ancestor policies, while explicit modes/weights/regions remain authoritative. Metrics leave this branch's advance-model `unmeasuredPayloads` list. Explicit pagination retains metrics atomically with complete source types/metadata and rejects irreducible fields without returning partial output. These source contracts still require coordinated consumer/browser/native verification before release.

## Code internals (core 0.9.0 and coordinated packages)

Core 0.9.0's `layoutCode(value, box, options)` API accepts the schema's string shorthand or `{source, language?, filename?}` object. It returns measured filename/language/body parts with exact original text, requested/resolved styles, readability floors, available boxes and diagnostics. Renderer/PPTX 0.7.0 and editor 0.6.0 are its coordinated release targets for shared rendering, native export, source/metadata edits and undo. [Release gates](plans/shared-code-release.md) distinguish prepared versions from verified publication. Core 0.8.0 does not include this API and retains the [recorded code-label, filename and whitespace defects](plans/layout-repair.md).

`grid-score-v3` charges code font reductions across all metadata/body parts and one overflow penalty per failing leaf. It preserves explicit modes, weights, regions and source order. Accepted `item.codeLayout` is fitted to the same rounded cell exposed as `item.box`; `item.text` and `item.textStyle` alias the body, not the first metadata part. Strict ancestor settings apply to internal `.source`, `.filename` and `.language` diagnostics. Code no longer appears in `explanation.unmeasuredPayloads`, which concerns the core advance-based model only. It does not mean browser/native fidelity is verified.

Pagination slices the code body at grapheme boundaries, repeats filename/language and returns contiguous UTF-16 body ranges while preserving all source bytes and the evaluated readability floor. Irreducible metadata rejects all output, including when the body is empty or earlier content could have fitted. Consumers must preview/export the returned document. The [integration checkpoint](plans/shared-code-integration.md) separates source, installed browser, Windows PowerPoint and remaining release gates.

Each fitted part retains every space and explicit CR/LF/CRLF break. `fit.lines` contains exact source slices, and `fit.sourceLines` records half-open UTF-16 `start`, `end` and `nextStart` offsets, the measured width and a `soft`, `hard` or `end` boundary. A hard break occupies `[end, nextStart)`; soft wrapping consumes no source character. Joining `part.text.slice(line.start, line.nextStart)` reconstructs the original part. Blank lines and a final empty line are retained, and long tokens split only at grapheme boundaries. Filename and language text are not case-converted. An absent/empty metadata pair creates a generated `code` label with no source range.

`code-flow-v1` uses 18-reference-pixel outer insets, an eight-pixel gap between filename and language, and a twelve-pixel gap before the body. Nominal metadata/body sizes are 14/18 reference pixels, raised when necessary to respect the selected minimum, then scaled once. At most four metadata nominal/floor combinations are tried; each body fit tries at most 19 sizes regardless of canvas scale. The fitting combination with least font reduction wins. Irreducible metadata/body failures retain all text and diagnostic paths; invalid available boxes have no fit. `overflow: 'error'` rejects rather than returning partial output.

Tabs remain literal characters in part text and displayed-line slices. Measurement advances to the next multiple of four measured spaces from that line's origin; `fit.tabSize` and `fit.tabWidth` expose the rule. Each source line's `segments` contains exact text/tab source ranges plus measured `x`/`width` values relative to its origin. Consumers must reuse those positions: an Edge probe showed that SVG treats a tab as one space despite CSS `tab-size: 4`. The candidate SVG renderer uses positioned spans and geometric precision; native export uses accepted tab stops. Width measurements and source preservation alone do not establish glyph-outline containment, shaping/bidi support or native fidelity. [Installed workflow evidence](evidence/shared-code-installed/summary.json) records the separate actual browser and native checks with their exact font/runtime scope.

Candidate native export stores source boundaries in standard PowerPoint shape tags. Complete unique groups recover exact code/source metadata, with current native text taking precedence. Missing, damaged or ambiguous groups retain visible native shapes and report diagnostics. Reimport does not reconstruct native formatting, positioning, font theme or readability policy. Eight installed-export wide/portrait slides pass native edit/save/reopen and all 24 original/saved/edited imports on the recorded Windows PowerPoint build; this is not arbitrary PowerPoint round-trip or pixel equivalence. The editor preserves untouched CRLF/CR source around edits and keeps committed preview geometry separate from its active native textarea caret.

The JSON schema can accept strings that [XML 1.0 cannot represent](https://www.w3.org/TR/xml/#charsets). Candidate SVG/PPTX code output rejects forbidden controls, unpaired UTF-16 surrogates, U+FFFE and U+FFFF with `invalid-code-text`, the source field path and UTF-16 offset in the message. The input stays unchanged; the caller can correct that character explicitly. Tabs, CR/LF/CRLF and valid supplementary characters remain accepted for serialization. Schema support, format representability and glyph coverage are separate properties.

The controlled SVG harness requests `text-rendering="geometricPrecision"` as well as explicit segment placement. Initial Linux Chromium CI rounded glyph advances under default hinting, unlike Windows Edge with the same font bytes. The [SVG specification](https://www.w3.org/TR/SVG/painting.html#TextRenderingProperty) defines geometric precision as a rendering hint, so consumers still need actual browser checks with their exact fonts and supported environments; the hint alone does not certify agreement. The harness retains a 0.1-reference-pixel tolerance and records observations before assertions.

## Quote internals (core 0.8.0 and coordinated packages)

Core 0.8.0 exports `layoutQuote(value, box, options)` from the root or composition entrypoint. Pass validated quote content (object or string shorthand), its allocated reference-pixel box, resolved `fonts`, `textMeasurement`, `scale` (canvas short edge / 720), effective `minFontSize`, `overflow` policy and its source `path`.

The result contains `parts` for the body and any nonempty footer, exact display `text`, source mappings, requested and resolved text styles, and the available boxes/fits. Source ranges use half-open UTF-16 offsets in both the source field and display string; generated quotation marks and the footer separator have no source range. The original content is never modified. A supplied width provider is reported as `provided`; it does not certify shaping or font fidelity.

Check `overflow` and `diagnostics` before accepting the parts. Invalid available dimensions remain visible with `fit` absent, and `overflow: 'error'` throws `OPFCompositionError`. Diagnostics distinguish invalid part space, parts outside their cell, text that exceeds its reserved space, and overlapping line rectangles. Those rectangles are conservative text-layout bounds, not measured glyph outlines. The readability floor is scaled once and can raise the nominal body (28) or footer (17) size; it is never silently capped below the selected floor.

`quote-flow-v1` keeps 18-reference-pixel outer insets and an 18-pixel body/footer gap while fonts scale with the canvas. A 40-pixel footer is a whitespace preference. The allocator expands it for long sources or compacts it for dense bodies, trying at most the nominal and minimum footer sizes and selecting the fitting pair with least total font reduction. If neither fits, it returns floor-size failure diagnostics. This is a bounded internal allocation step, not a complete layout-repair engine.

`composeSlide` scores both parts and accepts geometry against the final rounded item box. Each quote item carries `quoteLayout`; its compatibility `text` field is the same fit object as the quote body, including generated quotation marks. Consumers needing original offsets must use the explicit `sources` mappings. The coordinated renderer and PPTX consume these parts without another measurement/style-resolution pass. Missing geometry or invalid part boxes reject rendering/export rather than omitting content. This requires core 0.8.0 with renderer/PPTX 0.6.0; older core 0.7.0/renderer 0.5.1/PPTX 0.5.2 lack these changes. The complete published set, immutable verification refs and fresh registry evidence are recorded in `release-plan.json` and [the release plan](plans/shared-quote-release.md).

Browser glyph bounds can extend slightly beyond advance-based part boxes into the reserved inset. Current loaded-font tests record those overhangs, verify glyph containment inside the full quote cell and check body/footer separation. Native PowerPoint fixtures separately verify text, sizes, cell containment, save/reopen and reimport. Neither test establishes universal pixel equivalence. Original requested-font provenance through host substitutions and non-quote payload internals remain open requirements.

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
