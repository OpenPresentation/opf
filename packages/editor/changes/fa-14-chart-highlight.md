---
type: added
---
FA-14 (needs the core that ships `chart.highlight`): the chart options panel gains a highlight control, "Highlight series" and "Highlight categories", each a group of checkboxes (a multi-select) listing the chart's plotted series and category labels, offered only where the chart type can highlight them (a pie highlights slices only, an area series only). `setChartOptions(editor, chartPath, { highlight: { series?, categories? } | null })` edits `chart.highlight` as one undoable patch, refuses a name the chart does not have and never writes a part the type cannot highlight; `readChartOptions(chart, document)` returns the `choices` it offers (a dataset-backed chart resolves through the document) and the highlight in its form state.
