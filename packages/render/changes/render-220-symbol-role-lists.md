---
type: fixed
---
render#220: a symbol-encoded family (Wingdings, Symbol, Webdings) named as a font-scheme role also maps its codes in list bodies (`text: [{ text }]` or `text: ["..."]`), under heading/body and major/minor roles, as #207 made it do for string bodies. Core composes each list paragraph from its block's resolved style, and resolving that open symbol face again dropped the encoding, so `toSvg` threw `missing-glyph`. `resolveStyle` now keeps an encoding whose own preview face was resolved.
