# Shapes phase 2

Phase 2 of the shapes work merges four reviewed branches into one: SH-04 (opf#1057, overlay shapes and connectors), SH-05
(opf#1058, PPTX import of shapes), SH-07 (opf#1059, native Mermaid diagrams) and SH-06 (opf#1060, shapes in the editor), then main
again (RR-103, opf#1061). Each branch's PR body explains its change; this note records what the combined branch does to the goldens.

## Template baseline (`layout-templates-rr96-color-variants.json`)

`node test/layout-template-goldens.mjs --update`: 0 of 468 slides change, so nothing is promoted. No template sample has an overlay,
a connector, a pattern-filled shape or a diagram.

## Raster goldens

`golden.mjs` and `golden-gate.mjs` are not regenerated here; the `golden` workflow regenerates them. The combined branch's previews
of every example were compared with main's (the convert pipeline, 136 decks against 134), and the moves expected are:

- `technical/shapes.opf.json#2` (the Fills slide): SH-05 tiles a shape's pattern fill from the slide's top-left corner, as PowerPoint
  does, instead of from the shape's corner. The pattern now matches PowerPoint's to the pixel; on main it drew out of phase.
- `technical/shape-overlays.opf.json` (6 slides) and `technical/shape-overlays-rtl.opf.json` (1 slide): SH-04's new example decks.

No other example slide's preview changes: native diagrams change only the PowerPoint export (`technical/diagrams.opf.json`, 7 slide
parts), not the preview, and pictures with pattern masks and pattern backgrounds already tiled from the slide's corner.
