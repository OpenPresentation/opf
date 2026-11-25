# matrix-m grading: changelog decks `m-*`, Keynote 16.0, OPF 0.36.0

Saved by the supervisor from the grader's hand-back (the grader could not write report files itself). 78 slides in 15 opened files; every slide looked at (grid sheets, plus three-panel crops Keynote 0.35.1 | Keynote 0.36.0 | preview). Line-edge numbers are pixel measurements after P3 to sRGB conversion. All findings: main unchanged (identical parts); "the file is valid and Keynote reads it differently"; no minimal deck opened in Keynote yet.

## Counts (same / small / wrong)

| deck | mode | same | small | wrong |
|---|---|---|---|---|
| m-text-flush | default | 0 | 6 | 1 |
| m-text-flush | native | 0 | 6 | 1 |
| m-text-flush-rtl | default | 0 | 6 | 1 |
| m-charts | default | 0 | 11 | 5 (slides 1-5) |
| m-negative-bars | default | 0 | 6 | 2 (slides 5, 8) |
| m-links | default / native | 0 | 3 / 3 | 0 |
| m-native-body | default / native | 0 | 4 / 4 | 0 |
| m-agenda | default | 0 | 5 | 0 |
| m-svg-hsl | default | 5 | 0 | 0 |
| m-preset-preview | default | 4 | 0 | 0 |
| m-gallery-anchors | default | 0 | 3 | 0 |
| m-legacy-auto | default / native | 0 | 1 / 1 | 0 |

Wrong slides: m-text-flush 5 default+native (MX-08); m-text-flush-rtl 6 (MX-06); m-charts 1-3 (MX-03); m-charts 4 (known rows only: end labels dropped, stacked lines unstacked); m-charts 5 (MX-05, MX-07); m-negative-bars 5 (MX-04); m-negative-bars 8 (MX-02).

## Per matrix row

| row | deck / slides | modes | result | sheet |
|---|---|---|---|---|
| M71 | m-negative-bars 1-6 | default | **passed**: names whole on every slide (short, long, twelve; bars and columns). 0.35.1 cut them on 1-3. Column plots (4-6) moved up and slightly shorter: closer to the preview. Slide 5 shows 2 of 4 long names, same in 0.35.1 (MX-04) | M71-negative-bars-slides-1-3.jpg, M71-negative-columns-slides-4-6.jpg |
| M71 gap | m-negative-bars 7 (authored legend) | default | automatic plot area: names whole, nothing clipped; pixel-identical to 0.35.1. No visible effect in Keynote | M71-negative-bars-legend-slide-7.jpg |
| M71 control | m-negative-bars 8 (all positive, outer plot) | default | **MX-02**: clipped, same in 0.35.1 | MX-02-positive-bar-labels-clipped.jpg |
| M16 | m-text-flush 1-7, m-text-flush-rtl 1-7 | default, native | **MX-01** (regression in Keynote); MX-06, MX-08 on single slides | MX-01-*.jpg, MX-01b-*.jpg |
| M13 | m-charts 1-3 | default | **MX-03** | MX-03-one-series-legend-twice.jpg |
| M64 | m-charts 4, 5, 12 | default | not judgeable on 4 (known: end labels dropped); 5 **MX-05** (category name dropped; labels stay on one line); 12 labels on two lines (separator dropped) | MX-05-data-label-category-dropped.jpg |
| M66 | m-charts 6-9 | default | **passed** (slide 9 names whole; 0.35.1 cut them) | M66-plot-under-heading.jpg |
| M14 | m-charts 10-13 | default | **passed**: separators and inner square as preview; 0.35.1 had neither | M14-pie-separators.jpg |
| M30 | m-charts 14, m-svg-hsl 2-5 | default | **passed**: name whole; gradients in color (0.35.1 black or empty on 3-5) | M30-svg-hsl.jpg |
| M11 | m-charts 15-16, m-svg-hsl 1, m-legacy-auto | default, native | **passed** | M11-legacy-auto.jpg |
| M65 | m-links 1-3 | default, native | **passed**: back.pptx has `hlinkClick` on the shape; text keeps its color, no underline (0.35.1: blue, underlined). Slide 3 control (link inside a sentence) still blue (known) | M65-link-shapes.jpg |
| M62 | m-native-body 1-4 | native | **passed**: box anchored in the middle at preview size; 0.35.1 high and small | M62-native-body-anchor.jpg |
| M67 | m-agenda 1-5 | default | **passed**; no 0.35.1 Keynote run (0.35.1 cannot export: "Duplicate generated step badge shape") | M67-agenda-seven-plus.jpg |
| M61 | m-preset-preview 1-4 | default | **passed**: Keynote pictures of 0.35.1 and 0.36.0 pixel-identical; Keynote draws the X, star and plus, so the 0.36.0 preview is right | M61-preset-shapes.jpg |
| M74 / M75 | m-gallery-anchors 1-3 | default | **passed**; slide 3 shows opf#1470, carried by Keynote | M74-M75-gallery-anchors.jpg |

## Findings

