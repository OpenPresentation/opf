# Chart and table data: numbers, formats, datasets and series mapping

Status: RR-54 (release readiness). Additive schema plus one behavior fix (strict chart numbers). These features are shipped in the coordinated package line; use the [compatibility matrix](compatibility-matrix.md) for the verified set. This page is the contract the four packages implement; change it here first.

## Decisions (vetoable)

Recorded 2026-10-05 for the owner, who asked for all five recommendations of the chart/table data review at once:

1. **One strict chart number rule in core.** The preview read `"12%"` as a gap and `"1e6"` as 1000000; the exporter stripped every non-numeric character (`"1e6"` became 16, `"(5)"` became 5, `"Q1"` became 1). Both engines now call core `chartNumber`, which follows the existing data-import rule. A string that is not a strict decimal number is a gap in both engines and a `chart-value-not-numeric` warning, never a guessed value. Decks whose chart cells held `"12%"` or `"$5"` export a gap where they used to export 12 or 5.
   How a gap draws (RR-105): a line breaks; an unstacked area ends at the points beside the gap and stands on the axis there, so a point with gaps on both sides draws no area; a stacked or 100% stacked area keeps the gap's layer at zero thickness, so the layers above still rest on the running total. A gap has no data label. The PPTX export writes the gap as an omitted `c:pt` with `c:dispBlanksAs val="gap"` on line and area charts (before 0.34 it wrote `span`, so PowerPoint joined a line across the gap while the preview broke it).
