---
type: fixed
packages: [editor]
---
LH-100: the chart options panel shows "Data labels" checked on a small chart (LH-03) whose value labels core draws by default, and unchecked when it draws none; switching them off writes `dataLabels: false`, on again `true`. `readChartOptions(chart, presentation, { layer })` and `prepareChartOptions(..., { layer })` read the chart layer core composed (`item.chart.layer`), `setChartOptions` takes it as `meta.layer`, and without one they read core's small-chart rule on the data; `fields.dataLabels.defaultOn` is true for such a chart. The panel takes an optional `getGeometry(slideIndex)` (the Studio passes the slide as the canvas drew it) and otherwise composes the slide through the session.
