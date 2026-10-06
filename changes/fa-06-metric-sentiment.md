---
type: added
packages: [opf]
---
FA-06: `Metric.sentiment` (`positive`, `negative`, `neutral`) says whether a change is good news. The trend arrow keeps the direction of `trend`; its colour, and the trend and delta text colour, follow the sentiment (positive green, negative red, neutral the neutral text colour, each at 4.5:1 or more). Absent, the colour follows the trend as before (up positive, down negative, flat neutral), so existing decks render unchanged; without a `trend` the sentiment has no visible effect. `layoutMetric` accepts it and passes it through as `MetricLayout.sentiment` for `metricTrendMark` (new `MetricTrendColorOptions.sentiment` and `MetricTrendMark.sentiment`); the Markdown `metric` fence reads and writes a `sentiment` line and metric tables convert a `Sentiment` column.
