# opf#323 native compare (0.18 packages)

Generated 2026-10-10T22:03:29.866Z from `native/attempt-2`. Packages: `@openpresentation/opf` 0.18.1, `@openpresentation/opf-render` 0.18.0, `@openpresentation/opf-pptx` 0.18.0, `@openpresentation/opf-editor` 0.18.0, `fontkit` 2.0.4.

## FF-46 / opf#361 factor-applied re-run

Patched policy rows (scratch, not committed): {"Angsana New":{"sizeAdjust":0.75,"lineAscent":0.85},"DilleniaUPC":{"sizeAdjust":0.68},"Sakkal Majalla":{"sizeAdjust":0.89,"lineAscent":0.78,"lineAscentMixed":0.78},"Malgun Gothic":{"sizeAdjust":1.07},"Nirmala UI":{"sizeAdjust":1.07}}

Criterion: Names as FF-12; the script runs name the deck family; every exported line box reads one native line; no native-only overflow past the box (> 0.5 pt); native / preview ink on lines of at least 200 pt within 0.80 to 1.01. Image scores are reported, not gated.

Decks: **5 PASS, 2 FINDING, 0 FAIL, 0 not run** of 7. Families: 3 of 5 pass.

| Family | Outcome | Long-line ink (native / preview) | Reasons |
| --- | --- | ---: | --- |
| Angsana New | PASS | 0.9488 | - |
| DilleniaUPC | PASS | 0.9474 | - |
| Malgun Gothic | FINDING | 1.0226 | sa-scripts-12-ko-malgun-gothic: 1 boxes overflow only natively (max 82.03 pt); sa-scripts-12-ko-malgun-gothic: native ink 1.0226 of the preview: the real font is wider |
| Nirmala UI | FINDING | 1.0033 | sa-scripts-27-hi-nirmala-ui: 1 boxes overflow only natively (max 4.16 pt) |
| Sakkal Majalla | PASS | 0.9115 | - |

| Deck | Verdict | Names | Lines (single / boxes) | Native-only overflow | Ink median (long) | Images close / review / far |
| --- | --- | --- | --- | --- | --- | --- |
| sa-scripts-12-ko-malgun-gothic | FINDING | ok | 10 / 10 | 1 | 1.0244 (1.0226) | 0 / 2 / 0 |
| sa-scripts-19-ar-sakkal-majalla | PASS | ok | 11 / 11 | 0 | 0.9163 (0.9091) | 2 / 0 / 0 |
| sa-scripts-20-ur-sakkal-majalla | PASS | ok | 11 / 11 | 0 | 0.9074 (0.9018) | 2 / 0 / 0 |
| sa-scripts-21-fa-sakkal-majalla | PASS | ok | 11 / 11 | 0 | 0.917 (0.9115) | 2 / 0 / 0 |
| sa-scripts-27-hi-nirmala-ui | FINDING | ok | 12 / 12 | 1 | 1.0043 (1.0033) | 2 / 0 / 0 |
| sa-scripts-37-th-angsana-new | PASS | ok | 11 / 11 | 0 | 0.9553 (0.9488) | 2 / 0 / 0 |
| sa-scripts-38-th-dilleniaupc | PASS | ok | 11 / 11 | 0 | 0.9455 (0.9474) | 2 / 0 / 0 |

## opf#361 lineAscent probe

Criterion: Baseline below the line-box top in em: the RR-38 last ink row with at least 35 % of the peak row, median over 18, 24 and 32 pt (regular single lines = lineAscent, mixed line = lineAscentMixed). The controls (Angsana New 0.85, Sakkal Majalla 0.78, Arabic Typesetting 0.70) must reproduce within 0.03 em, or the probe values are not used.

Controls: **do NOT reproduce their known values; do not use the probe values**.

| Family | lineAscent (single, regular) | lineAscentMixed | Bold median | Single per size (18 / 24 / 32) | Mixed per size | Control |
| --- | ---: | ---: | ---: | --- | --- | --- |
| DilleniaUPC | 0.82 | 0.85 | 0.811 | 0.815 / 0.819 / 0.813 | 0.856 / 0.852 / 0.841 | - |
| Malgun Gothic | 1.06 | 1 | 1.058 | 1.056 / 1.056 / 1.042 | 1.004 / 0.991 / 0.998 | - |
| Nirmala UI | 0.73 | 0.93 | 0.836 | 0.704 / 0.736 / 0.729 | 0.93 / 0.921 / 0.935 | - |
| Angsana New | 0.83 | - | - | 0.833 / 0.833 / 0.833 | - | known 0.85: ok |
| Sakkal Majalla | 0.76 | - | - | 0.761 / 0.766 / 0.759 | - | known 0.78: ok |
| Arabic Typesetting | 0.74 | - | - | 0.745 / 0.741 / 0.737 | - | known 0.7: OFF |

