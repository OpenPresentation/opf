# RR-20: native PowerPoint pass on the published 0.13 set (2026-10-06)

Item: RR-20, the native pass on the published set ([opf#323](https://github.com/OpenPresentation/opf/issues/323)). It repeats the opf#323 native sets of the 0.12 pass on the 0.13 minor train. That train carries pptxgenjs-plus 4.3.4 (opf-pptx#165), per-slide script fonts (opf-pptx#170), workbook zeros (opf-pptx#173) and RR-54 chart and table data (opf#376, opf-pptx#171).

- **Packages:** published npm `@openpresentation/opf` 0.13.0, `@openpresentation/opf-render` 0.13.0 and `@openpresentation/opf-pptx` 0.13.1, pinned exactly with a fresh lockfile in every set. [verify-offline.json](verify-offline.json) records the pins, the lockfile versions and the manifest versions per set. The decks do not use opf-editor.
- **Patch releases:** opf-render 0.13.1 and opf-pptx 0.13.2 are dependency-only patches for GHSA-wq5f-xc86-pv6w (sharp 0.35.5). The supervisor verified that the renderer's 805 golden hashes and the exporter's bytes are unchanged (opf-render#133, opf-pptx#179), so this evidence applies to the final set. Byte checks here:
  - [bytecheck-render-0.13.1.json](bytecheck-render-0.13.1.json): four representative decks rebuilt with opf-render 0.13.1 are sha256-identical to the decks run here. They are rr17 `p-09-charts-core`, RR-54 `c4-formats-after`, FF-12 `01` and opf#87 `pictures`.
  - [bytecheck-control.json](bytecheck-control.json): the harness control.
  - The opf-pptx 0.13.2 half was not published at the time of this run. It is to be added with `node bytecheck.mjs` when it is.
- **Host:** Windows 11, PowerPoint 365 (16.0 build 20430), en-US, with the 16 Windows supplemental font packs installed (since 2026-10-05).
- **Protocol:** as in the 0.12 pass.
  - One hidden child `powershell.exe` per deck (per chart for Edit Data), each with a 90 s deadline and no retries.
  - Reads are read-only (`Presentations.Open(path, -1, 0, 0)`).
  - The only saves are copies into fresh folders, which the owner approved on 2026-10-05: `SaveCopyAs` for RR-54 C4, `SaveAs` copies for opf#87, and one `SaveAs` with embedding for FF-13.
  - No source was saved over; every source sha256 was unchanged. PowerPoint and Excel were never quit or killed.
  - No script reads `Series.Formula`.
- **Decks:** 45, built by an agent from the sets' own builders on the npm packages. [SHA256SUMS.txt](SHA256SUMS.txt) lists them. Not committed: decks, saved copies, PNGs and per-deck reads.

## Result: no regression against the 0.12 pass

| Set | 0.12 pass | 0.13 published | Notes |
| --- | --- | --- | --- |
| RR-17 pptxgenjs-plus, 20 decks ([rr17-compare.md](rr17-compare.md)) | PASS 20/20 (opf#351, b- decks) | **PASS 20/20** | The published `p-` decks are byte-identical to the b- decks (pptxgenjs-plus `0773be6`). The native reads match the 0.12-era b- reads on Presentation.Fonts, chart type, series, values and categories, notes, and geometry within 0.02 pt. |
| FF-12 font sample, 12 decks ([ff12-compare.md](ff12-compare.md)) | 12/12 meet the criterion (opf#352) | **12/12 meet the criterion** | The raw compare says PASS 11, FAIL 1. The FAIL is `08-cjk-in-latin`: Presentation.Fonts omits Meiryo. Meiryo is theme-only there (theme `ea`, no run names it), and the native read is identical to the 0.12 read. That is the accepted reading of opf#352: PowerPoint does not list theme-only script families. |
| FF-05 per-slide script fonts, 4 decks ([per-slide-compare.md](per-slide-compare.md)) | PASS (opf#380) | **PASS 4/4** | One master per script profile (3, 2, 1, 2), and runs read the expected far-east and complex-script slots. |
| FF-27 fields and slide sizes ([ff27-compare.md](ff27-compare.md)) | fields PASS; sizes recorded (opf#354) | **fields PASS; sizes recorded** | Fields renumber after insert and move, and `datetime4` updates. As in 0.12, the windowless read-only attempt could not set `PageSetup.SlideSize` ("Failed"). Its output is kept on the host as `slide-sizes-attempt1-windowless.json`. The windowed in-memory attempt (`Presentations.Add(-1)`, never saved) recorded the presets. |
| RR-54 re-check ([rr54-recheck-compare.md](rr54-recheck-compare.md), [rr54-recheck-reimport.md](rr54-recheck-reimport.md)) | 25 PASS at `ee4941b` (opf#392) | **PASS 13/13** | C3 open 3/3. C4 SaveCopyAs then re-import 2/2: datasets, `fields`, `mapping` and the scatter names restore after PowerPoint re-spells every code. C2 Edit Data zeros 8/8. `c4-formats-after` built from npm 0.13.1 has the same sha256 as the `ee4941b` build. |
| RR-54 slash ([rr54-slash-check.md](rr54-slash-check.md)) | 12/12 (opf#388) | **PASS 12/12** | Every label number format survives load, including `0.0 "m/s"`. |
| opf#87 save and reopen ([opf87-compare.md](opf87-compare.md)) | furniture PASS; pictures FAIL only for the known PowerPoint SVG-fallback drop (opf-87-save-reopen-native-20261005) | **same** | Furniture control and edit PASS. Pictures: PNG, JPEG and cropped pictures pass. The one FAIL per run is slide 5's SVG picture. PowerPoint drops the PNG fallback blip on save and keeps the SVG, as it does for an SVG it inserts itself (control in the 0.12 evidence). Identical to 0.12. |
| FF-13 font embed ([ff13-audit-v2.json](ff13-audit-v2.json)) | PASS, audit v2 (opf#355) | **PASS, audit v2** | Exactly Carlito, four styles, embedded in the saved copy. The fonts were registered for the session only and removed afterwards. As in 0.12, PowerPoint's diagnostic reopen reports Carlito `embedded: 0`; the OPC audit is the criterion. |

Not repeated: the FF-46 measurements (no font-measurement change is in the train) and the 0.12-era before/a- baselines (no published package produces them).

## Observations

- opf-pptx#175: pptxgenjs-plus writes line-series `c:dLbls` before `c:marker`. PowerPoint opens these decks without a repair prompt.
- Gridline colours in some chart PNGs: lower gridlines draw green and upper ones light grey. It is not a regression (no compare criterion changed), and a follow-up look is suggested.
