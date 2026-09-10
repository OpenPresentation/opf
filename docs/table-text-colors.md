# Inherited table text colors

The unpublished shared-metric integration branches use one core rule for inherited table text colors in SVG and editable PowerPoint cells. After resolving the cell fill, keep the inherited text color when its unrounded contrast is at least 4.5:1. Otherwise choose the higher-contrast black or white. This covers pale headers and dark body-cell fills without changing the source document.

An explicit cell `style.color` or rich-text run `color` remains authoritative, including a deliberately low-contrast color. Translucent fills and unresolved colors keep the inherited preference: their actual backdrop must be known before assessing contrast. This rule does not alter fills, borders, fonts, layout or metadata.

Core exports `colorContrast(foreground, background)` and `textColorForFill(fill, preferred)` from its root and `/composition` entrypoints. They accept opaque hexadecimal `#RGB`, `#RRGGBB` and `#RRGGBBFF` colors. `colorContrast` returns `undefined` for unsupported or translucent colors. Callers must apply explicit text-color overrides before invoking the fallback.

The ratio uses [W3C's sRGB relative luminance definition](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html). Passing this narrow color check is not a WCAG certification, a readability guarantee, a browser/native raster equivalence result or an arbitrary PowerPoint round-trip claim. Source tests check actual SVG attributes and native OOXML text colors, including inherited and explicit rich-text colors. A separate six-slide real PowerPoint test passes on Node 20.20.2 and 24.20.0: all 48 original/reopened cell observations and 624 character-color observations match per runtime. Native rasters remain distinct evidence from browser rendering.
