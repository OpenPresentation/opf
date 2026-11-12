---
type: fixed
packages: [render, pptx]
---
RR-114: PowerPoint export prepares just the fonts native text wrapping measures, including bold and italic fallbacks and host-safe typefaces, so a deck whose runs all choose their own fonts exports without loading the default body face.
