# RR-36: preview vs PowerPoint parity, two findings from the RR-33/35 native run

Date: 2026-10-01. Inputs: this folder (`report.md`, `compare/`, `rr35-*.json`) and the decks and previews one level up, built by `../build-rr35-decks.mjs.txt` from opf-pptx `codex/rr-35-chart-options` (`019c845`). Office was not opened.

## Summary

| # | Finding | Root cause | Side at fault | Pre-existing on main | Fix |
| --- | --- | --- | --- | --- | --- |
| 1 | Headings wrap to two lines in PowerPoint, one in the preview (F3) | The RR-35 deck build script called `toPptx` **without** `textMeasurement`, so the export used core's character-class estimate and the preview used Fontkit metrics | Harness (scratch build script), not product code | n/a (the product is correct when called as documented) | Pass `...fontOptions` to `toPptx`. Rebuilt decks are in `rr36-rebuilt/` and match the preview on 66 of 66 slides |
| 2 | Single-series bar/column: one colour per point in PowerPoint, one colour per series in the preview (F4) | opf-pptx passes a custom 10-colour `chartColors`, and vendored PptxGenJS then writes a `c:dPt` per point for a one-series bar chart | Exporter (opf-pptx) | Yes, main `1ab1630` | opf-pptx#149 (draft): one-colour palette for single-series bar charts. A byte fixture needs an owner decision |

## Finding 1: heading line breaks

### Not PowerPoint wrapping

The export decides the line breaks itself. `ppt/slides/slide1.xml` of `rr35-08-dark-theme-4x3.pptx` has **two** heading shapes, each with `wrap="none"` and zero insets:

```xml
<p:cNvPr id="2" name="OPF heading slides.0.title line 0"/> ... <a:off x="548640" y="548640"/><a:ext cx="8046720" cy="627507"/>
<a:bodyPr wrap="none" lIns="0" tIns="0" rIns="0" bIns="0" rtlCol="0" anchor="t"/>
<a:rPr lang="en-US" sz="4050" b="1"> ... <a:latin typeface="Roboto"/> ... <a:t>dark: legend right, titles, </a:t>
<p:cNvPr id="3" name="OPF heading slides.0.title line 1"/> ... <a:off x="548640" y="1176147"/> ... <a:t>labels</a:t>
```

PowerPoint's boxes (`rr35-08-dark-theme-4x3.json`) agree with the file:

- line 0 at l 43.2, t 43.2, w 633.6 x h 49.4 pt;
- line 1 at t 92.6 pt;
- the chart at t 160 pt (213.3 px at 960 px wide). The preview chart is at 148 px.

PowerPoint drew exactly what the exporter composed. Autofit, insets, letter spacing and wrapping are not involved: `wrap="none"`, `lIns`/`rIns` = 0, no `spc`, and the box inner width = box width = 8046720 EMU = 844.8 px.

### Not a font problem

- Roboto is not in `C:\Windows\Fonts` or the user font folder, and is not in the registry font lists.
- PowerPoint uses the Office **cloud font** copy instead: `%LOCALAPPDATA%\Microsoft\FontCache\4\CloudFonts\Roboto\31996480045.ttf` is "Roboto Bold", Version 3.004. The same folder has Regular, Medium and Italic.
- Its advance widths equal the bundled `@expo-google-fonts/roboto` 700Bold (Version 3.015) to the hundredth of a pixel for every affected title. For example, "dark: legend right, titles, labels" at 54 px is 747.75 px in both.
- The heading size is the same on both sides: `sz="4050"` = 40.5 pt = 54 px.

### Cause: the export was composed with estimated metrics

`../build-rr35-decks.mjs.txt`, line 174 (export) against line 177 (preview):

```js
const bytes = await toPptx(deck.source, {onDiagnostic: ...});          // no textMeasurement
const svgs = renderSvgDeck(deck.source, fontOptions);                   // Fontkit measurement
```

