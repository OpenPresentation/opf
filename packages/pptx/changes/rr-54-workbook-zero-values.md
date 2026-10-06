---
type: fixed
---
RR-54 (opf-pptx#172; output-changing only for charts with a value of 0 or a scatter X gap): the embedded chart workbook holds every value the chart shows. A value of 0 (or -0) was an empty cell in the workbook of column, bar, line, area, pie, doughnut and radar charts (PptxGenJS 4.0.1 wrote `values[idx] || ''`), so PowerPoint's Edit Data showed a blank where the chart showed 0 and a refresh from the workbook turned it into a gap; pptxgenjs-plus 4.3.4 keeps it. A scatter X gap is now a blank cell instead of the numeric cell `<v>null</v>` (upstream lofcz/pptxgenjs-plus#16).
