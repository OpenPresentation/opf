---
type: changed
packages: [opf, render, pptx]
---
SH-10 (output-changing for shape blocks and overlay shapes with text): text that holds the body size in a large shape now grows as a lone body block does, up the type scale one step at a time to a paragraph's display size, while it fits and fills at most `LONE_TARGET` of the text rectangle's height; it never ends below the body size, and text that does not hold the body size is fitted down to the floor as before. Sibling shapes (the blocks of one group, or a slide's overlay shapes) keep one size: each that grew is set at the smallest size they all reached. The preview and the PPTX export draw the same composed size.
