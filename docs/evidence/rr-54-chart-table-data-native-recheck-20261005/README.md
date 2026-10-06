# RR-54: native re-check of the chart data fixes (2026-10-05)

Item: RR-54 (chart and table data). This re-checks the two failures of the first native check (opf#385) against their fixes:

- **C4.** PowerPoint re-spells format codes on save, so provenance was rejected. Fix: [opf-pptx#171](https://github.com/OpenPresentation/opf-pptx/pull/171) at `b076bb6`, which hashes each format code in core's canonical form.
- **C2.** Zero values were missing from the chart workbook ([opf-pptx#172](https://github.com/OpenPresentation/opf-pptx/issues/172)). Fix: [opf-pptx#173](https://github.com/OpenPresentation/opf-pptx/pull/173) at `4baa171`.

Each fix is paired with its "before" build as a baseline.

- **Host:** Windows 11, PowerPoint 365 (16.0 build 20430), en-US number settings, run on 2026-10-05. The UTC stamps are 2026-10-06.
- **Set:** `probes/sets/rr54-recheck` at `codex/probe-sets-20261005` `184045f5`. All 6 decks were rebuilt byte-identical to its manifest. [decks.json](decks.json) lists each deck's build, sha256 and saved-copy sha256.

  | Deck | After build | Before build |
  | --- | --- | --- |
  | c4-formats, c4-datasets | opf-pptx#171 `b076bb6` on core opf#376 `11317237` | `f0ea480` on `11317237` |
  | c2-zeros | opf-pptx#173 `4baa171`, core 0.12.0 (npm) | opf-pptx main `7c93a1b`, core 0.12.0 (npm) |

- **Protocol:**
  - One hidden child `powershell.exe` per deck, and per chart for Edit Data. Each child has a 90 s deadline and no retries.
  - Reads are read-only.
  - The save step opens a work copy read-only and calls `SaveCopyAs` to a separate folder. The saved copy is then re-imported offline with the build that exported the deck.
  - No source was saved over. PowerPoint and Excel were never quit. Every source sha256 was unchanged.
  - No script reads `Series.Formula`, which crashes PowerPoint 16.0.20430 (opf#385).
- **Not committed:** decks, saved copies, PNGs and per-deck read-outs.
- **Committed:**
  - [compare.md](compare.md) and [compare.json](compare.json): the set's report, with one reclassification, explained below;
  - [reimport.md](reimport.md) and [reimport.json](reimport.json): the C4 re-import;
  - [run.json](run.json): every child run of attempts `20261006T031542Z`, `T031548Z` and `T031737Z`. No timeouts.

## Result: 15 PASS, 1 FAIL, 10 BASELINE

As run, compare.mjs reported 15 PASS, 2 FAIL and 9 BASELINE. The difference is the c2-zeros-before slide 8 row, which is a baseline (see C2).

| Check | After build | Before build (baseline) |
| --- | --- | --- |
| C3 read-only open, all 6 decks | PASS: no repair prompt, stage done, sha256 unchanged | PASS |
| C4 c4-datasets | **PASS**: payloads and datasets equal, no data diagnostics; dataset refs, `fields` and `mapping` restored (the doughnut included) | BASELINE: `chart-data-provenance-changed` on slides 1, 2 and 4 |
| C4 c4-formats | **FAIL on slide 6 only**: `chart-data-provenance-changed slides.5.charts.0`. Scatter names `a`, `b`, `c` are kept, and slides 1 to 5 restore. | BASELINE: slides 1, 3, 4 and 6 changed; scatter names `1`, `2`, `3` |
| C2 c2-zeros, 8 charts | **PASS on all 8, scatter included**: every workbook value cell equals the chart cache (zeros in B3, B4, C3, C4, C7; scatter A3, B3, B5, B6) | BASELINE: slides 1 to 7 read blank (`Value2` null) where the cache has 0; slide 8 cannot open (below) |

## C4 slide 6: root cause

Slide 6 of c4-formats is the exploratory bar chart. Its three series use the formats `€#,##0.00`, `0.0 m/s` and `+0.0 pts`.

Offline, with the `b076bb6` build and core `11317237`, I compared the chart evidence of slide 6 in the source and in PowerPoint's saved copy. Each series format code was mapped through core `numberFormatFromExcel`, as `b076bb6` does:

| Series | Source `c:formatCode` | Saved `c:formatCode` | Canonical (core) | Same? |
| --- | --- | --- | --- | --- |
| Price | `"€"#,##0.00` | `"€"#,##0.00` | `€#,##0.00` both | yes |
| Speed | `0.0 "m"/"s"` | **`General`** | `0.0 m/s` vs none | **no** |
| Delta | `+0.0 "pts"` | `\+0.0\ "pts"` | `+0.0 pts` both | yes |

`b076bb6`'s canonicalization works: `€` and `\+ … \ "pts"` map back to the same NumberFormat. The mismatch is real. PowerPoint drops the `m/s` code itself:

- The native read of the **unsaved** deck already reports `"General"` for the Speed label number format.
- The slide PNG shows the Speed labels as `3.2` and `4.8`, while the other series show `€12.50` and `+1.5 pts`.
- The saved copy writes `General` into both the series cache and the label `numFmt`.

The cause is in core: `excelNumberFormat("0.0 m/s")` writes `0.0 "m"/"s"`, because `excelLiteral` treats `/` as a character Excel shows without quotes. In an Excel number format, an unquoted `/` after a digit placeholder is read as a fraction bar. `0.0 … / …` is not a valid fraction code, so PowerPoint rejects the code on load and uses General.

Of all 26 C4 chart parts, 24 have equal evidence after the save with `b076bb6`. The other two are slide 6 of each c4-formats build. A further canonicalization cannot fix this, because the format is actually lost.

**Fix (core opf#376, `excelNumberFormat`):** quote `/` with the surrounding literal text, so `/` leaves the unquoted-safe set.

| NumberFormat | Today | Proposed |
| --- | --- | --- |
| `0.0 m/s` | `0.0 "m"/"s"` | `0.0 "m/s"` |
| `km/h 0` | `"km"/"h" 0` | `"km/h" 0` |
| `#,##0 items/day` | `#,##0 "items"/"day"` | `#,##0 "items/day"` |

Each proposed code maps back to the same NumberFormat through `numberFormatFromExcel`. `€`, `+`, `$`, `units` and `kg` are unchanged.

Until the fix ships, an existing deck with a `/` unit still loses its format in PowerPoint. The provenance check then rightly reports `chart-data-provenance-changed`. A native read of a deck re-exported with the fix is still to do.

## C2 slide 8 before: baseline, not a failure

On the before build (opf-pptx main `7c93a1b`), Edit Data on the slide-8 scatter fails in `ChartData.Activate` with `0xB0D7019E`, so no cell can be read.

The package confirms the reason. The embedded workbook of slide 8 (`Microsoft_Excel_Worksheet8.xlsx`) writes the X gap as the numeric cell `<c r="A4"><v>null</v></c>`; the chart cache has no point 2. That is the bug opf-pptx#173 fixes: the after deck writes the blank cell `<c r="A4"/>`, and Edit Data then reads every cell, A3 = 0 included. Excel cannot load a numeric cell with the text `null`, so Edit Data does not open at all.

compare.mjs counts this as a FAIL because it expects a cell read-out. Here it is recorded as BASELINE, with `statusAsRun: "FAIL"` kept in compare.json.
