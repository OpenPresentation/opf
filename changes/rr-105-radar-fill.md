---
type: fixed
packages: [opf, render, pptx]
---
RR-105: a radar fills its box: in automatic composition its box is at most square (not 4:3), its default legend moves under the web when that makes the web larger, and its value axis takes as many intervals as the web holds (data up to 5 now reads 0 to 6, not 0 to 10). The PPTX export writes the same value axis and, for a bottom legend, the legend and plot area at the preview's positions; the import reads that legend as the default.
