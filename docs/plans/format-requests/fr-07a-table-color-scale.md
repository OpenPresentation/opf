# FR-07, part 1 design note: the table color scale (CR 5)

A builder's brief for the first part of item FR-07 of the format-requests program (`docs/programs/format-requests/burndown.md` on
`main`). FR-07 has three parts, each its own pull request with its own PowerPoint check: this one (the table color scale), then bands with
the bullet chart (part 2), then the gauge (part 3). This part depends on nothing in the data track. The owner chose on 2026-11-25 that nothing is cut from 0.37.0 (`r-one`): every part ships in it.

Who decided what:

- **Owner, 2026-11-24**: native, editable PowerPoint parts (`cr5-export`); all three built in order (`cr5-which`; its "cut from the end" is replaced by the owner's no-cut answer of 2026-11-25);
  "go with what is best for OPF" over the requesting tool's shapes (the note on CR 5).
- **Supervisor, 2026-11-25, on the owner's delegation**: a heatmap is a table option, `colorScale`, not a chart type.
- **Analysis, for the supervisor to confirm**: everything else, marked *(analysis)*.

## The need

A scorecard, a cohort table or a regional comparison reads faster when each number's cell is shaded by its size. Today an author paints
each cell's `style.fill` by hand, and the shading is wrong as soon as a number changes. A table names the columns to shade and the scheme
colors to shade between, and engines compute every cell's fill from its number.

## Proposed, waiting for the owner's pick: one `colors` list

From the key-names study (`key-names-study.md`, finding A2, decision `k-colors`). If the owner picks it, `from`, `mid` and `to` are replaced
by `colors`: an array of two or three `SchemeColorName`, low to high (`minItems: 2`, `maxItems: 3`, default `["surface", "primary"]`). Three
colors make the scale diverging; `center` is valid only with three and stays optional (without it: 0 when the values span both signs, else
the midpoint of the range, with the supervisor's symmetric rule when no end is pinned). `min`, `center` and `max` keep their names. The
drawing does not change.

## Schema

A new property on `Table`:

```json
"colorScale": {
  "$ref": "#/$defs/TableColorScale",
  "description": "Shades the number cells of the named columns by value, between scheme colors. Engines compute each cell's fill; the text color follows it for contrast."
}
```

```json
"TableColorScale": {
  "type": "object",
  "additionalProperties": false,
  "required": ["columns"],
  "description": "A color scale over the number cells of one or more columns. One scale is shared by all named columns, so equal numbers get equal colors.",
  "properties": {
    "columns": {
      "type": "array", "items": { "type": "string" }, "minItems": 1, "uniqueItems": true,
      "description": "The columns to shade, by header text (an inline table) or by dataset column name after 'fields' (a dataset-backed table). A name no column has is a 'table-color-scale-unknown-column' error."
    },
    "from": { "$ref": "#/$defs/SchemeColorName", "description": "The color of the lowest value. Absent: 'surface'." },
    "to": { "$ref": "#/$defs/SchemeColorName", "description": "The color of the highest value. Absent: 'primary'." },
    "mid": { "$ref": "#/$defs/SchemeColorName", "description": "Makes the scale diverging: the color of 'center', with 'from' below it and 'to' above it." },
    "center": { "type": "number", "description": "The value drawn in 'mid'. Only with 'mid'. Absent: 0 when the values span both signs, else the middle of the range." },
    "min": { "type": "number", "description": "The value drawn in 'from'. Absent: the lowest number in the named columns." },
    "max": { "type": "number", "description": "The value drawn in 'to'. Absent: the highest number in the named columns." }
  },
  "dependentRequired": { "center": ["mid"] },
  "examples": [
    { "columns": ["Q1", "Q2", "Q3", "Q4"] },
    { "columns": ["YoY %"], "from": "accent2", "mid": "surface", "to": "accent1", "center": 0 }
  ]
}
```

```json
"SchemeColorName": {
  "type": "string",
  "enum": ["accent1", "accent2", "accent3", "accent4", "accent5", "accent6", "dark1", "dark2", "light1", "light2",
           "primary", "secondary", "accent", "background", "surface", "surfaceAlt", "text", "textSecondary"],
  "description": "A color of the effective color scheme, by slot or role, resolved as ColorRef resolves the same names. No hex, no variable: a color scale follows the deck's colors."
}
```

- `from`, `to` and `mid` take scheme names only: no hex, no `var:`, no transform. *(analysis: "colors come from the color scheme,
  never as raw colors" in the burndown; a raw color would not follow a re-themed deck. `hyperlink` and `followedHyperlink` are left out.)*
- `center`, `min` and `max` are additions to the card's `columns`, `from`, `to`, `mid`. *(analysis: without `center` a diverging scale
  of changes would center on the middle of the range, not on zero; without `min` and `max` a 0 to 100% scale cannot be pinned when the
  data spans 62 to 88%.)*
- `SchemeColorName` is new so later items (bands, the gauge) use the same restriction.
- **Supervisor, 2026-11-25:** the builder takes the name list from what `ColorRef` really resolves in the schema (minus the hyperlink
  colors) and reports any difference from the enum above.

Generated types: `TableColorScale`, `SchemeColorName`, `Table.colorScale`.

## Computing the fills

Core gets `resolveTableColorScale(table, context)` returning, for each body cell of a named column, `{ fill, text }` (resolved colors),
and the diagnostics. Composition calls it; every engine draws its result.

1. **The cells.** Body cells of the named columns (header cells never). A cell takes part when its value is a finite number. Strings,
   booleans, null and rich runs are left unshaded. A cell with its own `style.fill` keeps it and still counts towards the range.
   *(analysis)*
2. **The range.** `min` and `max`, else the lowest and highest participating number across all named columns. Values outside a pinned
   range clamp to its ends.
3. **The position** `t` of a value `v`:
   - Sequential (no `mid`): `t = (v - min) / (max - min)`; when `max = min`, every cell is at `t = 1`. *(analysis: equal values read as
     "all high", the color of the one value present)*
   - Diverging (`mid`): with `c = center`, values below `c` map from `from` (at `min`) to `mid` (at `c`), values above from `mid` to `to`
     (at `max`), each side on its own span, so 0 is always `mid`. When `min` and `max` are on one side of `c`, only that side is used.
4. **The color.** Interpolate between the two resolved end colors in OKLab, then convert to sRGB. *(analysis: perceptually even steps; a
   linear RGB mix goes muddy through the middle)*
5. **The text color.** Of the scheme's `text` and `background` colors, the one with the higher contrast on the fill; rich runs with their
   own color keep it. The chosen pair is at least 4.5:1 for both ends of any scheme that passes the existing contrast checks; a test
   covers every gallery color scheme with `surface` to `primary` and `accent2` / `surface` / `accent1`. *(analysis)* **Supervisor, 2026-11-25:** if any gallery scheme ends below 4.5:1 with the default colors, the builder stops and
   reports the numbers rather than weakening the test.

**With `table.highlight`.** A highlighted row's scaled cells take the scale's fill (the scale is about each number; the highlight tint
would hide it); its other cells keep the highlight tint. *(analysis)*

## Rules

| Id | Severity | When | Message | Path |
| --- | --- | --- | --- | --- |
| schema | error | `columns` empty, a raw color in `from`/`to`/`mid`, `center` without `mid` | the schema message | the key |
| `table-color-scale-unknown-column` | error | A name in `columns` is no column of the table | `The color scale names "{name}", which is no column of this table. Columns: {list}.` (like `table-highlight-unknown-name`) | `/.../table/colorScale/columns/{i}` |
| `table-color-scale-no-data` *(analysis: name)* | warning | No named column has a number cell | `The color scale's columns hold no numbers, so no cell is shaded.` | `/.../table/colorScale` |
| `table-color-scale-range` *(analysis: name)* | warning | `min` is not less than `max`, or `center` is outside `min`..`max` | `The color scale's range is empty or its center is outside it.` | `/.../table/colorScale` |

- The burndown asks for an invalid deck "for a band or color scale that names no column or has no data". "Names no column" is covered by
  the schema (`minItems: 1`) and the unknown-column error. "Has no data" is a **warning here**, not an error. *(analysis, for the
  supervisor to confirm: a dataset-backed table can lose its numbers on a refresh, and a refresh must not make a deck invalid.)*
- The errors get conformance cases (an empty `columns`, an unknown column); the warnings do not.

## What engines draw

| Output | Draws |
| --- | --- |
| Preview, PDF, PNG, editor | Each scaled cell filled with its computed color, its text in the computed text color. Borders, padding and banding of other cells unchanged. |
| PowerPoint | A native table, as today, with each scaled cell's `a:tcPr` fill set to the computed color (`a:srgbClr`) and its runs' color set to the computed text color. Editable as any table. |

A table without `colorScale` draws and exports byte for byte as before.

**Why `srgbClr` and not a scheme color with a tint.** Most interpolated colors are not a scheme color plus one `lumMod`/`lumOff`, so
PowerPoint's re-theme cannot keep them right anyway. OPF keeps them right: the record restores `colorScale`, and the next export computes
from the new scheme. *(analysis)*

## PowerPoint export and import

> Owner, 2026-11-25, to the release supervisor: "We don't need to worry about backwards compatibility since we don't have existing
> users just yet all our stuff updated".
> The supervisor's application of it: what this section does to keep a released 0.36.0 importer reading the file was built before
> that direction and is acceptable as built; nothing new is owed to a 0.36.0 importer, and no test needs to run it.

- **Record.** Tables are recorded in `OPF_DATA_V1` on the table frame. Since opf#1464 that record stores an authored table with array rows,
  and a released 0.36.0 importer validates the stored table: a `colorScale` key inside it would make that importer drop the record.
  So the stored table is written **without** `colorScale`, and the color scale goes in a top-level key of the record,
  `colorScale: { "scale": <authored>, "evidence": [[row, column, "<fill hex>"], ...] }`. No new row or cell form enters the record.
- **To confirm in the build** *(analysis)*: that the released 0.36.0 importer ignores an unknown top-level key of `OPF_DATA_V1`. If it does
  not, the color scale goes in a new whole tag on the frame, `OPF_TABLE_SCALE_V1`, which that importer ignores as an unknown tag.
- **Import (0.37)**: `colorScale` is restored while every recorded cell still has its recorded fill. A cell refilled in PowerPoint makes
  the scale come back as plain cell fills (`style.fill` per cell, the native truth), with a `table-color-scale-not-restored` diagnostic.
  The restored table has no `style.fill` on scaled cells, so the deck is the source.
- **Import (0.36.0, released)**: imports the table with each scaled cell's fill as that importer reads fills today. The deck is valid.
- **Native check**: one file with a sequential scale over four quarter columns, a diverging scale on a YoY % column with `center: 0`, and
  a dataset-backed table with a scale. PowerPoint draws the fills and text colors; after its own save each `colorScale` comes back.

## Editor

- The table inspector gets a **Color scale** section: the columns (checkboxes of the number columns), sequential or diverging, `from`,
  `mid` and `to` as scheme color swatches (no custom color picker), `center`, and an optional pinned range.
- Cell fills of scaled cells are not editable in the cell inspector; it says "Shaded by the color scale" and offers to remove the column
  from the scale.
- Changing a number re-shades live.

## Markdown and YAML

`colorScale` rides as a nested property of the table. The round-trip test covers a sequential and a diverging scale.

## Docs, skills, examples

- `docs/chart-table-data.md`: "Shading cells by value" (the two kinds of scale, `center`, pinned ranges, why scheme colors only).
- The author skill: when to shade a table against charting it.
- One example deck: a quarterly scorecard and a YoY table.

## Examples

Valid:

```json
{
  "name": "Color scale",
  "slides": [
    { "title": "Win rate by region and quarter", "table": {
      "columns": ["Region", { "name": "Q1", "format": "0%" }, { "name": "Q2", "format": "0%" }, { "name": "Q3", "format": "0%" }],
      "rows": [ ["EMEA", 0.22, 0.25, 0.31], ["Americas", 0.28, 0.27, 0.24], ["APAC", 0.18, 0.21, 0.26] ],
      "colorScale": { "columns": ["Q1", "Q2", "Q3"], "min": 0, "max": 0.4 } } },
    { "title": "Year on year", "table": {
      "columns": ["Product", { "name": "YoY %", "format": "+0%;-0%;0%" }],
      "rows": [ ["Core", 0.12], ["Add-ons", -0.08], ["Services", 0.03] ],
      "colorScale": { "columns": ["YoY %"], "from": "accent2", "mid": "surface", "to": "accent1", "center": 0 } } }
  ]
}
```

Invalid (`table-color-scale-unknown-column` at `/slides/0/table/colorScale/columns/0`):

```json
{ "slides": [ { "title": "Win rate", "table": {
  "columns": ["Region", "Q1"], "rows": [ ["EMEA", 0.22] ],
  "colorScale": { "columns": ["Q4"] } } } ] }
```

Invalid (schema: `minItems`):

```json
{ "slides": [ { "title": "Win rate", "table": {
  "columns": ["Region", "Q1"], "rows": [ ["EMEA", 0.22] ],
  "colorScale": { "columns": [] } } } ] }
```

## Edge cases

| Case | Answer |
| --- | --- |
| An inline table with no `columns` (no headers) | No column has a name, so every named column is unknown: the error. |
| Two columns with the same header text | The name matches both; both are shaded. |
| A header that is rich runs or a styled cell | Matched by its plain text. |
| A cell spanning several columns (`colSpan`) | Shaded when its own column is named. |
| A string number (`"12"`) in a scaled column | Not shaded (only numbers take part); FR-05's typed-column warning may apply in a dataset. |
| Percent cells formatted `0%` | Scaled by their numbers (0.22), as drawn after format. |
| A dataset-backed table and `fields` | Names are dataset column names after the selection. |
| A dark color variant | `surface` and `primary` resolve through the variant, so the scale follows the slide. |
| Every cell equal | All at `to` (sequential), or at `mid` when equal to `center`. |
| `mid` without `center`, values all positive | `center` is the middle of the range. |
| A paged table split across slides | One scale computed over the whole table, so a value has the same color on every page. *(analysis)* |

## Decisions the card leaves open, with the option taken

| Question | Option taken | Why |
| --- | --- | --- |
| Colors allowed *(analysis)* | Scheme names only, a new `SchemeColorName` | The burndown's rule; the scale follows re-theming. |
| Defaults *(analysis)* | `from: surface`, `to: primary` | Reads as "more is stronger" on any scheme. |
| `center`, `min`, `max` *(analysis)* | Added, optional | Needed for diverging changes and for pinned ranges. |
| One scale or one per column *(analysis)* | One shared scale | A heatmap compares across columns. |
| Interpolation *(analysis)* | OKLab | Even perceived steps. |
| Text color *(analysis)* | `text` or `background`, whichever contrasts more | Readable on every fill. |
| With `highlight` *(analysis)* | Scaled cells take the scale | The scale is per number. |
| No numbers in the columns *(analysis, confirm)* | A warning, not an error | A refresh must not invalidate a deck. |
| Storage *(analysis, confirm in the build)* | A top-level key of `OPF_DATA_V1`, else a new whole tag | The stored table must stay a 0.36 table. |
| Paged tables *(analysis)* | One range over the whole table | Same value, same color. |

## Two lessons from the earlier 0.37 builds (supervisor, 2026-11-25)

- **The editor's keyboard browser suites pin completion counts by key name.** A new or renamed key changes how many completions the
  source editor offers at the pinned positions, so those suites fail until their counts are updated. Run them before the pull request
  opens, not after the first red check.
- **The breaking-change gate needs every removed schema path named.** A `type: changed` fragment must name each schema path the change
  removes, in the gate's form (for example `opf.schema.json:$defs.DataSourceRef`); a renamed key is a removed path and an added one.
