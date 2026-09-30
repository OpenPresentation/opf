# Preview vs PPTX parity: pptx.gallery values

Generated 2026-09-30T09:48:36.938Z by `dimension-audit/parity/scripts/parity.mjs` (Node v24.21.0, worktree prefix `parity`). No Office was used.

Heads: opf `aedd364`, opf-render `a66caa3`, opf-pptx `0400434`, pptx-gallery `b2238ac`.

## Measurement notes (2026-09-30: charts measured, owner defaults applied)

This is the FF-36 re-run on the published set: core `aedd364` (package 0.11.2), opf-render 0.11.3 `a66caa3` (classic charts render natively),
opf-pptx 0.11.2 `0400434` (native classic chart constructs, chart-data-adapted diagnostics, theme colour refs) and pptx-gallery `b2238ac`
(category-major chart snippets; 26 kept chart ids). The engines run against one local core (`register-local-opf.mjs`), the 850-value
set, no Office. The baseline of the before/after tables is the opf#186 run ([PARITY-2026-09-29-merged-heads.md](PARITY-2026-09-29-merged-heads.md),
core `930577d`, opf-render `021cca0`, opf-pptx `0d15f1c`, pptx-gallery `0b2dec8`): 657 perfect, 37 near, 156 mismatch.

**Scoreboard: 707 perfect, 47 near, 96 mismatch of 850.** Four runs on the same values, so that each change is separable:

| run | perfect | near | mismatch | charts (perfect / near / mismatch) | layouts (perfect / near / mismatch) |
| --- | --- | --- | --- | --- | --- |
| opf#186 (previous heads, harness of that PR) | 657 | 37 | 156 | 0 / 0 / 26 | 444 / 2 / 39 |
| these heads, harness exactly as merged | 700 | 48 | 102 | 3 / 11 / 12 | 483 / 2 / 0 |
| these heads, with the chart series-colour comparison | 703 | 51 | 96 | 5 / 14 / 7 | 483 / 2 / 0 |
| these heads, with the chart series-colour comparison and slide-number field folding (published) | 707 | 47 | 96 | 5 / 14 / 7 | 483 / 2 / 0 |

### What changed against opf#186, and why

| dimension | before | after | cause |
| --- | --- | --- | --- |
| layouts | 444 / 2 / 39 | 483 / 2 / 0 | engine: the 39 layouts that embed a native chart failed "series colours not in preview". opf-render 0.11.3 paints the classic chart constructs, so the preview carries the series colours the export writes (already so in the run with the harness as merged) |
| blocks | 19 / 8 / 5 | 21 / 8 / 3 | `financial-snapshot` and `data-story-insight` embed a native chart: `data-story-insight` improves with the engines, `financial-snapshot` with the harness's stroke comparison (a line series). The 3 remaining mismatches are text colours (`pitch-deck-intro`, `section-break`, `closing-cta`), unchanged |
| charts | 0 / 0 / 26 | 5 / 14 / 7 | see below |
| headers-footers (published and withAssets) | 8 / 2 / 0 | 10 / 0 / 0 | owner default 2026-09-30: a native slide-number field plus adjacent literal runs is one run, so `slide-number-progress` and `appendix-numbering` (`{current} / {total}`, `A-{current}`) are perfect |
| every other dimension | unchanged | unchanged | fontResolution is identical (733 pass, 31 near, 86 fail) |

Net: +50 perfect, +10 near, -60 mismatch. Attribution: the engine releases (with the harness as merged) account for 43 of the 50 (39 layouts,
1 block, 3 charts); the chart series-colour comparison for 3 more (2 charts, 1 block) but also moves 3 charts from mismatch to near;
the slide-number folding for 4 (the two values, each published and withAssets).

### Charts: what the harness now compares (instrument change, no tolerance change)

The harness took a native chart's series colour to be the first `srgbClr` of the series `c:spPr`. That is right for a bar, an area and a filled
radar (a fill), and wrong for the other constructs:

- **Line, stacked line, radar and radar with markers** paint the series as a stroke. The harness now compares the series `a:ln` fill against
  the strokes of the preview's series polylines and paths (those traced to `data.columns`). Before, only the marker circles carried the colour, so
  `line`, `stacked-line-3x` and `radar` failed and the versions with markers passed by accident.
- **Pie and doughnut** have one colour per slice (`c:dPt`). PptxGenJS also writes a 0.75 pt `F9F9F9` line on the series, which is the slice border; the
  old rule read it as the series colour, and the preview does not paint it as a fill. The harness now compares the slice fills, so the
  preview's two slice colours are matched against the export's two (they agree).

On these heads that moves 5 charts (`100pct-stacked-column-3x`, `100pct-stacked-bar-3x` and `100pct-stacked-area-3x` were perfect with the
harness as merged; `pie` and `doughnut` become perfect with the slice comparison, `line`, `stacked-line-3x` and `radar` go from fill failures
to near), and one block. The numbers without the change are in the table above.

The 19 classic charts now have no fills, geometry, z-order, typeface, font, theme or re-import failure. Five are perfect. The other 14 are
near for one reason: a native chart lays out its own labels, so a label the preview wraps (for example "Q1 2024") is a single line in
the chart cache (`chart label wrapped/split in preview`). The 7 chartex charts (`treemap`, `histogram`, `pareto`, `world`, `box-and-whisker`,
`waterfall`, `funnel`) are still mismatches: the preview keeps the legacy single-series sketch, whose labels are not in the clustered column
chart the exporter writes instead (`chart preview text not in native chart cache`). The presence audit records the same seven as `partial`.

