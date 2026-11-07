# Pyramids, matrices and live SmartArt

Five layouts of the default catalog draw a list as a diagram: `pyramid` (levels that build on each other, the first entry at the top),
`matrix` (four parts of a whole, or the four cases of two choices, as quadrants), and [`chevrons`, `flow` and `vertical-flow`](#chevrons-and-flows)
(stages or steps in order). The PowerPoint export writes them as **live
SmartArt** where PowerPoint lays the SmartArt out exactly as the preview draws it, and as the same drawing in native shapes everywhere
else. A slide on either layout never turns into a stray bullet list: the arrangement has a second design of its own, drawn when
PowerPoint's does not hold the entries.

```json
{ "layout": "pyramid", "title": "Our strategy", "items": ["Vision", "Goals", "Programs", "Teams"] }
```

```json
{ "layout": "matrix", "title": "Four markets", "items": ["Enterprise", "Mid-market", "Consumer", "Public sector"] }
```

## The arrangement of a region

A layout record's region takes `arrangement: "pyramid"` or `"matrix"` ([layout templates](layout-templates.md)). When the region holds
one list of one level (no nested entries, no descriptions, no icons, no `numbering`), composition draws it as that diagram
(`SlideComposition.arrangements`, core `arrangements.ts`), in the first of these designs that holds every entry:

| Design (`design`) | Pyramid (1 to 8 entries) | Matrix |
| --- | --- | --- |
| PowerPoint's (`smartart`), where the PPTX export can write it as live SmartArt (the [domain](#the-domain)) | Basic Pyramid: level i of n is H/n tall and W·i/n wide, the apex a triangle, the entries centered on their levels | Basic Matrix, for exactly four entries: four rounded squares in a centered square over a diamond, the entries centered |
| OPF's own (`opf`), where PowerPoint's does not hold the entries at the list's size or lies outside the domain | a stepped pyramid of rounded bars at the start of the region (level i is i/n of the steps' width), each entry beside its level in one column, start-aligned | four rounded quadrants filling the region two by two (rectangular where the region is), the entries centered |
| A grid of cards (`cards`), for a matrix of other than four entries | — | one card per entry in the card neutral, in the grid that holds the text largest (one column of wide cards, or a balanced grid), start-aligned; reported as `opf/arrangement-adapted` (info): a matrix needs four entries |

When none of them holds the entries, or the list has a shape the arrangement does not draw (nested entries, descriptions, icons,
numbering, more than 8 levels or 8 cards), the list draws as a list and `opf/arrangement-adapted` (info) says why. A matrix never draws
an empty quadrant.

PowerPoint's geometry was measured through COM for its Basic Pyramid (`pyramid1`) and Basic Matrix (`matrix3`) layouts:

| | Pyramid | Matrix |
| --- | --- | --- |
| Frame | the region's cell, at most 2.5 times as wide as tall (a wider cell centers such a frame) | the region's cell |
| Nodes | level i of n (from the top) is H/n tall and W·i/n wide, centered; the sides continue one slope, so the top level is a triangle and every other a trapezoid (DrawingML `trapezoid`, `adj` = W/(2n) over the smaller side) | a square of side min(W, H) centered in the frame holds a diamond and four rounded squares (`roundRect` at its default corner) 0.39 of its side, 0.095 in from its edges and 0.03 apart, in the order top left, top right, bottom left, bottom right |
| Text rectangle | the top level's whole box; 0.65 of a lower level's width, centered, at its full height | the rounded square's own text rectangle |
| Text margin | 0.1 of the font size on every side | 0.3 of the font size on every side |
| Look | every level in the primary color (`accent1`) with a 1.5 pt outline in the background color (`bg1`) | the quadrants as the levels, over a diamond in the primary lightened 80% (`lumMod 20000`, `lumOff 80000`) |

OPF's designs use the same paint (the cards use the card neutral and its border, as every OPF card); text on a node is in whichever of
the background and the text color reads better on the primary, text beside a level or on a card in the slide's text color.

The text of every node is one size, in every design: the largest from 1.5 times the list's role size (36 pt on a 16:9 slide) down to the
role size (24 pt) at which every entry fits its rectangle without breaking a word, and the ink of every line stays inside its node's
outline (the top of a pyramid level is narrower than its base). The list's own size counts when it is smaller (a crowded slide), never a
size below it. The arrangement fills its region, so the growth a lone list takes when it fills too little of the body (LH-48) is not the
size it keeps. Centered lines are centered without the space they broke at, as PowerPoint wraps them.

