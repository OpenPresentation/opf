# Shape effects

A shape block takes six effects (SH-03 of the shapes work; the shape block itself and its other keys are in
`docs/shapes.md`). Each is written to PowerPoint as native DrawingML (`a:effectLst` in the shape's `p:spPr`) and drawn
in the preview as SVG filters, so the two engines agree. Lengths are reference pixels (the 1280 x 720 reference: 1 px is
0.75 pt on a 13.33 x 7.5 in slide, scaled with the slide's shorter side), opacities and sizes are fractions 0 to 1, angles
are degrees clockwise from the right (90 points down), and colors are `ColorRef`s (an 8-digit hex alpha multiplies
`opacity`).

| Key | Value | Default | DrawingML |
| --- | --- | --- | --- |
| `shadow` | `"soft"`, `"hard"`, `"perspective"`, or `{ color, opacity, blur, distance, angle, size }` | object keys default to `soft` | `a:outerShdw` |
| `innerShadow` | `{ color, opacity, blur, distance, angle }` | black, 0.5, 6.67, 5.33, 45 | `a:innerShdw` |
| `glow` | `{ color, opacity, radius }` | `accent`, 0.4, 6.67 | `a:glow` |
| `softEdge` | radius | | `a:softEdge` |
| `reflection` | `{ opacity, size, distance, blur }` | 0.5, 0.35, 0, 0.67 | `a:reflection` |
| `blur` | radius | | `a:blur grow="1"` |

`shadow.size` scales the shadow about the shape's center (1.1 shows a rim of shadow all around). The shadow keeps its
direction when the shape is rotated (`rotWithShape="0"`), as PowerPoint's own presets do. `reflection.size` is how much
of the shape's height the reflection takes to fade out; `reflection.distance` is the gap below the shape.

## The shadow presets

Each preset is written as `a:outerShdw` (`a:prstShdw` is excluded on purpose) with the values of the PowerPoint Shadow
gallery entry it stands for (Format Shape, Effects, Shadow):

| Preset | PowerPoint entry | Color | Transparency | Blur | Distance | Angle | Size |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `soft` | Outer, Offset: Bottom | black | 60% | 4 pt (5.33 px) | 3 pt (4 px) | 90 | 100% |
| `hard` | a crisp offset (no gallery twin) | black | 75% | 0 | 6 pt (8 px) | 45 | 100% |
| `perspective` | Perspective: Below | black | 85% | 12 pt (16 px) | 25 pt (33.3 px) | 90 | 90% wide, flipped to 19% tall from the bottom edge |

## Units in DrawingML

The export writes EMU (9525 a reference pixel, times the slide's scale `min(width, height in inches) * 96 / 720`),
60000ths of a degree (`dir`, kept in 0 to 21600000) and 1/100000 fractions (`a:alpha`, `stA`, `endPos`, `sx`, `sy`), with the
children in the order `CT_EffectList` requires: `a:blur`, `a:glow`, `a:innerShdw`, `a:outerShdw`, `a:reflection`,
`a:softEdge`. The reflection is `stA` = opacity, `endA="0"`, `endPos` = size, `dist` = distance, `blurRad` = blur,
mirrored (`sy="-100000"`) about the bottom-left (`algn="bl"`).

## How PowerPoint draws them, and the preview with it

Measured on PowerPoint for Windows (Microsoft 365, November 2026) through COM exports of shapes carrying each effect at
several settings, with the edge profiles fitted to the preview's SVG filters:

- Every blur radius r is a Gaussian with a standard deviation of r / 3: the outer and inner shadow's `blurRad`, `a:blur`
  and the reflection's blur (`feGaussianBlur stdDeviation = r / 3`; the edge of a blurred shape is half covered).
- A glow grows the outline by 0.45 r with a round pen and blurs it by 0.165 r, behind the shape.
- A soft edge shrinks the outline by 0.91 r and blurs that by r / 3, and the shape is drawn through it: the shape fades to
  nothing at its own edge, and a large radius shrinks a small shape away.
- An inner shadow lies along the edges the angle points at (45 degrees shades the bottom and right edges): the outside of
  the shape moved by the distance against the angle, blurred and clipped to the shape.
- The order: inner shadow, soft edge and blur on the shape's fill and outline; the glow around that result; the shape's
  text on top, untouched by those four; the outer shadow cast by all of it (so the shadow is grown by a glow and softened
  by a soft edge, and a shape without fill casts its text's shadow); the reflection mirrors all of it, shadow and glow
  included, about the shape's bottom edge, fading linearly over `size` of the shape's height.
- A shadow follows the drawn alpha, not the bounding box: an ellipse casts an ellipse, an outline without fill casts an
  outline, and a half transparent fill casts a half transparent shadow.

SVG's `feMorphology` grows with a square pen, which would square a glow's corners and pinch an ellipse's soft edge; the
preview grows and shrinks with the union of a square pen and a blur cut at the level a straight edge reaches at that
distance, which is close to PowerPoint's round pen (the factors were tuned on rectangles, ellipses and rounded outlines).

Remaining differences, measured as the mean absolute difference per channel (0 to 255) between the preview and
PowerPoint on 36 test shapes at 2560 x 1440, all under 3 and most under 1.5: a glow of a large radius is slightly rounder at
a rectangle's corners than PowerPoint's; the soft edge of an ellipse is a little narrower at its ends; PowerPoint draws a
blurred shape with a slight slant on its right edge that the preview does not copy. The browser (Chromium) and resvg (PNG)
previews agree with each other to the same degree. The PDF export draws a shape with effects as a picture of that shape
(its vector writer does not draw SVG filters).

## Excluded on purpose

`a:prstShdw` (the three `shadow` presets cover it), `a:fillOverlay`, `a:effectDag`, 3-D (`a:scene3d`, `a:sp3d`; the preview
cannot match PowerPoint). PPTX import (SH-05) reports them as findings.
