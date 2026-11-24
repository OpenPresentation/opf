---
type: fixed
packages: [opf, render, pptx]
---
Output-changing for small column charts with a hidden value axis (LH-03): such a chart labels every column and draws no tick, gridline or axis end, but its axis still ended at a round value up to a quarter above the tallest column (LH-59), which left an empty band of about 60 px between the chart's heading and its columns (the heading sat 90 to 100 px above the tallest column). When every value is zero or more the composed axis now ends at the tallest column, which reaches the top of the plot under the row its label takes; the preview draws it there and the PPTX export writes the same `c:max`. Bar, line and area charts, charts that show their axis and columns below zero keep their scales.
