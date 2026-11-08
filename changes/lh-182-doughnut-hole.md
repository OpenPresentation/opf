---
type: fixed
packages: [opf, render, pptx]
---
A doughnut's hole takes the surface the chart stands on, so a deck watermark or a background motif no longer shows through it. Core composes the doughnut's square and hole (`layer.doughnut`, `chartDoughnut`; the value list's square when there is one); the preview draws the doughnut there and fills the hole, and the PPTX export pins the plot area to the square (inner manual layout) and lays a surface-colored ellipse under the chart frame at the hole (an `OPF_CHART_MARK_V1` shape that import consumes). A doughnut with chart options (`legend`, `axisTitles`, `dataLabels`) keeps an open hole.
