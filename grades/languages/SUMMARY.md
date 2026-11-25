# Languages family: summary (OPF 0.36.0, Keynote 16.0, written 2026-11-25)

Opened: 9 decks, 91 slides in default mode (91 slides) and native mode (82 slides; lang-rtl native equals default and was not opened). Two tags have no slide: ctg, or (not run).

## Counts (grades.json)

| deck | default same/small/wrong | native same/small/wrong |
|---|---|---|
| lang-latin-1 (24) | 0/20/4 | 0/21/3 |
| lang-latin-2 (24) | 0/22/2 | 0/23/1 |
| lang-latin-3 (9) | 0/6/3 | 0/8/1 |
| lang-cyrillic-greek (9) | 0/4/5 | 0/7/2 |
| lang-rtl (6) | 0/4/2 | not opened |
| lang-cjk (4) | 0/4/0 | 0/4/0 |
| lang-indic (10) | 0/10/0 | 0/10/0 |
| lang-southeast-asia (2) | 0/2/0 | 0/2/0 |
| lang-other (3) | 0/2/1 | 0/3/0 |

No slide is "same": every slide has at least the Aptos to Helvetica face change (known: font substituted). "Small" includes gaps under 6 pt to the neighbor block.

## Wrong slides (with sheets)

- LG-01 overlap from a wider substitute: af, ca, cs, fil, pt, es, sw, tl, vi-Latn, bg, el, mk, ru, uk, am (default); native bg, uk, cs, da, fil, pt, tl: `$W/evidence/sheets/LG-01-substitute-font-wider-collides.jpg`
- LG-02 rtl table over the chart: ar, he: `$W/evidence/sheets/LG-02-rtl-table-mirrored-over-chart.jpg`
- am default also LG-03: `$W/evidence/sheets/LG-03-amharic-overflow-and-word-separator.jpg`; LG-04 (small): `$W/evidence/sheets/LG-04-korean-native-wraps-inside-words.jpg`

## Not looked at / not run

- lang-rtl native (same file as default). Keynote's missing-fonts list and import-warnings text for this family (not read). Font Panel names inside Keynote (UI checks in `$W/grades/ui-checks.md`). Substitute fonts are inferred from CoreText, not read from Keynote. Fine glyph-shape differences (Han regional forms, Thai and Khmer word breaks, Indic stacking beyond what the picture shows) cannot be judged at 960 px. No 0.35.1 Keynote run exists for this family. Main compared by XML: identical.
- Minimal decks (min/LG-01..04) not yet opened in Keynote: in `$W/grades/reopen-list.txt`. Improvements (typefaces safe, Hebrew/Thai names) not run: experiments in `$W/grades/experiments.md`.
