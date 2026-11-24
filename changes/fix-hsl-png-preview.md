---
type: fixed
packages: [render, opf, pptx]
---
The PNG and PDF previews draw an SVG picture's HSL gradient stops as a browser does (opf#1438): the slash-alpha form `hsl(H S L / A)` and a hue with a unit, which the rasterizer drew black, and the number-only form `hsl(H S L)`, which it did not draw, are converted to sRGB in the rasterizer's private copy of the picture, the alpha folded into the stop's `stop-opacity`. The forms the rasterizer already reads (`hsla()` and the plain comma form) keep their bytes, so their pixels do not move. The conversion is the one the PPTX export applies, now shared from `@openpresentation/opf/composition` (`svgHslStopsToSrgb`, with a `keep` option, and its parts) instead of living in the PPTX package. Forms a browser does not draw stay as written, a picture without an HSL stop keeps its bytes, and the SVG output is unchanged.
