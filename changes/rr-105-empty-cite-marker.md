---
type: fixed
packages: [opf, render, pptx]
---
RR-105: a `cite` or `footnote` on an empty run now draws its marker after the text before it, in the preview and in PowerPoint, instead of listing the note at the slide foot with nothing in the body pointing to it. The PPTX import gives the empty marked run back.
