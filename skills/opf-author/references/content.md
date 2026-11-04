# Content shape guide

Consult the installed schema for optional fields and constraints. This guide selects the common forms; it is not a second schema.

| Intent | OPF shape |
| --- | --- |
| Plain text | `{"text":"A useful assertion"}` |
| Rich text | `{"text":[{"text":"Important","bold":true}," detail"]}` |
| Inline code | `{"text":["Run ",{"text":"pnpm install","code":true}]}` (the design's code font; Markdown `` `backticks` `` are the same thing) |
| Run in another language | `{"text":["The word ",{"text":"Zeitgeist","lang":"de"}]}` (BCP-47 tag; sets proofing and script fonts for that run) |
| List | `{"items":["First point","Second point"]}` (a `list` payload for entries that share a shape or may need a `description`) |
| Prose bullets | `{"bullets":["A talking point","Another one"]}` (a `text` payload for plain talking points that each stand alone; `bullets` entries have no `description`) |
| List with detail | `{"items":[{"text":"Faster onboarding","description":"First value in under a day."}]}` (`description` exists only on `items`; use `items` whenever any entry needs detail) |
| Numbered list | `{"items":["First step","Second step"],"numbering":"arabic"}` (also `roman-upper`, `roman-lower`, `alpha-upper`, `alpha-lower`; `{"style":"alpha-lower","start":3,"suffix":"paren"}`; an array is one entry per level; works on `bullets` too) |
| Image | `{"image":{"src":"asset:diagram","alt":"Description of the diagram"}}` |
| Video | `{"video":{"src":"asset:demo","title":"Demo"}}` |
| Table | `{"table":{"columns":["Quarter","Revenue"],"rows":[["Q1",12],["Q2",18]]}}`; an optional `alt` is a summary of what a large or dense table shows, read before its cells (`""` hides a purely decorative table) |
| Metric | `{"metric":{"value":98,"unit":"%","label":"Retention"}}`; `trend` (`up`, `down`, `flat`) draws an arrow, and `sentiment` (`positive`, `negative`, `neutral`) says whether the change is good news, so a falling churn is `"trend":"down","sentiment":"positive"` (absent: up green, down red, flat neutral) |
| Chart | `{"chart":{"type":"column","alt":"Revenue rose from $12M in Q1 to $18M in Q2.","data":{"columns":["Quarter","Revenue"],"rows":[["Q1",12],["Q2",18]]}}}` |
| Quote | `{"quote":{"text":"Quoted words","attribution":"Source speaker","source":"Source reference"}}`; a testimonial adds `"role":"VP Operations, Acme"` (title and organization, drawn on its own line under the attribution) and `"photo":{"src":"asset:speaker","alt":"Name"}` (a headshot; give it alt text): a wide quote draws it as a tall portrait beside the text, a narrow one as a circle beside the attribution; `"portrait":"side"` or `"avatar"` chooses |
| Code | `{"code":{"source":"const answer = 42;","language":"javascript"}}` |
| Code with emphasized lines | `{"code":{"source":"a\nb\nc\nd","language":"javascript","highlight":[2,[3,4]]}}` (1-based lines and inclusive ranges; the rest is dimmed) |
| Timeline | `{"timeline":[{"when":"Now","what":"Prototype"},{"when":"Next","what":"Review"}]}` |
| Timeline with progress | `{"timeline":[{"when":"Q1","what":"Discovery","status":"done"},{"when":"Q2","what":"Pilot","status":"current"},{"when":"Q3","what":"Rollout","status":"planned"}]}` |
| Diagram | `{"diagram":"flowchart LR
  A[Brief] --> B{Approved?}
  B -->|yes| C[Build]
  B -->|no| A"}` (Mermaid source; the object form `{"source":"...","alt":"..."}` adds a text alternative) |
| Nested group | `{"composition":{"mode":"column"},"blocks":[{"text":"One"},{"text":"Two"}]}` |

## Diagrams

A `diagram` is Mermaid source (version 12.1 syntax) that the engines parse, lay out with the deck's measured fonts and draw in the deck's colors. Pick the payload by what the content is: a `chart` for numbers on axes, a `timeline` for dated or ordered events (with `status`), a `diagram` for structure and flow. A string is shorthand for `{"source": ...}`; the object form takes `alt` (and `syntax`, which is `mermaid`, the only value). The first line of the source names the family: `flowchart`, `sequenceDiagram`, `classDiagram`, `stateDiagram-v2`, `erDiagram`, `gantt`, `pie`, `quadrantChart`, `mindmap`, `timeline`, `journey`, `xychart`, `sankey`, `gitGraph`, `C4Context`, `block`, `architecture-beta`, `kanban`, `packet`, `radar-beta`, `treemap`, `venn-beta`, `ishikawa`, `requirementDiagram` and the other built-in families; ZenUML is not supported.

```json
{"title": "A rejected brief returns to its author",
 "diagram": {"source": "flowchart LR
  A[Brief] --> B{Approved?}
  B -->|yes| C[Build]
  B -->|no| A", "alt": "A brief goes to review; approved work is built, rejected work returns to the brief."},
 "caption": "Figure 1. The review loop"}
```

- Write `alt` for every diagram: what it shows, not that it is a diagram. Without one, engines derive a text from the diagram type and its labels. A `caption` works as on an image or chart.
- The deck decides colors and fonts: node fills are tints of the slide variant's first accent, data series (pie, xychart, timeline sections, mindmap branches) use the chart series palette, and text keeps 4.5:1, on light and dark slides alike. Do not write Mermaid themes or `themeVariables`; they are ignored. Leave out `style`, `classDef` and C4 `UpdateElementStyle` colors too: the engine applies and keeps them, so those shapes no longer follow the deck's colors or variant. The repository's `docs/diagrams.md` is the full guide.
- Size follows the block: the diagram is drawn at the largest label size that fits (up to 32 reference pixels) and never below the readability floor. When it does not fit, it is drawn smaller and the slide gets a `text-overflow` finding with advice. Give a big diagram a slide or region of its own, turn `flowchart LR` into `TB` (or the reverse), cut nodes into two diagrams, or shorten labels. Do not shrink it by lowering `minFontSize`.
- A source that cannot be parsed reports a located finding (`The diagram cannot be drawn (line 2, column 9): ...`) and draws a "Diagram unavailable" placeholder: fix the source at that line and column. The limits are 20,000 characters of source and 500 edges.
- In Markdown a diagram is a fenced block with the info word `mermaid`, and its `alt` follows the word: ```` ```mermaid alt="What it shows" ````.
- PPTX export writes the diagram as a native SVG picture with a PNG fallback (crisp, `alt` as its description, recolorable as a picture); the nodes are not editable PowerPoint shapes. Say so if the user needs to edit the diagram in PowerPoint: they edit the OPF source and export again.

Timeline `status` is progress only: `done` (filled marker), `current` ("we are here": ringed marker, bold label) and `planned` (hollow marker, muted text). Mark at most one event `current`, and write risk or blockers in the event text, not in a status. [A complete roadmap](../assets/roadmap-status.opf.json) shows all three.

These numeric examples are illustrative; replace them only with supported data. `chart.type` is an engine vocabulary: use one of the supported chart types (`CHART_TYPES`); the schema rejects any other. A richer chart record does not guarantee the current renderer implements every visual detail. A chart takes optional `axisTitles` (`{"category":"Quarter","value":"Revenue ($M)"}`), `legend` (`none`, `top`, `bottom`, `left`, `right`) `dataLabels` (`true`, or `{"content":["value"],"position":"outside-end"}`) and `highlight` (`{"series":["Revenue"],"categories":["Q3"]}`: name the series or category that carries the message by its data column name or row label, and the engines draw those marks in the deck's primary color and mute the rest from the theme, with no color field; a mark is highlighted when its series or its category is named; a name the data does not have is an error); omit them to keep the engine defaults. Those defaults already design the chart (LH-03, LH-81): a column, bar, line, area or combo chart draws its legend (two to four series) in a row above the plot, with a caption when it adds to the legend (one series, "Revenue by quarter", or a value axis title); a clustered column, bar or line chart of one or two series with eight or fewer points labels its values, drops the value axis, gridlines and gray panel, and with one column or bar series draws its last point in a stronger shade of the series color and the rest in the series color; sibling charts of one unit share one value axis and one plot height, and a pie or doughnut of several series draws nested rings, each named on its largest slice. So do not add `dataLabels`, a `legend` or a heading that repeats the caption for such a chart; name the column and series well instead, set `dataLabels: false` to keep the value axis, or give the block a `caption` to replace the header caption. The defaults also follow Stephen Few (LH-105, `docs/chart-options.md#defaults-follow-few`): no chart has a gray panel; ordinary series take the scheme accents softened toward the background; a line chart of two to four series names each series at its line end with its last value ("61 Enterprise NPS") instead of a legend (a small line chart gives up its value labels for them); a pie or one-series doughnut names its slices instead of a side legend; the value axis has at most six intervals. LH-107 to LH-110 (`docs/chart-options.md#chart-marks-waterfall-roles-value-lists-stacked-labels-reference-marks`): a waterfall draws its totals (the last value when it is the sum before it, and the first bar) in the strong color, gains in the accent and losses in gray, each bar with its signed value and no value axis; a pie or one-series doughnut of up to eight categories in a wide box lists its categories and values beside it; a stacked column or area chart prints the values that fit inside their segments and names its series beside the last column; a title that compares with a number the data does not hold ("stayed above 92%") draws a dashed reference line, and one that names a period of a line chart over time ("overtook on-premises in 2023") shades that period. Write the slide title as the chart's message and name the series, category or value it is about ("North America still leads", "Support tickets peaked in November", "Only 31 of 186 deals close"): the engines draw what the title names in full color and the rest in grays (one per context series, light when the marks are labeled); without such a match a small one-series column or bar chart over time (quarters, months, years) emphasizes its last point, and one over nominal categories (stages, regions) emphasizes nothing. `highlight` and `colors` override this. Avoid a combo `secondaryAxis` (two charts read more truly than one with two scales, `opf/chart-dual-axis`) and pies of more than five slices (`opf/chart-pie-many-slices`: use bars). Series colors follow the deck's color scheme in order (`accent1` first, the series that carries the message; keep a chart to six series so no tint is needed); `colors` (`["accent3","#7B241C"]`, a ColorRef list by position: series 1, 2, ..., or slice/category 1, 2, ... on a pie) overrides the first positions, and `highlight` wins over it. A column, bar, line or area chart gets a computed value axis (`min`, `max`, `majorUnit` in steps of 1, 2 or 5 times a power of ten) that the preview and the PPTX share, and chart text is 20 px (15 pt), so do not size chart text or tick marks yourself. See `docs/chart-options.md` for what each chart type supports (an option a type cannot show is dropped with a `chart-option-adapted` diagnostic). For an amount beside a rate (revenue and margin %) use `"type":"combo"`: every series is drawn as clustered columns except those in `"line":["Margin"]` (default: the last series), and `"secondaryAxis":["Margin"]` plots those lines on a right-hand value axis labeled in that column's format (`{"name":"Margin","format":"0%"}`), titled with `axisTitles.secondary`.

Chart values are numbers. A string counts only in strict decimal syntax (`"12"`, `"-3.5"`, `"1e6"`); `"12%"`, `"$5"`, `"(5)"` and `"1,234"` are gaps and a `chart-value-not-numeric` warning. Put units, currency and percent in a column format instead: a chart, dataset or table column may be `{"name":"Revenue","format":"$#,##0.0"}` (the `NumberVariable.format` syntax: `#,##0`, `0.0%`, `#,##0 units`; a `%` multiplies by 100, so store 0.31 for 31%), and a styled table cell takes its own `format`. Data used by several charts or tables goes once in the top-level `datasets` map (`{"revenue":{"columns":[...],"rows":[...],"source":{"src":"./revenue.csv"}}}`) and is referenced with `"chart":{"type":"line","data":{"dataset":"revenue","fields":["Quarter","Revenue"]}}` or `"table":{"dataset":"revenue"}`; an unreferenced dataset is the warning `opf/unused-dataset`. `chart.mapping` (`{"category":"Quarter","x":"Spend","series":["Revenue","Costs"]}`) picks columns by name; omit it for the positional rule (first column the category, every other column a series; scatter takes the second as X). Record where inline data came from with `data.source` (`{"src","sheet","range","retrieved"}`), which engines never read. `"data":{"src":...}` (a data source by file or asset) is not part of the format and is a schema error: import the data inline or into a dataset. See `docs/chart-table-data.md`.

The slide `tag` (the small line above the title) follows `titleAlignment`, like the title, so a layout that centers its content does not center the tag over a left-aligned title; only a slide's own `design.contentAlignment` keeps it on the content, as on a cover.

Keep numbers numeric where the schema permits them. Tables use `columns` and `rows`, not `headers` and `cells`. OPF slide content is not an `elements` array or arbitrary HTML. Promoted region values are content payloads, for example `"left":{"text":"Context"}`.

The presentation root accepts identity, organizations, speakers, author, audience, purpose, language, tone, takeaway, duration, tags, design, variables, template, narrative, slides, references, datasets, assets, catalogs, and extensions. Query the schema for object alternatives and required fields. Do not put old `version`/`meta` wrappers into the current canonical document.

Assets may be source strings or asset metadata objects. Reusable references use `asset:<id>`. Embedded catalog records live in `catalogs.<group>.<kind>.<id>` (groups `default`, `custom` and named catalogs with a `source`) without `$schema` or `id`. Asset and catalog sources are declarations, not evidence that a renderer fetched them; engines never fetch a catalog.

Validation in a project with the package installed:

```js
import { validate } from '@openpresentation/opf';
const report = validate(document);
if (!report.valid) throw new Error(JSON.stringify(report.findings.filter((finding) => finding.severity === 'error')));
console.log(report.findings); // warnings and info: unresolved references, alt text, contrast, overflow
```

## Tables you can read from the back of the room

A table's text draws at the body size (about 19 pt, next to 24 pt bullets) and the whole table shrinks together toward `composition.minFontSize` when its rows do not fit, so you do not size cells yourself: leave `fontSize` out unless one cell must differ (a run's own `fontSize` is drawn as written). Wrap a cell in `{"value", "style"}` when it needs bold, alignment, padding or a border; `style.bold` makes the whole cell bold, including a number cell that keeps its `format`. `padding` is an object of `top`, `right`, `bottom`, `left` in reference pixels (0-200), never a number: `"padding": 8` is a schema error (`must be object`). Header cells go in `columns` in the same styled form.

