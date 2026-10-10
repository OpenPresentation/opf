# OPF Examples Guide

The `examples/` directory has two shipped layers, plus a docs fixture kept outside the catalog:

- `examples/technical/` contains compact fixtures that isolate one or two schema behaviors.
- `examples/gallery/` contains scenario-oriented decks that show OPF working across industries, functions, education, government, international, presentation-type, and design/media use cases.
- The representative deck for [the published-package quickstart](quickstart.md) lives at [`docs/quickstart/developer-quickstart.opf.json`](quickstart/developer-quickstart.opf.json), outside the catalog, so `@openpresentation/opf/examples` stays at the published example count (currently 127 decks); the renderer golden corpus tracks that catalog on its own release cadence.
- `examples/markdown/` holds decks written in the [Markdown dialect](markdown.md) (`.opf.md`, not `.opf.json`, so they are outside the catalog count): `quarterly-review.opf.md` is a Markdown deck that every command reads (`opf validate examples/markdown/quarterly-review.opf.md`); it uses every block kind and is canonical. `outline.md` is a plain outline, not a deck (a plain `.md` file is never taken for one), read with `opf convert outline.md deck.opf.json` (a plain `.md` input is OPF Markdown, and an outline with no `---` is cut at its headings). The tests convert, validate, compose and round trip them.
- The examples root is kept as an organizing directory rather than a home for standalone OPF files.

## Technical Fixtures

Use `examples/technical/` when you want a small file that exercises a specific schema surface:

- content payloads, rich text, blocks, charts, tables, media, metrics, quotes, and timelines
- promoted region keys and span combinations
- asset string/object forms and asset-backed chart data
- design backgrounds, organization logo shapes, headers, footers, watermarks, and slide-level overrides
- metadata array forms, language metadata, custom narrative records, and catalog overrides

## Gallery Folders

| Folder | What It Demonstrates |
| --- | --- |
| `industries/` | Vertical market decks with operating plans, investment briefs, readiness reviews, and launch coordination. |
| `business-functions/` | Department-specific decks for sales, marketing, product, engineering, finance, HR, legal, security, support, procurement, and strategy. |
| `education/` | K-12, higher education, research, advising, workforce, advancement, and student services scenarios. |
| `government/` | Public health, transit, emergency management, utilities, regulators, courts, parks, workforce, tax, and civic engagement decks. |
| `presentation-types/` | Reusable deck archetypes such as pitches, board updates, QBRs, conference talks, workshops, postmortems, launches, policy briefings, training, and research reports. |
| `international/` | Region- or language-specific decks, including examples of language object metadata and right-to-left direction. |
| `design-and-media/` | Decks that emphasize design controls, image/video assets, data storytelling, and self-running orientation patterns. |

## Patterns To Look For

- Technical fixtures that isolate validator and renderer behavior.
- Sparse gallery documents that use shorthand catalog references and a small slide list.
- Medium documents with schema ids, metadata, organization and speaker records, design overrides, assets, and richer slide payloads.
- Dense documents with their own records in `catalogs.custom`, promoted region keys, `blocks`, media assets, code payloads, header/footer configuration, organization logo shapes, watermarks, and extensions.
- Mixed content payloads across text, bullets, lists, image, video, chart, table, code, metric, quote, and timeline slides.
- Catalog references across narratives, layouts, themes, color schemes, font schemes, audiences, purposes and tones, every record embedded under `catalogs.default` or `catalogs.custom`, so each deck validates and renders with no catalog registered; chart types, languages and social platforms as engine vocabularies.

## Validation

Run the example validator after changing any `*.opf.json` file:

```sh
node scripts/validate-examples.mjs
```

The script walks every OPF document under `examples/` and reports schema or semantic validation issues with file paths.
