---
type: fixed
packages: [opf]
---
LH-58: a block of `bullets` groups as the list it draws. Block grouping read a `bullets` block as a paragraph of no length, so every two of them paired as long + short paragraphs and four one-word `bullets` blocks were drawn small at the top of the body, while the same points as `items` lists were centered and larger. The two spellings of a short list now compose alike.
