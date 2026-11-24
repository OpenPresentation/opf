---
type: fixed
packages: [opf]
---
Blocks in full-height cells (opf#1412 A2, output-changing for slides whose blocks all name cells that run the body's full height, such as `start` beside `center+end`): such a block now sits in the middle of its cell. A text, list, quote, metric or table shorter than the column takes the height it needs there, and a chart its box allows, instead of the top of the column over an empty foot (a pie in `start` beside a paragraph in `center+end`, a table sidebar beside a chart); a quote keeps its own card. Cells of paragraphs and lists only keep LH-102's band and growth. Beside cells of their own rows (`start` beside `top:center+end` and `bottom:center+end`) a full-height block keeps the top of its column, so the slide reads in the order its cells are composed. A slide that draws cards keeps every card filling its cell.
