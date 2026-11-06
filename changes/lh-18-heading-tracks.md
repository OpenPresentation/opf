---
type: changed
packages: [opf]
---
LH-18 (output-changing): sibling heading lists in one row (pillars, the cells of a grid of pillars or questions, cards of a heading over its description: one entry with a description each) share the row's heading track. Every heading takes the height of the tallest one, so a pillar whose heading wraps to three lines no longer leaves its neighbors' descriptions starting on other lines; the descriptions start on one line, in left-to-right and right-to-left decks. Only space is added under the shorter headings, never a size change, and a row whose aligned tracks would not fit the room its lists were fitted in keeps its arrangement. It is the guarded placement rule `heading-tracks`, so the size guard holds over the corpus: no block is smaller and no finding is added. Sibling groups of a heading text over a body (a column of two blocks) are not aligned yet.
