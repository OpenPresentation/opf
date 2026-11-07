---
type: fixed
packages: [opf, render, pptx]
---
A histogram's bin edges round the way PowerPoint rounds them under the same number format (the decimal value, half away from zero: 1.2 + 1.85 reads 3.1, not 3.0; `histogramEdgeText`), so the preview's bin labels match PowerPoint's. The value axis of a histogram and a Pareto chart is composed in core (`layer.histogram.valueAxis`, and a Pareto chart's percentage step `percentUnit`): the preview draws it and the native chartex part writes it as `cx:valScaling` min, max and majorUnit, where PowerPoint used to pick its own axis (0 to 4,500 by 500 beside the preview's 0 to 5,000 by 1,000). Found by the v0.33 PowerPoint qualification (opf#1092).
