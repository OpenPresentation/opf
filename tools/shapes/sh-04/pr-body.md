SH-04 of the shapes program: overlay shapes and connectors, in the format, core, both engines, docs and skills.

## What it adds
- **Format** (`spec/schemas/opf.schema.json`). A slide gets `shapes`, an array of `OverlayShape` entries. The defs are `OverlayShape`, `OverlayAnchor` and `Connector`.
  - **Overlay shapes** use the shape block vocabulary, with one placement each: `x`/`y`/`width`/`height` as fractions of the slide, or `at: { block, edge, offset, width, height }`.
  - **Connectors** are entries with `connector: { from, to, route, fromSite, toSite }`, plus `stroke`, `adjust`, `alt`, `decorative` and `hidden`.
  - **`layer`** is `front` or `back`. Back-layer shapes sit behind the content.
- **Core** returns `SlideComposition.overlayShapes`, composed on the final composition so the overlay never moves content.
  - `ComposedOverlayShape` is a shape block item: SH-02's `ComposedShape`, with its text fitted by composition.
  - `ComposedConnector` is routed as PowerPoint's `straightConnector1`, `bentConnector2`/`3` or `curvedConnector2`/`3`, with PowerPoint's own `a:xfrm` frame (box, rotation, flips) and `a:avLst`. The route is the preset's own path, evaluated in that frame.
  - Connection sites come from SH-01 and turn and flip with their shape. Other blocks use a rectangle's four sites. Sites are chosen automatically as the facing pair with the shortest route.
- **Validation**: two new findings, `opf/shape-anchor-missing` and `opf/connector-end-missing`. These are `opf/schema` errors: a placement given twice or not at all, a site index the shape doesn't have, and a shape-only key on a connector. SH-02's adjust and hidden-link checks also apply to overlay shapes and to a connector's `adjust`.
- **Pagination**:
  - A shape placed by fractions appears on every page.
  - An `at` shape appears on the page where its block lands.
  - A connector appears on the page that holds both its ends.
  - A connector whose ends land on different pages is drawn nowhere and reported as `connector-split` in `PaginatedPage.diagnostics`.
- **Preview**: overlay shapes use the shape block drawing; connectors use the shape stroke drawing (dash, compound, sketch, arrowheads). The back layer is drawn above the background and watermark; the front layer is drawn after the furniture.
- **PPTX**:
  - Overlay shapes are native `p:sp`.
  - Connectors are native `p:cxnSp`, glued with `a:stCxn`/`a:endCxn` to the shape blocks, overlay shapes, pictures and cards at their ends.
  - Back-layer shapes go into the shape tree before the content shapes.
  - A text block without a card is several line boxes, so a connector ending there is not glued. This is documented.
- **Docs**: `docs/shapes.md` gets a new section, "Overlay shapes and connectors". The opf-layout, opf-author and opf-inspect skills are updated, and the MCP serves the updated `docs/shapes.md`.
- **Examples**: `examples/technical/shape-overlays.opf.json` (6 slides) and `shape-overlays-rtl.opf.json`.

## Evidence
- **Preview | PowerPoint sheet** (PowerPoint 365 export through COM): `C:/opf-work/shapes/sh-04/sheet.png`.
  - The sheet includes a pixel overlay of the "every route" slide and of the connectors slide. Every route (straight, elbow and curved; facing, same-facing and perpendicular sites; an authored adjust) is drawn on the same pixels by both engines.
  - Mean difference per channel over a whole slide is 1.1 to 2.7 of 255 for the connector slides. The rest is text antialiasing.
- **Connectors stay attached** (`C:/opf-work/shapes/sh-04/com-connectors*.json`). For all 20 connectors of the two decks, PowerPoint's object model reads `ConnectorFormat.BeginConnectedShape` and `EndConnectedShape` as the intended shapes, at core's site plus 1. After moving each end shape through COM, the connector's box changes with it.

## Tests
- New: `packages/javascript/test/sh-04-overlays.test.mjs` (19), `packages/render/test/sh-04-overlays.mjs`, `packages/pptx/test/sh-04-overlays.mjs`.
- Every test file of core, render, pptx and mcp was run file by file (render 168/168, pptx 216/217, core 261/262). Three fail here and on the original checkout, for Windows or sparse-checkout reasons:
  - `check-browser-safe` (path separators)
  - `script-width-estimates` and `check:text` (`docs/evidence` is not checked out)
  - `keynote-registry-runtime` (symlink permission)

## Pinned files
- **`scripts/catalog-free-budget.json`**: not regenerated, and `check:catalog-free` is over budget. Gzipped sizes against the budget:

  | Entry | Current | Budget | Over by |
  | --- | --- | --- | --- |
  | `format` | 61,004 | 60,827 | 177 |
  | `precompiled` | 228,607 | 228,568 | 39 |
  | `schema-engine-precompiled` | 228,628 | 228,606 | 22 |

  The precompiled validators grew by about 38 KB raw. A two-form `anyOf` grew them by 96 KB; one form keeps the growth to 38 KB.
- **Test bounds raised**:
  - the precompiled chunk sanity bound, to 1.9 MB
  - the MCP docs budget, to 1,160,000 bytes (room for SH-05, SH-06 and SH-07)
  - the lean MCP Worker bundle, to 8,050,000 bytes
- **Render goldens**: no golden file is added or changed (a slide without `shapes` draws exactly as before). If CI asks for goldens of the two new example decks, they come from the `golden.yml` workflow.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
