# FR-07, part 2 design note: bands and the bullet chart (CR 5)

A builder's brief for the second part of item FR-07 of the format-requests program (`docs/programs/format-requests/burndown.md` on
`main`). Part 1 is the table color scale (`fr-07a-table-color-scale.md` on this branch), part 3 the gauge. This part is second in the cut
order: if the release date is at risk, it drops out after the gauge and follows in a patch, because it only adds.

Who decided what:

- **Owner, 2026-11-24**: native, editable PowerPoint parts (`cr5-export`); built in order and cut from the end (`cr5-which`); what is
  best for OPF over the requesting tool's shapes (the note on CR 5).
- **Supervisor, 2026-11-25, on the owner's delegation**: bands belong to every bar, column, line and area chart, not only the bullet;
  `bullet` is its own chart type.
- **Analysis, for the supervisor to confirm**: everything else, marked *(analysis)*.

## The need

"Is this number good?" needs the ranges that make it good: poor, fair, good; under, on, over budget. Today an author draws rectangles
behind a chart by hand, and they slide out of place when the axis rescales. A chart may shade ranges of its value axis (bands), and a
bullet chart shows a measure against its target over those ranges in one compact row per category: the standard way to put many KPIs and
their targets on one slide.

## Schema

### Bands

A new property on `Chart`, filling the slot `ChartReferenceLine`'s description reserves ("a band between two values"):

```json
"bands": {
  "type": "array",
  "items": { "$ref": "#/$defs/ChartBand" },
  "minItems": 1,
  "maxItems": 6,
  "description": "Ranges of the value axis shaded behind the data, in increasing order: each band runs from the previous band's 'to' (the first from the axis minimum) to its own 'to'. Colors come from the scheme's neutrals, darkest first, unless a band names its own. Bar, column, line and area charts (and their stacked forms) and the bullet chart draw them; other chart types ignore them with a 'chart-bands-unsupported' warning."
}
```

```json
"ChartBand": {
  "type": "object",
  "additionalProperties": false,
  "required": ["to"],
  "properties": {
    "to": { "$ref": "#/$defs/FiniteNumber", "description": "The band's upper end, in the value axis's units (with format 0%, 0.8 is 80%). Bands expand automatic axis bounds to the last 'to', as reference lines do." },
    "label": { "type": "string", "minLength": 1, "pattern": "\\S", "description": "The band's name, such as 'Poor' or 'On target': its legend entry and its text alternative. Absent: the band has no legend entry." },
    "color": { "$ref": "#/$defs/SchemeColorName", "description": "A scheme color instead of the neutral, for ranges that mean good or bad. Drawn as a light tint of that color (see Drawing). Absent: the next neutral." }
  }
}
```

- `SchemeColorName` is the definition part 1 adds (scheme slot and role names only).
- `color` is an addition to the card's `{ to, label }`. *(analysis: red, amber and green zones are the most common use; without it an
  author would paint them by hand again. Still scheme colors only, as the burndown requires.)*
- No `from` key: the first band starts at the axis minimum. *(analysis: a band that starts above the minimum is a band below it that is
  left unshaded, which a `color` of `background` already says.)*

### The bullet chart

- `Chart.type` gains `bullet`.
- `ChartMapping` gains `target`:

```json
"target": { "type": "string", "description": "Bullet charts: the column that holds each category's target, drawn as a tick across the bar. An unknown name is a 'chart-mapping-unknown-column' error. On other chart types it is ignored with a 'chart-mapping-adapted' warning." }
```

A bullet chart plots the category column (default: the first), one measure series (default: the first column that is not the category
or the target), the target (`mapping.target`, optional), and `chart.bands` (optional). It is horizontal: one row per category, top to
bottom in data order. *(analysis: horizontal is the form readers know; a vertical variant can be added later as its own type or option.)*

Generated types: `ChartBand`, `Chart.bands`, `ChartMapping.target`, and the `bullet` literal.

## Drawing (preview, PDF, PNG, editor)

### Bands on bar, column, line and area charts

- Each band is a rectangle across the plot area, from its lower to its upper value on the value axis, drawn behind gridlines and data,
  in front of the plot background.
- **Extent along the category axis** *(analysis, so the preview matches PowerPoint)*: bar and column charts, the full plot width (or
  height); line and area charts, from the first category's center to the last category's center, which is what a native area series
  covers.
