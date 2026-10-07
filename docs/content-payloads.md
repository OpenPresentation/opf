# Content Payloads

Slide content lives directly on a slide as a full-slide payload, in layout-agnostic `blocks`, or inside a promoted region key such as `left`, `center+right`, or `top:left`.

The slide-level `title`, `subtitle` and `tag` are not payloads, but like `text` and `quote.text` they accept a string or `TextRun[]` (colored words, bold, links, `cite`/`footnote` markers); see [Rich text](rich-text.md#rich-headings-and-quotes).

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
| `code` | `code` | String shorthand or `Code` object with `source`, `language`, `filename`, and `highlight`. |
| `metric` | `metric` | String/number shorthand or `Metric` object with `value`, `label`, `description`, `unit`, `delta`, `trend`, and `sentiment`. |
| `quote` | `quote` | String shorthand or `Quote` object with `text` (string or `TextRun[]`), `attribution`, `role`, `photo`, and `source`. |
| `timeline` | `timeline` | Array shorthand or `Timeline` object with `name`, `description`, and `events`. |

## Items versus bullets

Both fields draw a bulleted (or numbered) list and share the same nesting `level`, rich-text entries and `numbering`. They differ in what they say about the content:

- `bullets` is **prose bullets**: short lines of an argument, written as text. It is inferred as a `text` payload, so layouts and regions that want text take it, and an entry is a string, `TextRun[]` or `{ text, level }`. Use it for talking points where each line stands alone.
- `items` is a **structured list**: it is inferred as a `list` payload, and an entry may also carry a `description`, so one entry is a heading plus its detail (`{ "text": "Faster onboarding", "description": "First value in under a day." }`). Use it when entries have the same shape (features, steps, options, risks) or when any of them needs supporting detail.

Pick `bullets` for plain talking points and `items` as soon as an entry has a description or the slide's layout expects a list. Do not put a heading and its detail into one string with a separator; that is what `description` is for. A payload holds one of the two, not both.

## Code highlight

`code.highlight` marks lines of a code block: a line number or an inclusive `[start, end]` range, 1-based, for example `[3, [5, 7]]`. Lines are counted by line break in `code.source`; a line that wraps is still one line. The preview and the PPTX export draw a theme-derived band behind the marked lines and dim the others slightly; every line keeps at least 4.5:1 contrast against what it sits on (`codeHighlightColors`). The PPTX export draws one native rectangle per run of marked lines behind the per-line text boxes, and import restores `highlight` from the code provenance tag. A line past the last line, or a range written end before start, is the validation warning `code-highlight-out-of-range` or `code-highlight-range-reversed`, and engines ignore it. Pagination keeps each page's marked lines, renumbered from 1.

## Color references

Every content color field — `TextRun.color`, styled table cell `style.fill` and `style.color`, and table cell border `color` — accepts three forms:

- A literal hex color: `"#0F172A"`, `"#B42318CC"`.
- A color-scheme slot or role name, resolved through the effective color scheme after design resolution: slots `accent1`–`accent6`, `dark1`, `dark2`, `light1`, `light2`, `hyperlink`, `followedHyperlink`; roles `primary`, `secondary`, `accent`, `background`, `surface`, `surfaceAlt`, `text`, `textSecondary`. `surfaceAlt` is the alternate surface for banded table rows: core derives it from `surface` and `text` (`surfaceAltColor`), so it always differs visibly from the `surface` of the plain rows, on light and dark slides, and body text keeps 4.5:1 on it.
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

## Numbered lists

`numbering` on an `items` or `bullets` payload draws numbers instead of bullets: a style name (`arabic`, `roman-upper`, `roman-lower`, `alpha-upper`, `alpha-lower`), a `{ style, start, suffix }` object, or an array with one entry per list level. PowerPoint export writes native auto-numbers and the preview draws the same numbers. See [numbered lists](numbered-lists.md).

```json
{ "items": ["Define", "Build", "Ship"], "numbering": { "style": "roman-lower", "suffix": "paren" } }
```

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

Give every chart an `alt`: one or two sentences that say what the data shows (the point and the key numbers), not "a chart" or "bar chart". The preview names the chart with it (`role="img"`, `aria-label`) and the PowerPoint export writes it as the chart frame's alternative text (`descr`), which `fromPptx` reads back. `"alt": ""` marks a chart decorative, as an empty image `alt` does; `validate` (`opf/chart-text-alternative`) still reports it as info so the choice is reviewed. Without `alt`, text beside the chart (a subtitle, text or table) satisfies the rule. See [chart options](chart-options.md#text-alternative).

Value cells are numbers. A string is read only in strict decimal syntax (`"12"`, `" -3.5 "`, `"1e6"`); anything else (`"12%"`, `"$5"`, `"(5)"`, `"1,234"`, `"Q1"`) is a gap in the preview and the export and a `chart-value-not-numeric` warning, never a guessed value. `null` and `""` are gaps without a warning. Core `chartNumber` is the one rule every engine uses (RR-54; before it the PPTX exporter stripped non-numeric characters, so `"12%"` exported as 12).

A column is a string or a `DataColumn` with a number format, which the data labels, the value axis and the exported workbook use:

```json
{
  "chart": {
    "type": "column",
    "data": {
      "columns": ["Quarter", { "name": "Revenue", "format": "$#,##0.0" }, { "name": "Margin", "format": "0%" }],
      "rows": [["Q1", 12.4, 0.31], ["Q2", 18.1, 0.34]],
      "source": { "src": "./data/revenue.csv", "retrieved": "2026-10-05" }
    },
    "mapping": { "category": "Quarter", "series": ["Revenue"] }
  }
}
```

Formats use the `NumberVariable.format` syntax (`#,##0`, `0.0%`, `$#,##0.00`, `#,##0 units`; a `%` multiplies by 100). `source` records provenance only; engines never read or refresh it. `mapping` picks the category, the X column of a scatter chart and the plotted series by column name; without it the first column is the category and every other column a series. Shared data lives in the top-level `datasets` map and a chart plots it with `"data": { "dataset": "revenue", "fields": ["Quarter", "Revenue"] }`. The full contract, with validation codes and the engine behaviour, is [Chart and table data](chart-table-data.md).

Chart data is inline columns and rows or a dataset. A data source by file or asset (`"data": { "src": "asset:revenue-csv", "columns": [...] }`) is not part of the format: no engine loaded it, and the validator rejects it. Import the data inline (with a `source`) or into a dataset instead.

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

A table may instead show a dataset: `"table": { "dataset": "revenue", "fields": ["Quarter", "Revenue"] }` (no `rows` or `columns`); it takes its headers, rows and column formats from the dataset, and per-cell styles need an inline table. A column header may be a `DataColumn` (`{ "name": "Revenue", "format": "$#,##0.0" }`) and a styled header or body cell takes a `format`; a number cell displays formatted (the body cell's own format wins over the column's), and `layoutTable` measures the formatted text. See [Chart and table data](chart-table-data.md).

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

Use the current coordinated Node 24 train: core 0.13.0, renderer 0.13.1, editor 0.12.1 and PPTX 0.13.2. See the [compatibility matrix](compatibility-matrix.md) for exact pins and evidence. Core measures run styles when checking overflow and keeps each row intact when paginating. The renderer traces rich cells for the editor's existing formatting, typing and undo controls; the exporter emits editable native text runs. PPTX 0.4.0 introduced import of supported native character styles, paragraph defaults, theme fonts/colors, external links and significant whitespace as rich runs. Unstyled body cells remain strings, and cached display text cannot recover original scalar types or live fields. Conditional table styles, merged geometry and cell fills/borders/alignment remain limited; native PowerPoint visual parity is not yet verified.

Core 0.6.0 adds `layoutTable` from `@openpresentation/opf/composition`. It measures scalar and rich cells, keeps short rows compact, and gives wrapped or multiline rows the height they need. When space is constrained it reduces spare row height before shrinking text, and reports overflow when the minimum fitting size cannot fit. Pass the same `scale`, font family, measurement provider and effective `minFontSize` to each consumer. The returned row boxes, cell text boxes and fits are shared by the coordinated SVG and PPTX implementations; rich table cells use uniform line advances to match native cell paragraph spacing. Native viewer fidelity remains a separate verification boundary.

## Captions

An `image`, `chart`, `table` or `video` payload takes a `caption`: a string, `TextRun[]`, or `{ "text", "position": "below" | "above", "align": "left" | "center" | "right" }` (defaults `below`, `left`). It sits beside the payload field on a block or promoted-region payload, or on the slide root when the root holds exactly one of those payloads; anywhere else it is a `caption-unsupported-payload` error.

```json
{
  "title": "Pipeline",
  "blocks": [
    { "image": "asset:funnel", "caption": "Figure 1. Pipeline by stage, Q3" },
    { "table": { "columns": ["Stage", "Count"], "rows": [["Qualified", 42]] }, "caption": { "text": "Table 1. Counts", "position": "above", "align": "center" } }
  ]
}
```

Core composition reserves the caption band inside the block's region and shrinks the media by its height (`item.caption` carries the band, `item.box` is the media box); the preview and the PPTX export draw that band in the muted text colour at the caption size (0.6 of the body size, never under the readable floor). Captioned blocks are the only ones whose geometry changes. See [footnotes, citations and captions](footnotes-citations-captions.md).

## Code

Code-specific fields are grouped under `code`. A string value is shorthand for `code.source`; use object form when syntax highlighting or a file label matters. In object form, `source` is required. `language` colours the code in the preview and the PowerPoint export (comments, strings, numbers, keywords, names and types, in colours from the deck theme); an unknown language stays plain and the text is never changed. See [dynamic composition](dynamic-composition.md#preview-polish-shared-by-preview-and-export-rr-07) for the supported languages.

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

Metric-specific fields are grouped under `metric`. A string or number value is shorthand for `metric.value`; numeric values stay numeric and are formatted by renderers at display time. Use object form when labels, descriptions, units, deltas, trends, or sentiment matter. A `trend` (`up`, `down`, `flat`) draws an arrow beside its word, coloured with the delta text, in the preview and the PowerPoint export; the arrow always points the way the trend does, and its colour follows `sentiment` (`positive` green, `negative` red, `neutral` the neutral text colour). When `sentiment` is absent up is positive, down is negative and flat is neutral, so set it when the direction is not the verdict: a falling churn, cost or latency is `"trend": "down", "sentiment": "positive"`. Only the trend arrow and the trend and delta text take the colour, so `sentiment` has no visible effect on a metric without a `trend`; the word stays editable text and the arrow carries "Trend: up" as its alternative text (see [dynamic composition](dynamic-composition.md#preview-polish-shared-by-preview-and-export-rr-07)).

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

A falling value that is good news keeps its downward arrow and takes the green:

```json
{
  "title": "Churn",
  "metric": {
    "value": "3.1%",
    "label": "Monthly churn",
    "delta": "-0.6 pts",
    "trend": "down",
    "sentiment": "positive"
  }
}
```

## Quote

Quote-specific fields are grouped under `quote`. A string value is shorthand for `quote.text`; use object form when attribution or citation matters. `text` is a string or `TextRun[]` with inline formatting; `attribution`, `role` and `source` are plain strings.

```json
{
  "title": "Customer Proof",
  "quote": {
    "text": "The new workflow made exceptions visible before they became escalations.",
    "attribution": "Priya Raman",
    "source": "Customer interview"
  }
}
```

A testimonial attributes the quote to a person with a title and a face. `role` is the person's title and organization, and `photo` is their headshot, an `Asset` (a source string or an object with `src` and `alt`):

```json
{
  "title": "Customer Proof",
  "quote": {
    "text": "The new workflow made exceptions visible before they became escalations.",
    "attribution": "Priya Raman",
    "role": "VP Operations, Acme",
    "photo": { "src": "asset:priya-raman", "alt": "Priya Raman" },
    "source": "Customer interview, March 2026"
  }
}
```

The footer under the quote is the attribution, then the role on its own line, then the source after ` - ` on the last line. Without a `role` it is the single line it always was (`attribution - source`). With a `photo`, the headshot is a circle at the start edge of the footer row (the left in a left-to-right deck, the right in a right-to-left one), three times the footer font size across, and the footer lines sit beside it, centered on it. The photo is cropped to fill the circle, and its size follows the footer's font size when the readability floor shrinks the footer. Without a `photo` nothing else changes. The preview draws it with the circular clip that `design.slideImage` uses for shape `circle`, and PowerPoint export writes a native picture with the `ellipse` geometry and the alt text as its description; importing that file restores `role` and `photo`. A photo needs alt text (the `opf/missing-alt-text` rule of `validate` checks `quote.photo`); an SVG photo exports as its PNG raster. A photo with no attribution, role or source still draws, alone in the footer row. The Markdown dialect has no native form for `role` and `photo`: a quote that carries them is written as an `opf` block, which round trips exactly, and a plain `> — Name, Title` line stays an attribution.

## Timeline

Timeline-specific fields are grouped under `timeline`. An array value is shorthand for `timeline.events`; use object form when the timeline needs a name or description. Timeline events use `when`, `what`, `description` and `status`. `status` is `done`, `current` or `planned` and marks progress: `done` is a filled marker with normal text, `current` ("we are here") is a ringed marker with a bold label, and `planned` is a hollow outlined marker with muted text. An event without a status draws as a plain filled marker. Schedule health (at risk, blocked) is not a status; say it in the event text. See [Dynamic composition](dynamic-composition.md#timeline-internals) for the exact drawing.

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

A roadmap with progress states:

```json
{
  "title": "Product roadmap",
  "timeline": [
    { "when": "Q1", "what": "Discovery", "status": "done" },
    { "when": "Q2", "what": "Pilot", "status": "current" },
    { "when": "Q3", "what": "Rollout", "status": "planned" }
  ]
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
