---
type: fixed
packages: [pptx]
---
opf#1415 (output-changing for every classic chart with data labels): data labels are written on one line, as the preview draws them. PowerPoint wraps an automatic data label at its own width limit, so a series name at the end of a line in a small chart ("31 Self-serve") broke onto two lines. Every text body inside a `c:dLbls` (each label set's and point's `c:txPr`, and the `c:tx` rich text of a label with its own text: value labels, end labels, slice and ring names, reference line labels) now carries `wrap="none"` on its `a:bodyPr`; axis titles, tick labels, the legend and chartex charts are unchanged.
