---
type: added
---
FA-06: the export colours the native trend arrow, the trend word and the delta text by `metric.sentiment` (positive green, negative red, neutral the neutral text colour) while the arrow keeps the direction of `trend`, matching the preview. Import restores `sentiment` from the OPF_METRIC_V1 provenance tag with the rest of the metric source. Without a `sentiment` the colours are unchanged. No exporter code changed: core `metricTrendMark` carries the sentiment; this adds the export and round-trip tests.