The RR-33 and RR-34 build scripts pass it to both calls, which is why their heading parity is near perfect:

- `build-rr33-decks.mjs.txt:143`: `toPptx(deck.source, {seed: 1, date: DATE, ...fontOptions, ...})`
- `build-rr34-decks.mjs.txt:98`: the same.

Without `textMeasurement`, core falls back to `measureText`, a deterministic estimate (`packages/javascript/src/composition.ts:734` on core main). It counts 0.62 em per capital or digit, 0.54 em per other character and 0.32 em per space. opf-pptx `toPptx` forwards `options.textMeasurement` to `composeSlide` (`src/index.js:1629`), and its README (line 272) says: "Pass the same `textMeasurement` provider used by preview and pagination to `toPptx`."

For Roboto Bold, the estimate is 14% to 26% too wide. Line widths at 54 px against the inner width:

| Slide | Heading | Inner width px | Fontkit width (fill) | Estimated width (fill) | Estimate / Fontkit |
| --- | --- | --- | --- | --- | --- |
| 01 s9 | control: no options (default legend at the right) | 1164.8 | 1133.6 (97.3%) | 1345.7 (115.5%) | 1.187 |
| 02 s6 | stacked column with legend left and both titles | 1164.8 | 1133.7 (97.3%) | 1287.4 (110.5%) | 1.136 |
| 03 s1 | column: dataLabels true (value, outside end) | 1164.8 | 1077.2 (92.5%) | 1228.0 (105.4%) | 1.140 |
| 05 s7 | doughnut: percent (ring, no position choice) | 1164.8 | 1061.7 (91.1%) | 1223.6 (105.1%) | 1.153 |
| 06 s2 | waterfall: labels outside end (default position) | 1164.8 | 1115.2 (95.7%) | 1340.3 (115.1%) | 1.202 |
| 06 s10 | box and whisker: legend bottom, value title | 1164.8 | 1037.5 (89.1%) | 1182.6 (101.5%) | 1.140 |
| 08 s1 | dark: legend right, titles, labels | 844.8 | 747.7 (88.5%) | 943.9 (111.7%) | 1.262 |
| 08 s2 | dark: pie percent labels inside end | 844.8 | 829.5 (98.2%) | 961.2 (113.8%) | 1.159 |

The difference is the measurer, not a near-tie. With real metrics, 7 of the 8 headings have at least 2.7% to spare. Only `08 s2` is tight (1.8% to spare). It is still safe in PowerPoint, because the export writes the line with `wrap="none"`, and PowerPoint's cloud Roboto Bold has the same advances.

The same cause explains the six slides where both sides wrap but at different words: 02 s7, 03 s8, 03 s11, 06 s5, 06 s7 and 07 s1.

### Verification

`rr36-rebuilt/` holds all eight RR-35 decks, rebuilt from the same branch build. The only change is `{...fontOptions, onDiagnostic}` on `toPptx`. The script is a scratch build script (not committed), and the new manifest is `rr36-rebuilt/manifest.rr-36-rebuilt.json`.

- 14 of 66 slides change their heading lines. They are exactly the 8 one-line-versus-two cases and the 6 different-word cases above. On the 8, the chart moves from y 213.4 px back to 147.6 to 148.6 px, as in the preview.
- Every exported heading line is a text line of the preview SVG on **66 of 66** slides of the rebuilt decks. The original decks fail on 14 (`probe/preview-lines.mjs`).

### Fix

- No product change. Correct the RR-35 build script (line 174) to `toPptx(deck.source, {...fontOptions, onDiagnostic: ...})`, then re-run the RR-35 native check on `rr36-rebuilt/*.pptx`.
- Correct the `report.md` F3 attribution: it says "core composition / preview parity". It is the harness.
- The F4 data-label low-contrast note is a consequence of finding 2.
- Optional hardening, owner's call: the exporter could add a diagnostic when headings or text are composed with the estimate (`textMeasurement` absent) in Node while opf-render is installed. Making it the default would change default export geometry, so it needs a separate decision.

