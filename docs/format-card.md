# OPF format card

A self-contained authoring reference for agents and humans writing `*.opf.json` documents, sized for pasting into a model's context. The canonical contract is the JSON Schema (`https://openpresentation.org/schema/opf/v1`, in [`spec/schemas/opf.schema.json`](../spec/schemas/opf.schema.json)); this card compresses it. Validate with `validate` from `@openpresentation/opf` or `opf validate <file>` ([validate](validate.md)); treat the deck as done only when `opf validate <file> --fail-on warning` passes, since an unknown layout id is only a warning. `v1` in the schema id is the pre-1.0 line, which changes across 0.x releases ([schema versioning](schema-versioning.md)).

## Document shape

A presentation is one JSON object; only `slides` is required.

```json
{ "name": "Minimal Deck", "slides": [{ "title": "Minimal Deck" }] }
```

Optional top-level fields, grouped:

- Identity: `name`, `description`, `filename`, `author`, `organization`, `speaker`, `tags`.
- Intent (used by AI generation): `audience`, `purpose`, `tone`, `language`, `narrative`, `takeaway`, `duration`.
- Appearance: `design` (`theme`, `colorScheme`, `fontScheme`, `dimensions`, `background`, `variant` (from core 0.23.0: `"dark1"` or `{ background, accents }`, a map over the one color scheme), `logo` override, `watermark`, `header`, `footer`, alignment hints), `variables`; logos themselves live on `organization`.
- Resources: `assets` (registry referenced as `asset:<id>`), `datasets` (shared data tables that charts and tables name with `dataset`), `icons` (deck-local SVG icons named by `icon`), `references` (the sources text runs `cite`), `catalogs` (the records the document embeds, grouped by catalog: `default`, `custom` and named groups with a `source`).
- Templates: `template: true` marks an incomplete deck whose `variables` are filled later.
- Machine state: `extensions` (preserved, never rendered).

## Slides and content

