# Interface checks in Keynote 16.0 (computer use), 2026-11-25, first session

Saved by the supervisor from the agent's hand-back. Rows: `checks.tsv` (35, including not-run rows); pictures `shots/`; Warnings lists `warnings/`. Stopped at 19:21 UTC: the screen locked (second time). No document left open, nothing saved, Play never started. Full-screen control requested once (for Edit Chart Data) and not answered.

What works with Keynote in the background: selecting an object through AppleScript, clicking inspector tabs, `screencapture -l <window>`. The Warnings panel stays on screen, updates per opened document and can be scrolled. Document menus (Show Chart Data Editor, Hide Warnings, Edit Link) work only while Keynote is the active app.

## A (seen on screen unless marked)

1. **MX-03, `m-charts~default` slide 1, chart data editor:** 2 series columns, both headed "Wait"; rows North, South, East, West. Series 1: North empty, South 28, East empty, West 31. Series 2: North 42, South empty, East 35, West empty. Slides 2-3 not run.
   Variants (from the slide pictures; `shots/A1-one-series-variants-sheet.jpg`): no variant gives one legend entry, full-width columns and the highlight on the column and bar charts.

   | Variant | Legend (column / bar) | Columns | Highlight | Line chart legend |
   |---|---|---|---|---|
   | a (as exported) | "Wait Wait" | narrow | yes | "Visits Visits" |
   | b (0.35.1 form) | North South East West (the categories) | wide | yes | "Visits" |
   | c1 | "Wait Series2" | narrow | yes | "Visits Series2" |
   | c2 | "Wait" plus an unnamed empty swatch | narrow | yes | "Visits" plus empty entry |
   | d1 | the categories | wide; first and last column cut at the plot edges | yes | "Visits" |
   | d2 | same as d1 | wide | yes | "Visits" |
   | e | "Wait Wait" | narrow | yes, plus "0" labels on empty points | "Visits Visits", markers at 0 |

   Line chart: b, d1, d2 give the single "Visits" entry. Column and bar: closest is c2.
2. LY-05 `layouts-lots` 30 Edit Chart Data: not run (menu disabled in background).
3. **RT-03, `layouts-ordinary~default` slide 1:** Format > Image > Description reads exactly "OPF image 1". Variants (probe.json): Keynote's description is the picture's `title`, a blank line, then its `name`; never `descr`. Only `name` = alt gives the alt text alone (`title` = alt gives alt + blank line + "OPF image 1"; `descr` only gives "").
4. **LG-02, `lang-rtl~default` slide 1 table:** Arrange X 61 pt, Y 311 pt, 428 x 156 pt. No direction setting on the Table tab. Text tab: Helvetica 24 pt bold, aligned right, no paragraph-direction control. On the canvas the column handles read C | B | A from left to right: Keynote shows a mirrored, right-to-left table, which explains X 61 instead of 489. The chart (y 366) is drawn over the table's lower rows. Slide 2 (he): the same.
   MX-06 / RT-07, `m-text-flush-rtl` slide 6: no paragraph-direction control; "Scheduler" sits at the right end of its line (right-to-left layout inferred from word order).
5. **QC-03, `compliance-readiness-review` slide 8:** "Tandem BioSystems" is item 1 of 5, the back-most object (X 45, Y 503); the picture (960 x 415 at 0,125) covers it; Arrange: Back and Backward dimmed. **QC-04, slide 10:** the footer slide number reads "9" in the editor (slide 9 is skipped).
6. **QS-01:** `shape-overlays` slide 3: no Curved / Straight / Corner control in the Style tab; the line has a green midpoint handle and is drawn straight. Moving "Build" 40 pt moved all three of its lines: connection lines. `diagram-connectors` slide 1: moving "Planning" (a group inside the diagram group) 40 pt left both lines unchanged: the lines do not follow (a scripted move inside a group; a canvas drag was not tried). Both moves undone.
7. `slide-links` (main): not run (screen locked; Edit Link disabled in background).
8. #1418 `coverage-backgrounds` slide 5: not run (screen locked).
9. Warnings panels, scrolled to the end (`warnings/`): `m-charts~default`: "Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside"; "Stacked Line charts aren't supported and were converted to regular Line chart type. Slide(s) 4"; "The font Aptos Display is missing. Your text might look different." `layouts-lots~default`: the media line; Aptos, Roboto Mono, Aptos Display missing. `layouts-ordinary~default`: the same four plus "SVG images were converted to PNG." `compliance-readiness-review`: "Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image 2, Image beside"; Aptos, Consolas, Aptos Display missing. Not run: coverage-charts, data-story-academy, table-and-code, localized-chart-references, fonttest A and E.

## B (done so far)

- `m-charts` 5 Series > Value Labels: pop-up reads "Multiple"; whether Category is checked not read.
- `layouts-ordinary` 27 picture: "OPF image 2". Slide 16 pyramid: one picture; Description "OPF smartart slides.15.blocks.0.items" (an internal id, not the alt text).
- `layouts-ordinary` 4 title: two paragraphs: "statement: Start small " (trailing space) and "enough to learn quickly".
- `layouts-ordinary` 1 title (RT-06): size field "48 pt"; font "Multiple", bold, left.
- Layout list (LY-06), from the dictionary: "Section 0", "Statement 0", "Closing 0", "Quote 0" next to the plain names.
- `lang-rtl` chart: canvas category labels read أحرارًا , الناس , جميع from left to right.

## C editing tests: none run.

## Not run

Screen locked at 19:21 UTC: A7, A8, five A9 decks plus fonttest A and E, the rest of B, all of C. Menu disabled in background and full-screen control not answered: A2, A1 slides 2-3, the `lang-rtl` chart data sheet, the value-label pop-up. To resume: screen unlocked, Keynote in front, continue from A7.
