---
type: changed
packages: [opf, render, pptx]
---
LH-48 now grows every body under half full that its burndown row names, not only paragraphs and lists. A body of two or more bare metrics (no cards, tiles or band note) grows by the type scale's steps with every role in proportion, so the label keeps its share of the value (76 and 23 px become, for example, 100 and 30 px). A table with the one text under it no longer leaves an empty band between them: the note follows the table a gap under its last row and the pair sits in the middle of the body, and a pair under half full grows too. Shares the author set with `composition.weights` keep their cells. Moves two example goldens (`technical/icons-and-arrangements#2`, `technical/layout-sampler#23`).
