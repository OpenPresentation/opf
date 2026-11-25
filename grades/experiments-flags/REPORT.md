# Flag re-exports and minimal decks in Keynote 16.0 (OPF 0.36.0)

Saved by the supervisor from the grader's hand-back. Data: `grades.json` (1094 entries, with `before` where an earlier grade exists), `xmin.json`. Seen in the pictures unless marked inferred. "Same" = matches the safe preview line for line. A footer showing "N" for "N / M" is graded small (known), so ordinary and data-story-academy have no "same" in default or native. Native: only slides whose pixels differ from default were looked at; layouts-little native assumed equal to default.

## 1. `--typefaces safe` (x-safe, 26 files): wrong before → now

| deck (mode) | same / small / wrong now | wrong before → now |
|---|---|---|
| layouts-lots default | 31 / 5 / 2 | 12 → 2 (31, 36) |
| layouts-lots native | 26 / 10 / 2 | 11 → 2 (31, 36) |
| layouts-ordinary default | 0 / 38 / 0 | 1 → 0 |
| layouts-ordinary native | 0 / 38 / 0 | 1 → 0 |
| layouts-ordinary static | 37 / 1 / 0 | 1 → 0 |
| layouts-little default and native | 34 / 4 / 0 each | 0 → 0 |
| lang-latin-1 default | 22 / 2 / 0 | 4 → 0 |
| lang-latin-1 native | 22 / 2 / 0 | 3 → 0 |
| lang-cyrillic-greek default and native | 9 / 0 / 0 each | 5 → 0, 2 → 0 |
| lang-other default | 2 / 0 / 1 | 1 → 1 (am) |
| lang-other native | 1 / 1 / 1 | 0 → 1 (am) |
| sweep-tables default | 10 / 3 / 0 | 3 → 0 |
| sweep-tables native | 9 / 3 / 1 | 4 → 1 (slide 11: SW-02) |
| m-text-flush default | 4 / 3 / 0 | 1 → 0 |
| m-text-flush native | 6 / 1 / 0 | 1 → 0 |
| m-charts default | 5 / 6 / 5 | 5 → 5 (slides 1-5) |
| layout-sampler default | 44 / 8 / 0 | 2 → 0 |
| layout-sampler native | 38 / 13 / 1 | 3 → 1 (slide 24: SW-02) |
| full-feature-tour default and native | 9 / 2 / 0 each | 0 → 0 |
| data-story-academy default | 0 / 16 / 0 | 2 → 0 |
| data-story-academy static | 14 / 2 / 0 | 2 → 0 |
| table-and-code default and native | 2 / 0 / 0 each | 0 → 0 |

321 of 556 x-safe slides are now "same" (92 more differ only by the known footer number).

Earlier findings with safe typefaces:

- LY-01 title overflow: **gone** (lots 1, 10, 13, 22, 25, 26, 28, 34 and the ordinary cover wrap as the preview). Titles wrap one word differently on lots 37 and sampler 4 (small).
- LY-02 / LG-01 line boxes overrun: **gone** (lots 12, 8, 6; ca, vi, bg, el, mk, ru, uk, cs, da, fil, pt, af, es). Still there: Amharic (lang-other 1; an Ethiopic font, not Arial).
- SW-01 / MX-08 table headers split: **gone** ("Participants", "Completion", "Team", "Terminal" whole).
- LY-03 / MX-07 legends: still there (lots 31 over the list, lots 36 cut, m-charts 5 pie legend entry cut).
- MX-03, MX-05, m-charts 4 known rows: still there.
- MX-01 flush overhang: still there in default mode (m-text-flush 3 right ends, 1280 px: Keynote safe 1226 / 1231 / 1232 / 1218; preview 1219 / 1218 / 1219 / 1217; Aptos Keynote 1228 / 1228 / 1228). Native body text flush (1214 / 1219 / 1220 / 1218).
- Unchanged, small (corrected by the grader: not new with safe): m-text-flush 1, the right-aligned heading wraps to a third line ("edge") in the Aptos export and in the safe export alike; the preview has two lines; no overlap (`XS-flush-heading-unchanged.jpg`).
- SW-02: unchanged (sweep-tables 11 about 99 px low; sampler native 24 touching the footer; ordinary native 32 about 40 px, small).
- RT-06 title shrink: **gone** as far as `back.pptx` shows (titles written back smaller: safe 0 of 32 lots, 0 of 18 ordinary, 0 of 12 latin-1; Aptos 25 of 35 lots, 14 of 18 ordinary). Whole-point truncation (3825 → 3800) remains.
- Monospace replaced by Helvetica: **no longer shows**: code is written and drawn as Courier New.
- QT-01 bullet size: not run (coverage-lists not exported safe).

