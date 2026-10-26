---
type: changed
packages: [opf, render, pptx]
---
WI-5 (P18, owner decision D3, output-changing on dark backgrounds): a metric value and series 1 of a chart, drawn from the scheme on a dark surface, reach 4.5:1 contrast (the default blue `#2874A6` on the default navy `#011842` was 3.42:1; it is now lifted in lightness, keeping its hue, with the existing `legible` helper). The palette, light surfaces and explicit colors (`chart.colors`, a host palette) are unchanged. New on `/composition`: `metricValueColor`, `METRIC_VALUE_MIN_CONTRAST`, `chartLeadFromScheme`, `CHART_LEAD_MIN_CONTRAST` and the `legibleLead` option of `chartPaletteForFill`; the preview and the PPTX export call them with the same inputs, and the colorblind-safe palette rule reads the lifted palette.
