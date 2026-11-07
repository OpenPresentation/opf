# OPF shapes: design (owner-approved 2026-11-05)

Owner decisions: every property below is in scope now (no "later"); the picture `border` key is renamed `stroke` (pre-1.0: no alias, no deprecation). Items marked "excluded" stay out on purpose; say so in docs.

Principles:
- Preset names are DrawingML's own (ECMA-376 `ST_ShapeType`, 187 presets, e.g. `rightArrow`, `chevron`, `wedgeRectCallout`, `flowChartDecision`), as OPF already does for pattern presets.
- One geometry definition drives both engines: the preview evaluates the preset (guides, adjust values, paths, text rectangle, connection sites) to SVG; PPTX export writes the native `a:prstGeom` with its `a:avLst`, so PowerPoint draws its own shape and the two match.
- OPF units: widths in reference pixels at a 720-pixel short edge; fractions 0 to 1; degrees. Never EMU or 60000ths in the format.
- Colors are `ColorRef` (hex with optional alpha, scheme slots, roles, `var:`), extended everywhere with `{ "color": <ColorRef>, "lighten": 0..1 }` and `{ "color": <ColorRef>, "darken": 0..1 }` (exported as `a:lumMod`/`a:lumOff`, PowerPoint's "Lighter 40%").
- Text inside a shape obeys OPF composition: it fits by OPF's measured fonts under the never-shrink rule; PowerPoint autofit is never written.
- Theme first: a shape with no fill, stroke or effects takes `style` (default from the theme) so it fits the deck.

## Property map

| What | OPF | PowerPoint (DrawingML) |
| --- | --- | --- |
| Preset shape | `shape: "chevron"` (a content kind: a shape block) | `a:prstGeom prst` |
| Adjust handles | `adjust: { "adj1": 0.25 }` (fractions; names as DrawingML's guides) | `a:avLst/a:gd` |
| Custom outline | `path` (SVG path data in a 0 to 1 box, or with a viewBox) | `a:custGeom` |
| No fill | `fill: "none"` | `a:noFill` |
| Solid fill | `fill: <ColorRef>` | `a:solidFill` |
| Opacity | `opacity` 0 to 1 (fill), or 8-digit hex | `a:alpha` |
| Gradient (linear, radial, rectangle, shape) | `fill: { gradient: { type, angle, stops: [{color, position}] } }` (the background gradient object, extended with `type`) | `a:gradFill` (`a:lin`, `a:path path="circle/rect/shape"`) |
| Pattern | `fill: { pattern: { preset, foregroundColor, backgroundColor } }` (the background pattern object) | `a:pattFill` |
| Picture inside a shape | an image block's `shape` takes every preset (the mask grows from 4 values to all 187; rectangle/rounded/circle/hexagon become rect/roundRect/ellipse/hexagon) | `a:blipFill` in `a:prstGeom` |
| Fill rotates with shape | always on (no key) | `rotWithShape="1"` |
| Lighter or darker theme color | `{ color, lighten }` / `{ color, darken }` on any ColorRef | `a:lumMod`/`a:lumOff` |
| Stroke | `stroke` (shapes and pictures; picture `border` renamed) | `a:ln` |
| Stroke color | `stroke.color` (ColorRef) or `stroke.gradient` | `a:ln/a:solidFill`, `a:ln/a:gradFill` |
| Stroke width | `stroke.width` | `a:ln w` |
| Dash | `stroke.dash`: solid, dot, dash, longDash, dashDot, longDashDot, longDashDotDot, sysDot, sysDash, sysDashDot, sysDashDotDot; or an array such as `[4, 2]` (custom, in stroke widths) | `a:prstDash`, `a:custDash` |
| Cap | `stroke.cap`: flat, round, square | `a:ln cap` |
| Join | `stroke.join`: miter, round, bevel; `stroke.miterLimit` | `a:miter lim`, `a:round`, `a:bevel` |
| Compound | `stroke.compound`: single, double, thickThin, thinThick, triple | `a:ln cmpd` |
| Alignment | `stroke.align`: center, inside | `a:ln algn` |
| Arrowheads | `stroke.start`, `stroke.end`: `{ type: none/triangle/stealth/diamond/oval/arrow, width: small/medium/large, length: small/medium/large }` | `a:headEnd`, `a:tailEnd` |
| Hand-drawn | `stroke.sketch`: curved, freehand, scribble | `ask:lineSketchStyleProps` (in `a:ext`) |
| Theme style | `style`: none, subtle, moderate, intense | `p:style` (`a:lnRef`, `a:fillRef`, `a:effectRef`, `a:fontRef`) |
| Outer shadow | `shadow`: a preset name (soft, hard, perspective) or `{ color, opacity, blur, distance, angle, size }` | `a:outerShdw` |
| Inner shadow | `innerShadow`: `{ color, opacity, blur, distance, angle }` | `a:innerShdw` |
| Glow | `glow`: `{ color, opacity, radius }` | `a:glow` |
| Soft edges | `softEdge`: radius | `a:softEdge` |
| Reflection | `reflection`: `{ opacity, size, distance, blur }` | `a:reflection` |
| Blur | `blur`: radius | `a:blur` |
| Rotation | `rotate` (degrees) | `a:xfrm rot` |
| Flip | `flip`: horizontal, vertical, both | `flipH`, `flipV` |
| Overlay placement | slide-level `shapes: [...]` drawn over the composed slide, each placed by `x, y, width, height` (fractions of the slide) or attached to a block (`at: { block: <id>, edge, offset }`) | `a:xfrm a:off a:ext` |
| Stacking | array order (no key) | shape tree order |
| Text | `text` (OPF rich text) | `p:txBody` |
| Vertical anchor | `anchor`: top, middle, bottom | `a:bodyPr anchor` |
| Margins | `padding` | `lIns`, `tIns`, `rIns`, `bIns` |
| Vertical text | `textDirection`: horizontal, vertical, vertical270, stacked | `a:bodyPr vert` |
| Alt text | `alt` | `p:cNvPr descr` |
| Decorative | `decorative: true` | `a16:decorative` |
| Name | from the block `id` | `p:cNvPr name` |
| Hidden | `hidden: true` | `p:cNvPr hidden` |
| Click link | `link` | `a:hlinkClick` |
| Connector | `connector: { from: <id>, to: <id>, route: straight/elbow/curved, stroke }` (slide-level, among `shapes`) | `p:cxnSp`, `a:stCxn`, `a:endCxn` |
| Connection site | chosen automatically (the nearest facing site); `fromSite`/`toSite` index to override | `idx` |

Excluded on purpose (say so in docs): 3-D (`a:scene3d`, `a:sp3d`; the preview cannot match PowerPoint), preset shadow (`a:prstShdw`, covered by `shadow` presets), fill overlay, wrap/columns/autofit (OPF fits text itself), alternative text title, hover links, locks, black-and-white mode, custom data. Import reports them as findings.

## Phases

Phase 1 (parallel): SH-01 geometry engine; SH-02 the shape block, the format vocabulary and both engines; SH-03 effects in both engines.

Phase 2 (after phase 1 merges): SH-04 overlay shapes and connectors, and native Mermaid diagrams (nodes as presets, edges as connectors); SH-05 PPTX import of shapes; SH-06 editor (shape picker, adjust handles, every property) and MCP `search_shapes`, skills.
