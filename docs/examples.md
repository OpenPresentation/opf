# OPF Examples Guide

The `examples/` directory has three layers:

- `examples/technical/` contains compact fixtures that isolate one or two schema behaviors.
- `examples/gallery/` contains scenario-oriented decks that show OPF working across industries, functions, education, government, international, presentation-type, and design/media use cases.
- The examples root is kept as an organizing directory rather than a home for standalone OPF files.

## Technical Fixtures

Use `examples/technical/` when you want a small file that exercises a specific schema surface:

- content payloads, rich text, blocks, charts, tables, media, metrics, quotes, and timelines
- promoted region keys and span combinations
- asset string/object forms and asset-backed chart data
- design backgrounds, logo sets, headers, footers, watermarks, and slide-level overrides
- metadata array forms, language metadata, narrative beats, and catalog overrides

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
- Dense documents with inline `catalogs` sources and records, promoted region keys, `blocks`, media assets, code payloads, header/footer configuration, logo sets, watermarks, and extensions.
- Mixed content payloads across text, bullets, lists, image, video, chart, table, code, metric, quote, and timeline slides.
- Catalog references across narratives, layouts, chart types, themes, color schemes, font schemes, languages, audiences, purposes, tones, and social platforms.

## Validation

Run the example validator after changing any `*.opf.json` file:

```sh
node scripts/validate-examples.mjs
```

The script walks every OPF document under `examples/` and reports schema or semantic validation issues with file paths.
