# Gallery layouts in Keynote 16.0: grade per layout and export mode (OPF 0.36.0)

Grades are against OPF 0.36.0's own preview of the same slide: same = a reader would not notice; small = noticeable beside the preview (font Helvetica for Aptos, line breaks, footer number only, link color); wrong = something overlaps, is clipped or is missing. Finding ids are in findings.md. A problem already in the preview (tables off the bottom edge, clipped code, double-box hierarchy nodes, footer over the cover picture) is not graded here. "ordinary static" equals ordinary default apart from the footer, which is complete in static: see grades.json.

| # | Layout | ordinary default | ordinary native | little default | little native | lots default | lots native | Note |
|---|---|---|---|---|---|---|---|---|
| 1 | cover | wrong LY-01 | wrong LY-01 | small | small | wrong LY-01 | wrong LY-01 | ordinary/lots: title wraps to 3 lines over the subtitle (LY-01); footer-on-picture is a preview defect |
| 2 | section | small | small | same | same | small | small |  |
| 3 | agenda | small | small | same | same | small | small | ordinary default/native: footer "N" only (known) |
| 4 | statement | small | small | same | same | small | small |  |
| 5 | closing | small | small | small | small | small | small |  |
| 6 | text | small | small | small | small | small LY-02 | small LY-02 | link drawn in blue (known), all decks |
| 7 | list | small | small | same | same | small | small |  |
| 8 | quote | small | small | small | small | wrong LY-02 | wrong LY-02 | lots: quote clipped at the slide edge (known; same in both modes) |
| 9 | two-column | small | small | same | same | small | small |  |
| 10 | three-column | small | small | same | same | wrong LY-01 | wrong LY-01 | lots: title overprints the first boxes |
| 11 | pillars | small | small | same | same | small | small |  |
| 12 | comparison | small | small | same | same | wrong LY-02 | small LY-02 | lots default: columns collide; native re-wraps and holds |
| 13 | process | small | small | same | same | wrong LY-01 | wrong LY-01 | lots: title overprints the five steps |
| 14 | timeline | small | small | same | same | small | small |  |
| 15 | faq | small | small | same | same | small | small |  |
| 16 | pyramid | small LY-04 | small | same LY-04 | same | small | small | ordinary/little: SmartArt becomes a picture (LY-04) |
| 17 | inverted-pyramid | small | small | same | same | small | small |  |
| 18 | matrix | small | small | same LY-04 | same | small | small | little: SmartArt becomes a picture |
| 19 | cycle | small LY-04 | small | same LY-04 | same | small | small | ordinary/little: SmartArt becomes a picture |
| 20 | chevrons | small | small | same LY-04 | same | small | small | little: SmartArt becomes a picture |
| 21 | vertical-process | small | small | same | same | small | small |  |
| 22 | org-chart | small | small | same | same | wrong LY-01 | wrong LY-01 | lots: title overprints the list |
| 23 | hierarchy | small | small | small | small | small | small | ordinary/little: double-box nodes are a preview defect, same in Keynote |
| 24 | venn | small | small | same | same | small | small |  |
| 25 | metrics | small | small | small | small | wrong LY-01 | wrong LY-01 | lots: title overprints the metrics |
| 26 | scorecard | small | small | small | small | wrong LY-01 | wrong LY-01 | lots: title overprints the cards |
| 27 | image | small | small | same | same | small | small |  |
| 28 | image-beside | small | small | same | same | wrong LY-01 | wrong LY-01 | lots: title overprints the text |
| 29 | gallery | small | small | same | same | small | small |  |
| 30 | chart | small | small | small | small | small LY-03 | small LY-03 | lots: tight category labels; little: chart title touches the value label |
| 31 | chart-beside | small | small | small | small | wrong LY-03 | wrong LY-03 | lots: legend spills over the list beside (LY-03) |
| 32 | table | small | small | same | same | small | small | lots: table off the bottom edge (preview defect, same) |
| 33 | table-beside | small | small | same | same | small | small |  |
| 34 | code | small | small | small | small | wrong LY-01 | wrong LY-01 | lots: title clipped by code box; code in Helvetica (known) |
| 35 | hero | small | small | same | same | small | small |  |
| 36 | dashboard | small | small | small | small | wrong LY-03 | wrong LY-03 | lots: legend clipped at the frame (LY-03) |
| 37 | team | small | small | same | same | small | small |  |
| 38 | logos | small | small | same | same | small | small |  |

Totals (wrong / small / same):

- ordinary default: wrong 1, small 37, same 0
- ordinary native: wrong 1, small 37, same 0
- little default: wrong 0, small 11, same 27
- little native: wrong 0, small 11, same 27
- lots default: wrong 12, small 26, same 0
- lots native: wrong 11, small 27, same 0
- ordinary static: wrong 1, small 34, same 3
