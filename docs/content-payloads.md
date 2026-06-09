# Content Payloads

Slide content lives directly on a slide as a full-slide payload, in layout-agnostic `blocks`, or inside a promoted region key such as `left`, `center+right`, or `top:left`.

The optional payload `type` can make intent explicit, but OPF should usually infer the content kind from the field present:

| Field | Inferred type | Notes |
| --- | --- | --- |
| `text` | `text` | Plain string or `TextRun[]`. |
| `bullets` | `text` | Simple text bullets, usually `string[]`. |
| `items` | `list` | Generic list payload, usually `string[]` or `ListItem[]`. |
| `image` | `image` | Asset string shorthand or `Asset` object with `src` and optional metadata. |
| `video` | `video` | Asset string shorthand or `Asset` object with `src` and optional metadata. |
| `chart` | `chart` | Chart object with `type` and tabular `data`. |
| `table` | `table` | Table object with optional `columns` and required `rows`. |
| `code` | `code` | String shorthand or `Code` object with `source`, `language`, and `filename`. |
| `metric` | `metric` | String/number shorthand or `Metric` object with `value`, `label`, `description`, `unit`, `delta`, and `trend`. |
| `quote` | `quote` | String shorthand or `Quote` object with `text`, `attribution`, and `source`. |
| `timeline` | `timeline` | Array shorthand or `Timeline` object with `name`, `description`, and `events`. |

## Blocks

Use slide-level `blocks` when a slide contains multiple content payloads, but exact placement should be inferred by the renderer. Blocks are not recursive; each block is a concrete content payload.

```json
{
  "title": "Customer Feedback Summary",
  "blocks": [
    {
      "table": {
        "columns": ["Theme", "Mentions"],
        "rows": [
          ["Speed", 42],
          ["Ease of use", 31]
        ]
      }
    },
    {
      "quote": {
        "text": "The new workflow cut review time in half.",
        "attribution": "Operations Lead",
        "source": "Customer interview"
      }
    }
  ]
}
```

At slide root only, multiple content payload kinds are accepted as shorthand for the equivalent blocks form when there is no explicit `type`, no `blocks`, and no promoted region keys:

```json
{
  "title": "Habitat & Territory",
  "text": "Jaguars are strongly associated with presence of water and dense cover.",
  "items": [
    "Primary habitats include dense rainforests, swamps, and seasonally flooded wetlands.",
    "Solitary animals that establish and defend large territories."
  ]
}
```

The same shorthand works for other content kinds:

```json
{
  "title": "Evidence Snapshot",
  "chart": {
    "type": "line",
    "data": {
      "columns": ["Quarter", "Sightings"],
      "rows": [
        ["Q1", 12],
        ["Q2", 18]
      ]
    }
  },
  "quote": {
    "text": "Jaguar conservation depends on connected habitat.",
    "attribution": "Field researcher"
  }
}
```

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
      "src": "asset:revenue-csv",
      "columns": ["Quarter", "Revenue"]
    }
  }
}
```

## Table

Table-specific fields are grouped under `table`. Do not put loose `columns` or `rows` directly on a slide or region.

```json
{
  "title": "Pipeline",
  "table": {
    "columns": ["Stage", "Count", "Value"],
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

Region keys address a 3×3 grid of rows (`top`, `middle`, `bottom`) and columns (`left`, `center`, `right`):

```
                  left                 center                 right
         +--------------------+--------------------+--------------------+
   top   |  top:left          |  top:center        |  top:right         |
         +--------------------+--------------------+--------------------+
  middle |  middle:left       |  middle:center     |  middle:right      |
         +--------------------+--------------------+--------------------+
  bottom |  bottom:left       |  bottom:center     |  bottom:right      |
         +--------------------+--------------------+--------------------+
```

- A bare column key (`left`) spans all three rows; a bare row key (`top`) spans all three columns.
- `+` spans adjacent rows or columns: `center+right`, `top+middle`.
- `row:column` combines the two: `top:left`, `middle+bottom:center+right`.
- Keys on one slide must not overlap, and regions cannot be mixed with root payload fields.

Spans compose into common slide shapes:

```
  "left" + "center+right"             "top" + "middle+bottom"
  (sidebar + main)                    (headline band + body)
  +----------+------------------+     +-------------------------------+
  |          |                  |     |              top              |
  |          |                  |     +-------------------------------+
  |   left   |  center+right    |     |                               |
  |          |                  |     |         middle+bottom         |
  |          |                  |     |                               |
  +----------+------------------+     +-------------------------------+

  "top" + "middle+bottom:left" + "middle+bottom:center+right"
  (headline band, then sidebar + main)
  +---------------------------------------------+
  |                     top                     |
  +---------------+-----------------------------+
  |               |                             |
  | middle+bottom | middle+bottom:center+right  |
  | :left         |                             |
  |               |                             |
  +---------------+-----------------------------+
```

The same payload objects work inside regions — here, the sidebar-plus-main shape:

```json
{
  "title": "Operating Snapshot",
  "left": {
    "table": {
      "columns": ["Metric", "Value"],
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
