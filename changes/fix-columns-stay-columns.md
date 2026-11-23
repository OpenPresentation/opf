---
type: fixed
packages: [opf]
---
LH-86: `two-column` and `three-column` keep long texts in columns. Two or three plain texts of 80 characters or more on a carded slide were drawn as full-width rows, so a layout named columns drew rows (its own gallery example among them); a layout whose whole body is one row of regions now keeps its columns, at one size, and draws rows only when the columns overflow at the floor and the rows overflow less. One region's grid (`pillars`, `scorecard`, `team`) keeps the rule. The gallery previews of `two-column` and `three-column` change.