## Finding 2: single-series bar/column colours

### Evidence

Slide 1 of `rr35-03-data-labels-bars.pptx`, `ppt/charts/chart1.xml`:

```xml
<c:barChart> ... <c:varyColors val="0"/>
<c:ser> <c:idx val="0"/> ... <c:spPr><a:solidFill><a:srgbClr val="2874A6"/></a:solidFill> ... </c:spPr>
  <c:dPt><c:idx val="0"/> ... <a:srgbClr val="2874A6"/> ... </c:dPt>
  <c:dPt><c:idx val="1"/> ... <a:srgbClr val="3F6B88"/> ... </c:dPt>
  <c:dPt><c:idx val="2"/> ... <a:srgbClr val="5499C7"/> ... </c:dPt>
  <c:dPt><c:idx val="3"/> ... <a:srgbClr val="7BDBB2"/> ... </c:dPt>
```

`c:varyColors` is 0, but explicit `c:dPt` fills override the series fill per point. That is what PowerPoint draws (`compare/11-rr35-03-data-labels-bars-s1.png`, right).

### Where the c:dPt elements come from (opf-pptx main 1ab1630)

- `src/index.js`, `addChartPayload`: `chartColors: palette` (line 2069; `palette` is the 10 `CHART_COLORS` adjusted for the panel). opf-pptx itself has no `dPt` code.
- `vendor/pptxgenjs/pptxgen.es.js:3726-3755`: for `chartType === BAR` and `data.length === 1`, it writes one `c:dPt` per value with `arrColors[index % arrColors.length]` whenever `opts.chartColors !== BARCHART_COLORS && opts.chartColors.length > 1`. Upstream PptxGenJS does this on purpose ("allow users with a single data set to pass their own array of colors"), and it always fires for us.

### Which behaviour is intended: one colour per series (the preview)

- **opf-render main** (`cf27e4e`), `src/charts.js:662`: a bar or column series j is filled with `c.colors[j % c.colors.length]`. Only pie and doughnut (line 710, "one colour per category") and treemap (line 1124) colour by category. Waterfall uses two colours for increase and decrease, and funnel uses colour 0.
- **Gallery**: `pptx-gallery/public/chart-previews/column.svg` (main `2fea835`) draws all 8 columns of the single-series `column` record in `#2874A6`.
- **Catalog**: `spec/catalogs/chart-types/column.json` is `series: 1` with `openxml.element: barChart` and grouping clustered. The catalog has no per-point colour concept. `bar` and `column` are the only single-series barChart records.
- **Exporter design**: data-label text colour is picked per series (the RR-35 inside-label contrast colour), and `c:varyColors` is written as 0. Both assume one colour per series. The per-point fills come only from the PptxGenJS heuristic.
- **Core audit** (`docs/audit.md`): "series i takes colour i, pie/doughnut/treemap/funnel slices take colours per category". It applies to the classic slice types only.

### Why the gallery corpus showed parity anyway

The parity harness (`docs/programs/font-fidelity-everywhere/gallery-support/parity/scripts/parity.mjs:181`) takes a bar series colour from the first `srgbClr` of the series `c:spPr` and does not read `c:dPt` (only for pie and doughnut). So the gallery `column` and `bar` exports show 8 colours in PowerPoint while the parity check reports `fills: pass`. That is an instrument gap. Proposed follow-up in core: for a single-series barChart, also compare every `c:dPt` fill with the preview.

### Fix: opf-pptx#149 (draft), branch `codex/rr-36-single-series-colour`

