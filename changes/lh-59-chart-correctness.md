---
type: fixed
packages: [opf, render, pptx]
---
LH-59 (output-changing for bar, waterfall and short-axis charts): charts read the way readers expect, and the preview and PowerPoint agree.
    - Horizontal bar charts (`bar`, `stacked-bar`, `100pct-stacked-bar`) list their categories top to bottom in data order, the first series at the top of each cluster. The PPTX export writes PowerPoint's reversed category axis (`c:orientation val="maxMin"`) with the value axis crossing at the last category (`c:crosses val="max"`), so the value labels stay at the bottom.
    - A waterfall's last value that equals the running sum of two or more steps before it is a total: it stands on zero in the third palette color instead of floating on the running total. Core's new `waterfallSteps(values)` (on `/composition`) infers it, the preview draws it and the native PPTX waterfall writes it as `cx:subtotals`.
    - The value axis ends near the data: core's `niceScale` keeps the maximum within 1.25 x the data maximum (`CHART_AXIS_MAX_OVERSHOOT`), so a short axis no longer runs to 500 for data peaking near 232 or to 30 for bars peaking at 23. The end is the first multiple of a finer 1/2/5 unit; the ticks keep the major unit when the last one is within half a unit of the end, and otherwise divide the end evenly. The composed column, bar, line and area axis (written to PowerPoint as `c:max`), the histogram, pareto, waterfall and box-and-whisker constructs and the scatter axes follow it; `niceScale(..., { endOnTick: true })` keeps the old end for the radar and combo charts.
