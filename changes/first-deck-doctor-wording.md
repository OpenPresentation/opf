---
type: fixed
packages: []
---
The first-deck guide says what `opf doctor deck.opf.json` reports (every format `ready` and the `Script fonts this deck needs` line, JSON `scriptFonts: { checked, missing, reason? }`), not just that every format shows `ready`; `scripts/layout-sampler-sheet.mjs` names an empty or missing folder and exits non-zero instead of throwing a renderer error.
