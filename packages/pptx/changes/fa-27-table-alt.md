---
type: added
---
FA-27: `Table.alt`, the table's text alternative, like `Chart.alt`. `toPptx` writes it as the table frame's `p:cNvPr/@descr`; an empty `alt` is written as PowerPoint's own decorative marker (the `adec:decorative` extension), never as `descr=""`. `fromPptx` reads the `descr` (or the decorative marker) back into `table.alt`, so alt text typed in PowerPoint on a table imports; a table whose frame has no description imports with no `alt`. Chart and table share one frame writer (`src/frame-alt.js`, formerly `chart-alt.js`). Needs the core release that adds `Table.alt`.
