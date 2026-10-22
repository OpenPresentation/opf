# RR-96 scheme-derived neutrals (core opf#732)

Core opf#732 derives every neutral from the deck's color scheme through the slide's variant map (`roles.neutrals`): `roles.border` is the text color (tx1) at 20% over the background (bg1), chart gridlines are tx1 at 15%, axis lines 25%, instead of fixed slate. Geometry does not change; only the color of cards, table rules and chart furniture does, so nearly every slide with a card, a table or a chart changes. The same PR adds `examples/technical/color-variants.opf.json` (7 slides) to the example corpus.

## What moved

- **Unit tests.** `neutral-scaffolding` expects the derived stroke; the traced SVG digests of `chart-table-data` (31 chart types and the styled table) and the two ordinary digests of `chart-finite-statistics` are re-captured. `golden-gate` no longer hard-codes 807 slides.
- **Baselines.** `exampleBaseline` and `templateBaseline` select new baselines, `opf-examples-png.rr96-scheme-neutrals` and `layout-templates-rr96-scheme-neutrals.json`, when core derives the neutrals (`schemeNeutralsDerived()`); the chart-contract baselines keep their bytes. They are written by the regenerate workflows in the pinned image, not copied from a local run.
- **Example goldens in CI.** The ordinary corpus is compared with core's fixture (`ci.yml` `golden-override`), regenerated on core's branch with `regenerate-core-golden`.

## Review

Every changed slide differs in border, gridline or axis color only (the SVG diffs are `stroke` attributes), plus the seven new color-variants slides. Review the changed PNGs in the workflow artifact before approving.
