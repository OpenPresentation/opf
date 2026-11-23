---
type: fixed
packages: [opf]
---
Grids a slide asks for (opf#1412 A7, output-changing for slides with no layout that set `composition.mode: "grid"` or their own `columns` and hold two or more rows of blocks): the blocks now sit in the middle of their cells instead of at the top of each cell, and a `grid` whose columns the engine chooses stretches its short last row to the full width, as automatic composition does (LH-47), so no cell is left empty. A chart in a `mode: "grid"` slide stays in the grid instead of taking LH-49's track and squeezing the other blocks into narrow cells beside it.
