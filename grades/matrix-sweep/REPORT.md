# matrix-sweep grading (Keynote 16.0, OPF 0.36.0 against 0.35.1)

Saved by the supervisor from the grader's hand-back (the grader could not write report files itself).

All 87 slides of the seven `sweep-*` decks looked at: default mode, and native for six (`sweep-agenda` native equals default). Static not opened (slide XML identical). Every 0.35.1 grid page looked at for the "before".

**Counts (0.36.0 against the 0.36.0 preview):** 172 slide grades: 0 same, 165 small, 7 wrong. "Small" is almost always only Helvetica for Aptos, plus known differences (chart title centered, per-point bar colors not drawn, monospace replaced). Wrong: `sweep-tables` 7, 12, 13 (default and native), `sweep-tables` 11 (native).

**Result:** 46 of 48 rows pass: the fix shows in Keynote as in the preview. M25 and M40: SW-01. M39 native: SW-02.

- 0.35.1: Keynote drew the four- and five-chevron strips and the Vertical Process SmartArt each as one picture (probe class `image`). 0.36.0: native, editable shapes.
- The matrix (MX1) is still card-grid SmartArt, drawn by Keynote as a picture (known); looks like the preview.
- M26 holds: Keynote keeps `c:max 42` in `back.pptx`; the North column reaches the top of the plot.

## Findings

