---
type: fixed
packages: [opf, editor, render, pptx]
---

Allow overlay shapes to begin outside the slide, including negative x/y coordinates. Composition, editor frame changes and PPTX import preserve signed positions instead of rejecting, skipping or clamping them. Slide dimensions and shape width/height limits are unchanged.
