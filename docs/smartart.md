# Pyramids, matrices and live SmartArt

Layouts of the default catalog that draw a list as a diagram: `pyramid` (levels that build on each other, the first entry at the top),
`matrix` (four parts of a whole, or the four cases of two choices, as quadrants) and `cycle` (steps that repeat, as a loop; see
[Cycles](#cycles-sh-18)). The PowerPoint export writes them as **live
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

## In PowerPoint

`toPptx(deck, { smartArt })` (CLI `--smart-art <live|shapes>`) takes the first that fits, as the owner decided for SmartArt:

1. **Live SmartArt** (`"live"`, the default), for PowerPoint's design where the instance lies in the domain below. The slide holds a `p:graphicFrame` of the
   diagram (`dgm:relIds`) inside an `mc:AlternateContent` whose `mc:Fallback` is OPF's picture of it ([in other apps](#in-other-apps)), and the package:
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
     from `loTypeId` (see [the layout relationship](#the-layout-relationship));
   - the fallback picture: an SVG (`asvg:svgBlip`) over its PNG raster, the picture path SH-07's diagrams use.

   Live SmartArt needs that picture, so it needs opf-render (an optional peer) to draw the slide and an SVG rasterizer for the PNG (the
   default in Node is opf-render's; a browser passes `svgRasterizer`). Without either the arrangement is written as native shapes and
   `smartart-unavailable` says so.
2. **Native shapes**: OPF's design, a card grid, PowerPoint's design outside the domain, and everything with `"shapes"`. The diamond and
   the nodes are presets (`diamond`, `trapezoid` with core's adjustment, `roundRect`) at core's boxes, under the list's measured lines,
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

## Import

A SmartArt OPF wrote (in `full` provenance it carries `OPF_SMARTART_V1`: the slide, the list path, the arrangement, the authored list
and the text of every node) imports as its list on its layout again when its node texts are unchanged. An edited one, and a Basic
Pyramid, Basic Matrix or Basic Cycle that PowerPoint wrote, import their data model's nodes: the points in `cxn` order (the top level only; nested
entries are reported as `smartart-flattened`), their text and run properties (bold, italic, underline, strike), as a list on the
`pyramid`, `matrix` or `cycle` layout, with `smartart-edited` for an edited OPF SmartArt. The diagram's place on the slide is its frame's;
the nodes' geometry is the layout's again, as OPF draws it, so nothing of PowerPoint's layout is kept. Import never reads or stores a
SmartArt layout part. A wrapped frame is read from its `mc:Choice`. A file in which only the fallback picture survived (an app without
SmartArt saved it) imports the same way in `full` provenance: the picture carries `OPF_SMARTART_V1` too, with the media keys of its
SVG and PNG, so a picture still named for its list whose SVG or PNG is the one written is that list on its layout again; a replaced
picture reports `invalid-smartart-provenance` and imports as a picture, as does any fallback without the record. Native-shape arrangements (`OPF_ARRANGEMENT_V1` on every node) are the layout's
drawing: import consumes them and reads the measured lines as the list. Other SmartArt layouts are SH-08.