```json
{
  "slides": [
    {
      "title": "North America leads growth",
      "table": {
        "columns": [
          {"value": "Region", "style": {"bold": true, "padding": {"top": 12, "right": 16, "bottom": 12, "left": 16}}},
          {"value": "Q4 revenue", "style": {"bold": true, "align": "right", "padding": {"top": 12, "right": 16, "bottom": 12, "left": 16}}},
          {"value": "Growth", "style": {"bold": true, "align": "right", "padding": {"top": 12, "right": 16, "bottom": 12, "left": 16}}}
        ],
        "rows": [
          [
            {"value": "North America", "style": {"padding": {"top": 12, "right": 16, "bottom": 12, "left": 16}}},
            {"value": "$18.1M", "style": {"align": "right", "padding": {"top": 12, "right": 16, "bottom": 12, "left": 16}}},
            {"value": [{"text": "+46%", "bold": true, "color": "accent2"}], "style": {"align": "right", "padding": {"top": 12, "right": 16, "bottom": 12, "left": 16}}}
          ],
          [
            {"value": "EMEA", "style": {"padding": {"top": 12, "right": 16, "bottom": 12, "left": 16}}},
            {"value": "$11.5M", "style": {"align": "right", "padding": {"top": 12, "right": 16, "bottom": 12, "left": 16}}},
            {"value": "+40%", "style": {"align": "right", "padding": {"top": 12, "right": 16, "bottom": 12, "left": 16}}}
          ]
        ],
        "alt": "North America grew 46% to $18.1M in Q4, ahead of EMEA at 40%."
      }
    }
  ]
}
```

