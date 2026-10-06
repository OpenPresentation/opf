# RR-54 re-check: format re-spelling on save (opf-pptx#171) and zero values in the chart workbook (opf-pptx#173)

The RR-54 native check ([opf#385](https://github.com/OpenPresentation/opf/pull/385)) failed in two places. This set re-checks both fixes, the ones only PowerPoint can confirm.

- **C4, save a copy.** A plain PowerPoint save re-spells number format codes: `$#,##0.0` becomes `\$#,##0.0`, and `#,##0 "units"` becomes `#,##0\ "units"`. The old evidence hash then failed: re-import lost the dataset refs, `fields` and `mapping` (the doughnut included), and the scatter point names came back as 1, 2, 3. opf-pptx#171 `b076bb6` hashes each code in core's canonical form. After a SaveCopyAs, the re-import must restore every record.
- **C2, Edit Data.** The embedded workbook dropped zero values, so Edit Data showed a blank where the chart showed 0. opf-pptx#173 (on #165, pptxgenjs-plus 4.3.4) keeps 0 and -0 (written as 0), and blanks a scatter X gap. Before the fix, an X gap was the numeric cell `<v>null</v>`.
- **C3, read-only open.** No repair prompt on any deck.

## Contents

`decks/` holds each `.pptx` and the OPF document it was exported from (`.opf.json`). `manifest.json` has the builds, each file's sha256 and the expectations.

| File | Build | Check |
| --- | --- | --- |
| `c4-formats-after.pptx` | opf-pptx#171 `b076bb6`, core opf#376 `11317237` | C3, C4 |
| `c4-formats-before.pptx` | opf-pptx `f0ea480` (#171 before the fix), core opf#376 `11317237` | C3, C4 baseline |
| `c4-datasets-after.pptx` / `-before.pptx` | as above | C3, C4 / baseline |
| `c2-zeros-after.pptx` | opf-pptx#173 `4baa171` (pptxgenjs-plus), core 0.12.0 (npm) | C3, C2 |
| `c2-zeros-before.pptx` | opf-pptx main `7c93a1b` (PptxGenJS 4.0.1), core 0.12.0 (npm) | C3, C2 baseline |

### `c4-formats`

1. Column with `$#,##0.0`, `0%` and `#,##0 units`, plus a gap.
2. Line with `0.00%`.
3. Scatter with the points a, b and c, X `0.0 kg`, Y `$#,##0`.
4. Pie with `$#,##0`.
5. Treemap (chartex) with `#,##0.0`.
6. Bar with exploratory spellings: `€#,##0.00`, `0.0 m/s` and `+0.0 pts`. opf#385 did not cover these. If PowerPoint re-spells one of them in a way core cannot map back (for example `€` into a `[$€-…]` block that core reads differently), C4 fails for slide 6 only. That is a new finding to record, not a regression.

### `c4-datasets`

`datasets.sales` has `$#,##0`, `#,##0 units` and `0.0%`; `datasets.spare` is unused. The slides:
1. A dataset column chart with `fields`.
2. A line with `mapping`.
3. A dataset table.
4. A doughnut with `{dataset, fields}`.
5. A radar chart.
6. A box and whisker (chartex) with `0.0 pts`.

### `c2-zeros`

- Slides 1–5 are column, bar, line, area and radar charts. Each has the rows 5, 0, -0, gap (null), empty (''), and 3, plus a second series.
- Slides 6–7 are a pie and a doughnut with a zero slice.
- Slide 8 is a scatter chart with an X of 0, an X gap, and Y values of 0 and -0.
- For each chart, `manifest.json` lists the expected value of every workbook value cell, taken from the chart's own cache: a number, or `null` for a blank cell.

### Scripts

- `read-deck.ps1` (C3) opens one deck read-only with no window and reads each chart's type, series names and data-label number format. It exports 1280 x 720 PNGs and closes the deck.
- `editdata-chart.ps1` (C2) opens one deck read-only with a window, activates the embedded workbook of the chart on one slide, and reads `Value2`, `Text` and `NumberFormat` of the listed cells. It closes the workbook and then the deck. It runs one chart per process: in opf#385 a second `ChartData.Activate` in the same child hung behind an Excel dialog.
- `save-copy.ps1` (C4) is the only writing step. It copies the deck to `out\work\`, opens that copy read-only, calls `SaveCopyAs` to `out\saved\` and closes it. The file in `decks\` is never opened. Its sha256 is recorded before and after.
- `run-set.ps1` runs the steps, one hidden child `powershell.exe` per deck (per chart for Edit Data), each with a 90 s deadline and no retries. Every run is recorded in `out\run.json`.
- `reimport.mjs` (C4, offline, Node) re-imports `out\saved\*.pptx` with the build that exported each deck. The result must equal the re-import of the unsaved deck, and must report no `*-provenance-changed` or `*-dataset-unavailable` diagnostic. With `--simulate`, it applies the opf#385 re-spellings to the source decks instead. That is an offline self-test, not evidence: it passes both after decks and gives BASELINE for both before decks.
- `compare.mjs` checks `out\` against `manifest.json` and writes `out\compare.md` and `out\compare.json`. It needs no npm install.
- `build.mjs` rebuilds the decks. You do not need to run it; the shipped decks match `manifest.json`.

No script reads `Series.Formula`. It crashes PowerPoint 16.0.20430 (chart.dll 0xc0000005, opf#385). No script saves a deck, quits or kills PowerPoint or Excel, or retries a failed step.

## Run (supervisor, Windows, desktop PowerPoint 365)

```powershell
# 0. Check the decks: Get-FileHash decks\*.pptx must match manifest.json (files.*.sha256).
# 1. Start PowerPoint by hand, with no deck open. 2. In this folder:
powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File run-set.ps1 -Step read
powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File run-set.ps1 -Step editdata
powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File run-set.ps1 -Step save
# 3. Offline re-import of the saved copies. It needs the two opf-pptx#171 builds with core opf#376 linked, as in opf#385:
#    one checkout at b076bb6 (codex/rr-54-chart-table-data) and one at f0ea480, each with npm ci, the core link and npm run build.
node reimport.mjs <opf-pptx at b076bb6> <opf-pptx at f0ea480>
node compare.mjs
```

- `-Only c2-zeros` (or another deck id) limits a step to one deck. `save` refuses to overwrite `out\work\` or `out\saved\`; use a fresh `out` folder (rename the old one) for a second attempt, and keep every attempt.
- Watch for a repair or protected-view dialog while the decks open, and during Edit Data. Note the deck, the step and the dialog text, dismiss it, and let the run continue. A repair prompt on an `after` deck is a FAIL. On `c2-zeros-before`, a repair prompt in Edit Data on slide 8 (the old `<v>null</v>` X cell) is a baseline finding.
- If Excel shows "To insert a chart, you must first close any open dialog boxes…", the child times out after 90 s and is not retried. Close the dialog and record it.

## Expected result

- **C3:** every file reaches `stage: done`, with no repair prompt and an unchanged sha256.
- **C4:**
  - The `after` files PASS: the saved copies re-import with the same chart and table payloads and the same `datasets`, and with no data diagnostic. The scatter keeps a, b and c, and the doughnut keeps `{dataset: 'sales', fields: ['Region', 'Units']}`.
  - The `before` files are `BASELINE (expected fail)`, as in opf#385: `chart-data-provenance-changed` on the charts with re-spelled codes, and scatter names 1, 2 and 3.
  - The "re-spelled codes" column records exactly what PowerPoint wrote, which matters most for slide 6 of `c4-formats`.
- **C2:**
  - In the `after` file, every listed cell of slides 1–8 reads the cached value. That means 0 for every 0 and -0, and a blank (`Value2` null) for every gap, including the scatter X gap at A4.
  - The `before` file is `BASELINE (expected fail)` on slides 1–7: the zeros read blank. Its scatter (slide 8) keeps its zeros, as in opf#385. Its X gap is the `<v>null</v>` cell, so record what Excel shows there.
- **Evidence:** copy `out\compare.md`, `out\compare.json`, `out\run.json`, `out\reimport.json` and the per-step JSON. Do not copy decks, saved copies, PNGs or absolute paths. Put them in `docs/evidence/rr-54-recheck-native-<yyyymmdd>/` in core with a README, and link that from opf-pptx#171 and #173.
