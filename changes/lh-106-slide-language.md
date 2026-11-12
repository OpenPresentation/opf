---
type: added
packages: [opf, render, pptx, editor]
---
A slide can set its own `language` (a BCP-47 tag or a Language object; in Markdown `<!-- slide: language=ar-SA -->`): direction, script fonts, quotation marks, line breaking and number formats follow that slide, and PPTX export and import keep it. An Arabic slide in an English deck now gets its complex-script font in PowerPoint, and embedding or copying slides includes the font schemes their languages select.
