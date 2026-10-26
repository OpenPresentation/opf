---
type: changed
packages: [opf]
---
The `opf/unresolved-reference` hint names the nearest records that exist ("Did you mean 'two-column'?", else the three nearest layouts, themes and so on) when a catalog is registered. It stays a warning, because catalogs are open; `llms.txt`, the format card, the validate docs and the `opf-author` and `opf-inspect` skills now say a deck is done only when `opf validate deck.opf.json --fail-on warning` passes.
