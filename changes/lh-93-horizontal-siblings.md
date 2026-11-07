---
type: changed
packages: [opf, render, pptx]
---
Horizontal bar charts of one unit on one slide (siblings that already share a value axis) share one plot as well: side by side they share the plot top and height, one above another they start the plot at the same x, and all take the set's narrowest plot width, so one value is one bar length on every chart. Core lays each plot out as the preview does (`horizontalBarPlot`) and `shareSiblingPlots` writes the shared plot to `layer.plot`; the preview draws it and the PPTX export pins it (inner manual layout). A horizontal chart with chart options, with stacked segment values or names above its plot, or drawn on a table's rows keeps its own plot.
