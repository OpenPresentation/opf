# Corpus: chart and data decks (Keynote 16.0, OPF 0.36.0, 15 decks, default mode)

Saved by the supervisor from the grader's hand-back. 85 slides graded from the grid sheets with full-size crops where it mattered. Data: `grades.json`, `features.json`, `objects.json`, `min/QC-01..10.opf.json`. main: every slide, chart and layout part identical to 0.36.0. 0.35.1: only `coverage-tables` has identical non-tag parts; elsewhere "pending the control run" (most chart differences are `bodyPr wrap="none"` on data labels and the inner plot area). No minimal deck opened in Keynote yet.

## Counts: 4 same, 58 small, 23 wrong

| deck | same | small | wrong |
|---|---|---|---|
| coverage-charts | 0 | 11 | 8 (3, 4, 5, 7, 10, 13, 14, 16) |
| chart-type-sampler | 1 | 2 | 0 |
| chart-point-overlays | 2 | 1 | 0 |
| explicit-chart-reference-lines | 0 | 2 | 3 (1-3) |
| localized-chart-references | 0 | 0 | 7 (all) |
| singleton-combo-reference-lines | 0 | 0 | 1 |
| coverage-tables | 0 | 6 | 0 |
| table-and-code | 0 | 2 | 0 |
| data-story-academy | 0 | 14 | 2 (3, 4) |
| compliance-readiness-review | 1 (9, hidden) | 7 | 2 (8, 10) |
| coverage-variables / -metadata / -warnings | 0 | 5 / 3 / 3 | 0 |
| duration-timeline / localized-timeline | 0 | 1 / 1 | 0 |

15 of the wrong slides show only Known rows (coverage-charts 4, 10, 13; explicit 1; localized 1-7; data-story-academy 3, 4). coverage-charts 16 is MX-03 again ("Wait Wait", half-width bars).

## Findings

