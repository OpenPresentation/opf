# FR-06 design note: a metric computed from data (CR 4)

A builder's brief for item FR-06 of the format-requests program (`docs/programs/format-requests/burndown.md` on `main`). It settles what
the review card leaves open. It builds on FR-04 (data sources and the flat dataset) and FR-05 (typed columns,
`docs/plans/format-requests/fr-05-typed-columns.md` on this branch), and lands after both.

Who decided what:

- **Owner, 2026-11-24**: the change is part of the metric and optional ("delta is intrinsically tied to the metric ... also delta is
  optional"); one link shape for metric and variable (`cr4-shape`); a filter is a list of `{ field, op, value }` (`cr4-filter`); a bound
  metric keeps its literal as the last computed value (`cr4-literal`).
- **Owner, 2026-11-25** (review round 2, confirming the supervisor's delegated picks): the link is called `data`; all three ways of
  computing the change, **plus a fixed value**; `better`; the arrow follows the computed change when `trend` is not typed.
- **Analysis, for the supervisor to confirm**: everything else, marked *(analysis)*.

## The need

A KPI on a slide is a typed number. When the data changes, the KPI, its change and its arrow disagree with the table beside it until
someone retypes them, and a refresh that turns growth into decline leaves a green arrow pointing up. A metric gets a link to rows the deck
already holds: core computes the value and, optionally, the change from them, and the arrow and its color follow.

## Schema

Four new definitions and two new metric properties.

```json
"DataCondition": {
  "type": "object",
  "additionalProperties": false,
  "required": ["field", "op", "value"],
  "description": "One condition on a row: the row's cell in 'field' compared with 'value'. Nothing is parsed or evaluated.",
  "properties": {
    "field": { "type": "string", "description": "A column name of the linked dataset. An unknown name is a 'dataset-field-unknown' error." },
    "op": { "type": "string", "enum": ["=", "!=", "<", "<=", ">", ">=", "in"] },
    "value": {
      "description": "The value to compare with. For 'in', a list of values.",
      "oneOf": [
        { "$ref": "#/$defs/ChartDataCell" },
        { "type": "array", "items": { "$ref": "#/$defs/ChartDataCell" }, "minItems": 1 }
      ]
    }
  }
},
"DataFilter": {
  "type": "array",
  "items": { "$ref": "#/$defs/DataCondition" },
  "minItems": 1,
  "description": "Conditions a row must all meet (AND). No OR, no expressions: a host that needs more writes a column that holds it."
},
"DataLink": {
  "type": "object",
  "additionalProperties": false,
  "required": ["dataset", "field", "aggregate"],
  "description": "A number computed from a dataset of this deck: 'aggregate' over the cells of 'field' in the rows that meet 'filter'. Engines compute it from the embedded rows and never fetch. Shared by every content that can be linked to data.",
  "properties": {
    "dataset": { "$ref": "#/$defs/DatasetId", "description": "Id of the dataset. An unknown id is a 'dataset-unknown' error." },
    "field": { "type": "string", "description": "The column whose cells are aggregated. An unknown name is a 'dataset-field-unknown' error." },
    "aggregate": { "type": "string", "enum": ["sum", "mean", "min", "max", "count", "first", "last"] },
    "filter": { "$ref": "#/$defs/DataFilter" }
  }
},
"MetricData": {
  "type": "object",
  "additionalProperties": false,
  "required": ["dataset", "field", "aggregate"],
  "description": "A DataLink for a metric, with an optional change. The DataLink properties, repeated because both definitions are closed, plus 'delta'.",
  "properties": {
    "dataset": { "$ref": "#/$defs/DatasetId" },
    "field": { "type": "string" },
    "aggregate": { "type": "string", "enum": ["sum", "mean", "min", "max", "count", "first", "last"] },
    "filter": { "$ref": "#/$defs/DataFilter" },
    "delta": { "$ref": "#/$defs/MetricDelta" }
  }
},
"MetricDelta": {
  "type": "object",
  "additionalProperties": false,
  "description": "How the metric's change is computed: against the previous row ('compare': \"previous\"), against a baseline ('compare': { filter }), against a fixed number ('compare': { value }), or read from a column that already holds it ('field'). Exactly one of 'compare' and 'field'.",
  "oneOf": [ { "required": ["compare"] }, { "required": ["field"] } ],
  "properties": {
    "compare": {
      "oneOf": [
        { "const": "previous" },
        { "type": "object", "additionalProperties": false, "required": ["filter"], "properties": { "filter": { "$ref": "#/$defs/DataFilter" } } },
        { "type": "object", "additionalProperties": false, "required": ["value"], "properties": { "value": { "$ref": "#/$defs/FiniteNumber", "description": "A fixed number to compare with: a plan, a budget, last year's figure typed in." } } }
      ]
    },
    "field": { "type": "string", "description": "A column that holds the change. An unknown name is a 'dataset-field-unknown' error." },
    "as": { "type": "string", "enum": ["difference", "percent"], "default": "difference" },
    "format": { "$ref": "#/$defs/NumberFormat", "description": "How the change is drawn, usually with sign sections ('+0.0;-0.0;0', '+0%;-0%;0%'). Absent: see the default below." }
  }
}
```

On `Metric`:

```json
"data": { "$ref": "#/$defs/MetricData", "description": "Computes the value and, optionally, the change from a dataset of this deck. While it resolves, engines draw the computed numbers; 'value' and 'delta' are then the last computed numbers, kept for readers that do not compute." },
"better": { "type": "string", "enum": ["up", "down"], "description": "Which direction of change is good. Without 'sentiment', an up trend is positive and a down trend negative when 'better' is \"up\" (the default), and the reverse when it is \"down\". An explicit 'sentiment' still wins." }
```

- `value` stays required, so every reader that does not compute still draws a number. *(Owner, `cr4-literal`.)*
- `DataLink` is defined now and used by nothing but its shape inside `MetricData`, so a variable can take `data` later (CR 13, a study
  for 0.38) without a second shape. A test pins that `MetricData` minus `delta` equals `DataLink`. *(analysis: closed schemas do not
  compose with `allOf`, the same reason as FR-05.)*
- `better` is valid on any metric, linked or not: it also colors a typed `trend` (churn typed `"down"` with `better: "down"` is green).
  *(analysis)*

Generated types: `DataCondition`, `DataFilter`, `DataLink`, `MetricData`, `MetricDelta`, and `Metric.data`, `Metric.better`.

## Proposed, waiting for the owner's pick: `Metric.format`

From the key-names study (`key-names-study.md` in this folder, finding A4, decision `k-metric-format`). **Build it only if the owner has
picked "add"; the supervisor says so in the builder's brief.**

```json
"format": { "$ref": "#/$defs/NumberFormat", "description": "How a number 'value' is written, the same pattern language as a number variable, a dataset column and a table cell ('0.0%', '$#,##0.0M'). A string 'value' is drawn as written. Absent: a linked metric uses its column's format, and an unlinked one today's number rules (grouping by the slide's language)." }
```

- **Precedence, one line:** `metric.format`, else the linked column's `format`, else today's number rules.
- It applies to `value` only. The change keeps its own format (`data.delta.format`, else the defaults below); a typed numeric `delta` on an
  unlinked metric is drawn with sign sections built from `metric.format` when there is one, else as today.
- `unit` is still printed after the value, as today. New rule:

| Id | Severity | When | Message | Path |
| --- | --- | --- | --- | --- |
| `metric-unit-repeated` | warning | The metric has a `unit`, and the format that draws its value (its own, or the linked column's) already prints that same text as a literal prefix or suffix (compared after trimming, case-sensitively) | `The metric's unit "{unit}" is already printed by its number format "{format}", so it is drawn twice.` | `/.../metric/unit` |

- The stale-value comparison (`metric-data-stale`) uses the format that draws the value.
- A percent format multiplies by 100, as everywhere: `{ "value": 0.044, "format": "0.0%" }` draws "4.4%".
- PowerPoint: `format` is stored in the metric's record as authored, beside its other keys, also on an unlinked metric (see "PowerPoint
  export and import"; in the careful form built before the owner's direction it sits in the top-level `link` key).
- The gauge's end labels (part 3) use the same precedence.

## Computing

Core gets one function, `resolveMetric(metric, datasets, options)`, returning the metric to draw (`value`, `delta`, `trend`, `sentiment`
resolved) and its diagnostics. Composition calls it before measuring, so layout measures the text that is drawn, and every engine (the
preview, PowerPoint export, PDF, the editor) draws its result. No engine computes on its own.

### The rows

1. Take the dataset's rows in order. Apply `filter`: a row is kept when it meets every condition.
2. A condition compares the row's cell in `field` with `value`:
   - `=` and `!=`: equal when both are the same JSON value (`null` equals only `null`; `1` does not equal `"1"`).
   - `<`, `<=`, `>`, `>=`: both numbers, compared as numbers; or both strings, compared by the time-order key when the column is typed
     `date` (so `"2026-03" < "2026-11"` and `"Q1 2026" < "Q3 2026"`), else by code point. Any other pair does not meet the condition.
     *(analysis)*
   - `in`: equal (as `=`) to one of the listed values.

### The aggregate

Over the kept rows' cells in `field`:

| Aggregate | Cells used | Result | No usable cell |
| --- | --- | --- | --- |
| `count` | every row kept (cells included whatever they hold) | the number of rows | `0` |
| `sum`, `mean` | numbers; in an undeclared column also strings in strict decimal syntax, as chart values read them | a number | empty |
| `min`, `max` | numbers as above; in a `date` column, time labels by their time-order key | a number, or the cell as written | empty |
| `first`, `last` | the first or last non-null cell, in dataset order | the cell as written | empty |

- A column typed `text` or `boolean` refuses `sum`, `mean`, `min` and `max`: a `metric-data-aggregate` warning, and the literal is
  drawn. (FR-05: "The data link can refuse to sum a text column.")
- Empty (no row kept, or no usable cell): a `metric-data-empty` warning, and the literal is drawn.
- `count` counts rows, not non-null cells. *(analysis: "how many deals" is the usual question; a host that wants non-null cells filters
  on `field != null`.)*

### The value drawn

- A number result is drawn with the `field` column's `format` (FR-05 `DatasetColumn.format`; General without one), grouped by the
  slide's language as metric numbers are today. A string result (from `first`, `last`, `min` or `max` on a text or date column) is drawn
  as written.
- `metric.unit` is printed as today (it is the metric's printed suffix); the column's `unit` is not (FR-05).
- **While the link resolves, the computed numbers are drawn, not the literals.** *(analysis: the point of the change is that the slide
  agrees with its data; the literals are the fallback and the record for readers that do not compute.)* When the link does not resolve
  (an error, or one of the warnings above), the literal `value` and `delta` are drawn exactly as today.

### The change

Only when `data.delta` is present. The comparison number `base` is:

| `delta` | `base` |
| --- | --- |
| `compare: "previous"` | The same aggregate over the kept rows without the last one, in dataset order. With `aggregate: "last"` and one row per period, that is the period before. |
| `compare: { filter }` | The same aggregate over the rows that meet this filter instead of `data.filter`. The baseline filter replaces the main one, it does not add to it, so a baseline names everything it means (`Region = EMEA` and `Quarter = Q2`). *(analysis)* |
| `compare: { value }` | The fixed number. **Owner, 2026-11-25** ("all three, but fixed value/constant too?"): a plan or budget typed into the deck. |
| `field` | No base: the change is the same aggregate, over the same rows, of the column `field`, which already holds the change. |

Then, for `compare`: `as: "difference"` gives `value - base`; `as: "percent"` gives `(value - base) / |base|`, a ratio (`0.12` is 12%).
For `field`, `as` says what the column holds (a difference, or a ratio), which picks the default format and nothing else.

- **Undefined change** (a `metric-data-delta` warning, and no change drawn; the value is still drawn): `previous` with fewer than two
  kept rows, a baseline with no usable cell, `percent` with `base = 0`, or a value that is not a number.
- **Default format** *(analysis)*: for a difference, the value column's format with sign sections built from it (`F` gives `"+F;-F;F"`, so
  `"$#,##0"` gives `"+$#,##0;-$#,##0;$#,##0"`), or `"+#,##0.##;-#,##0.##;0"` when the column has none; for a percent, `"+0%;-0%;0%"`. An authored
  `format` always wins.
- **Known limit, said in the docs**: `previous` compares row sets, not periods. With several rows per period (one per region), filter to
  one series first, or have the host write the change in a column and use `field`. A period-grouped comparison (`"by": "<date column>"`)
  is a later addition, which it can be without breaking anything. *(analysis)*

### The arrow and its color

- `trend`: a typed `trend` wins. Otherwise, with a computed change, its sign: positive `up`, negative `down`, zero `flat`. Otherwise
  none, as today.
- `sentiment`: a typed `sentiment` wins. Otherwise, with a trend (typed or computed), `better` decides: `up` is positive and `down`
  negative when `better` is `"up"` or absent (today's rule), the reverse when it is `"down"`; `flat` is neutral.

## Rules

Severities are the program README's: errors for a data link to an unknown dataset or field, warnings for the rest.

| Id | Severity | When | Message | Path |
| --- | --- | --- | --- | --- |
| `dataset-unknown` (existing) | error | `data.dataset` names no dataset | the existing message | `/slides/{s}/metric/data/dataset` (and the block path for a metric block) |
| `dataset-field-unknown` (existing) | error | `data.field`, a filter's `field`, a baseline filter's `field` or `delta.field` names no column of the dataset | the existing message | the key's path |
| `metric-data-stale` *(analysis: name)* | warning, **safe fix** | The literal `value` or `delta` differs from the computed one | `The metric shows {computed} from "{dataset}", but its value is written as {literal}. Readers that do not compute show the written value.` | `/.../metric/value` or `/.../metric/delta` |
| `metric-data-aggregate` *(analysis: name)* | warning | `sum`, `mean`, `min` or `max` on a column typed `text` or `boolean` | `"{aggregate}" needs numbers, and column "{field}" is typed {type}. The written value is shown.` | `/.../metric/data/aggregate` |
| `metric-data-empty` *(analysis: name)* | warning | No row meets the filter, or no cell is usable | `No row of "{dataset}" gives a value for this metric. The written value is shown.` | `/.../metric/data` |
| `metric-data-delta` *(analysis: name)* | warning | The change cannot be computed (see above) | `The change cannot be computed: {reason}. No change is shown.` | `/.../metric/data/delta` |

- **The safe fix** writes the computed number into `value` (a number, replacing a string such as `"$12.4M"`) and the computed change into
  `delta` (a number). It adds no `trend` or `sentiment`: they stay derived. Literal equality: two numbers are equal when they draw the
  same text with the column's format; a string literal is equal when it is exactly the drawn text. *(analysis: so `4.2` and
  `4.2000000001` do not warn.)*
- The warnings get no conformance cases; the two errors do.
- `opf validate` and the editor report the warnings; the MCP server's `validate_deck` returns them with their fixes.

## PowerPoint export and import

Drawing: the metric's native shapes are unchanged in kind (the value, unit, label, description, change and arrow text shapes of today);
they carry the computed text. A deck without `data` exports byte for byte as before.

The record. Owner, 2026-11-25, to the release supervisor: "We don't need to worry about backwards compatibility since we don't have existing users just yet all our stuff updated". The supervisor's application of it: the simple
form below is the design.

- The metric's `OPF_METRIC_V1` manifest stores the metric **as authored** in its `value`: `data`, `better` and `format` sit in it beside
  the other keys, exactly as the deck has them. There is no top-level `link` key and no `derived` list.
- The drawn numbers are not stored as a second metric. What tells import an untouched metric from an edited one is the evidence of the
  drawn text that the manifest already keeps for every metric; the builder confirms it covers the computed value and change text, and
  adds them to the evidence if it does not.
- No test runs the released 0.36.0 importer on the file.

**Built before the owner's direction, acceptable**: the careful form, in which `value` holds the 0.36 form of what is drawn (the computed
numbers as `value` and `delta`, the drawn `trend` and `sentiment`) and a top-level manifest key `link` holds `{ "data", "better",
"format", "derived" }`. A build that already has it need not be redone for this reason alone; a later change to this record moves it to
the simple form. An importer reads whichever form the 0.37 exporter writes, not both.

Import:

- With the native value and change text unchanged: the metric comes back as authored, with its `data`, `better` and `format`. (In the
  careful form: restore them from `link`, set `value` and `delta` to the drawn numbers and drop the other keys `derived` lists, so a
  derived `trend` or `sentiment` does not come back typed.)
- With the value or change text edited in PowerPoint: the edit is the author's, so the edited number is imported as the literal and
  `data` is **not** restored, with a `metric-data-dropped` diagnostic (`The metric's value was edited in PowerPoint, so its data link was
  not restored.`). *(analysis: the pattern of the chart data records, which restore only while the native evidence is unchanged; keeping
  the link would overwrite the edit at the next draw.)*
- Provenance off: no record is written (the export report says so), as for the other records.

Native check: a deck with four computed metrics (value only, `previous`, a baseline filter, a change column; one with `better: "down"`),
exported, opened and saved by PowerPoint, imported: every link and the drawn numbers come back.

## Editor

- The metric inspector gets a **Data** section: dataset (a select), field (a select listing `measure` columns first), aggregate, filter
  rows (field, operator, value; values offered from the column's cells), and a change (none, previous, baseline filter, column) with
  `as` and format. A `better` toggle sits beside sentiment.
- With a link that resolves, the value and change fields show the computed numbers, read-only, with the literal below when it differs
  and an **Update** button that applies the safe fix.
- Editing the dataset re-resolves every linked metric live; the stale warning shows on the metric.
- The editor's patch helpers keep `data` and `better` through every edit of the metric and through a rename of the dataset or the column
  (the editor's rename updates the links, as it updates `chart.data.dataset` today). *(analysis)*

## Markdown and YAML

The link rides as a nested property wherever a metric object is written (front matter, JSON and YAML blocks). The round-trip test covers
a metric with `data` (filter and each kind of change) and `better`, and a plain string metric beside it that stays a string.

## Docs and skills

- `docs/chart-table-data.md`: "A metric computed from data": the link, the aggregates, the three changes, `better`, what is drawn when
  the link does not resolve, and the known limit of `previous`.
- The author skill: one worked example (monthly ARR with `previous`, churn with `better: "down"`).
- `docs/validate.md`: the four warnings and the fix.

## Examples

Valid (the item's example deck):

```json
{
  "name": "Computed metrics",
  "datasets": {
    "arr": {
      "columns": [
        { "name": "Month", "type": "date", "role": "dimension" },
        { "name": "Region", "type": "text", "role": "dimension" },
        { "name": "ARR", "format": "$#,##0.0M", "type": "number", "role": "measure", "unit": "USD" },
        { "name": "Churn", "format": "0.0%", "type": "number", "role": "measure" },
        { "name": "ARR change", "format": "+$#,##0.0M;-$#,##0.0M;$0", "type": "number", "role": "measure", "unit": "USD" }
      ],
      "rows": [
        ["2026-09", "EMEA", 3.9, 0.041, null],
        ["2026-10", "EMEA", 4.2, 0.036, 0.3],
        ["2026-11", "EMEA", 4.4, 0.044, 0.2]
      ]
    }
  },
  "slides": [
    { "title": "EMEA ARR", "metric": {
      "label": "EMEA ARR", "value": 4.4, "delta": 0.2,
      "data": { "dataset": "arr", "field": "ARR", "aggregate": "last",
                "filter": [ { "field": "Region", "op": "=", "value": "EMEA" } ],
                "delta": { "compare": "previous" } } } },
    { "title": "Churn", "metric": {
      "label": "Monthly churn", "value": 0.044, "delta": 0.2222222222222222, "better": "down",
      "data": { "dataset": "arr", "field": "Churn", "aggregate": "last",
                "delta": { "compare": "previous", "as": "percent" } } } },
    { "title": "ARR against September", "metric": {
      "label": "ARR since September", "value": 4.4, "delta": 0.5,
      "data": { "dataset": "arr", "field": "ARR", "aggregate": "last",
                "delta": { "compare": { "filter": [ { "field": "Month", "op": "=", "value": "2026-09" } ] } } } } },
    { "title": "ARR, change from the column", "metric": {
      "label": "EMEA ARR", "value": 4.4, "delta": 0.2,
      "data": { "dataset": "arr", "field": "ARR", "aggregate": "last", "delta": { "field": "ARR change" } } } }
  ]
}
```

Drawn: `$4.4M` with `+$0.2M` and an up arrow in green; `4.4%` with `+22%` and an up arrow in red (churn rose, `better: "down"`);
`$4.4M` with `+$0.5M`; `$4.4M` with `+$0.2M`.

Warns (valid; `metric-data-stale` at `/slides/0/metric/value`, safe fix writes `4.4`):

```json
{ "datasets": { "arr": { "columns": ["Month", "ARR"], "rows": [["2026-10", 4.2], ["2026-11", 4.4]] } },
  "slides": [ { "title": "ARR", "metric": { "value": "$4.2M",
    "data": { "dataset": "arr", "field": "ARR", "aggregate": "last" } } } ] }
```

Invalid (`dataset-unknown` at `/slides/0/metric/data/dataset`):

```json
{ "datasets": { "arr": { "columns": ["Month", "ARR"], "rows": [["2026-11", 4.4]] } },
  "slides": [ { "title": "ARR", "metric": { "value": 4.4,
    "data": { "dataset": "revenue", "field": "ARR", "aggregate": "last" } } } ] }
```

Invalid (`dataset-field-unknown` at `/slides/0/metric/data/filter/0/field`):

```json
{ "datasets": { "arr": { "columns": ["Month", "ARR"], "rows": [["2026-11", 4.4]] } },
  "slides": [ { "title": "ARR", "metric": { "value": 4.4,
    "data": { "dataset": "arr", "field": "ARR", "aggregate": "last",
              "filter": [ { "field": "Regoin", "op": "=", "value": "EMEA" } ] } } } ] }
```

Conformance (the burndown's list): valid decks with a computed metric (value only, `previous`, a baseline filter, a change column);
invalid decks with an unknown dataset and an unknown field.

## Edge cases

| Case | Answer |
| --- | --- |
| A metric in a block (`blocks[].metric`), not the slide | The same link, the same rules, at the block's path. |
| A string-shorthand metric (`"metric": "$4.2M"`) | Cannot carry `data`; it is the object form or nothing. |
| `data` without `delta`, but a typed `delta` | The typed delta is drawn as today; no change is computed, so no stale warning for it. |
| A typed `trend` that contradicts the computed change | The typed trend wins (supervisor's decision on `m-trend`); no rule. *(analysis: a rule could follow if decks show the problem.)* |
| `better` without any trend | No effect. |
| The dataset has data sources and is stale (`dataset-stale`, FR-04) | The metric still computes from the rows it has; the stale warning belongs to the dataset. |
| A dataset row holds a string in a number column | The `data-cell-type` warning (FR-05); `sum` reads it in strict decimal syntax if the column is undeclared, skips it if typed `number`. *(analysis)* |
| A filter on a `date` column with `<` | Compared by the time-order key (see Computing). |
| `in` with one value | Same as `=`. |
| `first`/`last` when the last row's cell is `null` | The last non-null cell. |
| A metric linked to a dataset that a slide's chart also uses | Both read the same rows; nothing is cached between them. |
| A deck copied as a single slide into another deck whose dataset of the same id holds other data | The link resolves against the new deck's dataset, as a chart's dataset reference does today. The editor's paste keeps the literals, so the stale warning shows the difference. |
| Fill from a template (`opf fill`) with a dataset in the record | The link computes from the filled dataset; `opf fill` applies the safe fix so the written literals match. *(analysis)* |

## Decisions the card leaves open, with the option taken

| Question | Option taken | Why |
| --- | --- | --- |
| Draw the computed or the literal value? *(analysis)* | Computed while the link resolves; the literal otherwise | The slide must agree with its data; the literal is the fallback. |
| Does a baseline filter replace or add to the main filter? *(analysis)* | Replace | A baseline reads as a full description of what it compares with. |
| What does `count` count? *(analysis)* | Rows | The usual question; non-null counting is a filter away. |
| Default change format *(analysis)* | Sign sections built from the value column's format; `+0%;-0%;0%` for percent | The change reads in the value's own units without extra authoring. |
| Comparison of strings with `<` *(analysis)* | Time-order key in a `date` column, else code point | Dates in decks are written as labels, not timestamps. |
| `better` on unlinked metrics *(analysis)* | Allowed | It is the rule for a verdict, useful on a typed trend too. |
| An edit in PowerPoint to a computed value *(analysis)* | The edit wins; the link is not restored, with a diagnostic | The native evidence rule of the other data records. |
| Where the link goes in the PowerPoint tag (owner's direction of 2026-11-25, applied by the supervisor) | In the metric's own record, as authored; the earlier top-level `link` form is acceptable where already built | No backward compatibility is owed before there are users. |
| Rule names *(analysis)* | `metric-data-stale`, `metric-data-aggregate`, `metric-data-empty`, `metric-data-delta`; the two errors reuse `dataset-unknown` and `dataset-field-unknown` | One family for the metric's link; the existing data errors already say the right thing. |
| A period-grouped `previous` *(analysis)* | Not now; a documented limit, addable later | Keeps the item to what was reviewed. |

## Two lessons from the earlier 0.37 builds (supervisor, 2026-11-25)

- **The editor's keyboard browser suites pin completion counts by key name.** A new or renamed key changes how many completions the
  source editor offers at the pinned positions, so those suites fail until their counts are updated. Run them before the pull request
  opens, not after the first red check.
- **The breaking-change gate needs every removed schema path named.** A `type: changed` fragment must name each schema path the change
  removes, in the gate's form (for example `opf.schema.json:$defs.DataSourceRef`); a renamed key is a removed path and an added one.
