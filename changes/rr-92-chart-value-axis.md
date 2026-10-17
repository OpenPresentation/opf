---
type: added
packages: [opf]
---
RR-92: composition computes the value axis of column, bar, line and area charts (`min`, `max`, `majorUnit`; a fraction with `percent: true` for 100% stacked) from the chart box and the chart text size, and exposes it as `chart.valueAxis` on the composed chart item, so the preview and the PPTX export can draw and write one axis (PowerPoint and Keynote no longer choose their own major unit). `niceScale`, `maxIntervalsFor`, `stackCategoryValues`, `chartValueAxis` and `CHART_TEXT_PX` move into core (`@openpresentation/opf/composition`) from opf-render, with identical results. RR-90 (chart text): `CHART_TEXT_PX` is 20 px (15 pt) instead of 14, and `chartTextSize({ width, height, scale, minFontSize })` gives the chart text size for a box (at most 1/18 of the box height and 1/30 of its width, whole pixels, never below `minFontSize`); the axis density follows it, and the preview draws the same size.
