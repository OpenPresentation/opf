---
type: added
---
RR-61: `embedFonts: false` for `renderSvg`, `renderSlideSvg` and `resolvePresentation` writes no `@font-face` data while the `fonts` handle still measures, for a browser host whose `loadFonts` handle already added the faces to the page (an editor's live previews). Keep the default where an SVG must stand alone (a saved file, the browser PDF export).
