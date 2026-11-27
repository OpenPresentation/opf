# Keynote 16.0 feature inventory: what OPF 0.36.0's export handles

The owner asked (2026-11-25) for every feature of Keynote's interface, whether OPF relates to it, whether the export handles it in Keynote, and a fix where it does not. Data: `inventory.json`, rebuilt by `build_final.py`. Measured results cite a finding or report; the rest is "not tested".

## Counts (rows of `inventory.json`)

- **Features:** 1213 = 1173 desk rows (none dropped) + 40 interface features the desk study lacked (`KN-GUI-*`).
- **Interface (walk of 2026-11-27):** seen 442 (402 desk rows + 40 new), not found 14, not walked 757.
- **OPF relates:** has 280, partly 197, not 736. 9 desk rows were corrected to "not" (checkbox, rating, slider, stepper and pop-up cells; interactive chart; live video layouts; 3D and drawing descriptions).
- **Measured in Keynote, of the 477 rows OPF has or partly has** (default export mode):

| | native | editable but changed | picture | dropped | not tested | total |
|---|---|---|---|---|---|---|
| OPF has | 132 | 98 | 0 | 3 | 47 | 280 |
| OPF partly | 69 | 69 | 0 | 0 | 59 | 197 |

Rows are uneven: one concept can be twenty rows. No row is "picture": SmartArt and extended charts have no Keynote control (end of page).

## Features OPF has or partly has whose result is not native (170 rows in 33 groups)

"changed" = editable in Keynote, but different. Ids: `report/tracking-body.md` section 6 ("Known §8": its section 8); C1 to C4: editing tests (`ui/REPORT-2.md`, `-3.md`). "Tested" = the file form was opened in Keynote 16.0, not in PowerPoint.

