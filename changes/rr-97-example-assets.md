---
type: fixed
packages: [opf]
---
RR-97: every example deck under `examples/` converts to PNG and PPTX with `opf convert`. The 100 gallery decks embed their supporting photo as generated abstract artwork (`supporting-photo` in `scripts/gallery-artwork.mjs`, v2) instead of naming a `./assets/<organization>-field-photo.jpg` that did not exist, which made 85 decks fail with `pptx/asset-unresolved`; the decks that paired English text with a complex script or East Asian font scheme now use a Latin scheme, so they convert without the optional script font packages; the technical examples' relative images now exist under `examples/technical/assets/`. `pnpm check:examples-convert` converts every example and fails on a non-zero exit or an error finding. The `demo-video` and `metric-data` references stay authoring examples: no conversion format reads them.
