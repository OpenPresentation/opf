---
type: added
---
FA-06: the preview draws `metric.sentiment`: the trend arrow keeps the direction of `trend` and the arrow, the trend word and the delta text take the green, red or neutral colour of the sentiment (positive, negative, neutral). Without a `sentiment` the colours are unchanged (up green, down red, flat neutral). No renderer code changed: core `metricTrendMark` carries the sentiment; this adds the preview tests.
