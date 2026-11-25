# Corpus: text, layout, furniture, language and slide-size decks (OPF 0.36.0 in Keynote 16.0)

Saved by the supervisor from the grader's hand-back. Every slide of 26 files seen in the grid sheets; full-size crops where it mattered (`coverage-furniture` 4, `coverage-regions` 19, the sizes, the native/default pairs). Data: `grades.json` (316 entries), `features.json` (47 manifest features), `objects.json` (Keynote object class counts per deck only). No minimal deck, no sheets (the one new finding is minor). 0.35.1: slide XML identical for `columns`, `coverage-text`, `coverage-template`, `footers`, `footers~static` and the 1x1, 4x5, 9x16 size decks; everything else "pending the control run". main: not run.

## Counts (316 entries): same 5, small 303, wrong 8

| deck / mode | same | small | wrong |
|---|---|---|---|
| layout-sampler default | 0 | 50 | 2 (s1 LY-01, s25 SW-01) |
| layout-sampler native | 0 | 49 | 3 (s1, s25, s24 SW-02) |
| layout-harvest default | 0 | 19 | 1 (s15 SW-01) |
| layout-harvest native | 0 | 19 | 1 (s15) |
| columns | 0 | 2 | 0 |
| coverage-composition | 1 (s11 hidden) | 10 | 0 |
| coverage-regions | 0 | 25 | 0 |
| coverage-design | 0 | 36 | 0 |
| coverage-text | 0 | 12 | 1 (s5 known: quote) |
| coverage-lists | 0 | 13 | 0 |
| coverage-template | 0 | 3 | 0 |
| coverage-furniture | 0 | 9 | 0 |
| footers | 0 | 4 | 0 |
| footers~static | 3 | 1 | 0 |
| full-feature-tour | 1 (s10 hidden) | 10 | 0 |
| multilingual-slides | 0 | 4 | 0 |
| coverage-languages | 0 | 10 | 0 |
| nine size decks | 0 | 3 each | 0 |

## New finding

- **QT-01 (small): bullet dot drawn smaller than the preview.** `coverage-lists` 3, 4, 13 (also 9, 10). OPF writes `buChar •` with `buFont Aptos` and `buSzPts 4200`; Keynote's `back.pptx` has `buFont Helvetica` (inferred: Helvetica's "•" is smaller). File valid; no fix proposed. Lists otherwise match: roman numerals, "(c) (d) (e)" starting at c, "v. vi. vii." and "A. B. C." restarts, per-level style (1. / A) / i.), two-column flow, picture bullets, no-mark stacks.

## Existing ids, counted

- LY-01: `layout-sampler` 1, default and native.
- SW-01: `layout-sampler` 25, `layout-harvest` 15, both modes.
- SW-02: `layout-sampler~native-body` 24 (note about 45 px at 960 wide below where the preview and default put it).
- LY-02 / LG-01 (per-line boxes touch or overrun; all small here): `layout-sampler` 27, 36; `layout-harvest` 5, 13; `columns` 2; `coverage-text` 10, 12; `coverage-design` 18; `coverage-furniture` 9; `full-feature-tour` 8. `layout-sampler` 36 does not collide in native.

## Known list

- Footer with a live slide number shows only the number: **still shows** (`footers` 1, 2, 4; `coverage-furniture` 1, 2, 5, 6, 7). `--slide-numbers static` fixes it (`footers~static`: "Page 1 of 4", "4 / 4").
- Link text in a footer in the hyperlink color: **no longer shows for footers** (`coverage-furniture` 4: the footer lines keep their own color, no underline; `back.pptx` keeps 2 `hlinkClick`). Inline body links still recolored and underlined (`full-feature-tour` 2). Video link caption not checked.
- Quote beside a portrait runs off the right edge: **still shows** (`coverage-text` 5 clips "once").
- Monospace and light faces replaced by Helvetica: **still shows** (`layout-sampler` 26, 47; `coverage-text` 1; `coverage-design` 31, 33; `full-feature-tour` 7).
- Rotated narrow text wrapped mid-word: not in these decks.
- Letter spacing on display text: **applied** in Keynote 16.0 (`coverage-regions` 19; `back.pptx` keeps `spc`, some -84 come back as -100).
- Right-to-left table: none in these decks.
- Hidden slides skipped (`full-feature-tour` 10, `coverage-composition` 11). Keynote's slide-number footer on `full-feature-tour` 11 shows "10" where the preview has 11.
- Per-point bar color not drawn; chart title centered: still show.

## Slide sizes

| deck | Keynote (pt) | `p:sldSz` (EMU) | picture px | content |
|---|---|---|---|---|
| 16x9 | 960 x 540 | 12192000 x 6858000 | 960 x 540 | as preview |
| 16x10 | 720 x 450 | 9144000 x 5715000 | 720 x 450 | as preview |
| 4x3 | 720 x 540 | 9144000 x 6858000 | 720 x 540 | as preview |
| 1x1 | 540 x 540 | 6858000 x 6858000 | 540 x 540 | as preview |
| 4x5 | 540 x 675 | 6858000 x 8572500 | 540 x 675 | as preview |
| 9x16 | 540 x 960 | 6858000 x 12192000 | 540 x 960 | as preview |
| A4 | 841 x 595 | 10689336 x 7562088 | 841 x 595 | as preview |
| Letter | 792 x 612 | 10058400 x 7772400 | 792 x 612 | as preview |
| standard | 720 x 540 | 9144000 x 6858000 | 720 x 540 | as preview |

Only A4 changes: Keynote rounds 841.68 x 595.44 pt to 841 x 595 and writes 10680700 x 7556500 EMU back. Nothing scaled or cropped.

## Native body text against default

- `layout-sampler`: 22 of 52 slides differ in Keynote. Native better on 1 (slide 36: re-wraps instead of touching the next column), worse on 1 (slide 24: SW-02), equal on 50. No native text overflowed its box or the slide.
- `layout-harvest`: 6 of 20 differ; all equal to a reader.
- Net: the two modes hold up about equally in Keynote on these decks.

## Per feature (47 manifest features)

`opens`: passed for all. `slides`: passed for all. `visual`: known difference (Helvetica) for all; findings on the slides above. `noOverflow`, `noShrink`: not run (PowerPoint probes). `footer`: known difference; static variant passes. `roundtrip`: passed for every deck. `nativeChart`: present, highlight not drawn (known). `nativeTable`: present; SW-01 on two. `smartArt`: not run.

## Languages

`multilingual-slides`, `coverage-languages`: Arabic, Hebrew, Japanese, Chinese, Devanagari, French drawn with real glyphs in the right direction; right-to-left numbered lists and timelines mirror as in the preview. All 14 slides small. Per-script fonts not compared with `grades/languages/fonts.md`.

## Import warnings

"Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside" on nearly every file (variants add "Cover 2": `coverage-furniture`, `full-feature-tour`; "Cover 0": `layout-harvest`). Aptos and Aptos Display missing on every file. Roboto Mono missing: `coverage-composition`, `full-feature-tour`. Panel read too early for `coverage-design`, `coverage-languages`, `coverage-text`, `layout-harvest~native-body`, both `layout-sampler` files, `multilingual-slides`.
