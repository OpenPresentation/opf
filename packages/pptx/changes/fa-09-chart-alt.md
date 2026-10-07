---
type: added
---
FA-09: `Chart.alt`, the chart's text alternative. `toPptx` writes it as the chart frame's `p:cNvPr/@descr` on classic charts and on both frames of a chartex (Office 2016) chart; an empty `alt` is written as PowerPoint's own decorative marker (the `adec:decorative` extension), never as `descr=""`. `fromPptx` reads the `descr` (or the decorative marker) back into `chart.alt`; a chart whose frame has no description imports with no `alt`. Needs the core release that adds `Chart.alt`.