## Chevrons and flows

Three more layouts draw a list of stages or steps in order (SH-17): `chevrons` (a row of chevrons, each leading into the next), `flow`
(boxes joined by arrows in one row) and `vertical-flow` (the same as a column, beside the title). Each is a region's `arrangement` of the
same name, with the same rules as a pyramid's: one list of one level, 1 to 8 short entries, one size for every node, never below the
list's role size.

```json
{ "layout": "chevrons", "title": "How we work", "items": ["Plan", "Build", "Test", "Ship"] }
```

| | Chevrons (Basic Chevron Process, `chevron1`) | Flow (Basic Process, `process1`) | Vertical flow (Vertical Process, `process2`) |
| --- | --- | --- | --- |
| Frame | the region's cell | the region's cell | the region's cell |
| Nodes | n chevrons of width w = s(n) W, height min(0.4 w, H), each 0.9 w after the last (the point of one in the notch of the next), the row centered | n boxes of width w = s(n) W, height min(0.6 w, H), each 1.4 w after the last, centered | n boxes of height h = s(n) H, width min(1.8 h, W), each 1.5 h below the last, centered |
| Shape | DrawingML `chevron` at its default adjustment (the point half the height deep) | `roundRect` at adjustment 10000 | the same |
| Arrows | none | a `rightArrow` (stem 0.6 of its height, the default head) 0.212 w long and 0.248 w tall, 0.1 w after the box before it, on the frame's middle | a `rightArrow` turned 90 degrees, 0.45 h wide and 0.375 h long, in the middle of the gap |
| Text rectangle | the chevron's own, between its notch and its point | the rounded rectangle's own | the same |
| Text margin | 0.315 of the font size at the start, 0.105 on the other sides | 0.3 of the font size on every side | the same |
| Look | every chevron in the primary with a 1.5 pt outline in the background color | the boxes as the chevrons; the arrows in the primary lightened 40% (`lumMod 60000`, `lumOff 40000`), without an outline | the same |

PowerPoint fits these layouts with a binary search on one scale and keeps the last step that fits, so a node is not the closed form
W / (0.9 n + 0.1) wide but a multiple of 1/8192 of the frame that depends only on the node count: s(n) (core `SMART_ART_SCALES`) is, in
1024ths of the frame, 1024, 538, 365.5, 276.5, 222.5, 186, 160 and 140.25 for 1 to 8 chevrons, 1024, 426.5, 269, 196.75, 155, 128,
108.875 and 94.75 for boxes in a row, and 1024, 409.5, 256, 186, 146.25, 120.375, 102.375 and 89 (of the frame's height) for boxes in a
column. Two chevrons at 800 pt are 420.31 pt wide where the closed form gives 421.05. One node squeezed by the other side of the frame
(a chevron in a frame less than 0.4 times as tall as wide) is 1023/1024 of the frame and as tall as it. The COM sweep measured 1 to 10
nodes of each in 20 frames from 250 x 120 to 800 x 540 pt; core places every node and arrow within 0.0001 pt of PowerPoint in all of them
but those where PowerPoint's 8 pt test letter did not fit a node (a node a few points tall), whose text made the node grow.

PowerPoint's design is drawn where it holds the entries at the list's size and lies in the [domain](#the-domain); else OPF's own design
of the arrangement, filling the region:

OPF's design keeps PowerPoint's proportions, so the two read as one family: a chevron 0.9 widths after the last (its point at
most 0.2 of its width deep), a box 0.4 widths after the last with PowerPoint's arrow (0.212 x 0.248 of a box's width) in the room, a
vertical box half its height below the last with a down arrow 0.45 x 0.375 of its height. The entries go into one to four rows (a
vertical flow: columns), whichever holds the text largest (one line on a tie), as evenly as possible, the longer lines first. The text
is one size for every node, the largest from 1.5 times the list's role size down to the role size at which every node holds its entry;
then every node takes the height that text needs with its margins (0.15 em above and below a box's text; PowerPoint's proportion at
least: a chevron 0.4 of its width, a box 0.6, a vertical box 1/1.8), and the whole is centered in the region. Only where none of these
holds the entries at the list's size does OPF draw a compact form of the same design (rooms of a gap and a half, the arrow 0.6 of the
room, a chevron's point 0.12 of its width deep, no least height), so a list is left a list only when no design holds it. Every row spans the region: a row of fewer entries widens them (a
column of fewer lengthens them).

