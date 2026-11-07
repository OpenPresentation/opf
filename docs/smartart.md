# Pyramids, matrices and live SmartArt

Two layouts of the default catalog draw a list as a diagram: `pyramid` (levels that build on each other, the first entry at the top)
and `matrix` (four parts of a whole, or the four cases of two choices, as quadrants). The PowerPoint export writes them as **live
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

## In PowerPoint

`toPptx(deck, { smartArt })` (CLI `--smart-art <live|shapes>`) takes the first that fits, as the owner decided for SmartArt:

1. **Live SmartArt** (`"live"`, the default), for PowerPoint's design where the instance lies in the domain below. The slide holds a `p:graphicFrame` of the
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
2. **Native shapes**: OPF's design, a card grid, PowerPoint's design outside the domain, and everything with `"shapes"`. The diamond and
   the nodes are presets (`diamond`, `trapezoid` with core's adjustment, `roundRect`) at core's boxes, under the list's measured lines,
   tagged `OPF_ARRANGEMENT_V1`. OPF's design and PowerPoint's outside the domain report the info finding `pptx/smartart-unavailable`
   with the reason (`reason` in the diagnostic); a card grid reports core's `arrangement-adapted`.

Both look the same as the preview: the shapes are exact, and the text is where OPF's native text export puts any text.

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

## Import

A SmartArt OPF wrote (in `full` provenance it carries `OPF_SMARTART_V1`: the slide, the list path, the arrangement, the authored list
and the text of every node) imports as its list on its layout again when its node texts are unchanged. An edited one, and a Basic
Pyramid or Basic Matrix that PowerPoint wrote, import their data model's nodes: the points in `cxn` order (the top level only; nested
entries are reported as `smartart-flattened`), their text and run properties (bold, italic, underline, strike), as a list on the
`pyramid` or `matrix` layout, with `smartart-edited` for an edited OPF SmartArt. The diagram's place on the slide is its frame's;
the nodes' geometry is the layout's again, as OPF draws it, so nothing of PowerPoint's layout is kept. Import never reads or stores a
SmartArt layout part. Native-shape arrangements (`OPF_ARRANGEMENT_V1` on every node) are the layout's
drawing: import consumes them and reads the measured lines as the list. Other SmartArt layouts are SH-08.
