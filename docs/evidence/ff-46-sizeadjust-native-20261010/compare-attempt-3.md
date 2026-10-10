# opf#323 native compare (0.18 packages)

Generated 2026-10-10T22:10:20.350Z from `native/attempt-3`. Packages: `@openpresentation/opf` 0.18.1, `@openpresentation/opf-render` 0.18.0, `@openpresentation/opf-pptx` 0.18.0, `@openpresentation/opf-editor` 0.18.0, `fontkit` 2.0.4.

## opf#361 lineAscent probe, attempt 3 (mixed lines)

Criterion: Baseline below the line-box top in em: the bottom edge of the last ink row with at least 35 % of the peak row (for a headline script such as Devanagari: the mode of the stem bottoms), median over 18, 24 and 32 pt (regular single lines = lineAscent, mixed line = lineAscentMixed). The controls (Angsana New 0.85, Sakkal Majalla 0.78, Arabic Typesetting 0.745 as re-derived from the RR-38 native PNGs) must reproduce within 0.03 em, or the probe values are not used.

Controls / cross-check: reproduce their reference values.

| Family | lineAscent (single, regular) | lineAscentMixed | Bold median | Single per size (18 / 24 / 32) | Mixed per size | Control |
| --- | ---: | ---: | ---: | --- | --- | --- |
| Angsana New | 0.83 | 0.86 | 0.836 | 0.833 / 0.833 / 0.833 | 0.856 / 0.866 / 0.862 | reference 0.833: ok |
| Sakkal Majalla | 0.76 | 0.81 | 0.761 | 0.759 / 0.764 / 0.76 | 0.819 / 0.81 / 0.81 | reference 0.761: ok |
| Arabic Typesetting | 0.74 | 0.8 | 0.738 | 0.741 / 0.736 / 0.74 | 0.801 / 0.81 / 0.8 | reference 0.741: ok |