2. **`ChartDataSource` is removed from the schema.** No engine resolved it ([opf#240](https://github.com/OpenPresentation/opf/issues/240), descoped), so the format-audit program (FA-07, 2026-10-06) deleted it, with its `chart-data-source-unresolved` warning. A future data-resolver design re-adds it when it is built. Inline data records where it came from with its own `datasource`, `query`, `retrieved`, `version`, `sha256` and `generator` keys, which engines never read.
3. **Number formats use the variables syntax.** One pattern language for `NumberVariable.format`, column formats and cell formats. Core converts it to an Excel format code for the PPTX export and back on import.
4. **Datasets are top-level and shared.** A chart or a table references one with `{ "dataset": "<id>" }`. Core inlines references before composition, so the engines keep plotting and laying out inline data.
5. **Series mapping is by column name.** `chart.mapping` picks the category, X and series columns. Absent keeps today's positional rule exactly.

A document that uses none of the new fields validates, previews and exports byte-for-byte as before, except for decision 1 on non-numeric strings.

## Schema

### Number formats

`NumberFormat` is a string with the `NumberVariable.format` syntax: an optional literal prefix, a numeric part made of `#`, `0`, `,` (grouping) and `.` (decimals), and an optional literal suffix. A `%` in the prefix or suffix multiplies the value by 100. Sections: a format is one to three `;`-separated sections, `positive;negative;zero`, each a pattern as above, with Excel's meaning. With one section every number uses it (a negative number prints a leading `-`). With two, the first formats positive numbers and zero and the second negative numbers; with three, the third formats zero. A negative section formats the absolute value and prints no minus of its own, so its literal text carries the sign: `"+0%;-0%"` shows `+12%` and `-5%`, and `"0;(0)"` shows `(5)`. As in Excel the section is chosen by the value's sign, not by its rounded text, so `-0.4` under `"0;(0)"` shows `(0)`; only an exact zero takes the third section. Four or more sections, an empty section or a section without a numeric part is a `number-format-invalid` error. There is no text section, no color (`[Red]`) and no condition (`[>100]`). The PPTX export writes the sections as the same Excel sections. A waterfall whose column format has sections shows every bar, steps and totals, through that format and adds no sign of its own (`"+0.0;(0.0)"` gives `+4.5` and `(2.5)`; the native labels carry the sections as written); without sections a step still gets `+` or `−`. A title's percent ("20%") names a value through the section that formats it. Examples: `#,##0`, `0.0%`, `$#,##0.00`, `#,##0 units`. An invalid pattern is a `number-format-invalid` error. A format applies only to number values; strings, booleans, `null` and rich runs display unchanged.

Two spellings display differently in Excel, so prefer the alternatives in charts that are exported: optional decimals only (`0.##`) show a whole number as `5` in core and the preview but as `5.` (with a trailing point) in Excel, and an all-`#` integer part (`#`, `#,###`) shows zero as `0` in core but as nothing in Excel. Use `0.0#`-style decimals with at least one `0`, or a whole-number format, and an integer part that ends in `0`.

### Columns

`DataColumn` is `{ "name": string, "format"?: NumberFormat }`. Anywhere a chart or dataset column is a string, it may be a `DataColumn`; the string form is `{ "name": value }` with no format.

```json
"chart": {
  "type": "column",
  "data": {
    "columns": ["Quarter", { "name": "Revenue", "format": "$#,##0.0" }, { "name": "Margin", "format": "0%" }],
    "rows": [["Q1", 12.4, 0.31], ["Q2", 18.1, 0.34]]
  }
}
```

A table column header may also be a `DataColumn`. A `StyledTableCell` gains an optional `format`:
- on a body cell, it formats that cell's number value;
- on a header cell (in `columns`), it is the column's format, the same as a `DataColumn` header.

A body cell's own format wins over the column's.

```json
"table": {
  "columns": ["Region", { "name": "Revenue", "format": "$#,##0.0" }, { "value": "Growth", "style": { "align": "end" }, "format": "0%" }],
  "rows": [["EMEA", 8.2, 0.4], ["APAC", 6.1, { "value": 0.52, "format": "0.0%" }]]
}
```

### Shading cells by value

`table.colorScale` shades the number cells of the named columns by their value, between two colors of the deck's color scheme, so a scorecard, a cohort table or a regional comparison reads at a glance and stays right when a number changes. Engines compute every cell's fill; the author names the columns and the colors.

```json
"table": {
  "columns": ["Region", { "name": "Q1", "format": "0%" }, { "name": "Q2", "format": "0%" }],
  "rows": [["EMEA", 0.22, 0.25], ["APAC", 0.18, 0.21]],
  "colorScale": { "columns": ["Q1", "Q2"], "min": 0, "max": 0.4 }
}
```

- `columns` (required, at least one) names the columns by header text; a dataset-backed table names dataset columns after `fields`. A name no column has is the error `table-color-scale-unknown-column`. Several columns share one scale, so equal numbers get equal colors; the range is taken over all of them.
- `colors` is a list of two or three scheme color names, low to high (default `["surface", "primary"]`).
- **Sequential** (two colors): the lowest value is the first color and the highest the second. If every value is equal, every cell is the last color.
- **Diverging** (three colors): `center` (valid only with three colors; with two or none it is a schema error) is drawn in the middle color, lower values run towards the first color and higher values towards the last, so 0 is always the middle color. `center` defaults to 0 when the values span both signs, else to the middle of the range. With no `min` or `max` the scale is symmetric around `center`: it runs from `center - d` to `center + d`, where `d` is the largest distance of any value from the center, so equal distances get equal strength (with +12% on top, -8% is two thirds of the way to `from`, and a lone -1% is pale). A given `min` or `max` pins that end exactly and each side is then on its own span. A range that lies on one side of `center` draws only that side.
- `min` and `max` pin the range (a 0 to 100% scale over data that spans 62 to 88%); a value outside it takes the end color.
- For a diverging scale choose two ends of different hue (a blue and an orange, not two blues), so a reader tells below the center from above it at a glance; the scheme's accents are not always far apart, so look at the deck's color scheme.
- The colors are scheme names only (`accent1` to `accent6`, `dark1`, `dark2`, `light1`, `light2`, `primary`, `secondary`, `accent`, `background`, `surface`, `surfaceAlt`, `text`, `textSecondary`): no hex and no variable, so a re-themed or dark deck changes the scale with it. Colors are mixed in OKLab, so the steps look even and the middle is not muddy.
- Only cells whose value is a finite number are shaded; text, empty cells and the header are not. A cell with its own `style.fill` keeps it and still counts towards the range. The text of a shaded cell is the scheme text color where it reads on the fill (4.5:1), else black or white; a run with its own color keeps it. A highlighted row's shaded cells take the scale; its other cells keep the highlight tint.
- A table split across slides is shaded over its whole range, so a value has the same color on every page.
- Warnings, never errors, so a refresh of a dataset cannot make a deck invalid: `table-color-scale-no-data` (no named column holds a number) and `table-color-scale-range` (`min` is not below `max`, or `center` is outside the range).

The preview, PNG and PDF draw the computed fills. The PowerPoint export writes a native, editable table whose shaded cells have sRGB fills and text colors; the scale itself is recorded in the file and comes back on import while every shaded cell still has its exported fill. A cell refilled in PowerPoint turns the scale into plain cell fills with a `table-color-scale-not-restored` diagnostic. See [the PPTX round-trip guide](../packages/pptx/docs/document-roundtrip.md). Choose a color scale when the reader compares many numbers across rows and columns; choose a chart when the shape of one or two series is the message.

### Data source provenance

### Typed columns

A dataset column and an inline chart data column may be a `DatasetColumn`: a `DataColumn` that also says what its cells hold (`type`), what the column is for (`role`) and a `unit` label. A table's own column headers stay `DataColumn` and declare nothing. A tool that picks a chart, aggregates a column or orders a time axis reads the declaration instead of guessing from the name and the cells.

```json
{ "name": "Month", "type": "date", "role": "dimension" }
{ "name": "Revenue", "format": "$#,##0", "type": "number", "role": "measure", "unit": "USD" }
```

| `type` | Cells that match | Notes |
| --- | --- | --- |
| `text` | a string | |
| `number` | a finite number | A string, even `"12"`, does not match; the safe fix stores it as `12`. |
| `date` | a string the time-order rule reads as a year, period, week, month or date (`2026-03`, `Q1 2026`, `FY26`, `Jan`, `2026-03-15`), an ISO 8601 date-time (`2026-03-15T09:30:00Z`), or an integer year from 1800 to 2200 | One date grammar for the whole format. |
| `boolean` | `true` or `false` | |
| any | `null` | A gap, never a mismatch. |

`role` is `dimension` (it labels or groups rows) or `measure` (its values are measured and can be aggregated). Time is type `date` with role `dimension`; there is no `temporal` role. Each key stands alone: `type` without `role` and the reverse are valid, and no combination is invalid (a `text` measure is a count of values, not a sum).

`unit` is a label for tools (`"USD"`, `"ms"`, `"people"`). Engines never print it: only `format` decides how a number is drawn.

What engines do:

- Drawing is unchanged. A typed column draws and exports exactly as the same column without the keys.
- Time order (`chartCategoriesInTime`) reads the declared type of the category column first. `date`: the categories are time ordered when they run forward under the existing family rules, and the category-title fallback is skipped. `text` or `boolean`: never time ordered, whatever the labels look like. `number` or undeclared: the rule as before.
- A cell that does not match its column's `type` is a `data-cell-type` warning at the cell (`/datasets/<id>/rows/<r>/<c>`, or the rows of inline chart data). More than five mismatches in one column are one finding for the column, at its first cell. Rows count from 1 in the message. The safe fix (`opf fix --audits`, or the finding's `fixes`) stores a strict decimal string in a `number` column as the number and a number in a `text` column as its text; `"12%"` stays and keeps its warning, and the fix never changes the declared type.
- `resolveChartData` returns `types`, aligned with `columns` (so `fields` selections and a mapping keep each column's declaration). `datasetColumnDeclaration(document, dataset, field)` reads `{ type?, role?, unit? }` of one dataset column by name (`undefined` when there is no such column), for tools such as a computed metric that must refuse to sum a `text` column.
- `opf ingest --dataset` declares the columns of the dataset it writes (inline chart data and tables stay as they were): `number` when every filled cell is a number (a decimal string that prints back unchanged counts; `12.50` does not), `boolean`, `date` (every cell a time label) or `text`; role `measure` for a number column that is neither the first column nor a time label, `dimension` otherwise. It stores the cells as that type, so a typed column it writes never warns. A column whose type cannot be told stays a plain string, and a column a dataset already declares keeps its declaration (core `inferColumnDeclaration`, `declareColumns`). The heuristic is a starting point for ingest, not a rule of the format; a host that reads a typed source writes the declarations it knows.
- In the editor the data panel has a type, a role and a unit field for the selected column of a chart's data or a shared dataset (`setGridColumnDeclaration`); a cell of another kind is marked; columns a paste adds declare what their cells say.
- The PowerPoint export keeps the keys in `OPF_DATASETS_V1` and in a chart's `OPF_DATA_V1` record, inline. A 0.36.0 importer does not know them and drops those records whole (see [document round trip](../packages/pptx/docs/document-roundtrip.md)); its charts and tables keep the values they show.
### Ranges behind a chart (bands)

"Is this number good?" needs the ranges that make it good: poor, fair, good; under, on or over budget. `chart.bands` shades ranges of a chart's value axis behind the data, and they move with the axis.

```json
"chart": {
  "type": "column",
  "data": { "columns": ["Week", { "name": "Wait (min)", "format": "0" }], "rows": [["W1", 14], ["W2", 11], ["W3", 9], ["W4", 12]] },
  "bands": [{ "to": 10, "label": "Within target", "color": "accent3" }, { "to": 15, "label": "Watch" }, { "to": 20, "label": "Over target" }]
}
```

- One to six bands, in increasing order: each runs from the previous band's `to` (the first from the axis minimum) to its own `to`, in the value axis's units (with format `0%`, 0.8 is 80%). There is no `from`: a range left unshaded is a band in `background`. Unordered bands are drawn sorted, with the warning `chart-bands-order`.
- The last `to` extends an automatic axis, as a reference line's value does; a `to` below the axis minimum is not drawn.
- Colors: without `color`, the scheme's neutrals: the text color mixed into the chart's surface (in OKLab) until it reaches a contrast of 1.75, 1.45 and 1.25 against the surface, lowest band first (then again from the first), so the bands read alike on a light and a dark variant. With `color` (a scheme name only), that color at 25% over the surface, for ranges that mean good or bad.
- `label` names the band inside it, in the secondary text color at the chart text size, over the data: in the top corner at the end of a horizontal stripe (column, line and area charts; the left in a right-to-left deck), at the top of a vertical strip at its start (bar and bullet charts), or at the other end (the bottom of a strip) where that corner meets a data mark or label. The legend lists only the data series. When a label does not fit its band, or meets a mark at both places, every band label of that chart goes to the legend instead, the bands first (PowerPoint lists the band group, which it draws first, before the data), and composition reports `chart-band-labels-in-legend`; nothing is shrunk or cut. A chart that names its series beside its marks (a stacked chart's names beside the last column, a line's names at the line ends) or has one series then gets a legend of the bands alone, and its series stay named where they were. The label is also the band's text alternative. One color serves every band label of a chart: the secondary text color when it reads at 4.5:1 on every labeled band, else the primary text color; a band on which even that stays below 4.5:1 (an author's dark `color`) keeps its label and is reported by both engines as the composition diagnostic `text-contrast`, not by validation.
- Bar, column, line and area charts and their stacked and 100% stacked forms draw bands, and so does the bullet chart. Bar and column charts shade the whole plot; line and area charts from the first to the last category center, what a PowerPoint area series covers. Any other type ignores them with the warning `chart-bands-unsupported` (a combo chart among them).
- In a chart with bands, the muted marks of a `highlight` take the neutral at a contrast of 1.5 from the chart's strongest band, on the side away from the surface (about 2.6 against the surface with default bands), so the context marks stay apart from the bands; a chart without bands keeps its muted color. The record keeps the authored chart, so import is unchanged.
- Bands and `referenceLines` combine: bands behind the gridlines and the data, reference lines on top. Bands never change the data drawn.
- **PowerPoint.** The bands are a stacked chart group of their own on the primary axes (the visible ones), and the data series sit on the secondary axes, deleted and fixed to the same bounds: PowerPoint draws a chart's primary group before its secondary one, so this is what keeps the data in front. A chart with bands therefore has fixed value-axis bounds in PowerPoint (both axis pairs carry `c:min` and `c:max`), and a value typed beyond them in Edit Data does not rescale the chart; change the axis bounds in PowerPoint, or the data in OPF and export again. The band series are workbook columns after the data, so Edit Data shows them.

### Bullet charts

`type: "bullet"` puts many KPIs and their targets on one slide: one row per category, each a thin bar (a third of the row) for the measure, a tick (two thirds of the row) at the target, over the chart's bands.

```json
"chart": {
  "type": "bullet",
  "data": { "dataset": "kpis" },
  "mapping": { "category": "KPI", "series": ["Actual"], "target": "Target" },
  "bands": [{ "to": 0.6, "label": "Poor" }, { "to": 0.85, "label": "Fair" }, { "to": 1, "label": "Good" }]
}
```

- `mapping.target` names the target column (optional; without it there are no ticks). The format never guesses it. A name no column has is the error `chart-mapping-unknown-column`; on any other chart type it is ignored with `chart-mapping-adapted`. A target cell that is not a number is a gap (no tick in that row) and a `chart-value-not-numeric` warning.
- The measure is the first plotted series (default: the first column that is not the category or the target); further series are named in `chart-series-dropped`.
- The value axis is shared by all rows: from 0 (lower when a value or band is negative) to the largest value, target or band end.
- Rows read top to bottom in data order, the category names at the start; right to left, the names stand at the right and the values run from the right. `highlight` works as on a bar chart. A bullet chart without bands or target is a thin-bar chart.
- **PowerPoint.** Native, editable parts in two axis pairs: the bands as a stacked bar group on the primary axes, the measure as a clustered bar group (gap width 200) on the secondary axes, and the target as a scatter series without markers on the measure's axes whose fixed vertical error bars draw the ticks. The plot has the preview's position.

### Where data came from

A dataset and inline chart data say where they came from in their own keys: `datasource`, `query`, `retrieved`, `version`, `sha256` and `generator`. `datasource` is the id of an entry of the root `datasources` map (a string is always an id) or a data source written inline, `{ "src": "./revenue.csv" }`. Engines never read, fetch or refresh a data source; they keep the keys through editing, export and re-import. The keys, the `datasources` map, the rules and the `opf fix` rewrite of the removed nested `source` object are in [Data sources](data-sources.md).

There is no chart data source by file or asset (`chart.data` with `src`, `sheet`, `range`, `columns`): that form is removed (opf#240, descoped) and is a schema error. Import the data inline with `columns`/`rows` and record its origin with `datasource` and `query`.

### Datasets

Top-level `datasets` maps ids (the `assets` id pattern) to a `Dataset`:

```json
{
  "datasets": {
    "revenue": {
      "title": "Revenue by quarter",
      "columns": ["Quarter", { "name": "Revenue", "format": "$#,##0.0" }, "Costs"],
      "rows": [["Q1", 12, 8], ["Q2", 18, 11], ["Q3", 24, 15]],
      "datasource": { "src": "./data/revenue.csv" },
      "query": "A1:C4",
      "retrieved": "2026-10-05"
    }
  }
}
```

Rows hold `ChartDataCell` scalars (string, number, boolean, null). A `DatasetRef` is `{ "dataset": "<id>", "fields"?: string[] }`; `fields` selects and orders columns by name, each at most once (a repeated name is a schema error).
- **Chart:** `chart.data` may be a `DatasetRef`. It is the second `oneOf` branch beside `ChartData`.
- **Table rows:** an inline row is an array of cells, or (OPF 0.37) an object `{ "id", "cells" }` that gives the row an id, so a comment, a patch or a merge can name it (`/rows/@r-emea/cells/1`). Both forms may mix in one table and mean the same thing; `tableRows` in `@openpresentation/opf` returns every row in one form. Rows of a dataset or of chart data carry no ids.
- **Table:** a table is either inline (`rows` required, optional `columns`) or dataset-backed (`dataset` required, optional `fields`, and no `rows` or `columns`). Dataset tables take their headers and column formats from the dataset; per-cell styles need an inline table.

Validation:
- an unknown dataset id is a `dataset-unknown` error;
- an unknown field is a `dataset-field-unknown` error;
- duplicate column names in a dataset, or in chart data that a `mapping` or `fields` addresses, are a `data-column-duplicate` error;
- a dataset nothing references is the warning `opf/unused-dataset` (category `references`);
- a string `datasource` that names no entry of `datasources` is a `datasource-unknown` error (on a dataset and on inline chart data); a credential in a data source's `src` is the warning `datasource-credentials`, and data older than its data source's `refreshEvery` is the warning `dataset-stale` when the caller passes a date (see [Data sources](data-sources.md)).

### Series mapping

`chart.mapping` is `{ "category"?: string, "x"?: string, "series"?: string[] }`, naming columns after any `fields` selection:
- `category`: the label column. Default: the first column.
- `x`: the X column of an XY (scatter) chart. Default, today's rule: the second column (the first when `category` names the second), and only when the chart has three or more columns. With two columns there is no X column: the second column is the one series, plotted against row numbers. An `x` that leaves no series (two columns, or every series dropped) is a `chart-mapping-adapted` warning and that column is plotted as the series. A chart is XY when its type resolves (deprecated ids through their replacement) to the scatter construct of `chartOptionTarget`. An `x` equal to the category is a `chart-mapping-adapted` warning and the default is used. On a chart type without an X axis it is dropped with a `chart-mapping-adapted` warning.
- `series`: the plotted columns, in order. Default: every column that is not `category` or `x`.

An unknown name is a `chart-mapping-unknown-column` error. A series that repeats the category or X column is a `chart-mapping-adapted` warning and is dropped. Mapping only reorders and selects columns; single-series constructs still plot one series (see [Chart fallbacks](#chart-fallbacks-lh-60)).

### A metric computed from data

A KPI on a slide is a typed number. When the data changes, the KPI, its change and its arrow disagree with the table beside it until someone retypes them, and a refresh that turns growth into decline leaves a green arrow pointing up. A metric can link to rows of a dataset of the same deck: core computes the value and, optionally, the change from them, and the arrow and its color follow. Core computes from the rows the deck holds and never fetches.

```json
{
  "datasets": { "arr": { "columns": ["Month", "Region", { "name": "ARR", "format": "$#,##0.0M" }], "rows": [["2026-10", "EMEA", 4.2], ["2026-11", "EMEA", 4.4]] } },
  "slides": [{
    "title": "EMEA ARR",
    "metric": {
      "label": "EMEA ARR", "value": 4.4, "delta": 0.2,
      "data": { "dataset": "arr", "field": "ARR", "aggregate": "last",
                "filter": [{ "field": "Region", "op": "=", "value": "EMEA" }],
                "delta": { "compare": "previous" } }
    }
  }]
}
```

This draws `$4.4M` with `+$0.2M` and an up arrow in green. `value` stays required: it is the last computed number, kept for readers that do not compute, and for the slide when the link does not resolve.

**The link** (`metric.data`) is `dataset` (an id of `datasets`), `field` (a column), `aggregate` and an optional `filter`. A filter is a list of `{ field, op, value }` conditions that every row must meet (no OR, no expressions). `op` is `=`, `!=`, `<`, `<=`, `>`, `>=` or `in` (then `value` is a list). `=` and `!=` compare the same JSON value (`1` is not `"1"`); the order operators compare two numbers as numbers, or two strings by time order in a column typed `date` (`"2026-03"` before `"2026-11"`, `"Q1 2026"` before `"Q3 2026"`) and otherwise by code point; any other pair does not meet the condition.

| `aggregate` | Cells used | Result |
| --- | --- | --- |
| `count` | every row kept, whatever its cells hold | the number of rows |
| `sum`, `mean` | numbers (an undeclared column also reads strings in strict decimal syntax, as chart values do) | a number |
| `min`, `max` | numbers; in a `date` column, time labels by their time order | a number, or the cell as written |
| `first`, `last` | the first or last cell that is not null, in dataset order | the cell as written |

A column typed `text` or `boolean` refuses `sum`, `mean`, `min` and `max` (the warning `metric-data-aggregate`). When no row is kept or no cell is usable, the warning is `metric-data-empty`. In both cases the written value is drawn.

**The change** (`metric.data.delta`) is optional, and the typed `delta` is drawn as written when it is absent. It is exactly one of:

| `delta` | The change is |
| --- | --- |
| `{ "compare": "previous" }` | the value against the same aggregate over the kept rows without the last one, in dataset order |
| `{ "compare": { "filter": [...] } }` | the value against the same aggregate over the rows that meet this filter instead of the metric's own (a baseline names everything it means: `Region = EMEA` and `Quarter = Q2`) |
| `{ "compare": { "value": 4 } }` | the value against a fixed number: a plan, a budget, last year's figure typed in |
| `{ "field": "ARR change" }` | the same aggregate, over the same rows, of a column that already holds the change |

`as` is `difference` (the default; value minus base) or `percent` (value minus base, over the absolute base; a ratio, so `0.12` is 12%); for `field` it says what the column holds, which only picks the default format. `format` is how the change is drawn. Without one, a difference uses the value column's format with sign sections built from it (`"$#,##0"` gives `"+$#,##0;-$#,##0;$#,##0"`), or `"+#,##0.##;-#,##0.##;0"` when the column has none, and a percent `"+0%;-0%;0%"`. A change that is undefined (`previous` with fewer than two kept rows, a baseline that meets no row, a percent of 0, a value that is not a number) is the warning `metric-data-delta`: no change is drawn and the value still is.

`previous` compares row sets, not periods. With several rows per period (one per region), filter to one series first, or have the host write the change in a column and use `field`.

**The arrow and its color** follow the computed change. A typed `trend` wins; otherwise the sign of the change gives `up`, `down` or `flat`. A typed `sentiment` wins; otherwise `better` decides: with `better: "up"` (the default) an up trend is positive and a down trend negative, and with `better: "down"` the reverse (a rising churn is red); a flat trend is neutral. `better` is valid on any metric: it also colors a typed `trend`.

**What is drawn.** While the link resolves, the computed numbers are drawn, not the written ones, so the slide agrees with its data. When it does not resolve (an unknown dataset or field is an error; the warnings above leave the link unresolved) the written `value` and `delta` are drawn exactly as before. A string `value` that the aggregate gives (`first` or `last` of a text column) is drawn as written. The change is drawn in the format above, and `unit` is printed after the value as always.

**The written numbers.** `value` and `delta` are the last computed numbers, for readers that do not compute. When they differ from the computed ones the warning `metric-data-stale` carries a safe fix that writes the computed number into `value` (a number, replacing a string such as `"$12.4M"`) and into `delta`; it adds no `trend` or `sentiment`. Two numbers are equal when they draw the same text; a string is equal when it is exactly the drawn text. `opf fix --audits` applies the fix, and `opf fill` applies it to every filled deck, so a deck filled from data carries the numbers of that data.

**The number format** (`metric.format`) says how a number `value` is written, in the pattern language of a number variable, a dataset column and a table cell: `{ "value": 0.044, "format": "0.0%" }` draws `4.4%`. The metric's `format` wins, then the linked column's `format`, then the number rules of today (grouping by the slide's language). A string `value` is drawn as written. It applies to the value only; a typed numeric `delta` of a metric with a `format` is drawn with sign sections built from it, and the change of a link keeps `data.delta.format`. A `unit` that the format already prints as a prefix or suffix is the warning `metric-unit-repeated`.

**For a host that draws a metric another way** (a gauge's arc and its end labels), core exports `resolveMetric(metric, datasets, { path?, language? })`. It returns the metric to draw (`metric`: the plain `value`, `delta`, `trend` and `sentiment` as drawn), `resolved`, the value as drawn (`value`: `{ text, number?, format?, isNumber, computed }`: the number behind the text, the pattern that wrote it and whether it is a number), the change as drawn (`delta`), the record that a PowerPoint tag keeps (`record`) and the findings (`diagnostics`, with the safe fix of a stale number). Composition calls it before it measures, so layout measures the text that is drawn, and every engine draws its result.

**Findings.** An unknown dataset (`data.dataset`) and an unknown column (`data.field`, a filter's `field`, a baseline's `field`, `delta.field`) are `dataset-unknown` and `dataset-field-unknown` errors at the key. `metric-data-stale`, `metric-data-aggregate`, `metric-data-empty`, `metric-data-delta` and `metric-unit-repeated` are `content` warnings (see [validate](validate.md)).

**PowerPoint.** The native shapes are those of a typed metric, carrying the computed text. The metric's tag (`OPF_METRIC_V1`) holds the metric as drawn (a plain 0.36 metric) as `value`, so a 0.36.0 importer reads a correct metric with the same numbers. The 0.37 part (`data`, `better`, `format`, which keys were derived, and the numbers behind formatted text) rides in a separate top-level `link` key of the tag, stored with full provenance. Import restores it while the native value and change text are unchanged. A value or change edited in PowerPoint is the author's: the edited text is imported as the written number, the link is not restored, and the diagnostic is `metric-data-dropped`. A derived `trend` or `sentiment` is not imported as typed.

### Chart fallbacks (LH-60)

Some data does not fit the chart type it is written for. Core's `chartDrawPlan(chart, resolved, { language })` (on `@openpresentation/opf` and `/composition`) decides from the data alone how the preview and the PPTX export draw such a chart, so both draw the same:

| Data | Drawn as | PPTX |
| --- | --- | --- |
| `world` over category labels of which fewer than half are places (`isPlaceLabel`: CLDR region names in English and the deck language, upper-case region codes, US states, Canadian provinces, Australian states, common aliases) | clustered columns of every series (`map-as-columns`) | a `c:barChart`, in every `chartex` mode |
| `pareto` of two or more numeric series (a Pareto chart sorts one series and draws its cumulative share; LH-175) | clustered columns of every series in data order (`pareto-as-columns`) | a `c:barChart`, in every `chartex` mode |
| `box-and-whisker` with one value per category (no label repeats, two rows or more) | one box per series: the rows form one group named after the category column (`box-per-series`) | the chartex box-and-whisker with that one category |
| `pie` or `doughnut` of several series | a doughnut of nested rings, the first series innermost, each ring colored by category and named on its largest slice (`nested-rings`; LH-92, see chart-options.md) | one `c:doughnutChart` with a `c:ser` per series, each naming its series in one `c:dLbl` |
| `scatter` whose X column holds no number | every series against the category position 1, 2, 3, ...; the X column is not drawn (`scatter-by-position`) | X values 1 to n |

The PPTX export reports a fallback as `chart-data-adapted` with `adaptation: 'chart-fallback'` and records the authored data, so `fromPptx` restores it (a pie of several series imports as a doughnut). A construct that plots one series (treemap, histogram with categories, a Pareto chart of one numeric series, waterfall, funnel, a map of places, a one-series pie) still draws the first; `validate` names the others, and a scatter X column without numbers, in the warning `opf/chart-series-dropped` (`chartDrawDiagnostics`).

## Core runtime API

Exported from `@openpresentation/opf` and `@openpresentation/opf/data` (module `src/chart-data.ts`; the resolvers are also on `@openpresentation/opf/composition`). Inputs are typed `unknown` so engines can pass any parsed chart, table or document; the result types are exported (`ResolvedChartData`, `ResolvedTableData`, `DataDiagnostic`, `DataColumn`, `DataSource`, `DataGenerator`, `DataProvenance`, `Dataset`, `DatasetRef`, `ChartMapping`, `DataCellValue`, `DataTableCell`, `DataTableHeader`, `DataStyledCell`).

```ts
/** Strict chart number: finite numbers, and strings in strict decimal syntax (trimmed). Everything else is null (a gap), including "+5", ".5", "5.", "007" and plain digit strings beyond the safe integer range (usually identifiers that would lose digits); a decimal or exponent form such as "1e20" is a number. */
export function chartNumber(value: unknown): number | null;
/** Format a number with a NumberFormat; an absent or invalid format prints the General form (String(value)). */
export function formatDataNumber(value: number, format?: string): string;
/** Why a NumberFormat is invalid (the number-format-invalid message), or undefined when it is valid or absent. */
export function numberFormatError(format: unknown): string | undefined;
/** NumberFormat -> Excel format code ("General" when absent or invalid). Literal prefix/suffix text is quoted as one run ("0.0 m/s" -> '0.0 "m/s"'), so '/' (Excel's fraction bar), 'E+', '@', '*', '_' and '?' are never bare (native check opf#387); placeholders are written '#' before '0' ("0#" -> "#0"). */
export function toExcelNumberFormat(format?: string): string;
/** Excel format code -> NumberFormat, or undefined when the code has no exact NumberFormat equivalent (General, sections, scaling commas, and placeholder orders Excel reads by position such as "0#" or "0.#0"). */
export function fromExcelNumberFormat(code: string): string | undefined;
/** Pure: a copy of the document where every chart and table DatasetRef is replaced by inline data (columns as DataColumn when a format applies, rows copied; a chart also takes the dataset's provenance keys). `datasets` stays in place. Unknown ids, and references naming an unknown field, are left as they are. */
export function inlineDatasets<T>(document: T): T;
/** One table or chart in inline form (a dataset reference copied from document.datasets); anything else is returned as is. */
export function inlineTableData<T>(table: T, document?: unknown): T;
export function inlineChartData<T>(chart: T, document?: unknown): T;
/**
 * Resolve a chart's data to the canonical positional table: [category, (x,) ...series]. hasX is true when columns[1] is the X
 * column: an XY chart with three or more resolved columns (with two, the second column is the series against row numbers).
 * Category cells are kept as authored; X and series cells pass through chartNumber. Data with a single column has no
 * category: that column is the chart's values and passes through chartNumber too (with chart-value-not-numeric per cell).
 * Inline ChartData, a DatasetRef (needs the document) and mapping are resolved here.
 * options.path is the chart's JSON Pointer, the base of diagnostic paths (dataset cells report at /datasets/<id>/...).
 */
export function resolveChartData(chart: unknown, document?: unknown, options?: { path?: string; asOf?: string }):
  | { ok: true; columns: string[]; hasX: boolean; formats: (string | undefined)[]; rows: (string | number | boolean | null)[][]; provenance?: DataProvenance; dataset?: string; diagnostics: DataDiagnostic[] }
  | { ok: false; reason: "dataset-unknown" | "no-rows" | "no-columns"; message: string; diagnostics: DataDiagnostic[] };
/** Resolve a table (inline or dataset-backed) to headers, rows and per-column formats. */
export function resolveTableData(table: unknown, document?: unknown, options?: { path?: string }):
  { columns?: DataTableHeader[]; rows: DataTableCell[][]; formats: (string | undefined)[]; dataset?: string; diagnostics: DataDiagnostic[] };
/** Display value of a table cell: a number with a valid format (cell, else column) becomes formatted text (a styled cell keeps its style with the text as value); anything else is returned unchanged. */
export function tableCellDisplayValue(cell: DataTableCell, columnFormat?: string): DataTableCell;
/** Migration help (see below): the patch that stores one chart value column's text as numbers with the format that shows the same text, or undefined. */
export function suggestChartNumberFix(chart: unknown, document?: unknown, options?: { path?: string; column?: number | string }):
  { patches: { op: "replace"; path: string; value: unknown }[]; column: number; name: string; format: string } | undefined;
/** Helpers: dataset-level diagnostics (duplicate names, invalid formats), unreferenced dataset ids, the XY test, the DatasetRef test. */
export function datasetDiagnostics(document: unknown): DataDiagnostic[];
export function unusedDatasets(document: unknown): string[];
export function isXYChartType(type: unknown): boolean;
export function isDatasetRef(value: unknown): value is DatasetRef;
```

`DataDiagnostic` is `{ code, severity: "error" | "warning", path, message }`, with the codes above plus `chart-value-not-numeric`. `chartNumber` runs after variables are filled. Before filling, the validator does not warn on a `var:<id>` cell whose variable is a number. `chart-value-not-numeric` is reported for any value cell that `chartNumber` rejects (strings and booleans), never for `null` or `""`. An unknown `fields` entry is a `dataset-field-unknown` error and `resolveChartData`/`resolveTableData` leave that column out. `number-format-invalid` applies to `DataColumn.format` and `StyledTableCell.format`; `NumberVariable.format` keeps its existing check (`variable-format` where it is used), so no existing document gains an error.

`validate` reports the codes as `opf/<code>` rule ids: the errors are `format` findings, `opf/chart-value-not-numeric` and `opf/chart-mapping-adapted` are `content` warnings, `opf/datasource-credentials` and `opf/dataset-stale` are `content` warnings, and `references` adds `opf/unused-dataset`. The raw schema issue of a finding is in its `validation` field (`validation.params.code`).

### Migration help

Decks written before the strict rule often hold display text in chart cells. When every text cell of a value column (an X or series column, or a lone column) is written in one display style that a NumberFormat reproduces exactly, `suggestChartNumberFix` returns the fix, and `validate` attaches it to each of the column's `opf/chart-value-not-numeric` warnings as `fixes: [{ id: "store-chart-numbers", title, kind: "patch", safe: false, patch }]` (a [finding fix](finding-schema-reference.md); core never applies it):

- `"12%"`, `"8.5%"` become 0.12 and 0.085 with the column format `0.#%`;
- `"$1,234"`, `"$56"` become 1234 and 56 with `$#,##0` (also `€`, `£`, `¥`);
- `"1,234.5"`, `"999"` become 1234.5 (the plain number stays) with `#,##0.##`.

The patch replaces each text cell with its number and the column with a `DataColumn` that has the format; a dataset column is fixed in the dataset, so every chart and table that uses it changes, and its tables show the same text. A style is one optional leading minus, one optional currency symbol, digits (grouped in threes or plain), optional decimals and an optional `%`. There is no fix when the column already has a format, when styles are mixed (`"12%"` beside `"$5"` or beside the number 0.5), for accounting negatives `"(5)"`, `"$-5"`, a decimal comma (`"1.234,5"`), units (`"5 units"`), `".5"` or `"007"`, for mixed grouping (`"1,234"` beside `"5678"`), or when one format cannot show every value as written (`"$5"` beside `"$5.50"`). Every fixed value is checked: `formatDataNumber(value, format)` equals the text as written.

Core composition, table layout and pagination accept dataset-backed tables and charts by inlining first. Table layout measures the formatted text. Markdown conversion, diff, merge, patch, validate and format keep the new fields. In detail:

- `composeSlide` inlines a dataset-backed `table` or `chart` from `options.presentation.datasets`, so the composed item's `value` (and `payload`) is the inline copy; the item `path` still points at the authored field. `layoutTable(value, box, { presentation })` does the same, and each body cell's `TableCellLayout.value` is its display value (`tableCellDisplayValue`); `input` stays the authored cell. A DataColumn header shows its `name` (`path` ends in `.name`).
- `paginateSlide`/`paginate` validate a slide with the deck's `datasets` (and `references`). A dataset table that has to be split is written to the continuation slides as inline tables (the slide that fits is returned unchanged, with its reference).
- `convertContent` keeps a dataset reference between chart and table (`fields` too; `mapping` is reported as lost) and needs `options.presentation` to convert a dataset table to any other kind. Inline conversions keep DataColumn formats and report lost number formats and the data source keys. Slide-level conversions validate with the document's datasets; slide-only structure edits skip the dataset checks they cannot make.
- Markdown writes the new fields in its embedded YAML form (lossless); `datasets` go to the front matter. `format` orders `datasets`, `datasources`, `mapping`, the provenance keys and `DataColumn` keys by the schema. `diff` reports changes under `datasets` in their own category. The chart rules of `validate` read resolved chart data (DataColumn names, dataset charts).
- Variables: `resolveVariables` walks `datasets` like any other content, so `{{id}}` tokens and whole `var:<id>` cells in dataset rows are filled before engines inline the reference.
- `opf ingest --dataset <id>` (CLI) writes the imported columns and rows into `datasets.<id>` and references it. Re-importing into an existing dataset keeps its title, description and the format of each column whose name is unchanged; `datasource.src` names the imported file relative to the deck file's folder with `/` separators (stdin: no data source) and `sha256` is the hash of that file's bytes; `retrieved` is set only by `--date YYYY-MM-DD` (the command never reads the clock). A re-import keeps an inline data source's other keys and the `query` when the same file is imported again, keeps a data source named by id, and never keeps `retrieved`, `sha256`, `version` or `generator`, which described the old rows.
- The generated `Table` type now has `rows?` (a dataset table has none) and `dataset?`/`fields?`; TypeScript callers that read `table.rows` handle the dataset form (or call `resolveTableData`).

## Engines

All three engines read core's functions when they exist and fall back to their previous behavior on a core without RR-54, so each can ship before or after core. A document that uses none of the new fields renders, exports and edits byte for byte as before (renderer: all 805 slides of the core examples; PPTX: 21 golden digests; editor: identical patches).

### Preview (opf-render, [opf-render#127](https://github.com/OpenPresentation/opf-render/pull/127))

- **Data:** every chart path reads `resolveChartData`: the catalog charts, the chartex constructs, scatter, pie and doughnut, single-column charts, and the legacy sketch. Its own `chartNumber` delegates to core's, so `"0x10"` is now a gap too. Data that does not resolve keeps the "No chart data" placeholder. A document with an unknown dataset or mapping column fails validation (`invalid-opf`) like any other invalid document.
- **Formats:**
  - Data labels use their series' format, through `formatDataNumber`.
  - Value-axis ticks use the first plotted series' format, as Excel does for a source-linked axis.
  - The scatter X axis and X labels use the X column's format.
  - Percent axes (100% stacked, pareto) and pie percent labels stay percent.
  - A histogram of a lone column plots counts and takes no format.
- **Tables:** cells draw core layout's display text, so a body cell's own `format` wins over its column's.
- **Tracing:** the editor relies on each drawn part's authored path.
  - Every part of a dataset-backed chart or table traces to its authored `slides.N.chart` or `slides.N.table` path, because it has no rows of its own.
  - A chart with `mapping` traces each part to the authored column index.

### PPTX export (opf-pptx, [opf-pptx#171](https://github.com/OpenPresentation/opf-pptx/pull/171))

- **Numbers:** the export resolves data through `resolveChartData`, and the lenient `parsedNumber`/`numericValue` are removed. Non-numeric strings export as gaps, with one `chart-value-not-numeric` diagnostic per chart that carries a `count`.
- **Classic charts:** `toExcelNumberFormat` codes are written as:
  - the series `c:numCache/c:formatCode` (added where PptxGenJS writes none, such as pie and doughnut);
  - the series and chart-group data-label `c:numFmt sourceLinked="0"`;
  - the value-axis `c:numFmt`. The first plotted series' format is used, a scatter X axis takes the X column's, and a 100% stacked axis keeps `0%`.
  - Labels that show percentages keep PowerPoint's percent form.
- **Chartex:** `cx:lvl formatCode` and the value-label and value-axis `cx:numFmt`, except on binned constructs.
- **Embedded workbook:** custom `numFmt` entries from id 164, with cell styles on every value cell, so Edit Data shows the formats.
- **Tables:** tables export core layout's display text.
- **Datasets and mapping:** a chart that uses them exports exactly like its inline equivalent.
- **Provenance:** in `full` mode, `OPF_DATASETS_V1` holds the `datasets` map and `OPF_DATASOURCES_V1` the root `datasources` map; the provenance keys of a dataset and of inline chart data travel inside those records and the frame record, unchanged. `OPF_DATA_V1` sits on each chart or table frame that uses a new field and holds the authored `data`, `mapping` and table form (and, FA-14, a chart's `highlight`, which then also records its inline `data`; see [chart-options.md](chart-options.md)), plus a hash of the cached names, values and format codes. `references-only` mode and `provenance: false` write neither tag.

### PPTX import (opf-pptx)

- **With provenance:** `datasets` and `datasources` are restored before document provenance validates. A frame's dataset reference, `mapping`, formats and data source keys are restored only while the cache hash still matches. If PowerPoint (or a person) changed the values, the native values import and a diagnostic says why, such as `chart-data-provenance-changed` or `table-dataset-unavailable`. The hash compares format codes in core's canonical form (`fromExcelNumberFormat`), so PowerPoint's re-spellings on save (`\$#,##0.0` for `$#,##0.0`, `#,##0\ "units"` for `#,##0 "units"`, native check [opf#385](https://github.com/OpenPresentation/opf/pull/385)) still match; a General code counts as no code.

Decorative ChartEx titles are excluded from chart-data evidence. A plain PowerPoint save can rewrite a title from `cx:rich` to `cx:txData/cx:v` without changing the data. That rewrite, or a display-caption rename, keeps an unchanged chart's authored data form; it must not introduce a synthetic `Row` column. The cached categories, numeric values, series names and number formats still control whether provenance can restore the authored form.
- **Without provenance:** a cache `formatCode` that `fromExcelNumberFormat` maps back becomes that column's `{ name, format }`, for both classic and chartex charts. Core returns the canonical spelling, such as `#,##0 units` for `#,##0 "units"`. Other codes are reported as `chart-number-format-adapted` and never invented.
- **Cached values:** these follow the strict rule as well. XML decimal forms (`+5`, `.5`, `007`) are numbers; anything else is a gap with a diagnostic, never a stripped number or 0.

### Editor (opf-editor, [opf-editor#92](https://github.com/OpenPresentation/opf-editor/pull/92))

- **DataColumn headers:** the data grid shows a `DataColumn` header's `name`. Rename, insert, delete, move and paste keep each column's format.
- **Chart cells:** they follow `chartNumber`. Text that is not a number is refused with the reason, and a stored string read as a gap is flagged.
- **Shared datasets:** a dataset-backed chart or table is edited at `/datasets/<id>` through `fields`.
  - Hidden columns keep their data.
  - A column added while `fields` is set goes to both the dataset and `fields`.
  - A rename updates every `fields` and `mapping` that names the column, in the same patch.
  - Deleting a column another item uses is refused with `dataset-column-in-use`.
  - The status line says how many items share the dataset, and "Use a copy of the data" (`detachGridDataset`) inlines one item's data.
- **Format and mapping:**
  - A per-column format field (`setGridColumnFormat`) is checked with `numberFormatError`.
  - A "Chart columns" panel (`setChartMapping`) sets the category, the X column (XY charts only) and the series, and writes only what differs from the default.
- **Import:** "Store as a shared dataset" (`prepareDatasetImport`) imports into `datasets.<id>`, as `opf ingest --dataset` does.
- **Other panels:** the table style panel and `table-options` refuse a dataset table with `table-dataset-backed`. Find and replace also searches dataset text.
- **Undo:** each edit is one undoable patch.

### Native PowerPoint checks

Wanted before release:
- formatted data labels and value axes;
- Edit Data shows the workbook cell formats with no repair prompt;
- no repair prompt for the frame `custDataLst`;
- after a plain save in PowerPoint, the data tags and cache hash survive;
- the two spellings above (`0.##` on a whole number, `#` on zero) show as described.

Sample decks are written by the PPTX branch under `artifacts/rr-54-native/`.

## Not in this change

- Resolving a data source by file or asset, or refreshing a data source ([opf#240](https://github.com/OpenPresentation/opf/issues/240)).
- Date axes and date formats.
- Per-series colors: shipped later as `chart.colors`; see [chart-options.md](chart-options.md#setting-colors-chartcolors). (Columns with line series, optionally on a secondary axis, are the `combo` chart type: [chart-options.md](chart-options.md#combo-charts).)
- Formulas.
- Rich text in dataset cells.