| Gallery chart | Pipeline | Preview | Export | Re-import | Parity | text | fills |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `column` | works | column (marks match) | barChart, barDir col, grouping clustered | column | near | near | pass |
| `stacked-column-3x` | works | stacked-column-3x (marks match) | barChart, barDir col, grouping stacked | stacked-column-3x | near | near | pass |
| `100pct-stacked-column-3x` | works | 100pct-stacked-column-3x (marks match) | barChart, barDir col, grouping percentStacked | 100pct-stacked-column-3x | perfect | pass | pass |
| `line` | works | line (marks match) | lineChart, grouping standard, no markers | line | near | near | pass |
| `line-with-markers` | works | line-with-markers (marks match) | lineChart, grouping standard, markers | line-with-markers | near | near | pass |
| `stacked-line-3x` | works | stacked-line-3x (marks match) | lineChart, grouping stacked, no markers | stacked-line-3x | near | near | pass |
| `stacked-line-with-markers-3x` | works | stacked-line-with-markers-3x (marks match) | lineChart, grouping stacked, markers | stacked-line-with-markers-3x | near | near | pass |
| `pie` | works | pie (marks match) | pieChart | pie | perfect | pass | pass |
| `doughnut` | works | doughnut (marks match) | doughnutChart | doughnut | perfect | pass | pass |
| `bar` | works | bar (marks match) | barChart, barDir bar, grouping clustered | bar | near | near | pass |
| `stacked-bar-3x` | works | stacked-bar-3x (marks match) | barChart, barDir bar, grouping stacked | stacked-bar-3x | near | near | pass |
| `100pct-stacked-bar-3x` | works | 100pct-stacked-bar-3x (marks match) | barChart, barDir bar, grouping percentStacked | 100pct-stacked-bar-3x | perfect | pass | pass |
| `area` | works | area (marks match) | areaChart, grouping standard | area | near | near | pass |
| `stacked-area-3x` | works | stacked-area-3x (marks match) | areaChart, grouping stacked | stacked-area-3x | near | near | pass |
| `100pct-stacked-area-3x` | works | 100pct-stacked-area-3x (marks match) | areaChart, grouping percentStacked | 100pct-stacked-area-3x | perfect | pass | pass |
| `scatter` | works | scatter (marks match) | scatterChart, scatterStyle marker | scatter | near | near | pass |
| `radar` | works | radar (marks match) | radarChart, radarStyle standard, no markers | radar | near | near | pass |
| `radar-with-markers` | works | radar-with-markers (marks match) | radarChart, radarStyle marker, markers | radar-with-markers | near | near | pass |
| `filled-radar` | works | filled-radar (marks match) | radarChart, radarStyle filled, no markers | filled-radar | near | near | pass |
| `treemap` | partial | legacy sketch | barChart, barDir col, grouping clustered (chartex-fallback) | column | mismatch | fail | pass |
| `histogram` | partial | legacy sketch | barChart, barDir col, grouping clustered (chartex-fallback) | column | mismatch | fail | pass |
| `pareto` | partial | legacy sketch | barChart, barDir col, grouping clustered (chartex-fallback) | column | mismatch | fail | pass |
| `world` | partial | legacy sketch | barChart, barDir col, grouping clustered (chartex-fallback) | column | mismatch | fail | pass |
| `box-and-whisker` | partial | legacy sketch | barChart, barDir col, grouping clustered (chartex-fallback) | column | mismatch | fail | pass |
| `waterfall` | partial | legacy sketch | barChart, barDir col, grouping clustered (chartex-fallback) | column | mismatch | fail | pass |
| `funnel` | partial | legacy sketch | barChart, barDir col, grouping clustered (chartex-fallback) | column | mismatch | fail | pass |

### Presence and owner defaults on these heads

