---
type: changed
packages: [opf, render, pptx]
native: [coverage-charts#1, coverage-charts#3]
---

Band labels have a second place before the legend: when a chart's band labels do not all fit inside their bands, they stand beside the plot, in the secondary text color, a column, line or area chart's in a gutter past the plot's end (the left right to left), each centered on its band, a bar or bullet chart's in a row above the plot, each centered over its strip; the plot gets narrower or shorter by that room. Composition decides it once (`placeBandLabelsBeside`, `BAND_LABEL_BESIDE_LIMIT`) and the PowerPoint export writes the same data labels outside the plot area, where PowerPoint keeps them. The legend remains the fallback when another part of the chart uses that side, two labels would overlap, a strip's label is wider than its strip, or the gutter would take more than 22% of the chart's width (the row 12% of its height). A stacked chart's series names beside the last column now start past the plot's end, so bands and gridlines end before them; this changes the drawing and the export of stacked column and area charts that name their series.
