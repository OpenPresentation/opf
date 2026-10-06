# Offline results

Produced by `offline-check.mjs` (structure) and `make-expect.mjs` (semantics): unzip of every deck, no PowerPoint involved. Chart-part child order uses FA-15's `test/helpers/chart-schema-order.mjs` (bar and line charts, series, axes, legend, dLbls, marker, scaling) plus a supplemental walker for `c:dPt`, `c:pieChart`/`c:doughnutChart` and pie series. Chartex parts (the FA-09 waterfall) have no schema-order helper, so only well-formedness is checked there.

## Findings

- **FA-09: slide 5 (pre-existing extLst + decorative): a single a:extLst in the cNvPr.** 2 a:extLst elements in the cNvPr (schema allows 1)

- FA-11 (observation, not a failure): the current-event ring is 1.49x the dot (255270 / 171450 EMU), not 1.6x. It is 1.675x the 12 pt done/planned marker.

## Structure and chart order per deck

## fa-05-color-roles.pptx

| Check | Result | Detail |
| --- | --- | --- |
| XML parts well-formed | ok | 36 parts |
| relationship targets exist | ok | all internal targets present |
| content types cover every part | ok | 24 overrides, 11 defaults |
| at most one a:extLst per p:cNvPr | ok | ok |
| unique shape ids per slide (informational) | ok | ok |

## fa-09-chart-alt.pptx

| Check | Result | Detail |
| --- | --- | --- |
| XML parts well-formed | ok | 62 parts |
| relationship targets exist | ok | all internal targets present |
| content types cover every part | ok | 40 overrides, 11 defaults |
| at most one a:extLst per p:cNvPr | **PROBLEM** | ppt/slides/slide5.xml: 2 a:extLst in one p:cNvPr (OPF chart 5) |
| unique shape ids per slide (informational) | ok | ok |
| ppt/charts/chart1.xml child order (dml-chart.xsd) | ok | in schema order |
| ppt/charts/chart2.xml child order (dml-chart.xsd) | ok | in schema order |
| ppt/charts/chart3.xml child order (dml-chart.xsd) | ok | in schema order |
| ppt/charts/chart4.xml child order (dml-chart.xsd) | ok | in schema order |
| ppt/charts/chart5.xml child order (dml-chart.xsd) | ok | in schema order |
| ppt/charts/chartEx1.xml child order | n/a | not covered: no chartex schema-order helper exists (well-formedness only) |

## fa-11-timeline-status.pptx

| Check | Result | Detail |
| --- | --- | --- |
| XML parts well-formed | ok | 80 parts |
| relationship targets exist | ok | all internal targets present |
| content types cover every part | ok | 70 overrides, 11 defaults |
| at most one a:extLst per p:cNvPr | ok | ok |
| unique shape ids per slide (informational) | ok | ok |

## fa-12-quote-photo.pptx

| Check | Result | Detail |
| --- | --- | --- |
| XML parts well-formed | ok | 38 parts |
| relationship targets exist | ok | all internal targets present |
| content types cover every part | ok | 30 overrides, 11 defaults |
| at most one a:extLst per p:cNvPr | ok | ok |
| unique shape ids per slide (informational) | ok | ok |

## fa-13-conveniences.pptx

| Check | Result | Detail |
| --- | --- | --- |
| XML parts well-formed | ok | 50 parts |
| relationship targets exist | ok | all internal targets present |
| content types cover every part | ok | 38 overrides, 11 defaults |
| at most one a:extLst per p:cNvPr | ok | ok |
| unique shape ids per slide (informational) | ok | ok |

## fa-13-preset-1x1.pptx

| Check | Result | Detail |
| --- | --- | --- |
| XML parts well-formed | ok | 25 parts |
| relationship targets exist | ok | all internal targets present |
| content types cover every part | ok | 17 overrides, 11 defaults |
| at most one a:extLst per p:cNvPr | ok | ok |
| unique shape ids per slide (informational) | ok | ok |

## fa-13-preset-4x5.pptx

