---
name: opf-layout
description: "Arrange OPF blocks, nested groups, promoted regions, and pagination. Use for slide overflow, layout constraints, composition geometry, or preserving content while splitting slides."
license: MIT
---

# Compose and repair OPF layouts

Work on the supplied OPF document without silently rewriting or dropping content. Use the installed OPF schema to check available composition options; older package versions may not contain the current composition/pagination APIs.

## Choose the structure

- `blocks` with `composition.mode: auto` suit content that can reflow. Use `row`, `column`, or `grid` when arrangement matters; `columns` selects grid tracks or caps automatic candidates.
- `weights` size columns in row/grid/auto and rows in column mode. They describe relative allocation, not percentages or absolute pixels.
- Nested groups keep related content together. Each group contains `blocks` and optionally `composition`; it is not also a leaf `text`/`image` payload.
- Promoted regions (`left`, `center+right`, `top:left`, and the other schema-defined regions) preserve placement on a 3×3 vocabulary. Use disjoint regions; flow direction and weights do not relocate them.

Read [geometry and repair](references/geometry.md) before measuring or paginating. The format schema is the source of numeric bounds; do not invent arbitrary `x`, `y`, `width`, or `fontSize` fields on leaf payloads.

## Repair loop

Inspect the current slide, effective dimensions, resolved layout, fonts, and path-specific diagnostics. Give content more space, change the grouping or arrangement, or split it explicitly. Summarize or remove content only when the user's request permits it. Reducing `minFontSize` below readability is not a successful repair.

Use the same font measurement provider and resolved design for preview, layout, and export. Without actual font measurements, label results as estimates. `overflow: error` gates supported text fit; it does not certify complex charts, images, or PowerPoint pixel parity.

Pagination is an explicit authoring operation. Review the returned ordinary slides and source mappings, then validate and render them. A renderer should not secretly export a different paginated document from the one shown in the editor. An unsplittable item requires a targeted change; do not ignore a pagination error or use partial output.
