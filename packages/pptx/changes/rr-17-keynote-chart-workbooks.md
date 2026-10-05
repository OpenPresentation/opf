---
type: fixed
---
RR-17 (opf-pptx#162): Keynote imports native charts again. PptxGenJS 4.0.1 writes an invalid table range into the embedded chart workbook of every category chart (bar, column, line, area, pie, doughnut, radar, and the classic fallback of chartex charts): `ref="A1:C7'"`, with a stray apostrophe (upstream gitbrent/PptxGenJS#1531). Keynote 15.1.1 dropped every such chart on import (only scatter charts survived), and Excel had to repair the workbook when the chart data was opened. The export now sets each embedded table (and autoFilter) ref, and the sheet dimension, to the cell range the sheet holds; for OPF charts only the table ref changes (the apostrophe goes). The chart XML and every other part are byte-identical; the vendored PptxGenJS is unchanged.
