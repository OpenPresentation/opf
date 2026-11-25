# Findings: languages family (OPF 0.36.0 in Keynote 16.0)

Written 2026-11-25. Every statement says saw (picture or file named) or inferred. Main: all slide, theme, chart, layout and master XML of the nine decks is identical to `build/main/languages/` (saw, zip compare, default and native), so "main: unchanged" holds for every finding. 0.35.1: no Keynote run for this family. PowerPoint: no repository note covers these cases, "unknown".

## LG-01 (wrong): the substitute font is wider than the font the file names, so the first column's lines run into the "Latin line" block

- Where seen: 0.36.0, default mode: af, ca, cs, fil, pt, es, sw, tl (lang-latin-1/2/3), vi-Latn (13 pt overlap), bg, el (18 pt), mk, ru, uk (lang-cyrillic-greek), am (20 pt, lang-other). Native mode: bg, uk, cs, da, fil, pt, tl. Another 8 slides leave a gap under 6 pt. Numbers are from the probe text boxes (width of each line box less a trailing space), pictures confirm: ca slide 7, vi slide 6, el slide 2, bg slide 1 (saw).
- Smallest OPF: `min/LG-01.opf.json` (one Catalan slide, two blocks). Minimal deck not yet opened in Keynote (in `reopen-list.txt`).
- OPF's preview: Aptos is drawn as Intos (same widths), a clear gap between the two columns. Keynote: Aptos is not installed, every run asks for Helvetica (probe), which is wider; in default mode each wrapped line is a box with `wrap="none"` laid out at OPF's measure, so the line grows to the right into the neighbor block (saw `sheets/LG-01-substitute-font-wider-collides.jpg`). Native mode wraps inside its own frame, so most slides are fine.
- Cause (inferred): `a:bodyPr wrap="none"` per measured line (packages/pptx text-frame writer) plus the missing Aptos. Whose: the file is valid; Keynote reads the missing font differently (Helvetica); OPF's measure assumes Aptos.
- Fix and experiments: `--typefaces safe` (Arial) is the existing flag; experiment in `experiments.md`. Same on 0.35.1: no Keynote run. Main: unchanged.

## LG-02 (wrong): a right-to-left table is drawn to the left of its frame, over the chart (ar, he)

- Where seen: 0.36.0 default, lang-rtl slides 1 (ar) and 2 (he). Native: same file (native-body-fallback), not opened.
- Smallest OPF: `min/LG-02.opf.json` (a table and a column chart on an Arabic slide). Minimal deck not yet opened in Keynote.
- File: table frame `a:off x=6210300` (489 pt), width 5433060 (428 pt), `a:tblPr rtl="1"`; chart at x 43 pt to 471 pt. OPF's preview: table on the right (489 to 917 pt), chart on the left. Keynote (saw slide-01.png, slide-02.png and `sheets/LG-02-rtl-table-mirrored-over-chart.jpg`): table spans x 61 to 489 pt, i.e. it ends where the file's frame begins, so it covers the chart; the probe says position x 61, back.pptx says x 489.
- opf#1298 point 2 (only the first column shows, Keynote 15.1.1): **no longer shows** in Keynote 16.0. All three columns and nine cells are present in the right visual order (probe cells, saw). It is replaced by this position fault.
- Cause (inferred): Keynote 16.0 anchors a `rtl="1"` table by its right edge at `a:off x`. Whose: the file is valid (PowerPoint places a table by its frame); Keynote reads it differently. Experiment `LG-02` in `experiments.md`. Same on 0.35.1 and main: not run / identical files.

## LG-03 (small): Amharic: line 3 starts with the word separator, line 1 is wider in Kefa

- Where: lang-other slide 1, default. Smallest OPF `min/LG-03.opf.json`. Not yet opened in Keynote.
- Saw: both previews and Keynote's default picture begin the third line with "፡" after the sentence end "።", so the break is in OPF's measured lines (the source text has "።፡"). Keynote's native mode re-wraps and keeps "።፡" inline (saw `lang-other~native` slide 1). Kefa (inferred substitute for Ebrima) is wider: line 1 ends under "Latin line:" (LG-01). Sheet: `sheets/LG-03-amharic-overflow-and-word-separator.jpg`. Whose: OPF's line breaking (file), the overlap part is LG-01.

## LG-04 (small): native mode, Korean wraps inside a word

- Where: lang-cjk native slide 4 (ko). Smallest OPF `min/LG-04.opf.json`. Not yet opened in Keynote.
- Saw: Keynote's own wrap breaks "권/리에" inside a word (`sheets/LG-04-korean-native-wraps-inside-words.jpg`); the preview breaks at spaces. Keynote writes no `lang` on any run in back.pptx (saw, every file in this family), so the language the file sets is lost (inferred cause of the break rule). Valid file; Keynote reads it differently. Default mode is not affected (lines are placed by OPF).

## Improvements

- Latin text: `--typefaces safe` (Arial) removes LG-01 on a Mac (inferred; not run). Cost to PowerPoint: Arial instead of Aptos (the user's chosen face changes). Existing flag: yes.
- Hebrew: name Arial or Tahoma, not Segoe UI (Keynote swaps in Verdana today and draws Hebrew by fallback). Cost to PowerPoint: Arial Hebrew or Tahoma Hebrew instead of Segoe UI. Existing flag: no.
- Thai: name Tahoma, not Leelawadee UI (Tahoma has Thai on this Mac per a CoreText run and ships with Windows). Cost: plainer face in PowerPoint. Existing flag: no.
- All other scripts: no family exists on both systems; keep the Windows names, Keynote already draws real glyphs with macOS faces (fonts.md). Windows lacks every macOS script face (Kohinoor, Sangam, PingFang, Thonburi).
- A "for Keynote" route (#1298) could also move the rtl table to the right x and write native-frame wrapping for the line-per-box blocks: proposals only, unknown cost to PowerPoint.

## Known, confirmed in passing

- opf#1298 point 2, rtl table: first-column-only collapse no longer shows (all columns present) in ar and he, slides 1 and 2 of lang-rtl; position fault instead (LG-02).
- Font substituted (Aptos to Helvetica): shows on every slide (all graded small at least).
- Right-to-left chart: Keynote drops `orientation maxMin` and reverses the data order (back.pptx), picture equals the preview; the value axis position is not checked here.
- OPF preview faults confirmed as the preview's (not Keynote's): U+0111 (opf#1472), Malayalam conjunct, Kazakh ә. See fonts.md.
