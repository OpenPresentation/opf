---
type: fixed
packages: [opf, render, pptx]
---
RR-105: an area chart draws a missing or non-numeric value as a gap (the area ends at the points beside it; a stacked area keeps that layer at zero thickness), no longer as a drop to zero, and a gap draws no data label. The PPTX export writes `c:dispBlanksAs="gap"` on line and area charts, so PowerPoint also breaks a line at a gap instead of joining its neighbors.
