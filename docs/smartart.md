# Pyramids, matrices and live SmartArt

Two layouts of the default catalog draw a list as a diagram: `pyramid` (levels that build on each other, the first entry at the top)
and `matrix` (up to four parts of a whole, as the quadrants of a square). The PowerPoint export writes them as **live SmartArt** where
PowerPoint lays the SmartArt out exactly as the preview draws it, and as the same drawing in native shapes everywhere else.

```json
{ "layout": "pyramid", "title": "Our strategy", "items": ["Vision", "Goals", "Programs", "Teams"] }
```

```json
{ "layout": "matrix", "title": "Four markets", "items": ["Enterprise", "Mid-market", "Consumer", "Public sector"] }
```

## The arrangement of a region

A layout record's region takes `arrangement: "pyramid"` or `"matrix"` ([layout templates](layout-templates.md)). When the region holds
one list of one level (no nested entries, no descriptions, no icons, no `numbering`) with at most 8 entries for a pyramid or 4 for a
matrix, composition draws it as that diagram (`SlideComposition.arrangements`, core `arrangements.ts`); anything else in the region
draws as it always does.

The geometry is PowerPoint's own for its Basic Pyramid (`pyramid1`) and Basic Matrix (`matrix3`) layouts, measured through COM:

| | Pyramid | Matrix |
| --- | --- | --- |
| Frame | the region's cell, at most 2.5 times as wide as tall (a wider cell centers such a frame) | the region's cell |
| Nodes | level i of n (from the top) is H/n tall and W·i/n wide, centered; the sides continue one slope, so the top level is a triangle and every other a trapezoid (DrawingML `trapezoid`, `adj` = W/(2n) over the smaller side) | a square of side min(W, H) centered in the frame holds a diamond and four rounded squares (`roundRect` at its default corner) 0.39 of its side, 0.095 in from its edges and 0.03 apart, in the order top left, top right, bottom left, bottom right; a quadrant without an entry is still drawn |
| Text rectangle | the top level's whole box; 0.65 of a lower level's width, centered, at its full height | the rounded square's own text rectangle |
| Text margin | 0.1 of the font size on every side | 0.3 of the font size on every side |
| Look | every level in the primary color (`accent1`) with a 1.5 pt outline in the background color (`bg1`) | the quadrants as the levels, over a diamond in the primary lightened 80% (`lumMod 20000`, `lumOff 80000`) |

The text of every node is one size: the largest from 1.5 times the list's role size (36 pt on a 16:9 slide) down to the role size
(24 pt) at which every entry fits its rectangle without breaking a word, and the ink of every line stays inside its node's outline (the
top of a pyramid level is narrower than its base). The list's own size counts when it is smaller (a crowded slide), never a size below
it. The arrangement fills its region, so the growth a lone list takes when it fills too little of the body (LH-48) is not the size it
keeps. When even the role size does not fit, the list draws as a list. Each entry is centered in its rectangle, its lines centered
without the space they broke at, in whichever of the background and the text color reads better on the primary.

## In PowerPoint

`toPptx(deck, { smartArt })` (CLI `--smart-art <live|shapes>`) takes the first that fits, as the owner decided for SmartArt:

1. **Live SmartArt** (`"live"`, the default), where the instance lies in the domain below. The slide holds a `p:graphicFrame` of the
   diagram (`dgm:relIds`), and the package:
   - the data model (`ppt/diagrams/dataN.xml`): the `doc` point names the layout (`loTypeId` pyramid1 or matrix3) and OPF's own quick
     style and colors (`qsTypeId` `urn:openpresentation.org/opf/smartart/quickstyle/flat`, `csTypeId`
     `urn:openpresentation.org/opf/smartart/colors/primary`); one point per entry, marked `custT="1"` so PowerPoint keeps the run size
     (and sets the text margins from it) instead of fitting the text again; runs with OPF's size, typeface and language; each paragraph
     centered at OPF's line pitch with no space before or after; one `cxn` per entry from the doc point, in entry order;
   - OPF's colors and quick style parts, whose style labels cover every label the two layouts use (`node0`, `node1`, `bgShp`, `revTx`
     and the transition labels: a label a part leaves out renders black), in the theme's scheme colors, so a theme change in PowerPoint
     recolors the SmartArt;
   - a drawing part built from OPF's geometry (`ppt/diagrams/drawingN.xml`), for readers that show the cached shapes;
   - **no layout part.** OPF never writes a SmartArt layout definition. `r:lo` is empty, and PowerPoint resolves its built-in layout
     from `loTypeId` (see [the layout relationship](#the-layout-relationship)).
2. **Native shapes** (`"shapes"`, or an instance outside the domain): the diamond and the nodes as presets (`diamond`, `trapezoid` with
   OPF's adjustment, `roundRect`) at OPF's boxes, under the list's measured lines, centered on their nodes. An instance that `"live"`
   could not write reports the info finding `pptx/smartart-unavailable` with the reason (`reason` in the diagnostic).

Both look the same as the preview: the shapes are exact, and the text is where OPF's native text export puts any text.

### What PowerPoint does on edit

PowerPoint lays a SmartArt out again from its data model whenever it opens or changes it; it never shows the cached drawing. A
SmartArt OPF wrote opens as live SmartArt: the Text Pane lists the entries, Change Layout switches it to any other SmartArt layout, and
Change Colors and the quick styles apply. When a node's text is edited, PowerPoint keeps OPF's explicit size for every node (it does not
shrink the text to fit), keeps the node rectangles, and wraps the text in the node with its own line breaker. A node added in the Text
Pane takes PowerPoint's default size.

### The domain

The PPTX export writes live SmartArt only for the instances the PowerPoint comparison passed (core `SMART_ART_DOMAIN`,
`smartArtUnavailable`):

DOMAIN_TABLE

### The gate

GATE_TEXT

### The layout relationship

LAYOUT_TEXT

## Import

A SmartArt OPF wrote (in `full` provenance it carries `OPF_SMARTART_V1`: the slide, the list path, the arrangement, the authored list
and the text of every node) imports as its list on its layout again when its node texts are unchanged. An edited one, and a Basic
Pyramid or Basic Matrix that PowerPoint wrote, import their data model's nodes: the points in `cxn` order (the top level only; nested
entries are reported as `smartart-flattened`), their text and run properties (bold, italic, underline, strike), as a list on the
`pyramid` or `matrix` layout, with `smartart-edited` for an edited OPF SmartArt. The diagram's place on the slide is its frame's;
the nodes' geometry is the layout's again, as OPF draws it, so nothing of PowerPoint's layout is kept. Import never reads or stores a
SmartArt layout part. Native-shape arrangements (`OPF_ARRANGEMENT_V1` on every node) are the layout's
drawing: import consumes them and reads the measured lines as the list. Other SmartArt layouts are SH-08.
