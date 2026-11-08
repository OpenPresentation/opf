# COM job: SmartArt live-gate extras (smartart agent, 2026-11-07)

For the Office owner session. The scripts only open the sweep's files read-only, create one unsaved presentation of their own, close only
what they opened, and quit PowerPoint only when no other presentation is open. `run.ps1` refuses to start while PowerPoint is running.

## Run

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File C:\opf-work\_supervisor\com-jobs\sh-live-extras\run.ps1
```

It runs, in order (the tools are SH-19's, unchanged, in `C:\opf-work\shapes\sh-19\tools`):

1. `com-probe.ps1` on `sweep\pptx` (live exports) into `sweep\ppt`, and on `sweep\pptx-shapes` (OPF's native-shape exports of the same
   slides) into `sweep\ppt-shapes`: per deck, `HasSmartArt`, the layout, every node and every `GroupItems` shape (rectangle, rotation,
   text, size, the bounds of each text line), and a PNG of every slide at the canvas size.
2. `com-checks.ps1` on the 8-entry short decks into `sweep\ninth`: a node edit, **one node added (the ninth)**, two deleted, Change Layout
   and back, SaveCopyAs and reopen (each step's rectangles and sizes recorded, a PNG after each).
3. `measure-trees.ps1` into `trees\`: PowerPoint's own Organization Chart, Hierarchy and Basic Venn, in a new unsaved presentation, for
   11 trees and 7 Venn counts in 20 frames each (every shape PowerPoint draws: type, connector flag, rectangle, rotation, flips, text,
   size, margins), and a PNG of each at 600 x 400 pt. About 580 layouts; give it time.

Expected time: step 1 roughly as SH-19's sweep (516 decks, twice), step 2 a few minutes, step 3 about 20 minutes.

## The decks (already generated, `sweep\`)

SH-19's sweep corpus written by a build that opens every SmartArt domain (`OPF_SWEEP_OPEN=1` against `C:\opf-work\sh-live-extras`, a
sweep-only switch that is never committed), so every design and script is written live and the gate shows where each passes:

- the six arrangements (pyramid, matrix, cycle, chevrons, flow, vertical flow), 1 to 8 entries, short, medium and long, on 16:9, 4:3 and
  1:1 slides (OPF's cycle ring and loops, quadrants and compact forms among them, at every text density);
- Arabic, Hebrew, Chinese and Japanese decks of 3, 4 and 6 entries for each arrangement (`*-rtl-*`, `*-he-*`, `*-zh-*`, `*-cjk-*`);
- decks of 2 and 4 list blocks (native shapes, as controls);
- OPF's layout definitions carry tables for 1 to 12 entries in this build (SH-23), so the ninth node in step 2 should take OPF's design.

`sweep\meta.json` has each instance's kind, count, text, slide size, script and findings; `sweep\preview\` OPF's preview PNGs.

## What I measure from the results (no further COM needed)

| Item | Measured | Gate |
|---|---|---|
| SH-20: OPF's cycle ring and loops, quadrants, compact forms live | `gate.mjs` on `sweep\` (SH-19's gate: node rectangles within 0.1 pt of the interpreter, sizes equal, no visible shape difference, within SH-07's gate of the native export) per design and text density | a design enters `SMART_ART_OPF_DOMAIN` at the densities where every instance passes |
| SH-22: Japanese, Chinese, Arabic and Hebrew text | the line bounds of each node (step 1) against OPF's composed lines and the native export's lines | the cause of the 11 px offset (line pitch, ascent or font); a fix, then a re-sweep of only the script decks |
| SH-23: the ninth entry | step 2's `add=9@...` sizes and rectangles against the interpreter's 9-entry table | every node drawn, inside the frame, where OPF's table puts it |
| SH-21: org charts, hierarchies, Basic Venn | `trees\trees.json`: PowerPoint's geometry per tree and frame | a closed-form fit in core (as SH-17's), the condition for drawing them as live SmartArt |

## Hand back

Reply with "sh-live-extras done" and any errors (each script prints per deck or layout). The files stay where they are.
