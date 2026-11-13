---
type: fixed
packages: [opf]
---
RR-105: an authored `design.chartPrimary` side (`top`, `bottom`, `start`, `end`) is now drawn on a chart and short text instead of the automatic note band taking the text, with the text in the middle of its track, and `design.contentDirection: "vertical"` keeps its column instead of LH-49's chart track turning it into a row. A chartPrimary the slide cannot draw (its own `composition.mode` or regions place the blocks) is reported as `opf/arrangement-adapted` instead of being dropped silently.