A text cell keeps the string you type, so write the number as you want it shown (`"$18.1M"`) and right-align it with `style.align`. Keep a number a number when the same data feeds a chart or other tables, or the table is dense and reference-only: give the column a `format` and write plain numbers; a number column is right-aligned for you, and a cell written as runs (to color one number, say) keeps that column's alignment. A bold number that keeps its format is `{"value": 18.1, "style": {"bold": true}}`.

```json
{
  "slides": [
    {
      "title": "A numeric column keeps its number",
      "table": {
        "columns": ["Region", { "name": "Q4 revenue ($M)", "format": "$#,##0.0" }, { "name": "Growth", "format": "0%" }],
        "rows": [["North America", 18.1, 0.46], ["EMEA", {"value": 11.5, "style": {"bold": true}}, 0.4]]
      }
    }
  ]
}
```

A `%` format multiplies by 100, so store `0.46` for 46%. The run `color` above is `accent2` from the deck's color scheme; prefer scheme names to hex so the table survives a theme change.

## Citations, footnotes and captions

Color the one word that carries a headline, or cite a headline claim or a quote: `title`, `subtitle`, `tag` and `quote.text` accept `TextRun[]` like body text (`"title": ["Revenue grew ", {"text": "28%", "color": "accent1"}]`; `"quote": {"text": ["Cut review time by ", {"text": "40%", "bold": true, "cite": "case-study"}]}`). A string stays the plain form; the heading keeps its size and shrink rules, and a run's `cite`/`footnote` follows the rules below. Headings read first, so their markers take the lowest numbers of the slide.

