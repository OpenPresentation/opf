# Technical OPF Examples

This folder contains focused fixtures that isolate OPF schema behavior. They are intentionally smaller and more mechanical than the scenario decks in `examples/gallery/`.

Use these examples when testing validators, renderers, catalog resolution, region semantics, asset source handling, design overrides, metadata forms, and individual content payloads.

Start with [`full-feature-tour.opf.json`](./full-feature-tour.opf.json): a single deck that exercises every major schema surface — intent metadata, organizations and speakers, narrative beat overrides, design with slide-level overrides, assets, inline catalog records, all ten content payload kinds, blocks, regions, hidden slides, and extensions.

## Coverage Areas

- Root slide payloads and explicit content `type` values.
- `blocks` composition.
- Promoted region keys and span combinations.
- Rich text runs in text, bullet, and list payloads.
- Asset shorthand and object forms.
- Inline and asset-backed chart data.
- Design backgrounds, logo sets, headers, footers, watermarks, and slide-level overrides.
- Metadata array forms for organizations, speakers, authors, and takeaways.
- Inline narrative beats and catalog override surfaces.
