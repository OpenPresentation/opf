# Control: Keynote 16.0 with the 0.35.1 exports against the 0.36.0 exports (qualification corpus)

Saved by the supervisor from the grader's hand-back (2026-11-27). Data: `compare.json`; scripts `work/control_compare.py`, `work/pairs.py`; looking sheets `work/sheets/`. 67 of 67 decks in both versions (every 0.35.1 file exists and opened); 594 slides, 591 picture pairs (3 hidden). Slide part identical on 426 slides; slide plus everything it references identical on 331; on 330 of those the two Keynote pictures match (exception: coverage-overlays 4, below). Of 263 non-identical slides, 183 have differing pictures. Every differing pair (161 rows) and the 20 finding-named slides were read as 0.35.1 Keynote | 0.36.0 Keynote | 0.36.0 preview.

Result: 19 of the 20 QC, QS and QT findings were already there with 0.35.1. Only QS-09 is new in 0.36.0; QC-01 is not decided. Most 0.35.1-to-0.36.0 changes in Keynote are improvements; four slides got worse (three existing findings, one new: CT-01).

## Decision per finding (seen in both Keynote pictures unless noted)

| Id | Decision | Basis |
|---|---|---|
| QC-01 | not decided: no 0.35.1 `back.pptx` (that run did not export to PowerPoint). Inferred: the slide 13 trigger is older (chart25's cache identical in the 0.35.1 export), the slide 16 trigger is new (chart28 rewritten for the M13 highlight) | XML |
| QC-02 | also in 0.35.1 | explicit 2, 3; coverage-charts 14; singleton 1; chart-type-sampler 1: pictures identical |
| QC-03 | also in 0.35.1 | compliance 8 footer missing in both |
| QC-04 | also in 0.35.1 | compliance 10 reads "9", full-feature-tour 11 reads "10" in both |
| QC-05, QC-06, QC-07, QC-08, QC-09, QC-10 | also in 0.35.1 | pictures identical or same reading |
| QS-01 | also in 0.35.1 on the Keynote side (probe object counts identical); glue in `back.pptx` not decided | probes |
| QS-02 to QS-08 | also in 0.35.1 | same `prstGeom`, only offsets differ; pictures same at sheet scale (QS-03, 04, 05, 07 not zoomed) |
| QS-09 | **new in 0.36.0** | 0.35.1 wrote live SmartArt on smartart 7 and 11; 0.36.0 writes native shapes (M42): the manifest is stale since 0.36.0 |
| QT-01 | also in 0.35.1 | `buFont Aptos` in both; 0.35.1 `buSzPts 2775`, 0.36.0 `4200` (list text grew, M07) |

## 0.36.0 against 0.35.1 in Keynote (M-ids inferred from what changed; the XML diff confirms only the chart plot layout, offsets and QS-09)

Better (closer to the 0.36.0 preview):
- M66 plot area under a chart heading: coverage-charts 9, 12, 13, 18; coverage-design 12, 16-21; coverage-images 16; coverage-overlays 3; slide 2 of all nine coverage-size decks; full-feature-tour 3, 4 (0.35.1 printed the category labels over the footer); layout-sampler 22, 23, 28, 39, 40, 41, 48 (0.35.1 cut the value-axis title at the slide's left edge).
- M71: coverage-charts 15 (0.35.1 cut the category names: "ranes", "tware"; whole now).
- M48 timelines: compliance 5, coverage-composition 8, coverage-languages 8, 9, coverage-warnings 3, duration-timeline 1, localized-timeline 1, layout-sampler 15.
- M05, M06, M07 lists: coverage-lists 1, 4, 5, 6, 12, 13; coverage-composition 9; coverage-images 6; coverage-languages 4, 5; coverage-metadata 3; coverage-variables 2; multilingual-slides 2; slide 3 of every coverage-size deck; layout-sampler 4.
- M09 layout-sampler 9; M10, M23, M36 layout-sampler 20, 23, coverage-languages 2; M21, M22, M29 coverage-regions 16-18, 21-23, coverage-composition 3, coverage-shape-presets 1, 4, 5, 6, 8, 9, 11, 12, 13, coverage-shape-styles 3, 4; M24 coverage-design 15; M28, M53 layout-sampler 10, 11; M31 layout-sampler 6, coverage-furniture 1, compliance 1, full-feature-tour 1; M33 layout-sampler 19, image-callouts 1.
- M41 diagrams: coverage-diagrams 1, 2; diagram-connectors 1, 2; diagrams 6, 7 (and ~picture); diagrams-markdown 1-3; dot-diagrams 4, 5; plantuml-diagrams 6; coverage-composition 6.
- M42 chevrons and process as native shapes: coverage-diagrams 11; layout-sampler 34, 35; smartart 7, 8, 11. M43 smartart 4, 14. M44 coverage-diagrams 17 (0.35.1: a bulleted list in Keynote; now an org chart), layout-sampler 51, trees-and-sets 2. M45 coverage-diagrams 13, 14; inverted-pyramids 1, 2; layout-sampler 49; smartart 2, 13; smartart-arabic 1.
- M51, M55 coverage-design 20, 21, layout-sampler 48; M52 layout-sampler 26, table-and-code 2; M54, M59 compliance 7, layout-sampler 18; M57, M75 layout-sampler 29, layout-harvest 16; M65 coverage-furniture 4 (footer links no longer hyperlink blue).

Worse:
- layout-sampler 25 (default, native): the table grew and its headers now break mid-word: SW-01/MX-08, new in 0.36.0 (the 0.35.1 table was small and whole).
- full-feature-tour 8: the timeline grew (M48) and "General availability" touches "Retire legacy tier": LY-02, new in 0.36.0.
- coverage-charts 16: half-width bars, legend "Wait Wait": MX-03 (M13). The 0.35.1 legend "North South East" was also wrong against the preview.
- full-feature-tour 5: CT-01.

Same to a reader: chart-point-overlays 3, coverage-charts 6, 8, coverage-composition 5, coverage-design 14, coverage-overlays 6, layout-sampler 12, 17, 38, native-body 36, 42.

Different, not caused by OPF: coverage-overlays 4. The parts are byte-identical between the two files and the probes report the same line geometry, yet Keynote drew the two dashed elbow connectors on different routes in the two runs. Keynote's elbow routing varies between opens: "identical parts mean identical in Keynote" does not hold for elbow connectors.

## New finding

**CT-01 (wrong, new in 0.36.0): full-feature-tour slide 5, the pull quote runs past the slide's right edge in Keynote and the closing quote mark is cut.** 0.35.1: the box is `wrap="none"` at 24 pt and fits. 0.36.0: the same box is 27.6 pt (`sz="2760"`); in Helvetica the line is wider than the slide. The preview's line ends inside the slide. Inferred cause: a grown single-line `wrap="none"` box plus the wider substitute font (LG-01 mechanism). Sheet `CT-01-pull-quote-runs-off-right-edge.jpg`.

## Right-to-left table (LG-02)

Not decided: no 0.35.1 right-to-left table was opened in Keynote. The only 0.35.1 file with one is `build/0351/languages/lang-rtl/default.pptx` (slides 1, 2). Inferred, not seen: placed the same way (same `a:off`, same width 5433060, `<a:tblPr rtl="1" firstRow="1"/>`; only height and column widths differ).

## Not looked at

Round-trip parts for 0.35.1 (no `back.pptx`); zoomed shape details of QS-03, 04, 05, 07; the 79 non-identical slides whose pictures compare pixel-equal (except finding-named ones); the 22 duplicate native/shapes pairs; main.
