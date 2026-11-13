---
type: changed
packages: [opf]
---
LH-188 (output-changing for one-message slides): a slide whose body is one text, quote or metric, with no subtitle and no title or only a short label title, grows its message past the former caps as far as its length allows, up to 115, 80 and 54 reference pixels for a statement of up to 30, 60 and 120 characters, 86, 72 and 56 for a quote's body and 252 for a figure of at most six characters (`MESSAGE_CEILINGS`, `FIGURE_CEILING`, `messageCharacters`, `oneMessageField`). The ceilings only raise the existing growth by steps of the type scale, which still keeps every word whole, balanced lines and the 60% fill target, so a message never ends smaller than before and a title over a paragraph keeps its sizes.
