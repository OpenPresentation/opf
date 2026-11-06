---
type: added
packages: [render, pptx]
---
SH-03: the six shape effects in both engines. `shadow` (the presets `soft`, `hard` and `perspective`, or `{ color, opacity, blur, distance, angle, size }`), `innerShadow`, `glow`, `softEdge`, `reflection` and `blur` are written to PowerPoint as a native `a:effectLst` (exact EMU, 60000ths of a degree and 1/100000 alpha, in the schema's order; the presets as `a:outerShdw`) and drawn in the preview as SVG filters tuned against PowerPoint's own renders: blur radii as Gaussians of a third of the radius, a round grow and shrink for the glow and soft edge, PowerPoint's order (inner shadow, soft edge, blur, glow, text, outer shadow, reflection), and a shadow that follows the drawn outline (text included when the shape has no fill) and keeps its direction when the shape turns. See `docs/shape-effects.md`.
