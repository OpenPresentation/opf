# Keynote grades: shapes and diagrams (Keynote 15.1.1)

No major differences. Content is intact on all 51 slides (10 decks); Keynote draws most diagrams almost exactly like the preview. _probe.txt files are empty, so nativeChart/nativeTable counts were not available; pie chart on diagrams-5 is visibly present.

| file | slide | what differs | size |
| --- | --- | --- | --- |
| shape-overlays | 5 | All curved connectors (6) drawn as straight diagonal lines; several elbow routes differ (a loop-back elbow enters from below instead of the side, a dotted elbow takes a different bend) | moderate |
| shape-overlays | 4 | Curved Source to Lower connector is straight; elbow loop Upper to Lower routes out past the right edge at a different height and crosses the gap to the Upper arrow | moderate |
| shape-overlays | 3 | Curved Review to Plan connector is a straight diagonal, low contrast, ends at the corner of Plan not the bottom edge | moderate |
| shape-overlays | 2 | "4K" badge text wraps to "4 / K" (font width) | moderate |
| shape-effects | 2 | Inner shadow, glow, soft edge and blur are all lost: shapes are flat with hard edges | moderate |
| shape-effects | 1 | Shadows softer and offset differently; perspective shadow band under "perspective" shows as a lower soft shadow; object glow shadow reduced | minor |
| shape-effects | 3 | Star glow lost; reflection and rotated-arrow shadow present | minor |
| shape-effects | 4 | "decision" diamond wraps to "decisio / n"; chevron glow/soft edge gone | moderate |
| shapes | 1 | "Decide?" in diamond wraps to "Decide / ?" | minor |
| shapes | 4 | "thickTin inside" box text wraps in 2 lines (preview 1 line); double and thickThin strokes drawn as one thick solid line (no double/compound line); sketch stroke on "gradient, sketch" is a clean rectangle (no hand-drawn wobble) | moderate |
| shapes | 3 | Pattern fill is a similar diagonal hatch; radial gradient edges bluer; otherwise matches | minor |
| shapes | 6 | Rotated vertical text: "OPF" (stacked letters in preview) is rotated sideways in Keynote | minor |
| shapes | 1-7 | All blue fills are duller/grayer than the preview (e.g. 2878A8 looks like 4070A0); semi-transparent fills (solid, hex alpha, opacity) shift most | minor |
| diagrams (all) / picture / dot / plantuml / markdown / connectors | all | Sub-pixel to 3 px text and line offsets; glyph widths differ; bullet glyph smaller; Keynote title 2 to 3 px higher. Greens in diagrams-4 slightly lighter | minor |
| diagrams-markdown, diagrams | 2 | Sequence diagrams: Keynote lifeline/arrowheads match; note "Validate" self-loop OK | OK |

All other slides: OK. Viewed: every slide of every deck except diagrams~picture 1, 3, 5, 6 (scores 2.5 to 3.8 percent, same pattern as native `diagrams`; picture variant slides 2, 4, 7 viewed: match preview, pixel-identical to the picture).

Arrowheads present and correct on all diagrams; endpoints land on nodes; dashed edges, labels on edges, clusters (dot-1), cylinder, stadium, double circle (dot-4), alt frame and use-case include (plantuml) all correct. RTL (shape-overlays-rtl): first box on right, arrow points left, badge at right, callout bottom right: mirrors like the preview.

## Features
- SH-02 shapes (visual, noOverflow): differs (shapes 1, 4, 6 above; colors duller); noShrink, roundtrip: not graded here
- SH-02-native: pass visually (slides 1-7 shapes with text; slide 8 masked pictures look correct)
- SH-03 shape-effects: differs (slide 2 inner shadow/glow/soft edge/blur lost; slide 4 wrap); noShrink not graded here
- SH-04 shape-overlays: differs (slides 3, 4, 5 curved/elbow connectors; slide 2 badge wrap); connectors glue, roundtrip not graded here
- SH-04-rtl: pass
- SH-07 diagrams (slides 1, 6, 7): pass; shapes/roundtrip/noShrink not graded here
- SH-07-connectors: pass (straight lines and curved edges present, arrow-less); connectors glue not graded here
- SH-07-families (diagrams 1-7): pass
- SH-07-picture: pass
- SH-07-md: pass
- SH-12 dot-diagrams: pass (all five slides)
- SH-13 plantuml-diagrams: pass (all eight)
- LH-185 diagrams direction: pass
- SH-05, SH-11: SH-05 roundtrip not graded here; SH-11 small shape text: pass (no clipping; "OPF"/"4K"/"Decide?" wrap noted)
