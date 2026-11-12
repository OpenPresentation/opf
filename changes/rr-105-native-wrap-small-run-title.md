---
type: fixed
packages: [pptx]
---
RR-105 (PPTX output only; opf#1089, opf#1091): with `bodyText: "native"`, native bodies and opt-in native titles are written slightly wider than core's line measure, so PowerPoint breaks lines where the preview does, and keep their measured lines (`tight-wrap`) when no width works. A line made only of runs smaller than its role gets exact line spacing, so its baseline matches the preview.
