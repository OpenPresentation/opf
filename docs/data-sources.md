# Data sources

A number on a slide is only as good as what stands behind it. OPF lets a document say where its data came from, when it was taken, which snapshot it was and who made it, so a reader can trace a figure and a tool can tell that a file has changed. OPF 0.37 writes this in two places:

- the root `datasources` map describes each place data lives, once (a warehouse, a workbook, an API);
- a dataset, or the inline data of a chart, says what it took from that place: `datasource`, `query`, `retrieved`, `version`, `sha256` and `generator`.

**Engines never read, fetch or refresh a data source.** They keep every key through editing, Markdown and YAML, and the PowerPoint document tags, and draw none of them. A data source never holds credentials.

## An example

```json
{
  "name": "Revenue review",
  "language": "en-US",
  "datasources": {
    "forecast": {
      "title": "FY26 forecast workbook",
      "connector": "xlsx",
      "src": "https://example.com/data/revenue.xlsx",
      "license": "CC-BY-4.0",
      "refreshEvery": "P1M"
    }
  },
  "datasets": {
    "revenue": {
      "title": "Revenue by quarter",
      "columns": ["Quarter", { "name": "Revenue", "format": "$#,##0.0" }],
      "rows": [["Q1", 12.4], ["Q2", 18], ["Q3", 24.5], ["Q4", 31.2]],
      "datasource": "forecast",
      "query": "'Q3 plan'!A1:B5",
      "retrieved": "2026-11-01",
      "version": "r42",
      "sha256": "9f2c41b1d1b6e0a8a56e7c3d2f4b8a90c1e3d5f7a9b0c2d4e6f8a0b1c3d5e07a",
      "generator": { "type": "human", "name": "Finance team" }
    }
  },
  "slides": [
    {
      "title": "Revenue grew every quarter",
      "chart": {
        "type": "column",
        "alt": "Column chart of revenue by quarter, rising from $12.4M in Q1 to $31.2M in Q4",
        "data": { "dataset": "revenue" }
      },
      "caption": "Source: FY26 forecast workbook (CC-BY-4.0), retrieved 1 November 2026"
    }
  ]
}
```

The caption names the same source the dataset records. The caption is the author's words, drawn as text; the keys behind it are what a reviewer, an auditor or a refresh tool reads. A deck with two data sources, a dataset table and inline chart data is `examples/technical/data-sources.opf.json`; there the source line is a text block under the chart.

## A data source

`datasources` maps ids (letters, digits, `.`, `_` and `-`, starting with a letter or digit, as for `datasets` and `assets`) to a data source. Every key is optional.

| Key | Holds |
| --- | --- |
| `title` | The data source's name, shown by editors. |
| `description` | A free-form note. |
| `connector` | The kind of place it is, in the host's or author's words: `csv`, `xlsx`, `postgres`, `bigquery`, `rest`. Engines do not interpret it. It also says what language a dataset's `query` is written in. |
| `src` | Where it is: an `asset:<id>` reference, a URL or a path. A URL carries no credentials. |
| `license` | The terms the data is under: an SPDX identifier (`CC-BY-4.0`) or a short statement. It travels with the data. |
| `refreshEvery` | How often the data is meant to be taken again, as an ISO 8601 duration (`P1D`, `P1W`, `P3M`, `PT6H`). No engine acts on it. |
| `extensions` | Settings a host owns, such as connection options. Kept, never read. |

A data source never holds credentials: no password, token or key in `src` or in `extensions`. A host keeps secrets in its own store and names the connection in `connector` or `extensions`.

## A dataset, and inline chart data

A dataset (an entry of `datasets`) and the inline data of a chart (`chart.data` with `columns` and `rows`) take the same six keys beside their columns and rows. A chart that references a dataset reports the dataset's.

| Key | Holds |
| --- | --- |
| `datasource` | The data source the data came from: a **string, which is always the id of an entry of `datasources`**, or a data source written inline as an object of the same shape, `{ "src": "./revenue.csv" }`. A file or a URL is never a bare string. |
| `query` | What was taken, in the data source's own language: a spreadsheet range with its sheet (`FY26!A1:C13`; a sheet name with a space is quoted as spreadsheets do, `'Q3 plan'!A1:B9`), a SQL statement, a path into a document. Engines never run or parse it. |
| `retrieved` | When it was taken: an ISO 8601 date or date-time. Never read from a clock by an engine. |
| `version` | A free string the source system gives the snapshot: a revision, an etag, a commit. |
| `sha256` | The SHA-256 of the source file's bytes as retrieved, as 64 lowercase hexadecimal digits. It answers "has the file changed since". It is not a hash of the rows (anything can hash the document), and no engine computes or checks it; `opf ingest --dataset` writes it for the file it imports. |
| `generator` | Who produced the data: `{ "type": "human" | "model", "name": "metricgen 2.1" }`. A reviewer of a generated deck can see that a table came from a model, and which one. |

