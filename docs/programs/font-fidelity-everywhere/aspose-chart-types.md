# Aspose.Slides chart types (FF-22)

The pptx.gallery chart dimension and the bundled `chartTypes` catalog cover
only the chart types that Aspose.Slides officially supports. This page lists
those chart types, the Open XML construct behind each one, and how every OPF
chart-type record maps onto them.

## Sources

Retrieved 2026-09-22.

| Source | What it gives |
|---|---|
| [`ChartType` enumeration, Aspose.Slides for .NET API reference](https://reference.aspose.com/slides/net/aspose.slides.charts/charttype/) | The authoritative list: 82 members, values 0–81. |
| [`ChartType`, Aspose.Slides for Node.js via Java API reference](https://reference.aspose.com/slides/nodejs-java/aspose.slides/charttype/) | The same 82 members with the same values. |
| [Create or Update PowerPoint Presentation Charts in .NET](https://docs.aspose.com/slides/net/create-chart/) and the [Node.js via Java version](https://docs.aspose.com/slides/nodejs-java/create-chart/) | The chart families with creation guides: normal charts (clustered column and the rest of the enumeration), scatter, pie, line, treemap, stock, box-and-whisker, funnel, sunburst, histogram, radar, multi-category, map and combination charts. |
| [Chart Types, Aspose.Slides for .NET](https://docs.aspose.com/slides/net/chart-types/) | Customization guides for doughnut, 3D, bubble, pie, treemap and sunburst charts. |

**Version.** The API reference pages carry no version number and track the
latest release. At retrieval time that was Aspose.Slides for .NET **26.9**:
NuGet `Aspose.Slides.NET` 26.9.0, published 2026-09-02, and the newest entry in
the [2026 release notes](https://releases.aspose.com/slides/net/release-notes/2026/).

**Caveats from the docs.**

- *Map.* The create-chart guide says Aspose.Slides writes a map chart and its
  data correctly but does not draw map charts itself. When a slide that holds one
  is rendered to an image, PDF or SVG, the chart area comes out blank.
- *SeriesOfMixedTypes.* The enumeration says this value "only can be returned
  by ChartEx.Type property". It is never a type you can create. It only reports
  a chart that already mixes series types.
- *ParetoLine.* This is a series type inside a histogram chart, the Office
  "Histogram Pareto" chart. It is not a standalone plot type.

## ChartType members and their Open XML constructs

The `c:` prefix is the DrawingML chart namespace (ECMA-376). The `cx:` prefix is
the Office 2016 chartex namespace
(`http://schemas.microsoft.com/office/drawing/2014/chartex`). Chartex charts are
stored in a separate `chartEx` part, and each `cx:series` names its plot through
`layoutId`.

**Column** (`c:barChart`, `barDir="col"`):

| Value | ChartType | Open XML | 3D | OPF record |
|---:|---|---|:-:|---|
| 0 | ClusteredColumn | `grouping="clustered"` |  | `column` |
| 1 | StackedColumn | `grouping="stacked"`, overlap 100 |  | `stacked-column-3x` |
| 2 | PercentsStackedColumn | `grouping="percentStacked"` |  | `100pct-stacked-column-3x` |

**3D column** (`c:bar3DChart`, `barDir="col"`):

| Value | ChartType | Open XML | 3D | OPF record |
|---:|---|---|:-:|---|
| 3 | ClusteredColumn3D | `grouping="clustered"`, `shape="box"` | yes | — |
| 4 | StackedColumn3D | `grouping="stacked"` | yes | — |
| 5 | PercentsStackedColumn3D | `grouping="percentStacked"` | yes | — |
| 6 | Column3D | `grouping="standard"` (true 3D depth axis) | yes | — |

**Cylinder, cone and pyramid columns** (`c:bar3DChart`, `barDir="col"`):

| Value | ChartType | Open XML | 3D | OPF record |
|---:|---|---|:-:|---|
| 7–10 | ClusteredCylinder, StackedCylinder, PercentsStackedCylinder, Cylinder3D | `shape="cylinder"` with clustered, stacked, percentStacked or standard grouping | yes | — |
| 11–14 | ClusteredCone, StackedCone, PercentsStackedCone, Cone3D | `shape="cone"` with the same four groupings | yes | — |
| 15–18 | ClusteredPyramid, StackedPyramid, PercentsStackedPyramid, Pyramid3D | `shape="pyramid"` with the same four groupings | yes | — |

**Line** (`c:lineChart`):

| Value | ChartType | Open XML | 3D | OPF record |
|---:|---|---|:-:|---|
| 19 | Line | `grouping="standard"`, markers none |  | `line` |
| 20 | StackedLine | `grouping="stacked"` |  | `stacked-line-3x` |
| 21 | PercentsStackedLine | `grouping="percentStacked"` |  | — |
| 22 | LineWithMarkers | `grouping="standard"`, markers shown |  | `line-with-markers` |
| 23 | StackedLineWithMarkers | `grouping="stacked"`, markers shown |  | `stacked-line-with-markers-3x` |
| 24 | PercentsStackedLineWithMarkers | `grouping="percentStacked"`, markers shown |  | — |
| 25 | Line3D | `c:line3DChart` | yes | — |

**Pie:**

| Value | ChartType | Open XML | 3D | OPF record |
|---:|---|---|:-:|---|
| 26 | Pie | `c:pieChart` |  | `pie` |
| 27 | Pie3D | `c:pie3DChart` | yes | — |
| 28 | PieOfPie | `c:ofPieChart`, `ofPieType="pie"` |  | — |
| 29 | ExplodedPie | `c:pieChart` with `c:explosion` |  | — |
| 30 | ExplodedPie3D | `c:pie3DChart` with `c:explosion` | yes | — |
| 31 | BarOfPie | `c:ofPieChart`, `ofPieType="bar"` |  | — |

**Bar** (`c:barChart`, `barDir="bar"`):

| Value | ChartType | Open XML | 3D | OPF record |
|---:|---|---|:-:|---|
| 32 | PercentsStackedBar | `grouping="percentStacked"` |  | `100pct-stacked-bar-3x` |
| 34 | ClusteredBar | `grouping="clustered"` |  | `bar` |
| 35 | StackedBar | `grouping="stacked"` |  | `stacked-bar-3x` |

**3D bar** (`c:bar3DChart`, `barDir="bar"`):

| Value | ChartType | Open XML | 3D | OPF record |
|---:|---|---|:-:|---|
| 33 | ClusteredBar3D | `grouping="clustered"` | yes | — |
| 36 | StackedBar3D | `grouping="stacked"` | yes | — |
| 37 | PercentsStackedBar3D | `grouping="percentStacked"` | yes | — |
| 38–40 | ClusteredHorizontalCylinder, StackedHorizontalCylinder, PercentsStackedHorizontalCylinder | `shape="cylinder"` | yes | — |
| 41–43 | ClusteredHorizontalCone, StackedHorizontalCone, PercentsStackedHorizontalCone | `shape="cone"` | yes | — |
| 44–46 | ClusteredHorizontalPyramid, StackedHorizontalPyramid, PercentsStackedHorizontalPyramid | `shape="pyramid"` | yes | — |

**Area:**

| Value | ChartType | Open XML | 3D | OPF record |
|---:|---|---|:-:|---|
| 47 | Area | `c:areaChart`, `grouping="standard"` |  | `area` |
| 48 | StackedArea | `c:areaChart`, `grouping="stacked"` |  | `stacked-area-3x` |
| 49 | PercentsStackedArea | `c:areaChart`, `grouping="percentStacked"` |  | `100pct-stacked-area-3x` |
| 50–52 | Area3D, StackedArea3D, PercentsStackedArea3D | `c:area3DChart` with standard, stacked or percentStacked grouping | yes | — |

**Scatter** (`c:scatterChart`):

| Value | ChartType | Open XML | 3D | OPF record |
|---:|---|---|:-:|---|
| 53 | ScatterWithMarkers | markers, no connecting line (the OPF record declares `scatterStyle="marker"`) |  | `scatter` |
| 54 | ScatterWithSmoothLinesAndMarkers | `scatterStyle="smoothMarker"` |  | — |
| 55 | ScatterWithSmoothLines | `scatterStyle="smoothMarker"`, markers none |  | — |
| 56 | ScatterWithStraightLinesAndMarkers | `scatterStyle="lineMarker"` |  | — |
| 57 | ScatterWithStraightLines | `scatterStyle="lineMarker"`, markers none |  | — |

**Stock:**

| Value | ChartType | Open XML | 3D | OPF record |
|---:|---|---|:-:|---|
| 58 | HighLowClose | `c:stockChart` with 3 series and `c:hiLowLines` |  | — |
| 59 | OpenHighLowClose | `c:stockChart` with 4 series, `c:hiLowLines` and `c:upDownBars` |  | — |
| 60 | VolumeHighLowClose | `c:barChart` (volume) plus a `c:stockChart` on the secondary axes |  | — |
| 61 | VolumeOpenHighLowClose | as 60, with `c:upDownBars` |  | — |

**Surface:**

| Value | ChartType | Open XML | 3D | OPF record |
|---:|---|---|:-:|---|
| 62 | Surface3D | `c:surface3DChart`, `wireframe="0"` | yes | — |
| 63 | WireframeSurface3D | `c:surface3DChart`, `wireframe="1"` | yes | — |
| 64 | Contour | `c:surfaceChart`, `wireframe="0"` (top-down view) |  | — |
| 65 | WireframeContour | `c:surfaceChart`, `wireframe="1"` |  | — |

**Doughnut and bubble:**

| Value | ChartType | Open XML | 3D | OPF record |
|---:|---|---|:-:|---|
| 66 | Doughnut | `c:doughnutChart` |  | `doughnut` |
| 67 | ExplodedDoughnut | `c:doughnutChart` with `c:explosion` |  | — |
| 68 | Bubble | `c:bubbleChart`, `bubble3D="0"` |  | — |
| 69 | BubbleWith3D | `c:bubbleChart`, `bubble3D="1"` | yes | — |

**Radar** (`c:radarChart`):

| Value | ChartType | Open XML | 3D | OPF record |
|---:|---|---|:-:|---|
| 70 | Radar | `radarStyle="standard"` (PowerPoint may write `marker` with markers hidden) |  | `radar` |
| 71 | RadarWithMarkers | `radarStyle="marker"` |  | `radar-with-markers` |
| 72 | FilledRadar | `radarStyle="filled"` |  | `filled-radar` |

**Mixed** (read-only, never a record):

| Value | ChartType | Open XML | 3D | OPF record |
|---:|---|---|:-:|---|
| 73 | SeriesOfMixedTypes | several plot elements in one `c:plotArea`. Returned by `ChartEx.Type` only. |  | never a record |

**Chartex** (`cx:` part):

| Value | ChartType | Open XML | 3D | OPF record |
|---:|---|---|:-:|---|
| 74 | Treemap | `cx:series layoutId="treemap"` |  | `treemap` |
| 75 | Sunburst | `cx:series layoutId="sunburst"` |  | — |
| 76 | Histogram | `cx:series layoutId="clusteredColumn"` with `cx:binning` |  | `histogram` |
| 77 | ParetoLine | `cx:series layoutId="paretoLine"` inside a histogram chart |  | — |
| 78 | BoxAndWhisker | `cx:series layoutId="boxWhisker"` |  | `box-and-whisker` |
| 79 | Waterfall | `cx:series layoutId="waterfall"` |  | `waterfall` |
| 80 | Funnel | `cx:series layoutId="funnel"` |  | `funnel` |
| 81 | Map | `cx:series layoutId="regionMap"` with `cx:geography` data |  | `world` |

## OPF chart-type records mapped to ChartType

The bundled catalog has 76 records. Each record names its matching ChartType in
`mappings.renderers["aspose-slides"].chartType`. The rule is one non-deprecated
record per ChartType. `pnpm check:spec` (check `[f]`) enforces it.

**Kept (25).** The record listed against a ChartType in the tables above is the
one that stays. Where several records shared a ChartType, the kept one is the
record the ecosystem already defaults to:

- `column` and `bar` are the `createDataContent` and data-import default, and
  the only ids opf-render draws with its full multi-series renderer.
- The `-3x` stacked variants are the ones used by opf-render's
  `engineDefaults.chartTypes` and `spec/reference/engine-defaults.json`.

Kept `-3x` records now carry the plain label, for example "Stacked Column".
Their ids stay stable because the gallery links to them.

**Deprecated (51).**

- *Duplicates.* 23 records share a ChartType with a kept record. Series count
  and geography come from the chart data, not from the chart type.
- *Compositions.* 28 records are not a single ChartType. They are Aspose's
  SeriesOfMixedTypes or helper-series designs: bullets, sparklines, dot plots,
  dumbbell, line with high/low, and the bar-plus-line Pareto.

A deprecated record keeps resolving, so existing documents stay valid, and it
carries:

- `deprecation.replacedBy`: the closest kept id;
- `deprecation.reason`; and
- `deprecation.removal`: `0.12.0`.

The effects of deprecation:

- The validator warns `deprecated chartTypes catalog id '<id>'; use '<replacement>'`.
- `opf catalog chartTypes` leaves deprecated records out unless you pass `--all`.
- The example generator never picks a deprecated record.
- The gallery no longer lists them.

Deleting the files is a breaking change under `pnpm check:breaking`, which
treats a removed catalog record as breaking. They are therefore scheduled for
the next breaking release (0.12.0) and are not deleted now.

| OPF record | Aspose.Slides ChartType | Decision | Replacement |
|---|---|---|---|
| `100pct-bullet-bar` | no match (composition) | deprecate (composition) | `100pct-stacked-bar-3x` |
| `100pct-bullet-bar-2x` | no match (composition) | deprecate (composition) | `100pct-stacked-bar-3x` |
| `100pct-bullet-bar-3x` | no match (composition) | deprecate (composition) | `100pct-stacked-bar-3x` |
| `100pct-bullet-column` | no match (composition) | deprecate (composition) | `100pct-stacked-column-3x` |
| `100pct-bullet-column-2x` | no match (composition) | deprecate (composition) | `100pct-stacked-column-3x` |
| `100pct-bullet-column-3x` | no match (composition) | deprecate (composition) | `100pct-stacked-column-3x` |
| `100pct-progress-bar` | PercentsStackedBar | deprecate (duplicate) | `100pct-stacked-bar-3x` |
| `100pct-stacked-area-2x` | PercentsStackedArea | deprecate (duplicate) | `100pct-stacked-area-3x` |
| `100pct-stacked-area-3x` | PercentsStackedArea | keep | — |
| `100pct-stacked-bar-2x` | PercentsStackedBar | deprecate (duplicate) | `100pct-stacked-bar-3x` |
| `100pct-stacked-bar-3x` | PercentsStackedBar | keep | — |
| `100pct-stacked-column-2x` | PercentsStackedColumn | deprecate (duplicate) | `100pct-stacked-column-3x` |
| `100pct-stacked-column-3x` | PercentsStackedColumn | keep | — |
| `area` | Area | keep | — |
| `australia` | Map | deprecate (duplicate) | `world` |
| `bar` | ClusteredBar | keep | — |
| `box-and-whisker` | BoxAndWhisker | keep | — |
| `box-and-whisker-2x` | BoxAndWhisker | deprecate (duplicate) | `box-and-whisker` |
| `box-and-whisker-3x` | BoxAndWhisker | deprecate (duplicate) | `box-and-whisker` |
| `bullet-bar` | no match (composition) | deprecate (composition) | `bar` |
| `bullet-bar-2x` | no match (composition) | deprecate (composition) | `bar` |
| `bullet-bar-3x` | no match (composition) | deprecate (composition) | `bar` |
| `bullet-column` | no match (composition) | deprecate (composition) | `column` |
| `bullet-column-2x` | no match (composition) | deprecate (composition) | `column` |
| `bullet-column-3x` | no match (composition) | deprecate (composition) | `column` |
| `canada` | Map | deprecate (duplicate) | `world` |
| `clustered-bar-2x` | ClusteredBar | deprecate (duplicate) | `bar` |
| `clustered-column` | ClusteredColumn | deprecate (duplicate) | `column` |
| `column` | ClusteredColumn | keep | — |
| `dot-plot` | no match (composition) | deprecate (composition) | `scatter` |
| `dot-plot-2x` | no match (composition) | deprecate (composition) | `scatter` |
| `dot-plot-3x` | no match (composition) | deprecate (composition) | `scatter` |
| `dot-plot-4x` | no match (composition) | deprecate (composition) | `scatter` |
| `dot-plot-5x` | no match (composition) | deprecate (composition) | `scatter` |
| `dot-plot-6x` | no match (composition) | deprecate (composition) | `scatter` |
| `doughnut` | Doughnut | keep | — |
| `dumbbell` | no match (composition) | deprecate (composition) | `scatter` |
| `filled-radar` | FilledRadar | keep | — |
| `funnel` | Funnel | keep | — |
| `histogram` | Histogram | keep | — |
| `line` | Line | keep | — |
| `line-2x` | Line | deprecate (duplicate) | `line` |
| `line-3x` | Line | deprecate (duplicate) | `line` |
| `line-with-high-low` | no match (composition) | deprecate (composition) | `line` |
| `line-with-high-low-and-markers` | no match (composition) | deprecate (composition) | `line-with-markers` |
| `line-with-markers` | LineWithMarkers | keep | — |
| `line-with-markers-2x` | LineWithMarkers | deprecate (duplicate) | `line-with-markers` |
| `line-with-markers-3x` | LineWithMarkers | deprecate (duplicate) | `line-with-markers` |
| `pareto` | no match (composition) | deprecate (composition) | `histogram` |
| `pie` | Pie | keep | — |
| `radar` | Radar | keep | — |
| `radar-with-markers` | RadarWithMarkers | keep | — |
| `scatter` | ScatterWithMarkers | keep | — |
| `sparkline` | no match (composition) | deprecate (composition) | `line` |
| `sparkline-2x` | no match (composition) | deprecate (composition) | `line` |
| `sparkline-3x` | no match (composition) | deprecate (composition) | `line` |
| `sparkline-4x` | no match (composition) | deprecate (composition) | `line` |
| `sparkline-5x` | no match (composition) | deprecate (composition) | `line` |
| `sparkline-6x` | no match (composition) | deprecate (composition) | `line` |
| `stacked-area-2x` | StackedArea | deprecate (duplicate) | `stacked-area-3x` |
| `stacked-area-3x` | StackedArea | keep | — |
| `stacked-bar-2x` | StackedBar | deprecate (duplicate) | `stacked-bar-3x` |
| `stacked-bar-3x` | StackedBar | keep | — |
| `stacked-column-2x` | StackedColumn | deprecate (duplicate) | `stacked-column-3x` |
| `stacked-column-3x` | StackedColumn | keep | — |
| `stacked-line-2x` | StackedLine | deprecate (duplicate) | `stacked-line-3x` |
| `stacked-line-3x` | StackedLine | keep | — |
| `stacked-line-with-markers-2x` | StackedLineWithMarkers | deprecate (duplicate) | `stacked-line-with-markers-3x` |
| `stacked-line-with-markers-3x` | StackedLineWithMarkers | keep | — |
| `treemap` | Treemap | keep | — |
| `treemap-2x` | Treemap | deprecate (duplicate) | `treemap` |
| `treemap-3x` | Treemap | deprecate (duplicate) | `treemap` |
| `united-kingdom` | Map | deprecate (duplicate) | `world` |
| `united-states` | Map | deprecate (duplicate) | `world` |
| `waterfall` | Waterfall | keep | — |
| `world` | Map | keep | — |

## Schema support versus export and preview fidelity

A record that maps to a ChartType is supported at the schema level. That does
not mean OPF exports or previews it faithfully. The code reviewed here is
opf-pptx origin/main `ef8a158` and opf-render origin/main `e500ed9`.

Neither package reads `mappings`. Both resolve a chart type by matching
substrings of its id:

- opf-pptx: `mapChartType` in `src/index.js`.
- opf-render: `renderChart` in `src/svg.js`.

**PPTX export (opf-pptx).**

- **Native and faithful:** `column`, `bar`, `line`, `pie`, `doughnut` and
  `area`. These are written as `c:barChart`, `c:lineChart`, `c:pieChart`,
  `c:doughnutChart` or `c:areaChart` through PptxGenJS.
- **Native with lossy grouping or style:**
  - `stacked-column-3x` and `stacked-bar-3x` export as `stacked`.
  - `100pct-stacked-column-3x` and `100pct-stacked-bar-3x` also export as
    `stacked`, not `percentStacked`.
  - The stacked line and area records lose their stacking.
  - `filled-radar` exports as a standard radar chart.
  - `scatter` writes `c:scatterChart` from category-shaped data.
- **Not native:** `treemap`, `histogram`, `box-and-whisker`, `waterfall`,
  `funnel` and `world` (Map). PptxGenJS 4.0.1 cannot write `cx:` parts, so
  these export as a clustered `c:barChart`. There is no `c:stockChart`,
  `c:bubbleChart` or 3D output either.
- **Unknown ids** silently become a clustered column.

**Preview (opf-render).** Only the exact ids `column`, `bar`, `line`, `area`,
`pie` and `doughnut` use the full multi-series renderer. Every other kept
record falls back to a single-series bar or polyline preview.

These gaps are follow-ups. FF-22 changes which records the catalog offers. It
does not change what the exporter or the renderer emits.

## Aspose.Slides chart types OPF does not offer

OPF does not offer the 3D, cylinder, cone and pyramid variants, Line3D, the
pie variants (Pie3D, PieOfPie, ExplodedPie, BarOfPie), the line scatter
variants, stock, surface and contour, ExplodedDoughnut, Bubble, Sunburst,
PercentsStackedLine, PercentsStackedLineWithMarkers and ParetoLine. They are
officially supported by Aspose.Slides but have no OPF record, because none
existed before FF-22. Adding any of them is a separate decision, and each needs
exporter and renderer support first.
