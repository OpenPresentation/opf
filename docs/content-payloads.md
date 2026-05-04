# Content Payloads

Slide content lives either directly on a slide as a full-slide payload or inside a promoted region key such as `left`, `center+right`, or `top:left`.

The optional payload `type` can make intent explicit, but OPF should usually infer the content kind from the field present:

| Field | Inferred type | Notes |
| --- | --- | --- |
| `text` | `text` | Plain string or `TextRun[]`. |
| `bullets` | `text` | Simple text bullets, usually `string[]`. |
| `items` | `list` | Generic list payload, usually `string[]` or `ListItem[]`. |
| `image` | `image` | Asset string shorthand or `Asset` object with `src` and optional metadata. |
| `video` | `video` | Asset string shorthand or `Asset` object with `src` and optional metadata. |
| `chart` | `chart` | Chart object with `type` and tabular `data`. |
| `table` | `table` | Table object with optional `headers` and required `rows`. |
| `code` | `code` | String shorthand or `Code` object with `source`, `language`, and `filename`. |
| `metric` | `metric` | String/number shorthand or `Metric` object with `value`, `label`, `description`, `unit`, `delta`, and `trend`. |
| `quote` | `quote` | String shorthand or `Quote` object with `text`, `attribution`, and `source`. |
| `timeline` | `timeline` | Array shorthand or `Timeline` object with `name`, `description`, and `events`. |

## Chart

Chart-specific fields are grouped under `chart`. Do not put loose chart data directly on a slide or region.

```json
{
  "title": "Revenue Trend",
  "chart": {
    "type": "line",
    "data": {
      "columns": ["Quarter", "Revenue", "Costs"],
      "rows": [
        ["Q1", 12, 8],
        ["Q2", 18, 11],
        ["Q3", 24, 15]
      ]
    }
  }
}
```

Inline chart data is tabular by default. Renderers convert `columns` and `rows` into series, axes, legends, and workbook data internally.

Asset-backed data is still table-oriented:

```json
{
  "chart": {
    "type": "column",
    "data": {
      "asset": "revenue-csv",
      "columns": ["Quarter", "Revenue"]
    }
  }
}
```

## Table

Table-specific fields are grouped under `table`. Do not put loose `headers` or `rows` directly on a slide or region.

```json
{
  "title": "Pipeline",
  "table": {
    "headers": ["Stage", "Count", "Value"],
    "rows": [
      ["Qualified", 42, "$1.2M"],
      ["Proposal", 18, "$840K"]
    ]
  }
}
```

## Code

Code-specific fields are grouped under `code`. A string value is shorthand for `code.source`; use object form when syntax highlighting or a file label matters. In object form, `source` is required.

```json
{
  "title": "Decision Rule",
  "code": {
    "source": "if risk > threshold:\n    escalate(owner)\nelse:\n    approve(change)",
    "language": "python",
    "filename": "decision.py"
  }
}
```

## Metric

Metric-specific fields are grouped under `metric`. A string or number value is shorthand for `metric.value`; numeric values stay numeric and are formatted by renderers at display time. Use object form when labels, descriptions, units, deltas, or trends matter.

```json
{
  "title": "Operating Metric",
  "metric": {
    "value": "42%",
    "label": "Review cycle reduction",
    "description": "Median reduction across customer review workflows.",
    "delta": "+11 pts",
    "trend": "up"
  }
}
```

## Quote

Quote-specific fields are grouped under `quote`. A string value is shorthand for `quote.text`; use object form when attribution or citation matters.

```json
{
  "title": "Customer Proof",
  "quote": {
    "text": "The new workflow made exceptions visible before they became escalations.",
    "attribution": "VP Operations, Acme Corp",
    "source": "Customer interview"
  }
}
```

## Timeline

Timeline-specific fields are grouped under `timeline`. An array value is shorthand for `timeline.events`; use object form when the timeline needs a name or description. Timeline events use `when`, `what`, and `description`.

```json
{
  "title": "Rollout Plan",
  "timeline": {
    "name": "Regional Rollout",
    "description": "Major milestones for the rollout.",
    "events": [
      {
        "when": "Q1",
        "what": "Pilot",
        "description": "Launch with one operations team."
      },
      {
        "when": "Q2",
        "what": "Rollout",
        "description": "Expand to all regions."
      }
    ]
  }
}
```

## Regions

The same payload objects work inside regions:

```json
{
  "title": "Operating Snapshot",
  "left": {
    "table": {
      "headers": ["Metric", "Value"],
      "rows": [
        ["Revenue", "$4.2M"],
        ["Gross margin", "68%"]
      ]
    }
  },
  "center+right": {
    "chart": {
      "type": "line",
      "data": {
        "columns": ["Month", "Revenue"],
        "rows": [
          ["Jan", 3.4],
          ["Feb", 3.8],
          ["Mar", 4.2]
        ]
      }
    }
  }
}
```
