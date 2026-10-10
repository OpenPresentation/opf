# How OPF Works

An OPF document is one JSON file that answers three questions about a presentation:

- **What does it say?** — `slides`, with content payloads and assets.
- **Who is it for and why?** — `audience`, `purpose`, `tone`, `language`, and `narrative`.
- **What should it look like?** — `design`, resolved through themes, color schemes, and font schemes.

The document records intent; an engine (a renderer, exporter, or editor) turns that intent into pixels or `.pptx` output. OPF deliberately stops at the format boundary: it never embeds OOXML, layout geometry, or renderer-specific state. You — or your agent — own the story, the data, and the ask; the format's job is to keep all of that readable, diffable, and out of `<p:sp>` tags.

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
├── variables ..... named colors, referenced from content as "var:<id>"
├── assets ........ named media sources, referenced as "asset:<id>"
└── catalogs ...... the records the document embeds, grouped by catalog: default, custom, named
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
                  left                 center                 right
         +--------------------+--------------------+--------------------+
   top   |  top:left          |  top:center        |  top:right         |
         +--------------------+--------------------+--------------------+
  middle |  middle:left       |  middle:center     |  middle:right      |
         +--------------------+--------------------+--------------------+
  bottom |  bottom:left       |  bottom:center     |  bottom:right      |
         +--------------------+--------------------+--------------------+

  A bare column key ("left") spans all three rows.
  A bare row key ("top") spans all three columns.
  Keys span neighbors with "+" and intersect rows with columns via ":".
```

The spans compose into the slide shapes you actually want:

```
  "left" + "center+right"             "top" + "middle+bottom"
  (sidebar + main)                    (headline band + body)
  +----------+------------------+     +-------------------------------+
  |          |                  |     |              top              |
  |          |                  |     +-------------------------------+
  |   left   |  center+right    |     |                               |
  |          |                  |     |         middle+bottom         |
  |          |                  |     |                               |
  +----------+------------------+     +-------------------------------+

  "top" + "middle+bottom:left" + "middle+bottom:center+right"
  (headline band, then sidebar + main)
  +---------------------------------------------+
  |                     top                     |
  +---------------+-----------------------------+
  |               |                             |
  | middle+bottom | middle+bottom:center+right  |
  | :left         |                             |
  |               |                             |
  +---------------+-----------------------------+
