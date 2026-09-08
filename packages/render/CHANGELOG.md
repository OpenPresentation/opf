# Changelog

## 0.1.0

- Require OPF 0.4.0, enabling standalone installs of shared composition, nested layouts, pagination, measured rich text and lists.
- Provide browser-safe SVG rendering, traceable content geometry, design previews, and local PNG/PDF conversion.
- Bundle open-source fonts with explicit substitution policies, browser font loading, measurement and embedding support.
- Keep timeline endpoint labels and markers within their content region, including portrait layouts.
- Run a mandatory raster regression check across 805 slides in 126 installed OPF example decks. Missing or changed corpora fail. Baseline updates create review candidates and preserve the historical manifest.
- Verify clean registry installs on Node 20 and 24 before publishing with provenance.

The raster baseline records current output, including known media, advanced-chart, contrast and language-shaping limitations. Native PowerPoint parity is not established. See `test/golden/README.md` for the review scope.
