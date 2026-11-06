# Chart types OPF supports (FF-22)

The pptx.gallery chart dimension and the bundled `chartTypes` catalog cover only
the chart types that OPF supports natively in both engines: the preview draws
them and the PPTX export writes the exact PowerPoint construct (and reads it
back to the same id). This page lists those chart types and the Open XML
construct behind each one.

## Rule: what counts as supported

A chart type is supported when it is a single PowerPoint chart construct that
OPF's preview renders and its PPTX export writes natively at high fidelity, or
the column-and-line `combo`, which is two such constructs in one plot area.
Designs that only exist as helper series laid over another chart, such as
bullets, dot plots, dumbbells, sparklines or lines with high/low bands, are not
chart types. They stay out of the catalog (they were deprecated in 0.11 and
removed in 0.12.0, see [the 0.12.0 migration](../../migrations/0.12.0.md)).

`pareto` is the Office "Histogram Pareto" chart: a histogram whose extra series
plots the cumulative percentage. It is one construct, not a composition.

## Supported chart types and their Open XML constructs

The `c:` prefix is the DrawingML chart namespace (ECMA-376). The `cx:` prefix is
the Office 2016 chartex namespace
(`http://schemas.microsoft.com/office/drawing/2014/chartex`). Chartex charts are
stored in a separate `chartEx` part, and each `cx:series` names its plot through
`layoutId`.

| OPF id | Name | Open XML (`mappings.openxml`) |
|---|---|---|
| `100pct-stacked-area` | 100% Stacked Area | `areaChart`, `grouping="percentStacked"` |
| `100pct-stacked-bar` | 100% Stacked Bar | `barChart`, `barDir="bar"`, `grouping="percentStacked"` |
| `100pct-stacked-column` | 100% Stacked Column | `barChart`, `barDir="col"`, `grouping="percentStacked"` |
| `area` | Area | `areaChart` |
| `bar` | Bar | `barChart`, `barDir="bar"`, `grouping="clustered"` |
| `box-and-whisker` | Box & Whisker | `boxWhiskerChart` |
| `column` | Column | `barChart`, `barDir="col"`, `grouping="clustered"` |
| `combo` | Combo: Column and Line | `barChart`, `barDir="col"`, `grouping="clustered"` |
| `doughnut` | Doughnut | `doughnutChart` |
| `filled-radar` | Filled Radar | `radarChart`, `radarStyle="filled"` |
| `funnel` | Funnel | `funnelChart` |
| `histogram` | Histogram | `histogramChart` |
| `line-with-markers` | Line with Markers | `lineChart` |
| `line` | Line | `lineChart` |
| `pareto` | Pareto | `histogramChart`, `cx:paretoLine` |
| `pie` | Pie | `pieChart` |
| `radar-with-markers` | Radar with Markers | `radarChart`, `radarStyle="marker"` |
| `radar` | Radar | `radarChart`, `radarStyle="standard"` |
| `scatter` | Scatter | `scatterChart`, `scatterStyle="marker"` |
| `stacked-area` | Stacked Area | `areaChart`, `grouping="stacked"` |
| `stacked-bar` | Stacked Bar | `barChart`, `barDir="bar"`, `grouping="stacked"` |
| `stacked-column` | Stacked Column | `barChart`, `barDir="col"`, `grouping="stacked"` |
| `stacked-line-with-markers` | Stacked Line with Markers | `lineChart`, `grouping="stacked"` |
| `stacked-line` | Stacked Line | `lineChart`, `grouping="stacked"` |
| `treemap` | Treemap | `treemapChart` |
| `waterfall` | Waterfall | `waterfallChart` |
| `world` | Map | `mapChart` |

Series count and geography come from the chart data, not from the chart type, so
there is one record per construct. `pnpm check:spec` (check `[f]`) enforces it:
every record is listed in the catalog index, names its Open XML element, and no
two records map to the same construct.

## Export and preview

The exporter's table is `packages/pptx/src/chart-types.js`; it maps each id to
its construct and is checked against the catalog by
`packages/pptx/test/chart-types.mjs` and `packages/pptx/test/chartex.mjs`.
Chartex constructs (`treemap`, `histogram`, `pareto`, `box-and-whisker`,
`waterfall`, `funnel`, `world`) are written with a classic clustered-column
fallback for readers without chartex support. `world` is written natively only
with `chartex: 'native'` (see the comment in `chart-types.js`).

## Chart types OPF does not offer

OPF does not offer the 3D, cylinder, cone and pyramid variants, Line3D, the pie
variants (Pie3D, PieOfPie, ExplodedPie, BarOfPie), the line scatter variants,
stock, surface and contour, exploded doughnut, bubble, sunburst, and the
100% stacked line charts. Adding any of them is a separate decision, and each
needs exporter and renderer support first.
