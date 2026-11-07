---
type: changed
packages: [opf, render]
---
v0.33.0 integration (output-changing where two features meet): a Pareto chart of several series, which LH-175 draws as clustered columns, takes LH-176's 150% gap between its column groups in the preview, so its reviewed SVG digest moves once for both. LH-93's horizontal bar siblings of one unit share one plot, so the earlier LH-93 test that expected horizontal bars to keep their own plot now expects the shared one.
