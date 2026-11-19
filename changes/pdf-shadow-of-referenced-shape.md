---
type: fixed
packages: [render]
---
A vector PDF draws the outer shadow of a shape effect again. The shadow is a filtered `<use>` of the shape drawn after it, outside `<defs>`, and the raster fallback of the filtered element copied only the page's `<defs>`, so the copy referenced nothing and the shadow was missing from the PDF (the PNG and SVG had it). The fallback now copies what a `<use>` in the element references, and what that references in turn.