```

That last shape in JSON:

```json
{
  "title": "Adoption Doubled",
  "top": { "text": "Adoption doubled while support load stayed flat." },
  "middle+bottom:left": { "metric": { "value": "2.1x", "label": "Adoption" } },
  "middle+bottom:center+right": {
    "chart": { "type": "line", "data": { "columns": ["Month", "Teams"], "rows": [["Jan", 12], ["Feb", 18]] } }
  }
}
```

And the two-column shape from the grid above:

```json
{
  "title": "Operating Snapshot",
  "left": { "table": { "columns": ["Metric", "Value"], "rows": [["Revenue", "$4.2M"]] } },
  "center+right": { "chart": { "type": "line", "data": { "columns": ["Month", "Revenue"], "rows": [["Jan", 3.4]] } } }
}
```

Region keys on one slide must not overlap, and regions cannot be mixed with a root payload. Slide-level strings `title`, `subtitle`, and `tag` sit alongside whichever content shape you use, and render into the matching placeholders of the resolved layout.

## Layouts are hints, not contracts

`Slide.layout` optionally references a layout record. The layout's placeholders describe what the layout *exposes* (a title slot, chart regions, image treatment) — they do not constrain what the slide may contain. This loose coupling is intentional:

- A slide may use any region keys or payloads regardless of its declared layout. Validators do not error on a slide/layout mismatch.
- When `layout` is omitted, engines compose the slide automatically from its payload or region keys; that is not a finding.
- A layout reference that resolves nowhere is the warning `opf/unresolved-reference`, and the slide composes automatically. Engines never substitute a different layout.

The principle, used throughout OPF: **slides are the source of truth**. Layouts, narratives, and design records guide rendering; they never invalidate content.

## Narrative is a plan; the deck holds a pointer

A narrative is a **plan**: a story arc, its ordered **beats** (labeled segments such as `hook`, `problem`, `evidence`, `ask`) and what each beat must do. A deck is the **product**. So the plan is a narrative record and the deck holds only a pointer: `narrative` is a reference, a bare id (`"classic-story"`, `"pitch-deck"`) or `name:id` for a record of a named catalog group. A beat carries its blueprint: `type` is the slide's `Slide.type`, `layout` is its `Slide.layout`, and `instructions` and `thoughtCues` guide the author. A record's `duration { min, max }` is the talk length in minutes it suits.

Slides link themselves to beats with `Slide.beat`. Nothing forces them to, and the preview and the PPTX export draw nothing from the narrative. `validate` warns about a `slides[].beat` id the narrative does not define (`opf/unknown-beat`) and about a root `duration` outside the narrative's range (`opf/duration-outside-narrative`), and reports a beat that no slide references (`opf/unused-beat`, info).

A narrative the document defines itself is a record in `catalogs.custom.narratives`, and `narrative` names its key. There is one shape, the record:

```json
{
  "name": "Schema Pitch",
  "narrative": "technical-proof",
  "duration": 12,
  "catalogs": {
    "custom": {
      "narratives": {
        "technical-proof": {
          "name": "Technical Proof",
          "duration": { "min": 8, "max": 20 },
          "beats": [
            { "id": "contract", "name": "Contract", "type": "text", "instructions": "State what stays stable." },
            { "id": "evidence", "name": "Evidence", "type": "chart" },
            { "id": "adoption", "name": "Adoption", "type": "list" }
          ]
        }
      }
    }
  },
  "slides": [
    { "beat": "contract", "title": "The Contract", "text": "Beats describe intent without constraining slides." },
    { "beat": ["evidence", "adoption"], "title": "Proof And Ask", "items": ["One slide may cover several beats."] }
  ]
}
```

The plan is also a skeleton deck: a planner emits slides that carry `beat`, `type`, `layout`, `title` and `notes`, which is a valid deck from the start. Deck-level concerns that are not part of the storyline (`audience`, `tone`, `takeaway`, `duration`) live as siblings on the presentation root.

## Catalog references and how they resolve

Reusable design and intent records live in **catalogs**: a layout, a theme, a colour scheme, a font scheme, a narrative, an audience, a purpose or a tone. The referencing fields are `Slide.layout`, `design.theme`, `design.colorScheme`, `design.fontScheme` (and the same three on `Slide.design`), `narrative`, `audience`, `purpose` and `tone`, plus the `colorScheme` and `fontScheme` a theme record names and the font schemes of a `language` object.

A reference is a bare id (`"two-column"`) or `name:id` (`"acme:hero"`), where the prefix names a group of the document's `catalogs`. URLs and `pkg:` strings are not references. A document's `catalogs` groups the records it embeds by the catalog they came from:

```json
"catalogs": {
  "default": { "source": "https://www.pptx.gallery", "layouts": { "two-column": { "name": "Two column", "placeholders": [{ "type": "title" }, { "type": "text" }, { "type": "text" }] } } },
  "acme": { "source": "pkg:@acme/opf-catalog", "themes": { "brand": { "name": "Brand", "colorScheme": "ocean", "fontScheme": "inter" } } },
  "custom": { "layouts": { "q4-special": { "name": "Q4 special", "placeholders": [{ "type": "title" }, { "type": "chart" }] } } }
}
```

- `default` is the catalog bare ids come from. Leave it out to use the host's default catalog; `"default": false` turns the fallback off, so every bare id must be embedded.
- `custom` holds the records the document defines itself. It has no source.
- Any other name is an extra catalog, identified by its `source` (an HTTPS URL or a `pkg:` reference), and is the prefix its references use.
- Embedded records carry no `$schema` or `id`: the key is the id.

Every reference resolves the same way, first match wins:

```
   "layout": "two-column"                       "layout": "acme:hero"
          |                                              |
          v                                              v
   1. catalogs.custom.layouts               1. catalogs.acme.layouts
          | miss                                         | miss
          v                                              v
   2. catalogs.default.layouts              2. the catalog the host registered
          | miss                                for catalogs.acme.source
          v                                              | miss
   3. the catalog the host registered                    v
      for catalogs.default.source           opf/unresolved-reference
      (the host default when default
      is omitted; nothing when false)
          | miss
          v
   opf/unresolved-reference
