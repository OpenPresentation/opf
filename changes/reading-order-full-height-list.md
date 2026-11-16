---
type: fixed
packages: [opf]
---
The `opf/reading-order` warning no longer fires for tiles beside a full-height list (`top:start`, `top:center`, `bottom:start` and a list on `top+middle+bottom:end`). A tall item no longer merges the rows it spans into one, so the visual order reads row by row and then the list, the same from the region cells composition uses and the boxes the rule checks. Composed order of slides with a full-height item in a row of region keys can change with it.