Audits A and B were re-run on the same heads (see [gallery-support.md](../../gallery-support.md#charts-measured-and-owner-defaults-2026-09-30)):
427 of 819 values `works` (379 of 793 before). The 26 charts are now presence items (19 `works`, 7 `partial`), the image treatments are re-measured with the
redefined probe (15 of 15 `works`; the retained September 23 rows are dropped), and colour schemes go from 14 `partial` to 14 `works`
(opf-pptx 0.11.2 writes `a:schemeClr` references, FF-24b). Owner defaults recorded as "owner default 2026-09-30":
slide-number fields (the folding above), the image-treatment definition of `works`, and socials (icons are catalog metadata only; URLs render and link).


## What "perfect" means

For each value, the harness builds the gallery's own OPF Config document. It renders the traced preview (`renderSvgDeck` with `trace:true`, plus `resolvePresentation` geometry) and exports it with `toPptx`. It then compares the two element by element. PPTX shapes are mapped to preview items in two ways: by the exporter's stable object names (`OPF heading|text|card <path> line N`), or else by geometric containment in the composed item box. The slide-image picture (`OPF slide image slides.N`, FF-26) maps to the preview slide-image group; its frame is compared as the visible image rect (the frame widened by `a:srcRect`, clipped to the frame).

| check | pass means |
|---|---|
| geometry | the rendered text line extent (left edge from the anchor and the line width by core measureText; PPTX: box x + marL, centered or right-aligned in the box) and baseline (box y + size) are within 0.02 pt. Chart, picture and card frames equal the composed box within 0.02 pt; a table frame equals the drawn preview table (the union of its cell rectangles, which can be shorter than the composed box) within 0.02 pt. The crop (`a:srcRect`) of a picture places the image content where the preview `preserveAspectRatio` does, within 0.02 pt at the visible edges. Deltas up to 0.5 pt count as near; a non-finite delta (NaN or infinite geometry, or a crop that leaves no image) fails. |
| text | Same line text (plain runs `a:r` and fields `a:fld`, such as the slide number and date, which carry the rendered value in `a:t`); same run segmentation; per run, the same family in the script slot used by the text (latin/ea/cs), size within 0.005 pt, bold, italic and resolved RGB colour (srgb, or schemeClr resolved through theme1); same paragraph alignment; same list markers. Native charts: preview labels exist in the chart caches, and the chart XML names the preview font. |
| fills | Same background kind and colour. Per element group, the same set of solid fill colours (table cell fills included) and the same image count and bytes (sha256). Chart series colours appear in the preview. |
| zOrder | The order of mapped element groups in spTree matches SVG paint order, and the slide count matches. |
| slideSize | `p:sldSz` equals the SVG viewBox within 0.02 pt. |
| typefaces | Every `typeface=` in every part (charts and embedded workbook styles included) and every font listed in app.xml is a family the preview uses. Theme per-script supplements are reported separately and are not gated. |
| reimport | `fromPptx` preserves design.colorScheme, fontScheme, theme, background, dimensions, language, narrative, tone, audience and slide layout ids. A loss with a specific diagnostic counts as near; a silent loss fails. |
| fontResolution | For every family the selected design uses (owner decision, 2026-09-29; see below): **pass** when the PPTX names the selected family (theme major/minor for the heading/body fonts, run or chart slots otherwise) and the preview draws the real face (an open bundled family) or the FF-31 policy table's metric-compatible replacement. **near** when the PPTX names the selected family and the preview draws the policy table's route for it, but only at the visual look-alike tier ("visual-only replacement"; layout not guaranteed). **fail** when the family has no row in the policy table, the preview has no face for it, the preview draws a face that is not the table's route (an unexpected host, system or generic fallback), or the PPTX writes a replacement name instead of the selected name. The metric or visual tier is reported per family. |
| theme | Theme major/minor latin equal the preview heading/body fonts, and the theme clrScheme equals the document colour scheme. |
| mapping | Every preview element group has PPTX shapes and the reverse. An unmapped PPTX shape counts as near. A slide-image picture with no preview slide image fails. |

fontResolution owner decision, 2026-09-29 (verbatim): "look-alike fonts are to get around any font licensing restrictions. They are desirable for open source but if we export to PowerPoint the pptx file should include references to the font they selected and want to see in PowerPoint." Refinement, later the same day (verbatim): "if the user wants Aptos... if Aptos is license restricted we can substitute a font (Aptos2 or whatever it's named) that looks similar and has the same size in pixels on the screen for rendering live previews of SVG. When we export to PPTX we should have PowerPoint open that file and display actual Aptos." So a look-alike is intended, the PPTX must keep the selected name, and the target look-alike is metric-compatible; a visual-only look-alike is policy-conformant but reported as near. Before this decision the check passed only for the real face or a metric-compatible substitute; that old definition is computed from the same run (`results[].legacy`) and compared below.

Modelled preview font host: the office pack with `substitutionPolicy:"visual"` and no `scripts` (Noto script) pack. The shipped previews load the same: the opf-editor playground bundle that pptx.gallery embeds builds its registry with `loadOfficeFontRegistry()` and no `scripts`, the gallery layout thumbnails use no registry, and opf-render never loads the script pack by itself (a host must pass `scripts`, for example from `detectScripts(presentation)`; no shipped host does). A family that only the script pack serves therefore fails fontResolution with "preview has no face", which is a product gap, not an instrument error.

Classification: **perfect** means every check passes; **near** means only near deltas; **mismatch** means at least one check fails. Both engines use the default layout measurement (no host registry), so geometry is computed from the same composition.

## Per-dimension counts

| dimension | n | perfect | near | mismatch | geometry | text | fills | zOrder | slideSize | typefaces | reimport | fontResolution | theme | mapping |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| color-schemes | 14 | 14 | 0 | 0 | 14/14 | 14/14 | 14/14 | 14/14 | 14/14 | 14/14 | 14/14 | 14/14 | 14/14 | 14/14 |
| font-schemes | 89 | 11 | 18 | 60 | 89/89 | 89/89 | 89/89 | 89/89 | 89/89 | 89/89 | 89/89 | 11/89 (+18 near) | 89/89 | 89/89 |
| font-schemes-legacy | 4 | 3 | 0 | 1 | 4/4 | 4/4 | 4/4 | 4/4 | 4/4 | 4/4 | 4/4 | 3/4 | 4/4 | 4/4 |
| languages | 93 | 66 | 2 | 25 | 93/93 | 93/93 | 93/93 | 93/93 | 93/93 | 93/93 | 93/93 | 66/93 (+2 near) | 93/93 | 93/93 |
| themes | 4 | 1 | 3 | 0 | 4/4 | 4/4 | 4/4 | 4/4 | 4/4 | 4/4 | 4/4 | 1/4 (+3 near) | 4/4 | 4/4 |
| narratives | 10 | 10 | 0 | 0 | 10/10 | 10/10 | 10/10 | 10/10 | 10/10 | 10/10 | 10/10 | 10/10 | 10/10 | 10/10 |
| audiences | 14 | 14 | 0 | 0 | 14/14 | 14/14 | 14/14 | 14/14 | 14/14 | 14/14 | 14/14 | 14/14 | 14/14 | 14/14 |
| tones | 7 | 7 | 0 | 0 | 7/7 | 7/7 | 7/7 | 7/7 | 7/7 | 7/7 | 7/7 | 7/7 | 7/7 | 7/7 |
| socials | 10 | 10 | 0 | 0 | 10/10 | 10/10 | 10/10 | 10/10 | 10/10 | 10/10 | 10/10 | 10/10 | 10/10 | 10/10 |
| backgrounds | 6 | 6 | 0 | 0 | 6/6 | 6/6 | 6/6 | 6/6 | 6/6 | 6/6 | 6/6 | 6/6 | 6/6 | 6/6 |
| backgrounds (withAssets) | 6 | 6 | 0 | 0 | 6/6 | 6/6 | 6/6 | 6/6 | 6/6 | 6/6 | 6/6 | 6/6 | 6/6 | 6/6 |
| image-treatments | 15 | 15 | 0 | 0 | 15/15 | 15/15 | 15/15 | 15/15 | 15/15 | 15/15 | 15/15 | 15/15 | 15/15 | 15/15 |
| image-treatments (withAssets) | 15 | 15 | 0 | 0 | 15/15 | 15/15 | 15/15 | 15/15 | 15/15 | 15/15 | 15/15 | 15/15 | 15/15 | 15/15 |
| headers-footers | 10 | 10 | 0 | 0 | 10/10 | 10/10 | 10/10 | 10/10 | 10/10 | 10/10 | 10/10 | 10/10 | 10/10 | 10/10 |
| headers-footers (withAssets) | 10 | 10 | 0 | 0 | 10/10 | 10/10 | 10/10 | 10/10 | 10/10 | 10/10 | 10/10 | 10/10 | 10/10 | 10/10 |
| blocks | 32 | 21 | 8 | 3 | 32/32 | 29/32 | 32/32 | 32/32 | 32/32 | 32/32 | 32/32 | 24/32 (+8 near) | 32/32 | 32/32 |
| layouts | 485 | 483 | 2 | 0 | 485/485 | 483/485 | 485/485 | 485/485 | 485/485 | 485/485 | 485/485 | 485/485 | 485/485 | 485/485 |
| charts | 26 | 5 | 14 | 7 | 26/26 | 5/26 | 26/26 | 26/26 | 26/26 | 26/26 | 26/26 | 26/26 | 26/26 | 26/26 |
| **all** | 850 | 707 | 47 | 96 | 850/850 | 824/850 | 850/850 | 850/850 | 850/850 | 850/850 | 850/850 | 733/850 (+31 near) | 850/850 | 850/850 |

The check columns count values that pass that check (fontResolution also shows how many are near). A value is perfect only when every check passes.

Picture crop-position check: 425 of 425 pictures measured; 0 unmeasured (preview image size unknown, reported as near).

## Before / after

Baseline heads: opf `930577d`, opf-render `021cca0`, opf-pptx `0d15f1c`, pptx-gallery `0b2dec8`.

| dimension | perfect before | perfect after | near before | near after | improved | regressed |
|---|---|---|---|---|---|---|
| color-schemes | 14 | 14 | 0 | 0 | 0 | 0 |
| font-schemes | 11 | 11 | 18 | 18 | 0 | 0 |
| font-schemes-legacy | 3 | 3 | 0 | 0 | 0 | 0 |
| languages | 66 | 66 | 2 | 2 | 0 | 0 |
| themes | 1 | 1 | 3 | 3 | 0 | 0 |
| narratives | 10 | 10 | 0 | 0 | 0 | 0 |
| audiences | 14 | 14 | 0 | 0 | 0 | 0 |
| tones | 7 | 7 | 0 | 0 | 0 | 0 |
| socials | 10 | 10 | 0 | 0 | 0 | 0 |
| backgrounds | 6 | 6 | 0 | 0 | 0 | 0 |
| backgrounds (withAssets) | 6 | 6 | 0 | 0 | 0 | 0 |
| image-treatments | 15 | 15 | 0 | 0 | 0 | 0 |
| image-treatments (withAssets) | 15 | 15 | 0 | 0 | 0 | 0 |
| headers-footers | 8 | 10 | 2 | 0 | 2 | 0 |
| headers-footers (withAssets) | 8 | 10 | 2 | 0 | 2 | 0 |
| blocks | 19 | 21 | 8 | 8 | 2 | 0 |
| layouts | 444 | 483 | 2 | 2 | 39 | 0 |
| charts | 0 | 5 | 0 | 14 | 19 | 0 |
| **all** | 657 | 707 | 37 | 47 | 64 | 0 |
### Checks passed, before and after (all values)

Baseline: the results file passed as the baseline (a run at the same heads when the two head lists match, so the difference is the harness). Each cell is the number of values that pass the check.

| check | before | after |
|---|---|---|
| geometry | 850 | 850 |
| text | 826 | 824 |
| fills | 783 | 850 |
| zOrder | 850 | 850 |
| slideSize | 850 | 850 |
| typefaces | 850 | 850 |
| reimport | 850 | 850 |
| fontResolution | 733 | 733 |
| theme | 850 | 850 |
| mapping | 850 | 850 |
| values | 850 | 850 |

## fontResolution definition change (owner decision 2026-09-29): old vs new, same run

Both columns come from the same run on the same heads. The old definition passes only the real face or a metric-compatible substitute. The new one is defined above. Every other check is identical under both, so the only difference is fontResolution and the classes that follow from it.

| dimension | n | perfect old | perfect new | near old | near new | mismatch old | mismatch new | fontResolution pass old | pass new | near new | fail new |
|---|---|---|---|---|---|---|---|---|---|---|---|
| color-schemes | 14 | 14 | 14 | 0 | 0 | 0 | 0 | 14 | 14 | 0 | 0 |
| font-schemes | 89 | 11 | 11 | 0 | 18 | 78 | 60 | 11 | 11 | 18 | 60 |
| font-schemes-legacy | 4 | 3 | 3 | 0 | 0 | 1 | 1 | 3 | 3 | 0 | 1 |
| languages | 93 | 66 | 66 | 0 | 2 | 27 | 25 | 66 | 66 | 2 | 25 |
| themes | 4 | 1 | 1 | 0 | 3 | 3 | 0 | 1 | 1 | 3 | 0 |
| narratives | 10 | 10 | 10 | 0 | 0 | 0 | 0 | 10 | 10 | 0 | 0 |
| audiences | 14 | 14 | 14 | 0 | 0 | 0 | 0 | 14 | 14 | 0 | 0 |
| tones | 7 | 7 | 7 | 0 | 0 | 0 | 0 | 7 | 7 | 0 | 0 |
| socials | 10 | 10 | 10 | 0 | 0 | 0 | 0 | 10 | 10 | 0 | 0 |
| backgrounds | 6 | 6 | 6 | 0 | 0 | 0 | 0 | 6 | 6 | 0 | 0 |
| backgrounds (withAssets) | 6 | 6 | 6 | 0 | 0 | 0 | 0 | 6 | 6 | 0 | 0 |
| image-treatments | 15 | 15 | 15 | 0 | 0 | 0 | 0 | 15 | 15 | 0 | 0 |
| image-treatments (withAssets) | 15 | 15 | 15 | 0 | 0 | 0 | 0 | 15 | 15 | 0 | 0 |
| headers-footers | 10 | 10 | 10 | 0 | 0 | 0 | 0 | 10 | 10 | 0 | 0 |
| headers-footers (withAssets) | 10 | 10 | 10 | 0 | 0 | 0 | 0 | 10 | 10 | 0 | 0 |
| blocks | 32 | 21 | 21 | 0 | 8 | 11 | 3 | 24 | 24 | 8 | 0 |
| layouts | 485 | 483 | 483 | 2 | 2 | 0 | 0 | 485 | 485 | 0 | 0 |
| charts | 26 | 5 | 5 | 14 | 14 | 7 | 7 | 26 | 26 | 0 | 0 |
| **all** | 850 | 707 | 707 | 16 | 47 | 127 | 96 | 733 | 733 | 31 | 86 |

| check (all values, pass count) | old definition | new definition |
|---|---|---|
| geometry | 850 | 850 |
| text | 824 | 824 |
| fills | 850 | 850 |
| zOrder | 850 | 850 |
| slideSize | 850 | 850 |
| typefaces | 850 | 850 |
| reimport | 850 | 850 |
| fontResolution | 733 | 733 |
| theme | 850 | 850 |
| mapping | 850 | 850 |

### Selected families with only a visual-only replacement (near)

These 25 selected families render in the preview with a policy-table look-alike that is not metric-compatible (25 with the table's listed replacement, 0 with a listed alternate). Each needs a metric-compatible open replacement, or a supplied real face, to pass. "values" is the number of the 850 values that select the family.

| selected family | preview face | license class | route | values |
|---|---|---|---|---|
| Segoe UI | Red Hat Display | proprietary-standard | replacement | 7 |
| Segoe UI Semibold | Red Hat Display | proprietary-standard | replacement | 7 |
| Grandview | Barlow | proprietary-standard | replacement | 5 |
| Arial Black | Montserrat | proprietary-standard | replacement | 3 |
| Grandview Display | Barlow | proprietary-standard | replacement | 3 |
| Impact | Anton | proprietary-standard | replacement | 2 |
| Seaford | Source Sans 3 | proprietary-standard | replacement | 2 |
| Seaford Display | Source Sans 3 | proprietary-standard | replacement | 2 |
| Tenorite | Figtree | proprietary-standard | replacement | 2 |
| Tenorite Display | Figtree | proprietary-standard | replacement | 2 |
| Bookman Old Style | Libre Caslon Text | proprietary-standard | replacement | 1 |
| Century Schoolbook | Gelasio | proprietary-standard | replacement | 1 |
| Consolas | Cousine | proprietary-standard | replacement | 1 |
| Constantia | PT Serif | proprietary-standard | replacement | 1 |
| Garamond | EB Garamond | proprietary-standard | replacement | 1 |
| Lucida Sans | Work Sans | proprietary-standard | replacement | 1 |
| Rockwell | Bitter | proprietary-standard | replacement | 1 |
| Segoe UI Light | Red Hat Display | proprietary-standard | replacement | 1 |
| Segoe UI Semilight | Red Hat Display | proprietary-standard | replacement | 1 |
| Skeena | Open Sans | proprietary-standard | replacement | 1 |
| Skeena Display | Open Sans | proprietary-standard | replacement | 1 |
| Source Sans Pro | Source Sans 3 | open | replacement | 1 |
| Tahoma | Red Hat Text | proprietary-standard | replacement | 1 |
| Trebuchet MS | Figtree | proprietary-standard | replacement | 1 |
| Verdana | Montserrat | proprietary-standard | replacement | 1 |

### Selected families that pass

| selected family | preview face | license class | route | values |
|---|---|---|---|---|
| Roboto Mono | Roboto Mono | open | real | 848 |
| Aptos | Intos | proprietary-standard | replacement | 704 |
| Aptos Display | Intos Display | proprietary-standard | replacement | 704 |
| Open Sans | Open Sans | open | real | 7 |
| Georgia | Gelasio | proprietary-standard | replacement | 6 |
| Montserrat | Montserrat | open | real | 5 |
| Arial | Arimo | proprietary-standard | replacement | 3 |
| Poppins | Poppins | open | real | 3 |
| Roboto | Roboto | open | real | 3 |
| Bebas Neue | Bebas Neue | open | real | 1 |
| Calibri | Carlito | proprietary-standard | replacement | 1 |
| Courier New | Cousine | proprietary-standard | replacement | 1 |
| Lora | Lora | open | real | 1 |
| Merriweather Sans | Merriweather Sans | open | real | 1 |
| Noto Sans | Noto Sans | open | real | 1 |
| PT Serif | PT Serif | open | real | 1 |
| Times New Roman | Tinos | proprietary-standard | replacement | 1 |

### fontResolution failures (new definition)

62 selected families fail. Family-value failures by reason kind (a value with several failing families counts once per family):

| reason kind | family-value failures |
|---|---|
| preview has no face for | 63 |
| preview has no face for open family | 25 |

| failing family | license class | policy route | values | reason |
|---|---|---|---|---|
| Arabic Typesetting | proprietary-standard | not loaded in preview | 4 | preview has no face for Arabic Typesetting; policy route Noto Naskh Arabic is not loaded; bundled in the scripts pack, not loaded in this preview |
| Mangal | proprietary-standard | not loaded in preview | 4 | preview has no face for Mangal; policy route Noto Sans Devanagari is not loaded; bundled in the scripts pack, not loaded in this preview |
| Sylfaen | proprietary-standard | not loaded in preview | 3 | preview has no face for Sylfaen; policy route Noto Sans \| Noto Sans Georgian \| Noto Sans Armenian is not loaded; bundled in the scripts pack, not loaded in this preview |
| Angsana New | proprietary-standard | not loaded in preview | 2 | preview has no face for Angsana New; policy route Noto Sans Thai is not loaded; bundled in the scripts pack, not loaded in this preview |
| DaunPenh | proprietary-standard | not loaded in preview | 2 | preview has no face for DaunPenh; policy route Noto Sans Khmer is not loaded; bundled in the scripts pack, not loaded in this preview |
| David | proprietary-standard | not loaded in preview | 2 | preview has no face for David; policy route Noto Serif Hebrew \| Noto Sans Hebrew is not loaded; bundled in the scripts pack, not loaded in this preview |
| Gautami | proprietary-standard | not loaded in preview | 2 | preview has no face for Gautami; policy route Noto Sans Telugu is not loaded; bundled in the scripts pack, not loaded in this preview |
| Kalinga | proprietary-standard | not loaded in preview | 2 | preview has no face for Kalinga; policy route Noto Sans Oriya is not loaded; bundled in the scripts pack, not loaded in this preview |
| Kartika | proprietary-standard | not loaded in preview | 2 | preview has no face for Kartika; policy route Noto Sans Malayalam is not loaded; bundled in the scripts pack, not loaded in this preview |
| Latha | proprietary-standard | not loaded in preview | 2 | preview has no face for Latha; policy route Noto Sans Tamil is not loaded; bundled in the scripts pack, not loaded in this preview |
| Malgun Gothic | proprietary-standard | not loaded in preview | 2 | preview has no face for Malgun Gothic; policy route Noto Sans KR is not loaded; bundled in the scripts pack, not loaded in this preview |
| Meiryo | proprietary-standard | not loaded in preview | 2 | preview has no face for Meiryo; policy route Noto Sans JP is not loaded; bundled in the scripts pack, not loaded in this preview |
| Microsoft JhengHei | proprietary-standard | not loaded in preview | 2 | preview has no face for Microsoft JhengHei; policy route Noto Sans TC is not loaded; bundled in the scripts pack, not loaded in this preview |
| Microsoft YaHei | proprietary-standard | not loaded in preview | 2 | preview has no face for Microsoft YaHei; policy route Noto Sans SC is not loaded; bundled in the scripts pack, not loaded in this preview |
| Noto Naskh Arabic | open | not loaded in preview | 2 | preview has no face for open family Noto Naskh Arabic; bundled in the scripts pack, not loaded in this preview |
| Nyala | proprietary-standard | not loaded in preview | 2 | preview has no face for Nyala; policy route Noto Sans Ethiopic is not loaded; bundled in the scripts pack, not loaded in this preview |
| Raavi | proprietary-standard | not loaded in preview | 2 | preview has no face for Raavi; policy route Noto Sans Gurmukhi is not loaded; bundled in the scripts pack, not loaded in this preview |
| Shonar Bangla | proprietary-standard | not loaded in preview | 2 | preview has no face for Shonar Bangla; policy route Noto Sans Bengali is not loaded; bundled in the scripts pack, not loaded in this preview |
| Shruti | proprietary-standard | not loaded in preview | 2 | preview has no face for Shruti; policy route Noto Sans Gujarati is not loaded; bundled in the scripts pack, not loaded in this preview |
| Tunga | proprietary-standard | not loaded in preview | 2 | preview has no face for Tunga; policy route Noto Sans Kannada is not loaded; bundled in the scripts pack, not loaded in this preview |
| Vrinda | proprietary-standard | not loaded in preview | 2 | preview has no face for Vrinda; policy route Noto Sans Bengali is not loaded; bundled in the scripts pack, not loaded in this preview |
| Aparajita | proprietary-standard | not loaded in preview | 1 | preview has no face for Aparajita; policy route Noto Sans Devanagari is not loaded; bundled in the scripts pack, not loaded in this preview |
| Batang | proprietary-standard | not loaded in preview | 1 | preview has no face for Batang; policy route Noto Sans KR is not loaded; bundled in the scripts pack, not loaded in this preview |
| BatangChe | proprietary-standard | not loaded in preview | 1 | preview has no face for BatangChe; policy route Noto Sans KR is not loaded; bundled in the scripts pack, not loaded in this preview |
| DilleniaUPC | proprietary-standard | not loaded in preview | 1 | preview has no face for DilleniaUPC; policy route Noto Sans Thai is not loaded; bundled in the scripts pack, not loaded in this preview |

… and 37 more failing families (one value each unless listed above); the full per-family verdicts are in the results file under results[].fontResolution.

## Top mismatch reasons per dimension

- **color-schemes** (14): none
- **font-schemes** (89): fontResolution | preview has no face for open family Noto Naskh Arabic; bundled in the scripts pack, not loaded in this preview (2); fontResolution | preview has no face for Microsoft YaHei; policy route Noto Sans SC is not loaded; bundled in the scripts pack, not loaded in this preview (1); fontResolution | preview has no face for SimSun; policy route Noto Sans SC is not loaded; bundled in the scripts pack, not loaded in this preview (1); fontResolution | preview has no face for FangSong; policy route Noto Sans SC is not loaded; bundled in the scripts pack, not loaded in this preview (1); fontResolution | preview has no face for Yu Gothic; policy route Noto Sans JP is not loaded; bundled in the scripts pack, not loaded in this preview (1)
- **font-schemes-legacy** (4): fontResolution | preview has no face for open family Playfair Display (1)
- **languages** (93): fontResolution | preview has no face for Arabic Typesetting; policy route Noto Naskh Arabic is not loaded; bundled in the scripts pack, not loaded in this preview (3); fontResolution | preview has no face for Mangal; policy route Noto Sans Devanagari is not loaded; bundled in the scripts pack, not loaded in this preview (3); fontResolution | preview has no face for Sylfaen; policy route Noto Sans | Noto Sans Georgian | Noto Sans Armenian is not loaded; bundled in the scripts pack, not loaded in this preview (2); fontResolution | preview has no face for Nyala; policy route Noto Sans Ethiopic is not loaded; bundled in the scripts pack, not loaded in this preview (1); fontResolution | preview has no face for Shonar Bangla; policy route Noto Sans Bengali is not loaded; bundled in the scripts pack, not loaded in this preview (1)
- **themes** (4): none
- **narratives** (10): none
- **audiences** (14): none
- **tones** (7): none
- **socials** (10): none
- **backgrounds** (6): none
- **backgrounds (withAssets)** (6): none
- **image-treatments** (15): none
- **image-treatments (withAssets)** (15): none
- **headers-footers** (10): none
- **headers-footers (withAssets)** (10): none
- **blocks** (32): text | text color 000000 vs 2874A6 (1); text | text color 000000 vs F77F00 (1); text | text color 000000 vs A41410 (1)
- **layouts** (485): none
- **charts** (26): text | chart preview text not in native chart cache (7)

## 20 most common mismatch patterns

| # | pattern (check \| reason) | severity | values | occurrences | example ids | sample |
|---|---|---|---|---|---|---|
| 1 | text \| chart preview text not in native chart cache | fail | 7 | 7 | charts/treemap [slides.0.chart]<br>charts/histogram [slides.0.chart]<br>charts/pareto [slides.0.chart] | Q1 2024  Q2 2024  Q3 2024  Q4 2024  Q1 2025  Q2 2025 |
| 2 | fontResolution \| preview has no face for Mangal; policy route Noto Sans Devanagari is not loaded; bundled in the scripts pack, not loaded in this preview | fail | 4 | 4 | font-schemes/mangal [Mangal]<br>languages/hindi [Mangal]<br>languages/marathi [Mangal] |  |
| 3 | fontResolution \| preview has no face for Arabic Typesetting; policy route Noto Naskh Arabic is not loaded; bundled in the scripts pack, not loaded in this preview | fail | 4 | 4 | font-schemes/arabic-typesetting [Arabic Typesetting]<br>languages/arabic [Arabic Typesetting]<br>languages/persian [Arabic Typesetting] |  |
| 4 | fontResolution \| preview has no face for Sylfaen; policy route Noto Sans \| Noto Sans Georgian \| Noto Sans Armenian is not loaded; bundled in the scripts pack, not loaded in this preview | fail | 3 | 3 | font-schemes/sylfaen [Sylfaen]<br>languages/armenian [Sylfaen]<br>languages/georgian [Sylfaen] |  |
| 5 | fontResolution \| preview has no face for Microsoft YaHei; policy route Noto Sans SC is not loaded; bundled in the scripts pack, not loaded in this preview | fail | 2 | 2 | font-schemes/microsoft-yahei [Microsoft YaHei]<br>languages/chinese-simplified [Microsoft YaHei] |  |
| 6 | fontResolution \| preview has no face for Malgun Gothic; policy route Noto Sans KR is not loaded; bundled in the scripts pack, not loaded in this preview | fail | 2 | 2 | font-schemes/malgun-gothic [Malgun Gothic]<br>languages/korean [Malgun Gothic] |  |
| 7 | fontResolution \| preview has no face for Latha; policy route Noto Sans Tamil is not loaded; bundled in the scripts pack, not loaded in this preview | fail | 2 | 2 | font-schemes/latha [Latha]<br>languages/tamil [Latha] |  |
| 8 | fontResolution \| preview has no face for David; policy route Noto Serif Hebrew \| Noto Sans Hebrew is not loaded; bundled in the scripts pack, not loaded in this preview | fail | 2 | 2 | font-schemes/david [David]<br>languages/hebrew [David] |  |
| 9 | fontResolution \| preview has no face for Vrinda; policy route Noto Sans Bengali is not loaded; bundled in the scripts pack, not loaded in this preview | fail | 2 | 2 | font-schemes/vrinda [Vrinda]<br>languages/chittagonian [Vrinda] |  |
| 10 | fontResolution \| preview has no face for Shruti; policy route Noto Sans Gujarati is not loaded; bundled in the scripts pack, not loaded in this preview | fail | 2 | 2 | font-schemes/shruti [Shruti]<br>languages/gujarati [Shruti] |  |
| 11 | fontResolution \| preview has no face for Tunga; policy route Noto Sans Kannada is not loaded; bundled in the scripts pack, not loaded in this preview | fail | 2 | 2 | font-schemes/tunga [Tunga]<br>languages/kannada [Tunga] |  |
| 12 | fontResolution \| preview has no face for Kartika; policy route Noto Sans Malayalam is not loaded; bundled in the scripts pack, not loaded in this preview | fail | 2 | 2 | font-schemes/kartika [Kartika]<br>languages/malayalam [Kartika] |  |
| 13 | fontResolution \| preview has no face for Kalinga; policy route Noto Sans Oriya is not loaded; bundled in the scripts pack, not loaded in this preview | fail | 2 | 2 | font-schemes/kalinga [Kalinga]<br>languages/odia [Kalinga] |  |
| 14 | fontResolution \| preview has no face for Raavi; policy route Noto Sans Gurmukhi is not loaded; bundled in the scripts pack, not loaded in this preview | fail | 2 | 2 | font-schemes/raavi [Raavi]<br>languages/punjabi-gurmukhi [Raavi] |  |
| 15 | fontResolution \| preview has no face for Gautami; policy route Noto Sans Telugu is not loaded; bundled in the scripts pack, not loaded in this preview | fail | 2 | 2 | font-schemes/gautami [Gautami]<br>languages/telugu [Gautami] |  |
| 16 | fontResolution \| preview has no face for Microsoft JhengHei; policy route Noto Sans TC is not loaded; bundled in the scripts pack, not loaded in this preview | fail | 2 | 2 | font-schemes/microsoft-jhenghei [Microsoft JhengHei]<br>languages/chinese-traditional [Microsoft JhengHei] |  |
| 17 | fontResolution \| preview has no face for Meiryo; policy route Noto Sans JP is not loaded; bundled in the scripts pack, not loaded in this preview | fail | 2 | 2 | font-schemes/meiryo [Meiryo]<br>languages/japanese [Meiryo] |  |
| 18 | fontResolution \| preview has no face for Angsana New; policy route Noto Sans Thai is not loaded; bundled in the scripts pack, not loaded in this preview | fail | 2 | 2 | font-schemes/angsana-new [Angsana New]<br>languages/thai [Angsana New] |  |
| 19 | fontResolution \| preview has no face for Shonar Bangla; policy route Noto Sans Bengali is not loaded; bundled in the scripts pack, not loaded in this preview | fail | 2 | 2 | font-schemes/shonar-bangla [Shonar Bangla]<br>languages/bengali [Shonar Bangla] |  |
| 20 | fontResolution \| preview has no face for open family Noto Naskh Arabic; bundled in the scripts pack, not loaded in this preview | fail | 2 | 2 | font-schemes/noto-sans-arabic [Noto Naskh Arabic]<br>font-schemes/noto-naksh-arabic [Noto Naskh Arabic] |  |

## Near-only patterns (tolerable deltas)

| pattern | values | example |
|---|---|---|
| text \| chart label wrapped/split in preview (native chart lays out its own labels) | 14 | charts/column [slides.0.chart] |
| fontResolution \| visual-only replacement (no metric-compatible open font for Segoe UI Semibold): Segoe UI Semibold -> Red Hat Display | 7 | font-schemes/segoe-ui [Segoe UI Semibold] |
| fontResolution \| visual-only replacement (no metric-compatible open font for Segoe UI): Segoe UI -> Red Hat Display | 7 | font-schemes/segoe-ui [Segoe UI] |
| fontResolution \| visual-only replacement (no metric-compatible open font for Grandview): Grandview -> Barlow | 5 | font-schemes/impact [Grandview] |
| fontResolution \| visual-only replacement (no metric-compatible open font for Arial Black): Arial Black -> Montserrat | 3 | font-schemes/arial [Arial Black] |
| fontResolution \| visual-only replacement (no metric-compatible open font for Grandview Display): Grandview Display -> Barlow | 3 | font-schemes/grandview [Grandview Display] |
| fontResolution \| visual-only replacement (no metric-compatible open font for Impact): Impact -> Anton | 2 | font-schemes/impact [Impact] |
| fontResolution \| visual-only replacement (no metric-compatible open font for Seaford Display): Seaford Display -> Source Sans 3 | 2 | font-schemes/seaford [Seaford Display] |
| fontResolution \| visual-only replacement (no metric-compatible open font for Seaford): Seaford -> Source Sans 3 | 2 | font-schemes/seaford [Seaford] |
| fontResolution \| visual-only replacement (no metric-compatible open font for Tenorite Display): Tenorite Display -> Figtree | 2 | font-schemes/tenorite [Tenorite Display] |

## Preview font resolution (registry status, the old-definition view)

Families the traced preview uses plus the resolved design heading/body/code fonts, resolved against the office pack (plus base) with `substitutionPolicy:"visual"`. "Metric" follows the `FONT_COMPATIBILITY` policy in opf-render. This is the registry status the old definition gated on; the verdict under the new definition is in the section above.

| status | families | values affected | families (values) |
|---|---|---|---|
| real | 10 | 848 | Roboto Mono (848), Open Sans (7), Montserrat (5), Poppins (3), Roboto (3), PT Serif (1), Noto Sans (1), Bebas Neue (1), Lora (1), Merriweather Sans (1) |
| metric-substitute | 7 | 716 | Aptos Display→Intos Display (704), Aptos→Intos (704), Georgia→Gelasio (6), Arial→Arimo (3), Courier New→Cousine (1), Calibri→Carlito (1), Times New Roman→Tinos (1) |
| visual-substitute | 25 | 32 | Segoe UI Semibold→Red Hat Display (7), Segoe UI→Red Hat Display (7), Grandview→Barlow (5), Arial Black→Montserrat (3), Grandview Display→Barlow (3), Impact→Anton (2), Seaford Display→Source Sans 3 (2), Seaford→Source Sans 3 (2), Tenorite Display→Figtree (2), Tenorite→Figtree (2), Consolas→Cousine (1), Lucida Sans→Work Sans (1), Segoe UI Semilight→Red Hat Display (1), Segoe UI Light→Red Hat Display (1), Tahoma→Red Hat Text (1), Trebuchet MS→Figtree (1), Verdana→Montserrat (1), Bookman Old Style→Libre Caslon Text (1), Century Schoolbook→Gelasio (1), Constantia→PT Serif (1), Garamond→EB Garamond (1), Rockwell→Bitter (1), Skeena Display→Open Sans (1), Skeena→Open Sans (1), Source Sans Pro→Source Sans 3 (1) |
| missing | 62 | 86 | Mangal (4), Arabic Typesetting (4), Sylfaen (3), Microsoft YaHei (2), Malgun Gothic (2), Latha (2), David (2), Vrinda (2), Shruti (2), Tunga (2), Kartika (2), Kalinga (2), Raavi (2), Gautami (2), Microsoft JhengHei (2), Meiryo (2), Angsana New (2), Shonar Bangla (2), Noto Naskh Arabic (2), Nyala (2), DaunPenh (2), SimSun (1), FangSong (1), Yu Gothic (1), PMingLiU (1), MingLiU (1), MS Mincho (1), BatangChe (1), Batang (1), GungsuhChe (1), Gungsuh (1), Nirmala UI (1), Miriam (1), Gisha (1), Aparajita (1), DilleniaUPC (1), Sakkal Majalla (1), Traditional Arabic (1), Raleway (1), Noto Sans Armenian (1), … |

733/850 values render only with the chosen font or a metric-compatible substitute (the old fontResolution pass).

## Package typeface inventory

Foreign `typeface=` values are those not used by the preview; they are listed by part, with the number of values affected:


Theme per-script supplements (`<a:font script=…>`) are listed separately and not gated: 50 distinct faces (游ゴシック Light, 맑은 고딕, 等线 Light, 新細明體, Times New Roman, Angsana New, Nyala, Vrinda, Shruti, MoolBoran, Tunga, Raavi, …).

## Re-running

```powershell
dimension-audit\parity\run.ps1                          # current worktrees -> parity-results.json + PARITY.md
dimension-audit\parity\run.ps1 -Update                  # move sources\parity-* to origin/main, rebuild, rerun
dimension-audit\parity\build.ps1 -Prefix pr123; dimension-audit\parity\run.ps1 -Prefix pr123 -Baseline dimension-audit\parity\parity-results.json -Out dimension-audit\parity\out\pr123.json
```

For a fix PR, create `sources\<prefix>-{opf,opf-render,opf-pptx,pptx-gallery}` worktrees with the PR branch in the repo you changed and origin/main elsewhere. The report then adds a before/after table.
