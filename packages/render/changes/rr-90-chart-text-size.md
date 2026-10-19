---
type: changed
---
RR-90 (output-changing for every chart): chart axis, legend, category and data-label text is core's `chartTextSize` instead of 14 px floored to the 16 px (12 pt) minimum: 20 px (15 pt) in a roomy chart box, shrunk (at most a 1/18 of the box height and 1/30 of its width, whole pixels) only when the box is small, and never below `composition.minFontSize`. A chart no longer renders at 12 pt beside 24 pt bullets. Needs `@openpresentation/opf` 0.22.0.
