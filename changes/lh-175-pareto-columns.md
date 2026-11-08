---
type: changed
packages: [opf, render, pptx]
---
A Pareto chart of two or more numeric series is drawn as clustered columns of every series in data order (core's new `pareto-as-columns` fallback in `chartDrawPlan`), in the preview and in the PPTX export, in every `chartex` mode. The preview used to draw a Pareto chart of the first series while PowerPoint got clustered columns, and `toPptx(..., {chartex: 'native'})` refused such a chart; it now writes the columns and reports `chart-data-adapted` with `adaptation: 'chart-fallback'`. A Pareto chart of one numeric series is unchanged.
