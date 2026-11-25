# FR-05 design note: typed dataset columns (CR 2)

A builder's brief for item FR-05 of the format-requests program (`docs/programs/format-requests/burndown.md` on `main`). It settles
what the review card leaves open, so the item can be built without questions. It fits the FR-04 dataset shape (data sources and the flat
dataset), which lands first.

Who decided what:

- **Owner, 2026-11-24**: `cr2-role` (two roles, no `temporal`) and `cr2-unit` (`unit` is a label engines never print). Recorded in
  `decisions.md`.
- **Analysis, for the supervisor to confirm**: everything else in this note, marked *(analysis)* where it is a choice.

## The need

A column today is a name and an optional number format. A tool that picks a chart, sums a column or orders a time axis has to guess from
the name and the cells whether "Month" is time and whether "Revenue" can be added up. Data ingest knows the answer when it reads a typed
source (a database column, a spreadsheet's cell types) and has nowhere to write it. A column may now say what its cells hold and what it
is for.

## Schema

### A new definition, `DatasetColumn` *(analysis)*

`DataColumn` is shared by three places: dataset columns, inline chart data columns and table column headers. A table header is display:
a type or a role means nothing there. So the new keys go on a new definition, used where data lives, and the table header keeps
`DataColumn`.

| Where | Today | After |
| --- | --- | --- |
| `Dataset.columns[]` | `string` or `DataColumn` | `string` or `DatasetColumn` |
| `ChartData.columns[]` (inline chart data) | `string` or `DataColumn` | `string` or `DatasetColumn` |
| `Table.columns[]` (headers) | `string`, `DataColumn`, ... | unchanged |

`DataColumn` is closed (`additionalProperties: false`), so `DatasetColumn` repeats its two properties rather than extending it with
`allOf`, which a closed schema does not compose with. A test pins that `DatasetColumn`'s `name` and `format` stay identical to
`DataColumn`'s.

```json
"DatasetColumn": {
  "type": "object",
  "additionalProperties": false,
  "required": ["name"],
  "description": "A named data column: a dataset column or an inline chart data column. Adds to DataColumn what its cells hold (type), what it is for (role) and a unit label. The string form is { \"name\": value } with nothing declared.",
  "properties": {
    "name": { "type": "string", "description": "Column label, used as the series name, the table header and the name 'fields', 'chart.mapping' and data links address." },
    "format": { "$ref": "#/$defs/NumberFormat", "description": "Number format of the column's number values. Absent: the General form." },
    "type": {
      "type": "string",
      "enum": ["text", "number", "date", "boolean"],
      "description": "What the column's cells hold. text: strings. number: numbers. date: time labels (a year, a period, a month, a week or a date, as the time-order rule reads them). boolean: true or false. null is a gap in any type. A cell of another kind is a 'data-cell-type' warning. Absent: undeclared, read from the cells as today."
    },
    "role": {
      "type": "string",
      "enum": ["dimension", "measure"],
      "description": "What the column is for. dimension: it labels or groups rows (a region, a product, a month). measure: its values are measured and can be aggregated (revenue, count, rate). Time is type 'date' with role 'dimension'. Absent: undeclared."
    },
    "unit": {
      "type": "string",
      "minLength": 1,
      "description": "The unit of the column's values, as a label for tools: 'USD', 'ms', 'people'. Engines never print it; 'format' alone decides how a number is drawn."
    }
  },
  "examples": [
    { "name": "Month", "type": "date", "role": "dimension" },
    { "name": "Revenue", "format": "$#,##0", "type": "number", "role": "measure", "unit": "USD" }
  ]
}
```

Generated types: `DatasetColumn` in core's types, and `Dataset.columns` and the inline `ChartData.columns` move to it. Core's resolved
chart data (`ResolvedChartData`) gains a `types` array aligned with `columns`, as `formats` is today, so engines and FR-06 read one form.

### What each type accepts in a cell

| `type` | Cells that match | Notes |
| --- | --- | --- |
| `text` | a string | |
| `number` | a finite number | A string, even `"12"`, does not match. *(analysis: strict, so a typed column means what it says; the safe fix below converts the strict-decimal strings)* |
| `date` | a string the time-order rule (`chart-time-order.ts`) reads as a year, period, week, month or date; or an integer year from 1800 to 2200 | So `"2026-03"`, `"Q1 2026"`, `"FY26"`, `"Jan"`, `"2026-03-15T09:30:00Z"` and `2026` all match. *(analysis: reuse the parser core already has rather than define a second date grammar; ISO 8601 alone would turn every "Q1" deck into warnings)* |
| `boolean` | `true` or `false` | |
| any | `null` | A gap, never a mismatch. |

Date-times: the time-order rule reads dates; the builder extends its `date` family to accept an ISO 8601 date-time (`YYYY-MM-DDThh:mm`,
with optional seconds and zone), keyed by the instant. A test covers it.

## Rules

| Id | Severity | When | Message | Path |
| --- | --- | --- | --- | --- |
| `data-cell-type` | warning | A cell's value does not match its column's declared `type` | `Row {r} of dataset "{id}" holds {shown} in column "{name}", which is typed {type}.` (inline chart data: `Row {r} of this chart's data ...`) | `/datasets/{id}/rows/{r}/{c}`, or `/slides/{s}/.../chart/data/rows/{r}/{c}` |

- No error: a mismatched cell is advice, as the program's README fixes ("a cell that does not match its column type" is a warning). The
  warning has no conformance case.
- One finding per column, not per cell, when more than 5 cells of a column mismatch: `{n} cells of column "{name}" ... first at row {r}`.
  *(analysis: a 2,000-row ingest of the wrong type would otherwise bury every other finding)*
- **Safe fix** (`opf fix`, safe class): in a `number` column, a string in strict decimal syntax (`"12"`, `"-3.5"`, `"1e6"`: the syntax
  chart values already accept) becomes the number; in a `text` column, a finite number becomes its shortest decimal string. Nothing else
  is fixed: `"12%"` in a number column stays and keeps its warning. A fix never changes a column's declared type.
- No rule for `role` with `type`: two roles leave no invalid combination (the reason for `cr2-role`). `role: "measure"` with
  `type: "text"` is allowed (a measure that is counted, not summed); FR-06 refuses to sum it.
- No rule for `unit`.
- A `format` on a `text`, `date` or `boolean` column stays valid and unused, as a format on a string cell is today.

## What engines do with the keys

| Consumer | Behavior |
| --- | --- |
| Preview and PowerPoint drawing | Unchanged. A typed column draws exactly as the same column untyped: same values, same format, same axis. A deck without the keys draws and exports byte for byte as before. |
| Time order (`chartCategoriesInTime`) | Reads the declared type first. The category column `type: "date"`: the categories are time ordered when they run forward under the existing family rules, and the title fallback is skipped (the declaration says time). `type: "text"` or `"boolean"`: not time ordered, whatever the labels look like. `type: "number"` or undeclared: today's rule. Only the decision changes; nothing draws differently for an undeclared column. |
| Chart values | Unchanged. A number column with a string cell still reads it in strict decimal syntax, as today; the type only adds the warning. |
| FR-06 data links | `sum`, `mean`, `min` and `max` refuse a column typed `text` or `boolean` (FR-06's `metric-data-aggregate` warning). `min`, `max`, `first`, `last` and `count` work on a `date` column. Undeclared columns behave as FR-06 says for untyped cells. |
| `unit` | Never printed. Tools may compare units before combining columns; core does not. |

## Data ingest

`opf ingest` (and core's ingest helper, where the CLI's lives) fills the three keys when it can tell:

- From a CSV: `type` from the cells (every non-empty cell a strict decimal number: `number`; every one a time label: `date`; `true`/`false`:
  `boolean`; else `text`). `role`: `measure` for a `number` column that is not the first column and not a time label; `dimension` otherwise.
  No `unit`.
- From a typed source a host reads (a database result, a workbook's cell types), the host writes them; the docs say how.
- Ingest writes numbers as numbers, so a typed number column it writes never warns.

*(analysis: the heuristic above is a starting point for ingest, not a rule of the format; a host may type differently.)*

## PowerPoint export and import

Nothing drawn changes, so the native parts are unchanged. The keys travel in the tags.

- **Where they are stored.** Datasets travel in `OPF_DATASETS_V1` (the whole `datasets` map) and inline chart data in `OPF_DATA_V1` on
  the chart frame. A released 0.36.0 importer validates both records as OPF and drops a record whose columns carry a key it does not know:
  every dataset in the file, or that chart's authored data, then falls back to the native values.
- **Recommendation** *(analysis, for the supervisor to confirm)*: follow what FR-04 does with its own keys. If FR-04 accepts the loss for
  0.36.0 importers (its tracker entry says so), typed columns accept it too: the keys stay inline in both records, and the release notes
  say a 0.36 importer reading a 0.37 file restores no dataset that has typed columns or data sources. This is the simple path and costs
  nothing a 0.36 reader drew, because charts and tables keep the values they show.
- **If the supervisor wants typed-only decks readable by 0.36.0**: write the records with `DataColumn` objects (no `type`, `role`,
  `unit`) and add the stripped keys to a new tag, `OPF_COLUMN_TYPES_V1`, which a 0.36.0 importer ignores as an unknown whole tag. On
  `p:presentation` beside the datasets tag: `{ "v": 1, "datasets": { "<id>": [[columnIndex, columnName, { "type", "role", "unit" }], ...] } }`;
  on a chart frame beside its data tag: `{ "v": 1, "columns": [[columnIndex, columnName, {...}], ...] }`. Import puts each back only
  while the column at that index still has that name. Worth it only if typed columns often appear without data sources.
- **Round trip**: every key comes back after PowerPoint's own save, as the existing data tags do. An export with provenance off drops them
  with the rest of the data record (the existing `data-provenance-omitted` path).
- **Native check**: one file, a dataset with all four types and both roles behind a chart and a table, saved by PowerPoint and imported.
  The released 0.36.0 importer imports the file as a valid deck.

## Editor

- The data panel's column header gets a type and role control (a select each) and a unit field, under the existing format field.
- Changing a type re-runs validation; the mismatch warning shows on the cells as the chart value warning does.
- Paste and import of CSV into the data panel run the ingest heuristic for new columns only; existing declarations are kept.
- The editor's patch helpers keep the keys through every edit of a column (rename, reorder, delete of another column).

## Markdown and YAML

Datasets live in the front matter (YAML) and in JSON blocks; the keys round-trip as plain properties. The round-trip test covers a column
with all three keys and a string column beside it, and checks that a string column is not rewritten as an object.

## Docs and skills

- `docs/chart-table-data.md`: a "Typed columns" section with the table of types above, the time-order rule, and why `unit` is not printed.
- The author skill's data reference: one example with a date dimension and a USD measure.
- `docs/validate.md`: the `data-cell-type` warning and its fix.

## Examples

Valid, in the example deck the item adds (it can share FR-06's deck):

```json
{
  "name": "Typed columns",
  "datasets": {
    "revenue": {
      "columns": [
        { "name": "Month", "type": "date", "role": "dimension" },
        { "name": "Region", "type": "text", "role": "dimension" },
        { "name": "Revenue", "format": "$#,##0", "type": "number", "role": "measure", "unit": "USD" },
        { "name": "On plan", "type": "boolean", "role": "dimension" }
      ],
      "rows": [
        ["2026-09", "EMEA", 11500, true],
        ["2026-10", "EMEA", 12100, true],
        ["2026-11", "EMEA", null, false]
      ]
    }
  },
  "slides": [ { "title": "EMEA revenue", "chart": { "type": "line", "data": { "dataset": "revenue", "fields": ["Month", "Revenue"] } } } ]
}
```

Warns (valid, one `data-cell-type` at `/datasets/revenue/rows/1/2`; the safe fix makes it `12100`):

```json
{ "datasets": { "revenue": {
  "columns": [ { "name": "Month", "type": "date" }, { "name": "Revenue", "type": "number" } ],
  "rows": [ ["2026-09", 11500], ["2026-10", "12100"] ] } },
  "slides": [ { "title": "Revenue" } ] }
```

Invalid (schema error at `/datasets/revenue/columns/1/type`):

```json
{ "datasets": { "revenue": {
  "columns": [ "Month", { "name": "Revenue", "type": "currency" } ],
  "rows": [ ["2026-09", 11500] ] } },
  "slides": [ { "title": "Revenue" } ] }
```

Conformance: two valid decks (a dataset and inline chart data, each typed), one invalid (the enum above). The warning gets no case.

## Edge cases

| Case | Answer |
| --- | --- |
| A string column (`"Month"`) beside typed ones | Undeclared; nothing changes for it. |
| `type` set, `role` absent (or the reverse) | Valid; each key stands alone. |
| A date column whose labels run backwards (2026, 2025, 2024) | Typed as time, but not "forward", so the last point is not the latest: no automatic last-point emphasis, as today. |
| A date column mixing families (`"Q1 2026"`, `"2026-05"`) | Each cell matches (each is a time label), so no warning; the time-order rule says not in order (one family required), as today. |
| `null` in any typed column | A gap; no warning. |
| A typed column in a dataset no chart uses | Validated the same; the warning still applies. |
| Inline chart data typed, then moved into a dataset by the editor | The declarations move with the columns. |
| `fields` selects a subset of typed columns | The resolved data carries the selected columns' types in the selected order. |
| A boolean measure | Allowed. FR-06 can `count` it; `sum` refuses. |
| `unit` on a text column | Allowed; tools may use it ("ISO 4217 code"). |

## Decisions the card leaves open, with the option taken

| Question | Option taken | Why |
| --- | --- | --- |
| Do the keys go on `DataColumn` or a new definition? *(analysis)* | A new `DatasetColumn` for datasets and inline chart data; table headers keep `DataColumn` | A type on a table header has no meaning and no rule to check it. |
| What is a `date` cell? *(analysis)* | Whatever the time-order rule reads as time, plus ISO date-times and integer years | One date grammar in core, and real decks write "Q1" and "Jan". |
| Is `"12"` a number? *(analysis)* | No, a warning with a safe fix | A declared type is a promise; the fix keeps it cheap to honor. |
| Does a typed column change drawing? *(analysis)* | No, only the time-order decision and FR-06's refusal | A deck must draw as before unless its author asks for a change. |
| One warning per cell or per column? *(analysis)* | Per cell up to 5, then one per column | Large ingests stay readable. |
| Does ingest fill the keys? | Yes, from the cells | The card's value list says ingest fills them in. |
| Storage in PowerPoint tags *(analysis, supervisor to confirm)* | Follow FR-04: inline if FR-04 accepted the 0.36 loss; else a side tag | Consistency with the item that lands first. |
