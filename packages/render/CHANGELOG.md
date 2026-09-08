# Changelog

## Unreleased

- Render embedded WebP images in PNG/PDF output instead of dropping them. Preserve alpha, EXIF orientation, fit/crop and the first animation frame without modifying source SVG.
- Add lazy Node-only Sharp 0.35.4 decoding; raise the Node minimum to 20.9.0. Report malformed embedded images with their source path and enforce a 40-megapixel input limit.
- Check decoded PNG pixels, actual PDF image streams/alpha masks, image URI encodings and all 805 unchanged raster baselines.

## 0.1.1

- Include rich-text line offsets and measured boxes in opt-in SVG tracing, including empty and trailing lines, for editor caret placement. Normal SVG/PNG output is unchanged; all 805 raster checks pass.

## 0.1.0

- Require OPF 0.4.0, enabling standalone installs of shared composition, nested layouts, pagination, measured rich text and lists.
- Provide browser-safe SVG rendering, traceable content geometry, design previews, and local PNG/PDF conversion.
- Bundle open-source fonts with explicit substitution policies, browser font loading, measurement and embedding support.
- Keep timeline endpoint labels and markers within their content region, including portrait layouts.
- Run a mandatory raster regression check across 805 slides in 126 installed OPF example decks. Missing or changed corpora fail. Baseline updates create review candidates and preserve the historical manifest.
- Verify clean registry installs on Node 20 and 24 before publishing with provenance.

The raster baseline records current output, including known media, advanced-chart, contrast and language-shaping limitations. Native PowerPoint parity is not established. See `test/golden/README.md` for the review scope.
