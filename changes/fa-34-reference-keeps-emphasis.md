---
type: changed
packages: [opf, render, pptx]
---

FA-34 (output-changing for charts with `referenceLines` whose title, other slide text or `highlight` names a series or category): a reference line no longer changes which marks a chart emphasizes. The focus the slide's texts name is drawn exactly as on the same chart without references (it used to be switched off), and so that a title still cannot move the plot, a chart with references draws its direct-label, stack and bar series names at regular weight (a bold name is wider and would change the gutter). `chart.highlight` takes empty lists (`{ "series": [] }`, `{ "categories": [] }`): an explicit "no emphasis" that switches derived emphasis off, as `table.highlight` `{ "rows": [] }` does. In the examples, the seven slides of `technical/localized-chart-references` change: each title names 2023, which is now the focused point of the line.