- **Change.** `src/index.js`, `addChartPayload`: `chartColors = chartData.type === 'bar' && chartData.series.length === 1 ? palette.slice(0, 1) : palette`. The series fill stays `palette[0]` and no `c:dPt` is written.
- **Not changed.** Multi-series charts, pie and doughnut (`c:dPt` per slice), and line, area, radar and scatter charts are byte-identical.
- **Tests.** `test/single-series-colour.mjs` fails on main and passes on the branch. It covers light and dark themes: column, bar, one-series stacked column, negative values and the waterfall fallback, plus multi-series and pie/doughnut controls. CHANGELOG entry under Unreleased.
- **Byte fixture, needs your decision.** `test/fixtures/chartex-fallback-main.json` ("regenerate only with an owner decision") changes, because the single-series clustered-column fallback of the chartex types loses its `c:dPt` elements. I verified it part by part: pareto and box are identical, and every other deck differs only in `ppt/charts/chartN.xml`, which is byte-identical once `c:dPt` is stripped. **Not regenerated**, so `test/chartex.mjs` fails in CI until you approve. With a fixture regenerated in `chartex: 'fallback'` mode, the rest of `test/chartex.mjs` passes (33 checks).
- **Geometry.** No composition geometry, no goldens.
- **Gallery impact.** The `column` and `bar` values, plus any layout with a single-series column or bar chart, now draw one colour in PowerPoint, as in the preview.

## Native confirmation wanted (supervisor)

1. `rr36-probe-single-series.pptx`, built with the fix branch. Previews are `rr36-probe-single-series-preview-slide-N.png`.
   - Slides 1 to 3 (single-series column, single-series bar, column with a negative value): every bar or column is filled `2874A6` (RGB 40,116,166), including the negative one, as in the preview.
   - Slide 4 (two-series control): two colours, `2874A6` and `3F6B88`.
   - Slide 5 (pie control): one colour per slice.
   - Record any repair prompt.
2. `rr36-rebuilt/rr35-*.pptx`: the RR-35 checks again.
   - Expected on 01 s9, 02 s6, 03 s1, 05 s7, 06 s2, 06 s10, 08 s1 and 08 s2: one heading line, and the chart top at about 111 pt (148 px), the same as the preview.
   - Expected on 02 s7, 03 s8, 03 s11, 06 s5, 06 s7 and 07 s1: two heading lines, broken at the same word as the preview.
   - These decks do not contain the colour fix, so the per-point colours remain until opf-pptx#149 is merged into the RR-35 branch.

## Follow-up (same day)

- **Native confirmation** (supervisor, PowerPoint 365, 2026-10-01; exports kept in the supervisor scratch folder, decks and PNGs are not committed):
  - `rr36-probe-single-series` slide 1 draws every bar in one colour (2874A6).
  - The rebuilt `rr35-08` slide 1 draws a one-line heading, with the chart back near the top.
- **opf-pptx#149** (coordinator approved the fixture, 2026-10-01; marked ready for review).
  - `origin/main` 4ed11db (RR-29 shared palette) was merged into the branch.
  - The chartex fallback fixture was regenerated on top of the RR-29 entries. I verified it part by part against main 4ed11db with the CI-pinned core 395e4c1, which reproduces main's entries exactly. The result is the same as before: pareto and box are byte-identical, and every other deck differs only in `c:dPt` removals in `chartN.xml`.
  - The generator now passes `chartex: 'fallback'`.
  - Local `npm test` and `typecheck` pass. Later merges of main (RR-33, RR-10) leave the fixture valid with the CI core `c6a7b38`. Head `8e7b00e`, CI green, mergeable.
- **opf#272** fixes the parity harness. `chartSeriesColors` moves to `parity/scripts/chart-colors.mjs` and reads `c:dPt` fills for fill-kind series, so a per-point override fails `fills`.
  - Tests are in `chart-colors.test.mjs`, run by `pnpm check:audit-chartex`.
  - On the 214 classic chart parts of this run, 152 give the same result as before. The other 62 are exactly the single-series bar charts that carry `c:dPt`.
- opf#272 head `955ef20`, CI green, mergeable.
