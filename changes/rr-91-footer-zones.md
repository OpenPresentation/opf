---
type: changed
packages: [opf]
---
RR-91 (output-changing for decks with a header or footer): the header and footer zones sit on the content inset (`composition.padding`, so a footer's left edge meets the body's) instead of 7% from the slide edge, and are three columns with a 2% gutter instead of three 26% boxes. A zone beside empty zones takes their width, so a lone `left` footer spans the content width instead of wrapping to four lines in a third, and a `left` and a `right` zone share the free centre; a `center` zone stays centred. Right-to-left mirroring is unchanged. The new `opf/furniture-wraps` warning reports a header or footer zone that wraps onto more than two lines, with the hint to move sources to a caption or the speaker notes.
