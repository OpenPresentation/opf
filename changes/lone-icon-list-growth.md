---
type: fixed
packages: [opf, render, pptx]
---
A lone list whose entries pair a label with a description and carry icons keeps its icons (output-changing for such slides): the list's growth to its display size measured it with its chip column, which took a line from the descriptions, so the list did not grow while the same list without icons did, and the size guard then dropped every chip with `opf/icon-dropped` on a slide with room for them. The chips are now drawing in that measurement, as a badge list's badges are: the list grows as it would without them, as long as it still fits with them, and draws its chips (or, when every entry has an icon and the cards read as large, as icon cards). No text is set smaller; no slide of the examples corpus moves.