- **SW-01 (wrong): the grown table's header words break mid-word in Keynote.** "Tea|m", "Participant|s", "Completio|n" on `sweep-tables` 12, 13 (M40) and 7 (M25), default and native. Keynote keeps 24 pt bold and the exported column widths; Helvetica Bold is wider than the Aptos the columns were measured with. 0.35.1: slides 12, 13 whole (small table); slide 7 already split "Participant|s". Whose: the file is valid and Keynote reads it differently (font substitution; cause inferred). Main: unchanged. Sheet `SW-01-table-header-split.jpg`. Min deck `grades/matrix-sweep/min/SW-01.opf.json`.
- **SW-02 (wrong, native only): the TAB-1 note stands at the foot of the slide, about 97 px (of 720) below the table**, `sweep-tables` 11 (M39). The native file puts body placeholder idx 300 at y 572; the default file at y 475, where the preview draws it (reproduced with the minimal deck's native export). 0.35.1 native: the same. Inferred cause: `packages/pptx/src/native-body.js` `planOne`, line 103, uses `region.box` instead of core's moved `item.box`. Whose: OPF's file is wrong. Main: unchanged. Sheet `SW-02-native-note-at-foot.jpg`. Min deck `grades/matrix-sweep/min/SW-02.opf.json`.

## Improvements

- Table columns with room for a substitute font (SW-01): slack in column sizing, or measure with Helvetica/Arial as well. `--typefaces safe` may already fix it on a Mac (not run; experiment queued). PowerPoint cost: slightly wider columns or smaller text.
- Native body placeholder at core's box (SW-02). No flag does this; default mode is right. PowerPoint cost: none expected; Change Layout behavior unknown.
- Matrix cards as shapes: arrives as a non-editable picture; `--smart-art shapes` already does it; PowerPoint cost: loses live SmartArt.

## Known, confirmed in passing (all still show)

- Font substituted: every slide.
- Chart title centered: `sweep-auto` 2-8, `sweep-records` 1-3, 8, 9, `sweep-tables` 1, 2, 8, `sweep-growth` 11.
- Per-point bar colors not drawn: `sweep-records` 1-3, 8, 9, `sweep-growth` 11.
- Monospace replaced by Helvetica: `sweep-records` 4, 5, 10, 11.
- SmartArt drawn from its picture: `sweep-diagrams` 6, 7 (in 0.35.1 also 2, 3, 5).
- Keynote does not make opf#1470 worse on `sweep-records` 13 and 16. None of the opf#1412 preview weaknesses is on a sweep slide.

## Per row

| row | sub-ids | deck / slides | 0.35.1 in Keynote | 0.36.0 in Keynote | result | sheet |
|---|---|---|---|---|---|---|
| M05 | LH-102, TXT-1 | sweep-growth 1, 2 | texts ~28 px, paragraph + list ~25 px | grown to ~56 px / ~40 px, as preview | passed | |
| M06 | LH-102, L1 | sweep-growth 3 | list hangs under the title | list in the middle of the body | passed | |
| M07 | LH-102, A9, L1 | sweep-growth 4, 5 | two-point lists ~28 px | ~50 px | passed | |
| M08 | LH-133, C06 | sweep-growth 6 | answers smaller than questions | answers at question size | passed | |
| M09 | LH-188, Q1 | sweep-growth 7, 8 | "Simple." ~45 px; quote with stub line | ~90 px; two balanced lines | passed | |
| M10 | LH-193, IB1, COL-1 | sweep-growth 9-11 | text/list ~25 px beside picture/chart | grown as preview | passed | |
| M15 | A11, LH-115 | sweep-tables 1-3 | table ~18 px centered beside chart | grown; top on chart heading line | passed | |
| M17 | A6, LH-58 | sweep-arrangement 1, 2 | small two columns at the top | 2 x 2 ~42 px, centered | passed | |
| M18 | C10 | sweep-tables 4 | two thin tables | both grown, one top line | passed | |
| M19 | C12 | sweep-tables 5 | table at foot, gap under metrics | table one gap under metrics | passed | |
| M20 | C15 | sweep-arrangement 3, 4 | uncaptioned picture taller | one top and bottom edge | passed | |
| M21 | A2 | sweep-auto 1, 2 | pie/paragraph and table at column top | centered on the body/chart middle | passed | |
| M22 | A1 | sweep-auto 3 | row squeezed into the top third | row fills the body | passed | SW-M22-full-top-row.jpg |
| M23 | A3 | sweep-auto 4-6 | text/list at column top | centered as one group | passed | |
| M24 | A3 mode column | sweep-auto 7 | chart beside the text | text above, chart full width | passed | |
| M25 | COL-2, LH-44 | sweep-tables 6, 7 | 6: small table; 7: "Participant\|s" split | 6: grown, right; 7: header words split | 6 passed; 7 **SW-01** | SW-01-table-header-split.jpg |
| M26 | LH-03, LH-59 | sweep-tables 8 | axis end 50, North short of top | c:max 42 kept, North reaches top | passed | |
| M27 | COL-4, LH-86 | sweep-arrangement 5, 6 | long texts as full-width rows | two / three columns, one size | passed | SW-M27-long-texts-columns.jpg |
| M28 | C01, WI-3 | sweep-arrangement 7 | equal halves | A narrow, B wide, band at foot | passed | |
| M29 | A7 | sweep-auto 8, 9 | small chart alone, blocks at top | chart across the last row, blocks centered | passed | |
| M31 | footer clearance | sweep-arrangement 8, 9 | half gap above the footer | whole gap | passed | |
| M33 | IM1 | sweep-arrangement 10, 11 | panorama full bleed; caption over the footer | inside margins; caption under the picture | passed | SW-M33-caption-above-footer.jpg |
| M34 | C01, LH-67 | sweep-arrangement 12 | long Second block led | First, Second, Third in order | passed | |
| M35 | LG1 | sweep-arrangement 13, 14 | bare names | 5:2 wordmark tiles | passed | |
| M36 | A5 | sweep-auto 10, 11 | texts at the top beside picture | centered as one group | passed | |
| M37 | A12, C11, LH-108 | sweep-tables 9, 10 | value list pinned far right | list beside pie/doughnut, centered | passed | |
| M38 | A4, LH-114 | sweep-auto 12, 13 | stack under the title, quote ~22 px | moved down, quote large on one line | passed | |
| M39 | TAB-1 | sweep-tables 11 | small table and note; native: note at the foot | default as preview; native: note ~97 px low | default passed; native **SW-02** | SW-02-native-note-at-foot.jpg |
| M40 | TAB-2 | sweep-tables 12, 13 | 18 px table, headers whole | grown; header words split mid-word | **SW-01** | SW-01-table-header-split.jpg |
| M41 | C08 | sweep-diagrams 1 | small flowchart | grown ~1.6x | passed | |
| M42 | C03, VPR-1 | sweep-diagrams 2-5 | 2, 3, 5: SmartArt drawn as one picture; 4: chevrons stretched | native chevron / roundRect + rightArrow shapes | passed | SW-M42-chevrons-native-shapes.jpg, SW-M42-vertical-process.jpg |
| M43 | MX1 | sweep-diagrams 6, 7 | gray strips (SmartArt picture) | blue centered cards (SmartArt picture: known) | passed | |
| M44 | HI1, H2 | sweep-diagrams 8, 9 | narrow org chart; H2 as bullet list | full-width tree; four-level tree | passed | SW-M44-hierarchy-tree.jpg |
| M45 | IP1, PY1 | sweep-diagrams 10, 11 | bars at left, narrow | centered, wider | passed | |
| M46 | PR2 | sweep-diagrams 12 | "Decide" regular, higher | bold, same line | passed | |
| M47 | PR1, LH-07 | sweep-diagrams 13 | small badge column | badged row, large text | passed | |
| M48 | TLN-1, LH-129 | sweep-diagrams 14, 15 | small labels and markers | grown labels, dates, markers | passed | |
| M49 | VEN-1 | sweep-diagrams 16 | bullet list | four-circle Venn | passed | SW-M49-venn.jpg |
| M50 | C09 | sweep-agenda 1, 2 | no file (opf#1429) | 4 + 3 and 5 + 5, centered | passed (no before) | |
| M51 | C02 | sweep-records 1-3 | aside in the top third | aside level with chart middle | passed | |
| M52 | C07 | sweep-records 4, 5 | small code, small aside | grown together | passed | |
| M53 | COL-3 | sweep-records 6, 7 | short texts at card top | centered in cards | passed | |
| M54 | C05, LH-112 | sweep-records 8, 9 | 3 + 1 metrics; two start-aligned | four in one row; two centered | passed | SW-M54-four-kpis.jpg |
| M55 | C14, LH-06 | sweep-records 10-12 | band at body foot | band one gap under snippet | passed | |
| M56 | TEA-1, LH-42 | sweep-records 13 | 4 + 1 | 3 + 2 | passed | |
| M57 | P1, P2, TEA-1 | sweep-records 14-16 | text at card foot (15) | mid-card | passed | |
| M58 | P3, LH-136 | sweep-records 17 | thin gray pills | display words over rules | passed | SW-M58-display-words.jpg |
| M59 | SCO-1 | sweep-records 18 | figures at tile top | large, mid-tile | passed | |

Not run here: M14, M16, M30, M71 (other grader); M32, M60, M72 (not Keynote matters). Minimal decks not yet opened in Keynote (in `grades/reopen-list.txt`; SW-02 needs native). SW-01 experiments (`--typefaces safe`, wider `a:gridCol`) not run. In native mode `back.pptx` has fewer explicit `buChar` than the export (17 → 5 in `sweep-growth`) though Keynote draws every bullet: inferred inherited from the placeholder style; a UI check is queued.
