---
type: fixed
packages: [opf]
---
RR-79: clamp a template grid's physical gap to its available width and height so valid grids with up to 12 tracks per axis keep positive, disjoint cells. Previously the maximum gap could consume all track space, drawing several rows on top of each other or portrait columns outside the slide. Row content allocation and existing built-in template geometry are unchanged.
