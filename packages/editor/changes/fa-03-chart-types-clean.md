---
type: changed
---
FA-03 (needs the core release with the clean chart-type catalog): the chart-type picker follows the clean catalog. A chart type's picker label is its record `name` (`Stacked Column`; the `label` field is gone), and the eight stacked chart types lose their `-3x` suffix. `compatibleChartTypes` offers a stacked or percent-stacked type for chart data with that many value columns or more (`series` is now the minimum for those types: two), where it used to need exactly three, which the retired `-2x` aliases worked around for two series; every other type keeps its exact series rule. The deprecated aliases are no longer in the picker.
