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
| OPF's (`opf`), where the circles do not hold the entries at the list's size or the instance lies outside the domain | the larger-text of two designs that fill the region: rounded rectangles on an ellipse (two entries side by side, or one above the other in a tall region), or a loop around the edge of a grid of two or three rows (columns in a tall region), clockwise from the top left; the arrows on the lines between the nodes' centers, all one size |

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
three entries of three or four lines. With the domain above the 78 decks draw: {{FINAL}}. The evidence is in the SH-18 folder of the
shapes program.

