---
type: fixed
packages: [opf, pptx]
---
RR-105: text in a shape no longer breaks inside a word ("Mite r" in a small triangle): a word wider than the shape's text rectangle is set on one line, centered, reaching past the insets up to the shape's edges, and the PPTX writes that shape's text unwrapped so PowerPoint draws it the same way. A word too wide even across the shape is reported as `opf/text-overflow`.
