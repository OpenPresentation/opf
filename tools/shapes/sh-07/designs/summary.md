# SH-07 per design

Each cell: the whole-slide result against the default design's thresholds (hot <= 0.5 % at 320 and 1280, mad <= 1 at 320 and <= 2 at 1280, median text offset <= 1.5 px; "over (a,b)" names the sources over), the geometry result (outside every text body: hot <= 0.5 %, mad <= 2 at 1280), and the worst mad (320) and hot (1280).

Designs: default (engine default, dark navy, Aptos); light (classic, forest-green, aptos); serif (minimal, burnt-orange, georgia); segoe (bold, deep-purple, segoe-ui); japanese (classic, steel-blue, yu-gothic, ja-JP, five families with Japanese labels).

| Family | default | light | serif | segoe | japanese |
| --- | --- | --- | --- | --- | --- |
| agentflow | pass; geometry pass; mad 0.13, hot 0 % | pass; geometry pass; mad 0.13, hot 0 % | pass; geometry pass; mad 0.17, hot 0 % | pass; geometry pass; mad 0.2, hot 0 % |  |
| architecture | pass; geometry pass; mad 0.47, hot 0 % | pass; geometry pass; mad 0.44, hot 0 % | pass; geometry pass; mad 0.53, hot 0 % | pass; geometry pass; mad 0.83, hot 0.03 % |  |
| block | pass; geometry pass; mad 0.42, hot 0 % | over (a); geometry pass; mad 0.5, hot 0 % | pass; geometry pass; mad 0.55, hot 0 % | pass; geometry pass; mad 0.92, hot 0.08 % |  |
| c4 | pass; geometry pass; mad 0.92, hot 0 % | over (b); geometry pass; mad 1.05, hot 0 % | over (b); geometry pass; mad 1.13, hot 0 % | over (b); geometry pass; mad 1.9, hot 0.17 % |  |
| class | pass; geometry pass; mad 0.27, hot 0 % | pass; geometry pass; mad 0.3, hot 0 % | pass; geometry pass; mad 0.46, hot 0.03 % | over (a); geometry pass; mad 0.41, hot 0.11 % |  |
| cynefin | pass; geometry pass; mad 0.39, hot 0 % | pass; geometry pass; mad 0.42, hot 0 % | pass; geometry pass; mad 0.87, hot 0 % | pass; geometry pass; mad 0.13, hot 0 % |  |
| er | pass; geometry pass; mad 0.36, hot 0 % | pass; geometry pass; mad 0.41, hot 0 % | pass; geometry pass; mad 0.45, hot 0 % | pass; geometry pass; mad 0.58, hot 0 % |  |
| eventmodeling | pass; geometry pass; mad 0.64, hot 0 % | pass; geometry pass; mad 0.75, hot 0.06 % | pass; geometry pass; mad 0.71, hot 0 % | over (b); geometry pass; mad 1.34, hot 0.17 % |  |
| flowchart | pass; geometry pass; mad 0.19, hot 0 % | pass; geometry pass; mad 0.23, hot 0 % | pass; geometry pass; mad 0.3, hot 0 % | pass; geometry pass; mad 0.44, hot 0.03 % | pass; geometry pass; mad 0.43, hot 0.5 % |
| gantt | pass; geometry pass; mad 0.49, hot 0 % | pass; geometry pass; mad 0.61, hot 0 % | pass; geometry pass; mad 0.69, hot 0 % | over (b); geometry pass; mad 1.03, hot 0.14 % |  |
| gitgraph | pass; geometry pass; mad 0.45, hot 0 % | pass; geometry pass; mad 0.48, hot 0 % | pass; geometry pass; mad 0.64, hot 0 % | pass; geometry pass; mad 0.78, hot 0 % |  |
| ishikawa | pass; geometry pass; mad 0.75, hot 0 % | pass; geometry pass; mad 0.81, hot 0 % | pass; geometry pass; mad 0.61, hot 0 % | over (b); geometry pass; mad 1.22, hot 0.17 % |  |
| journey | pass; geometry pass; mad 0.49, hot 0 % | pass; geometry pass; mad 0.56, hot 0 % | pass; geometry pass; mad 0.59, hot 0 % | pass; geometry pass; mad 0.82, hot 0.06 % |  |
| kanban | pass; geometry pass; mad 0.95, hot 0 % | pass; geometry pass; mad 0.96, hot 0 % | over (b); geometry pass; mad 1.13, hot 0 % | over (b); geometry pass; mad 2.16, hot 0.42 % | over (b); geometry pass; mad 1.91, hot 1.39 % |
| mindmap | pass; geometry pass; mad 0.48, hot 0 % | pass; geometry pass; mad 0.53, hot 0 % | pass; geometry pass; mad 0.54, hot 0 % | pass; geometry pass; mad 0.67, hot 0.03 % | over (b); geometry pass; mad 1.43, hot 1.86 % |
| packet | pass; geometry pass; mad 0.43, hot 0 % | pass; geometry pass; mad 0.52, hot 0 % | pass; geometry pass; mad 0.55, hot 0 % | pass; geometry pass; mad 0.59, hot 0.03 % |  |
| pie | pass; geometry pass; mad 0.79, hot 0 % | pass; geometry pass; mad 0.83, hot 0.03 % | pass; geometry pass; mad 0.94, hot 0 % | over (b); geometry pass; mad 2.02, hot 0.39 % |  |
| quadrant | pass; geometry pass; mad 0.3, hot 0 % | pass; geometry pass; mad 0.38, hot 0 % | pass; geometry pass; mad 0.43, hot 0 % | pass; geometry pass; mad 0.49, hot 0 % |  |
| radar | pass; geometry pass; mad 0.4, hot 0 % | pass; geometry pass; mad 0.45, hot 0 % | pass; geometry pass; mad 0.44, hot 0 % | pass; geometry pass; mad 0.53, hot 0.06 % |  |
| railroad | pass; geometry pass; mad 0.17, hot 0 % | pass; geometry pass; mad 0.19, hot 0 % | pass; geometry pass; mad 0.21, hot 0 % | pass; geometry pass; mad 0.27, hot 0.03 % |  |
| requirement | pass; geometry pass; mad 0.37, hot 0 % | pass; geometry pass; mad 0.41, hot 0 % | pass; geometry pass; mad 0.64, hot 0 % | pass; geometry pass; mad 0.54, hot 0.03 % |  |
| sankey | pass; geometry pass; mad 0.69, hot 0 % | pass; geometry pass; mad 0.54, hot 0 % | pass; geometry pass; mad 0.87, hot 0 % | pass; geometry pass; mad 0.88, hot 0.03 % |  |
| sequence | pass; geometry pass; mad 0.58, hot 0 % | pass; geometry pass; mad 0.68, hot 0 % | pass; geometry pass; mad 0.64, hot 0 % | over (b); geometry pass; mad 0.83, hot 0.11 % | over (b); geometry pass; mad 1.24, hot 0.5 % |
| state | pass; geometry pass; mad 0.21, hot 0 % | pass; geometry pass; mad 0.23, hot 0 % | pass; geometry pass; mad 0.39, hot 0.03 % | pass; geometry pass; mad 0.44, hot 0 % |  |
| swimlane | pass; geometry pass; mad 0.26, hot 0 % | pass; geometry pass; mad 0.32, hot 0 % | pass; geometry pass; mad 0.44, hot 0 % | pass; geometry pass; mad 0.35, hot 0 % |  |
| timeline | pass; geometry pass; mad 0.39, hot 0 % | pass; geometry pass; mad 0.39, hot 0 % | pass; geometry pass; mad 0.43, hot 0 % | over (a); geometry pass; mad 1.17, hot 0.42 % | pass; geometry pass; mad 0.76, hot 0.39 % |
| treemap | pass; geometry pass; mad 0.85, hot 0 % | over (b); geometry pass; mad 1.26, hot 0 % | pass; geometry pass; mad 0.83, hot 0 % | over (b); geometry pass; mad 1.24, hot 0 % |  |
| treeview | pass; geometry pass; mad 0.32, hot 0 % | pass; geometry pass; mad 0.36, hot 0 % | pass; geometry pass; mad 0.48, hot 0 % | pass; geometry pass; mad 0.52, hot 0 % |  |
| usecase | pass; geometry pass; mad 0.28, hot 0 % | pass; geometry pass; mad 0.27, hot 0 % | pass; geometry pass; mad 0.31, hot 0 % | pass; geometry pass; mad 0.53, hot 0.03 % |  |
| venn | pass; geometry pass; mad 0.38, hot 0 % | pass; geometry pass; mad 0.35, hot 0 % | pass; geometry pass; mad 0.33, hot 0 % | pass; geometry pass; mad 0.33, hot 0 % |  |
| wardley | pass; geometry pass; mad 0.24, hot 0 % | pass; geometry pass; mad 0.24, hot 0 % | pass; geometry pass; mad 0.33, hot 0 % | pass; geometry pass; mad 0.32, hot 0 % |  |
| xychart | pass; geometry pass; mad 0.43, hot 0 % | pass; geometry pass; mad 0.53, hot 0 % | pass; geometry pass; mad 0.48, hot 0 % | pass; geometry pass; mad 0.63, hot 0.03 % |  |

## Reading the table

- Geometry (shapes, lines, fills outside every text body) passes in every design for every family: worst geometry mad 1.81 (light treemap-b, thin borders on white), hot 0.03 % at most.
- Every "over" is text glyphs, checked on the sheets: the preview draws Aptos, Segoe UI and Yu Gothic with stand-in fonts (OPF does not bundle them), PowerPoint draws the real fonts, so glyph shapes, word spaces and weight differ (Yu Gothic Regular is visibly lighter in PowerPoint) while every line starts, ends and sits where the preview puts it. The two text-offset overs (light block-a "Plan" 2.06 px, Segoe class-a 2.9 px) are ink-centroid shifts of the stand-in glyphs, aligned on the zoomed crops.
- Segoe cynefin: the preview's Segoe stand-in (Red Hat Display) has no U+2192, so both engines draw the unavailable-diagram placeholder; that design does not test cynefin.
- Strict reading (any "over" drops the family): block, c4, class, eventmodeling, gantt, ishikawa, kanban, mindmap, pie, sequence, timeline and treemap would drop; the other 20 pass every design.