- **Colors**: without `color`, the neutrals are the scheme's `text` mixed into `surface` at 18%, 12%, 8%, 5%, 3% and 2%, the first (lowest)
  band darkest. With `color`, that color mixed into `surface` at 25%. Every band keeps 3:1 contrast between the data mark and the band;
  a mark that would fall under it gets the existing outline treatment. *(analysis: low is darker, as bullet charts are read; the exact
  mixes are tuned on the gallery schemes and recorded in the goldens.)*
- Bands appear in the legend (when the chart has one) after the series, by `label`; a band without a label has no entry.
- Bands and `referenceLines` combine: bands behind, reference lines on top.
- Bands never change the data drawn: bar widths, labels and the category axis are as without them, apart from axis bounds that expand to
  the last `to`.

### The bullet chart

- One row per category. Within a row, from back to front:
  1. The bands, across the full row height (the plot is the row band; no gap between rows' bands). *(analysis)*
  2. The measure bar: one third of the row height, centered, the series color (`primary` by default, as a single-series bar chart).
  3. The target: a tick perpendicular to the bar at the target value, two thirds of the row height, 2 reference pixels wide, in the
     scheme's `text` color.
- The value axis is shared by all rows; it starts at 0 unless a value or band is negative, and ends at the largest of the values, the
  targets and the last band's `to`.
- Category labels sit left of the rows (right in a right-to-left deck). Data labels, when on, sit at the bar's end.
- `highlight` works as on a bar chart (by category).
- A chart with no bands and no target is a thin-bar bar chart; that is valid.

## Rules

| Id | Severity | When | Message | Path |
| --- | --- | --- | --- | --- |
| schema | error | `bands` empty or over 6 items, a `to` that is not finite, a raw color in `color` | the schema message | the key |
| `chart-mapping-unknown-column` (existing) | error | `mapping.target` names no column | the existing message | `/.../chart/mapping/target` |
| `chart-bands-order` *(analysis: name)* | warning | The `to` values are not strictly increasing | `The bands are not in increasing order; they are drawn sorted.` | `/.../chart/bands` |
| `chart-bands-unsupported` *(analysis: name)* | warning | `bands` on a chart type that does not draw them (pie, scatter, radar, treemap, ...) | `This chart type does not draw bands; they are ignored.` | `/.../chart/bands` |
| `chart-mapping-adapted` (existing) | warning | `mapping.target` on a chart that is not `bullet` | the existing message | `/.../chart/mapping/target` |
| `chart-series-dropped` (existing) | warning | A bullet chart with more than one measure series | the existing message | `/.../chart` |
| `chart-value-not-numeric` (existing) | warning | A target cell that is not a number | the existing message | the cell |

- The README fixes errors for a short list; everything new here is a warning. Engines sort unordered bands rather than refuse them.
- The burndown's invalid deck "for a band ... that names no column or has no data": the bullet's `mapping.target` naming no column is an
  error (the existing mapping rule), and an empty `bands` is a schema error. These are the conformance cases.

## PowerPoint export and import

All native chart parts, editable in PowerPoint's chart tools. The chart-type record's `mappings.openxml` describes them (below).

### Bands on bar, column, line and area charts

- One extra chart group in the plot area, **before** the data's group so it draws behind it:
  - bar and column charts: a `c:barChart` with `c:grouping val="stacked"`, `c:gapWidth val="0"`, `c:overlap val="100"`, the same
    `c:barDir` as the data, one series per band whose every category value is the band's height (`to` minus the previous `to`; the first
    band's height from the axis minimum), on a second pair of axes;
  - line and area charts: a `c:areaChart` with `c:grouping val="stacked"`, the same series values, on a second pair of axes.
- The second axes are deleted (`c:delete val="1"`) and their scaling is fixed to the primary value axis's (`c:min`, `c:max` written on
  both), so bands and data share one scale. *(analysis: a band group on the primary axes would stack with stacked data.)*
- Band series fills are the computed colors (`a:srgbClr`), no line, no data labels, no markers. Their names are the labels; a band without
  a label gets a `c:legendEntry` with `c:delete val="1"`.
- The embedded workbook gets the band series as extra columns after the data, headed by the labels (or "Band 1" ...), so Edit Data shows
  them. *(analysis)*
- A chart without `bands` exports byte for byte as before.

### The bullet chart

In one `c:plotArea`, in this order:

1. The bands: a `c:barChart`, `c:barDir val="bar"`, stacked, gap width 0, overlap 100, on secondary axes as above.
2. The measure: a `c:barChart`, `c:barDir val="bar"`, clustered, `c:gapWidth val="200"` (a thin bar), on the primary axes. The category
   axis is reversed (`c:orientation val="maxMin"`) so the first category is on top, as in the preview.
