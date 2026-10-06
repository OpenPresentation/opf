# RR-54 slash probe: '/' and other Excel special characters in number format units

The RR-54 native re-check ([opf#387](https://github.com/OpenPresentation/opf/pull/387)) failed one slide. Core `excelNumberFormat` wrote `0.0 m/s` as `0.0 "m"/"s"`. A bare `/` is Excel's fraction bar, so PowerPoint dropped the code to General on load: labels showed 3.2 and 4.8 with no "m/s".

Core opf#376 `d955d600` now quotes a literal run as one string: `0.0 "m/s"`, `"km/h "0`, `#,##0 "items/day"`. Excel's other special characters (`E+`, `@`, `*`, `_`, `?`, `.`) stay inside the quotes. This probe checks, in PowerPoint, that each code survives loading.

## Contents

- `decks/rr54-slash.pptx`: built by opf-pptx#171 `b076bb6` with core opf#376 `d955d600` linked.
- `decks/rr54-slash.opf.json`: the OPF document it was exported from.
- `manifest.json`: the build, the deck sha256, and for every slide the format, the exported Excel code (the same on the series cache, the data labels and the value axis) and the label texts expected on the slide.
- `build.mjs`: rebuilds the deck. You do not need to run it; the shipped deck matches `manifest.json`.
- `check.mjs`: compares the PowerPoint read with `manifest.json`. It runs offline and needs a built core checkout at `d955d600` or later.

Twelve column charts, one format each, with data labels on:

| Slide | Format | Exported code | What it checks |
| --- | --- | --- | --- |
| 1 | `$#,##0.0` | `$#,##0.0` | control (passed in opf#385) |
| 2 | `0.0 m/s` | `0.0 "m/s"` | the opf#387 failure |
| 3 | `km/h 0` | `"km/h "0` | `/` in a prefix |
| 4 | `#,##0 items/day` | `#,##0 "items/day"` | `/` in a longer unit |
| 5 | `0.0 E+3 m` | `0.0 "E+3 m"` | `E+` (exponent) |
| 6 | `#,##0 @HQ` | `#,##0 "@HQ"` | `@` (text placeholder) |
| 7 | `#,##0 *est` | `#,##0 "*est"` | `*` (repeat fill) |
| 8 | `#,##0 net_rev` | `#,##0 "net_rev"` | `_` (skip width) |
| 9 | `#,##0 ok?` | `#,##0 "ok?"` | `?` (digit placeholder) |
| 10 | `0.0% p.a.` | `0.0% "p.a."` | `%`, then a literal `.` |
| 11 | `#,##0 (est)` | `#,##0 ("est)"` | a bare `(`, then a quoted run |
| 12 | `0 "q"` | `0 \""q"\"` | literal double quotes as `\"` escapes |

## Run (Windows, desktop PowerPoint 365)

```powershell
# 0. Check the deck: (Get-FileHash decks\rr54-slash.pptx).Hash must equal manifest.json file.sha256.
# 1. Start PowerPoint by hand, with no deck open. 2. In this folder (read-only open; never saves, quits or kills):
powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File ..\rr54-recheck\read-deck.ps1 -Deck decks\rr54-slash.pptx -Out out
# 3. Offline:
node check.mjs <core checkout>\packages\javascript out
```

- Run it in a hidden child process with a 90 s deadline and no retry, as `run-set.ps1` does for the re-check set.
- Watch for a repair prompt while the deck opens. A repair prompt is a FAIL.

## Expected result

- **Every slide PASS** in `out/check.md`. PowerPoint's data-label NumberFormat is not General, and core maps it back to the slide's format. A re-spelling such as `\$` or `\ "m/s"` is still a PASS.
- **The slide PNGs** (`out/rr54-slash-slideNN.png`) show the labels listed in `manifest.json`, for example `3.3 m/s`, `km/h 5`, `13 items/day`.

Evidence goes to `docs/evidence/rr-54-slash-native-<yyyymmdd>/` in core, linked from opf#376: `out/check.md`, `out/check.json`, `out/read-rr54-slash.json`, and the PNGs of slides 2 to 4.
