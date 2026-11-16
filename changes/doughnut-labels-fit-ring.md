---
type: fixed
packages: [opf, render, pptx]
---

A doughnut's explicit data labels that do not fit inside their slice no longer spill out of the ring in dark text over the background (a long `category, percent` label on the slice a title highlights). Core measures each label against its slice; when one does not fit, both engines draw the labels without the category, and when the value or percent still does not fit, none, and a `chart-option-adapted` finding on `dataLabels.content` says what was drawn instead (the legend names the slices).