3. The target: a `c:scatterChart` series on its own axes, x = the target, y = the category's center (0.5, 1.5, ... on a value axis from 0
   to the category count, reversed to match), no marker, with Y error bars (`c:errBars`, `c:errDir val="y"`, `c:errBarType val="both"`,
   `c:errValType val="fixedVal"`, `c:val val="0.33"`, `c:noEndCap val="1"`) drawn 2 pt in the text color: a vertical tick at the target.
   Its x axis shares the measure axis's fixed bounds; its y axis is deleted.

This is the established way to build a bullet chart from native parts. *(analysis: a marker series is not possible on a horizontal bar
chart, which has no line form; the scatter series with error bars is the native tick. The burndown's "a target marker series" is this.)*
The native check confirms that PowerPoint draws the tick on the target. Whether Keynote does is not known (supervisor, 2026-11-25): the
item's test file is opened on the Mac once it is built, and a Keynote difference is recorded under opf#1416 and does not block the item.

### Records and import

- The chart's `OPF_DATA_V1` record stores the authored chart data as today. `bands` and `mapping.target` are chart properties. Where the
  record stores the chart's authored properties in a validated section, the 0.37 keys go in a top-level key of the record instead,
  `chart37: { "bands": [...], "target": "Target", "type": "bullet" }`, and the validated part holds what a 0.36.0 importer can read: the
  type `bar`, and the data without the target column's role. *(analysis: the builder reads which parts of the record the released
  importer validates and puts only the 0.36 form there; the rule is the one FR-06 and part 1 follow. A 0.36.0 importer ignores unknown
  top-level keys of the slide and document records, verified on 2026-11-25; the builder proves the same for this record, else uses a new
  whole tag, `OPF_CHART_BANDS_V1`, on the frame.)*
- **Import (0.37)**: restores `bands`, `target` and `bullet` while the native caches still hash the same (the existing evidence rule of the
  chart record); an edit in Edit Data makes the chart import as what PowerPoint now holds, with the existing diagnostic.
- **Import (0.36.0, released)**: reads a bar chart with extra series (the bands, and the target as a scatter series it may drop); the deck
  is valid. The builder proves it with the released importer.
- **Native check**: a column chart with three labeled bands, a line chart with bands and a reference line, a bullet chart of five KPIs
  with targets and three bands, and a bullet chart in a right-to-left deck. PowerPoint draws each as the preview does (bands behind,
  ticks on the targets); after its own save each comes back. A Mac check covers Keynote.

### The chart-type record

A new gallery record `packages/gallery/catalog/chart-types/bullet.json`, with previews:

```json
{
  "$schema": "https://openpresentation.org/schema/opf-chart-type/v1",
  "id": "bullet",
  "name": "Bullet",
  "summary": "One thin bar per measure against its target tick, over shaded ranges: many KPIs and their targets on one slide.",
  "mappings": {
    "openxml": {
      "element": "barChart",
      "barDir": "bar",
      "grouping": "clustered",
      "composition": "mixed",
      "series": [
        { "element": "barChart", "barDir": "bar", "grouping": "stacked" },
        { "element": "barChart", "barDir": "bar", "grouping": "clustered" },
        { "element": "scatterChart" }
      ],
      "notes": "Bands as a stacked c:barChart (gap width 0) on deleted secondary axes, drawn first; the measure as a clustered c:barChart (gap width 200) on the primary axes; the target as a c:scatterChart series without markers whose fixed Y error bars draw a tick at each target."
    }
  },
  "group": "Bar",
  "groupSort": 4,
  "series": 1,
  "complexity": "advanced"
}
```

The `group`, `groupSort` and `complexity` values follow the existing records; the builder checks them against the schema's enums. The
new record changes the gallery tracker: the item's pull request regenerates it with its generator, because a stale tracker only warns on a
pull request and then turns `main` red (supervisor, 2026-11-25).

## Editor

- The chart inspector gets a **Bands** section on charts that draw them: add, remove and reorder bands; each with its upper value, label
  and an optional scheme color swatch. Values are typed in the axis's display format.
- The chart type picker lists **Bullet** (from the gallery record). Choosing it on a chart with a column named like "Target" or "Goal"
  sets `mapping.target` to it. *(analysis: a convenience in the editor only; the format never guesses.)*
- The data panel marks the target column.

## Markdown and YAML

`bands` and `mapping.target` ride as nested chart properties. The round-trip test covers a column chart with bands and a bullet chart.

## Docs, skills, examples

