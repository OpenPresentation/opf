---
name: opf-layout
description: "Arrange OPF blocks, nested groups, promoted regions, and pagination. Use for slide overflow, layout constraints, composition geometry, or preserving content while splitting slides."
license: MIT
---

# Compose and repair OPF layouts

Work on the supplied OPF document without silently rewriting or dropping content. Use the installed OPF schema to check available composition options; older package versions may not contain the current composition/pagination APIs.

<!-- glossary:start -->
**Words these skills use**

- **Furniture**: the parts that repeat on slides outside the content: header, footer, logo, slide number. You set them once on the deck or a layout, not in `blocks`.
- **Composition**: the automatic layout step that turns a slide's content into boxes with a position, size and font size. A `composition` key steers it.
- **Implicit blocks**: content fields written straight on the slide (`text`, `items`, `table`, ...) with no `blocks` list. Composition treats them as blocks, and editing can turn them into an explicit `blocks` list.
- **Promoted region**: content placed by a 3×3 grid key on the slide (`left`, `top:right`, `center+right`), used when relative position matters. It cannot be mixed with root content.
- **Catalog record**: one named, reusable design entry (a theme, layout, color scheme, font scheme, ...) from the `@openpresentation/gallery` package or a deck's `catalogs`. A deck refers to it by id.
- **Reflow**: text wrapping again when its box or size changes. OPF computes line breaks itself; PPTX export writes each wrapped line as its own text box, so text edited in PowerPoint or Keynote does not reflow.
- **Provenance**: tags that OPF writes into an exported PPTX to record where each shape came from, so a later import can map edits back to the OPF source.
<!-- glossary:end -->

## Choose the structure

- `blocks` with `composition.mode: auto` suit content that can reflow. Use `row`, `column`, or `grid` when arrangement matters; `columns` selects grid tracks or caps automatic candidates.
- `weights` size columns in row/grid/auto and rows in column mode. They describe relative allocation, not percentages or absolute pixels.
- Nested groups keep related content together. Each group contains `blocks` and optionally `composition`; it is not also a leaf `text`/`image` payload.
- Promoted regions (`left`, `center+right`, `top:left`, and the other schema-defined regions) preserve placement on a 3×3 vocabulary. Use disjoint regions; flow direction and weights do not relocate them.
- A layout record is one ordered list of `regions`, declared once, in reading order, with a `direction` (`row` side by side, `column` stacked) and a `size` per entry (a share of the parent; `auto` only in a column). An entry is a region (`name`, `accepts`, `flow`, ...) or a split (`direction` and its own `regions`, for two dimensions, three levels at most). `title` and `subtitle` are reserved heading regions that take only a size, and `anchor` on the record or a split is inherited by the body regions under it. Regions say which kinds they accept, how several blocks flow, and whether an empty region collapses. The 28 built-ins are named by intent (`cover`, `text`, `chart`, `two-column`, and others). Read `docs/layout-templates.md` and the actual record before pinning a block with `region`. Unpinned blocks bind by kind, role, then reading order; a pin names a region on that layout. Use `layout: "auto"` for explicit automatic composition. The slide's own groups remain content groups, not layout placeholders.

Read [geometry and repair](references/geometry.md) before measuring or paginating. The format schema is the source of numeric bounds; do not invent arbitrary `x`, `y`, `width`, or `fontSize` fields on leaf payloads.

## Match the structure to the content, and budget the slide

One idea per slide. Pick the layout from what the content is, then check it fits before you repair anything:

- Parallel entries with details: layout `pillars`, or labelled `items`. Figures that sit in prose: layout `metrics`. Options compared: layout `comparison` (two) or a `table`. A sequence: layout `process` or `timeline`. One message: layout `statement`. A quote: layout `quote`. The opf-author skill's storyline guide has an example of each.
- One block or group per slide can carry the takeaway on a contrasting card: `"emphasis": true` (a dark card on a light slide, an accent card on a dark one; colors from the scheme, text at 4.5:1). Do not mark more than one; a second is drawn plain. A short last text after longer blocks becomes a band at the foot automatically, and a very short one after a lone paragraph a pill under it (never at the cost of another block's size); `"emphasis": false` opts out. A scorecard's metrics are tiles: the value sized from the card, the label above it, the description and trend at the foot.
- A slide has a vertical budget. At the default sizes on a 16:9 slide, about 10 one-line list entries, 6 two-line entries, 6 entries with a description, 10 table rows or 4 paragraphs keep the engine's full text size; past that the whole block shrinks toward the 16 px floor and then overflows. For a talk, aim well under it (about 6 entries, 8 table rows, 3 paragraphs). The [vertical budget](references/geometry.md#vertical-budget) lists the measured figures and the `composeSlide` call that measures your own content; label them as estimates without a font measurement.
- When the budget is exceeded, split the slide where the story breaks (two ideas, two slides), or run `opf paginate deck.opf.json --check` and then `opf paginate deck.opf.json -i` to let the engine split what does not fit. Do not lower `minFontSize` or shorten the content to make it pass.

## Headers and footers

Header and footer zones (`left`, `center`, `right`) sit on the content inset, so a footer's left edge meets the body's. They are three columns with a small gutter, and a zone beside empty zones takes their width: a lone `left` footer spans the content width, and a `left` and a `right` zone share the free center. A `center` zone stays centered. A zone that still wraps onto more than two lines gets the `opf/furniture-wraps` warning: shorten it, or move a source to a `caption` on the chart, table or image it describes, or to the speaker notes. See `docs/dynamic-composition.md` for the geometry (`furniture-flow-v2`).

## Repair loop

Inspect the current slide, effective dimensions, resolved layout, fonts, and path-specific diagnostics. Give content more space, change the grouping or arrangement, or split it explicitly. Summarize or remove content only when the user's request permits it. Reducing `minFontSize` below readability is not a successful repair.

Use the same font measurement provider and resolved design for preview, layout, and export. Without actual font measurements, label results as estimates. `overflow: error` gates supported text fit; it does not certify complex charts, images, or PowerPoint pixel parity.

Pagination is an explicit authoring operation. Review the returned ordinary slides and source mappings, then validate and render them. A renderer should not secretly export a different paginated document from the one shown in the editor. The one exception is the export's continuation (LH-90): `opf convert` and `convert` draw an overfull slide of sibling blocks of one kind (eight timelines, each with any note after it) as several slides, split between whole blocks, and report it as `slide-continued` with the report field `continued`. Treat that finding like an overflow: split the slide in the deck where the story breaks, or run `opf paginate`, so the deck and the editor show the same slides; `--keep-slides` draws it as written. An unsplittable item requires a targeted change; do not ignore a pagination error or use partial output.
