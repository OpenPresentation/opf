---
type: changed
packages: [opf]
---
LH-102 (output-changing for short lone lists): a lone plain list that reached its display size (37 px) while its body is still under half full grows on by the type scale's steps, while it fits, fills at most 60% of its body and every entry stays on one line: a list of one to three first-level entries up to 56 px (the size a lone short text reaches), of four or five up to 49 px, and a longer list keeps 37 px (`SPARSE_LIST_DISPLAY`). Two short points no longer sit at list size in an empty body beside the display size of the same words written as one text. A list with descriptions, drawn as ruled rows, beside numerals, with badges or resolvable icons, in a region with an arrangement, or on a dark summary slide that may draw check tiles keeps its drawing and its size.
