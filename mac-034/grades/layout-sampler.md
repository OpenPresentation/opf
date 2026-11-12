# layout-sampler and layout-sampler~native-body (Keynote 15.1.1)

No major differences. All 53 slides present in both files; no lost content, no overlaps off-slide.

| file | slide | what differs | size |
| --- | --- | --- | --- |
| layout-sampler | 22, 23, 28, 40, 41, 42, 49 | Bar charts lose the highlighted last bar: week 4 is drawn in the same light blue as weeks 1-3 (preview: darker blue). Same on slide 28 right chart: team A bar (dark blue in preview) is gray like team B. Data, value labels and axes are all present. Chart title is centered over the plot instead of left-aligned; value-axis title is clipped to "ask completion" at the left edge | moderate |
| layout-sampler | 19, 45 | Footer "Illustrative example - fictional data" is hidden behind the full-bleed picture in Keynote (slide 19 shows only "Illustrative examp"; slide 45 shows none). In the preview it draws over the picture | minor |
| layout-sampler | 22, 23, 28, 40, 41, 42, 49 | Chart axis title "Week" sits lower and close to the footer or body text (slide 22 almost touches the body paragraph) | minor |
| layout-sampler | 27 | Body line "Keep the scope narrow, ... give" ends flush at the picture edge (wider substitute font); no overlap | minor |
| layout-sampler | 17 | Dark callout text fills the full box width, touching both edges | minor |
| layout-sampler | 26, 48 | Code uses a proportional substitute (Roboto Mono missing), so lines look narrower or larger than in the preview; wrapping is the same, all text stays inside the code box | minor |
| layout-sampler | 1-53 | Colors are slightly muted (theme blue and greens look desaturated, as in the other files), text 2-3 px higher; font substitution only | minor |
| layout-sampler~native-body | 4, 5, 6, 13, 15, 22-27, 32, 33, 36, 37, 40, 41, 43, 45-48 | Differs from the default Keynote image only by 1-2 px text offsets and a different break in a few lines: 26 ("to a running sum" moves to line 2), 37 ("gives us" / "us a baseline"), 48 (same as 26). No clipped, overlapping or missing text. Charts, tables, shapes and pictures are identical to default | minor (does not matter) |
| layout-sampler~native-body | all | Same chart highlight loss and footer-behind-picture on 19 and 45 as the default file (not new) | see above |

Slides not listed are OK in both files: 1-16, 18, 20, 21, 24, 25, 29-36, 38, 39, 43, 44, 46, 47, 50-53 (title, section, closing, columns, cards, steps, timeline, KPI, image, table, shape diagrams, pyramid, venn, org charts, funnel all match the preview).

Features:
- LH-sampler: pass (opens and 53 slides; visual matches apart from the rows above; noOverflow by eye pass; noShrink not graded here)
- LH-sampler-charts (22, 23): differs (week 4 highlight color lost, axis title clipped; chart present with correct data and labels; nativeChart cannot be confirmed from a picture, no _probe.txt for this deck)
- LH-sampler-tables (24, 25): pass (header, rows, values, alignment and banding match; nativeTable not graded here, no _probe.txt)
- LH-sampler-native-body: pass (matches default; only wrapping or 1-2 px shifts)
- RR-104 (noShrink): not graded here
- LH-186 (layout before shrink): pass by eye (no text visibly shrunk or overflowing)
