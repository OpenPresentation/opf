# How OPF Works

An OPF document is one JSON file that answers three questions about a presentation:

- **What does it say?** — `slides`, with content payloads and assets.
- **Who is it for and why?** — `audience`, `purpose`, `tone`, `language`, and `narrative`.
- **What should it look like?** — `design`, resolved through themes, color schemes, and font schemes.

The document records intent; an engine (a renderer, exporter, or editor) turns that intent into pixels or `.pptx` output. OPF deliberately stops at the format boundary: it never embeds OOXML, layout geometry, or renderer-specific state.

The smallest valid document is just slides:

```json
{
  "name": "Minimal OPF Deck",
  "slides": [
    { "title": "Minimal OPF Deck" },
    { "title": "Next Steps", "text": "Use this as a starting point." }
  ]
}
```

Everything else in the format is optional and additive.

## Slides and content

A slide carries its content in one of three shapes. Pick the loosest shape that says what you mean — engines handle placement.

1. **Root payload** — one content kind directly on the slide. The kind is inferred from the field present (`text`, `items`, `chart`, `table`, `image`, `video`, `code`, `metric`, `quote`, `timeline`); see [`content-payloads.md`](./content-payloads.md) for the full table. Multiple kinds at the slide root (with no explicit `type`, `blocks`, or regions) are shorthand for the equivalent `blocks`.
2. **`blocks`** — an ordered list of payloads when a slide has several pieces of content but placement should stay renderer-inferred.
3. **Promoted region keys** — a 3×3 placement grid when position matters. Columns are `left`, `center`, `right`; rows are `top`, `middle`, `bottom`. Keys can span (`center+right`, `top+middle`) and combine row with column (`top:left`, `middle+bottom:center+right`). Region keys on one slide must not overlap, and regions cannot be mixed with a root payload.

```json
{
  "title": "Operating Snapshot",
  "left": { "table": { "columns": ["Metric", "Value"], "rows": [["Revenue", "$4.2M"]] } },
  "center+right": { "chart": { "type": "line", "data": { "columns": ["Month", "Revenue"], "rows": [["Jan", 3.4]] } } }
}
```

Slide-level strings `title`, `subtitle`, and `tag` sit alongside whichever content shape you use, and render into the matching placeholders of the resolved layout.

## Layouts are hints, not contracts

`Slide.layout` optionally references a record in the `layouts` catalog. The layout's placeholders describe what the layout *exposes* (a title slot, chart regions, image treatment) — they do not constrain what the slide may contain. This loose coupling is intentional:

- A slide may use any region keys or payloads regardless of its declared layout. Validators do not error on a slide/layout mismatch.
- When `layout` is omitted, engines infer one from the slide's payload or region keys.
- Free-form layout names that don't resolve through any catalog fall through to engine-defined layouts.

The principle, used throughout OPF: **slides are the source of truth**. Layouts, narratives, and design records guide rendering; they never invalidate content.

## Narrative is intent, not structure

`narrative` declares the deck's story arc. It resolves to a record in the `narratives` catalog (e.g. `"classic-story"`, `"pitch-deck"`), each of which defines ordered **beats** — labeled segments of the arc such as `hook`, `problem`, `evidence`, `ask` — with optional slide-blueprint hints (`slideType`, `layoutHint`, `instructions`, `thoughtCues`).

- Slides opt into beats via `Slide.beat`. Nothing forces them to: validators warn on drift (orphan slides, unused beats) but never error.
- Object form supports overrides: `{ "id": "classic-story", "beats": [...] }` merges inline beats into the catalog record by beat `id`. An object whose `id` matches no record is a fully custom inline narrative.
- Deck-level concerns that aren't part of the storyline — `audience`, `tone`, `takeaway`, `duration` — live as siblings on the presentation root, not inside the narrative.

## Catalog references and how they resolve

Most reusable values in OPF are references into **catalogs**: named collections of records, each identified by a kebab-case `id`. The referencing fields are `narrative`, `language`, `tone`, `audience`, `purpose`, `design.theme`, `design.colorScheme`, `design.fontScheme`, `Slide.layout`, `Chart.type`, and the platform keys in `socials`.

Every reference resolves through the same chain, first match wins:

1. **Inline records** — `catalogs.<kind>.records[]` declared in the document itself.
2. **Document source** — a custom `catalogs.<kind>.source` registry declared in the document.
3. **Default catalog** — `https://www.pptx.gallery/<kind>` (the same records are bundled in `spec/catalogs/` and shipped inside `@openpresentation/opf`).

When a reference is omitted entirely, engines fall back to their own defaults (see [`spec/reference/engine-defaults.json`](../spec/reference/engine-defaults.json) for a reference example — that file is engine configuration, not part of the document contract).

Three reference forms are accepted wherever a catalog reference is allowed:

- **Bare id** for the common case: `"narrative": "classic-story"`, `"design": { "colorScheme": "cool-horizon" }`.
- **Object form** for catalog-backed overrides: `{ "id": "cool-horizon", "accent1": "#0F4C81" }` resolves the record as a base, then inline fields win per key.
- **URL or `pkg:` reference**, which skips the catalog lookup and resolves directly.

Unknown ids produce a validation **warning**, never an error — engines fall back rather than fail.

## Design in one paragraph

`design` selects a `theme` (which bundles default color scheme, font scheme, background, and dimensions) and may override any of those directly; `Slide.design` overrides the deck design per slide. More specific always wins, field by field. Color schemes and font schemes each support two mixable models — OOXML slots/pairs that round-trip to PowerPoint, and abstract roles (`primary`, `heading`, `code`, …) that engines map onto slots. The full precedence chain with worked examples is in [`design-resolution.md`](./design-resolution.md).

## Assets

Binary content lives in the top-level `assets` registry, keyed by id. Content payloads and design fields reference entries with `asset:<id>` strings; asset `src` values accept HTTPS URLs, data URIs, and paths resolved against the OPF file location.

## Validation philosophy

Two layers, with a deliberate split:

- **Schema errors** for structural problems: wrong types, overlapping region keys, payloads mixing incompatible content kinds, a region payload missing concrete content.
- **Warnings** for advisory drift: unknown catalog ids, narrative/slide mismatches. These never make a document invalid.

`validatePresentation` from `@openpresentation/opf` applies both layers locally.

## Where to go next

- [`schema-reference.md`](./schema-reference.md) — every field of every object in the presentation schema.
- [`catalog-schema-reference.md`](./catalog-schema-reference.md) — every field of every catalog record schema.
- [`content-payloads.md`](./content-payloads.md) — payload shapes and inference rules with examples.
- [`design-resolution.md`](./design-resolution.md) — the design precedence algorithm.
- [`examples.md`](./examples.md) — guide to the 124 example decks under `examples/`.