- **MX-01 (small; regression against 0.35.1 in Keynote).** M16's line-box shift by the hanging (trailing) space makes right-aligned, centered and end-aligned wrapped lines a space off in Keynote. Default mode: each line is its own text box; Keynote aligns each box's text to the box edge. With 0.35.1's equal boxes the edge held under Helvetica; 0.36.0 shifts each box by its trailing space and Keynote hangs that space.
  Seen: default m-text-flush 1, 3, 4, 6; native m-text-flush 1 (heading only); default m-text-flush-rtl 4, 5, 6, 7. Unaffected: text-flush 2; table cells on 5; native body text on 3, 4; rtl 1-3 (slide XML identical in both versions).

  | slide (px at 1280) | Keynote 0.36.0 | Keynote 0.35.1 | preview |
  |---|---|---|---|
  | text-flush 3, right ends | 1228 / 1228 / 1228 / 1217 | 1220 / 1220 / 1221 / 1217 | 1219 / 1219 / 1220 / 1218 |
  | text-flush 4, centers | 643 / 643 / 645 / 639 | 639 / 639 / 641 / 639 | |
  | text-flush 1, heading right ends | 1231 / 1221 | 1219 / 1221 | |
  | text-flush 6, caption centers | 641 / 639 | 639 / 639 | |
  | rtl 5, line starts | 47 / 47 / 48 / 61 | 59 / 59 / 60 / 61 | |
  | rtl 4, centers | 635 / 635 / 635 / 640 | 639-641 | |
  | rtl 7, centers | 644 / 643 / 643 / 639 | on axis | |
  | rtl 6, right ends | line 2 at 1233, others 1216-1220 | | |

  Cause (inferred): PowerPoint counts the trailing space (per OPF's own measurement and code comment; PowerPoint not available here), Keynote does not. Code: `packages/pptx/src/annotation-export.js:43` `paragraphHangShift`; the heading uses the same shift through the box x plus `marR`. Sheets MX-01-flush-lines-hang-a-space-in-keynote.jpg, MX-01b-flush-rtl-end-aligned-in-keynote.jpg. Min `min/MX-01.opf.json`.
- **MX-02 (wrong).** A bar chart with a manual outer plot area and all-positive values has its category names cut at the left edge ("ranes", "tware"); m-negative-bars 8, identical in 0.35.1; 0.35.1 m-charts 9 had the same and 0.36.0's inner plot fixed it. So the Keynote clipping comes from the manual `outer` plot area, not from negative values. Cause (inferred): Keynote treats any manual plot box as the inner plot. Code: `chart-layer.js:89`, `:116` (defaults to `outer`); the #1425 fix (`index.js:4200`) applies only when the minimum is below 0. Min `min/MX-02.opf.json`.
- **MX-03 (wrong).** M13's added highlight series shows in Keynote's legend ("Wait Wait", "Visits Visits"); columns half width and off their names; the March highlight marker gray. back.pptx: 2 same-named series, `overlap 0`, no `legendEntry` (Keynote ignores `c:legendEntry` and `c:overlap`). 0.35.1: the legend listed the categories on column and bar (also wrong) and "Visits" once on the line chart. Code: `chart-point-series.js`. m-charts 1-3.
- **MX-04 (wrong).** Column chart with long names: Keynote draws every other name, each on one line (m-negative-bars 5; same in 0.35.1). Inferred: Keynote's automatic label skip.
- **MX-05 (wrong / small).** Keynote drops the category name from column data labels ("42" for "North: 42"; back.pptx `showCatName 0`), m-charts 5; and drops the pie label separator, so each label is on two lines ("AMER" / "25"; back.pptx has no `c:separator`), m-charts 12. Same in 0.35.1.
- **MX-06 (wrong).** A Hebrew paragraph with Latin words and no `rtl` attribute gets Keynote's natural (RTL) direction: Keynote sets `rtl="1"` per line from the line's first strong character, so the word order differs from the preview (m-text-flush-rtl 6, both versions).
- **MX-07 (wrong).** The pie legend entry "Europe, Middle East and Africa" is cut at the frame (Helvetica wider; inferred). m-charts 5, both versions.
- **MX-08 (wrong).** Table header "Terminal" broken as "Termina" / "l" (Helvetica Bold wider). m-text-flush 5, default and native, both versions.

## Improvements

- I-MX-01: write line boxes without the hanging space. PowerPoint cost: none expected; the importer would have to rejoin the lines. `--body-text native` already avoids it for body text, not for headings and captions.
- I-MX-02: write an inner plot for every bar chart. PowerPoint cost: none expected, unknown until opened.
- I-MX-03: a highlight form Keynote keeps; belongs in the opt-in Keynote route (#1298), with a PowerPoint legend cost.
- I-MX-04: `c:tickLblSkip 1`.
- I-MX-06: write `rtl="0"` explicitly. No PowerPoint cost.
- Fonts (MX-07, MX-08): `--typefaces safe`, not checked.

## Known rows, confirmed in passing

Still show: direct line labels dropped and stacked lines unstacked (m-charts 4); reference line label in the legend (m-charts 5); per-point bar colors not drawn (m-charts 6, 9); chart title centered; link color for a link inside a sentence (m-links 3); monospace replaced by Helvetica (m-gallery-anchors 1). No longer shows: the negative-bar clipping, for charts with a negative range. Link color in footers and video captions is fixed by M65.

## Not run

Keynote user interface checks (Edit Chart Data on M13, value-label inspector, link inspector, paragraph direction: `grades/ui-checks.md`); Keynote's warnings panel and missing-fonts list; Play; main in Keynote (parts identical); object counts for m-agenda not reconciled one to one (Keynote counts group children).
