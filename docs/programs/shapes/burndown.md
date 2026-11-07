# Shapes: burndown

Goal and boundary: [README.md](README.md). Status values: `todo`, `in-progress`, `done`, `partial`, `descoped`. Whoever changes an
item's state edits its row and appends a log line in the same PR.

| ID | Item | Package | Acceptance | Status |
| --- | --- | --- | --- | --- |
| SH-01 | Preset geometry engine: the 187 DrawingML presets (guides, adjust values, paths, text rectangle, connection sites) from Apache POI's definitions, in an edge-safe module | core, spec | `@openpresentation/opf/shape-geometry` evaluates every preset; a 187-preset deck matches PowerPoint through COM | done ([opf#1043](https://github.com/OpenPresentation/opf/pull/1043)) |
| SH-02 | Shape blocks: the shape content kind, fills, strokes, styles, text, transform, accessibility and links in both engines; `{ color, lighten\|darken }` on every ColorRef; the picture `border` renamed `stroke` (no alias); masks for every preset; the lazy shape engine (`ensureShapes`); sketched and gradient outlines | core, render, pptx, editor, docs | `examples/technical/shapes.opf.json` draws in the preview as PowerPoint draws it | done ([opf#1050](https://github.com/OpenPresentation/opf/pull/1050)) |
| SH-03 | Effects: shadow (presets and object form), inner shadow, glow, soft edges, reflection and blur, in the preview and as a native `a:effectLst` | render, pptx | `examples/technical/shape-effects.opf.json` matches PowerPoint through COM | done ([opf#1045](https://github.com/OpenPresentation/opf/pull/1045); wired into SH-02's shape blocks by the wave 8 integration) |
| SH-04 | Overlay shapes and connectors: slide-level `shapes` placed by fractions or attached to a block, front and back layers, connectors with automatic connection sites and an adjustable middle, pagination | core, render, pptx | A connector between two blocks follows them in PowerPoint; `examples/technical/shape-overlays.opf.json` and its right-to-left deck match PowerPoint | done ([opf#1057](https://github.com/OpenPresentation/opf/pull/1057), integrated by the phase 2 integration) |
| SH-05 | PPTX import of shapes: presets, custom geometry, fills, lines, effects and connectors back into OPF, excluded properties as findings | pptx | Every shape the export writes imports back unchanged; a PowerPoint-authored deck's shapes import | done ([opf#1058](https://github.com/OpenPresentation/opf/pull/1058), integrated by the phase 2 integration) |
| SH-06 | Editor and agents: a shape picker, adjust handles, every property in the editor, overlay shapes and connectors on the slide; MCP `search_shapes`; the skills teach shapes | editor, mcp, skills | A shape can be added, adjusted and styled in the playground and found by name through the MCP | done ([opf#1060](https://github.com/OpenPresentation/opf/pull/1060), integrated by the phase 2 integration) |
| SH-07 | Native Mermaid diagrams: the PPTX export writes a diagram as native shapes, glued connectors and text in one group, from pele's own geometry (`diagrams: "shapes"`, the default for the families that passed); an unchanged group imports as its diagram | core, pptx, cli | Every allowlisted family matches the preview in PowerPoint in five designs | done ([opf#1059](https://github.com/OpenPresentation/opf/pull/1059), integrated by the phase 2 integration) |
| SH-08 | SmartArt import: a PowerPoint SmartArt diagram reads into OPF | pptx | A PowerPoint-authored SmartArt deck imports with its text and structure | todo |
| SH-09 | SmartArt export (tier 1): live SmartArt for the layouts OPF's engine draws exactly as PowerPoint does | core, render, pptx, gallery, cli | A layout is written as SmartArt only after it passes the comparison with the preview | in review ([opf#1065](https://github.com/OpenPresentation/opf/pull/1065)): the `pyramid` and `matrix` layouts (a region's `arrangement`) as live Basic Pyramid and Basic Matrix SmartArt, no layout part, native shapes outside the compared domain (`smartArt: "live" | "shapes"`) |
| SH-10 | Text in large shapes grows like body text instead of staying at the shape's base size | core, render, pptx | A large shape's text reads at the size body text of that area would | todo |
| SH-11 | Small shape text is drawn smaller in PowerPoint than in the preview | core, pptx | The same small shape text measures alike in the preview and in PowerPoint | todo |
| SH-12 | Graphviz DOT diagrams (owner-approved), laid out by pele | core, render, pptx | DOT sources draw in the preview and export as native shapes | todo |
| SH-13 | PlantUML diagrams (owner-approved), laid out by pele for the diagram types it already draws | core, render, pptx | PlantUML sources of those types draw in the preview and export as native shapes | todo |

## Decisions

- **Own render only (owner).** OPF ships only what its own engines draw at high fidelity: the preview and the PPTX export draw one
  geometry, and a feature whose PowerPoint drawing has not been compared with the preview is not written natively.
- **PowerPoint export order (owner, confirmed 2026-11-06).** A diagram is written as (1) live SmartArt where OPF's engine draws that
  layout exactly as PowerPoint does and it passed the comparison, else (2) native shapes and text, else (3) an SVG picture.
- **No names of a commercial PowerPoint library (owner).** OPF names shapes, properties and chart types only by DrawingML and its own
  vocabulary, in code, docs, catalogs, tests and changelogs; RR-103 (opf#1061) removed the earlier ones and `git grep` finds none.
- **SH-07 decisions (vetoable, accepted 2026-11-06).** (1) Only straight edges without arrowheads are glued connectors
  (`straightConnector1` with `a:stCxn`/`a:endCxn`): PowerPoint refuses a connector of custom geometry and its largest line end is about
  20% shorter than pele's arrowhead, so every other edge is one shape of custom geometry with its arrowheads. (2) The finding is
  `pptx/diagram-shapes-unavailable` (an export option is not a validation rule). (3) Right-to-left text keeps a picture (PowerPoint's own
  bidirectional layout decides its placement). (4) All 32 families are allowlisted: the misses in the light, serif, Segoe UI and Japanese
  comparisons are glyph-only (the preview's stand-ins for Aptos, Segoe UI and Yu Gothic), with geometry and label positions matching.
- **D2 diagrams: recommended against** (awaiting the owner).
- **Pagination of overlays (SH-04).** When a slide splits, a shape placed by fractions is on every page, a shape `at` a block on its
  block's page, and a connector on the page that holds both ends; a connector whose ends land on different pages is on none and is
  reported as `connector-split`.
- **SH-04, diagrams as shapes (owner, 2026-11-05).** The PPTX export takes an option `diagrams: "picture" | "shapes"`. With `shapes`, a
  diagram's nodes and edges are native shapes and connectors built from pele's own layout geometry (the preview's drawing), not a second
  layout. A diagram family switches to shapes by default only after its PowerPoint comparison passes; until then it stays a picture.
- **SH-02, a sketched outline on re-save (vetoable, 2026-11-06).** PowerPoint keeps a sketched line (`ask:lineSketchStyleProps`) as a live
  sketch while it is open, but its re-save writes the drawn outline as fixed custom geometry: the slide looks the same and the line is no
  longer a live sketch. Accepted and documented; the export keeps writing the sketch extension.

## Progress log

- 2026-11-05: program opened with the owner-approved design (`docs/shapes.md` holds the property map).
- 2026-11-05: SH-01 done ([opf#1043](https://github.com/OpenPresentation/opf/pull/1043)): the preset geometry engine and its PowerPoint comparison deck.
- 2026-11-05: SH-03 done ([opf#1045](https://github.com/OpenPresentation/opf/pull/1045)): the six effects in both engines, measured against PowerPoint.
- 2026-11-06: SH-02 done ([opf#1050](https://github.com/OpenPresentation/opf/pull/1050)): shape blocks, fills, strokes, styles, lighter and darker colors, masks for every preset, the lazy engine.
- 2026-11-06: phase 1 integrated with the layout harvest's wave 8 ([opf#1055](https://github.com/OpenPresentation/opf/pull/1055)): SH-03's effects drawn on SH-02's shape blocks in both engines, `examples/technical/shape-effects.opf.json`, the lazy engines documented once.
- 2026-11-06: SH-05 in review ([opf#1058](https://github.com/OpenPresentation/opf/pull/1058)): PPTX import of shapes; the export's own shape blocks, overlay shapes and connectors come back as authored, a PowerPoint deck's shapes become overlay shapes and bound connectors, the excluded properties are findings. Evidence: `packages/pptx/test/fixtures/powerpoint-shapes.pptx` (built through PowerPoint COM) and both example decks saved again by PowerPoint.
- 2026-11-06: SH-04 done ([opf#1057](https://github.com/OpenPresentation/opf/pull/1057)): overlay shapes and connectors, front and back layers, connector adjust and pagination; 20 of 20 connectors glued in PowerPoint and following moved shapes.
- 2026-11-06: SH-05 done ([opf#1058](https://github.com/OpenPresentation/opf/pull/1058)): PPTX import of shapes, overlays and connectors; shapes behind content as the back layer, PowerPoint's connector middles kept as `adjust`, the pattern tile origin at the slide's corner, arrowheads on open preset paths in both engines.
- 2026-11-06: SH-07 done ([opf#1059](https://github.com/OpenPresentation/opf/pull/1059)): native Mermaid diagrams, all 32 families allowlisted, `diagrams: "shapes"` the default.
- 2026-11-06: SH-06 done ([opf#1060](https://github.com/OpenPresentation/opf/pull/1060)): the shape picker, adjust handles, shape and overlay editing, MCP `search_shapes` and the skills.
- 2026-11-06: phase 2 integrated (SH-04, SH-05, SH-07, SH-06 in one branch, `codex/sh-phase-2`): one connector writer for overlay connectors and glued diagram edges; an intact diagram group imports as its diagram and none of its members as overlays; an edited group imports as SH-05 shapes; one shapes page; budgets regenerated once. SH-08 to SH-13 added.
- 2026-11-06: SH-09 in review ([opf#1065](https://github.com/OpenPresentation/opf/pull/1065)): pyramid and matrix arrangements in both engines and the gallery; live SmartArt (OPF's data model with explicit sizes, its own colors and quick style, a drawing from core's geometry, `r:lo=""` and no layout part) where a 112-deck COM sweep passed (33 of 38 live decks; every node within 0.000 pt, sizes equal), native shapes elsewhere with `pptx/smartart-unavailable`; import of OPF's and PowerPoint's pyramid1 and matrix3. The preview draws large text 4 to 7 px lower than PowerPoint for every OPF text box (baseline model), not only SmartArt: a follow-up.
- 2026-11-06: SH-09 revised in review (coordinator): a `pyramid` or `matrix` never falls back to a plain list where a design holds it. PowerPoint's geometry (live SmartArt inside the domain), else OPF's own design (a stepped pyramid with the entries beside it, quadrants filling the region), and a card grid for a matrix of other than four entries (`opf/arrangement-adapted`); no empty quadrants. Re-swept: 20 live SmartArt (all pass), 60 OPF design, 27 card grids, 5 lists (pyramids of 6 to 8 long levels on small slides, with the finding).
