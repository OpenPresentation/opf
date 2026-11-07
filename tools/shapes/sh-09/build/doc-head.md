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

