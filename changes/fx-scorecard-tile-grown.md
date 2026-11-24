---
type: fixed
packages: [opf]
---
Scorecard tiles (`metrics: "tile"`, LH-68) no longer leave an empty middle under a figure set at the top (SCO-1). The figure grows into the tile (`METRIC_TILE_VALUE_SHARE` is 0.4 of the tile, up to three times its role size) and stands in the middle of the room between the label and the foot. The tiles of a row share one foot, the tallest of their targets (`MetricLayoutOptions.tileFoot`), so their figures stand on one line however long each target is; a text among tiles keeps its card. Under LH-48's centering a band of tiles keeps its cells, so a figure never takes its size from a shrunken cell.
A figure with a unit beside it grows only as far as its unit, at LH-53's share of the figure (`METRIC_UNIT_SHARE`), still fits beside it on its line, so a grown figure never sets its unit smaller ("6.2 min": the figure grows from 113 to 134 px and its unit from 68 to 80 px).
