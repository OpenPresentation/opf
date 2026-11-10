---
type: changed
packages: [opf, render, pptx]
---

One line style. `Line` is `"none"` or `{ color, width, dash }` with every part optional, shared by table cell borders (`TableCellBorder`) and chart reference lines (`ChartReferenceLine.stroke`; `ChartReferenceStroke` is removed). A cell border no longer requires `color` and `width`: `"bottom": "none"` removes an edge and `"top": { "width": 2 }` keeps the table rule's color. `FiniteNumber` names the finite bounds reference values use.
