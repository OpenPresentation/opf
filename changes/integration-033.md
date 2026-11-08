---
type: changed
packages: [opf, render]
---
v0.33.0 integration (output-changing where two features meet): LH-186's arrangement before a smaller size keeps LH-184's prose measure. A list in columns that `layout-first` would recompose into one column whose lines run past 70 average characters stays in its columns unless the one column is a type-scale step (10%) larger, so the pages of a paginated FAQ keep their two columns (27 px) instead of one column of long lines (28 px). A Pareto chart of several series, which LH-175 draws as clustered columns, takes LH-176's 150% gap between its column groups in the preview, so its reviewed SVG digest moves once for both. LH-93's horizontal bar siblings of one unit share one plot, so the earlier LH-93 test that expected horizontal bars to keep their own plot now expects the shared one.
