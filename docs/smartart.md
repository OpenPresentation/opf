# Pyramids, matrices and live SmartArt

Six layouts of the default catalog draw a list as a diagram: `pyramid` (levels that build on each other, the first entry at the top),
`matrix` (four parts of a whole, or the four cases of two choices, as quadrants), `cycle` (steps that repeat, as a loop; see
[Cycles](#cycles-sh-18)) and [`chevrons`, `flow` and `vertical-flow`](#chevrons-and-flows) (stages or steps in order). The PowerPoint export writes them as **live
SmartArt** where PowerPoint lays the SmartArt out exactly as the preview draws it (PowerPoint's designs on its built-in layouts, OPF's
own designs on [OPF's own layout definitions](#opfs-own-layouts-sh-19)), and as the same drawing in native shapes everywhere else. A slide on either layout never turns into a stray bullet list: the arrangement has a second design of its own, drawn when
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
numbering, more than 8 levels or 8 cards), the list draws as a list and `opf/arrangement-adapted` (info) says why. A list that no design
holds still fills the region (SH-18 review, for every arrangement): its text takes the largest size from 1.5 times the role size down to
the size it has at which the whole list fits the region, and it sits in the middle of the region's height (LH-48's body growth leaves a
list alone once it covers half the body).

**List blocks as entries (SH-18 review).** A region whose arrangement holds two or more list blocks draws each block as an entry, its
list inside, the same way for every count: a cycle's blocks on cards on OPF's ring or loop (whichever holds them larger) with an arrow
from each to the next, a matrix's on a grid of cards, a pyramid's beside the levels of OPF's stepped pyramid. Every list keeps its
markers, is start-aligned and vertically centered in its card, and all are set at one size, the largest from 1.5 times the role size
down to the lists' own size at which every block fits without a broken word. Where a pyramid's levels or a cycle's ring and loops do not
hold the lists, the blocks are a grid of cards, with `opf/arrangement-adapted`; lists that overflow their region keep its composition,
which pagination splits. The cards are native shapes (a SmartArt node does not hold a list), and a region with an arrangement keeps its
whole cell when LH-48 centers an under-filled body, so the diagram fills it. A matrix never draws
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
holds the entries at the list's size does OPF draw a compact form of the same design (rooms of two gaps, the arrow 0.6 of the
room, a chevron's point 0.12 of its width deep, no least height), so a list is left a list only when no design holds it. Every row spans the region: a row of fewer entries widens them (a
column of fewer lengthens them).

- **chevrons**: each row a run of chevrons, left to right; a wrapped row breaks after a chevron's point and the next row starts again
  at the left, full width, so the points carry the order;
- **flow**: the rows snake: the second runs right to left under the first, joined by a down arrow under the end where the first stops,
  the third runs left to right again, and so on;
- **vertical flow**: the columns snake the same way: the second runs bottom to top, joined by a right arrow at the bottom.

A right-to-left deck mirrors the designs: the first chevron or box is at the right, the chevrons point left (`flipH`) and the arrows
turn.

Two or more list blocks in the region are the entries themselves, as SH-18 draws them for a cycle: each block on a card of OPF's
chevrons or boxes (the card neutral and its border), with the arrows between them, its list kept with its markers, start-aligned and
at one size for all, the largest from 1.5 times the role size at which every card holds its list without breaking a word; the cards
then take the height of the tallest list. Where no row or column holds them, a grid of cards does (`opf/arrangement-adapted`), and
where nothing does, the blocks keep the region's composition, which pagination splits. A SmartArt node holds no list, so these are
native shapes, with `pptx/smartart-unavailable` saying so.

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
   - **no layout part** for PowerPoint's design: OPF never writes Microsoft's layout definitions. `r:lo` is empty, and PowerPoint resolves
     its built-in layout from `loTypeId` (see [the layout relationship](#the-layout-relationship)). OPF's own designs are live on [OPF's own
     layout definitions](#opfs-own-layouts-sh-19), which the package carries;
   - the fallback picture: an SVG (`asvg:svgBlip`) over its PNG raster, the picture path SH-07's diagrams use.

   Live SmartArt needs that picture, so it needs opf-render (an optional peer) to draw the slide and an SVG rasterizer for the PNG (the
   default in Node is opf-render's; a browser passes `svgRasterizer`). Without either the arrangement is written as native shapes and
   `smartart-unavailable` says so.
   SH-19: OPF's own design of an arrangement, and a matrix's card grid, is live SmartArt on OPF's own layout definition of that design
   where [its domain](#the-domain-of-opfs-layouts) holds ([OPF's own layouts](#opfs-own-layouts-sh-19)).
2. **Native shapes**: OPF's design and a card grid outside the domain of OPF's layouts, PowerPoint's design outside its domain, and
   everything with `"shapes"`. The diamond and
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

## Cycles (SH-18)

The `cycle` layout (a region's `arrangement: "cycle"`) draws its lone list of one level as the steps of a loop: each entry a node on a
ring, the first at the top and the rest clockwise, with an arrow from each to the next and from the last back to the first. It draws
1 to 8 entries (two make a pair with an arrow each way; more than 8 stay a list, with `opf/arrangement-adapted`).

```json
{ "layout": "cycle", "title": "How each round feeds the next", "items": ["Plan", "Pilot", "Measure", "Adjust"] }
```

The designs are tried in order, each at one text size for every node, from 1.5 times the list's role size down to the role size, never
below it:

| Design (`design`) | Drawing |
| --- | --- |
| PowerPoint's (`smartart`), written as live SmartArt inside the [domain](#the-cycle-domain) | Basic Cycle (`cycle2`): circles on a ring with an arrow after each, in a frame of the cycle's own proportion centered in the region |
| OPF's (`opf`), where the circles do not hold the entries at the list's size or the instance lies outside the domain | the larger-text of two designs that fill the region: rounded rectangles on an ellipse (two entries side by side, or one above the other in a tall region), or a loop of two or three rows (columns in a tall region), clockwise from the top left, with a node on every place of its edge: two rows hold ceil(n/2) nodes on top and the rest below, three rows a node at each end of the middle row too, and a row of fewer nodes widens them so every row spans the region (no place is ever empty); the arrows on the lines between the nodes' centers, all one size |

Every node is filled in the primary color with the 1.5 pt background-colored outline of the other arrangements; the arrows are the
primary lightened 40% (`lumMod 60000`, `lumOff 40000`), without an outline; the entries are centered on their nodes in the color that
reads on the primary. A right-to-left deck mirrors the cycle, so its steps run counterclockwise.

### PowerPoint's Basic Cycle

PowerPoint lays Basic Cycle out from its frame alone: through COM (PowerPoint for Microsoft 365 on Windows 11, 2026-11-06) the circles and
arrows were the same for short, medium and long text and at every font size, and exactly proportional to the frame at a fixed width over
height (the largest difference across frames 230 to 920 pt wide was 0.0004 pt). At other proportions the result is not a closed form:
PowerPoint searches the circle size as a ten-bit binary fraction of the frame's width and fits the ring in a second step, so the circles
move by up to 0.4 pt between frames a few points apart. OPF therefore gives the SmartArt frame one proportion per count, **1.8 : 1 for two
entries and 1.15 : 1 otherwise** (the cycle's own proportion, a little wider so its height decides the size), the largest such frame
centered in the region, and reproduces PowerPoint's geometry from the frame's width W (core `cycleFrame`, `cycleNodes`):

| | Basic Cycle |
| --- | --- |
| Circles | DrawingML `ellipse`, diameter `CYCLE_DIAMETER[n]`·W: 890/1024, 818/2048, 774/2048, 570/2048, 538/2048, 890/4096, 830/4096 and 723/4096 for 1 to 8 entries |
| Ring | the centers at radius `CYCLE_RADIUS[n]`·W (0.3002, 0.32775, 0.29552, 0.33524, 0.32594, 0.3506 and 0.34595 for 2 to 8), the first at the top and the rest clockwise 360/n degrees apart; two entries left and right; the ring centered in the frame, an odd count's moved down by half of r·(1 − cos(180°/n)) so the circles' bounds are centered |
| Arrows | after each circle a DrawingML `rightArrow` (`adj1` 60000, `adj2` 50000) 0.3375 of a diameter thick, on the line between two centers, 0.53 of the gap between the circles long and starting 0.22 of it after the first circle, turned to point along the line; two entries: one over and one under the gap, 0.2491·W long, their centers 0.1888·W off the line and 0.4883 of the way along it |
| Text rectangle | the ellipse's own (the inscribed square, as PowerPoint's `txXfrm`), inset by 0.1 of the font size |
| Stacking | each arrow after its circle (two entries: an arrow's head runs under the next circle) |

The model matches every circle and arrow PowerPoint drew within 0.0001 pt in the frames measured. In the live SmartArt, the arrows are the
data model's transition points (`sibTrans`, one after each entry, the last closing the loop), styled by OPF's `sibTrans2D1` label.

In PowerPoint (COM), a cycle OPF wrote opens as live SmartArt (`HasSmartArt`, Basic Cycle, one node per entry); a node edit keeps OPF's
size on every node and the circles where they were, Change Layout switches it to another layout with every entry, and a file saved again
by PowerPoint (which writes its own layout part) imports back as the same list on the `cycle` layout, as does a Basic Cycle PowerPoint
authored. With the `mc:Choice` requiring a namespace PowerPoint does not know, PowerPoint draws the fallback picture as the preview does
(mean difference 0.94 to 1.05 of 255 over the slide, two, four and six entries).

### The cycle domain

| | Cycle |
| --- | --- |
| Entries | 1 to 8 |
| Frame proportions | exactly cycleAspect's (1.8 : 1 for two entries, 1.15 : 1 otherwise), which OPF always gives it |
| Lines | at most 2 for an entry, each break holding when the width changes by 4%; no limit in all (each circle holds its own entry: eight entries of one line and four of two matched) |
| Text | Latin script, left to right, with the run formatting of the other arrangements |

Right-to-left decks stay native shapes: PowerPoint draws Basic Cycle clockwise from the data model whatever the deck's direction, so
its circles are not where OPF's mirrored cycle draws them. Japanese text sat 11 px off in the comparison. Entries of three lines or more
drew within the shapes but outside SH-07's native gate (mean difference 1.03 to 1.62).

### The cycle gate

The same comparison as SH-09's, plus every arrow's rotation: a cycle of 1 to 8 entries with short, medium and long entries on 16:9,
4:3 and 1:1 slides, and an Arabic and a Japanese deck of 3, 4 and 5 entries, 78 decks, each exported live and as native shapes and drawn
by PowerPoint. A first pass with the domain open to every count, line count and script drew 35 decks live: PowerPoint laid every circle
and arrow out where core does (largest difference 0.000 pt, rotations equal) at core's size in all of them, and 26 passed every check; the
nine that did not are the three right-to-left decks (PowerPoint's clockwise layout), the three Japanese decks (text 11 px off) and the
three entries of three or four lines. With the domain above the 78 decks draw: PowerPoint's design as live SmartArt in 25 (every one passes: circles and arrows within 0.000 pt, rotations equal, sizes equal, no visible shape difference, the SmartArt within SH-07's gate of the native export: mean difference at most 0.84 at a quarter size and 1.29 at full size, no visibly different block, the text's ink within 1.03 px), OPF's design in 44 (PowerPoint draws the shapes as the preview does: mean difference at most 1.04 inside the shapes and outside the text, no visibly different block) and a list in 9, filling the region (five to eight long entries on 1:1 slides, six to eight on 4:3, eight on 16:9, and eight medium entries on a 1:1 slide; `opf/arrangement-adapted` says so). In each of the nine, every design breaks one of the two rules that keep text readable at the list's role size: a word wider than its node (OPF never breaks a word: "Customers" is 143 px at 32 px, a node of the 4 + 4 loop on 16:9 109 px wide) or entries taller than their node (OPF never shrinks text below the role size: the 3 + 1 + 1 + 3 loop on 16:9 is 16 px short). The evidence is in the SH-18 folder of the
shapes program.

## OPF's own layouts (SH-19)

PowerPoint's built-in layouts draw PowerPoint's designs. OPF's own designs (the [second design](#the-arrangement-of-a-region) of each
arrangement: the stepped pyramid with the entries beside it, the four quadrants, the card grid of a matrix, the ring and the two- and
three-row loops of a cycle, the wrapped and snaking rows of chevrons and flows, the snaking columns of a vertical flow, and their compact
forms) have a SmartArt layout definition of their own, which OPF writes (ECMA-376 Part 1, §21.4, `dgm:layoutDef`) from the specification
and OPF's design, never from PowerPoint's parts. Where the instance lies in [the domain](#the-domain-of-opfs-layouts) the export writes the
design as live SmartArt on that definition, so it is editable SmartArt in PowerPoint, with SH-16's fallback picture as every live SmartArt
has. Elsewhere it stays native shapes, with `pptx/smartart-unavailable` and the reason.

A design inside a built-in layout's domain keeps PowerPoint's built-in layout, which is better for the user (it is PowerPoint's own).

### What OPF writes

The definition is a table of explicit constraints, the one form PowerPoint lays out with no algorithm of its own (the SH-19 spike,
through COM):

- a `composite` root with one `if` branch per entry count, 1 to 8 (`func="cnt"`); each branch places every node with `l`, `t`, `w` and `h`
  constraints as shares of the frame's width and height, so the design scales with the frame when it is resized in PowerPoint;
- a hidden full-frame child (`shape type="rect" hideGeom="1"`) in every branch: without one, PowerPoint moves a drawing whose shapes do
  not reach the frame's edges to the frame's center;
- every entry a `forEach axis="ch" ptType="node" st="i" cnt="1"` with its node: a `tx` node in the design's preset (`roundRect` with the
  design's corner, `chevron` with its point, `ellipse`), or, where the text is not in the preset's own text rectangle (beside a stepped
  pyramid's level), a shape and a text-only node (`revTx`, no fill or line) at the entry's text rectangle;
- every arrow the transition after its node (`forEach axis="followSib" ptType="sibTrans" cnt="1"`, `hideLastTrans="0"` for a loop's
  closing arrow): an axis-aligned arrow a `rightArrow` turned by `rot` (0, 90, 180 or 270 degrees, which PowerPoint keeps); any other arrow
  a `conn` connector between the two node centers (`begPts`/`endPts` `ctr`) with its pads and thickness in millimeters;
- every entry's text at OPF's size: the data model's run `sz` (with `custT="1"`, so PowerPoint never fits it again) and a `primFontSz`
  constraint at the same size for an entry added in PowerPoint; the margins as shares of the size (`lMarg` and the others,
  `refType="primFontSz"`); the composed count's entries anchored at the top (`txAnchorVert` `t`) with the top margin where OPF's
  composition starts the entry's first line, so PowerPoint sets the lines where OPF's native text export does (centering the block,
  PowerPoint's line metrics put it up to a pixel off);
- the tables of every other count, from the same design at the same frame (core `opfLayoutGeometry`), so a node added or deleted in
  PowerPoint keeps OPF's design; more than 8 entries take the 8-entry table under names of their own (`x...`; the ninth entry is then not
  drawn until one is removed).

Every name of a layout node or `forEach` is unique in the definition: PowerPoint rejects a definition that repeats one (it opens the
SmartArt on Basic Block List instead). The identity is OPF's: the `uniqueId` is `urn:openpresentation.org/smartart/layout/<design>/<digest>`
(the design's name, `-compact` for a compact form, and a 64-bit digest of the definition's body), the title and description are the
design's (`OPF Stepped Pyramid`, `OPF Card Grid`, `OPF Snaking Flow`, `OPF Chevron Rows`, `OPF Snaking Vertical Flow`, `OPF Cycle Ring`,
`OPF Cycle Loop`, `OPF Cycle Loop of Three Rows`, `OPF Quadrants`), in the category of the arrangement (`pyramid`, `list`, `process`,
`cycle`, `matrix`). The digest is there because PowerPoint keeps the first definition it loads for a `uniqueId` for the rest of its
session: in the sweep, a deck opened after another with the same `uniqueId` and other tables was drawn with the first deck's tables. Two
exports of one design at one frame share a `uniqueId`; within one file, two frames with one `uniqueId` and different content each use
their own part. The data model's `loTypeId` names the definition, and the frame's `r:lo` names the layout part. The style labels are
OPF's colors part's: the nodes `node1` (a card `alignNode1`, the card neutral with its border, the outline's width on each entry's
`spPr`), the text-only nodes `revTx` (the slide's text color) and `fgAcc1` (the color that reads on the primary), the arrows
`sibTrans2D1`.

The export evaluates the definition with OPF's interpreter (core `evaluateLayoutDefinition`, `layoutArrangement`) and writes it only
when the result is the composed design within 0.1 pt: the preview, the definition and PowerPoint then draw the same nodes.

### OPF's interpreter

Core's `smart-art-layout.ts` evaluates the subset of §21.4 OPF writes, as PowerPoint does: the layout node tree, `forEach` over the
entries and their transitions (`st`, `cnt`, `hideLastTrans`), `choose`/`if` on the entry count, `composite` with `l`/`t`/`w`/`h`
constraints (shares of the root's `w` and `h`, or millimeters), PowerPoint's centering of a drawing that does not reach its frame's
edges, `sp`, `tx` and `conn` (between centers), and shapes with their presets, adjustments and turns. A turned shape is PowerPoint's: the
largest-area rectangle at that angle inside its constraint box (at 45 degrees always a square), which is why OPF writes turned arrows as
connectors. It returns nodes and arrows in the shape of a composed arrangement (with the preset's text rectangle, or a text-only node's
box), so render and pptx have no second geometry path. It runs on the edge runtimes (no Node built-ins). Its unit test replays what
PowerPoint drew through COM for OPF-written definitions (177 shapes: composite placement with and without the full-frame child, shapes
turned by `rot`, connectors, the closing transition) within 0.001 pt.

The spike measured the other algorithms in OPF-written definitions too. Each evaluates, but none is a closed form: `lin` scales each axis
on its own and centers with a 0.1 to 0.4 pt offset; `snake` picks its own grid (up to 343 pt from the best-grid form); `cycle` searches
the node size (215 pt from the form its parameters describe); `pyra` keeps the levels to 0.67 of the width. OPF's definitions use none of
them (only the `else` branch of no OPF definition; the tables cover every count).

### In PowerPoint

Through COM (PowerPoint for Microsoft 365 on Windows 11): PowerPoint opens the SmartArt live on OPF's layout (`HasSmartArt`, the
layout's name and description, category as written, every entry a node of `AllNodes`); `Application.SmartArtLayouts` does not list it
(the Change Layout gallery itself was not inspected: COM only). A node's text edited keeps OPF's size in every node and every node
rectangle; an added node takes the next count's table and OPF's size (`primFontSz`; without it PowerPoint's 36 pt), deleted nodes the
smaller count's; Change Layout to Basic Block List and back (to the layout object read before) restores OPF's layout with every node
where it was. A file saved again by PowerPoint keeps the layout part, rewritten but the same definition (PowerPoint adds empty sample,
style and color data with `useDef`, leaves out attributes at their schema defaults and reorders attributes; normalized, the part equals
OPF's), the same `uniqueId` and the same geometry on reopening; it drops SH-16's wrapper as for every SmartArt. A definition PowerPoint
cannot evaluate (a connector to a node of another name, in a build of this item) made PowerPoint take the `mc:Fallback` picture.

### The domain of OPF's layouts

The export writes OPF's layout only for the instances the PowerPoint comparison passed (core `SMART_ART_OPF_DOMAIN`,
`opfSmartArtUnavailable`):

| | Passed |
| --- | --- |
| Designs and entries | the stepped pyramid 1 to 8, the card grid 1 to 6, chevron rows 6 to 8, the snaking flow 6 to 8, the snaking vertical flow 5 to 6 |
| Text density | the entries' text (each line's width times the size) at most 7.5% of the frame |
| Lines | at most 2 an entry, each break holding when the width changes by 4% (core fits every entry at both widths, as for PowerPoint's designs) |
| Text | Latin script, left to right, with the run formatting of the other arrangements |

Everything else is native shapes, which look the same: OPF's cycles and quadrants (every instance of the sweep held its entries only
above the text density), the compact forms, right-to-left and Chinese or Japanese text, a row of chevrons pointing left (a layout
definition has no mirrored shape), and list blocks (a SmartArt node holds no list).

### The gate

The sweep of SH-09, SH-17 and SH-18 for all six arrangements: 1 to 8 entries, short, medium and long, on 16:9, 4:3 and 1:1 slides, an
Arabic and a Japanese deck of 3, 4 and 6 entries and decks of 2 and 4 list blocks of each, 468 decks, each exported live and as native
shapes and drawn by PowerPoint; an instance passes on SH-09's checks (every node rectangle within 0.1 pt, arrows turned the same, equal
sizes, no visible shape difference from the preview, within SH-07's native gate of the native export).

With the domain open (every OPF design live), 310 decks drew OPF's layout live. In the first pass PowerPoint laid 261 of them out where
OPF's interpreter does; the other 49 were drawn with the tables of an earlier deck of the same `uniqueId` (the session's cache, hence the
digest). With the digest every one of the 310 laid out within 0.1 pt of the interpreter (largest difference GATE_RECT pt, arrows turned
the same) at OPF's size. The pixel checks then found what the domain keeps out: with the text centered in its node, PowerPoint set the
lines up to a pixel off (mean difference from the native export up to 6 in dense frames); anchoring the text at OPF's first line halved
that, and of the 292 Latin instances every one at a text density of 7.5% or less with stable breaks passed (30), while above it some did
not (a mean difference of 1.01 at 8%, up to 3.3 in the densest), and every Japanese instance did not (text 11 px off). With the domain,
GATE_FINAL. The evidence (the gate table, sheets of preview, PowerPoint live and PowerPoint's drawing of the native export, labelled with
the design and the layout that drew it, and the COM records) is in the SH-19 folder of the shapes program.

## Import

A SmartArt OPF wrote (in `full` provenance it carries `OPF_SMARTART_V1`: the slide, the list path, the arrangement, the authored list
and the text of every node) imports as its list on its layout again when its node texts are unchanged. An edited one, and a Basic
Pyramid, Basic Matrix, Basic Cycle, Basic Chevron Process, Basic Process or Vertical Process that PowerPoint wrote, import their data model's nodes: the points in `cxn` order (the top level only; nested
entries are reported as `smartart-flattened`), their text and run properties (bold, italic, underline, strike), as a list on the
`pyramid`, `matrix`, `cycle`, `chevrons`, `flow` or `vertical-flow` layout (the one of the same arrangement; SH-19: a SmartArt on one of
OPF's own layouts by its `uniqueId`, `urn:openpresentation.org/smartart/layout/<design>/...`, also after PowerPoint saved it again), with `smartart-edited` for an edited OPF SmartArt. The diagram's place on the slide is its frame's;
the nodes' geometry is the layout's again, as OPF draws it, so nothing of PowerPoint's layout is kept. Import never reads or stores a
SmartArt layout part. A wrapped frame is read from its `mc:Choice`. A file in which only the fallback picture survived (an app without
SmartArt saved it) imports the same way in `full` provenance: the picture carries `OPF_SMARTART_V1` too, with the media keys of its
SVG and PNG, so a picture still named for its list whose SVG or PNG is the one written is that list on its layout again; a replaced
picture reports `invalid-smartart-provenance` and imports as a picture, as does any fallback without the record. Native-shape arrangements (`OPF_ARRANGEMENT_V1` on every node) are the layout's
drawing: import consumes them and reads the measured lines as the list. Other SmartArt layouts are SH-08.
