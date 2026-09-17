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

## Color references

Every content color field — `TextRun.color`, styled table cell `style.fill` and `style.color`, and table cell border `color` — accepts three forms:

- A literal hex color: `"#0F172A"`, `"#B42318CC"`.
- A color-scheme slot or role name, resolved through the effective color scheme after design resolution: slots `accent1`–`accent6`, `dark1`, `dark2`, `light1`, `light2`, `hyperlink`, `followedHyperlink`; roles `primary`, `secondary`, `accent`, `background`, `surface`, `text`, `textSecondary`.
- A variable reference `var:<id>` into the top-level `variables` map.

```json
{
  "variables": { "risk": "#B42318" },
  "slides": [
    {
      "title": "What Could Go Wrong",
      "items": [
        ["Two regions at ", { "text": "85% utilization", "color": "var:risk", "bold": true }],
        ["Mitigations ship in ", { "text": "November", "color": "accent2" }]
      ]
    }
  ]
}
```

Prefer names and variables over literal hex: re-theming the deck updates every named reference, while a hex value stays frozen at authoring time. An unknown `var:` id is a validation warning, never an error; engines fall back to their default text color. The styled table cell and border color fields enforce the three forms at the schema level; run colors additionally accept any string so imported decks keep validating — unrecognized values warn, and renderers fall back to the theme color. See [`design-resolution.md`](./design-resolution.md) for the resolution rules.

## Blocks

Use slide-level `blocks` when a slide contains multiple content payloads, but exact placement should be inferred by the renderer. Blocks may contain a concrete content payload or a nested group with its own `blocks` and optional `composition`. Groups cannot mix child blocks with leaf payload fields. See [dynamic composition](dynamic-composition.md) for nesting and inheritance rules.

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

Table body cells accept strings, numbers, booleans, or `null`. Since core 0.5.0, a cell or column header also accepts the same `TextRun[]` used by rich text:

```json
{
  "table": {
    "columns": [["Quarter ", {"text": "growth", "bold": true}], "Value"],
    "rows": [
      [["Up ", {"text": "12%", "color": "#008800"}], 12]
    ]
  }
}
```

Use core 0.6.0, renderer 0.4.0, editor 0.3.0 and PPTX 0.4.0 together. Core measures run styles when checking overflow and keeps each row intact when paginating. The renderer traces rich cells for the editor's existing formatting, typing and undo controls; the exporter emits editable native text runs. PPTX 0.4.0 imports supported native character styles, paragraph defaults, theme fonts/colors, external links and significant whitespace as rich runs. Unstyled body cells remain strings, and cached display text cannot recover original scalar types or live fields. Conditional table styles, merged geometry and cell fills/borders/alignment remain limited; native PowerPoint visual parity is not yet verified.

Core 0.6.0 adds `layoutTable` from `@openpresentation/opf/composition`. It measures scalar and rich cells, keeps short rows compact, and gives wrapped or multiline rows the height they need. When space is constrained it reduces spare row height before shrinking text, and reports overflow when the minimum fitting size cannot fit. Pass the same `scale`, font family, measurement provider and effective `minFontSize` to each consumer. The returned row boxes, cell text boxes and fits are shared by the coordinated SVG and PPTX implementations; rich table cells use uniform line advances to match native cell paragraph spacing. Native viewer fidelity remains a separate verification boundary.


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

The `number-1x` through `number-6x` layout IDs declare one title placeholder and one through six `metric` placeholders. The IDs retain their existing names; the content kind and payload key are `metric`, not `number` or `text`. For several metrics, use separate `{ "metric": ... }` entries in `blocks`. Choosing a layout does not reinterpret existing text as numeric data.

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
