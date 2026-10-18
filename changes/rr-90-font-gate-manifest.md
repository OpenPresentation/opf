---
type: changed
packages: []
---
RR-90: the renderer font-count release gate (`scripts/lazy-font-counts.mjs`) admits an unlisted stable renderer version when the 143 font files of its package (`dist/font-manifest.js` and everything under `fonts/`) hash to a reviewed set and its measured lazy face count equals that set's count, so a renderer release with unchanged fonts needs no manual entry. A changed font set, a changed count or a prerelease still fails with a message that names the change. The reviewed set is the font set shared by the published renderers 0.18.1, 0.20.0, 0.20.2 and 0.20.4 (manifest SHA-256 16d0b414…, 94 lazy faces).
