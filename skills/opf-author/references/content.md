# Content shape guide

Consult the installed schema for optional fields and constraints. This guide selects the common forms; it is not a second schema.

| Intent | OPF shape |
| --- | --- |
| Plain text | `{"text":"A useful assertion"}` |
| Rich text | `{"text":[{"text":"Important","bold":true}," detail"]}` |
| Inline code | `{"text":["Run ",{"text":"pnpm install","code":true}]}` (the design's code font; Markdown `` `backticks` `` are the same thing) |
| Run in another language | `{"text":["The word ",{"text":"Zeitgeist","lang":"de"}]}` (BCP-47 tag; sets proofing and script fonts for that run) |
| List | `{"items":["First point","Second point"]}` |
| Prose bullets | `{"bullets":["A talking point","Another one"]}` (a `text` payload; pick `items` instead when any entry needs supporting detail) |
| List with detail | `{"items":[{"text":"Faster onboarding","description":"First value in under a day."}]}` (`description` exists only on `items`) |
| Numbered list | `{"items":["First step","Second step"],"numbering":"arabic"}` (also `roman-upper`, `roman-lower`, `alpha-upper`, `alpha-lower`; `{"style":"alpha-lower","start":3,"suffix":"paren"}`; an array is one entry per level; works on `bullets` too) |
| Image | `{"image":{"src":"asset:diagram","alt":"Description of the diagram"}}` |
| Video | `{"video":{"src":"asset:demo","title":"Demo"}}` |
| Table | `{"table":{"columns":["Quarter","Revenue"],"rows":[["Q1",12],["Q2",18]]}}`; an optional `alt` is a summary of what a large or dense table shows, read before its cells (`""` hides a purely decorative table) |
| Metric | `{"metric":{"value":98,"unit":"%","label":"Retention"}}`; `trend` (`up`, `down`, `flat`) draws an arrow, and `sentiment` (`positive`, `negative`, `neutral`) says whether the change is good news, so a falling churn is `"trend":"down","sentiment":"positive"` (absent: up green, down red, flat neutral) |
| Chart | `{"chart":{"type":"column","alt":"Revenue rose from $12M in Q1 to $18M in Q2.","data":{"columns":["Quarter","Revenue"],"rows":[["Q1",12],["Q2",18]]}}}` |
| Quote | `{"quote":{"text":"Quoted words","attribution":"Source speaker","source":"Source reference"}}`; a testimonial adds `"role":"VP Operations, Acme"` (title and organization, drawn on its own line under the attribution) and `"photo":{"src":"asset:speaker","alt":"Name"}` (a circular headshot beside them; give it alt text) |
| Code | `{"code":{"source":"const answer = 42;","language":"javascript"}}` |
| Code with emphasized lines | `{"code":{"source":"a\nb\nc\nd","language":"javascript","highlight":[2,[3,4]]}}` (1-based lines and inclusive ranges; the rest is dimmed) |
| Timeline | `{"timeline":[{"when":"Now","what":"Prototype"},{"when":"Next","what":"Review"}]}` |
| Timeline with progress | `{"timeline":[{"when":"Q1","what":"Discovery","status":"done"},{"when":"Q2","what":"Pilot","status":"current"},{"when":"Q3","what":"Rollout","status":"planned"}]}` |
| Nested group | `{"composition":{"mode":"column"},"blocks":[{"text":"One"},{"text":"Two"}]}` |

Timeline `status` is progress only: `done` (filled marker), `current` ("we are here": ringed marker, bold label) and `planned` (hollow marker, muted text). Mark at most one event `current`, and write risk or blockers in the event text, not in a status. [A complete roadmap](../assets/roadmap-status.opf.json) shows all three.

These numeric examples are illustrative; replace them only with supported data. `chart.type` is an engine vocabulary: use one of the supported chart types (`CHART_TYPES`); the schema rejects any other. A richer chart record does not guarantee the current renderer implements every visual detail. A chart takes optional `axisTitles` (`{"category":"Quarter","value":"Revenue ($M)"}`), `legend` (`none`, `top`, `bottom`, `left`, `right`) `dataLabels` (`true`, or `{"content":["value"],"position":"outside-end"}`) and `highlight` (`{"series":["Revenue"],"categories":["Q3"]}`: name the series or category that carries the message by its data column name or row label, and the engines draw those marks in the deck's primary color and mute the rest from the theme, with no color field; a mark is highlighted when its series or its category is named; a name the data does not have is an error); omit them to keep the engine defaults, and see `docs/chart-options.md` for what each chart type supports (an option a type cannot show is dropped with a `chart-option-adapted` diagnostic). For an amount beside a rate (revenue and margin %) use `"type":"combo"`: every series is drawn as clustered columns except those in `"line":["Margin"]` (default: the last series), and `"secondaryAxis":["Margin"]` plots those lines on a right-hand value axis labelled in that column's format (`{"name":"Margin","format":"0%"}`), titled with `axisTitles.secondary`.

Chart values are numbers. A string counts only in strict decimal syntax (`"12"`, `"-3.5"`, `"1e6"`); `"12%"`, `"$5"`, `"(5)"` and `"1,234"` are gaps and a `chart-value-not-numeric` warning. Put units, currency and percent in a column format instead: a chart, dataset or table column may be `{"name":"Revenue","format":"$#,##0.0"}` (the `NumberVariable.format` syntax: `#,##0`, `0.0%`, `#,##0 units`; a `%` multiplies by 100, so store 0.31 for 31%), and a styled table cell takes its own `format`. Data used by several charts or tables goes once in the top-level `datasets` map (`{"revenue":{"columns":[...],"rows":[...],"source":{"src":"./revenue.csv"}}}`) and is referenced with `"chart":{"type":"line","data":{"dataset":"revenue","fields":["Quarter","Revenue"]}}` or `"table":{"dataset":"revenue"}`; an unreferenced dataset is the warning `opf/unused-dataset`. `chart.mapping` (`{"category":"Quarter","x":"Spend","series":["Revenue","Costs"]}`) picks columns by name; omit it for the positional rule (first column the category, every other column a series; scatter takes the second as X). Record where inline data came from with `data.source` (`{"src","sheet","range","retrieved"}`), which engines never read. `"data":{"src":...}` (a data source by file or asset) is not part of the format and is a schema error: import the data inline or into a dataset. See `docs/chart-table-data.md`.

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

## Citations, footnotes and captions

Colour the one word that carries a headline, or cite a headline claim or a quote: `title`, `subtitle`, `tag` and `quote.text` accept `TextRun[]` like body text (`"title": ["Revenue grew ", {"text": "28%", "color": "accent1"}]`; `"quote": {"text": ["Cut review time by ", {"text": "40%", "bold": true, "cite": "case-study"}]}`). A string stays the plain form; the heading keeps its size and shrink rules, and a run's `cite`/`footnote` follows the rules below. Headings read first, so their markers take the lowest numbers of the slide.

Cite a source from a heading, text, bullet, list item or quote run with `cite` (one id, or an array of ids, from the deck's top-level `references` list; unknown ids fail validation); add an inline note with `footnote`. Engines draw a superscript marker after the run and list `<n> <text>` in the slide's footnote area; markers are numbered per deck in order of first use, a reference keeps its number, every footnote takes a new one. Table cells, captions and reference texts cannot carry markers. A reference no run cites is a warning. `referencesSlide(presentation, {title})` from `@openpresentation/opf/composition` builds an ordinary list slide of the cited references for the end of the deck.

An image block takes `fit` (`cover`, the default via `design.imageFit`; `contain`; `stretch`), `focus` (`{x, y}` kept in view by a cover crop), the treatments `shape` (`rectangle`, `rounded`, `circle`, `hexagon`), `cornerRadius`, `border`, `opacity`, `recolor` (`grayscale` or `{dark, light}`), `overlay` and `aspectRatio`, and on a top-level block `placement: {edge, size, inset}`, which bleeds it to one slide edge while the title and the other blocks compose beside it (one per edge). A full-slide photo behind the content is `design.background`, not an image block.

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
