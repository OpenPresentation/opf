---
type: fixed
packages: [opf]
---
A chart with `mode: "column"` (opf#1412 A3, output-changing for slides with no layout that set `composition.mode: "column"` and hold one chart among other blocks): the slide keeps its blocks in one column, the chart above or below the others, instead of LH-49's chart track setting the chart beside them. On a portrait canvas `mode: "row"` keeps its row the same way.