There is no `queryLanguage` (the `connector` says it) and no hash of a transform (a `query` holds its own text).

## Validation

| Rule | Severity | When |
| --- | --- | --- |
| `opf/datasource-unknown` | error | A string `datasource`, on a dataset or on inline chart data, names no entry of `datasources`. |
| `opf/datasource-credentials` | warning | A data source's `src` carries a user and password (`https://user:secret@host/`), or a query parameter named like a key or a token (`?api_key=`, `?access_token=`, `?signature=`). The finding never repeats the secret. |
| `opf/dataset-stale` | warning | Only when the caller passes a date: `retrieved` plus the data source's `refreshEvery` is earlier than that date. |

Core has no clock, so staleness is checked as of a date you pass: `validate(deck, { asOf: "2026-11-25" })` and `opf validate deck.opf.json --as-of 2026-11-25`. Without a date nothing is reported stale. The CLI never reads the clock for it either. `refreshEvery` is calendar arithmetic in UTC (`P3M` after 31 August is 30 November). A dataset with no `retrieved`, or whose data source has no `refreshEvery`, is never stale.

A bare string that is a path or a URL where an id belongs (`"datasource": "./revenue.csv"`) is a schema error, because a string `datasource` is only an id. Write `{ "src": "./revenue.csv" }`.

## Updating from 0.36

OPF 0.36 and earlier wrote where a dataset or inline chart data came from in a nested `source` object. OPF 0.37 removes it, with no alias: a deck that still has `source` fails validation until `opf fix` rewrites it.

```json
{
  "datasets": {
    "revenue": {
      "columns": ["Quarter", "Revenue"],
      "rows": [["Q1", 12]],
      "source": { "src": "./data/revenue.csv", "sheet": "FY26", "range": "A1:C13", "fields": ["Quarter", "Revenue"], "retrieved": "2026-10-05", "description": "Finance export" }
    }
  }
}
```

becomes

```json
{
  "datasets": {
    "revenue": {
      "columns": ["Quarter", "Revenue"],
      "rows": [["Q1", 12]],
      "datasource": { "src": "./data/revenue.csv", "description": "Finance export" },
      "query": "FY26!A1:C13",
      "retrieved": "2026-10-05"
    }
  }
}
```

`opf fix deck.opf.json -i` does this (`use-datasource`, a safe fix that changes no drawing). `src` and `description` become an inline `datasource`, `retrieved` moves up, `sheet` and `range` fold into `query` (a sheet name with a space or other punctuation is quoted), and `fields` is dropped: the data holds its own columns. The fix title says when `fields` is dropped. Inline chart data (`chart.data.source`) is rewritten the same way. A dataset that already has a `datasource`, `query` or `retrieved` of its own is not rewritten; the finding explains it.

In code, `Dataset.source`, `ChartData.source` and the `DataSourceRef` type are gone; `resolveChartData(...).source` is now `.provenance`; `stats` reports `datasets.withDatasource`, `charts.data.withDatasource` and `datasets.items[].datasource` where it reported `withSource` and `source`; `prepareDatasetImport` (editor) takes `provenance` where it took `source`.

## What each part does with it

- **Core:** the schema, the types, `validate`, `opf fix`, `stats`, `resolveChartData` (`provenance`) and `inlineDatasets` (a chart takes the dataset's keys); helpers `dataSourcesOf`, `resolveDataSource`, `dataProvenance` and `credentialInSrc`.
- **Preview and PPTX export:** nothing is drawn. PPTX export in `full` provenance mode keeps the `datasources` map in `OPF_DATASOURCES_V1`, beside `OPF_DATASETS_V1`; the provenance keys of a dataset and of inline chart data travel inside the dataset and chart-data records. PPTX import restores them while the chart's native values are unchanged (the rule of [chart and table data](chart-table-data.md)). `references-only` mode and `provenance: false` write none of them.
- **CLI:** `opf ingest --dataset <id>` writes `datasource: { src }` (relative to the deck's folder), `sha256` of the data file and, with `--date`, `retrieved`; a data source named by id stays. `opf validate --as-of <date>` checks freshness. `opf fix` rewrites 0.36's `source`.
- **Editor:** `prepareDatasetImport(presentation, content, { id, provenance })` writes the keys in the dataset, merged into those it has. The keys are edited as JSON, YAML or Markdown source, which complete and validate them from the schema.
- **Markdown and YAML:** the keys are written in the embedded YAML form, in the schema's order.
