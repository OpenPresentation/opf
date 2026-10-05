# Keynote chart bisect: verdicts

Decks built with @openpresentation/opf 0.12.0, @openpresentation/opf-pptx 0.12.2. KEPT 7, DROPPED 17, MIXED 0, MISSING 0.

| Deck | Role | Verdict | Keynote PPTX chart parts | PDF paths | PDF labels | Change |
|---|---|---|---|---|---|---|
| b-00-column-base | base | DROPPED | none | 2 | 0/6 | none: opf-pptx column chart exactly as deck 09 slide 1 (axis titles, legend bottom, data labels) |
| b-01-column-plain | base | DROPPED | none | 2 | 0/6 | none: opf-pptx column chart without options (as deck 16) |
| b-02-table-ref-fixed | variant | KEPT | native:bar:col:clustered | 86 | 6/6 | embedded workbook xl/tables/table1.xml: ref="A1:C7'" -> ref="A1:C7" (PptxGenJS 4.0.1 writes a stray apostrophe for category charts; the surviving scatter charts have a clean ref) |
| b-03-no-table-part | variant | KEPT | native:bar:col:clustered | 86 | 6/6 | embedded workbook: table part, its sheet relationship and content-type override removed |
| b-04-no-external-data | variant | DROPPED | none | 2 | 0/6 | c:externalData removed, with the chart relationship file, the embedded workbook part and the xlsx Default content type |
| b-05-two-axids | variant | DROPPED | none | 2 | 0/6 | c:barChart keeps 2 c:axId (PptxGenJS writes a third, series-axis id, which the 2-D schema does not allow) |
| b-06-no-dlbls | variant | DROPPED | none | 2 | 0/6 | every c:dLbls removed (series and chart-group data labels) |
| b-07-no-txpr | variant | DROPPED | none | 2 | 0/6 | every c:txPr removed; axis-title rich text keeps the text with empty run properties |
| b-08-no-chart-flags | variant | DROPPED | none | 2 | 0/6 | c:roundedCorners, c:autoTitleDeleted and c:dispBlanksAs removed |
| b-09-no-numcache-formatcode | variant | DROPPED | none | 2 | 0/6 | c:formatCode removed from every c:numCache |
| b-10-no-numfmt | variant | DROPPED | none | 2 | 0/6 | every c:numFmt removed (axes and data labels) |
| b-11-add-c14-style | variant | DROPPED | none | 2 | 0/6 | adds the mc:AlternateContent c14:style 102 / c:style 2 block PowerPoint writes (opf-pptx writes none) |
| b-12-cat-strref | variant | DROPPED | none | 2 | 0/6 | c:cat c:multiLvlStrRef (one level) -> c:strRef with c:strCache |
| b-13-rel-target-relative | variant | DROPPED | none | 2 | 0/6 | slide relationship Target /ppt/charts/chart1.xml (absolute) -> ../charts/chart1.xml |
| b-15-workbook-a1-shared | variant | DROPPED | none | 2 | 0/6 | embedded sheet A1 (opf-pptx's inlineStr category heading) -> PptxGenJS's shared string 0 |
| b-16-column-plain-table-ref-fixed | variant | KEPT | native:bar:col:clustered | 60 | 6/6 | b-01 plus the table ref fix of b-02 |
| b-20-pie-base | base | DROPPED | none | 2 | 0/4 | none: opf-pptx pie chart as deck 09 slide 4 |
| b-21-pie-table-ref-fixed | variant | KEPT | native:pie | 32 | 4/4 | pie: table ref stray apostrophe removed |
| b-22-pie-no-dpt | variant | DROPPED | none | 2 | 0/4 | pie: every c:dPt removed |
| b-30-scatter-base | control | KEPT | native:scatter | 50 | 4/5 | none: opf-pptx scatter chart (survived in deck 09; positive control) |
| b-31-scatter-table-ref-broken | variant | DROPPED | none | 2 | 0/5 | scatter: stray apostrophe ADDED to the table ref (ref="A1:B6'"): the reverse test |
| b-40-pptxgenjs-plain-column | control | DROPPED | none | 2 | 0/6 | none: minimal column chart written by plain PptxGenJS 4.0.1 (the vendored copy), no opf-pptx code |
| b-41-pptxgenjs-plain-table-ref-fixed | control | KEPT | native:bar:col:clustered | 56 | 6/6 | b-40 plus the table ref fix of b-02 |
| b-90-python-pptx-column | control | KEPT | native:bar:col:clustered | 56 | 6/6 | none: the same clustered column chart written by python-pptx (independent generator) |
