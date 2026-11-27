# Example decks and control: consolidated new findings (EX-01 to EX-12)

Saved by the supervisor from the verification agent's hand-back (2026-11-27). Merges EX1/EX2/EX3 (three graders, 152 example decks, 0.36.0 in Keynote 16.0) and CT-01 (control). Verified in the exported XML for at least two decks each. 0.37.0 = the published packages (`npm-037`, `bin/opf-037`), examples adapted to its renamed keys (`languageFamily` to `scriptGroup`, `cs` to `complexScript`, `speaker.organizationId` to `organization`, `chart.line` to `lineSeries`); copies in `verify/037/`. No minimal deck and no 0.37.0 export was opened in Keynote; nothing was checked in PowerPoint; no improvement was tried as a variant.

| Id | Title | Grade | Whose | Decks / slides | Modes | Sheet | 0.35.1 | 0.37.0 | Where it went |
|---|---|---|---|---|---|---|---|---|---|
| EX-01 | Two-series doughnut drawn as one ring; deck fails re-import | wrong | Keynote reads it differently (+ #1477 importer) | 11 / 11 | default, native | EX-01-doughnut-two-series-one-ring.jpg | not run | file same; import fixed | comment on #1477; improvements |
| EX-02 | Background picture opacity (`alphaModFix`) ignored | wrong 106 / small 34 rows | Keynote (known limit) | 11 / 70 graded (76 by file scan) | both | EX-02-picture-background-alpha.jpg | not run | still | improvements |
| EX-03 | Pattern background alpha ignored | wrong 81 / small 43 rows | Keynote | 11 / 65 graded (81 by scan) | both | EX-03-pattern-background-alpha.jpg | not run | still | improvements |
| EX-04 | Picture bullet drawn at the image's aspect (320x96 logo) | wrong 56 / small 18 rows | Keynote (PowerPoint unknown) | 39 / 39 graded (40 by scan) | both | EX-04-picture-bullet-aspect.jpg | not run | still | improvements |
| EX-05 | Native bullets inherit the layout's `b="1"` | wrong | **OPF** | 1 / 1 (columns 2; scan confirms only this) | native | EX-05-native-bullets-bold.jpg | same file form | still | #1552 |
| EX-06 | Native bulleted list written `algn="ctr"` | wrong | **OPF** | 1 / 1 (slide-design-overrides 2) | native | EX-06-native-list-centered.jpg | same file form | still | #1551 |
| EX-07 | Combo chart category labels below the frame | wrong | Keynote; same cause as #1492 (inferred) | 2 graded, 6 seen or predicted | both | EX-07-combo-labels-below-frame.jpg | not run | still `outer` | comment on #1492; improvements |
| EX-08 | Pull quote runs off the right edge (CT-01) | wrong | font substitution | 1 / 1 (full-feature-tour 5) | default | EX-08-pull-quote-off-right-edge.jpg | fits (seen) | still | improvements |
| EX-09 | Unwrapped card lines leave the card | wrong | font substitution | 1 / 1 (managed-detection-market-update 2) | default | EX-09-card-text-off-slide.jpg | not run | still | improvements |
| EX-10 | `crossBetween between` ignored (area, two-group line) | small | Keynote | 7 / 13 graded (15 by scan) | both | EX-10-cross-between-ignored.jpg | not run | still | improvements |
| EX-11 | Native emphasis color of bold runs lost (written `tx1`) | small | **OPF** | 1 graded; 4 / 4 by scan | native | EX-11-native-leadin-color.jpg | same file form | still | #1553 |
| EX-12 | Named `Roboto SemiBold` face missing, drawn regular | small | font substitution | 1 / 1 (duration-timeline 1) | default | EX-12-semibold-face-regular.jpg | not run | still | improvements |

"Same file form" for 0.35.1: the minimal deck exported with 0.35.1 has the same XML (read); not opened in Keynote.

## Proof

- **EX-05** (read): `columns` native slide 2, bullets in `<p:ph type="body" idx="300"/>` with runs without `b`; the layout `slideLayout40.xml` idx 300 has `<a:lvl1pPr algn="l"><a:defRPr sz="4200" b="1">`; the slide's regular weight is written only in `a:lstStyle/a:defPPr`. Preview regular, Keynote bold (seen). Traced by reading: the vendored writer writes `b` only when true; `native-body.js` `nativeBodyDefaults` (line 446) puts defaults in `defPPr` only; `template-layouts.js:263` makes the layout bold. The minimal deck needs two slides. PowerPoint's use of `defPPr` not checked.
- **EX-06** (read): native `<a:pPr algn="ctr" marL="586740" indent="-586740">` against default `algn="l"`. `native-body.js:389` passes `align: item.alignment ?? 'left'`; the measured path never centers a line with a bullet. Same line in 0.37.0 `dist/native-body.js:396`.
- **EX-11** (read): default writes "First:" with `srgbClr 308BC7`; native writes `schemeClr tx1`. Core colors bold runs of a display text on a dark slide (`composition.ts` `emphasisColor`/`displayEmphasis`); the measured export reads it (`index.js` `richFitLineRuns`); the native export rebuilds runs from `item.runs` (`native-body.js:85`), which have no color. Scan also finds full-feature-tour 2, rich-text-runs 1, root-content 3.
- **EX-01** (read): two `c:ser` in one `c:doughnutChart`; Keynote's `back.pptx` keeps both; the second series' name cache is `<c:f>Sheet1!$A$3</c:f><c:strCache><c:ptCount val="1"/><c:pt idx="1"><c:v>Baseline</c:v></c:pt>`; value caches dense and correct. `opf-036` rejects the deck at `c:ser[1]/c:tx/c:strRef/c:strCache/c:pt[0]@idx`; `opf-037` imports it with a cache warning and keeps both series names (run).
- **EX-02, EX-03** (read): `a:blipFill/a:blip/a:alphaModFix amt="20000"` (design-backgrounds 4: 28000); `a:pattFill prst="wdUpDiag"` with both colors `a:alpha 18000` (design-backgrounds 5: 20000). Keynote draws both at full strength (seen). The 94% gradient backgrounds in 10 decks were not flagged by the graders.
- **EX-04** (read): `a:buBlip` on the 320x96 full logo, `buSzPct 100000`; the decks have no logo icon, so OPF falls back to the full logo, as its docs describe.
- **EX-07** (read): manual `layoutTarget outer`, h 0.8983 of the frame; Keynote writes it back as `inner`; labels below the frame (seen on 4 decks). Same cause as #1492 by inference only.
- **EX-10** (read): standard `areaChart` (Keynote writes back `midCat`) and line charts with a second `lineChart` group; a one-group line chart is not hit.
- **EX-08** (read): `wrap="none"` at 27.6 pt; with `--typefaces safe` Keynote wraps the quote and it fits (seen in the experiment run). **EX-09**: per-line `wrap="none"` boxes; Segoe UI missing. **EX-12**: face `Roboto SemiBold` not installed; Keynote used Helvetica (probe).

## Sheets

Rebuilt under the same name: EX1-02, EX2-04, EX3-01 (captions had the rings the wrong way round; frames off), EX1-07, EX3-05, EX2-02 (frames). New: EX-02. The 12 `EX-NN-*.jpg` are copies of the best sheet per finding.

## Drafts and files

`report/issues/`: `keynote-native-bullets-inherit-layout-bold.md` (#1552), `keynote-native-list-centered.md` (#1551), `keynote-native-emphasis-color-lost.md` (#1553), `keynote-examples-improvements.md` (what OPF could write so Keynote shows the preview; untested), `1477-comment-doughnut.md`, `1492-comment-combo-labels.md` (both posted). Minimal decks `grades/examples/min/EX-05, EX-06, EX-11.opf.json`.
