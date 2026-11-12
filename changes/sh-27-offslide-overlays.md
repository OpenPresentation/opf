---
type: fixed
packages: [opf, editor, render, pptx]
---
SH-27: overlay shapes may start outside the slide (negative `x` and `y`); composition, the editor and PPTX import keep those positions, and right-to-left overlays keep their place when moved.