Fonts: `probe.json` reports ArialMT / Arial-BoldMT throughout, CourierNewPSMT for code; no Helvetica in any x-safe or x-keynote-profile file; Ethiopic by fallback on lang-other 1. Warnings window: 21 of 37 files captured; none lists a missing font (only "Unsupported media were removed", and "SVG images were converted to PNG" for ordinary / little native).

Cost in OPF's own preview (inferred from the sheets; the Aptos and safe previews were not diffed): the face and a few line breaks; layouts not visibly different.

Sheets: `XS-lots-title.jpg`, `XS-lots-columns.jpg`, `XS-sweep-table.jpg`, `XS-latin-catalan.jpg`, `XS-flush-heading-unchanged.jpg` (Keynote default | Keynote safe | safe preview).

## 2. `--smart-art shapes` (7 files)

ordinary 16 (pyramid): 1 image → 5 shapes + 5 text items; 19 (cycle): 1 image → 9 shapes + 5 text items; little 16, 18, 19, 20: 1 image → 2 shapes + 1 text item each. Lots has no SmartArt. All look like the preview. 6 SmartArt slides, all editable shapes with text.

## 3. Keynote profile (native body + safe typefaces + static slide numbers; 4 files)

- layouts-lots: pixel-identical to safe native: 2 wrong (31, 36), against default 12 and native 11.
- layouts-ordinary: safe native plus a complete footer ("N / 38" on 38 of 38 slides); 0 wrong; slides 9, 31, 32 small (native re-wrap, SW-02 pattern).
- data-story-academy: identical to safe static; 14 same, 2 small.
- footers: 4 slides, all same.
- The combination breaks nothing new.

## 4. Minimal decks (x-min): 24 of 31 reproduce fully

| id | reproduces | mode | 0.35.1 | note |
|---|---|---|---|---|
| LY-01 | **no** | | | two-line title stays two lines; finding rests on the full decks |
| LY-02 | yes, mild | default | | |
| LY-03 | yes | default, native | | legend over the bullets |
| LG-01 | partly | default, native | | ends about 15 px short of the Latin block; no collision |
| LG-02 | yes | default | | table over the chart |
| LG-03 | partly | | | Amharic overlap shows; separator-led line does not |
| LG-04 | no, untestable | | | native minimal deck identical to default |
| MX-01 | yes | default (native flush) | flush (1220 against preview 1219; 0.36.0 1228) | |
| MX-02 | yes | default | | "ranes", "tware", "asing", "pairs" |
| MX-03 | yes | default | four legend entries, full-width columns | 0.36.0: "Wait Wait", half-width columns |
| MX-04, MX-05, MX-06, MX-07, MX-08 | yes | default | | |
| SW-01 | yes | default, native | headers whole | |
| SW-02 | yes | native only | | |
| RT-01 | yes | default | 1 series, ptCount 4, imports | 0.36.0 back.pptx: 2 series, ptCount 1 with idx 1; import fails |
| RT-02, LY-05 | yes | default | | `multiLvlStrRef` in back.pptx |
| LY-05-dash, LY-05-space | control: no split | | | so ": " is the trigger |
| LY-06 | yes | | | back.pptx has "Section 0" |
| LY-04, RT-03 | yes | | | description = shape name; back.pptx name and descr "HarborOPF image 1" |
| RT-04, RT-05, RT-06, RT-07, RT-08 | yes | | | |
| RT-09 | partly | | | axis rewritten; pictures not compared |

## Not looked at

The missing-fonts banner (user interface); layouts-little native slide by slide; lang-cyrillic native beyond slides 1, 6, 7, 9; native slides identical in pixels to default; x-min RT-09 pictures; 0.35.1 and main for x-safe.
