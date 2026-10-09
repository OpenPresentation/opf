# CSV and JSON data in OPF

Import CSV, TSV, and JSON as ordinary inline tables or charts. The resulting OPF stays editable in the browser and works with PPTX export without needing the original file.

## Editor

Click **Import data** in the editor toolbar. Paste data or select a `.csv`, `.tsv`, or `.json` file. Choose Table or Chart, review the slide preview, and import. Charts let you choose the category column and numeric series. You can insert a new slide or replace a selected table/chart, including one inside a nested block. Imports are one undoable operation.

The first CSV/TSV row supplies column names by default. Uncheck that option for headerless data. JSON supports:

- An array of records: `[{"Quarter":"Q1","Revenue":12},{"Quarter":"Q2","Revenue":18}]`.
- A matrix with a header row: `[["Quarter","Revenue"],["Q1",12],["Q2",18]]`.
- An explicit table: `{"columns":["Quarter","Revenue"],"rows":[["Q1",12],["Q2",18]]}`.

All record keys become columns in first-seen order. Missing record fields become null. Nested objects and arrays in cells must be flattened before import. Ragged rows, duplicate column names, malformed CSV, and invalid JSON produce errors.

CSV table values stay strings, preserving identifiers such as `001` and exact input text. JSON scalar cell types are retained. Chart series convert strict numeric strings to numbers. Blank, null, boolean, currency-formatted, percentage-formatted, and ambiguous numeric values are rejected as measures; they are never silently replaced with zero. Numeric category labels remain categories. Choose one nonnegative series for pie/donut charts.

The strict rule is core `chartNumber` (RR-54): a finite number, or a trimmed string in plain decimal syntax (`12`, `-3.5`, `0.25`, `1e6`). `12%`, `$5`, `(5)`, `1,234`, `1.234,5` and `Q1` are not numbers. Import rejects them; in an existing chart the preview and the PPTX export plot them as gaps and the validator warns `chart-value-not-numeric`. Keep the stored value plain (0.31, not `31%`) and put the display in a column format, `{ "name": "Margin", "format": "0%" }`; see [Chart and table data](chart-table-data.md).

### Datasets and provenance

Data that several charts or tables show can live once in the top-level `datasets` map and be referenced by id: `"chart": { "type": "line", "data": { "dataset": "revenue" } }`, `"table": { "dataset": "revenue", "fields": ["Quarter", "Revenue"] }`. A dataset (or inline chart data) records where it came from with `source`: `{ "src": "./data/revenue.csv", "sheet"?, "range"?, "fields"?, "retrieved": "2026-10-05", "description"? }`. Engines keep `source` through editing, export and re-import, and never read, fetch or refresh it; re-import to update the data.

The browser preview supports imported column, bar, line, area, pie, and donut charts, including multiple series for the first four types. Large tables or long labels can still need layout adjustments or pagination.

## CLI

Use the published [CLI 0.16.0](../packages/cli/README.md) on Node 24:

```sh
opf import-data revenue.csv --as table --output table.opf.json
opf import-data revenue.json --as chart --chart-type line --output chart.opf.json
opf import-data revenue.csv --as chart --category Quarter --series '["Revenue","Costs"]' --into deck.opf.json --in-place
opf import-data revised.csv --as table --into deck.opf.json --path /slides/0/blocks/0/table --output reviewed.opf.json
opf import-data revenue.csv --as chart --dataset revenue --into deck.opf.json --in-place
```

`--into` appends a new data slide unless `--path` names an existing content container's `/table` or `/chart` field. The parent must already exist. The complete resulting document must validate. Unrelated fields remain intact. Without `--output` or `--in-place`, the document goes to stdout for review or piping. Existing output files require `--force`.

Use `--format csv|tsv|json` to override format detection, `--delimiter ';'` for semicolon CSV, `--no-header` for row arrays without labels, `--columns '["Quarter","Revenue"]'` to select/reorder columns, and `--title` to name a new data slide. `--dataset <id>` (RR-54, in the CLI release after 0.10.0) writes the imported columns and rows into `datasets.<id>` (replacing an existing dataset's rows and columns and keeping its title, its description and the format of every column whose name is unchanged; `source` records the file, and keeps its other fields only when the same file is re-imported; data read from stdin records no `source`) and references it from the new table or chart instead of embedding a copy. `--series` and `--columns` accept JSON arrays so column names can contain commas. `-` reads data from stdin.

## Package API

```js
import {parseTabularData, importData} from '@openpresentation/opf/data';

const csv = 'Quarter,Revenue,Costs\nQ1,12,8\nQ2,18,10';
const table = importData(csv, {as: 'table', format: 'csv'});
const chart = importData(csv, {
  as: 'chart', format: 'csv', chartType: 'line',
  category: 'Quarter', series: ['Revenue', 'Costs'],
});
const document = {slides: [{title: 'Quarterly data', blocks: [table, chart]}]};
const data = parseTabularData(csv); // {columns, rows}, with CSV strings preserved
```

The functions also accept already-parsed JSON and are re-exported by `@openpresentation/opf-editor/data`. They are synchronous and browser-safe. Hosts read files with `File.text()` or Node's file APIs and pass their contents in. Neither function fetches URLs, resolves asset references, or reads files automatically.

This is an embedded data snapshot, not a live file link. Record the origin with `source` (see above). OPF has no chart data source by file or asset (`"data": { "src": ... }`); it was removed because no engine loaded it ([opf#240](https://github.com/OpenPresentation/opf/issues/240) is descoped), and the validator rejects it. Tables use inline `columns`/`rows` or a dataset; there is no `table.src` field. Re-import after a source changes.

`parseTabularData` and `importData` share the `@openpresentation/opf/data` entry with the chart and table data API: `chartNumber`, `formatDataNumber`, `toExcelNumberFormat`, `fromExcelNumberFormat`, `inlineDatasets`, `resolveChartData`, `resolveTableData` and `tableCellDisplayValue`.

These APIs are published in core 0.11.0 and re-exported by editor 0.8.0; CLI 0.10.0 and later include `import-data`. Use the coordinated Node 24 train with core 0.16.0, renderer 0.16.0, editor 0.16.0 and PPTX 0.16.0 for preview/export. Exact pins and compatibility boundaries are in the [compatibility matrix](compatibility-matrix.md) and [release plan](../release-plan.json).

## Verification

`node packages/javascript/test/data.mjs` checks parsing and mapping. `pnpm test:cli:packed` tests the installed CLI including data import. `pnpm test:data` verifies SVG series/signs and PPTX export/import. After `pnpm demo:editor`, open `/data-tests.html` on the editor server for file upload, preview, insertion, replacement, validation, and undo checks.