| Group (changed unless marked) | Rows | Evidence | Fix (issue) |
|---|---|---|---|
| Body text, lists, spacing, body placeholder (a box per line or item) | 25 | C1, C3, LY-02 | `--body-text native` in the opt-in route (tested), after #1551, #1552, #1553 |
| Picture bullets | 1 | EX-04 | untested: square bullet image |
| Captions and object titles | 5 | C3 | native mode (tested); no carrier for Keynote's Caption |
| Text in non-rectangular shapes (becomes a group) | 4 | RT-05, QS-01 | untested: drop `prstTxWarp` (51 rectangles) |
| Vertical text (rotated box) | 5 | Known §8 | untested: `vert="eaVert"` for CJK |
| Paragraph direction, mixed Hebrew/Latin | 2 | MX-06, RT-07 | Keynote limit (`rtl` tried) |
| Title shrink-to-fit | 2 | C2, LY-01 | `--typefaces safe` (tested); `normAutofit`: Keynote limit |
| Image description (alt text) (**dropped**) | 3 | RT-03, LY-04 | opt-in: alt in `name` (tested); #1479 |
| Shape-masked pictures, image fill | 7 | RT §4 | none needed (looks right) |
| SVG pictures | 3 | corpus-shapes | none (PNG kept) |
| Background picture with opacity | 6 | EX-02 | untested: pre-blend opacity into the picture |
| Background color with opacity | 1 | #1418, A8 | #1416 item 3 form (tested in the window) |
| Tiled background | 3 | Known §8 | untested: opacity baked into a `p:bg` tile |
| Preset shapes and their handles | 9 | QS-02 to QS-05 | untested: four presets as freeforms |
| Shadows | 7 | QS-08 | none tried |
| Path gradients | 1 | QS-06 | untested: linear or radial approximation |
| Arrowhead sizes | 1 | QS-07 | none tried |
| Curved and elbow connectors | 2 | Known §8 | untested: explicit paths (lose glue) |
| Video, web video (a linked placeholder) | 14 | RT §4 | format candidate: embed `p:video` |
| Slide numbers | 4 | Known §8, QC-04 | `--slide-numbers static` (tested, #1298) |
| Cell data formats (numbers as text) | 16 | RT-08 | Keynote limit (plain numbers tried) |
| Conditional highlighting | 8 | corpus-charts Tables | none (no PPTX rule) |
| Table header wrap | 2 | SW-01, MX-08 | columns 10% wider (tested) |
| Right-to-left table | 2 | LG-02 | visual column order (tested, #1298) |
| Point colors, highlight | 3 | MX-03 | none holds (#1494) |
| Data labels | 8 | MX-05, QC-05, QC-07, QC-09 | Keynote limit; untested: number format |
| Axis scale and gridlines | 5 | QC-02, QC-08 | omit `c:majorUnit` (tested) |
| Mixed and two-axis charts | 3 | EX-07, QC-02 | omit `c:majorUnit` (tested); inner plot area |
| Radar (drawn filled) | 5 | Known §8 | `a:noFill` (tested, #1416 item 1) |
| Reference line labels | 7 | Known §8 | label above the plot (tested) |
| Chart title position | 2 | Known §8 | none tried |
| Area charts | 2 | Known §8, QC-05, EX-10 | gap: Keynote limit |
| Two-series doughnut; pie separator | 2 | EX-01, MX-05 | untested: one doughnut per ring |

**Native, with look findings:** fonts (LY-01, LY-02, LG-01, SW-01, MX-08, EX-08; `--typefaces safe`, tested); bar charts (MX-02 #1492, MX-04); legends (LY-03, MX-07, QC-10); flush lines (MX-01 #1493); footer behind a picture (QC-03); layout copies (LY-06); link color (#1416 item 7, Keynote limit); highlight legend (MX-03 #1494).

## The ten fixes that would help most

1. **Pre-blend background opacity** (EX-02, EX-03, #1418): 135 example slides draw it at full strength over the text; tested for solid colors (#1416 item 3), not for pictures and patterns.
2. **`--typefaces safe` in the opt-in Keynote route (#1298)**: removes the font-substitution family (layouts-lots wrong 12 to 2; tested).
3. **Importer tolerance (#1477 closed, #1478, #1479, #1480)**: decks edited in Keynote fail to import (22 of 274 examples); proved on copies.
4. **`--body-text native` in the route, after #1551, #1552, #1553**: lists, captions and paragraphs then edit like Keynote's (C1, C3): the largest group above.
5. **Alt text where Keynote reads it** (RT-03, #1479): Description reads "OPF image N"; only the shape name works (tested; opt-in).
6. **Inner plot area for every manual plot area, combos included** (MX-02 #1492 closed, EX-07): names cut or below the frame; tested for bars.
7. **Square picture-bullet image** (EX-04): 39 decks draw the wide logo as the bullet; untested.
8. **Axis steps and scaling** (QC-02, QC-08, #1416 item 2): omit `c:majorUnit` (tested), write the preview's scaling (untested).
9. **Static slide numbers in the route** (#1298): "Page 1 of 4" reads right (tested).
10. **Right-to-left table in visual column order** (LG-02, #1298), plus small tested chart forms: radar `a:noFill`, reference label above the plot (#1416 items 1, 5), line breaks in long names (MX-04).

## Keynote features OPF cannot express that matter most (judgment, not measured)

From the 736 "not" rows; "yes" = OPF should relate.

1. Slide transitions: yes, a small set (fade, push, wipe) as `p:transition`.
2. Builds by paragraph or object: yes, appear and fade as `p:timing`.
3. Bubble chart: yes, `c:bubbleChart`.
4. Trendlines: yes, `c:trendline`.
5. Error bars: yes, `c:errBars`.
6. Axis minimum, maximum and step: yes; also removes QC-08.
7. Bar gap width: yes, `c:gapWidth`.
8. Pie rotation angle: maybe, `c:firstSliceAng`.
9. Table header columns: yes, `firstCol`.
10. Table total rows: yes, `lastRow`.
11. Alternating row color: yes, `bandRow`.
12. Text highlight: yes, `a:highlight`.
13. Small caps and all caps: yes, `a:rPr cap`.
14. Text outline and shadow: low.
15. Gradient or image text fill: low.
16. Equations: yes; Keynote's reading of OMML untested.
17. Audio and soundtrack: maybe.
18. Next, previous, first, last slide and Exit Slideshow links: yes, beside `slide:<id>`.
19. Self-playing timing and loop: maybe, for kiosks.
20. Lock objects: maybe; Keynote's reading of `a:spLocks` untested.
21. Comments: through the cloud-editor program first.
22. Chart background, border and shadow: no; OPF draws chart cards.
23. Axis label and series-name options: no; engine choices.
24. Image galleries, drop caps, phonetic guides, 3D objects: no PPTX carrier.
25. Formulas: no; computed values only.

## OPF features with no Keynote control (outside the rows)

Extended charts and live SmartArt become pictures (`--smart-art shapes` gives editable shapes, tested); glow, soft edge, inner shadow and blur are dropped; sketch and compound lines draw plain (Known §8). The desk's ideas for them are untested.

## What the inventory does not cover

- **757 rows not walked**: 166 have no interface path; the rest are in dialogs, Settings, the presenter display, shortcuts, pop-ups background control could not open, or on objects not selected (3D, radar, bubble, pie charts, connection lines, right-to-left or CJK text, layout editing). "Seen" is a loose name match: a parent control marks its options seen.
- **106 OPF rows not tested**: themes, sections as slide groups, underline, strikethrough, superscript, caps, flip, opacity, reflection, object styles, table borders, text columns, media placeholders, the date field and others.
- **Desk mapping:** many "has" rows are app operations on a concept (Translate); they inflate "has".
- **Not run:** Play, PowerPoint, any minimal deck of the QC, QS or EX findings, any example-sweep improvement.
