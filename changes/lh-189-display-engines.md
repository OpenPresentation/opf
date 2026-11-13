---
type: changed
packages: [render, pptx]
---
LH-189 (output-changing for display text): the preview draws a display line with negative tracking as one run (no tspan split before its last character, so the last pair keeps its kerning), and the outlined text and the vector PDF leave the spacing after a line's last character out of its middle or end anchor, as the raster preview does. Import treats the letter spacing OPF writes (the display tracking, or the eyebrow's for a label in capitals) as drawing and reports no unsupported text style for it.
