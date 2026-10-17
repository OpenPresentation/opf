---
type: added
packages: [opf]
---
RR-89: `chart.colors`, an optional list of ColorRefs (hex, colour-scheme slot or role, `var:` variable; up to 24) that sets the colour of series 1, 2, 3 and so on (slice or category `i` on pie, doughnut, treemap and funnel charts) over the deck palette; `chart.highlight` still wins and the 3:1 panel contrast adjustment still applies. `chartSeriesPalette(colorScheme, colors?, context?)` and `resolveChartColors` apply it, the `chart-color-only` rule judges the authored colours, and a new warning `opf/chart-colors-adjusted` reports an unresolvable colour or one under 3:1 contrast against the chart panel. Documented in `docs/chart-options.md`.