Cite a source from a heading, text, bullet, list item or quote run with `cite` (one id, or an array of ids, from the deck's top-level `references` list; unknown ids fail validation); add an inline note with `footnote`. Engines draw a superscript marker after the run and list `<n> <text>` in the slide's footnote area; markers are numbered per deck in order of first use, a reference keeps its number, every footnote takes a new one. Table cells, captions and reference texts cannot carry markers. A reference no run cites is a warning. `referencesSlide(presentation, {title})` from `@openpresentation/opf/composition` builds an ordinary list slide of the cited references for the end of the deck.

An image block takes `fit` (`cover`, the default via `design.imageFit`; `contain`; `stretch`; `auto`, which covers when the crop keeps at least 85% of the picture and shows it whole otherwise, and always shows an SVG whole), `focus` (`{x, y}` kept in view by a cover crop), the treatments `shape` (`rectangle`, `rounded`, `circle`, `hexagon`), `cornerRadius`, `border`, `opacity`, `recolor` (`grayscale` or `{dark, light}`), `overlay` and `aspectRatio`, and on a top-level block `placement: {edge, size, inset}`, which bleeds it to one slide edge while the title and the other blocks compose beside it (one per edge). A team is a body of people, each a group of a picture followed by a one-entry list (`{"text":"Name","description":"Role\nOne line"}`): 2 to 4 people draw the picture across the top of each card, 5 or 6 beside the text, more keep a small avatar; `portrait` (`top`, `side`, `avatar`) on the first person's picture chooses for the whole team. A full-slide photo behind the content is `design.background`, not an image block.

An `image`, `chart`, `table` or `video` payload takes a `caption` (a string, `TextRun[]`, or `{text, position: "below" | "above", align: "left" | "center" | "right"}`), composed inside the block's region; only one captionable payload per block or slide root.

```json
{
  "references": [{ "id": "gartner-2026", "text": "Gartner, Market Guide for Presentation Tooling, 2026", "url": "https://www.gartner.com" }],
  "slides": [
    {
      "title": "Adoption doubled",
      "blocks": [
        { "text": [{ "text": "Enterprise adoption doubled in 2025", "cite": "gartner-2026" }, { "text": " and keeps growing.", "footnote": "Internal forecast, not audited." }] },
        { "image": "https://cdn.acme.com/images/adoption.png", "caption": { "text": "Figure 1. Adoption by year", "align": "center" } }
      ]
    }
  ]
}
```
