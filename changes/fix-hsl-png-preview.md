---
type: fixed
packages: [render, opf, pptx]
---
The PNG and PDF previews draw an SVG picture's HSL gradient stops as a browser does (opf#1438): the slash-alpha form `hsl(H S L / A)`, which the rasterizer drew black, the number-only form `hsl(H S L)`, which it did not draw, and `hsla()` are converted to sRGB in the rasterizer's private copy of the picture, the alpha folded into the stop's `stop-opacity`. The conversion is the one the PPTX export applies, now shared from `@openpresentation/opf/composition` (`svgHslStopsToSrgb` and its parts) instead of living in the PPTX package. Forms a browser does not draw stay as written, a picture without an HSL stop keeps its bytes, and the SVG output is unchanged.
