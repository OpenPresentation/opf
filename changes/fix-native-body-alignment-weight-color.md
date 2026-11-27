---
type: fixed
packages: [pptx]
native: [technical/slide-design-overrides#2, columns#2, technical/dynamic-composition#3]
---
Output-changing for `--body-text native` only (the default export is byte-identical). A bulleted or numbered list on a slide whose content alignment is center or end is written left-aligned, as the preview and the default export draw it, instead of with `algn="ctr"` or `algn="r"` on its paragraphs (opf#1551). Regular runs of a native body now state `b="0"` and `i="0"`, so they no longer inherit the bold the layout's Body placeholder takes from a bold sample text (opf#1552). The emphasis color core gives the bold words of a lone display message, such as the "First:" of a run-in lead, is written on the native runs as it is in the default export, instead of the text color (opf#1553).
