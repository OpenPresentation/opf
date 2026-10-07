---
type: changed
packages: [cli]
---
FA-08 (output-changing): `opf render` and `opf export` skip slides marked `hidden: true` when they write per-slide SVG or PNG files, a zip or a PDF, and keep them with the new `--include-hidden` flag (slides named with `--slides` are always written; the PPTX keeps hidden slides as hidden slides; the report lists `skippedHidden`). Output files are named by the deck's root `filename` (a trailing .pptx, .pdf, .png or .svg is dropped), else its slugified `name`, else the input file's stem, as opf-editor names its downloads, so `deck.opf.json` with the name "Q4 Review" now writes `Q4-Review.pdf`. The `hidden` and `filename` descriptions in `opf.schema.json` now state this behavior.
