---
type: fixed
packages: [opf]
---
RR-58 (output-changing for `image-bleed` slides only): the bundled `image-bleed` layout record now carries `composition: { padding: 0 }`, so a slide that names only the layout composes its image at the full canvas (0,0,1280,720 at 1280×720) instead of inside the default 8% margin. A slide's own `composition.padding` still overrides it. `sync-gallery-catalog.mjs` now refuses a gallery copy of a bundled subset record (a layout, say) that differs from the snapshot in any field, `name` included: core owns the records it bundles, and the gallery adopts them from the core release.
