---
type: fixed
packages: [opf]
---

LH-184: `columns: "auto"` on a list (and a region's `listColumns: "auto"`) keeps the largest text. When no column count fits at the starting size, it takes the count (1, 2 or 3) whose fitted size is largest, preferring fewer columns on a tie, and is never smaller than the list in one column; before, every column shrank to one shared size, so a long list could come out smaller in three columns than in one. A fixed count stays as written.
