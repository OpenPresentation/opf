# Final coverage grading (Keynote 15.1.1 vs OPF preview), 30 coverage decks

Method: viewed every deck's sheets (preview | Keynote) at reduced size; read slide XML for the major rows.
Not individually viewed at full size: coverage-regions 17-19 and 25, coverage-lists 13, coverage-design 2-4, 10-12 (seen only in the group grids).

## Major
- coverage-shape-styles 11: custGeom "Path string" shape. Path points are 100x its a:path w/h (w=h=3545840, points up to 354584003), so Keynote draws a diamond that floods the whole slide blue and hides the content.
- coverage-charts 15 (Margins by product, negatives): Keynote clips category labels ("ranes", "tware", "asing", "epairs").

## Moderate
- coverage-shape-styles 5: three ask:lineSketchStyleProps outlines (curved, freehand, scribble) drawn as plain outlines.
- coverage-shape-styles 3: cmpd dbl, thickThin, thinThick, tri drawn as one thick single line.
- coverage-backgrounds 5: solid bg accent1 lumMod 60 with a:alpha 85 drawn opaque and darker (alpha ignored).
- coverage-backgrounds 11: tiled picture (a:tile) drawn as one large tile.
- coverage-backgrounds 6: three-stop gradient, teal end drawn grayish indigo.
- coverage-charts 5: radar charts; Keynote fills all three (preview: lines only in first), axis labels overlap (Research/Ship) and clip at right edge.
- coverage-charts 13: area chart with a gap at Sep drawn through the gap.
- coverage-charts 14: secondary axis loses its 10-40% labels (only 0% shown), legend (with reference lines) overlaps the axis labels.
- coverage-charts 16: reference label "Target 30 min" collides with East bar value; legend lists series per point (North, South, East) instead of "Wait".
- coverage-charts 4, 10: direct line labels ("31 Self-serve", "170 Visits") dropped.
- coverage-charts 7: treemap shows a bar chart picture (known fallback).
- coverage-text 5: quote beside portrait runs off the right slide edge (Helvetica wider).
- coverage-shape-presets 16: last three presets (chart X, star, plus) show their stroke lines in Keynote; preview draws plain squares.
- coverage-overlays 4: elbow connector routes differently (loops above Ship).
- coverage-furniture 4: footer URLs drawn as blue underlined links, low contrast on blue.

## Minor
- All saturated fills render duller in Keynote (e.g. accent3 green, accent1 navy, client blue): global color shift.
- Per-point bar color not drawn (size decks slide 2, design charts, images 15), known.
- Chart titles centered instead of left; legend order reversed on radar; donut labels lose the colon.
- Monospace and light/semilight faces fall back to Helvetica (design 31, 34, text 1, 6, 7, composition 4).
- Vertical text "OPF"/"AB" stacked in preview, rotated in Keynote (shape-styles 10, overlays 5).
- Video link labels drawn blue underlined (images 14-15, composition 6).
- "Page 1 of 9" and "6 / 9" footers show only the number (known limit).
- Rotated notes "Start"/"End" and callout "Recovery" wrap mid-word (overlays 2-3).
- Overlay green rectangle lighter (overlays 5); gradient rect/shape fills shift color (shape-styles 1).
- Arabic chart (languages 2): data labels bigger, digits Latin (known).
