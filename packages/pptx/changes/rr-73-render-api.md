---
type: changed
---
RR-73 (requires opf-render 0.18 for the optional peer; no `toPptx` or `fromPptx` API change): the exporter calls opf-render's renamed `toPng` where it called `svgToPng` (the default rasterizer of the PNG fallback of an SVG picture; `options.svgRasterizer` is unchanged), and the tests and scripts that draw previews use `toSvg`, `toPng` and the 1-based slide argument. The optional peer range moves to `^0.18.0` in the release-prep pull request.
