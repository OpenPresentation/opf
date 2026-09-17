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

The browser preview supports imported column, bar, line, area, pie, and donut charts, including multiple series for the first four types. Large tables or long labels can still need layout adjustments or pagination.

## CLI

Use the [installable CLI preview](../packages/cli/README.md):

```sh
opf import-data revenue.csv --as table --output table.opf.json
opf import-data revenue.json --as chart --chart-type line --output chart.opf.json
opf import-data revenue.csv --as chart --category Quarter --series '["Revenue","Costs"]' --into deck.opf.json --in-place
opf import-data revised.csv --as table --into deck.opf.json --path /slides/0/blocks/0/table --output reviewed.opf.json
```

`--into` appends a new data slide unless `--path` names an existing content container's `/table` or `/chart` field. The parent must already exist. The complete resulting document must validate. Unrelated fields remain intact. Without `--output` or `--in-place`, the document goes to stdout for review or piping. Existing output files require `--force`.

Use `--format csv|tsv|json` to override format detection, `--delimiter ';'` for semicolon CSV, `--no-header` for row arrays without labels, `--columns '["Quarter","Revenue"]'` to select/reorder columns, and `--title` to name a new data slide. `--series` and `--columns` accept JSON arrays so column names can contain commas. `-` reads data from stdin.

## Package API

```js
import {parseTabularData, createDataContent} from '@openpresentation/opf/data';

const csv = 'Quarter,Revenue,Costs\nQ1,12,8\nQ2,18,10';
const table = createDataContent(csv, {as: 'table', format: 'csv'});
const chart = createDataContent(csv, {
  as: 'chart', format: 'csv', chartType: 'line',
  category: 'Quarter', series: ['Revenue', 'Costs'],
});
const document = {slides: [{title: 'Quarterly data', blocks: [table, chart]}]};
const data = parseTabularData(csv); // {columns, rows}, with CSV strings preserved
```

The functions also accept already-parsed JSON and are re-exported by `@openpresentation/opf-editor/data`. They are synchronous and browser-safe. Hosts read files with `File.text()` or Node's file APIs and pass their contents in. Neither function fetches URLs, resolves asset references, or reads files automatically.

This is an embedded data snapshot, not a live file link. OPF's existing `ChartDataSource` can declare a source reference, but source loading/refresh is a separate host responsibility. Tables use inline `columns`/`rows`; there is no new unsupported `table.src` field. Re-import after a source changes. These APIs are in the local coordinated preview packages; check package versions before using a previously published release.

## Verification

`node packages/javascript/test/data.mjs` checks parsing and mapping. `pnpm test:cli:packed` tests the installed CLI including data import. `pnpm test:data` verifies SVG series/signs and PPTX export/import. After `pnpm demo:editor`, open `/data-tests.html` on the editor server for file upload, preview, insertion, replacement, validation, and undo checks.
