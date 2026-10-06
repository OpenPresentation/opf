# Content shape guide

Consult the installed schema for optional fields and constraints. This guide selects the common forms; it is not a second schema.

| Intent | OPF shape |
| --- | --- |
| Plain text | `{"text":"A useful assertion"}` |
| Rich text | `{"text":[{"text":"Important","bold":true}," detail"]}` |
| List | `{"items":["First point","Second point"]}` |
| Numbered list | `{"items":["First step","Second step"],"numbering":"arabic"}` (also `roman-upper`, `roman-lower`, `alpha-upper`, `alpha-lower`; `{"style":"alpha-lower","start":3,"suffix":"paren"}`; an array is one entry per level; works on `bullets` too) |
| Image | `{"image":{"src":"asset:diagram","alt":"Description of the diagram"}}` |
| Video | `{"video":{"src":"asset:demo","title":"Demo"}}` |
| Table | `{"table":{"columns":["Quarter","Revenue"],"rows":[["Q1",12],["Q2",18]]}}` |
| Chart | `{"chart":{"type":"column","data":{"columns":["Quarter","Revenue"],"rows":[["Q1",12],["Q2",18]]}}}` |
| Metric | `{"metric":{"value":98,"unit":"%","label":"Retention"}}` |
| Quote | `{"quote":{"text":"Quoted words","attribution":"Source speaker","source":"Source reference"}}` |
| Code | `{"code":{"source":"const answer = 42;","language":"javascript"}}` |
| Timeline | `{"timeline":[{"when":"Now","what":"Prototype"},{"when":"Next","what":"Review"}]}` |
| Nested group | `{"composition":{"mode":"column"},"blocks":[{"text":"One"},{"text":"Two"}]}` |

These numeric examples are illustrative; replace them only with supported data. Chart type strings must resolve to actual catalog IDs or supported chart types. A richer chart record does not guarantee the current renderer implements every visual detail. A chart takes optional `axisTitles` (`{"category":"Quarter","value":"Revenue ($M)"}`), `legend` (`none`, `top`, `bottom`, `left`, `right`) and `dataLabels` (`true`, or `{"content":["value"],"position":"outside-end"}`); omit them to keep the engine defaults, and see `docs/chart-options.md` for what each chart type supports (an option a type cannot show is dropped with a `chart-option-adapted` diagnostic).

Chart values are numbers. A string counts only in strict decimal syntax (`"12"`, `"-3.5"`, `"1e6"`); `"12%"`, `"$5"`, `"(5)"` and `"1,234"` are gaps and a `chart-value-not-numeric` warning. Put units, currency and percent in a column format instead: a chart, dataset or table column may be `{"name":"Revenue","format":"$#,##0.0"}` (the `NumberVariable.format` syntax: `#,##0`, `0.0%`, `#,##0 units`; a `%` multiplies by 100, so store 0.31 for 31%), and a styled table cell takes its own `format`. Data used by several charts or tables goes once in the top-level `datasets` map (`{"revenue":{"columns":[...],"rows":[...],"source":{"src":"./revenue.csv"}}}`) and is referenced with `"chart":{"type":"line","data":{"dataset":"revenue","fields":["Quarter","Revenue"]}}` or `"table":{"dataset":"revenue"}`; an unreferenced dataset is the lint warning `opf/unused-dataset`. `chart.mapping` (`{"category":"Quarter","x":"Spend","series":["Revenue","Costs"]}`) picks columns by name; omit it for the positional rule (first column the category, every other column a series; scatter takes the second as X). Record where inline data came from with `data.source` (`{"src","sheet","range","retrieved"}`), which engines never read. `"data":{"src":...}` (a data source by file or asset) is not part of the format and is a schema error: import the data inline or into a dataset. See `docs/chart-table-data.md`.

Keep numbers numeric where the schema permits them. Tables use `columns` and `rows`, not `headers` and `cells`. OPF slide content is not an `elements` array or arbitrary HTML. Promoted region values are content payloads, for example `"left":{"text":"Context"}`.

The presentation root accepts identity, organizations, speakers, author, audience, purpose, language, tone, takeaway, duration, tags, design, variables, template, narrative, slides, references, datasets, assets, catalogs, and extensions. Query the schema for object alternatives and required fields. Do not put old `version`/`meta` wrappers into the current canonical document.

Assets may be source strings or asset metadata objects. Reusable references use `asset:<id>`. Inline catalog records live in `catalogs.<kind>.records`; record `$schema` identifies its companion schema. Asset and catalog sources are declarations, not evidence that a renderer fetched them.

Validation in a project with the package installed:

```js
import { validatePresentation } from '@openpresentation/opf';
const result = validatePresentation(document);
if (!result.valid) throw new Error(JSON.stringify(result.errors));
console.log(result.warnings);
```

## Citations, footnotes and captions

Cite a source from a text, bullet or list item run with `cite` (one id, or an array of ids, from the deck's top-level `references` list; unknown ids fail validation); add an inline note with `footnote`. Engines draw a superscript marker after the run and list `<n> <text>` in the slide's footnote area; markers are numbered per deck in order of first use, a reference keeps its number, every footnote takes a new one. Table cells, captions and reference texts cannot carry markers. A reference no run cites is a lint warning. `referencesSlide(presentation, {title})` from `@openpresentation/opf` builds an ordinary list slide of the cited references for the end of the deck.

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
