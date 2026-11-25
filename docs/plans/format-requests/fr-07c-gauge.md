# FR-07, part 3 design note: the gauge (CR 5)

A builder's brief for the third part of item FR-07 of the format-requests program (`docs/programs/format-requests/burndown.md` on
`main`). It builds on FR-06 (a metric computed from data, `fr-06-computed-metric.md` on this branch) and on part 2's bands
(`fr-07b-bands-and-bullet.md`), and lands after both. It is built last, because it reuses both. It ships in 0.37.0: the owner chose on 2026-11-25 that nothing is cut
(`r-one`).

Who decided what:

- **Owner, 2026-11-24**: native, editable PowerPoint parts, the gauge as native `blockArc` shapes plus text, not a doughnut
  (`cr5-export`, as round 2 made exact); built last (`cr5-which`). **Owner, 2026-11-25**: nothing is cut from 0.37.0 (`r-one`), so the gauge ships in it.
- **Supervisor, 2026-11-25, on the owner's delegation**: a gauge is a way to draw a metric, a metric with a `scale`, not a chart type.
- **Analysis, for the supervisor to confirm**: everything else, marked *(analysis)*.

## The need

"How full is it?" is a value against its range: 72% of capacity, NPS 41 on a scale of -100 to 100, 3.1 days against a 5-day limit. A metric
shows the number; a gauge shows where it sits in its range and which band it falls in. It binds to data like any metric, so the arc moves
when the data does.

## Schema

A new property on `Metric`:

```json
"scale": {
  "$ref": "#/$defs/MetricScale",
  "description": "Draws the metric as a gauge: its value on an arc from 'min' to 'max', with optional bands and a target. Only a number value draws a gauge; any other value draws the metric as without a scale, with a 'metric-scale-value' warning."
}
```

```json
"MetricScale": {
  "type": "object",
  "additionalProperties": false,
  "required": ["max"],
  "properties": {
    "min": { "$ref": "#/$defs/FiniteNumber", "default": 0, "description": "The value at the arc's start." },
    "max": { "$ref": "#/$defs/FiniteNumber", "description": "The value at the arc's end. Must be greater than 'min' ('metric-scale-range' otherwise)." },
    "bands": {
      "type": "array", "items": { "$ref": "#/$defs/ChartBand" }, "minItems": 1, "maxItems": 6,
      "description": "Ranges of the scale shaded along the arc, as a chart's bands: each from the previous 'to' (the first from 'min') to its own 'to'."
    },
    "target": { "$ref": "#/$defs/FiniteNumber", "description": "A value marked by a tick across the arc." }
  },
  "examples": [
    { "max": 1 },
    { "min": -100, "max": 100, "bands": [ { "to": 0, "label": "Detractors lead", "color": "accent2" }, { "to": 30 }, { "to": 100, "label": "Strong", "color": "accent3" } ], "target": 40 }
  ]
}
```

- `ChartBand` is part 2's definition (`{ to, label?, color? }`, `color` a `SchemeColorName`), reused so bands mean the same in a chart and
  a gauge.
- `target` is a number in 0.37.0. A target computed from data (a `DataLink`) can be added later without breaking anything. *(analysis)*
- No `sweep`, `style` or `needle` key: one gauge form. *(analysis)*
- `scale` is valid on the object form of a metric only (a string or number shorthand has no room for it), on a slide's `metric` and a
  block's `metric` alike.

Generated types: `MetricScale`, `Metric.scale`.

## What is drawn

The metric's block region holds, top to bottom: the gauge, then the metric's text as today (value, unit, label, description, change and
arrow), with the value placed inside the arc's bowl when it fits. *(analysis: the drawing below is the starting point; the item's before
and after pictures are reviewed by the owner before merging, as for every new drawing.)*

- **The arc**: a semicircle opening downward, from 180° (left, `min`) to 0° (right, `max`) through the top, its thickness 18% of its
  outer radius. *(analysis: the form readers recognize; a 240° arc does not export as one `blockArc` without overlapping its own text.)*
- **The track**: the full arc in the scheme's neutral (`text` mixed into `surface` at 12%).
- **The bands**, when present: the track is divided into band segments colored as part 2's bands (neutrals darkest lowest, or a band's
  `color` as a 25% tint on `surface`).
- **The value**: an arc from `min` to the value, in `primary`, or in the full `color` of the band the value falls in when that band has
  one. *(analysis: a value in the red band reads red.)* Drawn over the track at 60% of its thickness, centered in it, so the bands stay
  visible around it.
- **The target**: a tick across the arc at the target's angle, 1.4 times the arc's thickness, 2 reference pixels wide, in `text`.
- **The ends**: `min` and `max` printed under the arc's ends in the secondary text color, with the value column's format (FR-06) or the
  metric's number rules.
