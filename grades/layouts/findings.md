# Layout sweep in Keynote 16.0, OPF 0.36.0: findings (LY)

Files: ordinary (default, native, static), little (default, native), lots (default, native); 266 slides, all looked at in the grid sheets (`$W/keynote/036/layouts/_sheets`), the ones below at full size. Grades against OPF's 0.36.0 preview. Main result: `by-layout.md`. Versions: no 0.35.1 run exists for these decks ("no 0.35.1 run"); main: not run (no part comparison made). Minimal decks are "not yet opened in Keynote" (listed in `$W/grades/reopen-list.txt`). Cause statements are **inferred** unless marked saw.

Overall (saw): ordinary and little hold up (only Helvetica for Aptos, footer number, link color, SmartArt picture); lots falls apart in 12 of 38 slides in default and 11 in native, mostly through one cause (LY-01). Export mode: static = default plus a complete footer; native differs from default on 8 (ordinary), 7 (little) and 12 (lots) slides only, because only those have a body placeholder.

## LY-01 Long titles wrap to an extra line and overprint the content (wrong)
- Where (saw): lots default and native slides 1, 10, 13, 22, 25, 26, 28, 34; ordinary default/native/static slide 1 (cover title "hubs" over "Q3 operations review"). Sheet `evidence/sheets/LY-01-title-overflow.jpg`.
- Minimal OPF: `grades/layouts/min/LY-01.opf.json` (minimal deck not yet opened in Keynote).
- Preview: title ends on its OPF-wrapped lines. Keynote: the title placeholder holds one paragraph per OPF line with a trailing space (probe: "cover: Rollout plan " / "for the northern hubs"; lots 13: two paragraphs, 39 pt Helvetica-Bold); a line wider in Helvetica Bold than the 874 pt box wraps again, a third line lands on the content. The file says `wrap="none"` on the title and Keynote wraps anyway (saw in slide XML and picture). Native mode does not change titles (identical in both modes).
- PowerPoint: not stated in the repository notes I read. 0.35.1: no run. main: not run.
- Cause (inferred): hard line breaks computed with Aptos metrics, written as paragraphs (`ppt/slides/slideN.xml`, title `p:sp`); Keynote ignores wrap="none". Whose: the file is valid; Keynote reads it differently, but OPF's one-paragraph-per-line title is what makes it fragile.
- Experiment: see experiments.md.
- Improvements: write the title as one paragraph and let the app wrap (cost for PowerPoint: unknown; wrap points would then be the app's); `--typefaces safe` does not fix it by itself (not run).

## LY-02 Per-line text boxes sized for Aptos run into each other or off the slide (wrong)
- Where (saw): lots default slide 12 (left column "Monday;" touches right column "Every"; "before the" touches "managers"), lots slide 8 default and native (quote clipped at the right slide edge; known "Quote beside a portrait"), lots slide 6 (body lines reach the slide edge, margin ignored; small). Sheet `LY-02-line-boxes-overrun.jpg`.
- Minimal OPF: `min/LY-02.opf.json` (not yet opened in Keynote).
- Native: slide 12 re-wraps inside each box and holds (grade small); slide 8 and 6 are unchanged in native because those blocks are not written as body placeholders.
- Which mode holds better for "lots" (saw): default writes one box per line, so any line wider in Helvetica overruns (12, 8, 6); native re-wraps but only where a body placeholder exists (12 slides), makes a few blocks one line taller (5, 12, 21: the last lines reach 90 to 97 percent of slide height, none leaves the slide) and does not overflow its box in any slide I saw. Native is better or equal on every slide of the 12; on the other 26 the two are identical (pixel difference below 0.05 mean).
- Cause (inferred): per-line `a:bodyPr wrap="none"` boxes. Whose: valid file, font substitution. Improvement: `--body-text native` (exists) for every text block, not only placeholders: cost for PowerPoint unknown.

## LY-03 Chart legend leaves the chart frame; category labels crowd (wrong)
- Where (saw): lots slide 31 (legend printed over the bullet list beside: "Name an owner" over "Returns handled"), lots slide 36 (legend labels cut at the frame edge: "(thous", "(hundre"), lots slide 30 (four category labels left, set tight: small). Both modes identical. Sheet `LY-03-chart-legend-leaves-frame.jpg`.
- Minimal OPF: `min/LY-03.opf.json` (not yet opened).
- Preview: legend inside the 428 pt frame. Keynote: plot area wider, legend starts further right and its Helvetica labels are longer than the frame. The legend has no manual layout (`chart2.xml`: `legendPos r`, `c:layout/` empty). Cause inferred. Whose: file valid; Keynote lays out differently. Not seen in ordinary/little (short legends); little chart titles centered touching the value label are the known "Chart title centered".
- Improvement: legend at bottom for long series names (cost unknown).

## LY-04 SmartArt arrives as a picture; the picture description is the shape name, not alt (small)
- Where (saw): ordinary 16 (pyramid) and 19 (cycle), little 16, 18, 19, 20: class image in the probe, no `dgm` parts in back.pptx. Pictures: all 15/9/25 images have description = shape name. Examples (saw, probe and back.pptx): cover picture `descr="Blue sky over green hills with a small orange building"` shows "OPF image 1"; SmartArt `descr="Pyramid of 4 levels, top to bottom: Goal, Evidence..."` shows "OPF smartart slides.15.blocks.0.items". back.pptx writes `descr="OPF image 1"`. This confirms the earlier check (description from name, not descr), for 0.36.0.
- Minimal OPF: `min/LY-04.opf.json`. Sheet `LY-04-smartart-picture-alt.jpg`. Looks like the preview. Whose: Keynote reading; the alt text is in the file. Improvement: `--smart-art shapes` (exists, not run) gives editable shapes; set the shape `name` to the alt text as well (cost for PowerPoint: the selection-pane name changes; unknown otherwise).

## LY-05 `layouts-lots` round trip fails: Keynote splits colon categories into two levels
- Saw: `_roundtrip.tsv`: lots default and native fail with "Hierarchical chart category caches cannot be flattened" (`packages/pptx/src/index.js` line 2307, `cachedValues`, `levels.length > 1`). The charts are those of slides 30, 31, 36 (`ppt/charts/chart1..3.xml` of back.pptx, one per slide). The original export has `c:strRef` with 12 single labels ("January: northern hubs"). Keynote wrote `c:multiLvlStrRef`: level 0 holds 24 points with each idx twice (the part after the colon, then the whole label: idx 0 "northern hubs" and idx 0 "January: northern hubs"), level 1 holds "January"..."December". Its embedded workbook still has the full labels in one column. Ordinary/little (labels without a colon) come back as `strRef` and import.
- Verdict: Keynote writes something unusual (a colon in a category triggers the split, inferred from the only difference between decks; duplicate idx inside one level is invalid-looking). OPF's importer is right to reject two levels and would also reject the duplicate idx (`duplicate point index`). It is not a valid file rejected. Improvement for OPF import: fall back to the last level or the first point per idx instead of failing the whole deck (an import note). Sheet `LY-05-roundtrip-colon-categories.jpg`. Minimal OPF `min/LY-05.opf.json` (not yet opened).

## LY-06 Keynote adds layout copies for slides with a different background (small)
- Saw: Keynote's layout names per slide equal the OPF layout name, except "Section 0", "Statement 0", "Closing 0", "Quote 0" (and "Statement 2 0" in native). back.pptx has 43 layouts for the 39 in the file (default), 53 for 49 (native). Slides on those layouts carry a `<p:bg>` (accent1) or a color map different from the layout's bg1 (inferred cause). Looks right on the slide. Whose: Keynote import behavior. Improvement: put the variant background on the layout (cost unknown). Sheet `LY-06-layout-copies.jpg`; min `LY-06.opf.json`.

## Improvements
- Native body text for all text (LY-02); static slide numbers (IM-01, IM-02 sheets: `IM-01-native-body-text.jpg`, `IM-02-static-slide-numbers.jpg`: default shows "3", static "3 / 38" on all 38 ordinary slides; costs the live field in PowerPoint). `--smart-art shapes`: not run.

## Known, confirmed in passing
- Slide number beside footer text: still shows (ordinary default/native, every slide: "N" only); static fixes it (all 38).
- Link in hyperlink color: still shows, now on body text too (slide 6 in all decks: blue 0000EE underline on the blue band; target https://example.com/rollout kept).
- Quote runs off the right edge: still shows (lots 8).
- Chart title centered: still shows (little 30, 31, 36).
- Monospace replaced by Helvetica: still shows (slide 34, all decks).
- Not seen: nothing from the table that no longer shows in these decks (no negative-value bar chart etc.).
- Preview problems seen unchanged in Keynote (not findings): tables off the bottom (lots 32, 33, 36), aside over table rows (lots 32), clipped code (lots 34), double-box hierarchy (ordinary, little 23), little 27 picture to the bottom edge, footer over the cover picture (Keynote shows only "1" there, so slightly less clutter).
