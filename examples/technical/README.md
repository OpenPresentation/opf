# Technical OPF Examples

This folder contains focused fixtures that isolate OPF schema behavior. They are intentionally smaller and more mechanical than the scenario decks in `examples/gallery/`.

Use these examples when testing validators, renderers, catalog resolution, region semantics, asset source handling, design overrides, metadata forms, and individual content payloads.

Start with [`full-feature-tour.opf.json`](./full-feature-tour.opf.json): a single self-contained deck (every image is an embedded data URI) that exercises every major schema surface — intent metadata, organizations and speakers, a custom narrative record, design with slide-level overrides, assets, inline catalog records, all ten content payload kinds, blocks, regions, hidden slides, and extensions.

## Coverage Areas

- Root slide payloads and explicit content `type` values.
- `blocks` composition.
- Promoted region keys and span combinations.
- Rich text runs in text, bullet, and list payloads.
- Asset shorthand and object forms.
- Inline and asset-backed chart data.
- Chart emphasis: `chart.highlight` ([`chart-highlight.opf.json`](./chart-highlight.opf.json)).
- Chart series colors: the deck palette, `chart.colors` by position (a color-scheme slot or a hex color, on a column chart and on a pie) and `highlight` winning over it ([`chart-colors.opf.json`](./chart-colors.opf.json)).
- Styled tables: `bold` on a cell style (a bold cell keeps its number `format`), a rich cell in a numeric column, and a `padding` object ([`table-cell-types.opf.json`](./table-cell-types.opf.json)).
- Color variants: `design.variant`, per slide, `tone` on a picture background, and the neutrals that follow ([`color-variants.opf.json`](./color-variants.opf.json), from core 0.23.0).
- Design backgrounds, logo sets, headers, footers, watermarks, and slide-level overrides.
- Metadata array forms for organizations, speakers, authors, and takeaways.
- Custom narrative records, slide beat links and catalog override surfaces.
