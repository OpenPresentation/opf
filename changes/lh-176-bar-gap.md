---
type: fixed
packages: [opf, render, pptx]
---
Clustered column and bar charts of two or more series draw their bars as PowerPoint does: the 150% gap width is a share of one bar, so each bar is `band / (series + 1.5)` wide (core `chartBarGeometry` and `CHART_BAR_GAP_WIDTH`, which the preview draws and the PPTX export writes as `c:gapWidth` and `c:overlap`). The preview drew such bars about a third thinner than PowerPoint. A small chart's value labels are fitted against the same bar slot, so some two-series bar charts now label their bars instead of drawing a value axis, in both engines. The render package's `barGeometry` export is removed; use core's `chartBarGeometry`.
