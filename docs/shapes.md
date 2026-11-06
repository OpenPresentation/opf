# Shapes

OPF draws the 187 DrawingML preset shapes of ECMA-376 Part 1 (`ST_ShapeType`), such as `rightArrow`, `chevron`,
`wedgeRectCallout` and `flowChartDecision`, under the standard's own names, and custom outlines given as SVG path data.
One geometry definition drives both engines: the preview evaluates the preset to SVG, and PPTX export writes the native
`a:prstGeom` with its `a:avLst`, so PowerPoint draws the shape from its own definition and the two match.

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
