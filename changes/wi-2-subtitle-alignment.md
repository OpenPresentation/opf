---
type: changed
packages: [opf, render, pptx]
---
WI-2 (output-changing for decks whose title and content alignment differ): the subtitle follows `titleAlignment` whenever it sits in the title area, as the tag already did, so one alignment axis holds the heading group on every slide (the Metrics layout over centered numbers now keeps a left subtitle under its left title). A layout with its own `subtitle` region and a slide's own `design.contentAlignment` keep today's content alignment, and covers are unchanged. `item.alignment` of a title-area subtitle is the resolved `titleAlignment`; the schema text, `docs/dynamic-composition.md` and `docs/design-resolution.md` say so.
