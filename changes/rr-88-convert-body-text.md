---
type: added
packages: [opf, cli]
---
RR-88, RR-91: `opf convert --body-text measured|native` and `--slide-numbers static|live` (the `bodyText` and `slideNumbers` options of `convert`/`ExportOptions`) reach opf-pptx's `toPptx` as `bodyText` and `slideNumberWithText`. `native` is opt-in: a wrapped title is the Title placeholder and a text, bullets or numbered-list region is one body that PowerPoint and Keynote re-wrap, instead of one text box per line; `static` writes a footer like `{{slide.number}} / {{deck.slideCount}}` as fixed text so Keynote shows the words around the number. Both apply to `.pptx` output only (exit 2 otherwise), and an opf-pptx that predates them is refused with `peer-too-old` rather than ignoring them (placeholder floor 0.21.0 until the release is cut).
