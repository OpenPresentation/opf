---
type: fixed
packages: [pptx]
---
opf#1431 (import only; exported files are unchanged): `dataLabels: false` survives a PowerPoint round trip on the charts whose export labels their marks by default: a small column, bar or line chart (with or without markers; LH-03), a stacked or 100% stacked column, bar or area chart (segment values, LH-109), and a pie or doughnut chart (the value list, LH-108). Their export of `false` writes a chart without labels, which imported as no option, so the next export drew the labels the author had turned off. A classic chart that shows no label at all now imports as `dataLabels: false` when core, composing the imported slide, draws that chart differently with `false` than without it; a chart whose default labels would not fit, or whose default draws none (an area chart, for one), exports the same file either way and imports without the option, as before. A chart whose labels were turned back on in PowerPoint imports its labels.
