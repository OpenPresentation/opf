# OPF format card

A self-contained authoring reference for agents and humans writing `*.opf.json` documents, sized for pasting into a model's context. The canonical contract is the JSON Schema (`https://openpresentation.org/schema/opf/v1`, in [`spec/schemas/opf.schema.json`](../spec/schemas/opf.schema.json)); this card compresses it. Validate with `validate` from `@openpresentation/opf` or `opf validate <file>` ([validate](validate.md)).

## Document shape

A presentation is one JSON object; only `slides` is required.

```json
{ "name": "Minimal Deck", "slides": [{ "title": "Minimal Deck" }] }
```

Optional top-level fields, grouped:

- Identity: `name`, `description`, `filename`, `author`, `organization`, `speaker`, `tags`.
- Intent (used by AI generation): `audience`, `purpose`, `tone`, `language`, `narrative`, `takeaway`, `duration`.
- Appearance: `design` (`theme`, `colorScheme`, `fontScheme`, `dimensions`, `background`, `logo`, `watermark`, `header`, `footer`, alignment hints), `variables`.
- Resources: `assets` (registry referenced as `asset:<id>`), `catalogs` (the records the document embeds, grouped by catalog: `default`, `custom` and named groups with a `source`).
- Machine state: `extensions` (preserved, never rendered).

## Slides and content

A slide carries `title` / `subtitle` / `tag` / `notes` / `section` / `beat` / `layout` / `id` / `extensions` plus content in one of three shapes — pick the loosest that says what you mean:

1. **Root payload** — content-kind fields directly on the slide. The kind is inferred from the field: `text`, `items` (list), `bullets`, `image`, `video`, `chart`, `table`, `code`, `metric`, `quote`, `timeline`. Several kinds at the root are shorthand for `blocks`.
2. **`blocks`** — an ordered array of payloads when placement should stay engine-inferred. A block is a leaf payload or a **group**: `{ "type": "group", "blocks": [...], "composition": { ... } }`. Groups nest (hard cap 32; stay ≤ 3 in practice) and cannot mix `blocks` with leaf fields.
3. **Promoted regions** — a 3×3 grid when position matters. Rows `top|middle|bottom`, columns `left|center|right`, spans with `+`, intersections with `:` — `"left"`, `"center+right"`, `"top:left"`, `"middle+bottom:center+right"`. Keys must not overlap; regions cannot mix with a root payload.

`composition` (on a slide or group) arranges children: `{ "mode": "auto|grid|row|column", "columns": 1-12, "weights": [..], "gap": 0-0.1, "padding": 0-0.2, "minFontSize": 8-32, "overflow": "warn|error" }`. Weights are relative track sizes; gap/padding are fractions of the canvas short edge. Engines own placement — there is no x/y.

Payload notes: chart is `{ "type": "<chart-type id>", "data": { "columns": [...], "rows": [...] } }` or `{ "data": { "dataset": "<id>" } }`; table rows may hold scalars, `TextRun[]`, or styled cells `{ "value", "style": { "fill", "color", "align", "borders", ... }, "colSpan", "rowSpan" }`; `metric`/`quote`/`code` accept string shorthand; list nesting uses `level` on items, not nested payloads.

## Rich text and color references

`text`, list items, bullets, and table cells accept `TextRun[]`: strings or `{ "text", "bold", "italic", "underline", "strikethrough", "color", "fontSize", "fontFamily", "link", "superscript", "subscript" }`.

Every content color field (`TextRun.color`, table cell `style.fill` / `style.color`, cell border `color`) accepts three forms:

- Literal hex: `"#0F172A"`, `"#B42318CC"`.
- A color-scheme name, resolved through the effective scheme: slots `accent1`–`accent6`, `dark1`, `dark2`, `light1`, `light2`, `hyperlink`, `followedHyperlink`, or roles `primary`, `secondary`, `accent`, `background`, `surface`, `text`, `textSecondary`.
- A variable reference `var:<id>` into the top-level map: `"variables": { "risk": "#B42318" }` (or `{ "type": "color", "value": "#B42318", "description": "..." }`).

Prefer names and variables over hex — they survive re-theming. Unknown `var:` ids warn, never error. The styled cell and border color fields enforce the three forms at the schema level; run colors tolerate any string (unrecognized values warn and renderers fall back to the theme), so imported decks keep validating.

## Ids and extensions

`id` is optional on slides and on any content payload (including groups), unique document-wide. Use ids when something outside the document must address content across edits — patch edits, comments, review state. `extensions` objects at document, slide, and payload scope carry machine state; engines ignore and preserve them.

## Catalog references

Reusable records live in catalogs; a reference is a bare id or `name:id`: `narrative`, `tone`, `purpose`, `audience`, `design.theme`, `design.colorScheme`, `design.fontScheme`, `Slide.layout`. `catalogs` holds the records a document embeds, grouped by catalog: `default` (with its `source`), `custom` (the document's own) and named groups (`"acme": { "source": "pkg:@acme/opf-catalog", ... }`, referenced as `acme:hero`). Resolution: `custom` → embedded `default` → the catalog the host registered for its source; nothing is fetched. Object form overrides a record per key: `{ "id": "cool-horizon", "accent1": "#0F4C81" }`. A reference that resolves nowhere warns (`opf/unresolved-reference`), never errors. `opf embed <in> <out>` embeds every record a document uses so it renders with no catalog registered. `language` (a BCP-47 tag), `Chart.type` and the socials keys are engine vocabularies, not references.

## Design in three lines

`design.theme` bundles scheme + fonts + background + dimensions; `design.colorScheme` / `fontScheme` override it; `slides[].design` overrides per slide; resolution is per field, most specific wins. Backgrounds accept slot names (`"light1"`) or hex. `false` suppresses inherited `watermark` / `header` / `footer`.

## Prefer / never

Prefer: string shorthands; bare ids for default-catalog records; inference over explicit `type`; regions only when position matters; groups only when `blocks` ordering is not enough; names/`var:` over hex in color fields; `items` for lists and `bullets` only for plain talking points (never both in one block or region; see [content payloads](content-payloads.md#items-versus-bullets)).

Never: loose chart or table fields directly on a slide; region keys mixed with a root payload; overlapping region keys; `blocks` mixed with leaf fields on one payload; duplicate ids; x/y or pixel geometry (it does not exist in OPF).

## Two canonical slides

```json
{
  "id": "headline",
  "title": "Adoption Doubled",
  "left": { "id": "kpi", "metric": { "value": "2.1x", "label": "Adoption", "trend": "up" } },
  "center+right": { "chart": { "type": "line", "data": { "columns": ["Month", "Teams"], "rows": [["Jan", 12], ["Feb", 18]] } } }
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
