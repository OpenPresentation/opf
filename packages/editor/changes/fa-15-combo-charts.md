---
type: added
---
FA-15: combo charts. The chart type picker (`compatibleChartTypes`) offers `combo` for data with two or more series, and the chart options (`readChartOptions`, `setChartOptions` and the chart options panel) set which series are lines (`line`), which lines use the secondary value axis (`secondaryAxis`) and that axis's title (`axisTitles.secondary`), each as one undoable patch. Switching a combo chart to another type removes those fields. Needs the FA-15 core.
