# opf#323 native compare (0.18 packages)

Generated 2026-10-10T22:07:50.266Z from `native/attempt-2`. Packages: `@openpresentation/opf` 0.18.1, `@openpresentation/opf-render` 0.18.0, `@openpresentation/opf-pptx` 0.18.0, `@openpresentation/opf-editor` 0.18.0, `fontkit` 2.0.4.

## opf#361 lineAscent probe

Criterion: Baseline below the line-box top in em: the bottom edge of the last ink row with at least 35 % of the peak row (for a headline script such as Devanagari: the mode of the stem bottoms), median over 18, 24 and 32 pt (regular single lines = lineAscent, mixed line = lineAscentMixed). The controls (Angsana New 0.85, Sakkal Majalla 0.78, Arabic Typesetting 0.745 as re-derived from the RR-38 native PNGs) must reproduce within 0.03 em, or the probe values are not used.

Controls: reproduce their known values.

| Family | lineAscent (single, regular) | lineAscentMixed | Bold median | Single per size (18 / 24 / 32) | Mixed per size | Control |
| --- | ---: | ---: | ---: | --- | --- | --- |
| DilleniaUPC | 0.82 | 0.85 | 0.811 | 0.815 / 0.819 / 0.813 | 0.856 / 0.852 / 0.841 | - |
| Malgun Gothic | 1.06 | 1 | 1.058 | 1.056 / 1.056 / 1.042 | 1.004 / 0.991 / 0.998 | - |
| Nirmala UI | 0.97 | 0.94 | 0.974 | 0.981 / 0.972 / 0.969 | 0.93 / 0.935 / 0.935 | - |
| Angsana New | 0.83 | - | - | 0.833 / 0.833 / 0.833 | - | reference 0.85: ok |
| Sakkal Majalla | 0.76 | - | - | 0.761 / 0.766 / 0.759 | - | reference 0.78: ok |
| Arabic Typesetting | 0.74 | - | - | 0.745 / 0.741 / 0.737 | - | reference 0.745: ok |

