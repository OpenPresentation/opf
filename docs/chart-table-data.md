# Chart and table data: numbers, formats, datasets and series mapping

Status: RR-54 (release readiness). Additive schema plus one behaviour fix (strict chart numbers). Ships in the next lockstep release: core first, then renderer and PPTX, then editor. This page is the contract the four packages implement; change it here first.

## Decisions (vetoable)

Recorded 2026-10-05 for the owner, who asked for all five recommendations of the chart/table data review at once:

1. **One strict chart number rule in core.** The preview read `"12%"` as a gap and `"1e6"` as 1000000; the exporter stripped every non-numeric character (`"1e6"` became 16, `"(5)"` became 5, `"Q1"` became 1). Both engines now call core `chartNumber`, which follows the existing data-import rule. A string that is not a strict decimal number is a gap in both engines and a `chart-value-not-numeric` warning, never a guessed value. Decks whose chart cells held `"12%"` or `"$5"` export a gap where they used to export 12 or 5.
2. **`ChartDataSource` is removed from the schema.** No engine resolved it ([opf#240](https://github.com/OpenPresentation/opf/issues/240), descoped), so the format-audit program (FA-07, 2026-10-06) deleted it, with its `chart-data-source-unresolved` warning. A future data-resolver design re-adds it when it is built. Inline data records where it came from with `data.source`, which engines never read.
3. **Number formats use the variables syntax.** One pattern language for `NumberVariable.format`, column formats and cell formats. Core converts it to an Excel format code for the PPTX export and back on import.
4. **Datasets are top-level and shared.** A chart or a table references one with `{ "dataset": "<id>" }`. Core inlines references before composition, so the engines keep plotting and laying out inline data.
5. **Series mapping is by column name.** `chart.mapping` picks the category, X and series columns. Absent keeps today's positional rule exactly.

A document that uses none of the new fields validates, previews and exports byte-for-byte as before, except for decision 1 on non-numeric strings.

## Schema

### Number formats

`NumberFormat` is a string with the `NumberVariable.format` syntax: an optional literal prefix, a numeric part made of `#`, `0`, `,` (grouping) and `.` (decimals), and an optional literal suffix. A `%` in the prefix or suffix multiplies the value by 100. Examples: `#,##0`, `0.0%`, `$#,##0.00`, `#,##0 units`. An invalid pattern is a `number-format-invalid` error. A format applies only to number values; strings, booleans, `null` and rich runs display unchanged.

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
  "columns": ["Region", { "name": "Revenue", "format": "$#,##0.0" }, { "value": "Growth", "style": { "align": "right" }, "format": "0%" }],
  "rows": [["EMEA", 8.2, 0.4], ["APAC", 6.1, { "value": 0.52, "format": "0.0%" }]]
}
```

### Data source provenance

`DataSourceRef` is `{ "src": string, "sheet"?, "range"?, "fields"?: string[], "retrieved"?: string (ISO date or date-time), "description"?: string }`. It records where inline data or a dataset came from. Engines never read, fetch or refresh it; they keep it through editing, export and re-import. It may appear as `ChartData.source` and `Dataset.source`.

There is no chart data source by file or asset (`chart.data` with `src`, `sheet`, `range`, `columns`): that form is removed (opf#240, descoped) and is a schema error. Import the data inline with `columns`/`rows` and record its origin in `source`.

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

Rows hold `ChartDataCell` scalars (string, number, boolean, null). A `DatasetRef` is `{ "dataset": "<id>", "fields"?: string[] }`; `fields` selects and orders columns by name, each at most once (a repeated name is a schema error).
- **Chart:** `chart.data` may be a `DatasetRef`. It is the second `oneOf` branch beside `ChartData`.
- **Table:** a table is either inline (`rows` required, optional `columns`) or dataset-backed (`dataset` required, optional `fields`, and no `rows` or `columns`). Dataset tables take their headers and column formats from the dataset; per-cell styles need an inline table.

Validation:
- an unknown dataset id is a `dataset-unknown` error;
- an unknown field is a `dataset-field-unknown` error;
- duplicate column names in a dataset, or in chart data that a `mapping` or `fields` addresses, are a `data-column-duplicate` error;
- a dataset nothing references is the warning `opf/unused-dataset` (category `references`).

### Series mapping

`chart.mapping` is `{ "category"?: string, "x"?: string, "series"?: string[] }`, naming columns after any `fields` selection:
- `category`: the label column. Default: the first column.
- `x`: the X column of an XY (scatter) chart. Default, today's rule: the second column (the first when `category` names the second), and only when the chart has three or more columns. With two columns there is no X column: the second column is the one series, plotted against row numbers. An `x` that leaves no series (two columns, or every series dropped) is a `chart-mapping-adapted` warning and that column is plotted as the series. A chart is XY when its type resolves (deprecated ids through their replacement) to the scatter construct of `chartOptionTarget`. An `x` equal to the category is a `chart-mapping-adapted` warning and the default is used. On a chart type without an X axis it is dropped with a `chart-mapping-adapted` warning.
- `series`: the plotted columns, in order. Default: every column that is not `category` or `x`.

An unknown name is a `chart-mapping-unknown-column` error. A series that repeats the category or X column is a `chart-mapping-adapted` warning and is dropped. Mapping only reorders and selects columns; pie, doughnut and single-series constructs still plot one series (`series-dropped`, as today).

## Core runtime API

Exported from `@openpresentation/opf` and `@openpresentation/opf/data` (module `src/chart-data.ts`; the resolvers are also on `@openpresentation/opf/composition`). Inputs are typed `unknown` so engines can pass any parsed chart, table or document; the result types are exported (`ResolvedChartData`, `ResolvedTableData`, `DataDiagnostic`, `DataColumn`, `DataSourceRef`, `Dataset`, `DatasetRef`, `ChartMapping`, `DataCellValue`, `DataTableCell`, `DataTableHeader`, `DataStyledCell`).

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
/** Pure: a copy of the document where every chart and table DatasetRef is replaced by inline data (columns as DataColumn when a format applies, rows copied; a chart also takes the dataset's `source`). `datasets` stays in place. Unknown ids, and references naming an unknown field, are left as they are. */
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
export function resolveChartData(chart: unknown, document?: unknown, options?: { path?: string }):
  | { ok: true; columns: string[]; hasX: boolean; formats: (string | undefined)[]; rows: (string | number | boolean | null)[][]; source?: DataSourceRef; dataset?: string; diagnostics: DataDiagnostic[] }
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

`validate` reports the codes as `opf/<code>` rule ids: the errors are `format` findings, `opf/chart-value-not-numeric` and `opf/chart-mapping-adapted` are `content` warnings, `opf/chart-data-source-unresolved` is a `references` warning, and `references` adds `opf/unused-dataset`. The raw schema issue of a finding is in its `validation` field (`validation.params.code`).

### Migration help

Decks written before the strict rule often hold display text in chart cells. When every text cell of a value column (an X or series column, or a lone column) is written in one display style that a NumberFormat reproduces exactly, `suggestChartNumberFix` returns the fix, and `validate` attaches it to each of the column's `opf/chart-value-not-numeric` warnings as `fixes: [{ id: "store-chart-numbers", title, kind: "patch", safe: false, patch }]` (a [finding fix](finding-schema-reference.md); core never applies it):

- `"12%"`, `"8.5%"` become 0.12 and 0.085 with the column format `0.#%`;
- `"$1,234"`, `"$56"` become 1234 and 56 with `$#,##0` (also `€`, `£`, `¥`);
- `"1,234.5"`, `"999"` become 1234.5 (the plain number stays) with `#,##0.##`.

The patch replaces each text cell with its number and the column with a `DataColumn` that has the format; a dataset column is fixed in the dataset, so every chart and table that uses it changes, and its tables show the same text. A style is one optional leading minus, one optional currency symbol, digits (grouped in threes or plain), optional decimals and an optional `%`. There is no fix when the column already has a format, when styles are mixed (`"12%"` beside `"$5"` or beside the number 0.5), for accounting negatives `"(5)"`, `"$-5"`, a decimal comma (`"1.234,5"`), units (`"5 units"`), `".5"` or `"007"`, for mixed grouping (`"1,234"` beside `"5678"`), or when one format cannot show every value as written (`"$5"` beside `"$5.50"`). Every fixed value is checked: `formatDataNumber(value, format)` equals the text as written.

Core composition, table layout and pagination accept dataset-backed tables and charts by inlining first. Table layout measures the formatted text. Markdown conversion, diff, merge, patch, validate and format keep the new fields. In detail:

- `composeSlide` inlines a dataset-backed `table` or `chart` from `options.presentation.datasets`, so the composed item's `value` (and `payload`) is the inline copy; the item `path` still points at the authored field. `layoutTable(value, box, { presentation })` does the same, and each body cell's `TableCellLayout.value` is its display value (`tableCellDisplayValue`); `input` stays the authored cell. A DataColumn header shows its `name` (`path` ends in `.name`).
- `paginateSlide`/`paginate` validate a slide with the deck's `datasets` (and `references`). A dataset table that has to be split is written to the continuation slides as inline tables (the slide that fits is returned unchanged, with its reference).
- `convertContent` keeps a dataset reference between chart and table (`fields` too; `mapping` is reported as lost) and needs `options.presentation` to convert a dataset table to any other kind. Inline conversions keep DataColumn formats and report lost number formats and `source`. Slide-level conversions validate with the document's datasets; slide-only structure edits skip the dataset checks they cannot make.
- Markdown writes the new fields in its embedded YAML form (lossless); `datasets` go to the front matter. `format` orders `datasets`, `mapping`, `source` and `DataColumn` keys by the schema. `diff` reports changes under `datasets` in their own category. The chart rules of `validate` read resolved chart data (DataColumn names, dataset charts).
- Variables: `resolveVariables` walks `datasets` like any other content, so `{{id}}` tokens and whole `var:<id>` cells in dataset rows are filled before engines inline the reference.
- `opf import-data --dataset <id>` (CLI) writes the imported columns and rows into `datasets.<id>` and references it. Re-importing into an existing dataset keeps its title, description and the format of each column whose name is unchanged; `source.src` names the imported file relative to the deck file's folder with `/` separators (stdin: no source), and `source.retrieved` is set only by `--date YYYY-MM-DD`; the command never reads the clock.
- The generated `Table` type now has `rows?` (a dataset table has none) and `dataset?`/`fields?`; TypeScript callers that read `table.rows` handle the dataset form (or call `resolveTableData`).

## Engines

All three engines read core's functions when they exist and fall back to their previous behaviour on a core without RR-54, so each can ship before or after core. A document that uses none of the new fields renders, exports and edits byte for byte as before (renderer: all 805 slides of the core examples; PPTX: 21 golden digests; editor: identical patches).

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
- **Provenance:** in `full` mode, `OPF_DATASETS_V1` holds the `datasets` map. `OPF_DATA_V1` sits on each chart or table frame that uses a new field and holds the authored `data`, `mapping` and table form (and, FA-14, a chart's `highlight`, which then also records its inline `data`; see [chart-options.md](chart-options.md)), plus a hash of the cached names, values and format codes. `references-only` mode and `provenance: false` write neither tag.

### PPTX import (opf-pptx)

- **With provenance:** `datasets` is restored before document provenance validates. A frame's dataset reference, `mapping`, formats and `source` are restored only while the cache hash still matches. If PowerPoint (or a person) changed the values, the native values import and a diagnostic says why, such as `chart-data-provenance-changed` or `table-dataset-unavailable`. The hash compares format codes in core's canonical form (`fromExcelNumberFormat`), so PowerPoint's re-spellings on save (`\$#,##0.0` for `$#,##0.0`, `#,##0\ "units"` for `#,##0 "units"`, native check [opf#385](https://github.com/OpenPresentation/opf/pull/385)) still match; a General code counts as no code.
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
- **Import:** "Store as a shared dataset" (`prepareDatasetImport`) imports into `datasets.<id>`, as `opf import-data --dataset` does.
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

- Resolving a data source by file or asset, or refreshing `source` ([opf#240](https://github.com/OpenPresentation/opf/issues/240)).
- Date axes and date formats.
- Per-series colours. (Columns with line series, optionally on a secondary axis, are the `combo` chart type: [chart-options.md](chart-options.md#combo-charts).)
- Formulas.
- Rich text in dataset cells.
