---
type: fixed
packages: [opf, render]
---
RR-105 (output-changing for flipped shapes with an asymmetric text rectangle): the preview now places the text of a flipped shape block or overlay shape where PowerPoint does. PowerPoint mirrors the preset's text rectangle with the geometry (`flip: horizontal` left to right, `flip: vertical` top to bottom) without mirroring the glyphs, and a vertical flip turns the text upside down about the rectangle's center; core now composes the mirrored text rectangle and the SVG and PNG renderers turn a vertically flipped shape's text about that rectangle. The PPTX export is unchanged. Found by the v0.33 PowerPoint qualification (#1093).