| Check | Result | Detail |
| --- | --- | --- |
| XML parts well-formed | ok | 25 parts |
| relationship targets exist | ok | all internal targets present |
| content types cover every part | ok | 17 overrides, 11 defaults |
| at most one a:extLst per p:cNvPr | ok | ok |
| unique shape ids per slide (informational) | ok | ok |

## fa-13-preset-9x16.pptx

| Check | Result | Detail |
| --- | --- | --- |
| XML parts well-formed | ok | 25 parts |
| relationship targets exist | ok | all internal targets present |
| content types cover every part | ok | 17 overrides, 11 defaults |
| at most one a:extLst per p:cNvPr | ok | ok |
| unique shape ids per slide (informational) | ok | ok |

## fa-14-chart-highlight.pptx

| Check | Result | Detail |
| --- | --- | --- |
| XML parts well-formed | ok | 54 parts |
| relationship targets exist | ok | all internal targets present |
| content types cover every part | ok | 36 overrides, 11 defaults |
| at most one a:extLst per p:cNvPr | ok | ok |
| unique shape ids per slide (informational) | ok | ok |
| ppt/charts/chart1.xml child order (dml-chart.xsd) | ok | in schema order |
| ppt/charts/chart2.xml child order (dml-chart.xsd) | ok | in schema order |
| ppt/charts/chart3.xml child order (dml-chart.xsd) | ok | in schema order |
| ppt/charts/chart4.xml child order (dml-chart.xsd) | ok | in schema order |

## fa-15-combo-chart.pptx

| Check | Result | Detail |
| --- | --- | --- |
| XML parts well-formed | ok | 27 parts |
| relationship targets exist | ok | all internal targets present |
| content types cover every part | ok | 18 overrides, 11 defaults |
| at most one a:extLst per p:cNvPr | ok | ok |
| unique shape ids per slide (informational) | ok | ok |
| ppt/charts/chart1.xml child order (dml-chart.xsd) | ok | in schema order |



## Semantic checks on the exported OOXML

