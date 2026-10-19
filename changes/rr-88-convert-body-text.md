---
type: added
packages: [opf]
---
RR-88, RR-91: `opf convert --body-text measured|native` and `--slide-numbers static|live` (the `bodyText` and `slideNumbers` options of `convert`/`ExportOptions`) reach opf-pptx's `toPptx` as `bodyText` and `slideNumberFields`. `native` is opt-in: a wrapped title is the Title placeholder and a text, bullets or numbered-list region is one body that PowerPoint and Keynote re-wrap, instead of one text box per line; `static` (opf-pptx's default) writes a footer like `{{slide.number}} / {{deck.slideCount}}` as fixed text because Keynote shows only the digit of a live number with words around it, and `live` keeps the field; a bare `{{slide.number}}` stays live in both. Both apply to `.pptx` output only (exit 2 otherwise), and an opf-pptx that predates them is refused with `peer-too-old` rather than ignoring them (opf-pptx 0.22.0 or later).