```

A reference written inside an embedded record resolves in that record's own group first: acme's `brand` theme finds acme's `ocean` colour scheme before the default catalog's. A reference that resolves nowhere is the warning `opf/unresolved-reference`, which names the reference and the catalog's source; the slide composes automatically and the design uses the [engine defaults](../spec/reference/engine-defaults.json). A strict export fails instead. A prefix that names no group is a validation error.

Engines never fetch a catalog. Core ships no records in its main entry: a host registers the catalogs it trusts (`{ catalogs: [gallery, acmeCatalog] }`, where `gallery` comes from `@openpresentation/gallery`, the pptx.gallery catalog; in Node, core registers it when a call names none), and authoring tools embed every record a document uses when they save it (`embed`), so a saved document renders the same anywhere, offline. See [the default catalog](default-catalog.md).

Two reference forms are accepted:

- **A reference string** for the common case: `"narrative": "classic-story"`, `"theme": "acme:brand"`.
- **Object form** for overrides on a referenced record (colour schemes, font schemes, audiences, purposes and tones): `{ "id": "cool-horizon", "accent1": "#0F4C81" }` resolves the record as a base, then inline fields win per key.

`chart.type`, the `language` tag and the platform keys of `socials` are **engine vocabularies**, not catalog references: the schema validates them directly, and their labels and descriptions are catalog display metadata.

A document can carry its own records, and take records from a company catalog by name:

```json
{
  "name": "Branded Deck",
  "design": { "colorScheme": "acme-brand" },
  "narrative": "acme:quarterly-arc",
  "catalogs": {
    "custom": {
      "colorSchemes": { "acme-brand": { "name": "Acme Brand", "accent1": "#0F4C81", "light1": "#FFFFFF", "dark1": "#0B1B2B" } }
    },
    "acme": {
      "source": "https://catalogs.example.com",
      "narratives": { "quarterly-arc": { "name": "Quarterly arc", "beats": [{ "id": "result", "name": "Result" }] } }
    }
  },
  "slides": [{ "title": "Branded Deck", "beat": "result" }]
}
```

## Design in one paragraph

`design` selects a `theme` (which bundles default color scheme, font scheme, background, and dimensions) and may override any of those directly; `Slide.design` overrides the deck design per slide. More specific always wins, field by field. Color schemes and font schemes each support two mixable models — OOXML slots/pairs that round-trip to PowerPoint, and abstract roles (`primary`, `heading`, `code`, …) that engines map onto slots. Content color fields (rich-text runs, styled table cells) reference the design system by name — a scheme slot (`accent2`), a role (`text`), or a `var:<id>` entry from the top-level `variables` map — so styled content follows a re-theme instead of freezing hex values. The full precedence chain with worked examples is in [`design-resolution.md`](./design-resolution.md).

## Assets

Binary content lives in the top-level `assets` registry, keyed by id. Content payloads and design fields reference entries with `asset:<id>` strings; asset `src` values accept HTTPS URLs, data URIs, and paths resolved against the OPF file location.

## A complete small deck

Everything above, together — intent metadata, a catalog-backed narrative with beats, design, an organization and speaker, an asset-backed chart, regions, notes, and sections:

```json
{
  "$schema": "https://openpresentation.org/schema/opf/v1",
  "name": "Q3 Business Review",
  "description": "Quarterly review for the executive team.",
  "audience": "executive",
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
    "footer": { "left": { "text": "{{organization.name}}" }, "right": { "text": "{{slide.number}}" } }
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
        "chart": { "type": "line", "data": { "columns": ["Month", "Active Teams"], "rows": [["Jul", 8], ["Aug", 12], ["Sep", 17]], "source": { "src": "asset:adoption-csv" } } }
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

The beat ids (`objectives`, `performance-headline`, `risks`, `asks`) come from the `qbr` narrative record; the theme, color scheme and layout resolve in the default catalog the host registers (or in the records the saved deck embeds), and the chart type is an engine vocabulary. For a fixture that exercises the full surface in one file, see [`examples/technical/full-feature-tour.opf.json`](../examples/technical/full-feature-tour.opf.json).

## Validation philosophy

Two layers, with a deliberate split:

- **Schema errors** for structural problems: wrong types, overlapping region keys, payloads mixing incompatible content kinds, a region payload missing concrete content, duplicate slide or payload ids.
- **Warnings** for advisory drift: references that resolve nowhere (`opf/unresolved-reference`), unknown `var:` variable references and unrecognized run colors, narrative/slide mismatches. These never make a document invalid.

`validate` from `@openpresentation/opf` applies both layers locally and, beyond them, checks references, accessibility, layout and content ([validate](validate.md)).

## Where to go next

- [`schema-reference.md`](./schema-reference.md) — every field of every object in the presentation schema.
- [`catalog-schema-reference.md`](./catalog-schema-reference.md) — every field of every catalog record schema.
- [`content-payloads.md`](./content-payloads.md) — payload shapes and inference rules with examples.
- [`design-resolution.md`](./design-resolution.md) — the design precedence algorithm.
- [`examples.md`](./examples.md) — guide to the example decks under `examples/`.

Then write a deck, commit it, revise it, and read the diff. A two-line diff for a two-word change is the whole argument for the format.