- **QC-01 (wrong, round trip): coverage-charts' `back.pptx` does not import, because of two charts.** `import-failed` / `invalid-chart-cache`, "point index is outside its declared count", at `ppt/charts/chart25.xml#c:ser[0]/c:val/c:numRef/c:numCache/c:pt[2]@idx`. Slide 13 (chart25) is a new trigger: an area chart with an authored `null` for Sep; OPF writes `ptCount 4` with points at idx 0, 1, 3 (valid); Keynote writes back `ptCount 3` with idx 0, 1, 3. Slide 16 (chart28) is RT-01 itself (the M13 highlight series). Proved locally: patching both counts makes the file import; either alone still fails. So any chart with a missing value triggers RT-01's mechanism, not only 0.36.0's highlight; the chart25 cache is the same in 0.35.1 (0.35.1's back.pptx expected to fail too: inferred). Only the importer fix (extent = max(ptCount, idx + 1, size of `c:f`)) covers both. File valid; Keynote writes an inconsistent cache; OPF's importer too strict.
- **QC-02 (wrong): Keynote rewrites the value-axis step; percent axes keep only 0% and their maximum.** back.pptx against the original (seen): 46/20 → 23; 50/20 → 16.67; 250/100 → 83.3; 22/5 → 5.5; 35/10 → 8.75; 9/2 → 1.8; 120/50 → 60; percent 0.35/0.1 → 0.35; 0.3/0.05 → 0.3; 0.4/0.1 → 0.4; 0.87/0.2 → 0.87; 0.06/0.01 → 0.06. Steps that divide evenly are kept (50/10, 200/50, 3/0.5, 1/0.25). Visible: explicit-chart-reference-lines 2 primary axis "0%, 35%" and no gridlines; the known secondary-axis row (coverage-charts 14, explicit 3, singleton 1); chart-type-sampler 1 scatter Y axis 0/83/167/250. Cause inferred: Keynote stretches the step so the range divides evenly; fractional steps collapse to one step (0.4/0.1 collapses too: floating point suspected). #1416's 15.4 experiment: dropping `c:majorUnit` restores the labels; 0.36.0 still writes it. Fix candidates: a maximum that is a whole number of steps, or no `c:majorUnit` (PowerPoint cost unknown).
- **QC-03 (wrong, new): the footer placeholder is drawn behind a full-bleed picture.** compliance-readiness-review 8: the "Tandem BioSystems" footer is missing. Keynote puts the `ph type="ftr"` text first in the slide's object order on all 10 slides (probe order; back.pptx writes it first); OPF wrote it after the picture. The centered non-placeholder footer and the slide number placeholder stay on top. File valid; Keynote reorders. Fix candidate: footer text as a plain text box (PowerPoint cost: Header & Footer dialog no longer controls it).
- **QC-04 (wrong): live slide numbers skip a hidden slide.** compliance-readiness-review 10 reads "9" (slide 9 hidden; preview 10); same on full-feature-tour 11. PowerPoint keeps hidden slides in the count (inferred from documented behavior). `--slide-numbers static` should avoid it.
- **QC-05 (wrong): stacked-area value labels at Q2 and Q3 dropped.** coverage-charts 3: OPF writes series labels `showVal 1` with per-point `c:dLbl delete` for idx 0 and 3; Keynote writes `showVal 0`. Inferred: a per-point delete drops all of the series' native labels in Keynote (likely the mechanism of the known "direct line labels dropped").
- **QC-06 (wrong against the preview; OPF's): the chart on coverage-charts 7 is a map (`world`) chart that the preview draws as a tile map and the export writes as an ordinary clustered `c:barChart`** (no `cx:` part, no `mc:AlternateContent`). By design in `chartex: 'auto'` (`packages/pptx/src/chart-types.js:43-47`, `index.js:5704-5712`; build.json warns `pptx/chart-data-adapted`). Unchanged from 0.35.1. A mismatch between OPF's preview and its own export, in every app.
- **QC-07 (small):** General number format shows one decimal (15.16 reads "15.2"; back.pptx `General` → `0.#`). chart-point-overlays 1.
- **QC-08 (small):** axes without written scaling get Keynote's own scale (chart-type-sampler 3: $0-$28 by $7 and 0%-37% against the preview's $0-$30 by $5 and 0%-40%). Improvement: always write the scaling the preview uses.
- **QC-09 (small):** scatter labels set left and right are drawn above the points (`dLblPos l`/`r` → `t`). coverage-charts 9.
- **QC-10 (small):** legend order reversed on radar and area charts (coverage-charts 5, compliance-readiness-review 7; back.pptx swaps series `idx`, keeps `order`).

Sheets: `evidence/sheets/QC-01…QC-10-*.jpg`.

## Extended charts (seen)

| Where | Chart | File holds | Keynote |
|---|---|---|---|
| chart-type-sampler 1 | box and whisker, histogram | `cx:` part inside `mc:AlternateContent`, `mc:Fallback` = `p:pic` of the preview (PNG plus `asvg:svgBlip`) | picture, as the preview |
| chart-type-sampler 2 | waterfall, funnel, treemap | same | picture, as the preview |
| coverage-charts 17 | histogram | same | picture |
| coverage-charts 17 | Pareto with negative values | ordinary combo (data rule `signed-pareto-combo`) | native |
| coverage-charts 18 | Pareto with several series | clustered columns (data rule) | native |
| coverage-charts 7 | map (`world`) | clustered columns, no picture | native columns (QC-06) |

Fallbacks byte-identical to 0.35.1. No native `cx:` Pareto in these decks.

## Tables

All native Keynote tables (coverage-tables 6, table-and-code 1, compliance-readiness-review 2); header row count 1; merged cells kept (`gridSpan="2"` x2, `rowSpan="2"`, `hMerge` x2, `vMerge` x1 on coverage-tables 3); cell fills drawn; numbers are text cells ("automatic"); right alignment drawn but not written back (RT-08). Code: Roboto Mono → Helvetica; indentation survives but narrower; nothing overflows.

## Per feature

`opens` and `slides` passed for all; `noOverflow`/`noShrink` not run (PowerPoint probes).

