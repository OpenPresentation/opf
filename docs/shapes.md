# Shapes

A shape block draws one of PowerPoint's 187 preset shapes, or an outline of your own, with a fill, a line and optional text inside. Both engines draw the same thing from one definition: the preview evaluates the preset's DrawingML geometry to SVG, and the PPTX export writes the native preset (`a:prstGeom` with its adjust values), so PowerPoint draws its own shape and the two match. The same stroke vocabulary is a picture's line, and every preset is a picture mask.

```json
{
  "title": "How we ship",
  "blocks": [
    { "shape": "chevron", "text": "Plan" },
    { "shape": "chevron", "text": "Build", "fill": { "color": "accent1", "lighten": 0.4 } },
    { "shape": "chevron", "text": "Ship", "style": "intense" }
  ]
}
```

The full reference deck is [`examples/technical/shapes.opf.json`](../examples/technical/shapes.opf.json): one slide per group of properties.

This page covers [shape blocks](#a-shape-block) and their properties, [overlay shapes and connectors](#overlay-shapes-and-connectors) drawn over a composed slide, [importing shapes](#importing-shapes-from-powerpoint) from PowerPoint, [editing shapes](#editing-shapes) in the editor, and [native diagrams](#native-diagrams), Mermaid diagrams written as PowerPoint shapes; then validation, loading in browsers, the preset geometry and the property map.

## A shape block

A block with `shape` and no `image`, or with a custom `path`, is a shape block (`type: "shape"`). It composes like any other block: automatic composition and layout regions give it a cell, and the shape takes the largest frame of its own proportions centered in that cell (the region's anchor places it vertically). The proportions are the block's `aspectRatio`, else the preset's: 1:1 for the round and regular shapes (`ellipse`, `star5`, `hexagon`, `heart`, the flowchart connectors), 2:1 for horizontal arrows and bands (`rightArrow`, `chevron`, `ribbon`, `wave`), 1:2 for vertical ones (`upArrow`, `can`, `leftBrace`) and 3:2 otherwise (`rect`, `roundRect`, the callouts and most flowchart shapes). A layout region that takes pictures (`image`) also takes shapes; a region can name `shape` in `accepts` too.

A shape draws its own fill and outline, so it is never drawn on a card. `composeSlide` reports it as an item with `field: "shape"` and `ComposedItem.shape`: the frame, the evaluated paths in slide coordinates, the text rectangle, the effective fill, stroke and text color, and the effects.

### Text inside

`text` (a string or rich text runs) is drawn inside the preset's text rectangle (each preset defines one: a chevron's is its middle, an ellipse's the square inscribed in it), less `padding`. It is fitted by OPF's measured fonts, as body text is: from the body size down to the composition's `minFontSize` and never below it. Text that does not fit at that size overflows and is reported as `opf/text-overflow` at `<block>/text`; give the shape more room (a larger cell or another `aspectRatio`), shorten the text or lower its padding. PowerPoint's autofit is never written: PowerPoint draws the size OPF chose.

| Property | Meaning | PowerPoint |
|---|---|---|
| `anchor` | `top`, `middle` (default) or `bottom`: where the text sits in its rectangle. | `a:bodyPr anchor` |
| `padding` | Insets in reference pixels: one number, or `{ top, right, bottom, left }`. Default 9.6 left and right, 4.8 top and bottom (PowerPoint's 0.1 and 0.05 inch). | `lIns`, `tIns`, `rIns`, `bIns` |
| `textDirection` | `horizontal` (default), `vertical` (turned 90 degrees clockwise), `vertical270`, or `stacked` (one letter under another). | `a:bodyPr vert` (`horz`, `vert`, `vert270`, `wordArtVert`) |

The text is centered. Its color is the style's text color (light on the default style's accent fill) where that reads at 4.5:1 on the fill the shape draws, else black or white (LH-151; the fill's color, a gradient's middle stop or a pattern's background). A run's own `color` wins.

## Presets

`shape` takes DrawingML's own preset names (ECMA-376 `ST_ShapeType`), as PowerPoint writes them: `rect`, `roundRect`, `ellipse`, `triangle`, `rightArrow`, `chevron`, `wedgeRectCallout`, `flowChartDecision` and the rest. The [preset table](#preset-table) lists all 187 with their default frames and adjust values. A name that is not a preset is an `opf/schema` error with the nearest names as fixes.

### Adjust values

`adjust` sets the preset's adjust handles (the yellow handles in PowerPoint), named as DrawingML's guides: `adj`, or `adj1`, `adj2` and so on. Values are OPF units, never DrawingML's 100000ths or 60000ths: a fraction for the values DrawingML writes in 100000ths (most often a share of the shape's shorter side) and degrees for the angle handles of `arc`, `blockArc`, `chord`, `pie`, the circular arrows and `mathNotEqual`.

```json
{ "shape": "roundRect", "adjust": { "adj": 0.3 } }
{ "shape": "rightArrow", "adjust": { "adj1": 0.6, "adj2": 0.35 } }
{ "shape": "pie", "adjust": { "adj1": 0, "adj2": 270 } }
```

A name the preset does not have is `opf/shape-adjust-unknown`, and a value outside its handle's range `opf/shape-adjust-range` (both warnings); the preset's default is drawn. On an image block, `adjust` shapes the mask: a `roundRect` frame's corner is `{ "adj": 0.05 }`.

### Custom outlines

`path` draws an outline of your own (`a:custGeom` in PowerPoint): SVG path data in a 0 to 1 box (`"M0 0 L1 0 L0.5 1 Z"`, stretched to the frame), or `{ "d": ..., "viewBox": "0 0 24 24" }` for a path drawn on its own grid, such as an icon. Every SVG command is accepted (M, L, H, V, C, S, Q, T, A, Z, absolute or relative). A subpath that does not end with Z is open: it takes arrowheads at its ends. A custom path's text rectangle is the whole frame.

## Fill

| `fill` | Meaning | PowerPoint |
|---|---|---|
| `"none"` | No fill. | `a:noFill` |
| a ColorRef | A solid fill: hex (eight-digit hex keeps its alpha), a scheme slot or role, `var:<id>`, or a [lighter or darker color](#lighter-and-darker-colors). | `a:solidFill` |
| `{ "gradient": { "type", "angle", "stops" } }` | `linear` along `angle` (degrees, 0 left to right, 90 top to bottom), or `radial`, `rectangle` and `shape` from the center outwards. `stops` are `{ color, position }`, at least two. | `a:gradFill` with `a:lin` or `a:path circle`, `rect`, `shape` |
| `{ "pattern": { "preset", "foregroundColor", "backgroundColor" } }` | A two-color pattern; `preset` is DrawingML's (`pct20`, `ltUpDiag`, `smGrid`, `dotDmnd`). | `a:pattFill` |

`opacity` (0 to 1) is the fill's opacity, multiplied with an eight-digit hex alpha; the line and text keep theirs. Without a fill the shape takes its [style](#style)'s. Fills rotate with the shape (`rotWithShape`).

A shape's path may shade its fill: DrawingML presets such as `can`, `cube`, `bevel`, `foldedCorner` and `smileyFace` draw parts of their fill lighter or darker (`lighten`, `lightenLess`, `darken`, `darkenLess`). Both engines draw them, the preview as PowerPoint's 60% and 80% tints and shades of the fill.

Both engines draw every gradient as PowerPoint 365 does (measured on its export of all 187 presets):

- A gradient spans the bounds of the shape's filled paths: the frame for most presets, the drawn quarter for `arc`, the upper half for `blockArc`.
- `radial` is a circle from the center of those bounds through their corners, whatever their proportions.
- `rectangle` is concentric rectangles: the bounds scaled about their center.
- `shape` follows the outline: its contours are the outline scaled about the center of the bounds (on each ray from the center, the outline's farthest point). Each filled part of a preset follows its own outline, except the action buttons, `bevel` and `cube`, whose parts follow the whole shape's outline. PowerPoint draws the `shape` gradient of 64 presets (the arrows, ribbons, scrolls, braces, waves and the like) and of every custom `path` as its circle gradient instead, and so does the preview.
- Colors mix as PowerPoint mixes them: a gradient of exactly two stops at 0 and 1 is eased and mixed in linear light; any other set of stops is mixed straight between neighboring stops.

The preview draws a `rectangle` or `shape` gradient as a fan of triangles from the center, each a linear gradient across it to its edge, clipped to the path. Measured against PowerPoint's own picture of the same PPTX, the mean difference per color channel is 2.6 levels of 255 at the median preset and at most 5 for 179 of the 187; the largest are the tiny `cornerTabs` (11) and `star4` (7).

## Stroke

`stroke` is the line along the outline (`a:ln`): `"none"`, or an object. On a shape without one the style's line is drawn; `"none"` removes it.

| Property | Meaning | PowerPoint |
|---|---|---|
| `color` | Any ColorRef. Default the style's line color. | `a:solidFill` |
| `gradient` | A gradient line instead of a color (the fill's gradient object). | `a:gradFill` |
| `width` | Reference pixels, 0 to 64; 0 removes the line. Default 4/3 (1 point) on a shape, 2 on a picture. | `w` |
| `dash` | `solid`, `dot`, `dash`, `longDash`, `dashDot`, `longDashDot`, `longDashDotDot`, `sysDot`, `sysDash`, `sysDashDot`, `sysDashDotDot`, or an array of dash and gap lengths in line widths (`[4, 2]`). | `a:prstDash` (`lgDash` for `longDash`), `a:custDash` |
| `cap` | `flat` (default), `round`, `square`. | `cap` |
| `join` | `miter` (default, as PowerPoint's default line), `round`, `bevel`; `miterLimit` (default 8). | `a:miter lim`, `a:round`, `a:bevel` |
| `compound` | `single`, `double`, `thickThin`, `thinThick`, `triple`. | `cmpd` |
| `align` | `center` (default) or `inside` (closed outlines only, as in PowerPoint). | `algn` |
| `start`, `end` | Arrowheads on an open path: `{ type, width, length }`, `type` `triangle` (default), `stealth`, `diamond`, `oval` or `arrow`, sizes `small`, `medium` (default), `large`. | `a:headEnd`, `a:tailEnd` |
| `sketch` | `curved`, `freehand` or `scribble`: PowerPoint's Sketched line. | `ask:lineSketchStyleProps` |

The preview draws every property. Arrowheads are drawn at 2, 3 or 5 line widths and the line stops under a triangle or stealth head, as PowerPoint draws them. A sketched line is drawn the same in both engines. PowerPoint does not compute a sketch when it opens a file: it draws the outline stored in `ask:lineSketchStyleProps` (an `a:custGeom`), and fills a sketched shape within that outline. OPF computes that outline itself, deterministically from the seed it writes as `sd` (from the style, the frame's size and the outline, so a moved shape keeps its line), and the preview strokes and fills the same outline, so PowerPoint's picture of the PPTX matches the preview (0.7 to 0.8 levels of 255 mean difference on the sketch evidence slides). The wobble is OPF's own, made to look like PowerPoint's three styles: `curved` bows each side gently, `freehand` wavers along it, `scribble` draws a freehand pass and a second pass of strokes that run past the corners. It is not PowerPoint's own randomization. When PowerPoint 365 (16.0.20527) saves the file again, it keeps the sketched outline as the shape's own custom geometry and drops the sketch style (observed through its object model, resized or not), so the shape still looks the same. PowerPoint versions before 2021 draw the plain line.

## Style

`style` is the theme shape style, as PowerPoint's Shape Styles gallery: it decides everything the shape does not set itself. The default is `moderate`, so a bare `{ "shape": "rect" }` looks like a new PowerPoint shape and follows the theme.

| `style` | Fill | Line | Text | PowerPoint |
|---|---|---|---|---|
| `none` | none | none | the slide's text color | no `p:style` |
| `subtle` | accent1 80% lighter | 1 pt accent1 | dark | `lnRef 2`, `fillRef 1` |
| `moderate` (default) | accent1 | 1 pt accent1 50% darker | light | `lnRef 2` (shade), `fillRef 1` |
| `intense` | accent1 25% darker | none | light, bold | `lnRef 0`, `fillRef 1`, `effectRef 2`, with the soft shadow |

An explicit `fill`, `stroke` or effect wins over the style's. The export writes the style's references (`p:style`: `a:lnRef`, `a:fillRef`, `a:effectRef`, `a:fontRef`), so PowerPoint shows the style as applied, and writes the drawn fill and line explicitly, so the shape looks the same whatever the theme's format scheme.

## Lighter and darker colors

Every ColorRef (fills, strokes, gradient stops, pattern colors, overlays, recolors, backgrounds, chart and table colors, and text runs) also takes a lighter or darker form, PowerPoint's "Lighter 40%" and "Darker 25%":

```json
{ "color": "accent1", "lighten": 0.4 }
{ "color": "#0F4C81", "darken": 0.25 }
```

`lighten` moves the color's HSL luminance that share of the way to white, `darken` that share of the way to black. Core resolves it (`resolveColorRef`); the export writes the base color with `a:lumMod` and `a:lumOff` (lighten L: `lumMod` 1 - L and `lumOff` L; darken D: `lumMod` 1 - D), as a theme color where the base is one, so re-theming the deck keeps the tint.

## Rotation, flip and stacking

| Property | Meaning | PowerPoint |
|---|---|---|
| `rotate` | Degrees clockwise about the frame's center. Composition keeps the unrotated frame; a rotated outline may reach past its cell. | `a:xfrm rot` |
| `flip` | `horizontal`, `vertical` or `both`: mirrors the geometry. The text is not mirrored; a vertical flip turns it upside down, as in PowerPoint. | `flipH`, `flipV` |

Shapes stack in the order the blocks compose (the shape tree order in PowerPoint); [overlay shapes and connectors](#overlay-shapes-and-connectors) stack over everything, in the order of the slide's `shapes`.

## Accessibility and links

| Property | Meaning | PowerPoint |
|---|---|---|
| `alt` | Alternative text. Without it, a shape's text is what is read. | `p:cNvPr descr` |
| `decorative` | `true`: screen readers skip the shape. | the decorative extension (`adec:decorative`, "Mark as decorative") |
| `hidden` | `true`: kept in the file but not drawn; it keeps its room. | `p:cNvPr hidden` |
| `link` | An http(s), `mailto:` or `tel:` URL opened when the shape is clicked in a slide show. A link on a hidden shape is `opf/shape-link-hidden`. | `a:hlinkClick` |

The shape's name in PowerPoint is `OPF shape <path>`, from the block's place in the deck.

## Effects

`shadow` (a preset `soft`, `hard` or `perspective`, or `{ color, opacity, blur, distance, angle, size }`), `innerShadow`, `glow` (`{ color, opacity, radius }`), `softEdge` (a radius), `reflection` (`{ opacity, size, distance, blur }`) and `blur` (a radius) are part of the format; lengths are reference pixels and angles degrees. Both engines draw them: the export writes `a:effectLst` in the shape's `p:spPr` right after its line, and the preview draws SVG filters around the outline and its text (the outer shadow and the reflection include the text, as PowerPoint's do). Colors are ColorRefs, `{ color, lighten }` and `{ color, darken }` included; lengths scale with the slide's shorter side. See [shape effects](shape-effects.md) for the defaults, the presets and how each effect is measured against PowerPoint, and `examples/technical/shape-effects.opf.json` for every effect on shape blocks. The `intense` style adds the `soft` shadow unless the block sets its own.

## Pictures

An image block's line is `stroke` (renamed from `border` in 0.33, with no alias) and takes every stroke property above. Its `shape` takes every preset (`rectangle`, `rounded` and `circle` became `rect`, `roundRect` and `ellipse`), and `adjust` replaces `cornerRadius`. See [image treatments](image-treatments.md).

## Overlay shapes and connectors

A slide's `shapes` array is drawn over the composed slide: above the content, the furniture and everything else, in array order (later entries on top); an overlay shape with `layer: "back"` is drawn behind the content instead (see [layers](#layers)). It never moves content: composition places the slide first and the overlay on the result. Use it for what sits on top of a layout: a callout pointing at a figure, a badge on a picture, a stamp in a corner, and connector lines between blocks.

```json
{
  "title": "How we ship",
  "blocks": [
    { "id": "plan", "shape": "roundRect", "text": "Plan" },
    { "id": "ship", "shape": "roundRect", "text": "Ship" }
  ],
  "shapes": [
    { "shape": "wedgeRectCallout", "text": "New this quarter", "x": 0.68, "y": 0.06, "width": 0.24, "height": 0.12, "style": "subtle" },
    { "shape": "ellipse", "text": "1", "at": { "block": "plan", "edge": "top", "offset": -24 } },
    { "connector": { "from": "plan", "to": "ship", "route": "elbow" }, "stroke": { "width": 2, "end": { "type": "triangle" } } }
  ]
}
```

The reference decks are [`examples/technical/shape-overlays.opf.json`](../examples/technical/shape-overlays.opf.json) and its right-to-left slide [`shape-overlays-rtl.opf.json`](../examples/technical/shape-overlays-rtl.opf.json).

### Overlay shapes

An entry without `connector` is an overlay shape. It has the whole [shape block](#a-shape-block) vocabulary: `shape` or `path`, `adjust`, `fill`, `opacity`, `stroke`, `style`, the [effects](#effects), `rotate`, `flip`, `text` with `anchor`, `padding` and `textDirection`, `alt`, `decorative`, `hidden` and `link`, plus an optional `id` (a connector names it). Its text is fitted as a shape block's is, by OPF's measured fonts, never below the readability floor (`opf/text-overflow` at `slides.N.shapes.I.text` otherwise). It has exactly one placement:

| Placement | Meaning |
| --- | --- |
| `x`, `y`, `width`, `height` | Fractions 0 to 1 of the slide, from its top-left corner. In a right-to-left deck `x` counts from the right edge, as OPF mirrors start and end. All four go together. |
| `at: { block, edge, offset, width, height }` | Against the composed box of the block with that `id` (a payload or a group, at any depth), so the shape follows the block wherever composition puts it. `edge` is `top`, `bottom`, `start` or `end` (outside that edge, centered along it; `start` is the left in a left-to-right deck and the right in a right-to-left one) or `center` (on the block's center). `offset` is the gap in reference pixels (negative overlaps the block). `width` and `height` up to 1 are fractions of the block's width and height, above 1 reference pixels; by default the shape has its preset's proportions with its shorter side at 15% of the block's shorter side. |

A picture's box is its frame; a block on a card is its card. A shape with both placements or none is an `opf/schema` error, and one whose `at.block` is not on the slide is `opf/shape-anchor-missing`; neither is drawn.

The PPTX export writes an overlay shape as a shape block, a native `p:sp` named `OPF shape slides.N.shapes.I`.

### Layers

`layer` puts an overlay shape in front of the slide (the default) or behind it:

| `layer` | Drawn | PowerPoint |
| --- | --- | --- |
| `front` | Over the slide: after its content and furniture. | After every other shape of the slide in the shape tree. |
| `back` | Behind the slide: above the background, the watermark and the deck logo, below the content and the furniture (a panel or a band behind a block). | After the background, watermark and logo and before the content shapes in the shape tree. |

Array order stacks the shapes within each layer. Connectors are always in front, also when an end is a back-layer shape: the connector is glued to it and drawn over the content between them. Mark a back panel `decorative` when it carries no meaning.

### Connectors

An entry with `connector` is a connector line between two blocks or overlay shapes of the slide:

| Key | Meaning |
| --- | --- |
| `connector.from`, `connector.to` | The `id` of a block (a payload or a group) or an overlay shape. An id that names nothing on the slide, or names a connector, is `opf/connector-end-missing`, and the connector is not drawn. |
| `connector.route` | `straight` (default), `elbow` or `curved`. |
| `connector.fromSite`, `connector.toSite` | The connection site index at each end, instead of the automatic choice. An index the shape does not have is an `opf/schema` error. |
| `stroke` | The line, with every [stroke](#stroke) property: color, width, dash, compound, sketch and arrowheads (`start` at `from`, `end` at `to`). Default a 2-pixel line in the slide's text color with no arrowheads. |
| `adjust` | The connector preset's adjust values in OPF units: `adj1` of an elbow or a curve between sites on one axis (`bentConnector3`, `curvedConnector3`), the middle line as a fraction of the frame's width (0.5 halfway; below 0 or above 1 runs past a site). It replaces the automatic middle, so a route drawn in PowerPoint is kept exactly; the sites are still chosen as below. The two-segment routes and a straight line have none. A name the route's preset does not have is `opf/shape-adjust-unknown`. |
| `alt`, `decorative`, `hidden`, `id` | As on a shape. A connector takes no other key. |

**Connection sites.** Each end attaches to a connection site of its shape: a preset's own sites (`presetGeometry(...).connectionSites`, turned and flipped with the shape; a picture masked by a preset has its mask's) or, for every other block, the four edge midpoints of its box, numbered as DrawingML numbers a rectangle's: 0 top, 1 left, 2 bottom, 3 right. Without `fromSite` and `toSite` core chooses the pair of sites that face each other (opposite directions) whose route leaves each site outward and is shortest; then any route that leaves both outward; then the shortest. An elbow or curve considers only the sites along an axis (directions of 0, 90, 180 or 270 degrees) when the shape has some.

**Routes.** Core routes each connector once, as PowerPoint's own connector presets, and both engines draw that route: the preview strokes the preset's path evaluated in the connector's frame, and the PPTX writes the same preset in the same frame, so PowerPoint draws the same line.

| `route` | Sites | Preset | The route |
| --- | --- | --- | --- |
| `straight` | any | `straightConnector1` | One segment from site to site. |
| `elbow` | on one axis (both horizontal or both vertical) | `bentConnector3` | Out of the first site, along the middle line, into the second. Facing sites put the middle halfway (`adj1` 0.5); sites that face the same way run 24 reference pixels past the farther one and back (a U, `adj1` beyond 0 to 1). |
| `elbow` | perpendicular | `bentConnector2` | An L through the corner. |
| `curved` | on one axis | `curvedConnector3` | The curve through the elbow's middle line, tangent to both sites' axes. |
| `curved` | perpendicular | `curvedConnector2` | One curve tangent to both sites' axes. |

The frame is PowerPoint's: the box of the two sites (`a:off`, `a:ext`), flipped for a route that runs left or up, and turned 90 or 270 degrees for one that leaves its first site vertically, as PowerPoint writes its connectors.

**PowerPoint.** The export writes a connector as a native `p:cxnSp` named `OPF connector slides.N.shapes.I`, with `a:prstGeom`, core's `a:avLst` and the line, and glues each end to the native shape it attaches to (`a:stCxn` and `a:endCxn`: the shape's id and the site index). PowerPoint then reads the connector as connected (`ConnectorFormat.BeginConnectedShape`, `EndConnectedShape` and the site indexes, 1-based in its object model) and moves it with a shape that the user moves. An end glues where one native shape is the block: a shape block or overlay shape, a picture, or a block drawn on a card. A text block without a card is drawn as one text box per line, so its end is not glued: the connector still runs to the block's site but stays put when the line boxes move. Give the text a card, or write it as a shape with text, to glue to it.

| PowerPoint and the SH-04 check | Result |
| --- | --- |
| Connectors of `shape-overlays.opf.json` and `shape-overlays-rtl.opf.json`, read through PowerPoint's object model (PowerPoint 365) | Every glued end reads as connected to its shape at core's site (1-based), and moving the shape at the end moves the connector with it. |

### Pagination

When `paginate` splits a slide over pages, a shape placed by fractions is on every page (as the headings are), a shape placed `at` a block is on the page its block lands on, and a connector is on the page that holds both of its ends. A connector whose ends land on different pages is on none, and the page of its `from` end reports it in `PaginatedPage.diagnostics` as `connector-split` (with the connector's path). Overlay ids take their page's id (`stamp--2`) like payload ids, and `at.block` and the connector ends follow the ids they name.

### In core

`composeSlide` returns the overlay as `SlideComposition.overlayShapes`, in draw order: overlay shapes (`kind: "shape"`, a shape block item: `path` `slides.N.shapes.I`, `box`, `shape` (a `ComposedShape`), `text`, `textStyle`, `layer`, and `attachedTo` for an `at` shape) and connectors (`kind: "connector"`: `route`, `preset`, the frame `box`, `rotate`, `flipH`, `flipV`, `adjust` and `avLst`, `paths` (the route in slide coordinates, one open path with its ends for the arrowheads), `bounds`, `stroke`, and `from` and `to`, each with the `id`, the `ref` it attaches to (a composed item path, a group path or an overlay path), `target`, `site`, `point` and `angle`). `connectorRoute`, `chooseConnectorSites`, `shapeSites` and `rectSites` from `@openpresentation/opf/composition` give the same geometry to a host or an editor.

## Importing shapes from PowerPoint

`fromPptx` (and `opf convert deck.pptx deck.opf.json`) reads native shapes as OPF shapes. Two kinds of file arrive: a deck this export wrote, whose shapes come back as the OPF they were, and a deck PowerPoint wrote, whose shapes become overlay shapes and connectors.

### A deck the export wrote

The native name says what a shape was: `OPF shape slides.N.blocks.I.shape` is a shape block and `OPF shape slides.N.shapes.I` an overlay shape (I is its entry in `slide.shapes`); `OPF connector slides.N.shapes.I` is a connector. Every property the export writes is read back from the DrawingML, so a shape block returns with its preset and `adjust`, its `path`, `fill`, `opacity`, `stroke`, `style`, effects, `rotate`, `flip`, text, `anchor`, `padding`, `textDirection`, `alt`, `decorative`, `hidden` and `link`; a lighter or darker theme color returns as `{ color, lighten }` or `{ color, darken }`; a picture's `stroke` returns with the picture. The slide's stored record (`OPF_SLIDE_V1`) puts the block back in its place and adds what no native shape can carry, while the slide is as it was exported:

- the block ids and the content structure (as for every block);
- an overlay entry's `id` (a connector names its ends by it) and its `at` anchor against a block (the native shape holds only the frame composition gave it);
- which of a connector's `fromSite` and `toSite` the author wrote (the pair that faces each other is chosen when neither is).

A slide edited in PowerPoint keeps what PowerPoint now shows: fractions for an overlay shape, and the sites it names. A value the theme style gives (an explicit `fill: "accent1"` on the default style) comes back absent, since the export writes it out and PowerPoint cannot tell it from a choice; the shape draws the same. Likewise a rotation of -20 comes back as 340, and a custom `path` comes back as path data in the 0 to 1 box (the outline is the same).

### A deck PowerPoint wrote

- A free-positioned shape that draws something (a fill, a line or an effect, or any shape that is not a plain rectangle) with preset or custom geometry becomes an **overlay shape**: `x`, `y`, `width` and `height` are fractions of the slide (from the right edge in a right-to-left deck, as everywhere in OPF), with the preset and its `adjust`, a custom `a:custGeom` as `path`, and every property in the table below. Its z order is the array order.
- A shape PowerPoint added with its default style (`p:style` with a theme line and fill) is OPF's default style, `moderate`, with nothing else stated. Another `p:style` is read as the fill and line its references give, with `style: "none"`.
- A **connector** (`p:cxnSp`) whose two ends are connected to shapes OPF knows is a `connector` between their ids, with its route from the preset (`straightConnector1` straight, `bentConnector2` and `3` elbow, `curvedConnector2` and `3` curved), its sites from `a:stCxn` and `a:endCxn`, and, for a three-segment preset, the middle PowerPoint drew as `adjust.adj1` (a connector the export wrote states none, as it recomputes it). A longer route (`bentConnector4`, `bentConnector5`, `curvedConnector4`, `curvedConnector5`) is beyond OPF's connector: it stays a shape with its preset and `adjust` values, which draws it as it was, without the binding. A shape that is a connector's end gets an `id` made from its name (`box-a` for "Box A") where it has none. A connector with a free end is a line shape: the preset (`straightConnector1`, `bentConnector3` and so on) in its frame, with its arrowheads.
- Shapes inside a **group** are flattened with the group's scale, flips and rotation applied.
- A text box, a placeholder, and a rectangle with text that draws no fill, line or effect keep the text import (`text` blocks), as before.
- A filled shape across the whole slide is a background, not an overlay (an overlay is drawn over the content): it is not imported and is reported as `shape-not-imported`.

| DrawingML | OPF |
| --- | --- |
| `a:prstGeom prst` and `a:avLst` | `shape` and `adjust` (fractions and degrees, the values equal to the preset's defaults left out) |
| `a:custGeom` (points, guides, `a:arcTo`) | `path`, in the 0 to 1 box (arcs become cubic Béziers) |
| `a:noFill`, `a:solidFill`, `a:gradFill`, `a:pattFill` | `fill: "none"`, a ColorRef, `{ gradient }`, `{ pattern }`; a uniform transparency is `opacity` |
| `a:schemeClr` (through the color map), `a:srgbClr`, `a:lumMod` and `a:lumOff` | a scheme slot name, a hex color, `{ color, lighten }` or `{ color, darken }` |
| `a:ln` (`w`, `cap`, `cmpd`, `algn`, dashes, joins, `a:headEnd`, `a:tailEnd`, the sketch) | `stroke` (`"none"` for `a:noFill`) |
| `p:style` (`lnRef`, `fillRef`, `effectRef`) | `style` |
| `a:effectLst` (`a:outerShdw`, `a:innerShdw`, `a:glow`, `a:softEdge`, `a:reflection`, `a:blur`) | `shadow` (a preset name where it equals one), `innerShadow`, `glow`, `softEdge`, `reflection`, `blur`, in reference pixels |
| `a:xfrm` (`rot`, `flipH`, `flipV`) | `rotate`, `flip` |
| `a:bodyPr` (`anchor`, insets, `vert`) and the runs | `anchor`, `padding`, `textDirection`, `text` (emphasis, links and run colors; sizes and faces are the composition's) |
| `p:cNvPr` (`descr`, the decorative extension, `hidden`, `a:hlinkClick`) | `alt`, `decorative`, `hidden`, `link` |

### What is dropped

Each of these is reported as a finding and dropped; the shape itself imports. The library's diagnostic is `shape-property-dropped` (`import/shape-property-dropped` in an `opf convert` report) with `property` naming it, and `shape` the native shape's name.

| `property` | Native source | Why |
| --- | --- | --- |
| `3-D format` | `a:scene3d`, `a:sp3d` | The preview cannot match PowerPoint's 3-D. |
| `preset shadow` | `a:prstShdw` | The `shadow` presets cover it. |
| `fill overlay` | `a:fillOverlay` | Not in the format. |
| `text wrapping`, `text columns`, `autofit` | `wrap="none"`, `numCol` above 1, `a:spAutoFit`, `a:normAutofit` | OPF fits text itself and never writes autofit. |
| `alternative text title` | `p:cNvPr title` | `alt` is the one text alternative. |
| `hover link` | `a:hlinkHover` | Only the click link. |
| `locks` | `a:spLocks`, `a:cxnSpLocks` | Editing state, not content. |
| `black-and-white mode` | `bwMode` other than `auto` | Not in the format. |
| `custom data` | `p:custDataLst` | Not in the format. |
| `picture fill`, `group fill`, `pattern line`, `effect graph`, `click action`, `geometry <name>` | `a:blipFill` on a shape, `a:grpFill`, `a:pattFill` on a line, `a:effectDag`, a link that is not an http, mailto or tel URL, a preset OPF does not have | No OPF form. |
| `gradient fill`, `pattern fill`, `gradient focus`, `line transparency`, `shadow scale`, `custom geometry`, `custom path fill or stroke mode`, `arrowhead <type>` | a gradient or pattern with fewer than two stops or an unknown preset, a gradient focus off the center, a transparent line whose color is a theme color, a shadow scaled unevenly, an unreadable outline, a custom path with fill modes or hidden strokes, an arrowhead OPF does not have | The nearest OPF form is used where there is one. |
| `color transform <name>` | a color transform other than alpha, `lumMod` and `lumOff` | Its effect is not applied. |
| `position outside the slide` | a frame past the slide's edge | `x`, `y`, `width` and `height` are fractions 0 to 1: the shape is placed at the edge. |

A shape PowerPoint drew behind a text box, a picture, a table or a chart (below it in the z order, overlapping it, and over none of it) imports with `layer: "back"`, so it is drawn behind the content as it was. A shape between two pieces of content, over one and under another, is neither layer: it imports in front and, when it is opaque, is reported as `shape-covers-content` (`import/shape-covers-content`). A shape the export wrote takes its layer from the stored record.

Approximations that are not reported: a theme style that is a gradient (`fillRef` index 2 or 3) imports as the solid color of its reference, and a rotated shape inside a group that scales its axes unevenly is scaled on the slide's axes.

## Editing shapes

The editor edits shape blocks in the playground, the workspace and the Studio (`@openpresentation/opf-editor`; every edit is one validated, undoable change through the session, so Undo, Redo and proposals work as for any other edit):

- **Shape picker.** **Insert shape** in the playground (and **Add content > Shape**) opens PowerPoint's gallery: Lines, Rectangles, Basic Shapes, Block Arrows, Equation Shapes, Flowchart, Stars and Banners, Callouts and Action Buttons, a tile drawn from each preset's own geometry. The search takes the DrawingML name (`rightArrow`) and common words (`arrow`, `callout`, `star`, `flowchart`, `speech bubble`, `cylinder`); every word must match and Enter picks the first match. **Change shape…** in the Selected shape section changes a block's preset and keeps the adjust values the new preset also has. The groups and the search are `@openpresentation/opf/shape-catalog`; the MCP's `search_shapes` serves the same search with each preset's adjust values and a drawing.
- **Adjust handles.** A selected preset shape shows its yellow handles on the slide, where `presetGeometry(...).handles` puts them (turned and mirrored with the shape). Dragging one writes `adjust` as fractions and degrees (four and two places), pinned to the handle's range, as one undo step; Escape cancels a drag; the arrow keys nudge a focused handle (Shift for more). The Adjust fields in the section take the same values by typing. A few presets report a handle range that leaves their own default out (`star24`, `star32`, `mathDivide`'s `adj2`, `leftRightRibbon`'s `adj2`, as PowerPoint's definitions do); the editor widens that range to hold the default.
- **Every property.** The Selected shape section edits `fill` (none, color, gradient with type, angle and stops, pattern) and `opacity`, `stroke` (color or gradient, width, dash as a preset or a custom array, cap, join, miter limit, compound, alignment, start and end arrowheads, sketch), `style`, the six effects with the shadow presets, `rotate` and `flip`, `text`, `anchor`, `padding` and `textDirection`, and `alt`, `decorative`, `hidden` and `link`. Every color is a ColorRef with PowerPoint's Lighter and Darker tints (`{ color, lighten|darken }`).
- **Overlay shapes and connectors.** **Insert shape** offers the gallery's pick **In the layout** (a block composition places) or **On the slide** (an overlay: `slide.shapes`, free `x`, `y`, `width` and `height`). A selected overlay shape shows a frame: drag its outline or the grip above it to move it, a handle to resize it (fractions of the slide, kept on the slide, four places), arrow keys on the frame to move it (Shift resizes), Escape to cancel; **Place on the slide** takes the same numbers in percent. A shape attached to a block (`at`) keeps its anchor: dragging changes the `offset` from the block's edge, resizing `at.width` and `at.height` in reference pixels, and **Free from block** turns it into fractions. **Stacking** (Bring to front, Bring forward, Send backward, Send to back) is the array order; **Delete** removes a shape and the connectors that end on it. **Connect** (the playground's toolbar, or `canvas.connect({ route, stroke })`) picks two blocks or overlay shapes on the slide (click the start, then the end; Esc cancels) and adds a connector on top, straight, elbow or curved, an arrow by default; an end with no `id` gets one in the same undo step. A selected connector's section has its route, start and end (a block or an overlay shape), connection sites and its line with arrowheads. Every one of these is one undoable change.
- **Diagrams.** A slide with a [diagram](#native-diagrams) takes overlay shapes and connectors like any other slide (a connector can end on the diagram block), and the Export menu's PowerPoint file writes the diagram as its native group beside them.
- **From code.** `@openpresentation/opf-editor/shape-overlays`: `insertOverlayShape`, `setOverlayFrame`, `detachOverlay`, `moveOverlayLayer`, `removeOverlay`, `connectShapes`, `setConnector`, `listConnectionEnds`, `readOverlay` (each with a `prepare...` form). `@openpresentation/opf-editor/shape-options`: `insertShape`, `setShapePreset`, `setShapeAdjust` and `setShapeProperties` (each with a `prepare...` form), `searchShapes`, `shapeGroups`, `readShape`; `@openpresentation/opf-editor/shape-picker`: `createShapePicker`, `createShapeMenu`. See the [editor README](../packages/editor/README.md).

## Native diagrams

A [diagram](diagrams.md) (Mermaid source in a `diagram` block) is drawn with the same shapes in PowerPoint. The PPTX export writes it as native shapes, connectors and text by default (`diagrams: "shapes"`; `"picture"` writes one SVG picture, `--diagrams picture` in the CLI), built from the diagram engine's own laid-out drawing, the geometry the preview draws:

- a node whose outline is a preset is that preset (`rect`, `roundRect`, `ellipse`, `diamond`, `hexagon` and the others, checked against the [preset geometry](#preset-geometry)); any other outline is a custom geometry of its exact path, with the four connection sites of a rectangle;
- a straight edge without arrowheads is a connector glued to the connection sites of the nodes it touches, written as an [overlay connector](#connectors) is (one `p:cxnSp` with `a:stCxn` and `a:endCxn` on the native shape ids and the sites' indexes), so it follows a node moved in PowerPoint; every other edge is one shape of custom geometry holding its line and its arrowheads, because PowerPoint opens no connector of custom geometry and its line ends are shorter than the diagram's arrowheads;
- labels are real text at the preview's size and baseline;
- everything is one group named `OPF diagram N`, with the diagram's `alt` as its description.

A family is written as shapes once PowerPoint's drawing of it has passed the comparison with the preview (all 32 families have; the list is core's `DIAGRAM_SHAPE_FAMILIES`). A diagram whose family is not in the list, or whose drawing needs what PowerPoint has no native form for (a clip path, a mask, a filter, an embedded image, text on a path, right-to-left text), stays a picture and is reported as `pptx/diagram-shapes-unavailable`.

On import an unchanged group is its diagram again (the Mermaid source and `alt`), and none of its members become overlay shapes or connectors. An edited group (a member moved, resized, retyped, added or removed) imports as its shapes, [as PowerPoint's shapes do](#a-deck-powerpoint-wrote): the nodes as overlay shapes with their presets, fills, lines and text, the glued edges as connectors between them; `invalid-diagram-provenance` reports that the source is not reconstructed. See [native shapes in PowerPoint](diagrams.md#native-shapes-in-powerpoint) for the comparison and the families.

## Validation

| Finding | When |
|---|---|
| `opf/schema` | `shape` is not a preset name (the nearest names are offered as fixes), or a property has the wrong form. |
| `opf/shape-adjust-unknown` | `adjust` names a guide the preset does not have, or sits on a custom `path`. |
| `opf/shape-adjust-range` | An adjust value is outside its handle's range; the default is drawn. |
| `opf/text-overflow` | The text does not fit inside the shape at the readable minimum size. |
| `opf/shape-link-hidden` | A hidden shape has a link nobody can click. |
| `opf/shape-option-unsupported-payload` | A shape-only property (`fill`, `style`, `rotate` and the others) is on a block that is not a shape. |
| `opf/shape-anchor-missing` | An overlay shape's `at.block` names no block on the slide; the shape is not drawn. |
| `opf/connector-end-missing` | A connector's `from` or `to` names no block or overlay shape on the slide (or names a connector); the connector is not drawn. |
| `opf/schema` | An overlay shape has both placements or none, or only some of `x`, `y`, `width` and `height`; a connector has a shape-only key; a `fromSite` or `toSite` is an index the shape does not have. |

## Loading in browsers and edge runtimes

Node, Bun and Deno load the preset geometry (about 35 KB gzipped, with the sketched line) with core and draw any shape at once. A browser bundle or an edge Worker loads it the first time a deck has a shape block, an overlay shape or connector, a custom `path`, a picture masked by a preset other than the four built-in masks (`rect`, `roundRect`, `ellipse`, `hexagon`) or a sketched picture line, through the package's `#shape-engine` import map, as diagrams load (`#diagram-engine`); a deck without them does not carry it. The renderer's browser fonts handle loads it in `ensure` (its `pending` lists `shapes`), and `toPptx` loads it itself. A host that composes with `composeSlide` or `toSvg` directly calls `await ensureShapes(presentation)` (from `@openpresentation/opf` or `@openpresentation/opf/composition`) first; `shapesPending(presentation)` lists what it would load. A PPTX export with native diagrams (the default) also needs it for a deck with a diagram, which `ensureShapes(presentation, { diagrams: true })` covers; `toPptx` calls it so. Diagrams and icon sets load the same way, and one preload covers all three: see [Engines and icon sets that load on demand](how-opf-works.md#engines-and-icon-sets-that-load-on-demand). Until then a shape draws its frame and text with no outline, a mask beyond the built-in four draws as a rectangle and a sketched picture line as the plain line.

## Preset geometry

`@openpresentation/opf/shape-geometry` evaluates a preset at a size. It is edge-safe (no Node import) and has no
dependency; its data is `spec/reference/preset-geometry.json`.

```js
import { PRESET_SHAPES, presetAdjustments, presetGeometry, customGeometry, adjustToDrawingML } from "@openpresentation/opf/shape-geometry";

PRESET_SHAPES.length; // 187
presetAdjustments("rightArrow", 200, 100);
// { adj1: { default: 0.5, min: 0, max: 1, unit: "fraction" }, adj2: { default: 0.5, min: 0, max: 2, unit: "fraction" } }
const arrow = presetGeometry("rightArrow", 200, 100, { adj1: 0.4 });
arrow.paths; // [{ d: "M0 30 L150 30 L150 0 L200 50 L150 100 L150 70 L0 70 Z", fill: "norm", stroke: true, commands: [...] }]
arrow.textRect; // { x: 0, y: 30, width: 180, height: 40 }
arrow.connectionSites; // [{ x: 150, y: 0, angle: 270 }, ...]
arrow.handles; // [{ kind: "xy", x: 0, y: 30, vertical: { adjust: "adj1", min: 0, max: 1 } }, ...]
adjustToDrawingML("rightArrow", { adj1: 0.4 }); // { adj1: 40000, adj2: 50000 }: the a:avLst to write
```

| Export | What it does |
| --- | --- |
| `PRESET_SHAPES` | The 187 names, in the order of the standard's definitions file. `isPresetShape(name)` tests one. |
| `presetAdjustments(name, width?, height?)` | Each adjust value's default and the range of the handle that moves it, at the size (handle ranges can depend on the size; the default is a square). `min`/`max` are `null` when the standard leaves them unbounded or no handle moves the value (the `hf`/`vf` proportion factors of the polygons and stars). |
| `presetGeometry(name, width, height, adjust?)` | The paths as SVG path data, each with its DrawingML fill mode (`norm`, `none`, `lighten`, `lightenLess`, `darken`, `darkenLess`) and stroke flag; the text rectangle; the connection sites; the adjust handles. Every length is in the units of `width` and `height`. `commands` is the same outline as absolute `M`/`L`/`C`/`Q`/`Z` commands (arcs as cubic Béziers) for bounds, hit tests and native custom geometry. |
| `customGeometry(path, width, height)` | An OPF custom outline: SVG path data in a 0 to 1 box (a string), or `{ d, viewBox }`. Every SVG command is accepted (arcs become cubic Béziers, so a non-uniform scale stays exact); the result has `presetGeometry`'s shape, with the whole box as the text rectangle and the four edge midpoints as connection sites. |
| `adjustToDrawingML(name, adjust)`, `adjustFromDrawingML(name, avLst)` | OPF adjust values to and from the integers of `a:avLst`. |
| `evaluateGuideFormula(formula, guides)` | One guide formula, for hosts that evaluate their own `a:custGeom` guides. |
| `flattenShapePath(commands, segments?)` | Path commands as polylines. |

### Units

- Adjust values are OPF units. The values the standard writes in 1/100000 are fractions: DrawingML `val 25000` is OPF
  `0.25` (which dimension it is a fraction of depends on the preset, most often the shorter side). The angle adjusts
  (the ones a polar handle moves: `arc`, `blockArc`, `chord`, `pie`, the three circular arrows and `mathNotEqual`) are
  degrees: DrawingML `val 16200000` (60000ths of a degree) is OPF `270`. `presetAdjustments` names each one's `unit`.
- Angles of connection sites are degrees clockwise from the positive x axis, y pointing down, as in DrawingML.
- A value outside its handle's range is pinned by the preset's own guides, as PowerPoint pins it.
- `adjustToDrawingML` rounds to the integers DrawingML stores, and the preview evaluates the same integers, so the two
  engines draw the same value. Once any value is given, every `avLst` value is written, the others at their defaults,
  as PowerPoint writes them: PowerPoint refuses to open a file whose `avLst` names a hexagon's or star's `adj` without
  its `hf`/`vf` factors.

### How the evaluator follows PowerPoint

- The guide formula language of ECMA-376 Part 1, 20.1.9.11: `*/ +- +/ ?: abs at2 cat2 cos max min mod pin sat2 sin
  sqrt tan val`, with angles in 60000ths of a degree and the built-in guides `w h l t r b hc vc ss ls`, `wd2` to `wd32`,
  `hd2` to `hd10`, `ssd2` to `ssd32`, `cd2 cd4 cd8 3cd4 3cd8 5cd8 7cd8`. A zero divisor (a shape of zero width or
  height) gives 0, so a degenerate shape still has finite points.
- `arcTo` starts on the ellipse at the visual angle `stAng` (the angle of the ray from the ellipse's center, not the
  parametric angle) and sweeps `swAng`, positive clockwise on screen, to the visual angle `stAng + swAng`.
- A path with its own `w` and `h` is evaluated in that coordinate space, arcs included, and then scaled to the shape.
- Fills use the nonzero rule.

### Verified against PowerPoint

Every preset was written as a native `a:prstGeom` at two sizes (360 by 200 and 150 by 260 pixels) with its default
adjust values and a second set (each handle's value halfway to its range end), once filled and once stroked with a
1-pixel line, exported by PowerPoint 365 at 1280 by 720 and compared with the engine's SVG rendered at the same size.
All 187 presets match: no stroked outline differs by more than 1 pixel anywhere, and the filled outlines differ by more
than 1 pixel only at a few antialiased pixels of hairline tips (at most 13 pixels of a 640 by 360 cell, in `star32`,
`rightBrace`, `leftBrace`, `star24`, `bracePair` and `flowChartOnlineStorage`).

Custom outlines were checked the same way: four outlines (a circle of two arcs, a star, a heart of cubic Béziers, a callout with
an arc and a quadratic curve), each at two sizes, written as native `a:custGeom` from `customGeometry`'s `commands`, match
PowerPoint with no pixel off by more than 1 pixel.

The comparison also shows that stroke joins are not geometry: with a 3-pixel line PowerPoint draws mitered joins of very
acute tips (the spikes of `star24`, `star32` and `sun`) shorter than SVG's miter, and it drew `a:round` joins as miters in
this export. The stroke engines own that difference.

### Errata

Two values of the standard's definitions file are corrected to what PowerPoint does (recorded in the table's `errata`):

- `pie`: the file's text rectangle swaps `t` and `r` (`l=il t=ir r=it b=ib`), a rectangle of negative size; PowerPoint
  lays out pie text in the ellipse's text rectangle (`il it ir ib`).
- `curvedLeftArrow`: the arrow tip's connection site names the undefined guide `cd3`; it faces left (`cd2`), mirroring
  `curvedRightArrow`'s tip.

Some text rectangles and connection sites of the standard lie off the drawn outline on purpose (a frame's opening, a
pie's center, the sites of `blockArc` and the gears on their construction circles); the engine keeps them as defined.

### Preset geometry source and license

`spec/reference/preset-geometry.json` is generated by `scripts/build-preset-geometry.mjs` from the standard's
`presetShapeDefinitions.xml` (the DrawingML preset geometries of the ECMA-376 Part 1 electronic attachment), downloaded
and never committed:

- Source: Apache POI 5.5.1,
  `https://raw.githubusercontent.com/apache/poi/REL_5_5_1/poi/src/main/resources/org/apache/poi/sl/draw/geom/presetShapeDefinitions.xml`
  (tag `REL_5_5_1`, commit `6048bedcdf1de60871b4a2fb7cf7cd242752e6c9`, sha256
  `a7dad593d27bd70536b41da9b761fa16409536cc0c25ef2b6c7a61c5d9b3e738`).
- License: Apache-2.0 (Apache POI's `legal/LICENSE`). Notice: "Apache POI. Copyright 2003-2025 The Apache Software
  Foundation. This product includes software developed at The Apache Software Foundation (https://www.apache.org/)."
  The table carries the source, license and notice in its `source` member.
- The data itself is the standard's: Apache POI's license states that the Office Open XML material is part of ECMA-376,
  which section 9.4 of the Ecma bylaws makes available to all interested parties without restriction, and that
  Microsoft and Adobe granted patent licenses to it.
- Not used: LibreOffice's copy of the same definitions (`oox/source/drawingml/customshapes/`), which is MPL-2.0, a
  file-level copyleft license.

The output keeps the standard's names and values; nothing is converted, so a rebuild from the same file is
byte-identical. Run `node scripts/build-preset-geometry.mjs --source <presetShapeDefinitions.xml>`; it checks that the
file still has 187 presets and that each erratum still applies.

## Property map

OPF names and the DrawingML that PowerPoint reads and writes.

| What | OPF | PowerPoint (DrawingML) |
| --- | --- | --- |
| Preset shape | `shape: "chevron"` (a shape block) | `a:prstGeom prst` |
| Adjust handles | `adjust: { "adj1": 0.25 }` (fractions and degrees) | `a:avLst/a:gd` |
| Custom outline | `path` (SVG path data in a 0 to 1 box, or with a viewBox) | `a:custGeom` |
| No fill | `fill: "none"` | `a:noFill` |
| Solid fill | `fill: <ColorRef>` | `a:solidFill` |
| Opacity | `opacity` 0 to 1 (fill), or 8-digit hex | `a:alpha` |
| Gradient | `fill: { gradient: { type, angle, stops } }` | `a:gradFill` (`a:lin`, `a:path`) |
| Pattern | `fill: { pattern: { preset, foregroundColor, backgroundColor } }` | `a:pattFill` |
| Picture inside a shape | an image block's `shape` (every preset) | `a:blipFill` in `a:prstGeom` |
| Fill rotates with shape | always on | `rotWithShape="1"` |
| Lighter or darker color | `{ color, lighten }` / `{ color, darken }` | `a:lumMod`/`a:lumOff` |
| Stroke | `stroke` (shapes and pictures) | `a:ln` |
| Stroke color | `stroke.color` or `stroke.gradient` | `a:ln/a:solidFill`, `a:ln/a:gradFill` |
| Stroke width | `stroke.width` | `a:ln w` |
| Dash | `stroke.dash` (preset or array) | `a:prstDash`, `a:custDash` |
| Cap | `stroke.cap` | `a:ln cap` |
| Join | `stroke.join`, `stroke.miterLimit` | `a:miter lim`, `a:round`, `a:bevel` |
| Compound | `stroke.compound` | `a:ln cmpd` |
| Alignment | `stroke.align` | `a:ln algn` |
| Arrowheads | `stroke.start`, `stroke.end` | `a:headEnd`, `a:tailEnd` |
| Hand-drawn | `stroke.sketch` | `ask:lineSketchStyleProps` |
| Theme style | `style` | `p:style` |
| Outer shadow | `shadow` | `a:outerShdw` |
| Inner shadow | `innerShadow` | `a:innerShdw` |
| Glow | `glow` | `a:glow` |
| Soft edges | `softEdge` | `a:softEdge` |
| Reflection | `reflection` | `a:reflection` |
| Blur | `blur` | `a:blur` |
| Rotation | `rotate` | `a:xfrm rot` |
| Flip | `flip` | `flipH`, `flipV` |
| Overlay placement | slide-level `shapes: [...]` placed by `x`, `y`, `width`, `height` (fractions) or `at` a block | `a:xfrm a:off a:ext` |
| Overlay layer | `layer`: front (default) or back | shape tree order: after the background, watermark and logo, or after everything |
| Stacking | array order (within a layer) | shape tree order |
| Text | `text` | `p:txBody` |
| Vertical anchor | `anchor` | `a:bodyPr anchor` |
| Margins | `padding` | `lIns`, `tIns`, `rIns`, `bIns` |
| Vertical text | `textDirection` | `a:bodyPr vert` |
| Alt text | `alt` | `p:cNvPr descr` |
| Decorative | `decorative: true` | `adec:decorative` |
| Name | from the block's path | `p:cNvPr name` |
| Hidden | `hidden: true` | `p:cNvPr hidden` |
| Click link | `link` | `a:hlinkClick` |
| Connector | `connector: { from, to, route }` with `stroke`, among slide-level `shapes` | `p:cxnSp`, `a:stCxn`, `a:endCxn` |
| Connection site | the nearest facing site; `fromSite`/`toSite` to override | `idx` |
| Connector middle | `adjust: { adj1 }` on an elbow or curved connector | `a:avLst` of `bentConnector3`, `curvedConnector3` |
| Native diagram | a `diagram` block, exported with `diagrams: "shapes"` (the default) | one `p:grpSp` of `p:sp` and `p:cxnSp` |

### Excluded on purpose

These DrawingML features are left out of OPF; PPTX import reports them as findings.

- 3-D (`a:scene3d`, `a:sp3d`): the preview cannot match PowerPoint's 3-D rendering.
- Preset shadows (`a:prstShdw`): covered by the `shadow` presets.
- Fill overlay (`a:fillOverlay`).
- Text wrap off, text columns and autofit (`wrap`, `numCol`, `normAutofit`, `spAutoFit`): OPF fits text itself.
- The alternative text title (`p:cNvPr title`): `alt` is the description.
- Hover links (`a:hlinkHover`).
- Locks (`a:spLocks`).
- Black-and-white mode (`bwMode`).
- Custom data (`p:custDataLst`).

## Preset table

Default frame is the proportion a shape takes when the block sets no `aspectRatio`. Adjust values are OPF units (fractions, degrees where marked), with their handle's range at a square shape; "any" has no handle limit.

| Preset | Default frame | Adjust values: default (range) |
|---|---|---|
| `accentBorderCallout1` | 3:2 | `adj1` 0.1875 (any), `adj2` -0.08333 (any), `adj3` 1.125 (any), `adj4` -0.38333 (any) |
| `accentBorderCallout2` | 3:2 | `adj1` 0.1875 (any), `adj2` -0.08333 (any), `adj3` 0.1875 (any), `adj4` -0.16667 (any), `adj5` 1.125 (any), `adj6` -0.46667 (any) |
| `accentBorderCallout3` | 3:2 | `adj1` 0.1875 (any), `adj2` -0.08333 (any), `adj3` 0.1875 (any), `adj4` -0.16667 (any), `adj5` 1 (any), `adj6` -0.16667 (any), `adj7` 1.12963 (any), `adj8` -0.08333 (any) |
| `accentCallout1` | 3:2 | `adj1` 0.1875 (any), `adj2` -0.08333 (any), `adj3` 1.125 (any), `adj4` -0.38333 (any) |
| `accentCallout2` | 3:2 | `adj1` 0.1875 (any), `adj2` -0.08333 (any), `adj3` 0.1875 (any), `adj4` -0.16667 (any), `adj5` 1.125 (any), `adj6` -0.46667 (any) |
| `accentCallout3` | 3:2 | `adj1` 0.1875 (any), `adj2` -0.08333 (any), `adj3` 0.1875 (any), `adj4` -0.16667 (any), `adj5` 1 (any), `adj6` -0.16667 (any), `adj7` 1.12963 (any), `adj8` -0.08333 (any) |
| `actionButtonBackPrevious` | 1:1 | none |
| `actionButtonBeginning` | 1:1 | none |
| `actionButtonBlank` | 1:1 | none |
| `actionButtonDocument` | 1:1 | none |
| `actionButtonEnd` | 1:1 | none |
| `actionButtonForwardNext` | 1:1 | none |
| `actionButtonHelp` | 1:1 | none |
| `actionButtonHome` | 1:1 | none |
| `actionButtonInformation` | 1:1 | none |
| `actionButtonMovie` | 1:1 | none |
| `actionButtonReturn` | 1:1 | none |
| `actionButtonSound` | 1:1 | none |
| `arc` | 1:1 | `adj1` 270° (0 to 359.99998), `adj2` 0° (0 to 359.99998) |
| `bentArrow` | 1:1 | `adj1` 0.25 (0 to 0.5), `adj2` 0.25 (0 to 0.5), `adj3` 0.25 (0 to 0.5), `adj4` 0.4375 (0 to 0.75) |
| `bentConnector2` | 2:1 | none |
| `bentConnector3` | 2:1 | `adj1` 0.5 (any) |
| `bentConnector4` | 2:1 | `adj1` 0.5 (any), `adj2` 0.5 (any) |
| `bentConnector5` | 2:1 | `adj1` 0.5 (any), `adj2` 0.5 (any), `adj3` 0.5 (any) |
| `bentUpArrow` | 1:1 | `adj1` 0.25 (0 to 0.5), `adj2` 0.25 (0 to 0.5), `adj3` 0.25 (0 to 0.5) |
| `bevel` | 1:1 | `adj` 0.125 (0 to 0.5) |
| `blockArc` | 1:1 | `adj1` 180° (0 to 359.99998), `adj2` 0° (0 to 359.99998), `adj3` 0.25 (0 to 0.5) |
| `borderCallout1` | 3:2 | `adj1` 0.1875 (any), `adj2` -0.08333 (any), `adj3` 1.125 (any), `adj4` -0.38333 (any) |
| `borderCallout2` | 3:2 | `adj1` 0.1875 (any), `adj2` -0.08333 (any), `adj3` 0.1875 (any), `adj4` -0.16667 (any), `adj5` 1.125 (any), `adj6` -0.46667 (any) |
| `borderCallout3` | 3:2 | `adj1` 0.1875 (any), `adj2` -0.08333 (any), `adj3` 0.1875 (any), `adj4` -0.16667 (any), `adj5` 1 (any), `adj6` -0.16667 (any), `adj7` 1.12963 (any), `adj8` -0.08333 (any) |
| `bracePair` | 2:1 | `adj` 0.08333 (0 to 0.25) |
| `bracketPair` | 2:1 | `adj` 0.16667 (0 to 0.5) |
| `callout1` | 3:2 | `adj1` 0.1875 (any), `adj2` -0.08333 (any), `adj3` 1.125 (any), `adj4` -0.38333 (any) |
| `callout2` | 3:2 | `adj1` 0.1875 (any), `adj2` -0.08333 (any), `adj3` 0.1875 (any), `adj4` -0.16667 (any), `adj5` 1.125 (any), `adj6` -0.46667 (any) |
| `callout3` | 3:2 | `adj1` 0.1875 (any), `adj2` -0.08333 (any), `adj3` 0.1875 (any), `adj4` -0.16667 (any), `adj5` 1 (any), `adj6` -0.16667 (any), `adj7` 1.12963 (any), `adj8` -0.08333 (any) |
| `can` | 1:2 | `adj` 0.25 (0 to 0.5) |
| `chartPlus` | 1:1 | none |
| `chartStar` | 1:1 | none |
| `chartX` | 1:1 | none |
| `chevron` | 2:1 | `adj` 0.5 (0 to 1) |
| `chord` | 1:1 | `adj1` 45° (0 to 359.99998), `adj2` 270° (0 to 359.99998) |
| `circularArrow` | 1:1 | `adj1` 0.125 (0 to 0.25), `adj2` 19.03865° (0 to 56.44269), `adj3` 340.96135° (0 to 359.99998), `adj4` 180° (0 to 359.99998), `adj5` 0.125 (0 to 0.25) |
| `cloud` | 1:1 | none |
| `cloudCallout` | 3:2 | `adj1` -0.20833 (any), `adj2` 0.625 (any) |
| `corner` | 1:1 | `adj1` 0.5 (0 to 1), `adj2` 0.5 (0 to 1) |
| `cornerTabs` | 1:1 | none |
| `cube` | 1:1 | `adj` 0.25 (0 to 1) |
| `curvedConnector2` | 2:1 | none |
| `curvedConnector3` | 2:1 | `adj1` 0.5 (any) |
| `curvedConnector4` | 2:1 | `adj1` 0.5 (any), `adj2` 0.5 (any) |
| `curvedConnector5` | 2:1 | `adj1` 0.5 (any), `adj2` 0.5 (any), `adj3` 0.5 (any) |
| `curvedDownArrow` | 2:1 | `adj1` 0.25 (0 to 0.5), `adj2` 0.5 (0 to 0.5), `adj3` 0.25 (0 to 0.91652) |
| `curvedLeftArrow` | 1:2 | `adj1` 0.25 (0 to 0.5), `adj2` 0.5 (0 to 0.5), `adj3` 0.25 (0 to 0.91652) |
| `curvedRightArrow` | 1:2 | `adj1` 0.25 (0 to 0.5), `adj2` 0.5 (0 to 0.5), `adj3` 0.25 (0 to 0.91652) |
| `curvedUpArrow` | 2:1 | `adj1` 0.25 (0 to 0.5), `adj2` 0.5 (0 to 0.5), `adj3` 0.25 (0 to 0.91652) |
| `decagon` | 1:1 | `vf` 1.05146 (any) |
| `diagStripe` | 1:1 | `adj` 0.5 (0 to 1) |
| `diamond` | 1:1 | none |
| `dodecagon` | 1:1 | none |
| `donut` | 1:1 | `adj` 0.25 (0 to 0.5) |
| `doubleWave` | 2:1 | `adj1` 0.0625 (0 to 0.125), `adj2` 0 (-0.1 to 0.1) |
| `downArrow` | 1:2 | `adj1` 0.5 (0 to 1), `adj2` 0.5 (0 to 1) |
| `downArrowCallout` | 3:2 | `adj1` 0.25 (0 to 0.5), `adj2` 0.25 (0 to 0.5), `adj3` 0.25 (0 to 1), `adj4` 0.64977 (0 to 0.75) |
| `ellipse` | 1:1 | none |
| `ellipseRibbon` | 2:1 | `adj1` 0.25 (0 to 1), `adj2` 0.5 (0.25 to 0.75), `adj3` 0.125 (0 to 0.25) |
| `ellipseRibbon2` | 2:1 | `adj1` 0.25 (0 to 1), `adj2` 0.5 (0.25 to 1), `adj3` 0.125 (0 to 0.25) |
| `flowChartAlternateProcess` | 3:2 | none |
| `flowChartCollate` | 1:1 | none |
| `flowChartConnector` | 1:1 | none |
| `flowChartDecision` | 1:1 | none |
| `flowChartDelay` | 3:2 | none |
| `flowChartDisplay` | 3:2 | none |
| `flowChartDocument` | 3:2 | none |
| `flowChartExtract` | 1:1 | none |
| `flowChartInputOutput` | 3:2 | none |
| `flowChartInternalStorage` | 3:2 | none |
| `flowChartMagneticDisk` | 3:2 | none |
| `flowChartMagneticDrum` | 3:2 | none |
| `flowChartMagneticTape` | 3:2 | none |
| `flowChartManualInput` | 3:2 | none |
| `flowChartManualOperation` | 3:2 | none |
| `flowChartMerge` | 1:1 | none |
| `flowChartMultidocument` | 3:2 | none |
| `flowChartOfflineStorage` | 1:1 | none |
| `flowChartOffpageConnector` | 3:2 | none |
| `flowChartOnlineStorage` | 3:2 | none |
| `flowChartOr` | 1:1 | none |
| `flowChartPredefinedProcess` | 3:2 | none |
| `flowChartPreparation` | 3:2 | none |
| `flowChartProcess` | 3:2 | none |
| `flowChartPunchedCard` | 3:2 | none |
| `flowChartPunchedTape` | 2:1 | none |
| `flowChartSort` | 1:1 | none |
| `flowChartSummingJunction` | 1:1 | none |
| `flowChartTerminator` | 2:1 | none |
| `foldedCorner` | 1:1 | `adj` 0.16667 (0 to 0.5) |
| `frame` | 1:1 | `adj1` 0.125 (0 to 0.5) |
| `funnel` | 1:1 | none |
| `gear6` | 1:1 | `adj1` 0.15 (0 to 0.2), `adj2` 0.03526 (0 to 0.05358) |
| `gear9` | 1:1 | `adj1` 0.1 (0 to 0.2), `adj2` 0.01763 (0 to 0.02679) |
| `halfFrame` | 1:1 | `adj1` 0.33333 (0 to 0.66667), `adj2` 0.33333 (0 to 1) |
| `heart` | 1:1 | none |
| `heptagon` | 1:1 | `hf` 1.02572 (any), `vf` 1.0521 (any) |
| `hexagon` | 1:1 | `adj` 0.25 (0 to 0.5), `vf` 1.1547 (any) |
| `homePlate` | 2:1 | `adj` 0.5 (0 to 1) |
| `horizontalScroll` | 2:1 | `adj` 0.125 (0 to 0.25) |
| `irregularSeal1` | 1:1 | none |
| `irregularSeal2` | 1:1 | none |
| `leftArrow` | 2:1 | `adj1` 0.5 (0 to 1), `adj2` 0.5 (0 to 1) |
| `leftArrowCallout` | 3:2 | `adj1` 0.25 (0 to 0.5), `adj2` 0.25 (0 to 0.5), `adj3` 0.25 (0 to 1), `adj4` 0.64977 (0 to 0.75) |
| `leftBrace` | 1:2 | `adj1` 0.08333 (0 to 0.25), `adj2` 0.5 (0 to 1) |
| `leftBracket` | 1:2 | `adj` 0.08333 (0 to 0.5) |
| `leftCircularArrow` | 1:1 | `adj1` 0.125 (0 to 0.25), `adj2` -19.03865° (-56.44269 to 0), `adj3` 19.03865° (0 to 359.99998), `adj4` 180° (0 to 359.99998), `adj5` 0.125 (0 to 0.25) |
| `leftRightArrow` | 2:1 | `adj1` 0.5 (0 to 1), `adj2` 0.5 (0 to 0.5) |
| `leftRightArrowCallout` | 2:1 | `adj1` 0.25 (0 to 0.5), `adj2` 0.25 (0 to 0.5), `adj3` 0.25 (0 to 0.5), `adj4` 0.48123 (0 to 0.5) |
| `leftRightCircularArrow` | 1:1 | `adj1` 0.125 (0 to 0.25), `adj2` 19.03865° (0 to 56.44269), `adj3` 340.96135° (0 to 359.99998), `adj4` 199.03865° (0 to 359.99998), `adj5` 0.125 (0 to 0.25) |
| `leftRightRibbon` | 2:1 | `adj1` 0.5 (0 to 0.83333), `adj2` 0.5 (0 to 0.46875), `adj3` 0.16667 (0 to 0.33333) |
| `leftRightUpArrow` | 1:1 | `adj1` 0.25 (0 to 0.5), `adj2` 0.25 (0 to 0.5), `adj3` 0.25 (0 to 0.25) |
| `leftUpArrow` | 1:1 | `adj1` 0.25 (0 to 0.5), `adj2` 0.25 (0 to 0.5), `adj3` 0.25 (0 to 0.5) |
| `lightningBolt` | 1:1 | none |
| `line` | 2:1 | none |
| `lineInv` | 2:1 | none |
| `mathDivide` | 1:1 | `adj1` 0.2352 (0.01 to 0.36745), `adj2` 0.0588 (0 to 0.0293), `adj3` 0.1176 (0.01 to 0.12493) |
| `mathEqual` | 1:1 | `adj1` 0.2352 (0 to 0.36745), `adj2` 0.1176 (0 to 0.5296) |
| `mathMinus` | 1:1 | `adj1` 0.2352 (0 to 1) |
| `mathMultiply` | 1:1 | `adj1` 0.2352 (0 to 0.51965) |
| `mathNotEqual` | 1:1 | `adj1` 0.2352 (0 to 0.5), `adj2` 110° (70 to 110), `adj3` 0.1176 (0 to 0.5296) |
| `mathPlus` | 1:1 | `adj1` 0.2352 (0 to 0.7349) |
| `moon` | 1:1 | `adj` 0.5 (0 to 0.875) |
| `nonIsoscelesTrapezoid` | 3:2 | `adj1` 0.25 (0 to 0.5), `adj2` 0.25 (0 to 0.5) |
| `noSmoking` | 1:1 | `adj` 0.1875 (0 to 0.5) |
| `notchedRightArrow` | 2:1 | `adj1` 0.5 (0 to 1), `adj2` 0.5 (0 to 1) |
| `octagon` | 1:1 | `adj` 0.29289 (0 to 0.5) |
| `parallelogram` | 3:2 | `adj` 0.25 (0 to 1) |
| `pentagon` | 1:1 | `hf` 1.05146 (any), `vf` 1.10557 (any) |
| `pie` | 1:1 | `adj1` 0° (0 to 359.99998), `adj2` 270° (0 to 359.99998) |
| `pieWedge` | 1:1 | none |
| `plaque` | 3:2 | `adj` 0.16667 (0 to 0.5) |
| `plaqueTabs` | 1:1 | none |
| `plus` | 1:1 | `adj` 0.25 (0 to 0.5) |
| `quadArrow` | 1:1 | `adj1` 0.225 (0 to 0.45), `adj2` 0.225 (0 to 0.5), `adj3` 0.225 (0 to 0.275) |
| `quadArrowCallout` | 1:1 | `adj1` 0.18515 (0 to 0.3703), `adj2` 0.18515 (0 to 0.5), `adj3` 0.18515 (0 to 0.31485), `adj4` 0.48123 (0.18515 to 0.6297) |
| `rect` | 3:2 | none |
| `ribbon` | 2:1 | `adj1` 0.16667 (0 to 0.33333), `adj2` 0.5 (0.25 to 0.75) |
| `ribbon2` | 2:1 | `adj1` 0.16667 (0 to 0.33333), `adj2` 0.5 (0.25 to 0.75) |
| `rightArrow` | 2:1 | `adj1` 0.5 (0 to 1), `adj2` 0.5 (0 to 1) |
| `rightArrowCallout` | 3:2 | `adj1` 0.25 (0 to 0.5), `adj2` 0.25 (0 to 0.5), `adj3` 0.25 (0 to 1), `adj4` 0.64977 (0 to 0.75) |
| `rightBrace` | 1:2 | `adj1` 0.08333 (0 to 0.25), `adj2` 0.5 (0 to 1) |
| `rightBracket` | 1:2 | `adj` 0.08333 (0 to 0.5) |
| `round1Rect` | 3:2 | `adj` 0.16667 (0 to 0.5) |
| `round2DiagRect` | 3:2 | `adj1` 0.16667 (0 to 0.5), `adj2` 0 (0 to 0.5) |
| `round2SameRect` | 3:2 | `adj1` 0.16667 (0 to 0.5), `adj2` 0 (0 to 0.5) |
| `roundRect` | 3:2 | `adj` 0.16667 (0 to 0.5) |
| `rtTriangle` | 1:1 | none |
| `smileyFace` | 1:1 | `adj` 0.04653 (-0.04653 to 0.04653) |
| `snip1Rect` | 3:2 | `adj` 0.16667 (0 to 0.5) |
| `snip2DiagRect` | 3:2 | `adj1` 0 (0 to 0.5), `adj2` 0.16667 (0 to 0.5) |
| `snip2SameRect` | 3:2 | `adj1` 0.16667 (0 to 0.5), `adj2` 0 (0 to 0.5) |
| `snipRoundRect` | 3:2 | `adj1` 0.16667 (0 to 0.5), `adj2` 0.16667 (0 to 0.5) |
| `squareTabs` | 1:1 | none |
| `star10` | 1:1 | `adj` 0.42533 (0 to 0.5), `hf` 1.05146 (any) |
| `star12` | 1:1 | `adj` 0.375 (0 to 0.5) |
| `star16` | 1:1 | `adj` 0.375 (0 to 0.5) |
| `star24` | 1:1 | `adj` 0.375 (0 to 0.0005) |
| `star32` | 1:1 | `adj` 0.375 (0 to 0.0005) |
| `star4` | 1:1 | `adj` 0.125 (0 to 0.5) |
| `star5` | 1:1 | `adj` 0.19098 (0 to 0.5), `hf` 1.05146 (any), `vf` 1.10557 (any) |
| `star6` | 1:1 | `adj` 0.28868 (0 to 0.5), `hf` 1.1547 (any) |
| `star7` | 1:1 | `adj` 0.34601 (0 to 0.5), `hf` 1.02572 (any), `vf` 1.0521 (any) |
| `star8` | 1:1 | `adj` 0.375 (0 to 0.5) |
| `straightConnector1` | 2:1 | none |
| `stripedRightArrow` | 2:1 | `adj1` 0.5 (0 to 1), `adj2` 0.5 (0 to 0.84375) |
| `sun` | 1:1 | `adj` 0.25 (0.125 to 0.46875) |
| `swooshArrow` | 2:1 | `adj1` 0.25 (0.00001 to 0.75), `adj2` 0.16667 (0 to 0.7) |
| `teardrop` | 1:1 | `adj` 1 (0 to 2) |
| `trapezoid` | 3:2 | `adj` 0.25 (0 to 0.5) |
| `triangle` | 1:1 | `adj` 0.5 (0 to 1) |
| `upArrowCallout` | 3:2 | `adj1` 0.25 (0 to 0.5), `adj2` 0.25 (0 to 0.5), `adj3` 0.25 (0 to 1), `adj4` 0.64977 (0 to 0.75) |
| `upDownArrow` | 1:2 | `adj1` 0.5 (0 to 1), `adj2` 0.5 (0 to 0.5) |
| `upArrow` | 1:2 | `adj1` 0.5 (0 to 1), `adj2` 0.5 (0 to 1) |
| `upDownArrowCallout` | 1:2 | `adj1` 0.25 (0 to 0.5), `adj2` 0.25 (0 to 0.5), `adj3` 0.25 (0 to 0.5), `adj4` 0.48123 (0 to 0.5) |
| `uturnArrow` | 1:1 | `adj1` 0.25 (0 to 0.5), `adj2` 0.25 (0 to 0.25), `adj3` 0.25 (0 to 0.75), `adj4` 0.4375 (0 to 0.4375), `adj5` 0.75 (0.5 to 1) |
| `verticalScroll` | 1:2 | `adj` 0.125 (0 to 0.25) |
| `wave` | 2:1 | `adj1` 0.125 (0 to 0.2), `adj2` 0 (-0.1 to 0.1) |
| `wedgeEllipseCallout` | 3:2 | `adj1` -0.20833 (any), `adj2` 0.625 (any) |
| `wedgeRectCallout` | 3:2 | `adj1` -0.20833 (any), `adj2` 0.625 (any) |
| `wedgeRoundRectCallout` | 3:2 | `adj1` -0.20833 (any), `adj2` 0.625 (any), `adj3` 0.16667 (any) |
