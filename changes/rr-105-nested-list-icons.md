---
type: fixed
packages: [opf, render, pptx, cli]
---
RR-105: a nested list now draws the icons of its first-level entries on chips, in the preview and in PowerPoint, as the docs promise; its nested entries keep their bullets under their entry's text, and a list mixing chips and bullets comes back from a PPTX import. `opf validate` now reads the SVG files a deck's icons name, as `opf convert` does, so both report the same `opf/icon-dropped` findings.
