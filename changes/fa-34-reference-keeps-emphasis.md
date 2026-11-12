---
type: changed
packages: [opf, render, pptx]
---
FA-34 (output-changing for charts with `referenceLines` whose title, other slide text or `highlight` names a series or category): a reference line no longer changes which marks a chart emphasizes; the focus the slide texts name is drawn as on the same chart without references. So that a title cannot move the plot, a chart with references draws its direct-label, stack and bar series names at regular weight. `chart.highlight` takes empty lists (`{ "series": [] }`, `{ "categories": [] }`) as an explicit "no emphasis", as `table.highlight` `{ "rows": [] }` does. A context mark drawn as a stroke (every line series, a combo line) keeps the 3:1 context floor even when every context mark carries its text (it was 1.6:1); filled marks keep the light floor. In the examples this changes the seven slides of `technical/localized-chart-references`.
