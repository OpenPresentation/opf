---
type: fixed
packages: [opf, render, pptx]
---
A list never splits a word inside, as LH-44 already rules for table cells. In a cell narrower than an entry's longest word at the list's size (a small share of `composition.weights`, a narrow column), the list steps down to the size its longest word fits at, never under its minimum; where even the minimum is too large, the list is an overflow and `opf/text-overflow` says that a word is wider than its column and what to change (a wider cell, a shorter word, or splitting the slide). Before, the word was broken across lines ("acknowledgm / ent") with no finding. No example or template golden moves.
