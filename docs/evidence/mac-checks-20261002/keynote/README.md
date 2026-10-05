# Keynote checks (RR-17): 20-deck import set and the native-chart bisect

Host: the owner's Mac mini (Apple silicon), Keynote 15.1.1. Runs: 2026-10-04, by the RR supervisor only. The supervisor's
`keynote-one.sh` opened each deck **read-only** through AppleScript, exported it to PDF and to PowerPoint, and closed it
**without saving**, so no `.key` file was ever written. No agent opened or automated Keynote. This folder keeps the inputs'
description, the scripts and the reports. The decks, the PDFs and Keynote's PPTX exports are not committed; rebuild them with
the scripts. This is evidence about Keynote's import on this Mac only. It is not a PowerPoint claim: PowerPoint opened every
chart in the RR-42 native run, and the PowerPoint re-check of the fix goes to OpenPresentation/opf#323.

| Run | Packages | Result |
| --- | --- | --- |
| 20-deck set (`manifest.json`, `compare-report.md`) | `@openpresentation/opf` 0.12.0, `opf-pptx` 0.12.2, `opf-render` 0.12.0 (registry) | PASS 0, WARN 14, FAIL 6, MISSING 0. All 6 FAILs are lost native charts (decks 09, 10, 16, 17, 18, 20); only the two scatter charts (09 slide 7, 19) survive. |
| Chart bisect, 24 one-chart decks (`bisect/`) | the same, plus plain PptxGenJS 4.0.1 and python-pptx 1.0.2 controls | KEPT 7, DROPPED 17. Cause: the embedded workbook's table `ref`. |

## Finding: the embedded workbook's table ref (opf-pptx#162)

PptxGenJS 4.0.1 (vendored by opf-pptx, latest on npm; upstream gitbrent/PptxGenJS#1531) writes `xl/tables/table1.xml` with
`ref="A1:C7'"`, a stray apostrophe, for every category chart (bar, column, line, area, pie, doughnut, radar, and the classic
fallback of chartex charts). Scatter uses another code path and writes a clean ref. Keynote drops a chart whose table ref does
not parse: the slide keeps its title and the chart area is empty in the PDF and absent from the re-exported PPTX.

Each bisect deck changes one thing in a published opf-pptx 0.12.2 deck (`bisect/manifest.json` lists them, and the candidates
that needed no deck and why):

- **KEPT:** fixing the ref alone (column with options b-02, plain column b-16, pie b-21, plain PptxGenJS b-41); removing the
  table part (b-03); the scatter control (b-30); the python-pptx control (b-90).
- **DROPPED:** the opf-pptx bases (b-00, b-01, b-20); plain PptxGenJS (b-40); scatter with the apostrophe added (b-31, the
  reverse test); removing the whole workbook and `c:externalData` (b-04); and every other single change: a third `c:axId`, `c:dLbls`,
  `c:txPr`, `c:roundedCorners`/`c:autoTitleDeleted`/`c:dispBlanksAs`, `c:formatCode`, `c:numFmt`, a c14 style block,
  `c:multiLvlStrRef` against `c:strRef`, a relative chart target, the workbook A1 cell, and `c:dPt`.

Keynote needs the embedded workbook, and the workbook's table ref must be valid. The fix is in OpenPresentation/opf-pptx#163
(`codex/rr-17-keynote-charts`). The exporter sets each embedded table ref (and autoFilter ref and sheet dimension) to the sheet's
used range. For OPF charts only the table ref changes. The vendored PptxGenJS is unchanged. The same broken ref is why Excel
repairs the workbook when a user opens **Edit Data** on these charts.

The verdicts come from `bisect/judge.mjs`, which uses two independent signals per deck: a chart part on slide 1 of Keynote's
PPTX export, and vector drawing beyond the title on page 1 of Keynote's PDF. A dropped chart leaves 2 `constructPath` operators
and no category labels; a kept chart leaves 32 to 86 operators and every label. The two signals agreed on all 24 decks (no MIXED).

## Other findings of the 20-deck run (`compare-report.md`)

These are WARN and INFO findings, recorded and not judged here:

- Keynote substitutes fonts it lacks (Aptos, Meiryo, Mangal, Tenorite, Roboto Mono). Japanese text uses PingFang SC and
  Hiragino Sans in the PDF.
- Keynote's PPTX export drops `lang` tags.
- Complex-script text (Devanagari, Arabic, Hebrew) is present in the PDF, but in visual or shaped order ("reordered").
- Chartex families degrade as expected (Keynote has no chartex types).

`compare.mjs` was fixed before this report. Deck 03 was a false FAIL: Keynote's PDF uses CID fonts, so pdf.js now loads the
predefined CMaps (without them the kana were missing from the text layer). Kangxi radicals (U+2F00 to U+2FD5, which Keynote's
ToUnicode emits for some kanji, such as 入 as U+2F0A) are folded to the unified ideographs; no other text is normalised. Only
deck 03's findings changed (FAIL to WARN, exact text match).

## Files and reproduction

- `lib/decks.mjs` holds the 20 deck sources and `build.mjs` exports them (writes `decks/` and `manifest.json`).
  `keynote-one.sh <id>` is the supervisor's Keynote runner. `compare.mjs` writes `compare-report.*` from the exports in `out/`.
  `lib/inspect-pptx.mjs` reads a PPTX.
- `bisect/build.mjs` writes the bisect decks (`decks/b-*.pptx`, `bisect/manifest.json`); `bisect/python-control.py` writes the
  python-pptx control (venv with python-pptx and XlsxWriter, `PYTHON=<venv>/bin/python`). `bisect/judge.mjs` writes
  `bisect/judge-report.*`.
- To reproduce: copy this folder out of the repository, `npm install` (versions in `package.json`), `node build.mjs`, and
  `node bisect/build.mjs`. Then run `for f in decks/*.pptx; do ./keynote-one.sh $(basename $f .pptx); done` on a Mac with
  Keynote, followed by `node compare.mjs` and `node bisect/judge.mjs`. `lib/decks.mjs` reads `examples/gallery` from this
  checkout; set `OPF_GALLERY` when the folder is copied elsewhere.
