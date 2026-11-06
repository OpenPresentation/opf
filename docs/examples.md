# OPF Examples Guide

The `examples/` directory has two shipped layers, plus a docs fixture kept outside the catalog:

- `examples/technical/` contains compact fixtures that isolate one or two schema behaviors.
- `examples/gallery/` contains scenario-oriented decks that show OPF working across industries, functions, education, government, international, presentation-type, and design/media use cases.
- The representative deck for [the published-package quickstart](quickstart.md) lives at [`docs/quickstart/developer-quickstart.opf.json`](quickstart/developer-quickstart.opf.json), outside the catalog, so it does not ship in `@openpresentation/opf/examples`.
- The runnable first deck lives at [`docs/first-deck/`](first-deck/README.md), also outside the catalog: six slides (bullets, a metric, a chart, a styled table, a local image) and a README that goes from install to validate, PNG, PPTX and opening the file in PowerPoint or Keynote, with the known limits.
- `examples/markdown/` holds decks written in the [Markdown dialect](markdown.md) (`.opf.md`, not `.opf.json`, so they are outside the catalog count): `quarterly-review.opf.md` is a Markdown deck that every command reads (`opf validate examples/markdown/quarterly-review.opf.md`); it uses every block kind and is canonical, and `diagrams.opf.md` shows the `mermaid` fence (a diagram, with and without an `alt`). `outline.md` is a plain outline, not a deck (a plain `.md` file is never taken for one), read with `opf convert outline.md deck.opf.json` (a plain `.md` input is OPF Markdown, and an outline with no `---` is cut at its headings). The tests convert, validate, compose and round trip them.
- The examples root is kept as an organizing directory rather than a home for standalone OPF files.

## Technical Fixtures

Use `examples/technical/` when you want a small file that exercises a specific schema surface:

- content payloads, rich text, blocks, charts, tables, media, metrics, quotes, timelines, and diagrams
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
- Mixed content payloads across text, bullets, lists, image, video, chart, table, code, metric, quote, timeline, and diagram slides.
- Catalog references across narratives, layouts, themes, color schemes, font schemes, audiences, purposes and tones, every record embedded under `catalogs.default` or `catalogs.custom`, so each deck validates and renders with no catalog registered; chart types, languages and social platforms as engine vocabularies.

## Adding an example

Put the deck under `examples/` (a gallery deck in the matching `examples/gallery/<folder>/`, a fixture in `examples/technical/`) as an `.opf.json` file, then:

1. `node packages/cli/dist/index.js format -i <file>` and `node packages/cli/dist/index.js validate <file> --fail-on warning`.
2. Rebuild core (`pnpm build`): the `@openpresentation/opf/examples` export and `opf create --example <slug>` pick the deck up from the folder; there is no list to edit.
3. `pnpm check:changed`, and a changelog fragment in `changes/`.

No test counts the examples and no baseline has to change. The renderer's golden check reports a deck it has no hashes for as new and compares every recorded slide as before; run the golden workflow (`.github/workflows/golden.yml`, `workflow_dispatch` on your branch) when you want the new deck's slides recorded, then review them in its artifact. A gallery deck must not set `design.contentAlignment` (LH-88). `examples/gallery/README.md` is generated by `scripts/generate-example-suite.mjs`, and this page by `scripts/generate-schema-docs.mjs`; edit the generators, not the files.

## Validation

Run the example validator after changing any `*.opf.json` file:

```sh
node scripts/validate-examples.mjs
```

The script walks every OPF document under `examples/` and reports schema or semantic validation issues with file paths.
