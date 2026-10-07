---
type: added
---
FA-15: combo chart previews. `type: "combo"` draws clustered columns with line series with markers in one plot, following core's combo plan (`chart.line`, default the last series; `chart.secondaryAxis`): a secondary value axis at the right with its own scale and tick labels in the first secondary series' number format, a legend with a square key per column series and a line key per line series, `axisTitles.secondary` rotated beside the secondary axis (inside a right legend), and column labels outside the end and line labels above the points by default. Right to left, the two value axes trade sides. Needs the FA-15 core.
