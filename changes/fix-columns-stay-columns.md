---
type: fixed
packages: [opf]
---
LH-86: `two-column` and `three-column` keep long texts in columns. Two or three plain texts of 80 characters or more on a carded slide were drawn as full-width rows, so a layout named columns drew rows (its own gallery example among them); a layout whose whole body is one row of regions now keeps its columns, at one size, and draws rows only when the rows overflow less or set the texts larger (both are composed), so no slide's text gets smaller. One region's grid (`pillars`, `scorecard`, `team`) keeps the rule. The gallery previews of `two-column` and `three-column` change.
Rows and columns are compared as LH-48's three steps leave them, so LH-102's further growth of a short body never turns two short texts back into rows while three stay columns.