- **The text**: the metric's value centered under the arc's center, at the metric's value size (fitted as today); label, description and
  change below it, as today. `sentiment` and `better` color the change and arrow, not the arc.
- **Values outside the scale**: the value arc is clamped to the end; the printed value is the real one; `metric-scale-range` warns.
- **A region too small for a gauge** (an arc under 96 reference pixels wide at the readability floor of its text): the metric is drawn
  without the gauge, as a plain metric, and composition reports `metric-scale-dropped` (a composition diagnostic, not a validation
  finding). *(analysis: dashboards with many small tiles stay readable.)*
- Right-to-left decks: the arc still runs from `min` on the left to `max` on the right. *(analysis: a gauge is a dial, not text. The builder
  checks how bar charts draw their value axis in right-to-left decks today and follows the same rule.)*

Colors come from the color scheme only. A metric without `scale` draws and exports byte for byte as before.

## Rules

| Id | Severity | When | Message | Path |
| --- | --- | --- | --- | --- |
| schema | error | `max` missing, a band's `color` not a scheme name, a band list empty or over 6 | the schema message | the key |
| `metric-scale-range` *(analysis: name)* | warning | `max` not greater than `min`; the value, the target or a band's `to` outside `min`..`max` | `The gauge's {part} is outside its scale ({min} to {max}).` | `/.../metric/scale` |
| `metric-scale-value` *(analysis: name)* | warning | The drawn value is not a number (a string literal, or a computed text from `first`/`last`) | `A gauge needs a number; this metric is drawn without its gauge.` | `/.../metric/value` |
| `chart-bands-order` (part 2) | warning | The bands' `to` values are not increasing | part 2's message | `/.../metric/scale/bands` |

All are warnings, as the README fixes. The conformance cases are valid decks (a plain gauge, a gauge with bands and a target, a gauge bound
to data) and one invalid deck (no `max`).

## PowerPoint export and import

**Native parts**, all preset shapes, editable:

- The track, each band segment and the value arc are `p:sp` shapes with `a:prstGeom prst="blockArc"`, all with the same square frame
  (the arc's bounding square), so their arcs share one center. Each sets `a:avLst`:
  - `adj1`, the start angle, and `adj2`, the end angle, in 60,000ths of a degree, clockwise from east (PowerPoint's convention): the full
    track is `adj1 = 10800000` (west) to `adj2 = 0` (east), through north; a segment from `t0` to `t1` (fractions of the scale) is
    `adj1 = 10800000 + t0 × 10800000` to `adj2 = (10800000 + t1 × 10800000) mod 21600000`.
  - `adj3`, the thickness, as a share of the frame in 100,000ths (18% of the radius: `9000`). The value arc's frame is inset so it draws
    at 60% of the track's thickness, centered in it.
- Fills are `a:srgbClr` of the computed colors (as part 2's bands), no outline.
- The target is a straight connector (`p:cxnSp`, `prstGeom line`) from the arc's inner to its outer edge at the target angle, 2 pt, in the
  text color.
- The ends' labels and the metric's text are the text boxes of today's metric.
- **The angles and the thickness above are a starting point, not a pin** (supervisor, 2026-11-25). The builder reads back each arc's start,
  end and thickness from PowerPoint over COM and compares the picture with OPF's preview before anything is pinned in a test.
- **The group's frame** is the arc's bounding square, of which only the top half is drawn. The builder checks that the text boxes under the
  arc are not covered by the group's empty lower half in a way that makes them hard to select in PowerPoint; if they are, the group's frame
  is cropped to the top half and the arcs' frames extend outside it (PowerPoint allows that), whichever PowerPoint handles better
  (supervisor, 2026-11-25).
- The gauge's shapes are grouped (`p:grpSp`) with a tag `OPF_GAUGE_V1` on the group: `{ "v": 1, "group": "<metric group id>", "scale":
  <the authored scale>, "evidence": [[shape name, "<preset>", "<adj1>", "<adj2>", "<fill>"], ...] }`.

**The metric record**: the metric's `OPF_METRIC_V1` manifest stays as FR-06 leaves it. `scale` does not go into its validated `value` (a
0.36.0 importer would drop the metric) nor into its `link` key; it lives only in `OPF_GAUGE_V1`. The gauge's arcs are **not** tagged as
parts of the metric group: a 0.36.0 importer accepts at most one generated decoration mark per metric (the trend arrow, role `mark`), so
several arcs marked that way would make it drop the metric. *(analysis)*

**Import (0.37)**: the gauge is restored onto its metric while every recorded shape still has its recorded preset, angles and fill (the
value arc's angles change with the value, so they are evidence of an untouched file). An edited arc imports the arcs as ordinary shapes
beside the metric, with a `metric-scale-not-restored` diagnostic.

**Import (0.36.0, released)**: reads the metric from its manifest as a plain metric, and the gauge group, whose tag it does not know, as
ordinary shapes beside it. The deck is valid; it draws the arcs as shapes. The builder proves it with the released importer.

**Native check**: a gauge without bands, a gauge with three colored bands and a target, a gauge bound to data (FR-06), a gauge in a metric
tile row, and a right-to-left deck. PowerPoint draws the arcs on one center with the angles above; after its own save each `scale` comes
back. A Mac check covers Keynote's drawing of `blockArc` adjustments; a difference is recorded under opf#1416 and does not block the item.

## Editor

- The metric inspector gets a **Gauge** toggle; on, it shows `min`, `max`, the bands editor shared with charts (part 2) and `target`.
- Turning the gauge on fills `min` 0 and `max` from the value (the next round number above it, or 1 for a value between 0 and 1).
  *(analysis: an editor convenience; the format never guesses a scale.)*
- The canvas draws the gauge; the warnings show on the metric.

## Markdown and YAML

`scale` rides as a nested property of the metric. The round-trip test covers a gauge with bands and a target.

## Docs, skills, examples

- `docs/content-payloads.md` (metrics): "Gauges": the scale, bands, target, clamping, the small-region fallback. It says that a value
  outside the scale keeps printing its real number while its arc is clamped to the end, so a full arc does not read as "exactly `max`"
  (supervisor, 2026-11-25).
- The author skill: a gauge for a value against its range, against a bullet chart for several values against targets.
- One example deck: utilization, NPS with colored bands and a target, a gauge bound to data.

## Examples

Valid:

```json
{
  "name": "Gauges",
  "datasets": { "ops": { "columns": ["Week", { "name": "Utilization", "format": "0%" }], "rows": [ ["W46", 0.68], ["W47", 0.72] ] } },
  "slides": [
    { "title": "Capacity is at 72%", "metric": {
      "label": "Utilization", "value": 0.72,
      "data": { "dataset": "ops", "field": "Utilization", "aggregate": "last" },
      "scale": { "max": 1, "bands": [ { "to": 0.6 }, { "to": 0.85 }, { "to": 1, "label": "Overloaded", "color": "accent2" } ] } } },
    { "title": "NPS", "metric": {
      "label": "Net Promoter Score", "value": 41,
      "scale": { "min": -100, "max": 100,
                 "bands": [ { "to": 0, "label": "Detractors lead", "color": "accent2" }, { "to": 30 }, { "to": 100, "label": "Strong", "color": "accent3" } ],
                 "target": 40 } } }
  ]
}
```

Invalid (schema: `max` missing):

```json
{ "slides": [ { "title": "Utilization", "metric": { "value": 0.72, "scale": { "min": 0 } } } ] }
```

Warns (`metric-scale-value` at `/slides/0/metric/value`):

```json
{ "slides": [ { "title": "Utilization", "metric": { "value": "72%", "scale": { "max": 1 } } } ] }
```

## Edge cases

| Case | Answer |
| --- | --- |
| A computed value that does not resolve (FR-06 falls back to the literal) | The gauge draws the literal if it is a number; else the warning and no gauge. |
| `min` equal to `max` | `metric-scale-range`; no gauge. |
| A negative range (`-100` to `100`) | Drawn; the value arc starts at `min`, not at 0. *(analysis: a centered arc from 0 is a later option.)* |
| A band `to` above `max` | Clamped at `max`; `metric-scale-range` warns. |
| A target outside the scale | Not drawn; `metric-scale-range` warns. |
| A metric with a trend arrow and a gauge | Both: the arrow stays with the change line. |
| A metric in a row of tiles (`metric-tiles`) | Each tile draws its gauge at the tile's size, or falls back below the size limit. |
| `better: "down"` with a gauge | Colors the change, not the arc. The arc's color comes from its band. |
| A percent format on the value column | The ends print `0%` and `100%`. |
| Paging, a dark color variant | As for any metric; colors follow the variant. |

## Decisions the card leaves open, with the option taken

| Question | Option taken | Why |
| --- | --- | --- |
| Arc sweep *(analysis)* | A 180° semicircle | The familiar form; one `blockArc` per segment. |
| Value indicator *(analysis)* | A filled arc, not a needle | Needles are a rotated shape that PowerPoint users break when they resize; an arc stays an arc. |
| The value arc's color *(analysis)* | The color of the band it falls in, when that band has one; else `primary` | The band is the verdict. |
| `target` from data *(analysis)* | A number only in 0.37.0 | Smallest step; a link can follow. |
| Small regions *(analysis)* | A plain metric below 96 px, reported by composition | Dashboards stay readable. |
| Storage *(analysis)* | `scale` only in a new `OPF_GAUGE_V1` group tag; arcs not marked as metric parts | A 0.36.0 importer must still read the metric. |
| RTL *(analysis)* | Follow what bar charts do with their value axis | One rule for dials and axes. |