- **chevrons**: each row a run of chevrons, left to right; a wrapped row breaks after a chevron's point and the next row starts again
  at the left, full width, so the points carry the order;
- **flow**: the rows snake: the second runs right to left under the first, joined by a down arrow under the end where the first stops,
  the third runs left to right again, and so on;
- **vertical flow**: the columns snake the same way: the second runs bottom to top, joined by a right arrow at the bottom.

A right-to-left deck mirrors the designs: the first chevron or box is at the right, the chevrons point left (`flipH`) and the arrows
turn.

## In PowerPoint

`toPptx(deck, { smartArt })` (CLI `--smart-art <live|shapes>`) takes the first that fits, as the owner decided for SmartArt:

1. **Live SmartArt** (`"live"`, the default), for PowerPoint's design where the instance lies in the domain below. The slide holds a `p:graphicFrame` of the
   diagram (`dgm:relIds`) inside an `mc:AlternateContent` whose `mc:Fallback` is OPF's picture of it ([in other apps](#in-other-apps)), and the package:
   - the data model (`ppt/diagrams/dataN.xml`): the `doc` point names the layout (`loTypeId` pyramid1, matrix3, chevron1, process1 or process2) and OPF's own quick
     style and colors (`qsTypeId` `urn:openpresentation.org/opf/smartart/quickstyle/flat`, `csTypeId`
     `urn:openpresentation.org/opf/smartart/colors/primary`); one point per entry, marked `custT="1"` so PowerPoint keeps the run size
     (and sets the text margins from it) instead of fitting the text again; runs with OPF's size, typeface and language; each paragraph
     centered at OPF's line pitch with no space before or after; one `cxn` per entry from the doc point, in entry order;
   - OPF's colors and quick style parts, whose style labels cover every label the five layouts use (`node0`, `node1`, `bgShp`, `revTx`
     and the transition labels: a label a part leaves out renders black; `sibTrans2D1`, a flow's arrows, is the primary lightened 40%
     without a line), in the theme's scheme colors, so a theme change in PowerPoint
     recolors the SmartArt;
   - a drawing part built from OPF's geometry (`ppt/diagrams/drawingN.xml`), for readers that show the cached shapes;
   - **no layout part.** OPF never writes a SmartArt layout definition. `r:lo` is empty, and PowerPoint resolves its built-in layout
     from `loTypeId` (see [the layout relationship](#the-layout-relationship));
   - the fallback picture: an SVG (`asvg:svgBlip`) over its PNG raster, the picture path SH-07's diagrams use.

   Live SmartArt needs that picture, so it needs opf-render (an optional peer) to draw the slide and an SVG rasterizer for the PNG (the
   default in Node is opf-render's; a browser passes `svgRasterizer`). Without either the arrangement is written as native shapes and
   `smartart-unavailable` says so.
2. **Native shapes**: OPF's design, a card grid, PowerPoint's design outside the domain, and everything with `"shapes"`. The diamond and
   the nodes are presets (`diamond`, `trapezoid` with core's adjustment, `roundRect`; SH-17: `chevron` with core's adjustment, mirrored
   with `flipH` in a right-to-left deck, and a flow's arrows as `rightArrow` with core's two adjustments, turned with `rot`) at core's boxes, under the list's measured lines,
   tagged `OPF_ARRANGEMENT_V1`. OPF's design and PowerPoint's outside the domain report the info finding `pptx/smartart-unavailable`
   with the reason (`reason` in the diagnostic); a card grid reports core's `arrangement-adapted`.

Both look the same as the preview: the shapes are exact, and the text is where OPF's native text export puts any text.

### In other apps

Many apps that open PPTX files do not lay SmartArt out. Each live SmartArt is therefore written as an `mc:AlternateContent` (ECMA-376
Part 3, markup compatibility): the `mc:Choice` holds the SmartArt frame and requires the namespace
`http://schemas.microsoft.com/office/drawing/2016/12/diagram` (prefix `dgm1612`, Office 2016's SmartArt extensions), and the
`mc:Fallback` holds a picture with the same id and name, at the same frame grown by its bleed on every side. **PowerPoint** understands the namespace and shows the live SmartArt.
**Every other app**, one that does not claim the namespace, takes the fallback and shows OPF's own drawing: the preview of that frame
(opf-render's SVG of the slide, cut to the arrangement and its entries, the text as glyph outlines in the deck's fonts when the export
has the fonts handle), transparent around the drawing, as an SVG with a PNG raster at 192 dpi of the frame for apps without SVG. The
bleed is how far the preview draws outside the frame: half of the nodes' outline, and further at a pyramid level's miter-joined corners
(its base corners reach 2.6 px past a 16:9 frame), plus a pixel of antialiasing, so the picture draws everything the preview draws. With
`typefaces: "safe"` the picture is laid out and drawn in the Office-safe families the export writes and lays the nodes out with (Arial
for the default Aptos), not the preview's. Its
alt text is the outline, one entry a line in entry order (`Pyramid of 4 levels, top to bottom:` then each level). SH-09's drawing part
stays in the package for readers that draw the cached SmartArt shapes.

The namespace was chosen through COM (PowerPoint for Microsoft 365 on Windows 11, 2026-11-06), on a pyramid and a matrix whose
`mc:Choice` required each candidate in turn: `dgm1612` (2016/12 diagram), `dgm1611` (2016/11 diagram), `dgm14` (2010 diagram),
`dsp` (2008 diagram drawing), `dgm` (the ECMA diagram namespace) and `p14` (PowerPoint 2010) all opened as live SmartArt
(`HasSmartArt`, Basic Pyramid or Basic Matrix, every entry a node, the slide exported as the SmartArt); a namespace PowerPoint does not
know took the fallback, which PowerPoint drew as the preview does (mean pixel difference 1.27 and 1.14 of 255 over the slide). The
chosen namespace is the narrowest of those: only Office's SmartArt uses it, whereas an app that reads the ECMA diagram markup or the
cached drawing, or claims the PowerPoint 2010 extensions, could claim the others without laying SmartArt out. No third-party app was
run (LibreOffice and the Open XML SDK were not installed); the pptx tests check the markup with a markup-compatibility reader that does
not know the namespace, which takes the fallback picture and finds a well-formed SVG and a PNG.

**Saved again in PowerPoint**, the file keeps the live SmartArt (COM: `SaveCopyAs`, reopened, `HasSmartArt` and every node) but not
the wrapper: PowerPoint writes the bare SmartArt frame and its own drawing and layout parts, and drops the fallback picture and its
media. Other apps then see what any PowerPoint-saved SmartArt gives them, typically its cached drawing. Import reads the file as
before.

### What PowerPoint does on edit

PowerPoint lays a SmartArt out again from its data model whenever it opens or changes it; it never shows the cached drawing. A
SmartArt OPF wrote opens as live SmartArt (COM: `HasSmartArt`, the layout, one node per entry in `AllNodes`), and Change Layout
switches it to another SmartArt layout. When a node's text is edited, PowerPoint keeps OPF's explicit size for every node (it does not
shrink the text to fit), keeps the node rectangles, and wraps the text in the node with its own line breaker.

### The domain

The PPTX export writes live SmartArt only for the instances the PowerPoint comparison passed (core `SMART_ART_DOMAIN`,
`smartArtUnavailable`):

| | Pyramid | Matrix |
| --- | --- | --- |
| Entries | 1 to 5 (6 to 8 levels never fitted the list's role size in the compared frames) | 1 to 4 |
| Frame proportions (width over height) | 1.1 to 2.3 (the 16:9, 4:3 and 1:1 slides gave 2.26, 1.64 and 1.17) | 0.8 to 1.2 (16:9 and 4:3 gave 1.13 and 0.83; the 1:1 slide's 0.58 is outside) |
| Lines | at most 2 for an entry and 6 for all of them, each break holding when the width changes by 4% (core fits every entry at both widths) | the same |
| Text | Latin script, left to right; runs bold, italic, underlined or struck through only (no links, citations, code or sizes of their own); no line breaks or tabs | the same |

Everything else (Arabic, Hebrew and Japanese text, longer or tighter entries, other proportions) is written as native shapes, which look
the same as the live SmartArt; the finding names the first reason.

### The gate

The domain comes from a PowerPoint sweep through COM (PowerPoint for Microsoft 365 on Windows 11, read-only, visible and minimized, quit
after each batch): a pyramid of 1 to 8 entries and a matrix of 1 to 4, with short, medium and long entries, on 16:9, 4:3 and 1:1 slides,
and an Arabic and a Japanese deck of each, 112 decks. The Latin decks use Source Sans 3, which OPF bundles and the comparison machine has
installed, so the preview and PowerPoint draw one font. Each deck was exported twice, live (`smartArt: "live"`) and as native shapes
(`"shapes"`), and both files were drawn by PowerPoint at the canvas's pixel size. An instance passes when:

1. PowerPoint opens it as live SmartArt of the right layout with every entry as a node;
2. every node rectangle PowerPoint lays out (`GroupItems`) is within 0.1 pt of core's;
3. every node's font size in PowerPoint equals OPF's;
4. the shapes show no visible difference from the preview (no 16 px block of the shapes' area outside the text whose mean differs by more
   than 24/255);
5. PowerPoint draws the live SmartArt as it draws OPF's native export of the same slide, within SH-07's native gate (mean absolute
   difference at most 1 at a quarter size and 2 at full size, at most 0.5% of blocks visibly different, the text's ink within 1.5 px).

The domain was set from a first pass, in which 38 decks drew PowerPoint's design live: in all 38 PowerPoint laid every node out where
core does (largest difference 0.000 pt) at core's size, with no visible difference in the shapes, and 33 passed every check. The five that
did not are the two Arabic decks (their text 6 px from where the native export draws it), the Japanese matrix (10 px) and two
four-quadrant matrices whose entries wrap (mean differences 1.1 and 1.22), which is why the domain leaves out right-to-left and Chinese or
Japanese text, entries of more than two lines and more than six lines in all.

With the domain and OPF's designs in place, the same 112 decks draw: PowerPoint's design as live SmartArt in 20 (every one passes: node
rectangles within 0.000 pt, sizes equal, no visible shape difference, the SmartArt within SH-07's gate of the native export), OPF's
design in 60, a card grid in 27 (the matrices of 1 to 3 entries) and a list in 5 (pyramids of 6 to 8 long levels on 4:3 and 1:1
slides, which no design holds at 24 pt; `opf/arrangement-adapted` says so). In every native-shape instance PowerPoint draws the shapes as
the preview does (mean difference at most 1.15 inside the shapes and outside the text, no visibly different block).

The text of a live SmartArt sits where OPF's native export puts any text, within a pixel. Both sit higher in PowerPoint than in the preview,
by about 0.15 em in Source Sans 3 and 0.07 em in Aptos (4 to 7 px at the 24 to 36 pt of these nodes): OPF's text model sets every
baseline one em below its line's top, and PowerPoint at a height that depends on the face. That difference is the same for every OPF text
box and is not SmartArt's; at the sizes of SH-07's diagram labels it is under the 1.5 px gate, at these sizes it is not, so the gate
compares the SmartArt with the native export, and the preview offset is recorded in the gate table. The evidence (the gate table, the
preview | PowerPoint | native export sheets and the COM records) is in the SH-09 build folder of the shapes program.

### The domain and the gate of chevrons and flows

The SH-17 sweep measured PowerPoint's own layout first (`AddSmartArt` through COM, 1 to 10 nodes in 20 frames per layout, the fitted
model above), then ran the gate above on OPF's exports: chevrons, a flow and a vertical flow of 1 to 8 entries, short, medium and long,
on 16:9, 4:3 and 1:1 slides, and an Arabic and a Japanese deck of each, 222 decks, each exported live and as native shapes and drawn by
PowerPoint. The domain (core `SMART_ART_DOMAIN`) is what passed:

| | Chevrons | Flow | Vertical flow |
| --- | --- | --- | --- |
| Entries | 1 to 6 (7 and 8 never fitted the list's size in PowerPoint's design) | 1 to 6 | 1 to 4 |
| Frame proportions | 1.1 to 2.3 (the 16:9, 4:3 and 1:1 slides gave 2.26, 1.64 and 1.17) | the same | 0.55 to 1.2 (the region beside the title: 1.13, 0.81 and 0.58) |
| Fill | no entry's lines more than 95% of its node's text height (less margins): PowerPoint lays a box nearly full of text out again, in the first pass at 0.969 and 0.996 of the height (node rectangles 0.22 and 5.3 pt off), while every box at 0.95 or less matched | the same | the same |
| Ink | the entries' text (each line's width times the size) at most 8% of the frame: PowerPoint sets a SmartArt's lines up to a pixel from where it sets OPF's native text (the same text in both), which in a frame dense with large text passes SH-07's mean-difference gate no longer (every first-pass failure of that check was at 0.082 or more) | the same | the same |
| Lines, text | as the pyramid's: at most 2 lines an entry and 6 in all, breaks that hold within 4% of the width, Latin left-to-right text with bold, italic, underline or strike only | the same | the same |

In the first pass, before the fill and ink limits, 88 decks drew PowerPoint's design live; every node lay exactly where core lays it
(0.000 pt) at core's size in 81, and 74 passed every check. The seven laid out again had nearly full text (the fill limit), and the
seven others that drew the SmartArt more than a mean of 1 from the native export were dense with large text (the ink limit). With the domain in
place: 63 decks draw live SmartArt, every one passing (node rectangles and arrows within 0.000 pt of core, sizes equal, no visible
difference in the shapes, within SH-07's gate of the native export), 151 draw OPF's own design and 8 stay a list (7 or 8 long chevrons and 8 long boxes on the 1:1 slide, and vertical flows of 6 to 8 long entries on the 4:3 and
1:1 slides, which no design holds at the list's size; `opf/arrangement-adapted` says so). Every native-shape instance PowerPoint draws as the preview
does: no visibly different block in the shapes, a mean difference of at most 2.7 outside the text (the outlines' antialiasing). The
Arabic and Japanese decks are OPF's design, as for the pyramid and matrix.

COM also showed, on two live instances of each (short and medium entries): `HasSmartArt`, the layout's name, every entry a node of
`AllNodes`; a node's text edited in PowerPoint keeps OPF's size in every node and every node rectangle; Change Layout to Basic Block List
keeps the nodes. With its `mc:Choice` requiring an unknown namespace, PowerPoint draws SH-16's fallback picture of each (mean difference
1.3 from the preview over the slide, about what it is for the live SmartArt). Import reads a Basic Chevron Process, Basic Process or
Vertical Process that PowerPoint itself wrote back to the `chevrons`, `flow` or `vertical-flow` layout and its list, from the data model.

### The layout relationship

The SH-09 spike found that PowerPoint resolves its built-in layout from the data model's `loTypeId` only when the package has no layout
part; a stub layout part with the built-in `uniqueId` is not resolved. The frame's `dgm:relIds` still names four relationships, and
there are three ways to point `r:lo` at nothing. All three open as live SmartArt in PowerPoint with the layout resolved, a node edit and
Change Layout working (the build checked each on a pyramid and a matrix):

| Form | What a validator sees | Chosen |
| --- | --- | --- |
| `r:lo=""` | the attribute the schema requires is present (`ST_RelationshipId` is a string), and an empty id can name no relationship (relationship ids are non-empty) | yes |
| `r:lo="rId99"`, no such relationship | a reference to a relationship the part does not have: a broken package reference | no |
| no `r:lo` attribute | the schema's required attribute is missing | no |

The empty id is the only form that is both schema-valid and names nothing that is missing. The Open XML SDK validator and LibreOffice were
not installed on the comparison machine, so neither was run.

## Import

A SmartArt OPF wrote (in `full` provenance it carries `OPF_SMARTART_V1`: the slide, the list path, the arrangement, the authored list
and the text of every node) imports as its list on its layout again when its node texts are unchanged. An edited one, and a Basic
Pyramid, Basic Matrix, Basic Chevron Process, Basic Process or Vertical Process that PowerPoint wrote, import their data model's nodes: the points in `cxn` order (the top level only; nested
entries are reported as `smartart-flattened`), their text and run properties (bold, italic, underline, strike), as a list on the
`pyramid`, `matrix`, `chevrons`, `flow` or `vertical-flow` layout (the one of the same arrangement), with `smartart-edited` for an edited OPF SmartArt. The diagram's place on the slide is its frame's;
the nodes' geometry is the layout's again, as OPF draws it, so nothing of PowerPoint's layout is kept. Import never reads or stores a
SmartArt layout part. A wrapped frame is read from its `mc:Choice`. A file in which only the fallback picture survived (an app without
SmartArt saved it) imports the same way in `full` provenance: the picture carries `OPF_SMARTART_V1` too, with the media keys of its
SVG and PNG, so a picture still named for its list whose SVG or PNG is the one written is that list on its layout again; a replaced
picture reports `invalid-smartart-provenance` and imports as a picture, as does any fallback without the record. Native-shape arrangements (`OPF_ARRANGEMENT_V1` on every node) are the layout's
drawing: import consumes them and reads the measured lines as the list. Other SmartArt layouts are SH-08.
