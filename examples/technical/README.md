# Technical OPF Examples

This folder contains focused fixtures that isolate OPF schema behavior. They are intentionally smaller and more mechanical than the scenario decks in `examples/gallery/`.

Use these examples when testing validators, renderers, catalog resolution, region semantics, asset source handling, design overrides, metadata forms, and individual content payloads.

Start with [`full-feature-tour.opf.json`](./full-feature-tour.opf.json): a single self-contained deck (every image is an embedded data URI) that exercises every major schema surface — intent metadata, organizations and speakers, a custom narrative record, design with slide-level overrides, assets, inline catalog records, all ten content payload kinds, blocks, regions, hidden slides, and extensions.

The relative image paths these fixtures name (`./assets/logo.svg`, `./assets/cover.png`) exist in [`assets/`](./assets/): original abstract artwork, MIT licensed with this repository, written by `scripts/generate-technical-example-assets.mjs`, so `opf convert` of every fixture finds its images. The fixtures' `./media/demo.mp4` and `./data/pipeline.csv` references stay authoring examples: no conversion reads a video or a data file.

[`layout-sampler.opf.json`](./layout-sampler.opf.json) has one slide for each of the 30 default layouts and 13 dynamic compositions, on one fictional pilot story. Use it to review a layout change: `node scripts/render-layout-sampler.mjs <dir>` renders it against this checkout's gallery (ignoring the records it embeds), one PNG per slide, and `node scripts/layout-sampler-sheet.mjs <dir> <sheet.png>` tiles the PNGs into a labelled contact sheet.

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
- Diagrams: Mermaid `diagram` payloads (a full-slide flowchart, a sequence diagram beside text, a mind map, a timeline-family diagram, a pie diagram, a diagram with `alt`, and a diagram on a dark variant) drawn in the deck's fonts and colors ([`diagrams.opf.json`](./diagrams.opf.json)).
- DOT diagrams: Graphviz DOT `diagram` payloads (`syntax: "dot"`): a release pipeline with a cluster and a decision, an undirected service graph beside text, an architecture with a database cylinder, a state graph on a dark variant, and a graph with `alt` and a caption ([`dot-diagrams.opf.json`](./dot-diagrams.opf.json)).
- Design backgrounds, logo sets, headers, footers, watermarks, and slide-level overrides (including `design.listBullet: "none"` for a label with its description, [`slide-design-overrides.opf.json`](./slide-design-overrides.opf.json)).
- Metadata array forms for organizations, speakers, authors, and takeaways.
- Custom narrative records, slide beat links and catalog override surfaces.
