---
type: changed
packages: [opf]
---
RR-89 (output-changing for charts in decks that use a non-default colour scheme once the renderer and PPTX exporter adopt it): `chartSeriesPalette(colorScheme)` on `@openpresentation/opf/composition` returns the twelve chart series colours of a deck: `accent1` to `accent6` of the resolved colour scheme, then the same accents mixed 40% towards white. The `chart-color-only` rule judges each slide's own scheme instead of the fixed cool-horizon palette, and `DEFAULT_CHART_PALETTE` is removed (`ValidateOptions.chartPalette` still overrides the deck palette). Palette order is documented in `docs/chart-options.md`.
