# SH-07: native diagrams, PowerPoint against the preview

Corpus: 64 sources, two per family (the docs' or tests' example and a harder one), the diagram alone on a 1280 x 720 slide of the default design. Preview: core convert to PNG (opf-render). PowerPoint: the PPTX exported with diagrams: "shapes", opened read-only through COM in PowerPoint 365 for Windows and exported at 1280 x 720.

Metrics (as harvest/wave8/verify/w8/tools/pairs.mjs): mad = mean absolute difference per channel at 320 x 180; hot = share of 8 x 8 blocks whose mean differs by more than 24/255. Also at 1280 x 720 (16 x 16 blocks), the geometry mad outside every text body (tools/geom.mjs), and the median offset of each text's ink in pixels at 1280 (tools/textpos.mjs).

Threshold, set from the clean families (agentflow, block, flowchart, railroad, treeview, usecase: few labels, so their difference is the renderers' antialiasing; worst mad 0.42, mad at 1280 0.69, hot 0 %, text offset 1.22 px): every source of a family has hot <= 0.5 % at both sizes, mad <= 1 (320) and <= 2 (1280), and median text offsets <= 1.5 px; and the visual check of its sheet shows nothing beyond antialiasing and the glyphs of the preview's stand-in for Aptos (Intos). The mad limits are a little over twice the clean families' worst, for line-dense drawings (sub-pixel line placement) and text-heavy ones (glyph shapes of the stand-in font).

| Family | Sources | mad (320) | hot | mad (1280) | hot (1280) | geometry mad | text dy / dx (px) | picture-path mad | shapes / connectors (glued ends) / presets / freeforms | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Flowchart | flowchart-a, flowchart-b | 0.19 | 0 % | 0.49 | 0 % | 0.18 | 0.45 / 0.22 | 0.17 | 32 / 0 (0) / 16 / 16 | pass |
| Sequence | sequence-a, sequence-b | 0.58 | 0 % | 1.37 | 0 % | 0.58 | 0.43 / 0.15 | 0.41 | 47 / 0 (0) / 18 / 16 | pass |
| Class | class-a, class-b | 0.27 | 0 % | 0.71 | 0 % | 0.15 | 0.56 / 0.49 | 0.26 | 38 / 0 (0) / 8 / 16 | pass |
| State | state-a, state-b | 0.21 | 0 % | 0.56 | 0 % | 0.15 | 0.42 / 0.66 | 0.24 | 46 / 1 (1) / 27 / 18 | pass |
| Entity relationship | er-a, er-b | 0.36 | 0 % | 0.82 | 0 % | 0.23 | 0.26 / 0.18 | 0.32 | 54 / 0 (0) / 17 / 8 | pass |
| Gantt | gantt-a, gantt-b | 0.49 | 0 % | 1.08 | 0 % | 0.27 | 0.47 / 0.29 | 0.41 | 41 / 0 (0) / 7 / 5 | pass |
| Pie | pie-a, pie-b | 0.79 | 0 % | 1.39 | 0 % | 0.17 | 0.55 / 0.29 | 0.64 | 34 / 0 (0) / 8 / 8 | pass |
| Quadrant | quadrant-a, quadrant-b | 0.3 | 0 % | 0.73 | 0 % | 0.18 | 0.71 / 0.04 | 0.29 | 33 / 0 (0) / 14 / 0 | pass |
| Mind map | mindmap-a, mindmap-b | 0.48 | 0 % | 1.08 | 0 % | 0.19 | 0.55 / 0.6 | 0.32 | 34 / 0 (0) / 6 / 14 | pass |
| Timeline | timeline-a, timeline-b | 0.39 | 0 % | 0.7 | 0 % | 0.14 | 0.61 / 0.08 | 0.32 | 69 / 0 (0) / 31 / 12 | pass |
| User journey | journey-a, journey-b | 0.49 | 0 % | 1.08 | 0 % | 0.43 | 0.24 / 0.19 | 0.35 | 104 / 0 (0) / 57 / 15 | pass |
| XY chart | xychart-a, xychart-b | 0.43 | 0 % | 0.59 | 0 % | 0.31 | 0.74 / 0.47 | 0.26 | 51 / 0 (0) / 8 / 5 | pass |
| Sankey | sankey-a, sankey-b | 0.69 | 0 % | 0.85 | 0 % | 0.54 | 0.22 / 0.39 | 0.58 | 37 / 0 (0) / 13 / 11 | pass |
| Git graph | gitgraph-a, gitgraph-b | 0.45 | 0 % | 0.55 | 0 % | 0.28 | 0.14 / 1.11 | 0.18 | 60 / 0 (0) / 28 / 18 | pass |
| C4 | c4-a, c4-b | 0.92 | 0 % | 1.66 | 0 % | 0.33 | 0.29 / 0.38 | 0.77 | 39 / 0 (0) / 15 / 5 | pass |
| Block | block-a, block-b | 0.42 | 0 % | 0.69 | 0 % | 0.23 | 0.51 / 0.78 | 0.22 | 12 / 0 (0) / 6 / 6 | pass |
| Architecture | architecture-a, architecture-b | 0.47 | 0 % | 0.71 | 0 % | 0.31 | 0.58 / 0.38 | 0.45 | 23 / 3 (5) / 10 / 8 | pass |
| Kanban | kanban-a, kanban-b | 0.95 | 0 % | 1.77 | 0 % | 0.01 | 0.69 / 0.18 | 0.46 | 28 / 0 (0) / 14 / 1 | pass |
| Packet | packet-a, packet-b | 0.43 | 0 % | 1.02 | 0 % | 0.48 | 0.33 / 0.41 | 0.33 | 71 / 0 (0) / 19 / 0 | pass |
| Radar | radar-a, radar-b | 0.4 | 0 % | 0.73 | 0 % | 0.33 | 0.04 / 0.63 | 0.3 | 38 / 0 (0) / 15 / 7 | pass |
| Treemap | treemap-a, treemap-b | 0.85 | 0 % | 1.44 | 0 % | 1.15 | 0.23 / 0.17 | 0.52 | 42 / 0 (0) / 14 / 0 | pass |
| Venn | venn-a, venn-b | 0.38 | 0 % | 0.64 | 0 % | 0.46 | 0.56 / 0.33 | 0.26 | 15 / 0 (0) / 5 / 0 | pass |
| Ishikawa | ishikawa-a, ishikawa-b | 0.75 | 0 % | 1.44 | 0 % | 0.13 | 0.51 / 0.74 | 0.54 | 36 / 0 (0) / 5 / 16 | pass |
| Requirement | requirement-a, requirement-b | 0.37 | 0 % | 1.03 | 0 % | 0.2 | 0.32 / 0.33 | 0.31 | 67 / 0 (0) / 10 / 14 | pass |
| Wardley map | wardley-a, wardley-b | 0.24 | 0 % | 0.92 | 0 % | 0.5 | 0.73 / 0.37 | 0.17 | 38 / 8 (7) / 15 / 8 | pass |
| Tree view | treeview-a, treeview-b | 0.32 | 0 % | 0.68 | 0 % | 0.03 | 0.52 / 0.46 | 0.26 | 25 / 0 (0) / 0 / 8 | pass |
| Event modeling | eventmodeling-a, eventmodeling-b | 0.64 | 0 % | 0.95 | 0 % | 0.28 | 0.31 / 0.44 | 0.71 | 31 / 0 (0) / 20 / 6 | pass |
| Railroad | railroad-a, railroad-b | 0.17 | 0 % | 0.48 | 0 % | 0.33 | 1.22 / 0.14 | 0.11 | 43 / 0 (0) / 20 / 6 | pass |
| Cynefin | cynefin-a, cynefin-b | 0.39 | 0 % | 1.04 | 0 % | 0.12 | 0.12 / 0.11 | 0.55 | 64 / 0 (0) / 9 / 23 | pass |
| Use case | usecase-a, usecase-b | 0.28 | 0 % | 0.41 | 0 % | 0.18 | 0.44 / 0.17 | 0.28 | 20 / 0 (0) / 8 / 8 | pass |
| Swimlane | swimlane-a, swimlane-b | 0.26 | 0 % | 0.84 | 0 % | 0.45 | 0.56 / 0.24 | 0.24 | 33 / 0 (0) / 11 / 7 | pass |
| Agent flow | agentflow-a, agentflow-b | 0.13 | 0 % | 0.19 | 0 % | 0.06 | 0.4 / 0.13 | 0.15 | 11 / 0 (0) / 6 / 5 | pass |

Passed: 32 of 32. Sheets (preview | PowerPoint | difference x4): sheets/<family>.png.
