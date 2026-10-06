# Chart options: axis titles, legend position, data labels and highlight

Status: RR-35 (release readiness) for axis titles, legend and data labels, FA-14 (format audit) for `highlight`. Additive schema, no release yet: geometry changes only for charts that use the first three fields, and colors change only for charts that use `highlight`, so the change ships in the next lockstep release (core, then renderer and PPTX, then editor).

## The fields

Four optional fields on the `Chart` object (the fourth, `highlight`, has [its own section](#chart-emphasis-highlight) below):

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

## Chart emphasis: `highlight`

Highlighting the one series or category that carries the message, and muting the rest, is the main data-storytelling technique. The content stays semantic: `highlight` names series and categories, and the engines pick the colors from the theme. There is no color field.

```json
{
  "chart": {
    "type": "column",
    "data": { "columns": ["Quarter", "Revenue", "Costs"], "rows": [["Q1", 12, 8], ["Q2", 18, 11], ["Q3", 24, 15]] },
    "highlight": { "series": ["Revenue"], "categories": ["Q3"] }
  }
}
```

| Field | Meaning |
| --- | --- |
| `highlight.series` | Value columns (series) whose marks are highlighted: every mark of each named series. Names match the data column names after any `fields` selection; a series is a plotted value column. |
| `highlight.categories` | Row labels (the category column, or `mapping.category`) whose marks are highlighted: a column or bar of every series, a line's points, a pie or doughnut slice. Labels match as text (the number `2024` as `"2024"`) and a label shared by several rows highlights each of them. |

**The rule.** When `highlight` is present, a mark is highlighted if its series OR its category is listed. Highlighted marks take the deck's primary (accent) color; every other mark takes a muted neutral derived from the theme. With both lists given, a bar of series `Revenue` in any category is highlighted, and so is a bar of category `Q3` in any series. A chart without `highlight` keeps its colors, byte for byte. A highlight that names nothing the chart plots (for example a column that is the category column) leaves the chart as if it had none.

**The colors** come from core's `chartHighlightColors(surface, primary, text)`, which the preview and the PPTX export both call with the chart panel, the deck primary and the chart text color:

- the accent is the primary color, kept at 3:1 contrast against the panel by `chartColorForFill` (a primary that already has that contrast is used unchanged);
- the muted color is the panel mixed 30% of the way toward the text color: a light grey on a light panel and a dim grey on a dark one, in the panel's own hue. If that is under 1.6:1 against the panel, the mix moves toward the text color until it holds, so a muted mark is always visible and always quieter than the text.

Data labels stay readable: a label inside a mark takes the text color that contrasts with that mark's own color (core `textColorForFill`), so a label on a muted bar contrasts with the muted fill, as one on an accent bar does with the accent. Labels outside marks keep the chart text color. The legend shows each series in the color its marks have: accent for a highlighted series, muted otherwise. (A multi-series chart that highlights only categories mutes every series alike, so its legend keys look the same; name the series too when the legend matters.)

**Validation.** A name that matches no data column (`series`) or no row label (`categories`) is a `chart-highlight-unknown-name` **error**, found by `resolveChartData` like `chart-mapping-unknown-column`. A series name that is a column but not plotted as a series (the category or X column, or a column `mapping.series` leaves out) is a `chart-highlight-adapted` warning and highlights nothing. A part the chart type cannot highlight is dropped with a `chart-option-adapted` diagnostic (option `highlight.series` or `highlight.categories`). `highlight` must name at least one series or category, and each list has no duplicates.

### What each chart type highlights

`chartOptionSupport(target).highlight` returns `{ series, categories }`; the validator, the preview, the exporter and the editor all follow it.

| Type (catalog ids) | Series | Categories | What is drawn |
| --- | --- | --- | --- |
| clustered column, bar | yes | yes | the series' columns or bars; a category's column or bar in every series |
| stacked and 100% stacked column, bar | yes | yes | the same, per segment |
| line, stacked line, with markers | yes | yes | a series' line and markers; a category highlight draws a marker on each series at that category (on a line without markers, only there) |
| area, stacked area, 100% stacked area | yes | no | the series' area |
| scatter | yes | no | the series' markers (a scatter point label is not a category) |
| radar, with markers, filled | yes | no | the series' line (or fill) and markers |
| pie, doughnut | no | yes | the slice of each named category (a pie plots one series, so a series name is meaningless) |
| histogram, pareto, waterfall, funnel, treemap, box and whisker, world | no | no | not supported: dropped with `chart-option-adapted` |

The Office 2016 (chartex) constructs are left out on purpose. Their marks take their colors from the construct's chart style, and a per-point color (`cx:dataPt`) would need native verification this change does not have; the waterfall also already colors its marks by increase, decrease and total. They draw and export as before.

## What each chart type supports (axis titles, legend, data labels)

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

The preview (opf-render) and the PPTX export (opf-pptx) both read `resolveChartOptions(chart, chartOptionTarget(chart.type))`, so they agree on which options apply and with which content and position. The highlight adds `resolveChartOptions(...).highlight` (the names that survive the type's support table), `chartHighlightMarks(highlight, resolvedData)` (which series and which rows are named) and `chartHighlightColors` (the two colors).

- **Preview.** A legend, and the axis titles, are carved from the chart box before the plot is laid out: the legend at its edge, then the titles next to the axes. Only a chart that uses a field changes; a chart without them draws the same SVG as before. A vertical axis title is rotated 270 degrees, as PowerPoint draws it.
- **PPTX, classic charts** (column, bar, line, area, pie, doughnut, scatter, radar): `c:catAx/c:title` and `c:valAx/c:title` (rich text, `c:overlay val="0"`), `c:legend/c:legendPos` (`t`, `b`, `l`, `r`; no `c:legend` for `none`) and a `c:dLbls` per series with `c:dLblPos`, `c:showVal`, `c:showCatName`, `c:showPercent` and an explicit `c:separator`, number format `General` (RR-54: the series column format, as `excelNumberFormat` writes it, when its `DataColumn` has one; see [chart-table-data.md](chart-table-data.md)).
- **PPTX, chartex** (histogram, pareto, waterfall, funnel, treemap, box and whisker): `cx:axis/cx:title`, `cx:legend pos`, and `cx:dataLabels pos` with `cx:visibility` and `cx:separator`. The classic fallback chart that precedes every chartex part carries the same classic options.
- **Highlight (FA-14), preview.** A highlighted mark is filled with the accent color, every other mark with the muted color; series keep their order (the highlighted one is not moved on top), as PowerPoint draws them. A chart without a highlight never calls the highlight code.
- **Highlight (FA-14), PPTX.** Series colors go into `c:ser/c:spPr` (and `c:marker/c:spPr` on line, scatter and radar series); a per-point color is a `c:dPt` with `c:idx`: `c:dPt/c:spPr` on a column or bar, a circular `c:dPt/c:marker` on a line, the slice fill on a pie or doughnut. The accent is `a:schemeClr val="accent1"` when the deck theme holds the primary exactly (so re-theming in PowerPoint recolors it) and an `a:srgbClr` literal when the contrast adjustment moved it; the muted color is always an `a:srgbClr` literal, because a mix of two theme colors is not one scheme color with `lumMod`/`lumOff`. Data labels inside a mark are written per point where the mark colors differ. Chartex constructs are unchanged.
- **Import.** `fromPptx` reads the same parts back into `axisTitles`, `legend` and `dataLabels`. A legend equal to the default for that chart (right for multi-series, pie and doughnut; none otherwise) is not recorded, so decks that never set the field import unchanged. Anything the three fields cannot express (per-series label overrides, number formats, rich-text titles, manual layouts) is reported with a diagnostic and not invented. The highlight is not inferred from the colors (a native chart's fills do not say which names were highlighted, and a hand-colored chart must not turn into a highlight): in `full` provenance mode the exporter records the authored `highlight` in the chart's `OPF_DATA_V1` data record, and `fromPptx` restores it while the chart's cached data is unchanged. With `provenance: false` or `'references-only'`, or after the data was edited in PowerPoint (`chart-data-provenance-changed`), the chart imports without a highlight and keeps the colors it shows.

## Defaults and geometry

A chart that sets none of the four fields renders and exports byte-for-byte as before; the preview tests and the PPTX goldens assert it. Because a chart with options reserves space for its legend and titles, the geometry of that chart (and only that chart) differs from a chart without them, so this change is part of the next lockstep release: raise the renderer's, the exporter's and the editor's core floor together.

## Not in this change

Per-series data label overrides (column number formats are RR-54, [chart-table-data.md](chart-table-data.md)), a rotated or rich-text axis title, a chart title, a legend that overlays the plot, manual plot-area layout, secondary axes and trendlines. Charts from external spreadsheets (`ChartDataSource`) stay descoped.