A slide carries `title` / `subtitle` / `tag` / `notes` / `section` / `beat` / `layout` / `id` / `language` (when it differs from the deck's) / `hidden` / `extensions` plus content in one of three shapes — pick the loosest that says what you mean:

1. **Root payload** — content-kind fields directly on the slide. The kind is inferred from the field: `text`, `items` (list), `bullets`, `image`, `video`, `chart`, `table`, `code`, `metric`, `quote`, `timeline`, `diagram` (Mermaid, Graphviz DOT or PlantUML source). Several kinds at the root are shorthand for `blocks`.
2. **`blocks`** — an ordered array of payloads when placement should stay engine-inferred. A block is a leaf payload or a **group**: `{ "type": "group", "blocks": [...], "composition": { ... } }`. Groups nest (hard cap 32; stay ≤ 3 in practice) and cannot mix `blocks` with leaf fields.
3. **Promoted regions** — a 3×3 grid when position matters. Rows `top|middle|bottom`, columns `start|center|end`, spans with `+`, intersections with `:` — `"start"`, `"center+end"`, `"top:start"`, `"middle+bottom:center+end"`. Keys must not overlap; regions cannot mix with a root payload.

Direction: layout words are logical. `start` and `end` (region columns, `titleAlignment` and `contentAlignment`, a caption's or table cell's `align`, header and footer zones, image `placement.edge`, `overlay.edge`, `chartPrimary`, shape anchors, an overlay shape's `x`) follow the deck's direction: `start` is the left edge in a left-to-right deck and the right edge in a right-to-left deck. Coordinates and sides that name pixels of a picture or parts of a plot are physical in every language: image `focus` and `callouts`, chart `legend` and `dataLabels.position`, and the `left` and `right` sides of cell `borders` and `padding` and of a shape's `padding`.

`composition` (on a slide or group) arranges children: `{ "mode": "auto|grid|row|column", "columns": 1-12, "weights": [..], "gap": 0-0.1, "padding": 0-0.2, "minFontSize": 8-32, "maxFontSize": 8-200, "overflow": "warn|error" }`. Weights are relative track sizes; gap/padding are fractions of the canvas short edge; the font sizes are reference pixels at a 720-pixel short edge. Engines own the placement of content: a block has no x/y.

Only what is drawn over the composed slide is positioned. A slide's `shapes` holds overlay shapes and connectors: `{ "shape": "ellipse", "x": -0.06, "y": -0.1, "width": 0.22, "height": 0.39 }` (signed fractions of the slide, never percents or pixels; a shape may hang over an edge) or `{ "shape": "wedgeRectCallout", "text": "New", "at": { "block": "<id>", "edge": "top" } }` (it follows the block; sized by `width`/`height` as fractions of the block or `widthPx`/`heightPx` in reference pixels). An image object takes `callouts`, text panels placed by fractions of the picture.

Payload notes: chart (never the Chart.js `categories`/`series`/`labels`/`datasets` shape; the first column holds the labels, each further column is one series) is `{ "type": "<chart-type id>", "data": { "columns": [...], "rows": [...] } }` or `{ "data": { "dataset": "<id>" } }`, with optional `legend`, `dataLabels`, `axisTitles`, `colors`, `highlight` and explicit `referenceLines` (`[{ "value": 0.25, "label": "Target 25%" }]` on a column, bar, line, line-with-markers, area or combo chart, not (yet) a stacked one; another type is the error `opf/chart-reference-unsupported-type`; a title never creates one); table rows may hold scalars, `TextRun[]`, or styled cells `{ "value", "style": { "fill", "color", "align", "borders", ... }, "colSpan", "rowSpan" }`; `metric`/`quote`/`code` accept string shorthand; list nesting uses `level` on items, not nested payloads.

## Rich text and color references

`text`, list items, bullets, and table cells accept `TextRun[]`: strings or `{ "text", "bold", "italic", "underline", "strikethrough", "color", "fontSize", "fontFamily", "code", "language", "link", "superscript", "subscript", "cite", "footnote" }`. `fontSize` is in points (12 points is 16 reference pixels), the one size in OPF that is not in reference pixels; an unknown key in a run is an error.

Every content color field (`TextRun.color`, table cell `style.fill` / `style.color`, cell border `color`) accepts four forms:

- Literal hex: `"#0F172A"`, `"#B42318CC"`.
- A color-scheme name, resolved through the effective scheme: slots `accent1`–`accent6`, `dark1`, `dark2`, `light1`, `light2`, `hyperlink`, `followedHyperlink`, or roles `primary`, `secondary`, `accent`, `background`, `surface`, `surfaceAlt`, `text`, `textSecondary`.
- A color made lighter or darker: `{ "color": "accent1", "lighten": 0.4 }` or `{ "color": "#1E40AF", "darken": 0.25 }`.
- A variable reference `var:<id>` into the top-level map: `"variables": { "risk": "#B42318" }` (or `{ "type": "color", "value": "#B42318", "description": "..." }`).

Prefer names and variables over hex — they survive re-theming. Unknown `var:` ids warn, never error. The styled cell and border color fields enforce these forms at the schema level; run colors tolerate any string (unrecognized values warn and renderers fall back to the theme), so imported decks keep validating.

## Ids and extensions

`id` is optional on slides and on any content payload (including groups), unique document-wide. Use ids when something outside the document must address content across edits — patch edits, comments, review state. `extensions` objects at document, slide, and payload scope carry machine state; engines ignore and preserve them.

## Catalog references

Reusable records live in catalogs; a reference is a bare id or `name:id`: `narrative`, `tone`, `purpose`, `audience`, `design.theme`, `design.colorScheme`, `design.fontScheme`, `Slide.layout`. `catalogs` holds the records a document embeds, grouped by catalog: `default` (with its `source`), `custom` (the document's own) and named groups (`"acme": { "source": "pkg:@acme/opf-catalog", ... }`, referenced as `acme:hero`). Resolution: `custom` → embedded `default` → the catalog the host registered for its source; nothing is fetched. Object form overrides a record per key: `{ "id": "cool-horizon", "accent1": "#0F4C81" }`. A reference that resolves nowhere warns (`opf/unresolved-reference`), never errors. `opf embed <in> <out>` embeds every record a document uses so it renders with no catalog registered. `language` (a BCP-47 tag), `Chart.type` and the socials keys are engine vocabularies, not references.

## Design in three lines

`design.theme` bundles scheme + fonts + background + dimensions; `design.colorScheme` / `fontScheme` override it; `slides[].design` overrides per slide; resolution is per field, most specific wins. Backgrounds accept slot names (`"light1"`) or hex. `false` suppresses inherited `watermark` / `header` / `footer`. A header or footer zone (`start` / `center` / `end`) takes `image`, `text`, `socials`, `date`, laid out side by side in that order; generated values are variables in `text`: `"{{slide.number}} / {{deck.slideCount}}"`, `"{{slide.section}}"`, `"{{organization.name}}"` (the slide-scoped `{{slide.number}}`, `{{slide.section}}`, `{{deck.slideCount}}` also work in body text). Logos live on `organization.logo` (one path, or `full` / `stacked` / `icon` / `wordmark`, each a path or `{ onLight, onDark }`); place one with `"image": "var:organization.logo.icon"`; covers draw the full logo, and `design.logo` is only an override reference or `false`.

## Prefer / never

Prefer: string shorthands; bare ids for default-catalog records; inference over explicit `type`; regions only when position matters; groups only when `blocks` ordering is not enough; names/`var:` over hex in color fields; `items` for lists and `bullets` only for plain talking points (never both in one block or region; see [content payloads](content-payloads.md#items-versus-bullets)).

Never: loose chart or table fields directly on a slide; region keys mixed with a root payload; overlapping region keys; `blocks` mixed with leaf fields on one payload; duplicate ids; x/y or pixel geometry on a block (only overlay `shapes` and image `callouts` are positioned, by fractions); a percent or a pixel where a fraction belongs (`"x": 20`).

## Two canonical slides

```json
{
  "id": "headline",
  "title": "Adoption Doubled",
  "start": { "id": "kpi", "metric": { "value": "2.1x", "label": "Adoption", "trend": "up" } },
  "center+end": { "chart": { "type": "line", "data": { "columns": ["Month", "Teams"], "rows": [["Jan", 12], ["Feb", 18]] } } }
}
```

```json
{
  "id": "risks",
  "title": "What Could Go Wrong",
  "composition": { "mode": "column" },
  "blocks": [
    { "items": [["Two regions at ", { "text": "85% utilization", "color": "var:risk", "bold": true }]] },
    { "quote": { "text": "Exceptions became visible before they became escalations.", "attribution": "VP Operations" } }
  ],
  "extensions": { "authoring": { "locked": true } }
}
```
