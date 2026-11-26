---
type: changed
packages: [opf]
---

A gauge's arc now sets the size of its text: the value stands in the arc's bowl at up to 0.42 of the arc's outer radius (the largest size that fits there, an eighth of the radius from the track; a long value shrinks, down to the readability floor), the label, description, change and trend follow it by the metric's own proportions, and the arc takes the largest size its region allows with that text. A gauge alone on a slide draws a large number in a large arc, and gauges side by side keep their values in their bowls instead of large values under small arcs. Only a value that does not fit the bowl at the floor stands under the arc, at up to 0.3 of the radius. The preview and the PowerPoint export draw the sizes composition chooses (`METRIC_GAUGE_VALUE_SIZE`, `METRIC_GAUGE_VALUE_UNDER`). A metric without a gauge draws and exports as before.
