# How OPF Works

An OPF document is one JSON file that answers three questions about a presentation:

- **What does it say?** — `slides`, with content payloads and assets.
- **Who is it for and why?** — `audience`, `purpose`, `tone`, `language`, and `narrative`.
- **What should it look like?** — `design`, resolved through themes, color schemes, and font schemes.

The document records intent; an engine (a renderer, exporter, or editor) turns that intent into pixels or `.pptx` output. OPF deliberately stops at the format boundary: it never embeds OOXML, layout geometry, or renderer-specific state.

## Anatomy of a document

```
Presentation
├── identity ...... name, description, organization, speaker, author
├── intent ........ audience, purpose, tone, language, narrative, takeaway, duration
├── content ....... slides[]
│                     ├── title / subtitle / tag / notes / section / beat / layout
│                     └── one content shape:
│                           root payload   (a single content kind)
│                           blocks[]       (ordered payloads, placement inferred)
│                           region keys    (3x3 placement grid)
├── design ........ theme, colorScheme, fontScheme, background, logo, header, footer
├── assets ........ named media sources, referenced as "asset:<id>"
└── catalogs ...... per-kind overrides: inline records and/or custom sources
```

Only `slides` is required. The smallest valid document:

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

**1. Root payload** — one content kind directly on the slide. The kind is inferred from the field present (`text`, `items`, `chart`, `table`, `image`, `video`, `code`, `metric`, `quote`, `timeline`); see [`content-payloads.md`](./content-payloads.md) for the full table.

```json
{
  "title": "Operating Metric",
  "metric": { "value": "42%", "label": "Review cycle reduction", "trend": "up" }
}
```

Multiple kinds at the slide root (with no explicit `type`, `blocks`, or regions) are shorthand for the equivalent `blocks`:

```json
{
  "title": "Habitat",
  "text": "Jaguars are strongly associated with water and dense cover.",
  "items": ["Rainforests and flooded wetlands", "Large defended territories"]
}
```

**2. `blocks`** — an ordered list of payloads when a slide has several pieces of content but placement should stay renderer-inferred:

```json
{
  "title": "Customer Feedback",
  "blocks": [
    { "table": { "columns": ["Theme", "Mentions"], "rows": [["Speed", 42], ["Ease of use", 31]] } },
    { "quote": { "text": "The new workflow cut review time in half.", "attribution": "Operations Lead" } }
  ]
}
```

**3. Promoted region keys** — a 3×3 placement grid when position matters:

```
            left          center          right
        +-------------+-------------+-------------+
  top   | top:left    | top:center  | top:right   |
        +-------------+-------------+-------------+
 middle | middle:left | middle:...  | middle:right|
        +-------------+-------------+-------------+
 bottom | bottom:left | bottom:...  | bottom:right|
        +-------------+-------------+-------------+

  A bare column key ("left") spans all three rows.
  A bare row key ("top") spans all three columns.
  Keys span with "+":  "center+right", "top+middle",
  and combine row with column:  "middle+bottom:center+right".
```

```json
{
  "title": "Operating Snapshot",
  "left": { "table": { "columns": ["Metric", "Value"], "rows": [["Revenue", "$4.2M"]] } },
  "center+right": { "chart": { "type": "line", "data": { "columns": ["Month", "Revenue"], "rows": [["Jan", 3.4]] } } }
}
```

Region keys on one slide must not overlap, and regions cannot be mixed with a root payload. Slide-level strings `title`, `subtitle`, and `tag` sit alongside whichever content shape you use, and render into the matching placeholders of the resolved layout.

## Layouts are hints, not contracts

`Slide.layout` optionally references a record in the `layouts` catalog. The layout's placeholders describe what the layout *exposes* (a title slot, chart regions, image treatment) — they do not constrain what the slide may contain. This loose coupling is intentional:

- A slide may use any region keys or payloads regardless of its declared layout. Validators do not error on a slide/layout mismatch.
- When `layout` is omitted, engines infer one from the slide's payload or region keys.
- Free-form layout names that don't resolve through any catalog fall through to engine-defined layouts.

The principle, used throughout OPF: **slides are the source of truth**. Layouts, narratives, and design records guide rendering; they never invalidate content.

## Narrative is intent, not structure

`narrative` declares the deck's story arc. It resolves to a record in the `narratives` catalog (e.g. `"classic-story"`, `"pitch-deck"`), each of which defines ordered **beats** — labeled segments of the arc such as `hook`, `problem`, `evidence`, `ask` — with optional slide-blueprint hints (`slideType`, `layoutHint`, `instructions`, `thoughtCues`).

Slides opt into beats via `Slide.beat`. Nothing forces them to: validators warn on drift (orphan slides, unused beats) but never error.

```json
{
  "name": "Schema Pitch",
  "narrative": {
    "id": "technical-proof",
    "name": "Technical Proof",
    "beats": [
      { "id": "contract", "name": "Contract", "slideType": "text", "instructions": "State what stays stable." },
      { "id": "evidence", "name": "Evidence", "slideType": "chart" },
      { "id": "adoption", "name": "Adoption", "slideType": "list" }
    ]
  },
  "slides": [
    { "beat": "contract", "title": "The Contract", "text": "Beats describe intent without constraining slides." },
    { "beat": ["evidence", "adoption"], "title": "Proof And Ask", "items": ["One slide may cover several beats."] }
  ]
}
```

