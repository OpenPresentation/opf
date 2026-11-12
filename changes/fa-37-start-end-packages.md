---
type: changed
packages: [render, pptx, editor, gallery, cli, mcp]
---
FA-37 (breaking): layout words that follow the deck's direction are `start` and `end` instead of `left` and `right`; this package reads and writes the new words. Rename them in your decks; validation suggests the new word, and the core changelog lists every place.