- `docs/chart-table-data.md`: "Ranges behind a chart (bands)" and "Bullet charts". It says that a chart with bands has fixed
  value-axis bounds in PowerPoint (both axis pairs carry `c:min` and `c:max`), so a value typed beyond them in Edit Data does not rescale
  the chart: the price of the shared scale (supervisor, 2026-11-25).
- The author skill: a bullet chart for several KPIs against targets, against a set of metrics.
- One example deck with a banded column chart and a bullet chart.

## Examples

Valid:

```json
{
  "name": "Bands and bullet",
  "datasets": {
    "kpis": {
      "columns": ["KPI", { "name": "Actual", "format": "0%" }, { "name": "Target", "format": "0%" }],
      "rows": [ ["Win rate", 0.31, 0.35], ["Retention", 0.92, 0.9], ["NPS reached", 0.64, 0.7], ["On-time delivery", 0.88, 0.95] ]
    },
    "wait": {
      "columns": ["Week", { "name": "Wait (min)", "format": "0" }],
      "rows": [ ["W1", 14], ["W2", 11], ["W3", 9], ["W4", 12] ]
    }
  },
  "slides": [
    { "title": "KPIs against target", "chart": {
      "type": "bullet",
      "data": { "dataset": "kpis" },
      "mapping": { "category": "KPI", "series": ["Actual"], "target": "Target" },
      "bands": [ { "to": 0.6, "label": "Poor" }, { "to": 0.85, "label": "Fair" }, { "to": 1, "label": "Good" } ] } },
    { "title": "Wait time stays under ten minutes in W3 only", "chart": {
      "type": "column",
      "data": { "dataset": "wait" },
      "bands": [ { "to": 10, "label": "Within target", "color": "accent3" }, { "to": 20, "label": "Over target" } ] } }
  ]
}
```

Invalid (`chart-mapping-unknown-column` at `/slides/0/chart/mapping/target`):

```json
{ "slides": [ { "title": "KPIs", "chart": {
  "type": "bullet",
  "data": { "columns": ["KPI", "Actual"], "rows": [ ["Win rate", 0.31] ] },
  "mapping": { "target": "Goal" } } } ] }
```

Invalid (schema: `minItems`):

```json
{ "slides": [ { "title": "Wait", "chart": {
  "type": "column", "data": { "columns": ["Week", "Wait"], "rows": [ ["W1", 14] ] }, "bands": [] } } ] }
```

## Edge cases

| Case | Answer |
| --- | --- |
| Bands on a stacked or 100% stacked chart | Drawn; on 100% charts the values are shares (0.5 is 50%). |
| Bands on a combo chart | On the primary value axis only. *(analysis)* |
| Negative values | The first band starts at the axis minimum, which may be negative. |
| A band `to` below the axis minimum | Not drawn; no finding. |
| The last `to` above every value | The axis extends to it (as a reference line extends it). |
| A bullet chart with a missing target in one row (`null`) | No tick in that row. |
| A bullet chart with a target and no bands | Bar and ticks; valid. |
| A bullet chart with several series | The first is drawn; `chart-series-dropped` names the rest. |
| A horizontal `bar` chart with bands | Bands run along the bars, as on columns turned on their side. |
| A right-to-left deck | Category labels on the right; the value axis runs right to left as for bar charts today. |
| `highlight` on a bullet chart | By category, as a bar chart. |
| The small-chart rules (automatic emphasis of the last point) | A bullet chart has none: its categories are not a time series. *(analysis)* |

## Decisions the card leaves open, with the option taken

| Question | Option taken | Why |
| --- | --- | --- |
| A color per band *(analysis)* | Optional `color`, scheme names only | Good and bad zones without hand drawing. |
| Where bands start *(analysis)* | At the axis minimum; no `from` | One rule; an unshaded range is a band in `background`. |
| Band colors by default *(analysis)* | Neutrals, darkest lowest | How bullet charts are read. |
| Band extent on line charts *(analysis)* | First to last category center | What the native area series covers; preview and PowerPoint match. |
| Bullet orientation *(analysis)* | Horizontal only, for now | The known form. |
| The PowerPoint target *(analysis)* | A scatter series with fixed Y error bars | The native tick on a horizontal bar chart. |
| The band group's axes *(analysis)* | Deleted secondary axes fixed to the primary scale | Bands must not stack with stacked data. |
| Bands in the workbook *(analysis)* | Extra columns after the data | Edit Data shows what the chart draws. |
| Errors vs warnings *(analysis)* | Only the unknown target column is an error; the rest warn | The README's fixed severities. |
| Record storage *(analysis, confirm in the build)* | The 0.36 form in the validated part, the 0.37 keys in a top-level record key or a new tag | A 0.36.0 importer must still read the chart. |
