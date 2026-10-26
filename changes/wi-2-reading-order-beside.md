---
type: fixed
packages: [opf]
---
WI-2: `opf/reading-order` no longer reports content that sits in a column beside the title as "drawn above the title" when it is taller than the title and so starts above it (a title and a list side by side, as in the `agenda-split` layout). Only content drawn entirely above the title, over the title's own columns, is reported, as before. An area that spans only `auto` rows (because an empty region collapsed into it, as the all-`auto` stack layouts do) is no longer sized to zero height.
