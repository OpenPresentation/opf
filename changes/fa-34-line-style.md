---
type: changed
packages: [opf, render, pptx]
---
FA-34: one line style. `Line` is `"none"` or `{ color, width, dash }` with every part optional, shared by table cell borders (`TableCellBorder`) and chart reference lines (`ChartReferenceLine.stroke`). A cell border no longer requires `color` and `width`: `"bottom": "none"` removes an edge and `"top": { "width": 2 }` keeps the table rule color. PPTX import keeps authored reference stroke metadata that matches the `Line` schema; malformed metadata keeps the native reference with a diagnostic instead of invalidating the import.
