# Styled and spanning table cells

This work is unreleased. Published core 0.6.0 accepts scalar and rich-array cells; it does not accept the object form below. The coordinated development branches are `codex/styled-table-cells-20260908` in core, renderer, editor and PPTX.

## Canonical representation

```json
{
  "table": {
    "columns": ["Team", "Work", "Status"],
    "rows": [
      [{"value": "Design", "rowSpan": 2, "style": {"fill": "#E8EFF8", "verticalAlign": "middle"}}, "Preview", "Ready"],
      [null, "Editing", "In progress"],
      [{"value": ["Next: ", {"text": "native import", "bold": true}], "colSpan": 3}, null, null]
    ]
  }
}
```

Cell `value` accepts the existing scalar or rich-array forms. A styled header uses the same object form. Arrays remain dense: a spanning anchor owns a rectangle, and every covered position explicitly contains `null`. Missing positions or non-null values under a span are errors. This preserves column indexes and prevents merges from silently hiding content. Header merges may span columns but cannot extend into body rows.

`style` accepts `fill`, `color`, `align` (`left`, `center`, `right`), `verticalAlign` (`top`, `middle`, `bottom`), `padding` and `borders`. Colors use RGB or RGBA hex notation, including transparent `#00000000`. Explicit rich-run colors override the cell text color. Padding is an object with optional `top`, `right`, `bottom`, `left`; omitted edges default to 8, 10, 4, 10 respectively. Border edges take `{ "color": "#123456", "width": 2, "dash": "dot" }`, with `solid`, `dash` or `dot` patterns. Zero width hides that cell's edge. Adjacent cells retain their own borders; suppress both adjoining edges when hiding a shared boundary. Omitted edges retain the theme border.

Padding and border widths are reference pixels, scaled from a 720-pixel canvas short edge. Columns retain equal widths. Row heights use shared text measurements, padding and spanning-cell constraints. Pagination keeps connected vertical merge groups together and rejects a group that cannot fit without returning partial output.

## Current evidence

- Core: schema and semantic validation, anchor ownership, source paths, geometry, scaling, rich text and pagination tests pass on Node 20 and 24. The complete 404-test suite passes on both runtimes.
- Renderer: fills, alpha, per-edge borders, alignment, spanning rectangles and `.value` traces pass focused Node 20/24 tests. The existing 126-deck, 805-slide raster corpus is unchanged. A generated styled-table PNG has been visually inspected.
- PPTX export/import: native XML tests verify dense merged grids, unique cell text, fully covered rows, fills/text alpha, edge dashes, zero/fractional padding, alignment, scaled heights and deterministic output on Node 20/24. Import retains direct styles and conditional solid fills/theme fill references. Malformed merges retain all source text with diagnostics; valid merges crossing a flagged header retain the row as explicitly styled body content. The full suites pass, including the 126-deck, 805-slide structural corpus.
- Clean local tarballs: core, renderer and PPTX install together without source loaders or duplicate core versions. Styled export/import checks pass on Node 20/24. A re-rendered imported table has been visually inspected; this is OPF/SVG evidence, not native PowerPoint raster evidence.
- Editor model: `.value` typing/formatting, style/span preservation, empty cells, discoverable fields, invalid structural edits and atomic undo pass focused checks. Actual browser interaction for these objects remains pending.

Conditional native borders/effects, unequal native column widths, editor pointer/keyboard/undo checks, coordinated CI, versioned publication and public assets remain to be completed. Browser verification was unable to run while the host Mac was locked. No native PowerPoint raster equivalence has been established. The locally packed packages retain development versions and must not be confused with the packages already published under those version numbers.

## Reproduce focused checks

Build core first with `pnpm --filter @openpresentation/opf build`. Then run `node --test packages/javascript/test/styled-table-cells.test.mjs` from core. In each coordinated renderer/PPTX worktree, build and run `node --import /path/to/opf/scripts/register-local-opf.mjs test/styled-table.mjs`. The loader uses that built core without changing lockfiles or installed dependencies. Do not rebuild core while consumers are reading its `dist` directory.
