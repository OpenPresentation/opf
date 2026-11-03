# Chart options: axis titles, legend, data labels, highlight, series colors and the value axis

Status: RR-35 (release readiness) for axis titles, legend and data labels, FA-14 (format audit) for `highlight`, and RR-89 and RR-92 (core 0.21.0) for series colors (`chart.colors`) and the computed value axis. The first four fields change geometry only for charts that use the first three fields, and colors only for charts that use `highlight`. Use the coordinated package set in the [compatibility matrix](compatibility-matrix.md); schema support alone does not establish native visual fidelity.

## The fields

Four optional fields on the `Chart` object (the fourth, `highlight`, has [its own section](#chart-emphasis-highlight) below):

```json
{
  "chart": {
    "type": "column",
    "data": { "columns": ["Quarter", "Revenue"], "rows": [["Q1", 12], ["Q2", 18]] },
    "axisTitles": { "category": "Quarter", "value": "Revenue ($M)" },
    "legend": "bottom",
    "dataLabels": { "content": ["value"], "position": "outside-end" }
  }
}
```

| Field | Values | Absent means |
| --- | --- | --- |
| `axisTitles` | `{ category?: string, value?: string, secondary?: string }` (`secondary`: combo charts) | no axis titles (today) |
| `legend` | `none`, `top`, `bottom`, `left`, `right` | a line chart of two to four series names its series at the [line ends](#defaults-follow-few) and a pie or one-series doughnut names its slices, with no legend (each falls back to its legend when the names do not fit); a column, bar, area or combo chart of two to four series shows its legend in the [header row](#chart-layer-small-charts-and-the-header-row) above the plot; other multi-series charts and pie and doughnut charts a legend at the right; none for a single-series chart |
| `dataLabels` | `true`, `false` or `{ content?, position?, separator? }` | no data labels, except on a [small chart](#chart-layer-small-charts-and-the-header-row), which labels its values, and the [direct labels](#defaults-follow-few) of line, pie and doughnut charts; the funnel and treemap constructs keep the labels they draw by default (values, category names) |

`axisTitles.category` titles the axis that carries the row labels: the horizontal axis of a column, line, area, histogram, pareto, waterfall and box-and-whisker chart, the **vertical** axis of a bar chart and the X axis of a scatter chart. `axisTitles.value` titles the other one. A named `legend` position shows the legend there even for a single-series chart; `none` hides it.

`dataLabels: true` is `{ "content": ["value"], "position": "auto" }`. `dataLabels: false` draws no labels: on a small chart it switches the default value labels off and brings the value axis back, and on the funnel and treemap constructs, which label their marks by default, it removes those labels (`resolveChartOptions` reports `dataLabelsOff`). In the object form:

- `content`: any of `category`, `value`, `percent` (default `["value"]`). A label shows the selected parts in the fixed order category, value, percent, joined by `separator` (default `", "`). Values print in the General number format (twelve significant digits), `percent` as the integer share of the total (`0%`), `category` as the category name (the X value on a scatter chart).
- `position`: `auto` (default), `center`, `inside-end`, `inside-base`, `outside-end`, `above`, `below`, `left`, `right`. `auto` is the type's default in the table below; the engines write that concrete position, so the preview and PowerPoint do not each pick their own.
- `separator`: text between the parts.

## Chart emphasis: `highlight`

Highlighting the one series or category that carries the message, and muting the rest, is the main data-storytelling technique. The content stays semantic: `highlight` names series and categories, and the engines pick the colors from the theme. There is no color field.

```json
{
  "chart": {
    "type": "column",
    "data": { "columns": ["Quarter", "Revenue", "Costs"], "rows": [["Q1", 12, 8], ["Q2", 18, 11], ["Q3", 24, 15]] },
    "highlight": { "series": ["Revenue"], "categories": ["Q3"] }
  }
}
```

| Field | Meaning |
| --- | --- |
| `highlight.series` | Value columns (series) whose marks are highlighted: every mark of each named series. Names match the data column names after any `fields` selection; a series is a plotted value column. |
| `highlight.categories` | Row labels (the category column, or `mapping.category`) whose marks are highlighted: a column or bar of every series, a line's points, a pie or doughnut slice. Labels match as text (the number `2024` as `"2024"`) and a label shared by several rows highlights each of them. |

**The rule.** When `highlight` is present, a mark is highlighted if its series OR its category is listed. Highlighted marks take the deck's primary (accent) color; every other mark takes a muted neutral derived from the theme. With both lists given, a bar of series `Revenue` in any category is highlighted, and so is a bar of category `Q3` in any series. A chart without `highlight` keeps its colors, byte for byte. A highlight that names nothing the chart plots (for example a column that is the category column) leaves the chart as if it had none.

**The colors** come from core's `chartHighlightColors(surface, primary, text)`, which the preview and the PPTX export both call with the chart's backdrop (the card or the slide background: no chart has a panel, LH-105), the deck primary and the chart text color:

- the accent is the primary color, kept at 3:1 contrast against the panel by `chartColorForFill` (a primary that already has that contrast is used unchanged);
- the muted color is the panel mixed 30% of the way toward the text color: a light gray on a light panel and a dim gray on a dark one, in the panel's own hue. If that is under 1.6:1 against the panel, the mix moves toward the text color until it holds, so a muted mark is always visible and always quieter than the text.

Data labels stay readable: a label inside a mark takes the text color that contrasts with that mark's own color (core `textColorForFill`), so a label on a muted bar contrasts with the muted fill, as one on an accent bar does with the accent. Labels outside marks keep the chart text color. The legend shows each series in the color its marks have: accent for a highlighted series, muted otherwise. (A multi-series chart that highlights only categories mutes every series alike, so its legend keys look the same; name the series too when the legend matters.)

**Validation.** A name that matches no data column (`series`) or no row label (`categories`) is a `chart-highlight-unknown-name` **error**, found by `resolveChartData` like `chart-mapping-unknown-column`. A series name that is a column but not plotted as a series (the category or X column, or a column `mapping.series` leaves out) is a `chart-highlight-adapted` warning and highlights nothing. A part the chart type cannot highlight is dropped with a `chart-option-adapted` diagnostic (option `highlight.series` or `highlight.categories`). `highlight` must name at least one series or category, and each list has no duplicates.

### What each chart type highlights

`chartOptionSupport(target).highlight` returns `{ series, categories }`; the validator, the preview, the exporter and the editor all follow it.

| Type (catalog ids) | Series | Categories | What is drawn |
| --- | --- | --- | --- |
| clustered column, bar | yes | yes | the series' columns or bars; a category's column or bar in every series |
| stacked and 100% stacked column, bar | yes | yes | the same, per segment |
| line, stacked line, with markers | yes | yes | a series' line and markers; a category highlight draws a marker on each series at that category (on a line without markers, only there) |
| area, stacked area, 100% stacked area | yes | no | the series' area |
| scatter | yes | no | the series' markers (a scatter point label is not a category) |
| radar, with markers, filled | yes | no | the series' line (or fill) and markers |
| pie, doughnut | no | yes | the slice of each named category (a pie plots one series, so a series name is meaningless) |
| histogram, pareto, waterfall, funnel, treemap, box and whisker, world, combo | no | no | not supported: dropped with `chart-option-adapted` |

The Office 2016 (chartex) constructs are left out on purpose. Their marks take their colors from the construct's chart style, and a per-point color (`cx:dataPt`) would need native verification this change does not have; the waterfall also already colors its marks by increase, decrease and total. They draw and export as before.

## Series colors

Series colors follow the deck's color scheme by default: the same chart takes the colors of whichever scheme the deck uses (`design.colorScheme`, the theme's scheme, a catalog record, a built-in such as `vibes`, or an inline scheme with slot overrides). To set the color of one series, slice or category, list colors in [`chart.colors`](#setting-colors-chartcolors); a position it does not list keeps the deck palette.

Core's `chartSeriesPalette(colorScheme)` (on `@openpresentation/opf/composition`) returns the twelve colors the preview, the PPTX export and the `chart-color-only` accessibility rule all use, in this order:

| Series | Color |
| --- | --- |
| 1 to 6 | `accent1` to `accent6` of the resolved color scheme (a slot the scheme leaves out takes the engine default scheme's slot) |
| 7 to 12 | the same six accents mixed 40% toward white, in the same order (series 7 is a tint of `accent1`) |

Series `i` takes color `i`; a pie, doughnut, treemap or funnel colors category `i` with color `i`. A chart with more than twelve series repeats the list (and `chart-color-only` says so). The `primary`, `secondary` and `accent` role overrides do not reorder the list: series 1 to 3 are always `accent1` to `accent3`, the slots the PPTX export writes as theme colors.

Both engines then pass the list through `chartPaletteForFill(backdrop, palette, { legible: chartSchemeSeries(chart.colors, colorScheme), soften: true })`, which keeps every series at 3:1 contrast against the backdrop the chart stands on (the card, or the slide background; LH-105: no chart has a panel) and apart from its neighbors, so on a dark panel the colors are lightened, never merged. On a dark panel every series that comes from the scheme (not from an authored `colors` entry) reaches 4.5:1, and series 2 keeps a lightness step of at least 20 (CIE L*) from series 1, so the first two series never read as one blue (LH-55). The palette is read in tiers of six (series 1 to 6, then 7 to 12): a color is kept apart from the colors of its own and earlier tiers only, so the tints never pull the six accents towards each other. Plan a chart's series order for the scheme: put the series that carries the message first (accent1 is the deck's primary), and keep a chart to six series or fewer so no tint is needed. The `highlight` colors above are separate: they come from the primary and the panel, not from this list.

A host that validates with its own palette passes `ValidateOptions.chartPalette`; without it the rule judges each slide's own scheme.

### Setting colors: `chart.colors`

`colors` lists colors by position and replaces the palette color of that position; the rest of the palette is unchanged.

```json
{
  "chart": {
    "type": "column",
    "data": { "columns": ["Quarter", "Revenue", "Costs"], "rows": [["Q1", 12, 8], ["Q2", 18, 11]] },
    "colors": ["accent3", "#7B241C"]
  }
}
```

- **Position.** Entry `i` is the color of series `i` (the `i`-th plotted value column), of slice or category `i` on a pie, doughnut, treemap or funnel chart, and of the `i`-th color a histogram, pareto, waterfall or box-and-whisker chart draws with (the first color for its bars, the second for its line or negative bars, the third for a waterfall total). Up to 24 entries; positions past the last entry keep the deck palette.
- **Values.** Any `ColorRef`: a hex color, a color-scheme slot or role (`accent3`, `secondary`), or a `var:<id>` color variable. A scheme name follows the deck if its scheme changes and is written to PowerPoint as a theme color; a hex color stays as written. Alpha is dropped. An entry that cannot be resolved is ignored (the palette color of its position is used) and `opf/chart-colors-adjusted` says so.
- **Contrast.** Colors still pass through `chartPaletteForFill`: one with under 3:1 contrast against the backdrop is drawn lighter or darker, and series are kept apart. `opf/chart-colors-adjusted` warns when that happens to an authored color, and `opf/chart-color-only` judges the authored colors for color-blind and greyscale collisions.
- **Highlight wins.** With `chart.highlight`, highlighted marks take the primary color and every other mark the muted neutral, whatever `colors` says.
- **Engines.** Core resolves the list with `chartSeriesPalette(colorScheme, chart.colors, { roles, variables })` (and `resolveChartColors` for the entries alone); the preview and the PPTX export pass the result to `chartPaletteForFill` as before.

## Value axis

A column, bar, line or area chart (standard, stacked and 100% stacked) has one value axis, and composition computes it: `composeSlide` puts `{ min, max, majorUnit }` on the composed chart item as `chart.valueAxis`. The preview draws that axis and the PPTX export writes it as `c:min`, `c:max` and `c:majorUnit`, so PowerPoint and Keynote show the same gridlines as the preview instead of choosing their own major unit. A 100% stacked chart's axis is a fraction (`max: 1` is 100%) and carries `percent: true`. Combo, scatter, radar, pie and the Office 2016 constructs have no computed axis (`chart` is absent); each engine keeps drawing them as before.

**Sibling charts (LH-33, LH-93).** Column, bar, line and area charts on one slide that run the same way, are both 100% stacked or both not, and plot one unit (the same first-series number format, or the same series names when unformatted) share one value axis (`shareSiblingChartAxes`). Column, line and area charts of such a set also share one plot height, so equal values stand equally tall: core lays each member's plot out as the preview does (`chartPlotInset`: under the header row or a top legend, above a bottom legend, the category axis title and the category labels, beside the value axis title, the tick labels and a side legend), and `shareSiblingPlots` gives the set the shortest plot's height. Charts side by side (boxes that overlap by half the shorter one's height) share one plot top and baseline; a chart in another row keeps its own baseline. The plot is stored as an inset from the chart box, `chart.layer.plot` (`{ left, top, right, bottom }`, slide pixels); the preview draws its plot there and the PPTX export writes it as the plot area's manual layout (`c:plotArea` `c:manualLayout`, `layoutTarget inner`), so PowerPoint draws the same plot. Horizontal bar charts share the axis but keep their own plot.

The scale is core's `niceScale(dataMin, dataMax, maxIntervals, { percent })`: zero is on the axis (always for bars and areas; for a line only when the data does not sit in the top sixth of its range), the data gets 5% headroom, and the major unit is the smallest 1, 2 or 5 times a power of ten that fits `maxIntervals` intervals. `maxIntervals` is `maxIntervalsFor(length, labelExtent)`, at most `CHART_MAX_INTERVALS` (6, LH-105), where `length` is the plot's extent along the value axis estimated from the chart box (without measuring text) and `labelExtent` is the space one tick label needs: a column, line or area chart has `box height - 2 x pad - 1.5 x line height` (less a line for a category axis title, and a line plus a pad for a top or bottom legend) over 1.2 line heights, a bar chart `70% of the box width - 2 x pad - text size` over 4 text sizes. Here pad is `10 x scale`, text size is `chartTextSize(...) x scale` px and line height is 1.5 text sizes. `chartTextSize({ width, height, scale, minFontSize })` is the chart text size the preview draws: `CHART_TEXT_PX` (20 px at the 1280 x 720 reference, 15 pt), shrunk only when the box is small (at most 1/18 of the box height and 1/30 of its width, whole pixels) and never below `minFontSize` (default 16), with `scale = min(slide width, slide height) / 720`. A chart in a short box therefore has fewer, larger intervals (0 to 800 in steps of 100 in a tall box, steps of 200 in a short one); a tall box always gets six at most (0 to 800 in steps of 200). An axis with room for three intervals or more is never tightened to one (LH-105): when no equal division of the tightened end fits, a finer end is tried (data peaking at 116: 0 to 125 with ticks every 50, not 0 and 140).

The axis maximum stays near the data (LH-59): it is at most `CHART_AXIS_MAX_OVERSHOOT` (a quarter) of the plotted range above the data maximum, 1.25 x the maximum on a zero-based axis. When the first major tick above the headroom lies further out (a short axis of one or two intervals: data peaking at 124 on an axis of 0 to 200), the axis ends at the first multiple of the largest finer 1, 2 or 5 unit within that bound (150). The ticks keep the major unit when the last one is at most half a unit below that end (0 to 40 in tens, ending at 45; the end is then not a labeled tick, as PowerPoint draws a `c:max` off the major unit); otherwise the end is divided into as many equal intervals as fit, each a multiple of that unit (0, 400, 800 for data peaking at 760; 0 and 150 in one interval), with zero kept on a tick. Every chart the preview scales this way follows the rule: the column, bar, line and area axis core composes (and the PPTX export writes), the histogram, pareto, waterfall and box-and-whisker constructs and the scatter axes. The radar and the combo chart keep the end on a tick (`niceScale(..., { endOnTick: true })`): the radar's outer ring and the combo chart's shared gridlines are the axis end. Only the maximum is tightened; a negative minimum keeps its major-unit tick, so zero stays on a gridline in PowerPoint too.

## Category order and waterfall totals

A bar chart (`bar`, `stacked-bar`, `100pct-stacked-bar`) lists its categories top to bottom in data order, the first series at the top of each cluster. The PPTX export writes PowerPoint's reversed category axis (`c:catAx` `c:orientation val="maxMin"`) with the value axis crossing at the last category (`c:valAx` `c:crosses val="max"`), so the value labels stay at the bottom and PowerPoint draws what the preview draws. Column, line and area charts keep their order (reversed only for right-to-left slides).

A waterfall's bars float from the running total. OPF has no total marker, so core's `waterfallSteps(values)` infers one: the **last** value is a total when at least two values precede it and it equals their sum (to twelve significant digits), as in Start 100, +24, -8, End 116. A total bar stands on zero, takes the third palette color (increases take the first, decreases the second) and does not add to the running total; the native PPTX waterfall (`chartex: 'native'`) writes it as `cx:subtotals`, which PowerPoint draws the same way. Any other last value is one more step; intermediate subtotals are not inferred.

## Chart layer: small charts and the header row

Status: LH-03 and LH-81 (layout harvest). Two defaults make a plain chart read like a designed one. Composition decides them once per chart item, from the chart, its resolved data and its box, and puts them on the composed item as `chart.layer` (core `chartLayer`, on `@openpresentation/opf/composition`); the preview and the PPTX export both draw that decision.

**Small charts (LH-03).** A clustered column, bar or line chart (`column`, `bar`, `line`, `line-with-markers`) of one or two series, each of at most sixteen points (`SMALL_CHART_MAX_SERIES`, `SMALL_CHART_MAX_POINTS`), whose value labels fit beside each other at the chart text size (a column or line label no wider than the room between neighboring marks, a bar label no taller than its bar's slot). The fit decides, not a count (LH-111; the limit was eight points): twelve monthly columns are labeled when their labels fit, and a focus's context marks then take the light labeled gray (below). Such a chart:

- labels every mark with its value, at the type's default position (outside the end of a column or bar, above a line point), in the column's number format;
- draws no value axis: no tick labels, no gridlines and no value axis line (the category axis line stays at zero). The PPTX value axis is deleted (`c:delete val="1"`) and has no `c:majorGridlines`; the composed axis still sets the scale. Nothing reads a length from zero, so a line's scale drops zero once its minimum is at least 0.75 of its maximum (LH-119, `CHART_LABELED_ZERO_SHARE`; every other chart keeps PowerPoint's rule, zero dropped only when every value is in the top sixth of the range);
- draws no chart panel: the chart stands on the card or the slide background, and its colors and labels are judged against that backdrop (LH-105 made this every chart's default);
- on a one-series column or bar chart whose categories run in time (LH-105, see [Defaults follow Few](#defaults-follow-few)) and whose slide title names none of them, draws the last point that has a value in a stronger shade of the series color and every other point in the series color (LH-95, core `chartEmphasisColors`). The shade is the series color mixed away from the backdrop, towards black on a light backdrop and towards white on a dark one, just far enough to stand 15 L* (CIE) from it (`CHART_EMPHASIS_MIN_LIGHTNESS_STEP`), so the emphasis shows; moving away from the backdrop only raises the contrast, so every bar keeps 3:1 against the backdrop (`CHART_EMPHASIS_MIN_CONTRAST`; a bar is a graphical object under WCAG 1.4.11). A series color too close to black or white for that step is shaded the other way, still at 3:1. This emphasizes the last bar in all 84 gallery theme x color scheme x light and dark combinations (a faded tint of the other bars, LH-03's first rule, found room in 36). The PPTX export writes the series in its color and the emphasized point as one `c:dPt`.

**Header row (LH-81).** A column, bar, line, area or combo chart of any grouping draws a row above the plot. Its caption, bold at the chart text size in the text color, sits at the start of the row (the right edge right to left). A caption is generated only when it adds to the legend: one series gives `<series> by <category>` ("Count by stage"), the series part being the value axis title or the series name; two or more series give a caption only from a value axis title ("Revenue ($M) by quarter"), since the legend already names them. The category part is the category axis title or the category column's name in sentence case: a plain capitalised word is lower-cased, and an acronym or proper-looking token (all capitals, an internal capital or a digit: "Q1", "ARR", "FY27") stays as written. Outside English decks the caption is the series part alone. Two to four series show their legend in the same row (at its end) or, when caption and legend do not fit together, at the start of a second row; a legend wider than the chart stays at the side. The plot then takes the chart's whole width. In PowerPoint the caption is the chart title, and title, legend (`legendPos t`) and plot area (`layoutTarget outer`) carry the positions core computed as `c:manualLayout`.

**Ring names (LH-92).** A doughnut of two or more rings (LH-60's nested rings: a pie or doughnut of several series) colors its slices by category, and its legend names the categories, so each ring names its series inside the ring, on its largest slice (`chart.layer.rings`, core `chartRingLabels`). The name is that slice's label: alone, or before the slice's own label with the labels' separator ("FY24, 40%"), in the color that contrasts with the slice. The PPTX export writes it as the slice's `c:dLbl` with `c:showSerName val="1"`, which PowerPoint draws in the ring, first among the label's parts; import reads the other slices for the chart's own labels. A pie drawn as rings labels inside its rings as a doughnut does (no `c:dLblPos`).

**An explicit option wins.** `dataLabels: false` keeps a small chart's value axis and draws no labels; an explicit `dataLabels` is drawn as written (a label without the value, or a value axis title, keeps the value axis); `highlight` and `colors` keep their colors (no emphasis); a `legend` option keeps that legend and draws no header row; a payload `caption` replaces the header caption (the legend still moves into the header).

**Import.** `fromPptx` does not write these defaults back: value labels on a chart the small-chart rule covers (by type and counts) and a header legend (`legendPos t` with a manual layout) import as no option, so an exported deck imports with the options it was authored with. LH-105: every chart area is unfilled now, so a small chart is recognized by its deleted value axis; a small chart whose value axis has a title (its axis is kept) imports its default labels as `dataLabels: true`, which draws the same chart.

## Defaults follow Few

Status: LH-105 (layout harvest). The defaults follow Stephen Few (*Show Me the Numbers*; *Information Dashboard Design*): every pixel of ink shows data, color is for what matters, labels sit at the data. Composition decides them with the rest of the [chart layer](#chart-layer-small-charts-and-the-header-row) (`chart.layer`), and the preview and the PPTX export draw the same. Every explicit option still wins, and `fromPptx` does not write a default back as an option.

| Default | Rule | Why (Few) |
| --- | --- | --- |
| No panel | No chart draws a panel (the gray card surface it had): it stands on its card or the slide background, and its series, labels and text are judged against that backdrop (`chartPaletteForFill`, `textColorForFill`). The PPTX chart and plot areas are `a:noFill`, and so is a chartex chart area. | Non-data ink: a panel frames nothing the reader needs. |
| Soft series colors | A series from the scheme takes its accent softened: core `softenChartPalette` (on `chartPaletteForFill(..., { soften: true })`) moves its HSL lightness `CHART_SERIES_SOFT_MIX` (25%) of the way towards the backdrop's and lowers its saturation by the same share (`satMod` 75%, `lumMod` 75%, `lumOff` 25% on white), or by less, in 1% steps, where the full move would take it under 3:1 against the backdrop (4.5:1 for a scheme series on a dark backdrop, LH-55) or closer to a neighboring series than the palette had them, capped at 11 L* (20 between series 1 and 2 on a dark backdrop). An authored `colors` entry is drawn as written. The PPTX export writes a softened accent as the theme color with those transforms (`<a:schemeClr val="accent1"><a:satMod/><a:lumMod/><a:lumOff/></a:schemeClr>`, `chartSoftColors`), so re-theming in PowerPoint keeps it soft. | Soft colors for ordinary data; strong color is kept for emphasis. |
| Emphasis from the title | The slide title and subtitle are matched against the chart's series names, category names and (one series) values (core `chartTitleFocus`, `chart.layer.focus`): words of any script compared with `Intl.Collator` at base sensitivity in the deck language, a possessive dropped and a plural matching its singular; a name of several words also matches by the words it does not share with every other name ("Enterprise NPS" beside "Mid-market NPS" by "Enterprise"); a unit in parentheses is not part of a name; a month name matches the category of that month (November and Nov, in English and the deck language); a number in the title matches the categories with that value at the precision written (1,790; 31; 20% for a percent column). The focus is a proper subset: on a chart of several series the series named, else the categories named, else (every series named) the one named first; on one series or a pie, the categories named or whose values are printed. The focused marks keep their full-strength color and the other marks take the context neutrals (core `chartContextColors`): grays in the backdrop's hue, the backdrop mixed towards the text color, one per context series (or slice, or stacked segment) in the order they come, the first the strongest and each next one 11 L* lighter, so neighboring context series stay apart; each keeps a color difference of 20 (CIE76) from the focused colors, which a gray beside a colored focus has by its chroma. The context reaches 3:1 against the backdrop where it is read against an axis, and only 1.6:1 (`CHART_CONTEXT_LABELED_MIN_CONTRAST`, a light gray) where every context mark carries its text: a small chart's value labels, the names at the line ends, the names on the slices (WCAG 1.4.11 does not ask 3:1 of a graphic whose information the text gives; `chart.layer.focus.labeled`). The PPTX export writes a gray that equals a neutral as that scheme color (`tx1` with `lumMod`/`lumOff`). Column, bar, line, area, pie and one-series doughnut charts; not combo charts or the chartex constructs. | Color only for what the message is about; the rest is context, light where it is labeled. |
| Emphasis from the slide (LH-113) | When the title names nothing, the focus comes from the slide's other texts: every text block, list entry, quote and chart `alt` (core `slideFocusSources`, `chartSlideFocus`). Each is matched as the title is, with conservative rules: stop words never name a key; a proper name of several capitalized words matches by its first word ("Corvid" for "Corvid Plastics"); a printed quantity (3.1%, $71M) is a value, not a name; a range ("from March to August", "range from 71 in APAC to 78 in the Americas") names nothing; coordinated keys ("Engineering and support") are named together, and otherwise the key a sentence names first is its subject; a paragraph over 140 characters that names more than one key and a list that names keys in two or more entries name nothing; and the focus is what every naming source agrees on. The same focus highlights a table's rows (`table.highlight`, [content payloads](content-payloads.md#highlighted-rows)) on the same slide. | The message is often in the sentence beside the chart, or in the chart's own alt, not the title. |
| Emphasis only over time | Without a title focus, a small one-series column or bar chart emphasizes its last point (LH-03, LH-95) only when its categories run forward in time (core `chartCategoriesInTime`, below). Its emphasized point takes the series color at full strength (or a stronger shade of it, 15 L* from the soft color); the others keep the soft color. | The last point is the latest one only in time; on nominal categories it is just the last one written. |
| Line ends instead of a legend | A line chart (`line`, `line-with-markers`, stacked lines) of two to four series without `legend` or `dataLabels`, every series having a value in the last row, names each series at its last point: its last value as its data labels print it, then its name ("61 Enterprise NPS"), in the series color made legible as text (`chartSeriesLabelColor`, 4.5:1), bold for a series the title names (`chart.layer.endLabels`). The plot leaves a gutter for the names at its end (`chart.layer.plot`; the left right to left). Names closer than a text line move apart, never more than a line from their point; when they cannot (or when the gutter would turn the category labels the legend layout keeps level), the chart keeps its header legend. A small two-series line chart gives its value labels and hidden value axis up for the end labels. The header row keeps only its caption. PPTX: the last point's `c:dLbl` with the text as written (`c:tx c:rich`, value first, which PowerPoint's own field order would reverse), `c:showSerName`, `c:dLblPos r` (`l` right to left) and a manual layout offset where the name moved; no `c:legend`; the plot area's inner manual layout. Area charts keep their legend: PowerPoint has no label position for an area point. | Direct labels: the eye does not travel between a key and the data. |
| Names on the slices | A pie or one-series doughnut without `legend` or `dataLabels` names each slice with a value (`chart.layer.slices`): inside the slice when the name's text fits there at the slice's inside end (a doughnut: in its ring), in the color that contrasts with the slice; else, on a pie, outside its end. The outside names shrink the pie as outside labels do. A doughnut name that does not fit its ring, outside names that would touch each other or leave the chart box, or a pie shrunk under 30% of its room (`CHART_SLICE_LABEL_MIN_RADIUS`) keep the side legend. PPTX: one `c:dLbl` per slice with `c:showCatName`, `c:dLblPos inEnd` or `outEnd` (none on a doughnut), `c:showLeaderLines`; no `c:legend`. A doughnut of several series (nested rings) keeps its legend. | Labels at the data, not in a key. |
| Fewer intervals | The value axis has at most `CHART_MAX_INTERVALS` (6) intervals of 1, 2 or 5 times a power of ten (it was 8, and `maxIntervalsFor` capped at 10); an axis with room for three intervals is not tightened to one. Gridlines stay light (`gridline`, tx1 at 15%), horizontal on column, line and area charts and vertical on bar charts; no tick marks on either axis (`c:majorTickMark none`). | A few well-rounded ticks; gridlines only as faint as they must be. |

**Time order** (`chartCategoriesInTime(labels, { title, language })`). Categories run in time when every label is one family of time point running forward: years (2024, FY24, FY 2025, '24; a span FY24/25), periods (Q1 to Q4, H1 and H2, M1 to M12, and outside English T1 to T4 and S1 and S2, with an optional year: Q1 2024, 2024 Q1, Q1'24, FY24 Q3, 1Q24), weeks and steps (W12, Week 3, Day 4, Sprint 5, and the deck language's words for year, quarter, month, week and day from `Intl.DisplayNames`), months (January, Jan, Sept, with an optional year, in English and the deck language's `Intl.DateTimeFormat` names), dates (2024-03, 2024-03-15, 15.03.2024) and numbers (a strictly increasing sequence). Years and numbers must increase; months, periods and weeks without a year may wrap once (Nov, Dec, Jan); digits of any script count. A reversed run (2026, 2025, 2024) is not in time. Only when the labels are not one family, a category title (the category axis title, else the category column's name) that names a time field (Year, Quarter, Month, Week, Day, Date, Period, Time, Fiscal year, or the deck language's word) makes distinct labels time ordered. P1, P2 (priorities) and an English T1 (a tier) are not periods.

**Validator.** Two info findings (content) say where Few's advice is not followed; they never change the drawing: `opf/chart-dual-axis` for a combo chart with a `secondaryAxis` (two charts read more truly than one with two scales) and `opf/chart-pie-many-slices` for a pie or doughnut of more than five categories (compare them with bars). See [validate.md](validate.md).

**Not in this change.** Bars are not sorted by value (the author's order is kept), chart types are not changed, and rotated category labels keep LH-93's rule. A waterfall in strong, accent and gray with signed labels, a value list beside a pie, and values inside stacked segments with names beside the last column are not done.

## What each chart type supports (axis titles, legend, data labels)

`chartOptionSupport(target)` in `@openpresentation/opf/composition` returns this table; the validator, the preview, the exporter and the importer all follow it. An option a type cannot show is **adapted** (dropped, or reset to the default) and reported as a `chart-option-adapted` diagnostic by the validator (a warning), the renderer and the exporter (`onDiagnostic`). It is never silently lost and never fails the render.

| Type (catalog ids) | Axis titles | Legend | Data label content | Data label positions (default) |
| --- | --- | --- | --- | --- |
| clustered column, bar (`column`, `bar`) | category, value | yes | category, value | center, inside-end, inside-base, outside-end (outside-end) |
| stacked and 100% stacked column, bar | category, value | yes | category, value | center, inside-end, inside-base (center) |
| line, stacked line, with markers | category, value | yes | category, value | above, below, left, right, center (above) |
| area, stacked area, 100% stacked area | category, value | yes | category, value | none: the label sits in the area at each category |
| scatter | category (X), value (Y) | yes | category (X value), value (Y) | above, below, left, right, center (above) |
| pie | none | yes | category, value, percent | center, inside-end, outside-end (outside-end) |
| doughnut | none | yes | category, value, percent | none: labels sit in the ring |
| radar, with markers, filled | none | yes | category, value | none |
| histogram, pareto | category, value | none | category, value | center, inside-end, inside-base, outside-end (outside-end) |
| waterfall | category, value | none | category, value | center, inside-end, inside-base, outside-end (outside-end) |
| funnel | category | none | category, value | none (center) |
| treemap | none | none | category, value | none (center) |
| box and whisker | category, value | yes | none | none |
| combo (`combo`) | category, value, secondary | yes | category, value | columns: center, inside-end, inside-base, outside-end (outside-end); lines: above, below, left, right, center (above) |
| world (region map) | none | none | none | none |

A chart type outside the catalog is never adapted.

## Combo charts

Status: FA-15 (format audit). A `combo` chart draws clustered columns and line series in one plot, for an amount beside a rate such as revenue and margin %:

```json
{
  "chart": {
    "type": "combo",
    "data": {
      "columns": ["Quarter", { "name": "Revenue", "format": "$#,##0.0" }, { "name": "Margin", "format": "0%" }],
      "rows": [["Q1", 12.4, 0.31], ["Q2", 18.1, 0.34], ["Q3", 21.7, 0.29], ["Q4", 26.3, 0.37]]
    },
    "line": ["Margin"],
    "secondaryAxis": ["Margin"],
    "axisTitles": { "category": "Quarter", "value": "Revenue ($M)", "secondary": "Margin" }
  }
}
```

| Field | Values | Absent means |
| --- | --- | --- |
| `line` | plotted series names, at least one | the last plotted series is the line |
| `secondaryAxis` | line series names | every series uses the primary (left) value axis |
| `axisTitles.secondary` | string | no secondary axis title |

- **The plan.** Every plotted series (the `mapping.series` or the positional rule) is drawn as clustered columns, except the ones `line` names, which are lines with markers. At least one series stays columns, so a `line` that names every series draws the first as columns. A one-series combo chart is drawn as columns. Core's `resolveChartData` returns the plan as `combo` (`{ role: "bar" | "line", axis: "primary" | "secondary" }` per series) and orders the series columns first, then the primary-axis lines, then the secondary-axis lines, so the preview, the PPTX series order and the legend agree.
- **The secondary axis.** `secondaryAxis` puts line series on a value axis at the right (at the left right to left). It has its own automatic scale and its tick labels use the number format of its first series' column (`DataColumn.format`, for example `0%`); the primary axis uses the first column series' format. Gridlines follow the primary axis. `axisTitles.secondary` titles it, rotated like the primary value title.
- **Labels.** One `dataLabels` applies to both parts: column labels sit outside the end and line labels above the points by default; `center` applies to both; a position only one part takes (`inside-end`, `inside-base`, `outside-end` for columns; `above`, `below`, `left`, `right` for lines) applies to that part and the other keeps its default, with a `chart-option-adapted` note. `resolveChartOptions` returns the column position as `dataLabels.position` and the line position as `dataLabels.linePosition`.
- **Legend.** As for other multi-series charts (right by default, or `legend`); a column series has a square key and a line series a line with a marker.
- **Validation.** A `line` or `secondaryAxis` name that is not a column of the data is a `chart-mapping-unknown-column` error. A name that is not plotted, a `secondaryAxis` name that is not a line, a `line` that names every series and a one-series combo chart are `chart-mapping-adapted` warnings. `line`, `secondaryAxis` and `axisTitles.secondary` on any other chart type, and `axisTitles.secondary` on a combo chart without `secondaryAxis`, are `chart-option-adapted` warnings.
- **PPTX.** One `c:plotArea` holds a clustered column `c:barChart` (primary axes) and a `c:lineChart` with markers. Secondary-axis lines form a second `c:lineChart` on a second `c:valAx` (`axPos r`, `crosses max`) and a deleted second `c:catAx`; the embedded workbook holds every series. Import reads such a plot area (one clustered column group, one or two line groups) back as `combo` with `line` (when it is not the default), `secondaryAxis`, the secondary title and the label position.
- **Editor.** The chart type picker offers `combo` for data with two or more series, the chart options panel sets which series are lines and which lines use the secondary axis, and switching to another type removes the three fields.

## How the engines draw and write them

The preview (opf-render) and the PPTX export (opf-pptx) both read `resolveChartOptions(chart, chartOptionTarget(chart.type))`, so they agree on which options apply and with which content and position. The highlight adds `resolveChartOptions(...).highlight` (the names that survive the type's support table), `chartHighlightMarks(highlight, resolvedData)` (which series and which rows are named) and `chartHighlightColors` (the two colors).

- **Preview.** A legend, and the axis titles, are carved from the chart box before the plot is laid out: the legend at its edge, then the titles next to the axes. Only a chart that uses a field changes; a chart without them draws the same SVG as before. A vertical axis title is rotated 270 degrees, as PowerPoint draws it.
- **PPTX, classic charts** (column, bar, line, area, pie, doughnut, scatter, radar): `c:catAx/c:title` and `c:valAx/c:title` (rich text, `c:overlay val="0"`), `c:legend/c:legendPos` (`t`, `b`, `l`, `r`; no `c:legend` for `none`) and a `c:dLbls` per series with `c:dLblPos`, `c:showVal`, `c:showCatName`, `c:showPercent` and an explicit `c:separator`, number format `General` (RR-54: the series column format, as `toExcelNumberFormat` writes it, when its `DataColumn` has one; see [chart-table-data.md](chart-table-data.md)).
- **PPTX, chartex** (histogram, pareto, waterfall, funnel, treemap, box and whisker): `cx:axis/cx:title`, `cx:legend pos`, and `cx:dataLabels pos` with `cx:visibility` and `cx:separator`. The classic fallback chart that precedes every chartex part carries the same classic options.
- **Highlight (FA-14), preview.** A highlighted mark is filled with the accent color, every other mark with the muted color; series keep their order (the highlighted one is not moved on top), as PowerPoint draws them. A chart without a highlight never calls the highlight code.
- **Highlight (FA-14), PPTX.** Series colors go into `c:ser/c:spPr` (and `c:marker/c:spPr` on line, scatter and radar series); a per-point color is a `c:dPt` with `c:idx`: `c:dPt/c:spPr` on a column or bar, a circular `c:dPt/c:marker` on a line, the slice fill on a pie or doughnut. The accent is `a:schemeClr val="accent1"` when the deck theme holds the primary exactly (so re-theming in PowerPoint recolors it) and an `a:srgbClr` literal when the contrast adjustment moved it; the muted color is always an `a:srgbClr` literal, because a mix of two theme colors is not one scheme color with `lumMod`/`lumOff`. Data labels inside a mark are written per point where the mark colors differ. Chartex constructs are unchanged.
- **Import.** `fromPptx` reads the same parts back into `axisTitles`, `legend` and `dataLabels`. A legend equal to the default for that chart (right for multi-series, pie and doughnut; none otherwise) is not recorded, so decks that never set the field import unchanged. Anything the three fields cannot express (per-series label overrides, number formats, rich-text titles, manual layouts) is reported with a diagnostic and not invented. The highlight is not inferred from the colors (a native chart's fills do not say which names were highlighted, and a hand-colored chart must not turn into a highlight): in `full` provenance mode the exporter records the authored `highlight` in the chart's `OPF_DATA_V1` data record, and `fromPptx` restores it while the chart's cached data is unchanged. With `provenance: false` or `'references-only'`, or after the data was edited in PowerPoint (`chart-data-provenance-changed`), the chart imports without a highlight and keeps the colors it shows.

## Text alternative

`Chart.alt` (FA-09) is a string: what the chart shows, in a sentence or two (the point and the key numbers), not "a chart". Unlike the three options above it changes no geometry.

- **Preview.** The chart's SVG group carries `role="img"` and `aria-label`; the role makes the drawn marks inside presentational, so the label is the chart's one announcement. The text beside the chart stays reachable: the slide is a labeled group, not an image (see [Accessibility of the preview](content-payloads.md#accessibility-of-the-preview)).
- **PPTX.** The value is the chart frame's `p:nvGraphicFramePr/p:cNvPr/@descr`, the same attribute pictures use, on classic charts and on chartex (Office 2016) frames. `fromPptx` reads it back into `alt`.
- **Empty string.** `""` marks the chart decorative, like an empty `Asset.alt`: the preview writes no label and hides the group (`aria-hidden`), and the PPTX frame carries PowerPoint's own "Mark as decorative" marker (the `adec:decorative` extension of `p:cNvPr`), not `descr=""`, which PowerPoint writes for any shape without alt text. Import reads the marker back as `alt: ""`. A chart nearly always carries a message, so `opf/chart-text-alternative` reports it as info.
- **Validate.** `opf/chart-text-alternative` passes a chart with a non-blank `alt`. Without `alt` it still passes when text, a table or a subtitle sits beside the chart; otherwise it reports the chart and offers a quick fix that focuses the `alt` field. `opf/poor-alt-text` flags a bare "chart", a URL, a leading "chart of" and alt text over 250 characters.

## Defaults and geometry

A chart that sets none of the four fields draws its type's defaults, including the [chart layer](#chart-layer-small-charts-and-the-header-row) of column, bar, line, area and combo charts. A chart with options reserves space for its legend and titles, so its geometry differs from a chart without them. The implementations require coordinated Core, renderer, PPTX and editor versions; use the [compatibility matrix](compatibility-matrix.md).

## Not in this change

Per-series data label overrides (column number formats are RR-54, [chart-table-data.md](chart-table-data.md)), a rotated or rich-text axis title, a chart title, a legend that overlays the plot, manual plot-area layout, secondary axes outside combo charts, and trendlines. Charts from external spreadsheets stay descoped (the `ChartDataSource` form was removed from the schema).
