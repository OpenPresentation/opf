---
type: changed
---
RR-61: the canvas and the playground previews (thumbnails, the properties, data, template and transfer panels) draw with the full fonts handle and the renderer's `embedFonts: false` (opf-render 0.16.0), in place of the internal `previewFonts` helper that handed on only the text measurement (opf-editor#116). The SVGs still carry no `@font-face` data, since the browser handle already added the faces to the page; exports keep the renderer's default and embed exactly the faces each slide draws. `previewFonts` is removed from `src/font-gate.js`.
