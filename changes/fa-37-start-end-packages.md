---
type: changed
packages: [render, pptx, editor, gallery, cli, mcp]
---
FA-37 (breaking): the layout words that follow the deck's direction are `start` and `end` instead of `left` and `right` (title and content alignment, `chartPrimary`, footer zones, promoted regions such as `top:start`, `caption.align`, a cell's `style.align`, and image and overlay `edge`), and this package reads and writes the new words. To update a deck, rename `left` to `start` and `right` to `end` in those places; validation suggests the new word, and the core changelog lists every schema path.
