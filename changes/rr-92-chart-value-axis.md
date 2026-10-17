---
type: added
packages: [opf]
---
RR-92: composition computes the value axis of column, bar, line and area charts (`min`, `max`, `majorUnit`; a fraction with `percent: true` for 100% stacked) from the chart box and the chart text size, and exposes it as `chart.valueAxis` on the composed chart item, so the preview and the PPTX export can draw and write one axis (PowerPoint and Keynote no longer choose their own major unit). `niceScale`, `maxIntervalsFor`, `stackCategoryValues`, `chartValueAxis` and `CHART_TEXT_PX` move into core (`@openpresentation/opf/composition`) from opf-render, with identical results.
