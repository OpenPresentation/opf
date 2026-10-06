# RR-54: native check of opf-pptx#171 after the pptxgenjs-plus merge (2026-10-06)

Item: RR-54 (chart and table data). [opf-pptx#171](https://github.com/OpenPresentation/opf-pptx/pull/171) was merged with opf-pptx main `4ca079f` and is now at `ee4941b`. Main carries pptxgenjs-plus 4.3.4 (#165), per-slide script fonts (#170) and the workbook zero fix (#173). The fixes were last checked natively at `b076bb6` on core `d955d600` ([opf#387](https://github.com/OpenPresentation/opf/pull/387), [opf#388](https://github.com/OpenPresentation/opf/pull/388)). This run repeats both probe sets on the new head.

- **Host:** Windows 11, PowerPoint 365 (16.0 build 20430), en-US number settings, 2026-10-06.
- **Build:** every deck was exported by opf-pptx `ee4941b` with core [opf#376](https://github.com/OpenPresentation/opf/pull/376) `d955d600` linked (core version 0.12.2). [decks.json](decks.json) lists each deck's sha256 and its saved-copy sha256.
- **Sets:** from `codex/probe-sets-20261005` `b8655025`:
  - `rr54-recheck`, with the "after" decks only. The "before" baselines belong to the earlier fixes and were not rebuilt.
  - `rr54-slash`.
  Both were rebuilt from `ee4941b`.
- **Protocol:** as in opf#387.
  - One hidden child `powershell.exe` per deck, and per chart for Edit Data, each with a 90 s deadline and no retries.
  - Reads are read-only.
  - The save step opens a work copy read-only and calls `SaveCopyAs` into a separate folder. Saving copies is owner-approved.
  - No source was saved over. PowerPoint and Excel were never quit or killed. Every source sha256 was unchanged.
  - No script reads `Series.Formula`.
- **Committed:**
  - [compare.md](compare.md) and [compare.json](compare.json): the re-check report.
  - [reimport.md](reimport.md) and [reimport.json](reimport.json): the C4 re-import of PowerPoint's saved copies.
  - [slash-check.md](slash-check.md) and [slash-check.json](slash-check.json): the slash probe.
  - [run.json](run.json): all 13 child runs of attempts `20261006T070807Z`, `T070815Z` and `T070916Z`, with no timeouts and no non-zero exits. It is flattened from PowerShell 5.1's nested array serialization.
- **Not committed:** decks, saved copies, PNGs and per-deck read-outs.

## Result: 25 PASS, 0 FAIL

| Check | Result |
| --- | --- |
| C3 read-only open: c4-formats, c4-datasets, c2-zeros | PASS: no repair prompt, stage done, sha256 unchanged |
| C4 save copy, then re-import: c4-formats | PASS. Payloads and datasets are equal, with no data diagnostics. The scatter point names stay `a`, `b`, `c`. PowerPoint re-spelled every code (`\$#,##0.0`, `#,##0\ "units"`, `0.0\ "kg"`, `0.0\ "m/s"`, `\+0.0\ "pts"`), and each maps back through core's canonical form. Slide 6 (`0.0 m/s`), which failed in opf#387, now passes. |
| C4 save copy, then re-import: c4-datasets | PASS. Dataset refs, `fields` and `mapping` are restored, the doughnut included. |
| C2 Edit Data: c2-zeros, 8 charts | PASS on all 8, the scatter included. Every workbook value cell equals the chart cache: zeros in B3, B4, C3, C4 and C7, and A3, B3, B5 and B6 on the scatter. The pptxgenjs-plus workbook writer from main keeps zeros. |
| rr54-slash: 12 formats | PASS 12/12. PowerPoint keeps every label number format: `0.0 "m/s"`, `"km/h "0`, `#,##0 "items/day"`, `E+`, `@`, `*`, `_`, `?`, `% p.a.`, `(est)` and literal quotes, plus the `\$#,##0.0` control. The slide 2 PNG shows `3.3 m/s`, `4.8 m/s` and `12.5 m/s`, and the axis ticks carry `m/s`. |

## Observations (not RR-54)

- **Line series element order.** pptxgenjs-plus 4.3.4 writes `c:dLbls` before `c:marker` in line series. CT_LineSer puts `marker` first. This is the same on opf-pptx main `4ca079f` without RR-54, and PowerPoint opens these charts without a repair prompt (here and in opf#351). Filed separately.
- **Gridline colours.** In the slide 2 PNG of the slash deck, the lower gridlines draw green and the upper ones light grey. This is not related to number formats; it is left for the RR-20 native pass on the published 0.13.0 set.
