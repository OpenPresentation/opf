---
type: fixed
packages: [opf, render, pptx]
---
RR-105: a picture background that names no `tone` now takes the one its duotone recolor, opacity and overlay imply, so text over a darkened picture turns light in validate, the preview and the PPTX export alike (an explicit `tone` still wins, and a photograph with nothing over it keeps the old default). `opf/text-on-image` now bounds a duotone picture by its own colors, counts an edge band over the text it reaches, and warns when text is too faint over every color the picture can show.