| Item | Check | Result | Detail |
| --- | --- | --- | --- |
| FA-05 | link run is written as schemeClr hlink, underlined | ok | solidFill schemeClr hlink; hlinkClick present |
| FA-05 | theme hlink is AA3311 | ok | AA3311 |
| FA-05 | text on #FF0000 is dark | ok | body 000000 luminance 0.000 |
| FA-05 | ColorRef accent is accent3 (not accent1) | ok | run "ref-accent" -> accent3 5499C7 |
| FA-09 | slide 1 frame descr equals alt | ok | Revenue grew from 10 in Q1 to 20 in Q2 and fell to 15 in Q3. |
| FA-09 | slide 2 frame descr equals alt | ok | Waterfall from 10 up 20 down 8 to 22. |
| FA-09 | slide 4 frame descr equals alt | ok | Chart whose frame already had an extLst. |
| FA-09 | slide 3 decorative marker, no descr | ok | adec:decorative val=1 |
| FA-09 | slide 5 (pre-existing extLst + decorative): a single a:extLst in the cNvPr | **PROBLEM** | 2 a:extLst elements in the cNvPr (schema allows 1) |
| FA-09 | slide 4 (pre-existing extLst + alt text): valid | ok | one extLst, descr attribute added |
| FA-11 | slide 1 current event has ring + marker, both ellipse | ok | ring/marker ellipse; ring 255270 EMU, marker 171450 EMU |
| FA-11 | slide 1 ring/marker diameter ratio about 1.6 (1.4-1.8) | ok | ratio 1.489 (note: 1.6 is not exact; the ring is 1.675x the 12 pt planned/done diameter 152400 EMU) |
| FA-11 | slide 1 planned markers: ellipse, solid fill = slide background FFFFFF, visible line | ok | planned events 3,4 |
| FA-11 | slide 1 current label bold | ok | Rollout |
| FA-11 | slide 2 current event has ring + marker, both ellipse | ok | ring/marker ellipse; ring 255270 EMU, marker 171450 EMU |
| FA-11 | slide 2 ring/marker diameter ratio about 1.6 (1.4-1.8) | ok | ratio 1.489 (note: 1.6 is not exact; the ring is 1.675x the 12 pt planned/done diameter 152400 EMU) |
| FA-11 | slide 2 planned markers: ellipse, solid fill = slide background 10151C, visible line | ok | planned events 3,4 |
| FA-11 | slide 2 current label bold | ok | Rollout |
| FA-12 | slide 1 ellipse geometry | ok | prst="ellipse" |
| FA-12 | slide 1 descr equals photo alt | ok | Priya Raman at her desk |
| FA-12 | slide 1 cropped, not distorted: the cropped region is square like the frame | ok | srcRect l/r/t/b = 0.00%/0.00%/16.67%/16.67%; visible aspect 1.000 |
| FA-12 | slide 2 ellipse geometry | ok | prst="ellipse" |
| FA-12 | slide 2 descr equals photo alt | ok | Dana Okafor at her desk |
| FA-12 | slide 2 cropped, not distorted: the cropped region is square like the frame | ok | srcRect l/r/t/b = 16.67%/16.67%/0.00%/0.00%; visible aspect 1.000 |
| FA-13 | preset 1x1 slide size 540 x 540 pt | ok | <p:sldSz cx="6858000" cy="6858000"/> |
| FA-13 | preset 4x5 slide size 540 x 675 pt | ok | <p:sldSz cx="6858000" cy="8572500"/> |
| FA-13 | preset 9x16 slide size 540 x 960 pt | ok | <p:sldSz cx="6858000" cy="12192000"/> |
| FA-13 | watermark rot=19800000 (330 degrees = -30), alpha 15000 | ok | rot and alpha present |
| FA-13 | watermark is the first shape (behind content) | ok | , OPF watermark text, OPF heading slides.1.title line 0 |
| FA-13 | bands are rectangles between the panel and the line text boxes | ok | panel@3, bands@4,5, first line@7 |
| FA-13 | per-run lang is written (fr-FR, ja-JP) and the default run keeps en-US | ok | DRAFT: lang=en-US \| Per-run language: lang=en-US \| Default English.: lang=en-US \| Bonjour le monde.: lang=fr-FR altLang=en-US \| こんにちは: lang=ja-JP altLang=en-US |
| FA-14 | series highlight: series 1 schemeClr accent1, series 2 muted srgb, no dPt | ok | ["<a:schemeClr val=\"accent1\"/>","<a:srgbClr val=\"4D5D7B\"/>"] |
| FA-14 | category highlight: dPt idx 1 accent1 in each series, series muted | ok | [{"series":"<a:srgbClr val=\"4D5D7B\"/>","points":[{"idx":1,"fill":"<a:schemeClr val=\"accent1\"/>"}]},{"series":"<a:srgbClr val=\"4D5D7B\"/>","points":[{"idx":1,"fill":"<a:schemeClr val=\"accent1\"/>"}]}] |
| FA-14 | pie: dPt idx 1 accent1, idx 0 and 2 muted | ok | [{"idx":0,"fill":"<a:srgbClr val=\"4D5D7B\"/>"},{"idx":1,"fill":"<a:schemeClr val=\"accent1\"/>"},{"idx":2,"fill":"<a:srgbClr val=\"4D5D7B\"/>"}] |
| FA-14 | line: dPt idx 2 present for each series | ok | [{"series":"<a:srgbClr val=\"4D5D7B\"/>","points":[{"idx":2,"fill":"<a:schemeClr val=\"accent1\"/>"}]},{"series":"<a:srgbClr val=\"4D5D7B\"/>","points":[{"idx":2,"fill":"<a:schemeClr val=\"accent1\"/>"}]}] |
| FA-15 | barChart barDir=col grouping=clustered with series 1 | ok | barChart |
| FA-15 | lineChart with markers holds series 2 | ok | lineCharts=1 |
| FA-15 | secondary valAx axPos=r with numFmt 0% | ok | <c:numFmt formatCode="0%" sourceLinked="0"/> |
| FA-15 | line group uses a second axis pair | ok | two valAx ids |