Object form supports overrides: `{ "id": "classic-story", "beats": [...] }` merges inline beats into the catalog record by beat `id`. An object whose `id` matches no record — like `technical-proof` above — is a fully custom inline narrative. Deck-level concerns that aren't part of the storyline (`audience`, `tone`, `takeaway`, `duration`) live as siblings on the presentation root, not inside the narrative.

## Catalog references and how they resolve

Most reusable values in OPF are references into **catalogs**: named collections of records, each identified by a kebab-case `id`. The referencing fields are `narrative`, `language`, `tone`, `audience`, `purpose`, `design.theme`, `design.colorScheme`, `design.fontScheme`, `Slide.layout`, `Chart.type`, and the platform keys in `socials`.

Every reference resolves through the same chain, first match wins:

```
        "design": { "colorScheme": "cool-horizon" }
                          |
                          v
   1. catalogs.colorSchemes.records[]    inline records in this document
                          | miss
                          v
   2. catalogs.colorSchemes.source       custom registry declared in this document
                          | miss
                          v
   3. default catalog                    https://www.pptx.gallery/color-schemes
                          | miss         (bundled in spec/catalogs/ and in
                          v               the @openpresentation/opf package)
   validation warning — never an error — and an engine fallback
```

When a reference is omitted entirely, engines fall back to their own defaults (see [`spec/reference/engine-defaults.json`](../spec/reference/engine-defaults.json) for a reference example — that file is engine configuration, not part of the document contract).

Three reference forms are accepted wherever a catalog reference is allowed:

- **Bare id** for the common case: `"narrative": "classic-story"`.
- **Object form** for catalog-backed overrides: `{ "id": "cool-horizon", "accent1": "#0F4C81" }` resolves the record as a base, then inline fields win per key.
- **URL or `pkg:` reference**, which skips the catalog lookup and resolves directly.

A document can carry its own records or point at a private registry, which also silences unknown-id warnings for that kind:

```json
{
  "name": "Branded Deck",
  "design": { "colorScheme": "acme-brand" },
  "catalogs": {
    "colorSchemes": {
      "records": [{ "id": "acme-brand", "accent1": "#0F4C81", "light1": "#FFFFFF", "dark1": "#0B1B2B" }]
    },
    "narratives": { "source": "https://catalogs.example.com/narratives" }
  },
  "slides": [{ "title": "Branded Deck" }]
}
```

## Design in one paragraph

`design` selects a `theme` (which bundles default color scheme, font scheme, background, and dimensions) and may override any of those directly; `Slide.design` overrides the deck design per slide. More specific always wins, field by field. Color schemes and font schemes each support two mixable models — OOXML slots/pairs that round-trip to PowerPoint, and abstract roles (`primary`, `heading`, `code`, …) that engines map onto slots. The full precedence chain with worked examples is in [`design-resolution.md`](./design-resolution.md).

## Assets

Binary content lives in the top-level `assets` registry, keyed by id. Content payloads and design fields reference entries with `asset:<id>` strings; asset `src` values accept HTTPS URLs, data URIs, and paths resolved against the OPF file location.

## A complete small deck

Everything above, together — intent metadata, a catalog-backed narrative with beats, design, an organization and speaker, an asset-backed chart, regions, notes, and sections:

```json
{
  "$schema": "https://openpresentation.org/schema/opf/v1",
  "name": "Q3 Business Review",
  "description": "Quarterly review for the executive team.",
  "audience": "executives",
  "purpose": "decide",
  "tone": "formal",
  "language": "en-US",
  "narrative": "qbr",
  "takeaway": "Approve the expanded rollout budget.",
  "duration": 20,
  "organization": {
    "id": "acme",
    "name": "Acme Corp",
    "domain": "acme.com",
    "socials": { "linkedin": "acme" }
  },
  "speaker": { "id": "alice", "name": "Alice Chen", "title": "VP Operations", "organizationId": "acme" },
  "design": {
    "theme": "classic",
    "colorScheme": "forest-green",
    "footer": { "left": { "organization": true }, "right": { "slideNumber": true } }
  },
  "assets": {
    "adoption-csv": { "src": "./data/adoption.csv", "alt": "Monthly adoption data" }
  },
  "slides": [
    {
      "layout": "title",
      "beat": "objectives",
      "title": "Q3 Business Review",
      "subtitle": "Operations — October 2025"
    },
    {
      "beat": "performance-headline",
      "title": "Adoption Doubled",
      "left": { "metric": { "value": "2.1x", "label": "Quarter-over-quarter adoption", "trend": "up" } },
      "center+right": {
        "chart": { "type": "line", "data": { "src": "asset:adoption-csv", "columns": ["Month", "Active Teams"] } }
      },
      "notes": "Pause here; this is the slide the decision hangs on."
    },
    {
      "beat": "risks",
      "section": "Decision",
      "title": "What Could Go Wrong",
      "items": [
        "Capacity: two regions are at 85% utilization.",
        {
          "text": "Churn risk in the legacy tier.",
          "description": "Mitigation: migration incentives ship in November."
        }
      ]
    },
    {
      "beat": "asks",
      "title": "The Ask",
      "text": "Approve $1.2M to expand the rollout to all regions in Q4."
    }
  ]
}
```

The beat ids (`objectives`, `performance-headline`, `risks`, `asks`) come from the `qbr` narrative record; the theme, color scheme, chart type, and layout all resolve through the bundled catalogs. For a fixture that exercises the full surface in one file, see [`examples/technical/full-feature-tour.opf.json`](../examples/technical/full-feature-tour.opf.json).

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
- [`examples.md`](./examples.md) — guide to the example decks under `examples/`.
