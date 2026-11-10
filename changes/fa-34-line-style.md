---
type: changed
packages: [opf, render, pptx]
---

One line style. `Line` is `"none"` or `{ color, width, dash }` with every part optional, shared by table cell borders (`TableCellBorder`) and chart reference lines (`ChartReferenceLine.stroke`; `ChartReferenceStroke` is removed). A cell border no longer requires `color` and `width`: `"bottom": "none"` removes an edge and `"top": { "width": 2 }` keeps the table rule's color. `FiniteNumber` names the finite bounds reference values use.

Preserve the existing canonical imported reference axis/label fields and unconditional chart formatting. Count written-paint and authored-stroke ownership bytes before export under the unchanged native metadata bound. Unchanged owned references retain partial/none and ColorRef authoring; native paint edits retain current paint or visible uncertain overlays.

Validate authored reference-stroke ownership against the actual Line schema before recovery. Malformed style metadata keeps the valid native reference and current paint with a diagnostic, instead of invalidating the complete import. Native identity, binding and resource guards remain unchanged.
