# Shapes: burndown

Goal and boundary: [README.md](README.md). Status values: `todo`, `in-progress`, `done`, `partial`, `descoped`. Whoever changes an
item's state edits its row and appends a log line in the same PR.

| ID | Item | Package | Acceptance | Status |
| --- | --- | --- | --- | --- |
| SH-01 | Preset geometry engine: the 187 DrawingML presets (guides, adjust values, paths, text rectangle, connection sites) from Apache POI's definitions, in an edge-safe module | core, spec | `@openpresentation/opf/shape-geometry` evaluates every preset; a 187-preset deck matches PowerPoint through COM | done ([opf#1043](https://github.com/OpenPresentation/opf/pull/1043)) |
| SH-02 | Shape blocks: the shape content kind, fills, strokes, styles, text, transform, accessibility and links in both engines; `{ color, lighten\|darken }` on every ColorRef; the picture `border` renamed `stroke` (no alias); masks for every preset; the lazy shape engine (`ensureShapes`); sketched and gradient outlines | core, render, pptx, editor, docs | `examples/technical/shapes.opf.json` draws in the preview as PowerPoint draws it | done ([opf#1050](https://github.com/OpenPresentation/opf/pull/1050)) |
| SH-03 | Effects: shadow (presets and object form), inner shadow, glow, soft edges, reflection and blur, in the preview and as a native `a:effectLst` | render, pptx | `examples/technical/shape-effects.opf.json` matches PowerPoint through COM | done ([opf#1045](https://github.com/OpenPresentation/opf/pull/1045); wired into SH-02's shape blocks by the wave 8 integration) |
| SH-04 | Overlay shapes and connectors, and native Mermaid diagrams: slide-level `shapes` placed by fractions or attached to a block, connectors with automatic connection sites, diagram nodes as presets and edges as connectors | core, render, pptx | A connector between two blocks follows them; a native diagram family matches its picture export in PowerPoint | todo |
| SH-05 | PPTX import of shapes: presets, custom geometry, fills, lines, effects and connectors back into OPF, excluded properties as findings | pptx | Every shape the export writes imports back unchanged; a PowerPoint-authored deck's shapes import | in-progress |
| SH-06 | Editor and agents: a shape picker, adjust handles, every property in the editor; MCP `search_shapes`; the skills teach shapes | editor, mcp, skills | A shape can be added, adjusted and styled in the playground and found by name through the MCP | todo |

## Decisions

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
