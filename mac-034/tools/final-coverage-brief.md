# Keynote grading brief: the 30 coverage decks of the v0.34.0 release content (commit fdd06ce4084457bece40b074633b2500ddbfdb6a)

You grade how Keynote 15.1.1 (macOS 26.6) draws the 30 `coverage-*` decks of the OPF qualification corpus, compared with OPF's own
preview. Read-only work: do NOT open Keynote, PowerPoint or any GUI app, do not commit or push, do not edit any file except your
notes file `/Users/michael/opf-work/mac-034-bisect/grades/final-coverage.md`. American English. Never name other presentation libraries.

## Inputs

- Corpus: `/Users/michael/opf-work/mac-034-final-corpus/`.
- Side-by-side sheets (OPF preview | Keynote, scaled to the preview's size | pixel difference): `keynote-sheets/<file>-<n>.png`, where
  `<n>` counts the slides Keynote exported. Hidden slides are not exported and not previewed: `coverage-composition` slide 11 is
  hidden, so its sheets 1 to 10 are slides 1 to 10. Start with the sheet; open the two full images when you need detail.
- OPF preview: `preview/<deck>/slide-<n>.png`. Keynote's own export (960 x 540 for 16:9; other sizes for `coverage-size-*`):
  `keynote/<file>/slides/slides.<nnn>.png`.
- `final-report.json`: per file `scores[]` (`vsPreview`, the share of pixels that differ by 24/255 or more: a pointer only, not a
  verdict) and `slides[]` (Keynote's probe: layout name, title showing, title text and paragraph count, title font and size, and
  the fonts of its text items, shapes and tables).
- `pptx/<file>.pptx` (you may unzip to read XML; never modify) and `pptx-expect.json` (what each PPTX says).
- Manifest of features and what each check means: `/Users/michael/opf-work/mac-034-final/scripts/native-acceptance/qualification/manifest.json`,
  and the decks themselves: `/Users/michael/opf-work/mac-034-final/scripts/native-acceptance/qualification/decks/coverage-*.opf.json`
  (each slide's intent is usually in its title and notes).

## Known context (do not report as new; mention once if it explains a difference)

- This Mac has no Aptos, Roboto or other Office fonts; Keynote substitutes Helvetica, so glyph widths and line breaks differ slightly.
  Flag a font difference only when it causes harm: text clipped, overlapping, running out of its box or off the slide, a break that
  changes meaning, many more lines.
- Measured Keynote limits (already documented): a shape holding a live slide number shows only the number; reference-line labels are
  not drawn (the legend names the line); per-point bar colors are not drawn; chart digits stay Latin; a right-to-left chart keeps
  its value axis on the left; a right-to-left table shows only its first column; inner shadow, glow, soft edge and blur are not
  drawn; curved connectors are drawn straight; SmartArt is drawn from its picture fallback; extended charts (histogram, Pareto,
  waterfall, box and whisker, funnel, treemap) show their picture fallback; Keynote lays out a classic chart's plot area itself.
- Keynote numbers duplicate layout names ("Title Only 1", "Title Only 2") when slides of one layout differ: not a finding.

## What to look for first (the supervisor's likeliest gaps)

Pattern backgrounds and pattern fills, sketch (hand-drawn) outlines, compound lines (double, thick-thin), custom paths (custGeom),
gradient and picture backgrounds, image crops and masks, dash styles, arrowheads, text effects. Start with the highest `vsPreview`
slides: `coverage-backgrounds` 5 (98.6%), `coverage-shape-styles` 11 (77%), `coverage-charts` 7, 13, 16, 19, `coverage-shape-styles` 1,
and the slide 2 of every `coverage-size-*` deck (about 11 to 13%).

## What to report

Write your notes to the notes file, then return a compact reply (under about 70 lines):

1. A table with one row per difference: `| file | slide | what differs | size |` with size minor (cosmetic), moderate (visibly
   different, content intact) or major (content lost, unreadable, overlapping, wrong data, missing element). Lead with major rows.
   Name the OPF/DrawingML feature where you can tell (read the slide XML: e.g. `a:pattFill prst="..."`, `a:custGeom`,
   `cmpd="dbl"`, a sketch `ask:lineSketchStyleProps`).
2. One line per coverage deck: OK, or the row numbers.
3. Anything you could not judge at this resolution, said plainly. Do not guess.
