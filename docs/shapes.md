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

`shape` takes DrawingML's own preset names (ECMA-376 `ST_ShapeType`), as PowerPoint writes them: `rect`, `roundRect`, `ellipse`, `triangle`, `rightArrow`, `chevron`, `wedgeRectCallout`, `flowChartDecision` and the rest. The [preset table](#preset-table) lists all 187 with their Aspose `ShapeType` names, default frames and adjust values. A name that is not a preset is an `opf/schema` error with the nearest names as fixes.

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

The preview draws `rectangle` and `shape` gradients as an ellipse from the center, as it draws `radial`; PowerPoint draws them following the frame or the outline.

## Stroke

`stroke` is the line along the outline (`a:ln`): `"none"`, or an object. On a shape without one the style's line is drawn; `"none"` removes it.

| Property | Meaning | PowerPoint |
|---|---|---|
| `color` | Any ColorRef. Default the style's line color. | `a:solidFill` |
| `gradient` | A gradient line instead of a color (the fill's gradient object). | `a:gradFill` |
| `width` | Reference pixels, 0 to 64; 0 removes the line. Default 4/3 (1 point) on a shape, 2 on a picture. | `w` |
| `dash` | `solid`, `dot`, `dash`, `longDash`, `dashDot`, `longDashDot`, `longDashDotDot`, `sysDot`, `sysDash`, `sysDashDot`, `sysDashDotDot`, or an array of dash and gap lengths in line widths (`[4, 2]`). | `a:prstDash` (`lgDash` for `longDash`), `a:custDash` |
| `cap` | `flat` (default), `round`, `square`. | `cap` |
| `join` | `miter`, `round`, `bevel`; `miterLimit` (default 8). Default round on a shape, miter on a picture. | `a:miter lim`, `a:round`, `a:bevel` |
| `compound` | `single`, `double`, `thickThin`, `thinThick`, `triple`. | `cmpd` |
| `align` | `center` (default) or `inside` (closed outlines only, as in PowerPoint). | `algn` |
| `start`, `end` | Arrowheads on an open path: `{ type, width, length }`, `type` `triangle` (default), `stealth`, `diamond`, `oval` or `arrow`, sizes `small`, `medium` (default), `large`. | `a:headEnd`, `a:tailEnd` |
| `sketch` | `curved`, `freehand` or `scribble`: PowerPoint's Sketched line. | `ask:lineSketchStyleProps` |

The preview draws every property. Arrowheads are drawn at 2, 3 or 5 line widths and the line stops under a triangle or stealth head, as PowerPoint draws them. A sketched line is PowerPoint's own randomized stroke, which no other renderer can reproduce: the preview draws the plain line, and PowerPoint versions before 2021 do too.

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

Shapes stack in the order the blocks compose (`ZOrderPosition` is the shape tree order).

## Accessibility and links

| Property | Meaning | PowerPoint |
|---|---|---|
| `alt` | Alternative text. Without it, a shape's text is what is read. | `p:cNvPr descr` |
| `decorative` | `true`: screen readers skip the shape. | the decorative extension (`adec:decorative`, "Mark as decorative") |
| `hidden` | `true`: kept in the file but not drawn; it keeps its room. | `p:cNvPr hidden` |
| `link` | An http(s), `mailto:` or `tel:` URL opened when the shape is clicked in a slide show. A link on a hidden shape is `opf/shape-link-hidden`. | `a:hlinkClick` |

The shape's name in PowerPoint is `OPF shape <path>`, from the block's place in the deck.

## Effects

`shadow` (a preset `soft`, `hard` or `perspective`, or `{ color, opacity, blur, distance, angle, size }`), `innerShadow`, `glow` (`{ color, opacity, radius }`), `softEdge` (a radius), `reflection` (`{ opacity, size, distance, blur }`) and `blur` (a radius) are part of the format; lengths are reference pixels and angles degrees. SH-03 draws them in both engines (`a:effectLst`). The `intense` style adds the `soft` shadow unless the block sets its own.

## Pictures

An image block's line is `stroke` (renamed from `border` in 0.33, with no alias) and takes every stroke property above. Its `shape` takes every preset (`rectangle`, `rounded` and `circle` became `rect`, `roundRect` and `ellipse`), and `adjust` replaces `cornerRadius`. See [image treatments](image-treatments.md).

## Validation

| Finding | When |
|---|---|
| `opf/schema` | `shape` is not a preset name (the nearest names are offered as fixes), or a property has the wrong form. |
| `opf/shape-adjust-unknown` | `adjust` names a guide the preset does not have, or sits on a custom `path`. |
| `opf/shape-adjust-range` | An adjust value is outside its handle's range; the default is drawn. |
| `opf/text-overflow` | The text does not fit inside the shape at the readable minimum size. |
| `opf/shape-link-hidden` | A hidden shape has a link nobody can click. |
| `opf/shape-option-unsupported-payload` | A shape-only property (`fill`, `style`, `rotate` and the others) is on a block that is not a shape. |

## Property map

OPF names, the DrawingML that PowerPoint reads and writes, and Aspose.Slides names (for readers who know that API; OPF does not use them).

| What | OPF | PowerPoint (DrawingML) | Aspose |
| --- | --- | --- | --- |
| Preset shape | `shape: "chevron"` (a shape block) | `a:prstGeom prst` | `ShapeType` |
| Adjust handles | `adjust: { "adj1": 0.25 }` (fractions and degrees) | `a:avLst/a:gd` | `Adjustments` |
| Custom outline | `path` (SVG path data in a 0 to 1 box, or with a viewBox) | `a:custGeom` | `GeometryPath`, `ShapeType.Custom` |
| No fill | `fill: "none"` | `a:noFill` | `FillType.NoFill` |
| Solid fill | `fill: <ColorRef>` | `a:solidFill` | `SolidFillColor` |
| Opacity | `opacity` 0 to 1 (fill), or 8-digit hex | `a:alpha` | color alpha |
| Gradient | `fill: { gradient: { type, angle, stops } }` | `a:gradFill` (`a:lin`, `a:path`) | `GradientFormat` |
| Pattern | `fill: { pattern: { preset, foregroundColor, backgroundColor } }` | `a:pattFill` | `PatternFormat` |
| Picture inside a shape | an image block's `shape` (every preset) | `a:blipFill` in `a:prstGeom` | `PictureFillFormat` |
| Fill rotates with shape | always on | `rotWithShape="1"` | `RotateWithShape` |
| Lighter or darker color | `{ color, lighten }` / `{ color, darken }` | `a:lumMod`/`a:lumOff` | color transforms |
| Stroke | `stroke` (shapes and pictures) | `a:ln` | `LineFormat` |
| Stroke color | `stroke.color` or `stroke.gradient` | `a:ln/a:solidFill`, `a:ln/a:gradFill` | `LineFormat.FillFormat` |
| Stroke width | `stroke.width` | `a:ln w` | `Width` |
| Dash | `stroke.dash` (preset or array) | `a:prstDash`, `a:custDash` | `DashStyle`, `CustomDashPattern` |
| Cap | `stroke.cap` | `a:ln cap` | `CapStyle` |
| Join | `stroke.join`, `stroke.miterLimit` | `a:miter lim`, `a:round`, `a:bevel` | `JoinStyle`, `MiterLimit` |
| Compound | `stroke.compound` | `a:ln cmpd` | `Style` |
| Alignment | `stroke.align` | `a:ln algn` | `Alignment` |
| Arrowheads | `stroke.start`, `stroke.end` | `a:headEnd`, `a:tailEnd` | `BeginArrowhead*`, `EndArrowhead*` |
| Hand-drawn | `stroke.sketch` | `ask:lineSketchStyleProps` | `SketchFormat` |
| Theme style | `style` | `p:style` | `ShapeStyle` |
| Outer shadow | `shadow` | `a:outerShdw` | `OuterShadowEffect` |
| Inner shadow | `innerShadow` | `a:innerShdw` | `InnerShadowEffect` |
| Glow | `glow` | `a:glow` | `GlowEffect` |
| Soft edges | `softEdge` | `a:softEdge` | `SoftEdgeEffect` |
| Reflection | `reflection` | `a:reflection` | `ReflectionEffect` |
| Blur | `blur` | `a:blur` | `BlurEffect` |
| Rotation | `rotate` | `a:xfrm rot` | `Rotation` |
| Flip | `flip` | `flipH`, `flipV` | `FlipH`, `FlipV` |
| Overlay placement | slide-level `shapes: [...]` placed by fractions or attached to a block (SH-04) | `a:xfrm a:off a:ext` | `X`, `Y`, `Width`, `Height` |
| Stacking | array order | shape tree order | `ZOrderPosition` |
| Text | `text` | `p:txBody` | `TextFrame` |
| Vertical anchor | `anchor` | `a:bodyPr anchor` | `AnchoringType` |
| Margins | `padding` | `lIns`, `tIns`, `rIns`, `bIns` | `MarginLeft` and others |
| Vertical text | `textDirection` | `a:bodyPr vert` | `TextVerticalType` |
| Alt text | `alt` | `p:cNvPr descr` | `AlternativeText` |
| Decorative | `decorative: true` | `adec:decorative` | `IsDecorative` |
| Name | from the block's path | `p:cNvPr name` | `Name` |
| Hidden | `hidden: true` | `p:cNvPr hidden` | `Hidden` |
| Click link | `link` | `a:hlinkClick` | `HyperlinkClick` |
| Connector | `connector: { from, to, route, stroke }` among slide-level `shapes` (SH-04) | `p:cxnSp`, `a:stCxn`, `a:endCxn` | `Connector`, `ConnectorType` |
| Connection site | the nearest facing site; `fromSite`/`toSite` to override (SH-04) | `idx` | `StartShapeConnectionSiteIndex` |

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

| Preset | Aspose `ShapeType` | Default frame | Adjust values: default (range) |
|---|---|---|---|
| `accentBorderCallout1` | `Callout1WithBorderAndAccent` | 3:2 | `adj1` 0.1875 (any), `adj2` -0.08333 (any), `adj3` 1.125 (any), `adj4` -0.38333 (any) |
| `accentBorderCallout2` | `Callout2WithBorderAndAccent` | 3:2 | `adj1` 0.1875 (any), `adj2` -0.08333 (any), `adj3` 0.1875 (any), `adj4` -0.16667 (any), `adj5` 1.125 (any), `adj6` -0.46667 (any) |
| `accentBorderCallout3` | `Callout3WithBorderAndAccent` | 3:2 | `adj1` 0.1875 (any), `adj2` -0.08333 (any), `adj3` 0.1875 (any), `adj4` -0.16667 (any), `adj5` 1 (any), `adj6` -0.16667 (any), `adj7` 1.12963 (any), `adj8` -0.08333 (any) |
| `accentCallout1` | `Callout1WithAccent` | 3:2 | `adj1` 0.1875 (any), `adj2` -0.08333 (any), `adj3` 1.125 (any), `adj4` -0.38333 (any) |
| `accentCallout2` | `Callout2WithAccent` | 3:2 | `adj1` 0.1875 (any), `adj2` -0.08333 (any), `adj3` 0.1875 (any), `adj4` -0.16667 (any), `adj5` 1.125 (any), `adj6` -0.46667 (any) |
| `accentCallout3` | `Callout3WithAccent` | 3:2 | `adj1` 0.1875 (any), `adj2` -0.08333 (any), `adj3` 0.1875 (any), `adj4` -0.16667 (any), `adj5` 1 (any), `adj6` -0.16667 (any), `adj7` 1.12963 (any), `adj8` -0.08333 (any) |
| `actionButtonBackPrevious` | `BackOrPreviousButton` | 1:1 | none |
| `actionButtonBeginning` | `BeginningButton` | 1:1 | none |
| `actionButtonBlank` | `BlankButton` | 1:1 | none |
| `actionButtonDocument` | `DocumentButton` | 1:1 | none |
| `actionButtonEnd` | `EndButton` | 1:1 | none |
| `actionButtonForwardNext` | `ForwardOrNextButton` | 1:1 | none |
| `actionButtonHelp` | `HelpButton` | 1:1 | none |
| `actionButtonHome` | `HomeButton` | 1:1 | none |
| `actionButtonInformation` | `InformationButton` | 1:1 | none |
| `actionButtonMovie` | `MovieButton` | 1:1 | none |
| `actionButtonReturn` | `ReturnButton` | 1:1 | none |
| `actionButtonSound` | `SoundButton` | 1:1 | none |
| `arc` | `Arc` | 1:1 | `adj1` 270° (0 to 359.99998), `adj2` 0° (0 to 359.99998) |
| `bentArrow` | `BentArrow` | 1:1 | `adj1` 0.25 (0 to 0.5), `adj2` 0.25 (0 to 0.5), `adj3` 0.25 (0 to 0.5), `adj4` 0.4375 (0 to 0.75) |
| `bentConnector2` | `BentConnector2` | 2:1 | none |
| `bentConnector3` | `BentConnector3` | 2:1 | `adj1` 0.5 (any) |
| `bentConnector4` | `BentConnector4` | 2:1 | `adj1` 0.5 (any), `adj2` 0.5 (any) |
| `bentConnector5` | `BentConnector5` | 2:1 | `adj1` 0.5 (any), `adj2` 0.5 (any), `adj3` 0.5 (any) |
| `bentUpArrow` | `BentUpArrow` | 1:1 | `adj1` 0.25 (0 to 0.5), `adj2` 0.25 (0 to 0.5), `adj3` 0.25 (0 to 0.5) |
| `bevel` | `Bevel` | 1:1 | `adj` 0.125 (0 to 0.5) |
| `blockArc` | `BlockArc` | 1:1 | `adj1` 180° (0 to 359.99998), `adj2` 0° (0 to 359.99998), `adj3` 0.25 (0 to 0.5) |
| `borderCallout1` | `Callout1WithBorder` | 3:2 | `adj1` 0.1875 (any), `adj2` -0.08333 (any), `adj3` 1.125 (any), `adj4` -0.38333 (any) |
| `borderCallout2` | `Callout2WithBorder` | 3:2 | `adj1` 0.1875 (any), `adj2` -0.08333 (any), `adj3` 0.1875 (any), `adj4` -0.16667 (any), `adj5` 1.125 (any), `adj6` -0.46667 (any) |
| `borderCallout3` | `Callout3WithBorder` | 3:2 | `adj1` 0.1875 (any), `adj2` -0.08333 (any), `adj3` 0.1875 (any), `adj4` -0.16667 (any), `adj5` 1 (any), `adj6` -0.16667 (any), `adj7` 1.12963 (any), `adj8` -0.08333 (any) |
| `bracePair` | `BracePair` | 2:1 | `adj` 0.08333 (0 to 0.25) |
| `bracketPair` | `BracketPair` | 2:1 | `adj` 0.16667 (0 to 0.5) |
| `callout1` | `Callout1` | 3:2 | `adj1` 0.1875 (any), `adj2` -0.08333 (any), `adj3` 1.125 (any), `adj4` -0.38333 (any) |
| `callout2` | `Callout2` | 3:2 | `adj1` 0.1875 (any), `adj2` -0.08333 (any), `adj3` 0.1875 (any), `adj4` -0.16667 (any), `adj5` 1.125 (any), `adj6` -0.46667 (any) |
| `callout3` | `Callout3` | 3:2 | `adj1` 0.1875 (any), `adj2` -0.08333 (any), `adj3` 0.1875 (any), `adj4` -0.16667 (any), `adj5` 1 (any), `adj6` -0.16667 (any), `adj7` 1.12963 (any), `adj8` -0.08333 (any) |
| `can` | `Can` | 1:2 | `adj` 0.25 (0 to 0.5) |
| `chartPlus` | `ChartPlus` | 1:1 | none |
| `chartStar` | `ChartStar` | 1:1 | none |
| `chartX` | `ChartX` | 1:1 | none |
| `chevron` | `Chevron` | 2:1 | `adj` 0.5 (0 to 1) |
| `chord` | `Chord` | 1:1 | `adj1` 45° (0 to 359.99998), `adj2` 270° (0 to 359.99998) |
| `circularArrow` | `CircularArrow` | 1:1 | `adj1` 0.125 (0 to 0.25), `adj2` 19.03865° (0 to 56.44269), `adj3` 340.96135° (0 to 359.99998), `adj4` 180° (0 to 359.99998), `adj5` 0.125 (0 to 0.25) |
| `cloud` | `Cloud` | 1:1 | none |
| `cloudCallout` | `CloudCallout` | 3:2 | `adj1` -0.20833 (any), `adj2` 0.625 (any) |
| `corner` | `Corner` | 1:1 | `adj1` 0.5 (0 to 1), `adj2` 0.5 (0 to 1) |
| `cornerTabs` | `CornerTabs` | 1:1 | none |
| `cube` | `Cube` | 1:1 | `adj` 0.25 (0 to 1) |
| `curvedConnector2` | `CurvedConnector2` | 2:1 | none |
| `curvedConnector3` | `CurvedConnector3` | 2:1 | `adj1` 0.5 (any) |
| `curvedConnector4` | `CurvedConnector4` | 2:1 | `adj1` 0.5 (any), `adj2` 0.5 (any) |
| `curvedConnector5` | `CurvedConnector5` | 2:1 | `adj1` 0.5 (any), `adj2` 0.5 (any), `adj3` 0.5 (any) |
| `curvedDownArrow` | `CurvedDownArrow` | 2:1 | `adj1` 0.25 (0 to 0.5), `adj2` 0.5 (0 to 0.5), `adj3` 0.25 (0 to 0.91652) |
| `curvedLeftArrow` | `CurvedLeftArrow` | 1:2 | `adj1` 0.25 (0 to 0.5), `adj2` 0.5 (0 to 0.5), `adj3` 0.25 (0 to 0.91652) |
| `curvedRightArrow` | `CurvedRightArrow` | 1:2 | `adj1` 0.25 (0 to 0.5), `adj2` 0.5 (0 to 0.5), `adj3` 0.25 (0 to 0.91652) |
| `curvedUpArrow` | `CurvedUpArrow` | 2:1 | `adj1` 0.25 (0 to 0.5), `adj2` 0.5 (0 to 0.5), `adj3` 0.25 (0 to 0.91652) |
| `decagon` | `Decagon` | 1:1 | `vf` 1.05146 (any) |
| `diagStripe` | `DiagonalStripe` | 1:1 | `adj` 0.5 (0 to 1) |
| `diamond` | `Diamond` | 1:1 | none |
| `dodecagon` | `Dodecagon` | 1:1 | none |
| `donut` | `Donut` | 1:1 | `adj` 0.25 (0 to 0.5) |
| `doubleWave` | `DoubleWave` | 2:1 | `adj1` 0.0625 (0 to 0.125), `adj2` 0 (-0.1 to 0.1) |
| `downArrow` | `DownArrow` | 1:2 | `adj1` 0.5 (0 to 1), `adj2` 0.5 (0 to 1) |
| `downArrowCallout` | `CalloutDownArrow` | 3:2 | `adj1` 0.25 (0 to 0.5), `adj2` 0.25 (0 to 0.5), `adj3` 0.25 (0 to 1), `adj4` 0.64977 (0 to 0.75) |
| `ellipse` | `Ellipse` | 1:1 | none |
| `ellipseRibbon` | `EllipseRibbon` | 2:1 | `adj1` 0.25 (0 to 1), `adj2` 0.5 (0.25 to 0.75), `adj3` 0.125 (0 to 0.25) |
| `ellipseRibbon2` | `EllipseRibbon2` | 2:1 | `adj1` 0.25 (0 to 1), `adj2` 0.5 (0.25 to 1), `adj3` 0.125 (0 to 0.25) |
| `flowChartAlternateProcess` | `FlowChartAlternateProcess` | 3:2 | none |
| `flowChartCollate` | `FlowChartCollate` | 1:1 | none |
| `flowChartConnector` | `FlowChartConnector` | 1:1 | none |
| `flowChartDecision` | `FlowChartDecision` | 1:1 | none |
| `flowChartDelay` | `FlowChartDelay` | 3:2 | none |
| `flowChartDisplay` | `FlowChartDisplay` | 3:2 | none |
| `flowChartDocument` | `FlowChartDocument` | 3:2 | none |
| `flowChartExtract` | `FlowChartExtract` | 1:1 | none |
| `flowChartInputOutput` | `FlowChartInputOutput` | 3:2 | none |
| `flowChartInternalStorage` | `FlowChartInternalStorage` | 3:2 | none |
| `flowChartMagneticDisk` | `FlowChartMagneticDisk` | 3:2 | none |
| `flowChartMagneticDrum` | `FlowChartMagneticDrum` | 3:2 | none |
| `flowChartMagneticTape` | `FlowChartMagneticTape` | 3:2 | none |
| `flowChartManualInput` | `FlowChartManualInput` | 3:2 | none |
| `flowChartManualOperation` | `FlowChartManualOperation` | 3:2 | none |
| `flowChartMerge` | `FlowChartMerge` | 1:1 | none |
| `flowChartMultidocument` | `FlowChartMultidocument` | 3:2 | none |
| `flowChartOfflineStorage` | `FlowChartOfflineStorage` | 1:1 | none |
| `flowChartOffpageConnector` | `FlowChartOffpageConnector` | 3:2 | none |
| `flowChartOnlineStorage` | `FlowChartOnlineStorage` | 3:2 | none |
| `flowChartOr` | `FlowChartOr` | 1:1 | none |
| `flowChartPredefinedProcess` | `FlowChartPredefinedProcess` | 3:2 | none |
| `flowChartPreparation` | `FlowChartPreparation` | 3:2 | none |
| `flowChartProcess` | `FlowChartProcess` | 3:2 | none |
| `flowChartPunchedCard` | `FlowChartPunchedCard` | 3:2 | none |
| `flowChartPunchedTape` | `FlowChartPunchedTape` | 2:1 | none |
| `flowChartSort` | `FlowChartSort` | 1:1 | none |
| `flowChartSummingJunction` | `FlowChartSummingJunction` | 1:1 | none |
| `flowChartTerminator` | `FlowChartTerminator` | 2:1 | none |
| `foldedCorner` | `FoldedCorner` | 1:1 | `adj` 0.16667 (0 to 0.5) |
| `frame` | `Frame` | 1:1 | `adj1` 0.125 (0 to 0.5) |
| `funnel` | `Funnel` | 1:1 | none |
| `gear6` | `Gear6` | 1:1 | `adj1` 0.15 (0 to 0.2), `adj2` 0.03526 (0 to 0.05358) |
| `gear9` | `Gear9` | 1:1 | `adj1` 0.1 (0 to 0.2), `adj2` 0.01763 (0 to 0.02679) |
| `halfFrame` | `HalfFrame` | 1:1 | `adj1` 0.33333 (0 to 0.66667), `adj2` 0.33333 (0 to 1) |
| `heart` | `Heart` | 1:1 | none |
| `heptagon` | `Heptagon` | 1:1 | `hf` 1.02572 (any), `vf` 1.0521 (any) |
| `hexagon` | `Hexagon` | 1:1 | `adj` 0.25 (0 to 0.5), `vf` 1.1547 (any) |
| `homePlate` | `HomePlate` | 2:1 | `adj` 0.5 (0 to 1) |
| `horizontalScroll` | `HorizontalScroll` | 2:1 | `adj` 0.125 (0 to 0.25) |
| `irregularSeal1` | `IrregularSeal1` | 1:1 | none |
| `irregularSeal2` | `IrregularSeal2` | 1:1 | none |
| `leftArrow` | `LeftArrow` | 2:1 | `adj1` 0.5 (0 to 1), `adj2` 0.5 (0 to 1) |
| `leftArrowCallout` | `CalloutLeftArrow` | 3:2 | `adj1` 0.25 (0 to 0.5), `adj2` 0.25 (0 to 0.5), `adj3` 0.25 (0 to 1), `adj4` 0.64977 (0 to 0.75) |
| `leftBrace` | `LeftBrace` | 1:2 | `adj1` 0.08333 (0 to 0.25), `adj2` 0.5 (0 to 1) |
| `leftBracket` | `LeftBracket` | 1:2 | `adj` 0.08333 (0 to 0.5) |
| `leftCircularArrow` | `LeftCircularArrow` | 1:1 | `adj1` 0.125 (0 to 0.25), `adj2` -19.03865° (-56.44269 to 0), `adj3` 19.03865° (0 to 359.99998), `adj4` 180° (0 to 359.99998), `adj5` 0.125 (0 to 0.25) |
| `leftRightArrow` | `LeftRightArrow` | 2:1 | `adj1` 0.5 (0 to 1), `adj2` 0.5 (0 to 0.5) |
| `leftRightArrowCallout` | `CalloutLeftRightArrow` | 2:1 | `adj1` 0.25 (0 to 0.5), `adj2` 0.25 (0 to 0.5), `adj3` 0.25 (0 to 0.5), `adj4` 0.48123 (0 to 0.5) |
| `leftRightCircularArrow` | `LeftRightCircularArrow` | 1:1 | `adj1` 0.125 (0 to 0.25), `adj2` 19.03865° (0 to 56.44269), `adj3` 340.96135° (0 to 359.99998), `adj4` 199.03865° (0 to 359.99998), `adj5` 0.125 (0 to 0.25) |
| `leftRightRibbon` | `LeftRightRibbon` | 2:1 | `adj1` 0.5 (0 to 0.83333), `adj2` 0.5 (0 to 0.46875), `adj3` 0.16667 (0 to 0.33333) |
| `leftRightUpArrow` | `LeftRightUpArrow` | 1:1 | `adj1` 0.25 (0 to 0.5), `adj2` 0.25 (0 to 0.5), `adj3` 0.25 (0 to 0.25) |
| `leftUpArrow` | `LeftUpArrow` | 1:1 | `adj1` 0.25 (0 to 0.5), `adj2` 0.25 (0 to 0.5), `adj3` 0.25 (0 to 0.5) |
| `lightningBolt` | `LightningBolt` | 1:1 | none |
| `line` | `Line` | 2:1 | none |
| `lineInv` | `LineInverse` | 2:1 | none |
| `mathDivide` | `MathDivide` | 1:1 | `adj1` 0.2352 (0.01 to 0.36745), `adj2` 0.0588 (0 to 0.0293), `adj3` 0.1176 (0.01 to 0.12493) |
| `mathEqual` | `MathEqual` | 1:1 | `adj1` 0.2352 (0 to 0.36745), `adj2` 0.1176 (0 to 0.5296) |
| `mathMinus` | `MathMinus` | 1:1 | `adj1` 0.2352 (0 to 1) |
| `mathMultiply` | `MathMultiply` | 1:1 | `adj1` 0.2352 (0 to 0.51965) |
| `mathNotEqual` | `MathNotEqual` | 1:1 | `adj1` 0.2352 (0 to 0.5), `adj2` 110° (70 to 110), `adj3` 0.1176 (0 to 0.5296) |
| `mathPlus` | `MathPlus` | 1:1 | `adj1` 0.2352 (0 to 0.7349) |
| `moon` | `Moon` | 1:1 | `adj` 0.5 (0 to 0.875) |
| `nonIsoscelesTrapezoid` | `NonIsoscelesTrapezoid` | 3:2 | `adj1` 0.25 (0 to 0.5), `adj2` 0.25 (0 to 0.5) |
| `noSmoking` | `NoSmoking` | 1:1 | `adj` 0.1875 (0 to 0.5) |
| `notchedRightArrow` | `NotchedRightArrow` | 2:1 | `adj1` 0.5 (0 to 1), `adj2` 0.5 (0 to 1) |
| `octagon` | `Octagon` | 1:1 | `adj` 0.29289 (0 to 0.5) |
| `parallelogram` | `Parallelogram` | 3:2 | `adj` 0.25 (0 to 1) |
| `pentagon` | `Pentagon` | 1:1 | `hf` 1.05146 (any), `vf` 1.10557 (any) |
| `pie` | `Pie` | 1:1 | `adj1` 0° (0 to 359.99998), `adj2` 270° (0 to 359.99998) |
| `pieWedge` | `PieWedge` | 1:1 | none |
| `plaque` | `Plaque` | 3:2 | `adj` 0.16667 (0 to 0.5) |
| `plaqueTabs` | `PlaqueTabs` | 1:1 | none |
| `plus` | `Plus` | 1:1 | `adj` 0.25 (0 to 0.5) |
| `quadArrow` | `QuadArrow` | 1:1 | `adj1` 0.225 (0 to 0.45), `adj2` 0.225 (0 to 0.5), `adj3` 0.225 (0 to 0.275) |
| `quadArrowCallout` | `CalloutQuadArrow` | 1:1 | `adj1` 0.18515 (0 to 0.3703), `adj2` 0.18515 (0 to 0.5), `adj3` 0.18515 (0 to 0.31485), `adj4` 0.48123 (0.18515 to 0.6297) |
| `rect` | `Rectangle` | 3:2 | none |
| `ribbon` | `Ribbon` | 2:1 | `adj1` 0.16667 (0 to 0.33333), `adj2` 0.5 (0.25 to 0.75) |
| `ribbon2` | `Ribbon2` | 2:1 | `adj1` 0.16667 (0 to 0.33333), `adj2` 0.5 (0.25 to 0.75) |
| `rightArrow` | `RightArrow` | 2:1 | `adj1` 0.5 (0 to 1), `adj2` 0.5 (0 to 1) |
| `rightArrowCallout` | `CalloutRightArrow` | 3:2 | `adj1` 0.25 (0 to 0.5), `adj2` 0.25 (0 to 0.5), `adj3` 0.25 (0 to 1), `adj4` 0.64977 (0 to 0.75) |
| `rightBrace` | `RightBrace` | 1:2 | `adj1` 0.08333 (0 to 0.25), `adj2` 0.5 (0 to 1) |
| `rightBracket` | `RightBracket` | 1:2 | `adj` 0.08333 (0 to 0.5) |
| `round1Rect` | `OneRoundCornerRectangle` | 3:2 | `adj` 0.16667 (0 to 0.5) |
| `round2DiagRect` | `TwoDiagonalRoundCornerRectangle` | 3:2 | `adj1` 0.16667 (0 to 0.5), `adj2` 0 (0 to 0.5) |
| `round2SameRect` | `TwoSamesideRoundCornerRectangle` | 3:2 | `adj1` 0.16667 (0 to 0.5), `adj2` 0 (0 to 0.5) |
| `roundRect` | `RoundCornerRectangle` | 3:2 | `adj` 0.16667 (0 to 0.5) |
| `rtTriangle` | `RightTriangle` | 1:1 | none |
| `smileyFace` | `SmileyFace` | 1:1 | `adj` 0.04653 (-0.04653 to 0.04653) |
| `snip1Rect` | `OneSnipCornerRectangle` | 3:2 | `adj` 0.16667 (0 to 0.5) |
| `snip2DiagRect` | `TwoDiagonalSnipCornerRectangle` | 3:2 | `adj1` 0 (0 to 0.5), `adj2` 0.16667 (0 to 0.5) |
| `snip2SameRect` | `TwoSamesideSnipCornerRectangle` | 3:2 | `adj1` 0.16667 (0 to 0.5), `adj2` 0 (0 to 0.5) |
| `snipRoundRect` | `OneSnipOneRoundCornerRectangle` | 3:2 | `adj1` 0.16667 (0 to 0.5), `adj2` 0.16667 (0 to 0.5) |
| `squareTabs` | `SquareTabs` | 1:1 | none |
| `star10` | `TenPointedStar` | 1:1 | `adj` 0.42533 (0 to 0.5), `hf` 1.05146 (any) |
| `star12` | `TwelvePointedStar` | 1:1 | `adj` 0.375 (0 to 0.5) |
| `star16` | `SixteenPointedStar` | 1:1 | `adj` 0.375 (0 to 0.5) |
| `star24` | `TwentyFourPointedStar` | 1:1 | `adj` 0.375 (0 to 0.0005) |
| `star32` | `ThirtyTwoPointedStar` | 1:1 | `adj` 0.375 (0 to 0.0005) |
| `star4` | `FourPointedStar` | 1:1 | `adj` 0.125 (0 to 0.5) |
| `star5` | `FivePointedStar` | 1:1 | `adj` 0.19098 (0 to 0.5), `hf` 1.05146 (any), `vf` 1.10557 (any) |
| `star6` | `SixPointedStar` | 1:1 | `adj` 0.28868 (0 to 0.5), `hf` 1.1547 (any) |
| `star7` | `SevenPointedStar` | 1:1 | `adj` 0.34601 (0 to 0.5), `hf` 1.02572 (any), `vf` 1.0521 (any) |
| `star8` | `EightPointedStar` | 1:1 | `adj` 0.375 (0 to 0.5) |
| `straightConnector1` | `StraightConnector1` | 2:1 | none |
| `stripedRightArrow` | `StripedRightArrow` | 2:1 | `adj1` 0.5 (0 to 1), `adj2` 0.5 (0 to 0.84375) |
| `sun` | `Sun` | 1:1 | `adj` 0.25 (0.125 to 0.46875) |
| `swooshArrow` | `SwooshArrow` | 2:1 | `adj1` 0.25 (0.00001 to 0.75), `adj2` 0.16667 (0 to 0.7) |
| `teardrop` | `Teardrop` | 1:1 | `adj` 1 (0 to 2) |
| `trapezoid` | `Trapezoid` | 3:2 | `adj` 0.25 (0 to 0.5) |
| `triangle` | `Triangle` | 1:1 | `adj` 0.5 (0 to 1) |
| `upArrowCallout` | `CalloutUpArrow` | 3:2 | `adj1` 0.25 (0 to 0.5), `adj2` 0.25 (0 to 0.5), `adj3` 0.25 (0 to 1), `adj4` 0.64977 (0 to 0.75) |
| `upDownArrow` | `UpDownArrow` | 1:2 | `adj1` 0.5 (0 to 1), `adj2` 0.5 (0 to 0.5) |
| `upArrow` | `UpArrow` | 1:2 | `adj1` 0.5 (0 to 1), `adj2` 0.5 (0 to 1) |
| `upDownArrowCallout` | `CalloutUpDownArrow` | 1:2 | `adj1` 0.25 (0 to 0.5), `adj2` 0.25 (0 to 0.5), `adj3` 0.25 (0 to 0.5), `adj4` 0.48123 (0 to 0.5) |
| `uturnArrow` | `UTurnArrow` | 1:1 | `adj1` 0.25 (0 to 0.5), `adj2` 0.25 (0 to 0.25), `adj3` 0.25 (0 to 0.75), `adj4` 0.4375 (0 to 0.4375), `adj5` 0.75 (0.5 to 1) |
| `verticalScroll` | `VerticalScroll` | 1:2 | `adj` 0.125 (0 to 0.25) |
| `wave` | `Wave` | 2:1 | `adj1` 0.125 (0 to 0.2), `adj2` 0 (-0.1 to 0.1) |
| `wedgeEllipseCallout` | `OvalCallout` | 3:2 | `adj1` -0.20833 (any), `adj2` 0.625 (any) |
| `wedgeRectCallout` | `RectangularCallout` | 3:2 | `adj1` -0.20833 (any), `adj2` 0.625 (any) |
| `wedgeRoundRectCallout` | `RoundedRectangularCallout` | 3:2 | `adj1` -0.20833 (any), `adj2` 0.625 (any), `adj3` 0.16667 (any) |