| feature (deck) | visual | nativeChart / nativeTable | roundtrip |
|---|---|---|---|
| RR-103 (chart-type-sampler) | known (pictures), QC-02, QC-08 | scatter and combo native, 5 extended pictures (known) | |
| tables (table-and-code) | known (fonts) | table passed (edit not run) | |
| example-academy (data-story-academy) | known (bar colors, "/ 16") | | passed |
| example-icons (compliance-readiness-review) | QC-03, QC-04, QC-10 | | |
| SH-25 (chart-point-overlays) | passed (on-point), QC-07 | passed | passed |
| LH-16 (duration-timeline) | passed (fonts known) | | passed |
| LH-110-explicit | known (labels), QC-02 | passed | passed |
| LH-110-singleton | QC-02 | passed | |
| LH-110-localized | known: label dropped x7 | passed | |
| LH-121 (localized-timeline) | passed | | |
| COV-tables | passed (fonts) | | passed |
| COV-charts | known + QC-02/05/06/09/10, MX-03 | | **QC-01** |
| COV-metadata / variables / warnings | passed (fonts) | | passed |
| COV-charts-native (18 slides) | | passed (slide 7 is columns, QC-06) | |
| COV-tables-native | | passed (edit not run) | |

## Import warnings

"Unsupported media were removed. Slide Layout(s): …" on every captured file (avoidable: the layouts' picture placeholders); Aptos / Aptos Display missing on most (avoidable: `--typefaces safe`); Roboto (chart-point-overlays, explicit-chart-reference-lines, singleton-combo-reference-lines, duration-timeline) and Roboto Medium (duration-timeline): the deck's own choice; "Stacked Line charts aren't supported and were converted to regular Line chart type. Slide(s) 4" (coverage-charts): Keynote has no stacked line chart. Panel read too early for coverage-charts (this pass), compliance-readiness-review, data-story-academy, table-and-code.

## Known rows

- Extended charts as a picture of the preview: still shows; fallback unchanged from 0.35.1.
- Radar with lines only drawn filled: still shows (coverage-charts 5); labels collide, "Researc" clipped; series fill still `solidFill` (#1416's `noFill` not adopted).
- Secondary value axis loses labels, legend overlaps: still shows (coverage-charts 14, explicit 3, singleton); cause narrowed in QC-02.
- Reference line label dropped: still shows on native-chart references (explicit 1-3, localized 1-7, coverage-charts 14); overlay references keep labels.
- Bar-chart reference label collision: gone on coverage-charts 16, only because MX-03's two-series layout moves the bars (inferred).
- Direct line labels dropped; stacked lines unstacked: still show (coverage-charts 4, 10).
- Area chart bridges a gap: still shows (coverage-charts 13).
- Chart title centered: still shows.
- Per-point bar colors: still shows (data-story-academy 3, 4: `c:dPt` dropped).
- Negative-value bar category labels: **gone** on coverage-charts 15 (names whole; inner plot area).
- Slide number beside footer text: still shows (data-story-academy "N / 16" reads "N").
- Monospace and light faces replaced: still shows (table-and-code 2; Roboto SemiBold drawn regular in duration-timeline 1).
- Language digits in charts; right-to-left value axis: not in these decks.

## Improvements

Importer tolerates sparse or short caches (QC-01, RT-01; no PowerPoint cost). A maximum that is a whole number of steps, or omit `c:majorUnit` (QC-02; cost unknown). Always write explicit axis scaling (QC-08). Radar series area `noFill` (#1416; no PowerPoint cost per #1416). Footer text as a non-placeholder text box or the placeholder after full-bleed pictures (QC-03; Header & Footer dialog loses control). Static slide numbers for decks with hidden slides (`--slide-numbers static`). An explicit number format instead of General (QC-07). Map chart: preview should draw what the export writes, or the export writes the preview picture (QC-06; `--charts picture`).

## Not run

Minimal decks in Keynote; cell edits and Edit Chart Data (`grades/ui-checks.md`); full warning lists where the panel was read too early; 0.35.1 in Keynote.
