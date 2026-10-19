---
type: changed
---
RR-92 (no pixel change for the usual chart): a column, bar, line or area chart draws the value axis core composes for its box (`item.chart.valueAxis`: `min`, `max`, `majorUnit`), the same axis the PPTX export writes, so the preview and PowerPoint or Keynote show the same gridlines. In a short box core estimates the plot from the box rather than from the laid-out plot, so the major unit can differ by one 1/2/5 step from before; every other chart type keeps its renderer-side scale. The renderer's local `niceScale`, `maxIntervalsFor` and `stackCategoryValues` are replaced by core's. Needs `@openpresentation/opf` 0.22.0.
