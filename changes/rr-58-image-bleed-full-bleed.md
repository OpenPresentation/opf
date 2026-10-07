---
type: fixed
packages: [opf]
---
RR-58 (output-changing for `image-bleed` slides only): the bundled `image-bleed` layout now draws its picture full-bleed behind the slide while the title keeps the normal slide padding. The record reserves a background slide image (`design: { slideImage: { position: "background" } }`) and offers a title placeholder next to its image. A slide names its picture as its slide image (`design.slideImage` with the same source as its `image`), and the picture then covers the whole canvas (0,0,1280,720 at 1280×720) instead of sitting inside the default 8% margin. A slide that names no slide image keeps its picture as padded content. The five example decks that use the layout now name their picture this way. `sync-gallery-catalog.mjs` now refuses a gallery copy of a bundled subset record (a layout, say) that differs from the snapshot in any field, `name` included: core owns the records it bundles, and the gallery adopts them from the core release.
