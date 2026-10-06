# Chart options: axis titles, legend position and data labels

Status: RR-35 (release readiness). Additive schema, no release yet: geometry changes only for charts that use the new fields, so the change ships in the next lockstep release (core, then renderer and PPTX, then editor).

## The fields

Three optional fields on the `Chart` object:

```json
{
  "chart": {
    "type": "column",
    "data": { "columns": ["Quarter", "Revenue"], "rows": [["Q1", 12], ["Q2", 18]] },
    "axisTitles": { "category": "Quarter", "value": "Revenue ($M)" },
    "legend": "bottom",
    "dataLabels": { "content": ["value"], "position": "outside-end" }
  }
}
```

| Field | Values | Absent means |
| --- | --- | --- |
| `axisTitles` | `{ category?: string, value?: string }` | no axis titles (today) |
| `legend` | `none`, `top`, `bottom`, `left`, `right` | today's behaviour exactly: a legend at the right of multi-series charts and of pie and doughnut charts, none for a single-series chart |
| `dataLabels` | `true`, `false` or `{ content?, position?, separator? }` | no data labels (today); the funnel and treemap constructs keep the labels they draw by default (values, category names) |

`axisTitles.category` titles the axis that carries the row labels: the horizontal axis of a column, line, area, histogram, pareto, waterfall and box-and-whisker chart, the **vertical** axis of a bar chart and the X axis of a scatter chart. `axisTitles.value` titles the other one. A named `legend` position shows the legend there even for a single-series chart; `none` hides it.

`dataLabels: true` is `{ "content": ["value"], "position": "auto" }`. `dataLabels: false` is the same as leaving the field out, except on the funnel and treemap constructs, which label their marks by default: there `false` removes those labels (`resolveChartOptions` reports `dataLabelsOff`). In the object form:

- `content`: any of `category`, `value`, `percent` (default `["value"]`). A label shows the selected parts in the fixed order category, value, percent, joined by `separator` (default `", "`). Values print in the General number format (twelve significant digits), `percent` as the integer share of the total (`0%`), `category` as the category name (the X value on a scatter chart).
- `position`: `auto` (default), `center`, `inside-end`, `inside-base`, `outside-end`, `above`, `below`, `left`, `right`. `auto` is the type's default in the table below; the engines write that concrete position, so the preview and PowerPoint do not each pick their own.
- `separator`: text between the parts.

## What each chart type supports

`chartOptionSupport(target)` in `@openpresentation/opf` returns this table; the validator, the preview, the exporter and the importer all follow it. An option a type cannot show is **adapted** (dropped, or reset to the default) and reported as a `chart-option-adapted` diagnostic by the validator (a warning), the renderer and the exporter (`onDiagnostic`). It is never silently lost and never fails the render.

| Type (catalog ids) | Axis titles | Legend | Data label content | Data label positions (default) |
| --- | --- | --- | --- | --- |
| clustered column, bar (`column`, `bar`) | category, value | yes | category, value | center, inside-end, inside-base, outside-end (outside-end) |
| stacked and 100% stacked column, bar | category, value | yes | category, value | center, inside-end, inside-base (center) |
| line, stacked line, with markers | category, value | yes | category, value | above, below, left, right, center (above) |
| area, stacked area, 100% stacked area | category, value | yes | category, value | none: the label sits in the area at each category |
| scatter | category (X), value (Y) | yes | category (X value), value (Y) | above, below, left, right, center (above) |
| pie | none | yes | category, value, percent | center, inside-end, outside-end (outside-end) |
| doughnut | none | yes | category, value, percent | none: labels sit in the ring |
| radar, with markers, filled | none | yes | category, value | none |
| histogram, pareto | category, value | none | category, value | center, inside-end, inside-base, outside-end (outside-end) |
| waterfall | category, value | none | category, value | center, inside-end, inside-base, outside-end (outside-end) |
| funnel | category | none | category, value | none (center) |
| treemap | none | none | category, value | none (center) |
| box and whisker | category, value | yes | none | none |
| world (region map) | none | none | none | none |

Deprecated catalog ids resolve through their replacement (`chartOptionTarget('clustered-column')` is the column target). A chart type outside the catalog is never adapted.

## How the engines draw and write them

The preview (opf-render) and the PPTX export (opf-pptx) both read `resolveChartOptions(chart, chartOptionTarget(chart.type))`, so they agree on which options apply and with which content and position.

- **Preview.** A legend, and the axis titles, are carved from the chart box before the plot is laid out: the legend at its edge, then the titles next to the axes. Only a chart that uses a field changes; a chart without them draws the same SVG as before. A vertical axis title is rotated 270 degrees, as PowerPoint draws it.
- **PPTX, classic charts** (column, bar, line, area, pie, doughnut, scatter, radar): `c:catAx/c:title` and `c:valAx/c:title` (rich text, `c:overlay val="0"`), `c:legend/c:legendPos` (`t`, `b`, `l`, `r`; no `c:legend` for `none`) and a `c:dLbls` per series with `c:dLblPos`, `c:showVal`, `c:showCatName`, `c:showPercent` and an explicit `c:separator`, number format `General` (RR-54: the series column format, as `excelNumberFormat` writes it, when its `DataColumn` has one; see [chart-table-data.md](chart-table-data.md)).
- **PPTX, chartex** (histogram, pareto, waterfall, funnel, treemap, box and whisker): `cx:axis/cx:title`, `cx:legend pos`, and `cx:dataLabels pos` with `cx:visibility` and `cx:separator`. The classic fallback chart that precedes every chartex part carries the same classic options.
- **Import.** `fromPptx` reads the same parts back into `axisTitles`, `legend` and `dataLabels`. A legend equal to the default for that chart (right for multi-series, pie and doughnut; none otherwise) is not recorded, so decks that never set the field import unchanged. Anything the three fields cannot express (per-series label overrides, number formats, rich-text titles, manual layouts) is reported with a diagnostic and not invented.

## Defaults and geometry

A chart that sets none of the three fields renders and exports byte-for-byte as before; the preview tests and the PPTX goldens assert it. Because a chart with options reserves space for its legend and titles, the geometry of that chart (and only that chart) differs from a chart without them, so this change is part of the next lockstep release: raise the renderer's, the exporter's and the editor's core floor together.

## Not in this change

Per-series data label overrides (column number formats are RR-54, [chart-table-data.md](chart-table-data.md)), a rotated or rich-text axis title, a chart title, a legend that overlays the plot, manual plot-area layout, secondary axes and trendlines. Charts from external spreadsheets (`ChartDataSource`) stay descoped.
