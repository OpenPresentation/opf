---
type: fixed
packages: []
---
LH-88: the generated gallery examples (`examples/gallery`, written by `scripts/generate-example-suite.mjs`) no longer set `design.contentAlignment` at deck level. The generator cycled left, center and right, so a third of the decks centered their list and paragraph bodies (35 slides flagged by `opf/centered-body`), and a deck value overrides every layout record, including the centered cover, section, closing and statement layouts. Unset, the layout records decide: start-aligned bodies, centered cover, section, closing, statement and metrics. The 100 decks are regenerated with the generator, and they carry the LH-87 color scheme values.
