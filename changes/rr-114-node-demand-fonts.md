---
type: changed
packages: [opf, render, pptx]
---
RR-114: in Node, fonts are prepared for the families, weights and styles a document uses instead of every face of a pack, and coverage is checked without shaping, so a shaping failure may now surface while rendering. A color-emoji face also gets its monochrome companion, so PNG and raster PDF paint emoji.
