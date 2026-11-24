---
type: fixed
packages: [opf]
---
LH-67: a lead plus stack keeps the author's order. Only a first or last block leads; an automatic body whose long block sits between shorter siblings is stacked in one column in order, and a layout's recomposition at the floor (LH-83) no longer draws it as a lead plus stack, so a `comparison` with a short Option A and a long Option B keeps A on the left, B on the right, one size for both, and the recommendation under them.
