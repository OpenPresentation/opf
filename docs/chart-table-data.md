# Chart and table data: numbers, formats, datasets and series mapping

Status: RR-54 (release readiness). Additive schema plus one behaviour fix (strict chart numbers). Ships in the next lockstep release: core first, then renderer and PPTX, then editor. This page is the contract the four packages implement; change it here first.

## Decisions (vetoable)

Recorded 2026-10-05 for the owner, who asked for all five recommendations of the chart/table data review at once:

1. **One strict chart number rule in core.** The preview read `"12%"` as a gap and `"1e6"` as 1000000; the exporter stripped every non-numeric character (`"1e6"` became 16, `"(5)"` became 5, `"Q1"` became 1). Both engines now call core `chartNumber`, which follows the existing data-import rule. A string that is not a strict decimal number is a gap in both engines and a `chart-value-not-numeric` warning, never a guessed value. Decks whose chart cells held `"12%"` or `"$5"` export a gap where they used to export 12 or 5.
2. **`ChartDataSource` stays valid but warns.** No engine resolves it ([opf#240](https://github.com/OpenPresentation/opf/issues/240), descoped). The validator reports `chart-data-source-unresolved`. Inline data can instead record where it came from with `data.source`, which engines never read.
3. **Number formats use the variables syntax.** One pattern language for `NumberVariable.format`, column formats and cell formats. Core converts it to an Excel format code for the PPTX export and back on import.
4. **Datasets are top-level and shared.** A chart or a table references one with `{ "dataset": "<id>" }`. Core inlines references before composition, so the engines keep plotting and laying out inline data.
5. **Series mapping is by column name.** `chart.mapping` picks the category, X and series columns. Absent keeps today's positional rule exactly.

A document that uses none of the new fields validates, previews and exports byte-for-byte as before, except for decision 1 on non-numeric strings.

## Schema

### Number formats

`NumberFormat` is a string with the `NumberVariable.format` syntax: an optional literal prefix, a numeric part made of `#`, `0`, `,` (grouping) and `.` (decimals), and an optional literal suffix. A `%` in the prefix or suffix multiplies the value by 100. Examples: `#,##0`, `0.0%`, `$#,##0.00`, `#,##0 units`. An invalid pattern is a `number-format-invalid` error. A format applies only to number values; strings, booleans, `null` and rich runs display unchanged.

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
  "columns": ["Region", { "name": "Revenue", "format": "$#,##0.0" }, { "value": "Growth", "style": { "align": "right" }, "format": "0%" }],
  "rows": [["EMEA", 8.2, 0.4], ["APAC", 6.1, { "value": 0.52, "format": "0.0%" }]]
}
```

### Data source provenance

`DataSourceRef` is `{ "src": string, "sheet"?, "range"?, "fields"?: string[], "retrieved"?: string (ISO date or date-time), "description"?: string }`. It records where inline data or a dataset came from. Engines never read, fetch or refresh it; they keep it through editing, export and re-import. It may appear as `ChartData.source` and `Dataset.source`.

The existing `ChartDataSource` (`chart.data` with `src`, `sheet`, `range`, `columns`) is unchanged and still valid. The validator now warns `chart-data-source-unresolved`: the preview and export draw a placeholder for it. Prefer inline `columns`/`rows` with a `source`.

### Datasets

Top-level `datasets` maps ids (the `assets` id pattern) to a `Dataset`:

```json
{
  "datasets": {
    "revenue": {
      "title": "Revenue by quarter",
      "columns": ["Quarter", { "name": "Revenue", "format": "$#,##0.0" }, "Costs"],
      "rows": [["Q1", 12, 8], ["Q2", 18, 11], ["Q3", 24, 15]],
      "source": { "src": "./data/revenue.csv", "retrieved": "2026-10-05" }
    }
  }
}
```

Rows hold `ChartDataCell` scalars (string, number, boolean, null). A `DatasetRef` is `{ "dataset": "<id>", "fields"?: string[] }`; `fields` selects and orders columns by name.
- **Chart:** `chart.data` may be a `DatasetRef`. It is the third `oneOf` branch beside `ChartData` and `ChartDataSource`.
- **Table:** a table is either inline (`rows` required, optional `columns`) or dataset-backed (`dataset` required, optional `fields`, and no `rows` or `columns`). Dataset tables take their headers and column formats from the dataset; per-cell styles need an inline table.

Validation:
- an unknown dataset id is a `dataset-unknown` error;
- an unknown field is a `dataset-field-unknown` error;
- duplicate column names in a dataset, or in chart data that a `mapping` or `fields` addresses, are a `data-column-duplicate` error;
- a dataset nothing references is the lint warning `opf/unused-dataset`.

### Series mapping

`chart.mapping` is `{ "category"?: string, "x"?: string, "series"?: string[] }`, naming columns after any `fields` selection:
- `category`: the label column. Default: the first column.
- `x`: the X column of an XY (scatter) chart. Default: the second column, today's rule. On a chart type without an X axis it is dropped with a `chart-mapping-adapted` warning.
- `series`: the plotted columns, in order. Default: every column that is not `category` or `x`.

An unknown name is a `chart-mapping-unknown-column` error. A series that repeats the category or X column is a `chart-mapping-adapted` warning and is dropped. Mapping only reorders and selects columns; pie, doughnut and single-series constructs still plot one series (`series-dropped`, as today).

## Core runtime API

Exported from `@openpresentation/opf` and `@openpresentation/opf/data`:

```ts
/** Strict chart number: finite numbers, and strings in strict decimal syntax (trimmed). Everything else is null (a gap). */
export function chartNumber(value: unknown): number | null;
/** Format a number with a NumberFormat; an absent or invalid format prints the General form (String(value)). */
export function formatDataNumber(value: number, format?: string): string;
/** NumberFormat -> Excel format code ("General" when absent). Literal prefix/suffix text is quoted or escaped. */
export function excelNumberFormat(format?: string): string;
/** Excel format code -> NumberFormat, or undefined when the code has no exact NumberFormat equivalent (General -> undefined). */
export function numberFormatFromExcel(code: string): string | undefined;
/** Pure: a copy of the document where every chart and table DatasetRef is replaced by inline data (columns as DataColumn when a format applies, rows copied). `datasets` stays in place. Unknown ids are left as they are. */
export function inlineDatasets<T>(document: T): T;
/**
 * Resolve a chart's data to the canonical positional table: [category, (x,) ...series].
 * Category cells are kept as authored; X and series cells pass through chartNumber.
 * Inline ChartData, a DatasetRef (needs the document) and mapping are resolved here.
 */
export function resolveChartData(chart: Chart, document?: OPFDocument):
  | { ok: true; columns: string[]; formats: (string | undefined)[]; rows: (string | number | boolean | null)[][]; source?: DataSourceRef; dataset?: string; diagnostics: DataDiagnostic[] }
  | { ok: false; reason: "data-not-inline" | "dataset-unknown" | "no-rows" | "no-columns"; message: string; diagnostics: DataDiagnostic[] };
/** Resolve a table (inline or dataset-backed) to headers, rows and per-column formats. */
export function resolveTableData(table: Table, document?: OPFDocument):
  { columns: Table["columns"]; rows: TableCell[][]; formats: (string | undefined)[]; diagnostics: DataDiagnostic[] };
/** Display value of a table cell: a number with a format (cell, else column) becomes formatted text; anything else is returned unchanged. */
export function tableCellDisplayValue(cell: TableCell, columnFormat?: string): TableCell;
```

`DataDiagnostic` is `{ code, severity: "error" | "warning", path, message }`, with the codes above plus `chart-value-not-numeric`. `chartNumber` runs after variables are filled. Before filling, the validator does not warn on a `var:<id>` cell whose variable is a number.

Core composition, table layout and pagination accept dataset-backed tables and charts by inlining first. Table layout measures the formatted text. Markdown conversion, diff, merge, patch, audit and format keep the new fields.

## Engines

- **Preview (opf-render)** calls `inlineDatasets` and `resolveChartData`, and replaces its own `chartNumber` with core's. Data labels and value-axis tick labels use `formatDataNumber` with the series format; the value axis uses the first plotted series' format, as Excel does when the axis is source-linked. Table cells draw `tableCellDisplayValue`.
- **PPTX export (opf-pptx)** uses the same resolution and core `chartNumber` (its `parsedNumber` lenient parse is removed). It writes `excelNumberFormat` as the series `c:numCache/c:formatCode`, the data-label `c:numFmt` (`sourceLinked="0"`), the value-axis `c:numFmt` and the embedded workbook cell number formats. Table cells export their formatted text. Provenance keeps `datasets`, dataset references, `mapping`, formats and `source`, so a re-import restores the authored OPF.
- **PPTX import (opf-pptx)**, without provenance: a series `formatCode` that `numberFormatFromExcel` maps back becomes that column's `DataColumn.format`. Anything else is not invented and is reported.
- **Editor (opf-editor)**: the data grid edits charts and tables whose columns are `DataColumn` objects, keeping each format. It edits a dataset-backed target at `/datasets/<id>` and says how many items share the dataset. It offers a per-column number format and, for charts, the category, X and series mapping. Each edit is one undoable patch.

## Not in this change

- Resolving `ChartDataSource` or refreshing `source` ([opf#240](https://github.com/OpenPresentation/opf/issues/240)).
- Date axes and date formats.
- Per-series colours or chart types (combo charts).
- Formulas.
- Rich text in dataset cells.
